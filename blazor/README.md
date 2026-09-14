# RibbonWeb.Blazor

Install `RibbonWeb.Blazor` version `0.2.2`. The .NET 8/.NET 10 package contains the real ribbon JavaScript engine as local static web assets, for interactive WebAssembly and Server.

## Native and compatible components

```razor
@using RibbonWeb.Blazor
<RibbonControl Model="model" Theme="light" Style="min-height:180px" />
@code {
    private RibbonDefinition model = new() { Tabs = [new() {
        Id = "home", Header = "Home", Groups = [new() {
            Id = "file", Header = "File", Items = [new() { Id = "save", Label = "Save" }]
        }]
    }] };
}
```

Typed definitions cover tabs, contextual groups, groups, quick access, backstage, item state, values, commands, bindings and custom render slots; `AdditionalProperties` preserves advanced native options. Set `ModelVersion` when mutating an existing model in place. `Changed` forwards native command/change/tab events. Wait for `Ready`, then use `SelectTabAsync`, `UpdateControlAsync`, `GetControlAsync`, `SetContextAsync`, `InvalidateAsync` or `Module` for advanced APIs.

The existing `RibbonWeb` component retains `Commands`/`ICommand`, its compatible .NET events and original static asset paths. Its namespace and type share a name; when declaring the component type explicitly, use `global::RibbonWeb.Blazor.RibbonWeb`. The sample uses an independent application namespace to avoid C# namespace collisions.

## Razor custom controls

Register `AddRibbonWebBlazor` and the host's `RegisterRibbonWebBlazor`. Define a `BrowserTemplate<TItem>` with a unique ID, then give a native `RibbonItemDefinition` `Type = "custom"` and `Render = BrowserFunction.RazorTemplate(id, contextProperty: "control", fields: ["id", "label"])`. Razor callbacks and input binding run inside the native control's shadow DOM. The [sample](sample/Demo.razor) verifies an actual custom-control callback alongside compatible .NET tab-event forwarding.

Read [INTEGRATION.md](INTEGRATION.md) for registration, native references, callback timing, data streaming, lifetime and publication. No npm/CDN is needed for package consumers. Browser/native compatibility boundaries remain unchanged.

## Lifecycle in 0.2.2

`RibbonControl.IsReady` and `IsDisposed` expose native lifecycle state. Concurrent cleanup waits for the same native teardown, releases all handles after errors and retains failures. Queued callbacks stop after removal. Razor factories provide awaitable disposal, coalesced updates and late-import/creation cleanup. Actual-package samples test template movement, context updates and recreation in both hosts.
