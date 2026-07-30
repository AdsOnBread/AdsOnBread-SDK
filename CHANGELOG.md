# Changelog

## 1.0.0

Moved the SDK out of the AdsOnBread platform repo into this standalone public repo. **No API changes** — `AdsOnBread.load`, `AdsOnBreadTest.load`, and `<AdsOnBreadSlot />` behave exactly as they did in `@adsonbread/react@0.4.0`.

What changed for publishers:

- **Vanilla:** vendor `sdk.js` and `test-sdk.js` from a release tag on this repo instead of downloading from `adsonbread.com/sdk/*.js`, which no longer exists. Release assets keep the `adsonbread-sdk.js` / `adsonbread-test-sdk.js` filenames.
- **React:** `npm install @adsonbread/react` — unchanged. Releases now publish from this repo automatically on tag, via npm trusted publishing (OIDC), with no long-lived token involved. Installing from git (`github:AdsOnBread/AdsOnBread-SDK#semver:^1.0.0`) also works but needs `--allow-git=all`, since npm 12 blocks git dependencies by default.
- Version jumped from 0.4.0 to 1.0.0 so a `^1.0.0` range admits every future 1.x release. A `^0.4.0` range would only have admitted 0.4.x.
- All three JS files now report their version: `AdsOnBread.version`, `AdsOnBreadTest.version`, and the exported `VERSION` from the React entry point.

## 0.4.0 and earlier

Released from the platform repo as `@adsonbread/react`. See that repo's history.
