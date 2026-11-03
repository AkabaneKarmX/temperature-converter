const { test } = require('node:test');
const assert = require('node:assert/strict');

const core = require('../Scripts/convert.js');

const EPS = 1e-9;

test('toC/fromC cross-unit sanity (-40, boiling, body)', () => {
  assert.ok(Math.abs(core.toC(-40, 'F') - (-40)) < EPS);
  assert.ok(Math.abs(core.fromC(100, 'F') - 212) < EPS);
  assert.ok(Math.abs(core.fromC(0, 'K') - 273.15) < EPS);
  assert.ok(Math.abs(core.toC(0, 'K') - (-273.15)) < EPS);
});

test('Rankine boundaries', () => {
  assert.ok(Math.abs(core.fromC(-40, 'R') - 419.67) < 1e-6);
  assert.ok(Math.abs(core.toC(0, 'R') - (-273.15)) < 1e-6);
  assert.ok(Math.abs(core.fromC(-273.15, 'R') - 0) < EPS, `got ${core.fromC(-273.15, 'R')}`);
  assert.ok(Math.abs(core.toC(671.67, 'R') - 100) < 1e-6);
});

test('all 16 pairs convert and roundtrip back within 1e-9', () => {
  const scales = ['C', 'F', 'K', 'R'];
  for (const a of scales) for (const b of scales) {
    const v = 37.5;
    assert.equal(core.convert(v, a, a), v);
    const back = core.toC(core.fromC(v, b), b);
    assert.ok(Math.abs(back - v) < 1e-9, `${b} roundtrip ${back}`);
    assert.ok(Number.isFinite(core.convert(v, a, b)));
  }
});

test('absolute zero is representable in all units', () => {
  assert.ok(Math.abs(core.toC(-273.15, 'C') + 273.15) < EPS);
  assert.ok(Math.abs(core.toC(0, 'K') + 273.15) < EPS);
  assert.ok(Math.abs(core.toC(0, 'R') + 273.15) < 1e-6);
  const f = core.toC(-459.67, 'F');
  assert.ok(Math.abs(f + 273.15) < 1e-6, `got ${f}`);
});

test('validate rejects below absolute zero', () => {
  for (const u of core.SCALES) {
    const below = core.fromC(-273.1600001, u);
    const r = core.validate(below, u);
    assert.equal(r.ok, false, `${below} ${u}`);
    assert.equal(r.reason, 'absolute');
  }
});

test('validate accepts exact absolute zero (float boundary)', () => {
  for (const u of core.SCALES) {
    const r = core.validate(core.fromC(-273.15, u), u);
    assert.equal(r.ok, true, `${u}: ${JSON.stringify(r)} v=${core.fromC(-273.15, u)}`);
  }
});

test('fmt kills float noise (0.1+0.2 class bugs)', () => {
  const f = core.convert(36.6, 'C', 'F'); // 97.87999999999999
  assert.equal(core.fmt(f, 2), '97.88');
  assert.equal(core.fmt(0.1 + 0.2, 1), '0.3');
});

test('fmt rounds negative zero away', () => {
  assert.equal(core.fmt(-0.0004, 2), '0.00');
  assert.equal(core.fmt(-0.0004, 0), '0');
  assert.equal(core.fmt(0, 0), '0');
});

test('fmt precision 0..4', () => {
  assert.equal(core.fmt(98.123456, 0), '98');
  assert.equal(core.fmt(98.123456, 3), '98.123');
});

test('parseInput: accepted forms', () => {
  assert.deepEqual(core.parseInput('36,6'), { ok: true, value: 36.6 });
  assert.deepEqual(core.parseInput('-40'), { ok: true, value: -40 });
  assert.deepEqual(core.parseInput(' 1.5 '), { ok: true, value: 1.5 });
  assert.deepEqual(core.parseInput('+21.0'), { ok: true, value: 21 });
  assert.deepEqual(core.parseInput('-.5'), { ok: true, value: -0.5 });
});

test('parseInput: empty and whitespace', () => {
  assert.equal(core.parseInput('').empty, true);
  assert.equal(core.parseInput('   ').empty, true);
});

test('parseInput: junk is rejected', () => {
  assert.equal(core.parseInput('abc').ok, false);
  assert.equal(core.parseInput('abc').reason, 'format');
  assert.equal(core.parseInput('1.2.3').reason, 'format');
});

test('parseInput: 1e999 overflows but Number parses it — rejected as magnitude', () => {
  const r = core.parseInput('1e999');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'magnitude');
  assert.equal(core.parseInput('-1e999').reason, 'magnitude');
});

test('parseInput: long input is capped', () => {
  const long = '1.23456789012345678901234567890';
  const r = core.parseInput(long);
  assert.ok(!r.ok || r.value === Number(long.slice(0, 16)));
});

test('validate: huge-but-finite input is range-checked', () => {
  const r = core.validate(1e13, 'C');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'range');
  assert.equal(core.validate(1e6, 'C').ok, true);
});

// ── feels-like model ──────────────────────────────────────────

test('windChill: NWS reference — 0 °F with 15 mph wind ≈ -19.4 °F', () => {
  // 0 °F = -17.7778 °C; 15 mph = 24.1402 km/h
  const wc = core.windChill(-17.7778, 24.1402);
  assert.equal(wc.ok, true);
  const f = core.fromC(wc.value, 'F');
  assert.ok(Math.abs(f - (-19.45)) < 0.6, `expected about -19 °F, got ${f}`);
});

test('windChill: colder wind means colder feel (monotonic)', () => {
  const a = core.windChill(-10, 10);
  const b = core.windChill(-10, 40);
  assert.equal(a.ok && b.ok, true);
  assert.ok(b.value < a.value, `breeze ${a.value} vs gale ${b.value}`);
});

test('windChill: validity window enforced', () => {
  assert.equal(core.windChill(10, 4.8).ok, true);
  assert.equal(core.windChill(10.01, 10).reason, 'cold');
  assert.equal(core.windChill(5, 4.7).reason, 'wind');
  assert.equal(core.windChill(5, 0).reason, 'wind');
  assert.equal(core.windChill(5, 501).reason, 'range');
  assert.equal(core.windChill(NaN, 20).reason, 'range');
});

test('heatIndex: NWS reference — 90 °F at 70% RH ≈ 106 °F', () => {
  // 90 °F = 32.2222 °C
  const hi = core.heatIndex(32.2222, 70);
  assert.equal(hi.ok, true);
  const f = core.fromC(hi.value, 'F');
  assert.ok(Math.abs(f - 106.2) < 0.6, `expected about 106 °F, got ${f}`);
});

test('heatIndex: engages full regression at the 27 °C validity gate', () => {
  // 27 °C = 80.6 °F, 40% RH — full Rothfusz path, result ≈ 80.3 °F
  const hi = core.heatIndex(27, 40);
  assert.equal(hi.ok, true);
  const f = core.fromC(hi.value, 'F');
  assert.ok(f > 79 && f < 82, `expected near 80 °F, got ${f}`);
});

test('heatIndex: NWS humid adjustment (RH > 85) within the 80–87 °F band', () => {
  // 86 °F, 90% RH — inside the regression's humid correction band
  const hi = core.heatIndex(30, 90);
  assert.equal(hi.ok, true);
  const f = core.fromC(hi.value, 'F');
  assert.ok(f > 102 && f < 115, `got ${f} °F`);
});

test('heatIndex: validity window enforced', () => {
  assert.equal(core.heatIndex(27, 40).ok, true);
  assert.equal(core.heatIndex(26.99, 60).reason, 'heat');
  assert.equal(core.heatIndex(35, 39.9).reason, 'rh');
  assert.equal(core.heatIndex(35, 100.1).reason, 'range');
  assert.equal(core.heatIndex(35, -1).reason, 'range');
  assert.equal(core.heatIndex(NaN, 60).reason, 'range');
});

test('feelsLike: dispatch picks wind chill in cold, heat index in heat', () => {
  const cold = core.feelsLike(-10, { windKmh: 20, rhPct: null });
  assert.equal(cold.ok, true);
  assert.equal(cold.mode, 'chill');
  const heat = core.feelsLike(35, { windKmh: null, rhPct: 60 });
  assert.equal(heat.ok, true);
  assert.equal(heat.mode, 'heat');
  const both = core.feelsLike(35, { windKmh: 15, rhPct: 60 });
  assert.equal(both.ok, true);
  assert.equal(both.mode, 'heat');
});

test('feelsLike: clear n/a reasons outside the model windows', () => {
  assert.equal(core.feelsLike(20, { windKmh: null, rhPct: null }).reason, 'window');
  assert.equal(core.feelsLike(-5, { windKmh: null, rhPct: null }).reason, 'cold');
  assert.equal(core.feelsLike(35, { windKmh: null, rhPct: null }).reason, 'heat');
  assert.equal(core.feelsLike(-5, { windKmh: 2, rhPct: null }).reason, 'wind');
  assert.equal(core.feelsLike(-5, { windKmh: 20, rhPct: null }).mode, 'chill');
  assert.equal(core.feelsLike(20, { windKmh: 20, rhPct: null }).reason, 'window');
  assert.equal(core.feelsLike(35, { windKmh: null, rhPct: 39.9 }).reason, 'rh');
});

test('feelsLike values are noiseless when formatted', () => {
  const wc = core.windChill(-17.7778, 24.1402);
  assert.ok(/^-?\d+(\.\d{1,4})?$/.test(core.fmt(wc.value, 2)), core.fmt(wc.value, 2));
  const hi = core.heatIndex(32.2222, 70);
  assert.ok(/^-?\d+(\.\d{1,4})?$/.test(core.fmt(hi.value, 2)), core.fmt(hi.value, 2));
});

// ── direct unit paths (limitation 2 — no chained Celsius float noise) ──

test('K↔R is direct delta-scaling: 300 K = 540 °R exactly', () => {
  assert.equal(core.fmt(core.convert(300, 'K', 'R'), 2), '540.00');
  assert.equal(core.fmt(core.convert(540, 'R', 'K'), 2), '300.00');
});

test('F↔R is a pure offset: 32 °F = 491.67 °R exactly', () => {
  assert.equal(core.fmt(core.convert(32, 'F', 'R'), 2), '491.67');
  assert.equal(core.fmt(core.convert(491.67, 'R', 'F'), 2), '32.00');
});

test('no float noise in fmt output across all 16 pairs', () => {
  const scales = ['C', 'F', 'K', 'R'];
  const values = [0, 1, -40, 37, 100, 212, 36.6, 273.15, 300, 32, 491.67, 540, -273.15, 459.67];
  for (const a of scales) for (const b of scales) for (const v of values) {
    const out = core.fmt(core.convert(v, a, b), 2);
    assert.ok(/^-?\d{1,15}(\.\d{1,2})?$/.test(out), `${v} ${a}->${b} gave "${out}"`);
  }
});
