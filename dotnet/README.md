# RibbonWeb.Blazor

The canonical Razor Class Library remains `dotnet/RibbonWeb.Blazor.csproj`. The package targets .NET 8 and .NET 10, preserves the existing `RibbonWeb` / `RibbonWebInterop` API and static-asset paths, and adds `RibbonControl`, typed model definitions and native-engine services.

```sh
dotnet add package RibbonWeb.Blazor --version 0.2.0
```

See [the complete Blazor guide](../blazor/README.md) for both component APIs, ICommand and native callbacks, interactive hosting, ownership, source preparation, WebAssembly/Server samples and independently versioned NuGet releases. Source builds require `git submodule update --init --recursive`, `npm ci`, `npm run build` and `node blazor/build.mjs` before `dotnet pack`. Package consumers do not require Node or the source submodule.
