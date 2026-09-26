# AdsOnBread SDK

The ad SDK for browser extensions on the [AdsOnBread](https://adsonbread.com) network. Vanilla JS and React, no build step, no runtime dependencies.

Get your extension API key from your [developer dashboard](https://adsonbread.com/developer/extensions).

## Formats

AdsOnBread has two display formats:

- `banner`: short horizontal unit, min 300px and max 500px wide, at least 64px tall.
- `card`: vertical unit, fixed 180px wide.

Both formats support `light` and `dark` themes. The SDK defaults to `light`. Each format must be enabled in the Placement controls on your extension's SDK setup page.

## Install

### Vanilla JS

Manifest V3 extension pages must load JavaScript from the packaged extension, not from a remote CDN. Vendor the files into your repo, pinned to a release tag so your build is reproducible:

```sh
mkdir -p src/vendor
curl -L -o src/vendor/adsonbread-sdk.js \
  https://raw.githubusercontent.com/AdsOnBread/AdsOnBread-SDK/v1.2.0/sdk.js
curl -L -o src/vendor/adsonbread-test-sdk.js \
  https://raw.githubusercontent.com/AdsOnBread/AdsOnBread-SDK/v1.2.0/test-sdk.js
```

To update, bump the tag in the URL and re-run it. Tag refs are immutable, so a given tag always serves the same bytes.

Prefer clicking? Every version is on the [releases page](https://github.com/AdsOnBread/AdsOnBread-SDK/releases/latest) as `adsonbread-sdk.js` and `adsonbread-test-sdk.js`.

### React

```sh
npm install @adsonbread/react
```

Every release here is published straight to npm, so `npm update @adsonbread/react` picks up new 1.x versions as they ship. Your bundler packages the component into your extension build, so nothing loads from a remote CDN at runtime.

<details>
<summary>Installing from git instead (optional)</summary>

You can install from this repo directly if you would rather track a tag:

```sh
npm install github:AdsOnBread/AdsOnBread-SDK#semver:^1.2.0 --allow-git=all
```

Two caveats, which is why the registry install above is the recommended path:

- **npm 12 blocks git dependencies by default** (`allow-git` defaults to `none`). You need `--allow-git=all` on the command line or `allow-git=all` in your `.npmrc`.
- npm's canonical `resolved` URL for hosted specs is `git+ssh://`, which fails on CI runners with no SSH key. Use the explicit HTTPS form there:

```sh
npm install "git+https://github.com/AdsOnBread/AdsOnBread-SDK.git#semver:^1.2.0" --allow-git=all
```

The `#semver:` range means `npm update` re-resolves against new tags, while your lockfile pins the exact commit until you ask for a newer one.

</details>

## Test SDK

Use the test SDK while building your extension UI. It draws a visible mock ad with the exact dimensions and light/dark styling of a live ad. It does not call the ad delivery API, count impressions, or send clicks.

```html
<div id="ad-slot"></div>
<script src="./vendor/adsonbread-test-sdk.js"></script>
<script>
  AdsOnBreadTest.load('YOUR_EXTENSION_API_KEY', 'banner', document.getElementById('ad-slot'))
</script>
```

Card example:

```html
<div id="ad-card"></div>
<script src="./vendor/adsonbread-test-sdk.js"></script>
<script>
  AdsOnBreadTest.load('YOUR_EXTENSION_API_KEY', 'card', '#ad-card', { theme: 'dark' })
</script>
```

## Production SDK

```html
<div id="ad-slot"></div>
<script src="./vendor/adsonbread-sdk.js"></script>
<script>
  AdsOnBread.load('YOUR_EXTENSION_API_KEY', 'banner', document.getElementById('ad-slot'), {
    theme: 'light',
    language: chrome.i18n.getUILanguage()
  })
</script>
```

Card:

```html
<div id="ad-card"></div>
<script src="./vendor/adsonbread-sdk.js"></script>
<script>
  AdsOnBread.load('YOUR_EXTENSION_API_KEY', 'card', document.getElementById('ad-card'), {
    theme: 'dark'
  })
</script>
```

The production SDK calls `https://edge.adsonbread.com/ad`, renders a live campaign when one is available, and returns the ad object from `AdsOnBread.load(...)` (or `null` when no ad is available).

Version 1.2.0 confirms an impression only after more than 70% of the rendered ad surface remains visible in the active view for at least one continuous second. Ads that never meet this threshold do not count toward advertiser billing or developer earnings. Keep the SDK's visibility measurement intact. Add `https://edge.adsonbread.com` to your extension's `connect-src` CSP so both `/ad` and `/view` can be reached. All live extensions must use 1.2.0 or later by October 22, 2026 at 11:59 p.m. Mountain Daylight Time; older SDKs stop receiving ads at midnight on October 23.

A runnable example extension is in [`examples/vanilla-extension`](examples/vanilla-extension).

## React SDK

```jsx
import { AdsOnBreadSlot } from '@adsonbread/react'

export function Popup() {
  return (
    <AdsOnBreadSlot
      apiKey="YOUR_EXTENSION_API_KEY"
      placement="card"
      theme="dark"
      language={chrome.i18n.getUILanguage()}
      fallback={null}
    />
  )
}
```

For React layout QA without creating impressions, pass the `test` prop:

```jsx
import { AdsOnBreadSlot } from '@adsonbread/react'

export function MockAdSlot() {
  return <AdsOnBreadSlot apiKey="YOUR_EXTENSION_API_KEY" placement="banner" test />
}
```

See [`examples/react-extension`](examples/react-extension).

## Frequency capping and the short-lived token

The SDK generates a random pseudonymous token and stores `{ id, expiresAt }` under the `adsonbread_uid` key in `chrome.storage.local`, falling back to `localStorage`. The SDK never sends the token after its 24-hour expiration and replaces it before the next ad request. Browser storage has no automatic TTL, so if the extension does not run again, an expired record can remain until the next SDK use, storage clearing, or uninstall. If neither storage API is available, the token lasts only in memory for the current page. SDK 1.1.0 replaces the permanent bare string written by SDK 1.0.0 on first use.

The token is sent with each ad request so AdsOnBread can frequency-cap delivery: repeat requests within a minute return the same ad, and impressions beyond the eight-hour per-token cap stop counting toward billing. AdsOnBread converts the submitted token to a keyed HMAC before storage and scrubs that value after 24 hours. It is not used for behavioral advertising or cross-site profiling. If your manifest does not include the `storage` permission, the SDK automatically uses `localStorage` instead.

### Required publisher disclosure

Include equivalent language in your extension privacy policy and Chrome/Edge store privacy fields:

> This extension uses AdsOnBread to display contextual ads. The SDK stores a random pseudonymous token and a 24-hour expiration time in local extension storage and transmits the unexpired token, browser language, impressions, and clicks to AdsOnBread for frequency capping, billing accuracy, and fraud prevention. An expired storage record is replaced the next time the SDK runs and can also be removed by clearing extension storage or uninstalling. AdsOnBread also derives coarse country from the network request. This information is not used for behavioral advertising or cross-site profiling.

See the [AdsOnBread privacy policy](https://adsonbread.com/privacy) for the server-side retention schedule.

## Chrome extension CSP

The SDK is vendored or bundled, so scripts only need `'self'`. Live ad requests need the edge API:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; connect-src https://edge.adsonbread.com"
  }
}
```

## Supported languages

Pass any [Chrome i18n locale code](https://developer.chrome.com/docs/extensions/reference/api/i18n) — regional codes are normalized before matching, so `en-US` becomes `en`, `pt_BR` becomes `pt`, `zh_CN` becomes `zh-hans`, and `zh_TW`, `zh_HK`, and `zh_MO` become `zh-hant`.

`en`, `es`, `fr`, `de`, `pt`, `it`, `ja`, `hi`, `zh-hans`, `zh-hant`. When no creative exists for the requested language, an English creative is served instead.

## API

### `AdsOnBread.load(apiKey, placement, container, options)`

Requests one ad and renders it into `container`, replacing its contents. Returns `Promise<Ad | null>`.

| Parameter | Type | Description |
| --- | --- | --- |
| `apiKey` | `string` | Required. Your extension API key. |
| `placement` | `'banner' \| 'card'` | Required. Ad format. |
| `container` | `Element` | Required. The element the ad renders into. |
| `options.theme` | `'light' \| 'dark'` | Defaults to `'light'`. |
| `options.language` | `string` | Chrome i18n locale code. Omit or pass `'auto'` to detect the browser language. |

`AdsOnBread.version` reports the vendored SDK version.

### `AdsOnBreadTest.load(apiKey, placement, container, options)`

From the separate test SDK file. Same parameters, plus `container` may be a CSS selector string. Renders a theme-accurate mock ad locally — no network request, no impressions. Clean up with `AdsOnBreadTest.destroy(container?)`; omit the argument to destroy every test ad. `AdsOnBreadTest.version` reports the vendored version.

### `<AdsOnBreadSlot />`

| Prop | Type | Description |
| --- | --- | --- |
| `apiKey` | `string` | Required. Your extension API key. |
| `placement` | `'banner' \| 'card'` | Defaults to `'banner'`. |
| `theme` | `'light' \| 'dark'` | Defaults to `'light'`. |
| `language` | `string` | Chrome i18n locale code. Omitted: detects the browser language. |
| `test` | `boolean` | Defaults to `false`. Renders a local mock ad — no network request, no impressions. |
| `fallback` | `ReactNode` | Defaults to `null`. Rendered while loading and when no ad is available. |
| `onAdLoad` | `(ad: Ad) => void` | Called with the ad object once an ad has loaded. |
| `onError` | `(error: Error) => void` | Called when the ad request fails. |

`VERSION` is exported alongside the component.

## Policy

Display only one ad at a time per page. Ads belong in your extension's own UI — including UI your extension already injects into a webpage — but never as a standalone injection into third-party sites. See the [Chrome Web Store ads policy](https://developer.chrome.com/docs/webstore/program-policies/ads).

## Local development

For AdsOnBread maintainers running the platform locally:

```sh
npm run check   # syntax-check all three JS files
npm test        # smoke tests (needs `npm i --no-save react` first)
```

Point the SDK at a local edge Worker with the `edgeUrl` option (vanilla) or prop (React) — `http://localhost:8788` by default. Add that origin to `connect-src` in your extension CSP while testing.

## Releasing

The version in `package.json` is the single source of truth; every JS file carries a matching literal and the smoke test enforces it.

1. Bump `version` in `package.json` and the `VERSION` / `version` literals in `sdk.js`, `test-sdk.js`, and `react.js`.
2. Add a `CHANGELOG.md` entry.
3. `npm run check && npm test`.
4. Commit, then `git tag v1.0.1 && git push --tags`.

The tag fires `.github/workflows/release.yml`, which verifies the tag matches `package.json`, re-runs the checks, creates a GitHub Release with the three JS files attached, and publishes to npm. No app deploy is involved.

Publishing uses **trusted publishing (OIDC)** — there is no npm token stored in this repo. The workflow requests a short-lived, workflow-scoped token that cannot be extracted or reused, and npm generates provenance automatically. If publishing starts failing with an auth error, check the trusted publisher config for `@adsonbread/react` on npmjs.com: it must name this repo and the `release.yml` workflow filename. Renaming that file breaks publishing until the config is updated.

## License

MIT
