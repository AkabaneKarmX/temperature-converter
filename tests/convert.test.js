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
