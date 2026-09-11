# Changelog

## 0.1.0 — 2026-09-11

Initial public release of RibbonWeb, a standalone native-ESM ribbon component for browser applications and .NET application ports.

### Component and integration

- Reusable custom element with a model-driven API and .NET-style patterns for commands, observables and MVVM bindings.
- Ribbon controls, contextual surfaces and application showcase examples are documented in the README and capability matrix.
- Separate `core`, `ribbonx` and `dotnet` entry points allow applications to import the relevant layer.
- TypeScript declarations ship with the JavaScript package.
- A buildable .NET 8 Razor class library packages the component and all browser assets for Blazor.
- 34 Node tests, 58 Chromium behavior groups (including 29 RibbonX assertions), and strict TypeScript usage checks pass.

### Distribution

- MIT license and zero runtime package dependencies.
- Native ESM output can be hosted directly, consumed through npm, or served by a package CDN after registry publication.
- Reproducible build scripts produce an npm tarball, a browser distribution ZIP, a complete source ZIP and SHA-256 checksums.
- CI checks JavaScript syntax, model behavior, browser interaction and packaging.
- GitHub Pages workflow publishes the interactive showcase, documentation and downloadable distributions.
- Version-tag, release-manifest or manual release workflow publishes GitHub release artifacts. npm publishing is enabled when the maintainer provides `NPM_TOKEN`; GitHub Packages publishing is enabled with the repository variable `PUBLISH_GITHUB_PACKAGES=true`. NuGet.org publishing is enabled with `NUGET_API_KEY`.

### Compatibility notes

This release is an independent browser ribbon implementation. The capability matrix records supported controls, platform adaptations and remaining gaps. Application command implementations, document formats and the complete proprietary APIs of desktop productivity suites are outside the ribbon control's contract. Registry pipeline support does not itself mean a package has already been published to that registry.
