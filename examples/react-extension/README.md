# React extension example

```sh
cd examples/react-extension
npm install
```

This installs `@adsonbread/react` from the npm registry, which is the recommended path — npm 12 blocks git dependencies by default, so a `github:` spec would need every consumer to pass `--allow-git=all`. See [Installing from git](../../README.md#react) if you want to track a tag from this repo instead.

`PopupAds.jsx` shows both the test render and the live render. Drop it into your own bundled extension UI (Vite, webpack, Parcel — anything that packages `node_modules` into your build). Your bundler includes the component in the packaged extension, so nothing loads from a remote CDN at runtime and `script-src 'self'` is enough.

Note there is no bundler config here on purpose — this example is about the install and the component API, not about any one build tool.
