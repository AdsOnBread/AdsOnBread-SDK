# Vanilla extension example

A loadable Manifest V3 extension that renders an AdsOnBread banner in its popup.

The `vendor/` directory is gitignored on purpose — there is exactly one copy of the SDK in this repo, so no copy can drift. Create it before loading the extension:

```sh
npm run example:vanilla
```

Then in Chrome: **chrome://extensions** → enable Developer mode → **Load unpacked** → pick this directory.

Out of the box it renders a test ad. Put your own key in `popup.js` and set `USE_TEST_AD = false` to request a live one.

In your own extension you would vendor the files from a release tag instead — see the [Install section](../../README.md#vanilla-js) of the root README.
