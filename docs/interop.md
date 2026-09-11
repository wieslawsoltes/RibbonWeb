# RibbonX and .NET interoperability

RibbonWeb is an independent web control. Its JavaScript model and its command and
property-notification conventions support browser ports of .NET applications.
It is not the binary Office ribbon, an Office host, or an implementation of Word,
Excel, or PowerPoint document engines. Office built-in command IDs and icons do
not automatically acquire application behavior.

## RibbonX import

`parseRibbonXml(xml, callbacks, options)` returns a regular ribbon model.
`createRibbonXAdapter(xml, callbacks, options)` additionally exposes an
Office-shaped invalidation API. Both accept the public 2006 and 2009 `customUI`
namespaces. The parser uses the browser's `DOMParser`; callback names are resolved
only against own function properties in the supplied map. No callback expression
is evaluated. XML document types and entity declarations are rejected.

```js
import { createRibbonXAdapter } from './ribbonweb/ribbonx.js';

let bold = false;
let ribbonUi;
const adapter = createRibbonXAdapter(
  `
  <customUI xmlns="http://schemas.microsoft.com/office/2009/07/customui"
            onLoad="loaded">
    <ribbon><tabs><tab id="home" label="Home">
      <group id="font" label="Font">
        <toggleButton id="bold" label="Bold" keytip="B"
                      getPressed="isBold" onAction="toggleBold" />
        <editBox id="fontName" label="Font" getText="fontName"
                 onChange="changeFont" />
        <dynamicMenu id="recent" label="Recent" getContent="recentFiles" />
      </group>
    </tab></tabs></ribbon>
  </customUI>`,
  {
    loaded(ui) {
      ribbonUi = ui;
    },
    isBold() {
      return bold;
    },
    toggleBold(control, pressed) {
      bold = pressed;
      // Apply formatting in your editor, then refresh callback-derived state.
      ribbonUi.InvalidateControl(control.id);
    },
    fontName() {
      return 'Aptos';
    },
    changeFont(control, text) {
      console.log(control.id, text);
    },
    recentFiles() {
      return `<menu xmlns="http://schemas.microsoft.com/office/2009/07/customui">
      <button id="recent-1" label="Quarterly report" onAction="openRecent" />
    </menu>`;
    },
    openRecent(control) {
      console.log('Open', control.id);
    },
  },
  {
    onWarning(warning) {
      console.warn(warning.code, warning.message);
    },
  },
);

adapter.attach(document.querySelector('ribbon-web'));
// Later, after document state changes:
adapter.Invalidate();
adapter.ActivateTab('home');
// Before disposing an application view:
// adapter.dispose();
```

| RibbonX surface                            | Web mapping                                                 |
| ------------------------------------------ | ----------------------------------------------------------- |
| `tab`, `group`                             | Tab `header`, group `header`, and `items`                   |
| `button`, `toggleButton`, `checkBox`       | `button`, `toggle`, `checkbox`; toggle state uses `checked` |
| `editBox`, `comboBox`, `dropDown`          | `textbox`, `combobox`, `dropdown`; state uses `value`       |
| `menu`, `splitButton`, `gallery`           | `menu`, `split`, `gallery`                                  |
| `dynamicMenu`                              | `menu` with asynchronous `getItems()` and `getContent` XML  |
| `separator`, `labelControl`                | `separator`, `label`                                        |
| `box`, `buttonGroup`                       | Child controls flattened into their parent; warning emitted |
| `qat` shared/document controls             | `quickAccessToolbar`                                        |
| `contextualTabs`                           | Tabs associated with a host-controlled context ID           |
| Simple `officeMenu` / `backstage` commands | `backstage` command items                                   |
| `dialogBoxLauncher`                        | A regular group button; warning emitted                     |

The importer supports `getEnabled`, `getVisible`, `getLabel`, `getPressed`,
`getText`, `getItemCount`, `getItemLabel`, `getItemID`, `getSelectedItemID`,
`getSelectedItemIndex`, `getItemImage`, `getImage`, `getSize`, `getShowImage`,
`getShowLabel`, `getKeytip`, `getScreentip`, and `getSupertip`. These value getters
are synchronous. The `getContent` callback may return a promise when a menu calls
`getItems()`; use `loadDynamicMenus: false` to avoid eagerly querying dynamic
menus during import.

Callbacks receive a frozen descriptor with `id`, `Id`, and `tag`, plus `idMso` /
`idQ` if specified. Actions follow the common RibbonX signatures:

| Callback                     | Arguments                                                         |
| ---------------------------- | ----------------------------------------------------------------- |
| Button `onAction`            | `(control)`                                                       |
| Toggle/check box `onAction`  | `(control, pressed)`                                              |
| Drop-down/gallery `onAction` | `(control, selectedItemId, selectedItemIndex)`                    |
| Text/combo `onChange`        | `(control, text)`                                                 |
| Item getters                 | `(control, index)`                                                |
| `getContent`                 | `(control)` returning a `<menu>` XML string                       |
| Root `onLoad`                | `(adapter)` with `Invalidate`, `InvalidateControl`, `ActivateTab` |

`Invalidate()` refreshes all imported getter bindings and updates the attached
element. `InvalidateControl(id)` refreshes one registered control. Both preserve
the imported model's identity and update callback-derived properties on the
attached element's normalized model. Invalidation preserves the selected tab,
active contexts, and user customization of fields without a RibbonX getter.
`ActivateTab(id)` selects a known tab or records a pending selection before
attachment. Unknown IDs return `false`. Disposed adapters no longer invoke
callbacks.

Warnings are available through `adapter.warnings`, through
`parseRibbonXml(...).ribbonX.warnings`, and through `options.onWarning`. Callback
exceptions produce a warning and invoke optional `options.onError(error, control)`.
Malformed XML and duplicate control IDs throw. Defaults limit XML to 1,000,000
characters and generated selection controls to 10,000 entries; configure
`maxXmlLength` and `maxItems` when appropriate.

Office built-in command implementations (`idMso`), built-in images (`imageMso`),
qualified Office insertion positions, repurposed Office commands, context-menu
extensions, and rich Backstage form layout are not implemented by this adapter.
These cases produce warnings. Provide `options.resolveImage(resource, control)`
to map an image resource to an icon supported by your web model. The importer
preserves XML order and does not expose Office COM objects, `IRibbonControl`
window context, or the application object model. This is a migration adapter for
supported customization concepts, not full RibbonX or Office API compatibility.

## JavaScript bridge for .NET

Load the RibbonWeb element module before rendering your wrapper, then import the
small `dotnet.js` module through `IJSRuntime`:

```js
import { createDotNetBridge } from './ribbonweb/dotnet.js';
const bridge = createDotNetBridge(ribbonElement, dotNetObjectReference, {
  methodName: 'OnRibbonEvent',
});
bridge.setModel({ tabs: [{ id: 'home', header: 'Home', groups: [] }] });
bridge.updateControl('save', { enabled: false });
bridge.setContext('picture', true);
bridge.selectTab('home');
await bridge.flush();
bridge.dispose();
```

The bridge forwards `ribbon-command`, `ribbon-change`, and `ribbon-tab-change`
in dispatch order. The .NET invocation receives `{ type, id, value?, parameter? }`.
It serializes only these explicit fields. JSON-compatible primitive values,
plain records, and arrays are supported; functions, DOM references, prototypes,
cyclic links, non-finite numbers, and property getters cannot carry a live ribbon
model across interop. Arrays and records are limited to 256 entries per level,
and nested values to seven object levels. Large domain objects should be
represented by an ID and resolved in the host.

The optional `onError(error, payload)` hook reports rejected .NET invocations.
Without it the element emits `ribbon-dotnet-error`. Disposal removes listeners
and cancels notifications queued behind the currently executing notification.
Dispose the bridge before disposing its `DotNetObjectReference`.

## Blazor Razor class library

`dotnet/RibbonWeb.Blazor.csproj` packages `RibbonWebInterop.cs`, `RibbonWeb.razor`,
and the JavaScript modules as the `RibbonWeb.Blazor` NuGet library. It uses the
Razor SDK, targets `net8.0`, and links `../src/*.js` into `wwwroot`. Companion
static web assets are automatically included when packing a Razor class library.
See [the official Razor class library guidance](https://learn.microsoft.com/en-us/aspnet/core/razor-pages/ui-class?view=aspnetcore-8.0#create-an-rcl-with-static-assets).

Build from the repository root using a .NET 8 SDK:

```sh
dotnet restore dotnet/RibbonWeb.Blazor.csproj
dotnet build dotnet/RibbonWeb.Blazor.csproj --configuration Release --no-restore
dotnet pack dotnet/RibbonWeb.Blazor.csproj --configuration Release --no-build --output artifacts/dotnet
```

Reference this project during development, or install the packed library from a
local folder or configured package feed. The package version is `0.1.0`; registry
availability is determined by release publishing, not by the existence of the
project file. See `dotnet/README.md` for a complete component example.

The wrapper accepts a serializable model and command dictionary:

```razor
@using global::RibbonWeb.Blazor

<RibbonWeb Model="RibbonModel" Commands="DocumentCommands"
           Command="HandleCommand" Change="HandleChange"
           theme="light" layout="classic" />
```

Use the component in an interactive Blazor view. Its default `ModuleUrl` is
`_content/RibbonWeb.Blazor/index.js`. The interop helper imports that entry point
with an explicit relative prefix, registering the web component before creating
the bridge. No separate script tag is needed. A custom module URL must expose
`createDotNetBridge` and register the element. Unmatched attributes pass through
to the native element, including theme, layout, density, direction, and storage
key attributes.

Use anonymous objects or DTOs with camelCase model property names. If your
application changes the .NET serializer naming policy, preserve the JavaScript
model names. Functions are not serialized: use stable control IDs, the `Commands`
dictionary, and event callbacks to bind behavior. The wrapper sends a replacement
model when its reference or `ModelVersion` changes. Increment `ModelVersion` after
mutating a .NET model in place, or use `UpdateControlAsync` for small updates;
ordinary component renders preserve the ribbon's current selection and context.
The wrapper subscribes to `ICommand.CanExecuteChanged`, updates each command's
`enabled` state, checks `CanExecute` before `Execute`, and unsubscribes on disposal.
A `CommandParameter` selector can resolve a stable parameter from a control ID;
when absent, received parameters remain `JsonElement` values. Parameter-dependent
`CanExecute` implementations should supply that selector so initial state and
execution use the same parameter. Every command dictionary key must correspond
to a control in the current model.

The JavaScript library runs without .NET. The class library does not make
cross-runtime objects, arbitrary binding expressions, WPF controls, COM, or .NET
delegates directly serializable. A JavaScript MVVM host can instead use the
library's native observable and command classes without the interop bridge.

The [.NET package CI](https://github.com/wieslawsoltes/RibbonWeb/actions/workflows/dotnet.yml)
compiled the C# and Razor library, packed NuGet artifacts, verified all JavaScript
static assets byte-for-byte, and published a temporary Blazor WebAssembly host
consuming the package. These checks passed for this release's implementation.
Application-level interop should also be validated in the chosen consuming app.

## .NET release integration

`.github/workflows/dotnet.yml` restores, builds, and packs the class library,
verifies the assembly and every linked JavaScript static asset, and publishes
a temporary WebAssembly host to check package consumption. It uploads `.nupkg`
and `.snupkg` build artifacts.

For a versioned release, keep the npm and .NET project versions synchronized.
Add the steps in `.github/workflow-fragments/dotnet-release.steps.yml` to the
existing release job, pack into its `artifacts` directory, and generate the final
checksum manifest after all JavaScript and .NET archives exist. The existing
GitHub release upload then includes the NuGet package and symbols.

Configuring `NUGET_API_KEY` enables the optional NuGet.org publishing step.
Without it, downloadable package files can still be distributed through GitHub
releases and local package feeds. The registry command is:

```sh
dotnet nuget push 'artifacts/*.nupkg' --source https://api.nuget.org/v3/index.json --api-key "$NUGET_API_KEY" --skip-duplicate
```
