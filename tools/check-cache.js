#!/usr/bin/env node
/*
 * Cache-drift guard — dependency-free.
 * Fails when a precached asset changed but CACHE in sw.js was not bumped,
 * so returning visitors can never be served stale files.
 *
 * State lives in .cache-manifest.json (committed):
 *   { cache: <last accepted CACHE>, fingerprint: <sha256 of asset set> }
 *
 * Allows:
 *   - first run (no manifest): initializes it
 *   - CACHE bumped in the same commit as the asset change
 *   - CACHE renamed with no asset change (harmless refresh)
 * Fails:
 *   - assets changed while CACHE stayed the same
 */
'use strict';

const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const STATE = path.join(ROOT, '.cache-manifest.json');
const IN_REPO = fs.existsSync(path.join(ROOT, '.git'));

function fail(msg) {
  console.error('CHECK-CACHE FAIL: ' + msg);
  process.exit(1);
}

/* Prefer the staged blob (stable across EOL-rewriting checkouts, and it is
   exactly what this commit holds); fall back to the file on disk. */
function assetBytes(rel) {
  if (IN_REPO) {
    try {
      return execFileSync('git', ['show', ':' + rel], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) { /* untracked or freshly added — fall back below */ }
  }
  return fs.readFileSync(path.join(ROOT, rel));
}

const swSrc = (() => {
  try { return fs.readFileSync(SW, 'utf8'); }
  catch (e) { fail('sw.js unreadable: ' + e.message); return ''; }
})();

const cache = ((swSrc.match(/const CACHE = '([^']+)'/)) || [])[1];
if (!cache) fail("CACHE name missing in sw.js (expected: const CACHE = 'tempconv-...')");

const assets = [];
const re = /'\.\/([^']+)'/g;
let m;
while ((m = re.exec(swSrc)) !== null) assets.push(m[1].replace(/^\.\//, ''));
if (!assets.length) fail('ASSETS list not found in sw.js');

const hash = createHash('sha256');
for (const rel of assets) {
  let buf;
  try { buf = assetBytes(rel); }
  catch (e) { fail('precached asset unreadable: ' + rel + ' — add it to the repo or drop it from ASSETS'); }
  hash.update(rel);
  hash.update(buf);
}
const fingerprint = hash.digest('hex');

let state = null;
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { /* first run */ }

function accept(msg) {
  fs.writeFileSync(
    STATE,
    JSON.stringify({ cache: cache, fingerprint: fingerprint, updated: new Date().toISOString() }, null, 2) + '\n'
  );
  console.log('CHECK-CACHE ok: ' + msg + ' (' + assets.length + ' asset(s), ' + cache + ')');
  process.exit(0);
}

if (!state || !state.cache || !state.fingerprint) {
  accept('manifest initialized');
}
if (state.cache !== cache) {
  accept('CACHE bump accepted -> ' + cache);
}
if (state.fingerprint !== fingerprint) {
  fail('precached assets changed but CACHE is still ' + cache + ' — bump CACHE in sw.js and recommit');
}
console.log('CHECK-CACHE ok: no drift (' + assets.length + ' asset(s), ' + cache + ')');
