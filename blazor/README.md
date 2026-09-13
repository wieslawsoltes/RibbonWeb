# RibbonWeb.Blazor

The existing RibbonWeb NuGet package now targets .NET 8 and .NET 10, retains its ICommand component and static-asset paths, and adds typed ribbon definitions plus complete native-engine interop. JavaScript, shadow-DOM styles, licenses, XML documentation and symbols ship in the package; consumers need no npm or CDN.

```sh
dotnet add package RibbonWeb.Blazor --version 0.2.0
```

## Compatible ICommand component

```razor
@using global::RibbonWeb.Blazor
<RibbonWeb Model="model" Commands="commands" Ready="OnReady" theme="light" />
```

The existing `Model`, `ModelVersion`, `ModuleUrl`, `AriaLabel`, `Command`, `Change`, `SelectedTabChanged`, `Commands`, `CommandParameter`, unmatched attributes and imperative methods remain available. `Ready` is new and runs after model and command initialization. Model replacement or a `ModelVersion` increment updates the browser model. ICommand execution and CanExecuteChanged remain .NET-side, with enabled-state updates forwarded to the browser. Initialization/disposal now coordinate so an asynchronously created bridge cannot outlive its owner.

`RibbonWebInterop` remains available in the `RibbonWeb` namespace and retains `_content/RibbonWeb.Blazor/index.js`. All original source JavaScript assets remain packaged for compatibility. The canonical project remains `dotnet/RibbonWeb.Blazor.csproj`; there is no competing NuGet package.

## Native-engine component and typed definitions

```razor
@using global::RibbonWeb.Blazor
<RibbonControl @ref="ribbon" Model="model" Theme="light" Layout="classic"
               Ready="OnNativeReady" Changed="OnNativeEvent" Style="min-height:180px" />
@code {
    private RibbonControl ribbon = default!;
    private RibbonDefinition model = new() { Tabs = [new() {
        Id = "home", Header = "Home", Groups = [new() {
            Id = "file", Header = "File", Items = [new() { Id = "save", Label = "Save", Size = "large" }]
        }]
    }] };
}
```

`RibbonDefinition`, `RibbonTabDefinition`, `RibbonGroupDefinition` and `RibbonItemDefinition` cover the common model hierarchy. `AdditionalProperties` carries other native properties through JSON extension data. Native control types include button, toggle, checkbox, radio, split, menu, menuitem, textbox, combobox, dropdown, spinner, slider, gallery, color, separator, label and custom. Nested items, bindings, command parameters, key tips, contextual tabs, quick access and backstage models remain native engine data.

`RibbonControl` supports `Model`, `ModelVersion`, `DataContext`, `Theme`, `Layout`, `Minimized` and extra native `Options`. Common methods include selecting tabs, updating/getting controls, context activation and invalidation. Every other native method is available through `InvokeAsync<T>` / `InvokeVoidAsync`; `Module` and `Control` expose full native model references after Ready. `Events` selects DOM notifications using `dom:` names; defaults forward command/change/tab/context/error notifications as bounded JSON-safe snapshots. These snapshots omit private backing graphs and use `$reference`/`$truncated` markers where necessary; obtain native references or explicit data reads for full model traversal.

`RibbonModule` / `BrowserModule` supplies `GetExportsAsync`, `CreateAsync`, `InvokeAsync`, `CallAsync`, `GetAsync`, `SetAsync`, `SubscribeAsync` and `ReleaseAsync`, including the root library's RibbonX, MVVM and customization exports. This generic surface reaches the native API without claiming an exhaustive generated strongly typed C# port.

`BrowserFunction.Property`, `Setter`, `Constant` and `Module("./templates.js", "render")` provide synchronous native callbacks without eval. `BrowserFunction.DotNet` returns a promise and must only be used by promise-aware APIs. Use browser functions for synchronous preview/cancellation, converters or DOM factories; a Blazor Server circuit cannot synchronously supply those values. Native custom-control rendering is JavaScript-owned; arbitrary Razor RenderFragments inside shadow-DOM native controls are not provided. Use the compatible component for direct .NET ICommand wiring.

## Hosting and ownership

Use interactive WebAssembly or Server render modes. Prerender emits the host without JS calls; Ready indicates interactive initialization. Assets follow the application's base URI and work at non-root paths. Components dispose native listeners and .NET callback references, including disconnected Server circuits. Per-owner browser modules must not be registered as Server application singletons. `IJSObjectReference.DisposeAsync` releases only the interop handle; `Module.ReleaseAsync` additionally disposes native objects. JSON-transferred native edits do not automatically mutate CLR objects; handle Change/Changed explicitly.

## Source build, samples and tests

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
dotnet run --project blazor/server/Server.csproj --urls http://localhost:5080
# Server sample: http://localhost:5080/probe/
```

The shared lifecycle source, hosts and test harness come from a commit-pinned source submodule; generated files are recreated before builds. The resulting package is self-contained and has no Dockyard NuGet dependency. The shared sample displays both the compatible ICommand component and the native-engine component, with tabs, toggles, dropdown, color picker, theme changes and native updates.

CI packs both target frameworks, checks real package contents, runs bridge and managed lifecycle/prerender tests, restores both sample hosts from the nupkg and drives native updates, compatible event forwarding and unmount/remount in Chromium. Failure diagnostics and published samples are retained as artifacts. Existing native engine/browser qualifications are not broadened to all devices by these checks.

## Releases

`blazor/Version.props` versions NuGet separately from npm. A validated version-changing PR merged to main publishes with `NUGET_API_KEY` (fallback `NUGET_TOKEN` or `NUGET_KEY`) and creates a `blazor-v<version>` release containing packages and the published WebAssembly sample. Manual dispatch defaults to validation-only. The npm release continues independently; NuGet publication is owned by the Blazor validation workflow. Update the runtime submodule and reusable-workflow SHA together in a reviewed PR.
