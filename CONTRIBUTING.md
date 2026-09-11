# Contributing to RibbonWeb

RibbonWeb is a dependency-free browser component with a separate observable model layer. Keep the `src/core.js` public API usable without DOM globals. Component UI belongs in `src/ribbon.js` and `src/styles.js`; RibbonX parsing and .NET interop belong in their own entry points.

## Local development

Use Node.js 22 or newer. Install development dependencies and browser binaries:

```sh
npm ci
npx playwright install chromium
npm start
```

Open `http://127.0.0.1:4173/`. Source files run directly as ES modules; editing does not require bundling. Add `-- --host 0.0.0.0` to `npm start` only when intentionally testing from another device on a trusted network.

Run checks before opening a pull request:

```sh
npm run check
npm test
npm run test:browser
npm run build:site
```

The model tests use the Node test runner. Browser tests exercise the actual custom element in Chromium. A test must prove externally observable behavior; avoid tests that only repeat implementation details. Add regression coverage for a bug or new behavioral contract. Verify keyboard behavior, touch layout, both themes, RTL, disabled commands and cleanup where they apply.

## API and compatibility

Public properties use documented camelCase and .NET-style aliases. Changes to either spelling can break consumers. Keep declarations, examples and capability documentation synchronized with code. A new .NET compatibility claim must include an executable example or behavioral test. Report unsupported RibbonX elements and callbacks explicitly instead of silently pretending they work.

Avoid runtime package dependencies, external font requests, proprietary icons and embedded credentials. Use text labels or project-owned assets. Rendering untrusted text must use DOM text APIs rather than HTML interpretation. Dispose subscriptions and abort pending UI work when elements disconnect.

## Pull requests and releases

Describe the concrete user behavior changed, why it matters and the checks you ran. Keep features separate from incidental formatting. CI verifies syntax, model tests, Chromium behavior, native ESM packaging and the static showcase build. The maintainer release process, registry setup and downloadable distributions are documented in [docs/distribution.md](docs/distribution.md).

Contributions are licensed under the repository's MIT license.
