/*
 * Temperature conversion core — pure functions, zero DOM, shared by the
 * browser (window.TempCore) and Node tests (module.exports).
 *
 * Canonical axis: Celsius. Absolute zero = -273.15 C.
 */
(function (root) {
  'use strict';

  const SCALES = ['C', 'F', 'K', 'R'];
  const ABS_ZERO_C = -273.15;
  const MAX_ABS_C = 1e12;          // instrument range: |value| capped in Celsius
  const MAX_INPUT_CHARS = 16;      // hard cap on raw input length
  const EPS = 1e-9;                // tolerance for float boundaries (491.67 path)

  const NUMERIC_RE = /^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/;

  function toC(value, from) {
    switch (from) {
      case 'C': return value;
      case 'F': return (value - 32) * 5 / 9;
      case 'K': return value - 273.15;
      case 'R': return (value - 491.67) * 5 / 9;
      default: throw new TypeError('unknown unit');
    }
  }

  function fromC(c, to) {
    switch (to) {
      case 'C': return c;
      case 'F': return c * 1.8 + 32;
      case 'K': return c + 273.15;
      case 'R': return (c + 273.15) * 1.8;
      default: throw new TypeError('unknown unit');
    }
  }

  function convert(value, from, to) {
    if (from === to) return value;
    /* direct paths — exact where the math is exact, no Celsius chaining:
       K and R both start at absolute zero, F and R differ by a pure offset. */
    if (from === 'K' && to === 'R') return value * 1.8;
    if (from === 'R' && to === 'K') return value / 1.8;
    if (from === 'F' && to === 'R') return value + 459.67;
    if (from === 'R' && to === 'F') return value - 459.67;
    return fromC(toC(value, from), to);
  }

  /*
   * Parse raw input. Comma is treated as a decimal separator (36,6 -> 36.6).
   * Returns {ok: true, value} | {ok: true, empty: true} | {ok: false, reason}.
   * Reasons: 'format' (junk), 'magnitude' (+/-Infinity, e.g. 1e999).
   */
  function parseInput(raw, maxChars) {
    const cap = typeof maxChars === 'number' ? maxChars : MAX_INPUT_CHARS;
    if (typeof raw !== 'string') return { ok: false, reason: 'format' };
    let s = raw.trim().slice(0, cap);
    if (!s) return { ok: true, empty: true };
    s = s.replace(/,/g, '.');
    if (!NUMERIC_RE.test(s)) return { ok: false, reason: 'format' };
    const num = Number(s);
    if (Number.isNaN(num)) return { ok: false, reason: 'format' };
    if (!Number.isFinite(num)) return { ok: false, reason: 'magnitude' };
    return { ok: true, value: Object.is(num, -0) ? 0 : num };
  }

  /*
   * Range validation in the source unit. Returns {ok, c} or
   * {ok: false, reason: 'absolute'|'range', min?: {value, unit}}.
   */
  function validate(value, from) {
    if (typeof from !== 'string' || SCALES.indexOf(from) === -1) {
      throw new TypeError('unknown unit');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, reason: 'range' };
    }
    const c = toC(value, from);
    if (c < ABS_ZERO_C - EPS) {
      return { ok: false, reason: 'absolute', min: { value: ABS_ZERO_C, unit: 'C' } };
    }
    if (Math.abs(c) > MAX_ABS_C) {
      return { ok: false, reason: 'range' };
    }
    return { ok: true, c };
  }

  /*
   * Fixed-precision display. Corrects toFixed()'s "-0.00" artifact.
   */
  function fmt(value, precision) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    const p = Math.min(4, Math.max(0, Math.floor(precision) || 0));
    const out = value.toFixed(p);
    if (/^-0(\.0+)?$/.test(out)) return out.replace(/^-/, '');
    return out;
  }

  /* ── feels-like physics (pure results, n/a outside official windows) ── */

  const CHILL_MAX_C = 10;        // NWS: wind chill defined at T <= 10 °C (50 °F)
  const CHILL_MIN_WIND = 4.8;    // NWS: ... and wind >= 4.8 km/h (3 mph)
  const HEAT_MIN_C = 27;         // NWS: heat index defined at T >= 27 °C (80 °F)
  const HEAT_MIN_RH = 40;        // NWS: ... and RH >= 40%
  const WIND_MAX_KMH = 500;      // instrument guard rail
  const MPH_TO_KMH = 1.609344;

  /*
   * NWS / Environment Canada wind chill. Returns °C.
   * {ok:true, value} | {ok:false, reason: 'cold'|'wind'|'range'}
   */
  function windChill(tempC, windKmh) {
    if (typeof tempC !== 'number' || !Number.isFinite(tempC)) return { ok: false, reason: 'range' };
    if (tempC > CHILL_MAX_C) return { ok: false, reason: 'cold' };
    if (typeof windKmh !== 'number' || !Number.isFinite(windKmh) ||
        windKmh < 0 || windKmh > WIND_MAX_KMH) return { ok: false, reason: 'range' };
    if (windKmh < CHILL_MIN_WIND) return { ok: false, reason: 'wind' };
    const v = Math.pow(windKmh, 0.16);
    const wc = 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
    return { ok: true, value: wc };
  }

  /*
   * NWS Rothfusz regression with standard adjustments. Returns °C.
   * {ok:true, value} | {ok:false, reason: 'heat'|'rh'|'range'}
   */
  function heatIndex(tempC, rhPct) {
    if (typeof tempC !== 'number' || !Number.isFinite(tempC)) return { ok: false, reason: 'range' };
    if (tempC < HEAT_MIN_C) return { ok: false, reason: 'heat' };
    if (typeof rhPct !== 'number' || !Number.isFinite(rhPct) ||
        rhPct < 0 || rhPct > 100) return { ok: false, reason: 'range' };
    if (rhPct < HEAT_MIN_RH) return { ok: false, reason: 'rh' };
    const tf = tempC * 1.8 + 32;
    const simple = 0.5 * (tf + 61.0 + (tf - 68.0) * 1.2 + rhPct * 0.094);
    let hi;
    if ((simple + tf) / 2 < 80) {
      hi = simple;                                   // simple stab below the 80 °F midpoint
    } else {
      hi = -42.379 + 2.04901523 * tf + 10.14333127 * rhPct
         - 0.22475541 * tf * rhPct - 0.00683783 * tf * tf
         - 0.05481717 * rhPct * rhPct + 0.00122874 * tf * tf * rhPct
         + 0.00085282 * tf * rhPct * rhPct
         - 0.000001990846 * tf * tf * rhPct * rhPct;
      if (rhPct < 13 && tf >= 80 && tf <= 112) {
        hi -= ((13 - rhPct) / 4) * Math.sqrt((17 - Math.abs(tf - 95)) / 17);
      }
      if (rhPct > 85 && tf >= 80 && tf <= 87) {
        hi += ((rhPct - 85) / 10) * ((87 - tf) / 5);
      }
    }
    return { ok: true, value: (hi - 32) / 1.8 };
  }

  /*
   * Dispatcher. tempC is always known; wind/rh are optional (null = not given).
   * {ok:true, value, mode:'chill'|'heat'} | {ok:false, reason}:
   *   'wind'   cold supplied without usable wind (too light / absent)
   *   'heat'   heat supplied without humidity
   *   'rh'     humidity too low for the regression
   *   ' cold'/'range' forwarded from the model functions
   *   'window' temp in (10, 27) — neither model is defined there
   */
  function feelsLike(tempC, opts) {
    const o = opts || {};
    const wind = (typeof o.windKmh === 'number') ? o.windKmh : null;
    const rh = (typeof o.rhPct === 'number') ? o.rhPct : null;
    if (tempC <= CHILL_MAX_C) {
      if (wind !== null) {
        const r = windChill(tempC, wind);
        return r.ok ? { ok: true, value: r.value, mode: 'chill' } : { ok: false, reason: r.reason };
      }
      return { ok: false, reason: rh !== null ? 'wind' : 'cold' };
    }
    if (tempC >= HEAT_MIN_C) {
      if (rh !== null) {
        const r = heatIndex(tempC, rh);
        return r.ok ? { ok: true, value: r.value, mode: 'heat' } : { ok: false, reason: r.reason };
      }
      return { ok: false, reason: 'heat' };
    }
    return { ok: false, reason: 'window' };
  }

  const api = { SCALES, ABS_ZERO_C, MAX_ABS_C, MAX_INPUT_CHARS, toC, fromC, convert, parseInput, validate, fmt, windChill, heatIndex, feelsLike };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                  // Node / tests
  }
  root.TempCore = api;                     // browser
})(typeof window !== 'undefined' ? window : globalThis);
