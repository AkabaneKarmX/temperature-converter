# TEMP·CONV

Temperature instrument — converts between **Celsius, Fahrenheit, Kelvin and Rankine**, reads the scale back as what it physically *feels like*, and works fully offline. Unit 02 of the [Tactical Telemetry](https://github.com/AkabaneKarmX) instrument set.

![Phone view: 36.6 °C read as 97.88 °F in warm phosphor](assets/screens/phone-hero.png)

## Features

- **Four units, always live** — every keystroke converts to all three other scales at once; the target readout is the big hero, the other units are single-tap copy rows
- **Thermal colour readout** — the hero value shifts hue with the temperature: steel blue at −40 °C, neutral at room temperature, brick/alarm red from body heat to boiling
- **Feel band** — plain-language verdict under the readout ("FREEZING — ice season, pipes at risk", "HOT — shade and water")
- **Presets** — FREEZING / BODY / BOIL / ABS.ZERO, one tap each
- **Precision control** — 0 to 4 decimal places, noise-free display (0.1 + 0.2 never shows up as 0.30000000000000004)
- **Absolute-zero guard** — nothing below −273.15 °C parses as valid, in any input scale, float-edge included
- **Sign flip** — ± button negates the current value
- **Nudge from the keyboard** — ↑/↓ steps by 1 (Shift: 10, Alt: 0.1), Esc clears
- **Recent log** — last 5 conversions, capped, clearable
- **Shareable state** — the URL always carries the current conversion (`?v=36.6&from=C&to=F`), copy it to share
- **Offline PWA** — service worker, same-origin-only, installs to the home screen
- **Two themes** — dark phosphor console (default on dark OS) and light lab paper, auto or manual

![Phone view: −40 °C in cold steel blue](assets/screens/phone-cold.png)

![Desktop: two-column instrument layout](assets/screens/desktop-light.png)

## Privacy

No telemetry, no analytics, no network calls, no third-party requests. All state lives in `localStorage` on your device. See [SECURITY.md](SECURITY.md) for the full hardening notes (strict content-security policy, same-origin assets only, validated storage).

## How to run

Static site — no build step, no dependencies.

```bash
# serve over http (recommended so the offline service worker registers)
python -m http.server 8137
# then open http://127.0.0.1:8137/
```

Opening `index.html` directly from disk also works; only the offline install is skipped.

## Deploy (GitHub Pages)

1. Push this branch and merge, or serve `main`.
2. Settings → Pages → deploy from branch `main` → `/ (root)`.
3. After every future change, remember to bump `CACHE` in `sw.js` so returning visitors get fresh files.

## Tests

```bash
node --test tests/convert.test.js
```

Covers the conversion core: all 16 unit pairs, the −40 °C = −40 °F identity, absolute-zero clamp in every scale, float-boundary at the floor, comma-as-decimal parsing, magnitude and length caps, precision formatting and `-0` cleanup (15 tests).

## Project structure

```
index.html            instrument markup (strict CSP, no inline code)
Scripts/convert.js    pure conversion core (no DOM)
Scripts/app.js        UI wiring, URL/history state, offline registration
Stylesheets/app.css   design tokens (dark/light), layout, motion
tests/convert.test.js node:test suite for the core
sw.js                 versioned cache-first service worker
manifest.webmanifest  install metadata + icons
assets/               self-hosted JetBrains Mono, icons, screenshots
```
