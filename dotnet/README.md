# RibbonWeb.Blazor

A Razor class library for the independent RibbonWeb web component. It packages
its JavaScript modules as static web assets and forwards ribbon events to Blazor
callbacks and optional `ICommand` implementations. Target framework: `net8.0`.

## Build and package

Run from the repository root with a .NET 8 SDK:

```sh
dotnet restore dotnet/RibbonWeb.Blazor.csproj
dotnet build dotnet/RibbonWeb.Blazor.csproj --configuration Release --no-restore
dotnet pack dotnet/RibbonWeb.Blazor.csproj --configuration Release --no-build --output artifacts/dotnet
```

The project links `../src/*.js` into `wwwroot`, keeping one source of truth for
the JavaScript library. The Razor SDK includes these files as static web assets
in the NuGet package. Consumers receive `_content/RibbonWeb.Blazor/index.js` and
all of its relative module imports. This follows the documented
[Razor class library static asset model](https://learn.microsoft.com/en-us/aspnet/core/razor-pages/ui-class?view=aspnetcore-8.0#create-an-rcl-with-static-assets).

## Reference from a Blazor app

During repository development, use a project reference:

```sh
dotnet add path/to/YourApp.csproj reference dotnet/RibbonWeb.Blazor.csproj
```

For a packed release, add `RibbonWeb.Blazor` from the feed or local folder
containing the generated `.nupkg`. NuGet.org availability depends on the
repository's release publishing configuration; packing a file does not publish
it to a registry.

Use the component in an **interactive** Blazor view. A statically rendered view
cannot dispatch JavaScript interop or ribbon commands. The wrapper imports its
module in `OnAfterRenderAsync`, so it is compatible with prerendering followed
by interactive activation.

```razor
@using global::RibbonWeb.Blazor
@using global::RibbonWeb

<RibbonWeb Model="RibbonModel" Command="OnCommand" theme="light"
           layout="classic" aria-description="Document commands" />

<p>@Status</p>

@code {
    private string Status = "Ready";
    private readonly object RibbonModel = new
    {
        title = "My document",
        tabs = new[]
        {
            new
            {
                id = "home", header = "Home", keyTip = "H",
                groups = new[]
                {
                    new
                    {
                        id = "file", header = "Document",
                        items = new[]
                        {
                            new { id = "save", type = "button", label = "Save", icon = "save" }
                        }
                    }
                }
            }
        }
    };

    private void OnCommand(RibbonEventArgs args)
    {
        if (args.Id == "save") Status = "Save requested by the ribbon";
    }
}
```

No separate `<script>` tag is required. The default `ModuleUrl` is
`_content/RibbonWeb.Blazor/index.js`; the interop helper turns it into an explicit
relative module specifier and imports the package entry point, which registers
`<ribbon-web>` and exports `createDotNetBridge`. A custom `ModuleUrl` must point to
an entry point exposing that factory and registering the element.

`AdditionalAttributes` passes ordinary web component attributes through to the
underlying element. This includes `theme`, `layout`, `density`, `dir`, and
`storage-key`. Standard camelCase JavaScript model property names are shown
above. Blazor's interop JSON serialization also applies its standard casing to
DTO properties.

## MVVM commands and state updates

Pass an `IReadOnlyDictionary<string, ICommand>` through `Commands`, with entries
keyed by control ID. The wrapper observes `CanExecuteChanged`, updates the
corresponding control's `enabled` state, and checks `CanExecute` before executing.
Each dictionary key must identify a control currently present in the model.

Use `CommandParameter` to resolve an application parameter from an event's
control ID. Without a selector, received JSON parameters remain `JsonElement`
values; initial `CanExecute` checks use a null parameter. A parameter-dependent
command should provide a selector so initial state and execution agree.

The `Command`, `Change`, and `SelectedTabChanged` callbacks receive a
`RibbonEventArgs` with `Type`, `Id`, `Value`, and `Parameter`. A .NET model is
serialized as data; .NET delegates and command objects are not sent as callable
JavaScript objects.

Replace the `Model` reference or increment `ModelVersion` to submit a full model
update. For focused updates, capture the component using `@ref` and call
`UpdateControlAsync`, `SetContextAsync`, or `SelectTabAsync`. Unrelated Blazor
renders do not reassign the model and reset its selection or context.

The component disposes the JavaScript bridge and command subscriptions before
releasing its `DotNetObjectReference`. A directly created `RibbonWebInterop`
instance must likewise be disposed before its caller-owned reference.

## Scope and validation

The project is a build-and-pack target, not an implementation of the .NET desktop
control stack or Office document engines. `ICommand` behavior remains in the
hosting .NET application. The CI workflow builds the Razor code, inspects the
packed assembly and static assets, and publishes a temporary Blazor WebAssembly
host that consumes the package; application-level interop should also be
validated in the consuming Blazor app.

The implementation workspace did not contain a .NET SDK, so no local C#/Razor
compilation is claimed. The repository CI result is the source of truth for its
build status.
