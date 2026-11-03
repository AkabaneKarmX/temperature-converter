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

  const api = { SCALES, ABS_ZERO_C, MAX_ABS_C, MAX_INPUT_CHARS, toC, fromC, convert, parseInput, validate, fmt };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                  // Node / tests
  }
  root.TempCore = api;                     // browser
})(typeof window !== 'undefined' ? window : globalThis);
