# RibbonWeb

Reusable ribbon Web Component and Blazor library with commands, observable models, MVVM binding and RibbonX import.

[![npm](https://img.shields.io/npm/v/%40wieslawsoltes%2Fribbon-web)](https://www.npmjs.com/package/@wieslawsoltes/ribbon-web)
[![npm downloads](https://img.shields.io/npm/dm/%40wieslawsoltes%2Fribbon-web)](https://www.npmjs.com/package/@wieslawsoltes/ribbon-web)
[![NuGet](https://img.shields.io/nuget/v/RibbonWeb.Blazor)](https://www.nuget.org/packages/RibbonWeb.Blazor)
[![NuGet downloads](https://img.shields.io/nuget/dt/RibbonWeb.Blazor)](https://www.nuget.org/packages/RibbonWeb.Blazor)
[![Blazor CI](https://github.com/wieslawsoltes/RibbonWeb/actions/workflows/blazor.yml/badge.svg)](https://github.com/wieslawsoltes/RibbonWeb/actions/workflows/blazor.yml)

## JavaScript

```sh
npm install @wieslawsoltes/ribbon-web
```

The [complete JavaScript guide](README.web.md) retains API examples, compatibility information, architecture, tests and notices. [Open the web demo](https://wieslawsoltes.github.io/RibbonWeb/).

## Blazor

```sh
dotnet add package RibbonWeb.Blazor --version 0.2.2
```

Targets .NET 8 and .NET 10; supports interactive WebAssembly and Server with packaged static web assets and no consumer npm/CDN dependency. `RibbonControl` exposes typed ribbon/tab/group/item definitions, native callbacks and Razor custom controls. The existing `RibbonWeb` component, `RibbonWebInterop`, `ICommand` integration and original asset paths remain available.

Read the [Blazor guide](blazor/README.md), [hosting contract](blazor/INTEGRATION.md), [working sample](blazor/sample/Demo.razor) and [release notes](blazor/RELEASE.md). Advanced native APIs are accessible through object/function handles; the wrapper is not a generated C# reimplementation of every desktop API.

## Build and run

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
# Or: dotnet run --project blazor/server/Server.csproj
```

Source builds use the .NET 10 SDK with .NET 8 targeting support. The Server sample uses `/probe/`. The canonical package project remains `dotnet/RibbonWeb.Blazor.csproj`. CI tests actual NuGet-restored consumers on both frameworks/hosts, including native Razor callbacks, compatible event forwarding, large payloads and remounting.

NuGet versions in `blazor/Version.props` are independent of npm. Version-changing main merges publish after validation with `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases), verify the public package and create `blazor-v*` releases with packages, symbols, samples and checksums. See [LICENSE](LICENSE) and native compatibility boundaries in the JavaScript guide.
