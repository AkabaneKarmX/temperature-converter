# SECURITY.md — TEMP·CONV

Static, single-origin, dependency-free. There is no backend, no analytics and
no build pipeline; every file ships as-is.

## Reporting

Open a GitHub issue on this repository, or use GitHub's
[private vulnerability reporting](https://github.com/AkabaneKarmX/temperature-converter/security/advisories)
if the finding is sensitive. Please include a reproduction and the
browser/platform where it was observed.

## Content Security Policy

The app ships a strict meta CSP:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self';
font-src 'self'; manifest-src 'self'; connect-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'
```

Enforced by construction as well: no inline handlers, no inline or injected
styles, no `innerHTML`, no `eval`/`new Function`, no dynamic `import()`.

### What a meta CSP tag cannot set

Per the CSP3 spec, a `<meta>` policy cannot configure:

- `frame-ancestors` (clickjacking control) — ignored by the frame *parent*,
  which is governed by HTTP headers on the host, not the framed page.
- `report-uri` / `report-to` — violations can only be surfaced via headers.
- `sandbox`, `require-trusted-types-for` — header-only directives.

### How to close the gap on your host

The meta policy above blocks script injection but cannot stop someone from
framing the page (no real value to steal here, but the control is missing).
Set these **HTTP response headers** at the hosting layer:

| Host | Method |
| --- | --- |
| GitHub Pages | **Cannot set custom headers.** Mitigate with `frame-src-ancestors`-equivalent by hosting elsewhere for full hardening, or accept the meta-only policy (reasonable for a public toy). |
| Netlify / Cloudflare Pages / Vercel | `_headers` file in the deploy root (all three support it verbatim; the file lives next to `index.html`) |

`_headers` example (drop next to `index.html` on a header-capable host):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

(`X-Frame-Options` is belt-and-braces for older UAs; `frame-ancestors 'none'`
is the modern control. `report-uri` goes here too if you have a reporting
endpoint.)

## Input handling

All input is untrusted:

- length-capped at the DOM (`maxlength="16"`) and again in JS (`slice`)
- whitelisted by a strict numeric regex before ever being handed to `Number()`
- `Infinity` inputs (`1e999`) rejected as out-of-range, not rendered
- absolute-zero floor enforced on the Celsius axis (±1e-9 float tolerance)
- output written exclusively with `textContent` (no `innerHTML` anywhere)

Storage reads (`localStorage`) are wrapped in try/catch, JSON-parsed and
run through whitelisting validators; malformed or overlong values are
treated as absent. Nothing executable is ever read out of storage.

DOM clobbering is neutralized structurally: every element `id` contains a
hyphen (a valid hyphenated id cannot become a global), no `name` attributes
are used, and the app depends only on properties it fetched by explicit id.

## Third-party assets

None. The single font (JetBrains Mono, OFL) is vendored into
`assets/fonts/`. There is nothing to pin with SRI because nothing is
fetched cross-origin, and the service worker never touches opaque or
cross-origin responses.

## Dependencies / secrets

Zero dependencies; no lockfile to audit. No keys or tokens in the repo —
check by running `git grep -E "(api[_-]?key|[A-Za-z0-9_]{32,} =)"` under CI
if that matters to you, or a secret scanner of choice.
