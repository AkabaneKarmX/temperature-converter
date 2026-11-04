# Changelog

All notable changes to TEMP·CONV are documented here.
Numbers are service-worker cache versions — they are what visitors should see once the site is published.

## [3.2.0] — 2026-11-04 — feels-like release

### Added
- **Feels-like model in the core** (`Scripts/convert.js`): `windChill()` (NWS/EC formula, valid ≤ 10 °C with wind ≥ 4.8 km/h / 3 mph), `heatIndex()` (NWS Rothfusz regression with the < 13 % and > 85 % corrections, valid ≥ 27 °C at ≥ 40 % humidity), and a `feelsLike()` dispatcher that answers with the felt value or a plain reason (`wind` / `cold` / `heat` / `rh` / `range` / `window`) — no invented numbers outside proven windows.
- **Feels-like panel in the UI** (`index.html` + `Scripts/app.js` + `Stylesheets/app.css`): collapsible `[ FEELS LIKE ]` row under the feel band, with wind and humidity inputs, a KM/H ↔ MPH unit toggle (persisted), a live status line for n/a explanations, and `aria`-live announcements. An active model takes over the hero readout and its thermal colour; the visible text and hit targets (44 px) follow the instrument conventions.
- **Direct-conversion paths for exactness** (theme: fixable limitations): K↔°R now convert directly (×1.8 / ÷1.8) and °F↔°R offset in one step (+459.67 / −459.67) instead of chaining through °C/K — removing rounding artifacts on absolute-scale pairs.
- **Cache-drift guard** (`tools/check-cache.js` + `tools/pre-commit`): dependency-free pre-commit hook that fingerprints all 11 precached assets from the git index and refuses commits that change them without a `CACHE` bump in `sw.js` (also remembers bypasses from `--no-verify` commits). State of the last guard-clean commit lives in `.cache-manifest.json`.
- **Docs**: README sections for the guard and the feels-like feature; refreshed screenshots incl. the expanded panel; SECURITY.md covers the `_headers`/host-quirks table.

### Changed
- Tests grew from 15 to 28: NWS reference pins, validity-window regressions, noise-sweep assertion, direct-path pins (300 K = 540.00 °R, 32 °F = 491.67 °R).
- `.fl-val` sized up to 1.25rem so the felt value meets the large-text AA bar in the darkest phosphor.

### Verification (release tree)
- 28 / 28 tests pass · `node tools/check-cache.js` no drift at `tempconv-v3.2.0` · Lighthouse 100 / 100 / 100 / 100 (performance, accessibility, best practices, SEO) · offline reload serves from cache · keyboard panel toggle (Enter on summary) + persisted state · no overflow at 360 / 768 / 1024 px · app runtime greps clean (no `innerHTML`, `eval`, inline handlers).

[3.2.0]: https://github.com/AkabaneKarmX/temperature-converter
