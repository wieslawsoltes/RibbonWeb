# Hosting and interop

Use interactive WebAssembly or Interactive Server. Static SSR only emits the host; browser initialization occurs in `OnAfterRenderAsync`. Wait for `Ready` before native calls. Assets resolve under `_content/RibbonWeb.Blazor/` against the app base URI.

For optional Razor factories:

```csharp
using RibbonWeb.Blazor;
builder.Services.AddRibbonWebBlazor();
// WebAssembly:
builder.RootComponents.RegisterRibbonWebBlazor();
// Or Server:
builder.Services.AddRazorComponents().AddInteractiveServerComponents(
    options => options.RootComponents.RegisterRibbonWebBlazor());
```

`BrowserTemplate<TItem>` registers a captured `RenderFragment<TItem>` under a unique ID. `BrowserFunction.RazorTemplate` creates a native DOM factory backed by an independent Blazor root. Use native custom item `Render` slots. Select serializable native context fields explicitly; DTO contexts preserve complete JSON. Nested components, events and shadow-root input binding are supported. Independent roots do not inherit outer cascading values automatically; put required `CascadingValue` components inside templates. Retain durable state in application models when native controls are recreated.

`BrowserModule` exposes constructor/invoke/call/get/set/events and native identity. Returned functions use `InvokeReferenceAsync`, `CallReferenceAsync`, `GetReferenceAsync`, then `CallFunctionAsync` or another native call. Synchronous engine callbacks must be browser functions. `BrowserFunction.DotNet` is asynchronous and only valid where native APIs accept promises; cancellation of a wait does not preempt arbitrary native computation.

Use streamed `CallJsonAsync`, `InvokeJsonAsync`, `GetJsonAsync` and binary equivalents for complete data, with an explicit 64 MiB default limit. `SubscribeJsonAsync` transfers DTO notifications; `SubscribeAsync` is a bounded diagnostic snapshot of live native graphs. `CallBatchAsync` preserves order but is not atomic. Wrap application payloads in `BrowserValue.Literal` when using generic interop so `$fn` data is not interpreted as callbacks; never use user-controlled module URLs as executable callbacks.

Dispose owned modules/services asynchronously. Dispose borrowed handles without destroying their native owner; `ReleaseAsync` is for resources you own. Template registries and browser sessions are per app/circuit, never shared across Server users.

Source builds require recursive submodule initialization, npm ci/build, `node blazor/build.mjs`, then `dotnet pack dotnet/RibbonWeb.Blazor.csproj -c Release`. NuGet consumers need neither Node nor Dockyard. Samples run as WASM or Server at `/probe/`. CI restores actual nupkg consumers for net8.0/net10.0 and validates native/custom controls, compatible .NET events, templates, streams and remounting in Chromium. This does not establish physical-GPU, hybrid WebView or all-browser qualification.

`blazor/Version.props` owns NuGet versioning separately from npm. Version-changing main merges publish using `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases) after validation. The workflow rejects conflicting immutable versions, verifies downloaded public payloads and attaches packages, symbols, sample archives and checksums to `blazor-v*` releases.
