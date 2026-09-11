# Building, installing and releasing RibbonWeb

RibbonWeb is distributed as native ECMAScript modules with TypeScript declarations and no runtime dependencies. Node.js is a development and release requirement; applications load the component in the browser without Node.js.

## Build and run from source

Use Node.js 22 or newer:

```sh
git clone https://github.com/wieslawsoltes/RibbonWeb.git
cd RibbonWeb
npm ci
npm run build
npm start
```

The development server opens the showcase at `http://127.0.0.1:4173/`. It binds to loopback by default, serves JavaScript with a module-compatible content type, supports HEAD requests and rejects hidden paths and symlink escapes. It is a local development tool. Production deployment uses a static web server.

`npm run build` copies the source module graph into `dist/`, includes declarations and the MIT license, and writes `dist/version.json`. It does not minify or rewrite the source. This keeps imports, stack traces and security review straightforward. Applications that already bundle may import the package and let their bundler optimize the dependency graph.

## Distributions

```sh
npm run release:pack
```

The `artifacts/` directory contains:

| File | Purpose |
| --- | --- |
| `wieslawsoltes-ribbon-web-VERSION.tgz` | npm-compatible library package |
| `ribbon-web-VERSION-browser.zip` | Browser module files, source, examples, documentation and a showcase entry page |
| `ribbon-web-VERSION-source.zip` | Complete source, scripts, tests, workflows, examples and documentation |
| `SHA256SUMS.txt` | SHA-256 checksums of the three distribution archives |
| `manifest.json` | Package version, filenames, lengths and checksums |

ZIP generation uses fixed timestamps, deterministic ordering and Node's built-in compression. The same input files produce the same ZIP bytes on the same supported runtime. No external zip utility is required. Browser files must be served over HTTP(S); browser module security generally prevents opening the example directly through `file:` URLs.

Install a release tarball without a registry:

```sh
npm install ./wieslawsoltes-ribbon-web-0.1.0.tgz
```

After the maintainer has published to npm, consumers can install:

```sh
npm install @wieslawsoltes/ribbon-web
```

```js
import { RibbonModel } from '@wieslawsoltes/ribbon-web';
import { ObservableObject } from '@wieslawsoltes/ribbon-web/core';
```

The public subpaths are `.`, `./core`, `./ribbonx`, `./dotnet` and `./package.json`. Browser users can host the entire `dist/` directory and import `./dist/index.js` from a module script. Preserve neighboring modules: `index.js` is a module entry point, not a single-file bundle. CSS lives within the component's source modules.

A registry CDN URL becomes available only after npm publication. For example, an application may import the versioned `dist/index.js` path from its chosen npm CDN, ensuring it serves JavaScript with the correct content type and retains relative module resolution. The GitHub Pages showcase also hosts `dist/` for evaluation. For a deployed application, pin a version or host the distribution with the application.

## GitHub Pages showcase

```sh
npm run build:site
npm start -- --root site
```

`site/` contains the `examples/` directory, native source and distribution modules, readable documentation pages and downloads. The root redirects into `examples/`, preserving the example modules' relative paths. GitHub Pages serves it below `/RibbonWeb/` without absolute-root asset paths.

The workflow in `.github/workflows/pages.yml` runs checks and browser tests before building and deploying. It requests `pages:write` and `id-token:write`, uploads the `site` directory, and deploys into the `github-pages` environment.

Enable the repository's Pages build source as **GitHub Actions** before the first deployment. The workflow also sets `configure-pages`'s `enablement: true`; first-time automatic enablement requires the optional `PAGES_SETUP_TOKEN` secret. The normal `GITHUB_TOKEN` cannot create the initial Pages configuration. After Pages is enabled, normal deployments use `GITHUB_TOKEN` and the setup secret can be removed. GitHub documents the required setup-token permissions in [the configure-pages action's input definition](https://github.com/actions/configure-pages/blob/main/action.yml): a suitable personal access token with repository/Pages access, or a GitHub App token with administration and Pages write permissions.

The intended showcase address is `https://wieslawsoltes.github.io/RibbonWeb/`. A workflow file alone does not establish that deployment succeeded; check the Pages workflow's deployment URL and open the page.

## Release process

1. Update `CHANGELOG.md` and the package version, including the lockfile:

   ```sh
   npm version 0.1.1 --no-git-tag-version
   npm run check
   npm test
   npm run test:browser
   npm run release:pack
   ```

2. Commit the version and release notes, then push the commit.
3. Create and push its version tag:

   ```sh
   git tag v0.1.1
   git push origin v0.1.1
   ```

   Alternatively, run **Release library** from the Actions UI with `version: 0.1.1` against the exact commit to release. The workflow creates the release/tag at that commit if needed.

The release validator rejects a tag or input that does not match both `package.json` and `package-lock.json`. The release job runs syntax checks, Node tests and Chromium tests, builds distribution archives, and uploads them to a GitHub release. Prerelease versions such as `0.2.0-beta.1` produce prereleases and use the `next` npm distribution tag. Stable versions use `latest`.

Repeated workflow runs replace GitHub release attachments for the same release. Registry versions are immutable: if a registry step has already published successfully, remove/disable that registry's publish option before rerunning solely to recover a later failure, or use a new package version. Do not attempt to republish a changed package under an existing version.

## npm publishing

The release job publishes to npm only when a repository secret named `NPM_TOKEN` is configured. Use a token authorized for the `@wieslawsoltes` scope and package. Keep credentials in GitHub Actions secrets. The workflow passes the token via `NODE_AUTH_TOKEN` and requests provenance using GitHub's OIDC support.

A registry may require its account, scope, token and organization policy to be configured before first publication. Review the registry's current publishing requirements. The workflow uploads the already tested tarball, rather than rebuilding it during publication.

To publish manually after validation:

```sh
npm run release:pack
npm login
npm publish artifacts/wieslawsoltes-ribbon-web-0.1.0.tgz --access public
```

The project has no committed authentication tokens or `.npmrc` credentials. Until registry publication succeeds, use the GitHub release tarball or browser ZIP.

## GitHub Packages

Set the repository Actions variable `PUBLISH_GITHUB_PACKAGES` to `true` to enable the optional GitHub Packages step. It uses the workflow's `GITHUB_TOKEN` with `packages:write`, the package's existing `@wieslawsoltes` scope and the repository association in `package.json`.

Consumers configure the scope in their own project or user `.npmrc`:

```ini
@wieslawsoltes:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then authenticate with a token that can read the package and install its version. This scope configuration routes all packages under `@wieslawsoltes` to GitHub Packages; use it only in projects where that routing is intended. GitHub Packages and npm are independent registries; publishing to one does not publish to the other.

## Verification and hosting compatibility

The CI matrix exercises Node.js 22 and 24. Browser tests install a pinned Playwright Chromium version and interact with the real component. A Chromium CI result does not establish testing on physical touch hardware, assistive technology, Firefox or Safari unless separately reported. The package build deliberately has no compiler/transpiler stage, so browser targets must support modern custom elements, Shadow DOM and native ES modules used by the implementation.

## Release manifest trigger

The release workflow also runs when `release.json` changes on `main`. Commit `{ "version": "0.1.0" }` with the matching package and lockfile versions to publish that exact commit after the workflow checks. This is useful when your GitHub integration can commit files but cannot dispatch workflows or push tags. The workflow creates the version tag only after checks and package builds pass. Tags already pointing to another commit are rejected; bump the version for a new release.

The release includes a built `RibbonWeb.Blazor` NuGet package and symbols. Set `NUGET_API_KEY` to enable NuGet.org publishing; without it, the `.nupkg` is still available as a GitHub release asset. NuGet.org publication is separate from building the package.
