# RibbonWeb

A standalone ribbon Web Component for browser applications and .NET application ports. Native JavaScript modules, zero runtime dependencies, TypeScript declarations, observable models, and familiar `ICommand` / MVVM patterns.

[Interactive workspace](https://wieslawsoltes.github.io/RibbonWeb/examples/) · [MVVM example](https://wieslawsoltes.github.io/RibbonWeb/examples/mvvm.html) · [RibbonX example](https://wieslawsoltes.github.io/RibbonWeb/examples/ribbonx.html) · [Releases](https://github.com/wieslawsoltes/RibbonWeb/releases) · [API reference](docs/api.md) · [Compatibility](docs/compatibility.md)

## What is included

- **Ribbon structure:** tabs, groups, contextual tabs, group launchers, quick access toolbar, File/backstage pages, selection context menus, and mini toolbars.
- **Controls:** buttons, toggles, checkboxes, radio buttons, split buttons, nested and dynamic menus, text boxes, editable combo boxes, dropdowns, numeric spinners, sliders, color pickers, categorized galleries, separators, labels, and custom DOM/slot content.
- **Interaction:** classic and simplified layouts, minimization, responsive overflow, command search, keyboard shortcuts, Alt/F10 key tips, arrow navigation, tooltip descriptions, preview/commit/cancel gallery events, touch density, RTL, light/dark/system themes, forced colors, and reduced motion.
- **Personalization:** tab/group visibility, order and tab labels; quick-access commands; JSON import/export and optional browser persistence.
- **MVVM:** `ObservableObject`, `ObservableCollection`, `RelayCommand`, cancellable `AsyncRelayCommand`, `CanExecuteChanged`, nested one-way/two-way bindings, converters, collection updates, and disposable subscriptions.
- **Interop:** a documented RibbonX subset with registered callbacks and invalidation; a Blazor bridge and wrapper; native Web Component integration with standard frameworks.
- **Distribution:** ESM package, declarations, npm tarball, browser and source ZIPs, checksums, CI, GitHub Pages deployment, GitHub releases, and optional npm / GitHub Packages publishing.

RibbonWeb is an independent implementation of ribbon interaction patterns. It is **not a drop-in implementation of every WPF, Office RibbonX, or Office.js API**, and does not provide the Word, Excel, or PowerPoint document engines. The [capability matrix](docs/compatibility.md) describes implemented surfaces, translations, and remaining boundaries. No Microsoft runtime or proprietary assets are bundled.

## Run the source

```sh
git clone https://github.com/wieslawsoltes/RibbonWeb.git
cd RibbonWeb
npm ci
npm start
```

Open the address printed by the server. The component itself can run without npm or a build step: serve the repository with any HTTP server and open `examples/index.html`. Use HTTP(S), since browser module loading does not work reliably from `file://` URLs.

## Install a release

Download the `.tgz` or browser ZIP from [GitHub Releases](https://github.com/wieslawsoltes/RibbonWeb/releases). The tarball is an installable npm package:

```sh
npm install ./wieslawsoltes-ribbon-web-0.1.0.tgz
```

Registry publishing is configured but depends on repository credentials. Only use `npm install @wieslawsoltes/ribbon-web` after confirming that the package has been published to the chosen registry. Browser ZIP users should keep all modules together; the package is modular ESM, not a single global script.

## Ordinary web application

```html
<ribbon-web id="commands" theme="light"></ribbon-web>
<script type="module">
  // npm/bundler users: import '@wieslawsoltes/ribbon-web';
  import './dist/index.js';

  const ribbon = document.querySelector('#commands');
  ribbon.model = {
    tabs: [
      {
        id: 'home',
        header: 'Home',
        keyTip: 'H',
        groups: [
          {
            id: 'document',
            header: 'Document',
            items: [
              {
                id: 'save',
                type: 'button',
                label: 'Save',
                icon: 'save',
                size: 'large',
                keyTip: 'S',
                command: () => saveDocument(),
              },
            ],
          },
        ],
      },
    ],
  };

  ribbon.addEventListener('ribbon-command', (event) => {
    console.log(event.detail.id, event.detail.value);
  });

  function saveDocument() {
    /* persist application data here */
  }
</script>
```

Models can also be authored as light-DOM definitions:

```html
<ribbon-web id="declarative">
  <ribbon-tab id="home" header="Home" key-tip="H">
    <ribbon-group id="file" header="File">
      <ribbon-button id="save" label="Save" icon="save" size="large" key-tip="S"></ribbon-button>
    </ribbon-group>
  </ribbon-tab>
</ribbon-web>
```

The element reads declarative definitions when first connected. Handle the bubbling `ribbon-command` event or assign a command with `updateControl('save', { command })`. Subsequent model changes use the object API. Definition tags are configuration, not individually registered interactive elements.

## .NET-style MVVM

```js
import {
  ObservableObject,
  RelayCommand,
  RibbonModel,
  RibbonTab,
  RibbonGroup,
  RibbonToggleButton,
  RibbonButton,
} from '@wieslawsoltes/ribbon-web';

const vm = new ObservableObject({ Bold: false, CanSave: true });
const save = new RelayCommand(
  () => persistDocument(),
  () => vm.CanSave,
);
vm.PropertyChanged.subscribe(() => save.NotifyCanExecuteChanged());

ribbon.DataContext = vm;
ribbon.Model = new RibbonModel({
  Tabs: [
    new RibbonTab({
      Id: 'home',
      Header: 'Home',
      KeyTip: 'H',
      Groups: [
        new RibbonGroup({
          Id: 'font',
          Header: 'Font',
          Items: [
            new RibbonToggleButton({
              Id: 'bold',
              Label: 'Bold',
              Icon: 'bold',
              KeyTip: 'B',
              Bindings: { checked: { path: 'Bold', mode: 'TwoWay' } },
            }),
            new RibbonButton({ Id: 'save', Label: 'Save', Command: save }),
          ],
        }),
      ],
    }),
  ],
});

vm.Bold = true; // updates the view
// Clicking Bold writes back into vm.Bold.
```

CamelCase and PascalCase constructors/properties share the same underlying values. View models remain application-owned. A plain JavaScript object is also accepted as `dataContext`; call `ribbon.invalidate()` after external changes to a plain object.

For standalone binding outside the component:

```js
const detach = bind(inputElement, 'value', vm, new Binding('Title', { mode: 'TwoWay' }));
detach(); // also detach.dispose() / detach.Dispose()
```

Use `AsyncRelayCommand` for asynchronous operations. It exposes `IsRunning`, `IsCancellationRequested`, `Cancel()`, and an `AbortSignal` passed as the second argument to the execute callback. The application must observe that signal to cancel its own operation.

## Framework and .NET integration

The Web Component works directly with DOM properties and custom events. Use a ref to assign `model`/`dataContext` in React; property binding in Vue; `CUSTOM_ELEMENTS_SCHEMA` plus property binding in Angular. See [API and framework examples](docs/api.md).

[Interop documentation](docs/interop.md) includes RibbonX import, callbacks, invalidation, a data-only `createDotNetBridge`, and the Blazor wrapper. RibbonX callback names resolve only from the functions explicitly registered by the application. Native `idMso` commands and artwork must be supplied by the host; parsing XML does not implement document commands.

## Samples

| Example                          | Demonstrated behavior                                                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Workspace](examples/index.html) | Document text formatting/insertion, a workbook with editable cells and a small safe formula parser, presentation slides, three ribbon profiles, context tools, all control categories, layout/theming, customization, local saves and exports |
| [MVVM](examples/mvvm.html)       | Observable state, two-way text and checked bindings, command availability, asynchronous save, live collection updates                                                                                                                         |
| [RibbonX](examples/ribbonx.html) | Editable RibbonX, explicit callback registry, dynamic menus, invalidation, selection state, warnings                                                                                                                                          |

The sample editors are compact hosts for exercising ribbon commands. Their HTML/CSV/JSON exports are not DOCX/XLSX/PPTX file-format implementations. They do not provide full editing, formula, layout or application compatibility.

## Verification and builds

```sh
npm run check          # syntax and strict public type checks
npm test               # observable, command, binding, bridge and packaging tests
npx playwright install chromium
npm run test:browser   # real Chromium interactions, screenshots and JSON report
npm run build          # dist/ modules and declarations
npm run release:pack   # artifacts/ tarball, ZIPs, manifest and checksums
npm run build:site     # site/ showcase, API docs and downloads
```

GitHub CI runs Node 22/24, Chromium tests, package construction, and the .NET wrapper build. See [distribution and release instructions](docs/distribution.md). GitHub Pages is built from `main`; release tags use `v<package version>`.

## Architecture

| Module                           | Responsibility                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/core.js`                    | DOM-independent observable models, collections, commands, bindings and normalization                     |
| `src/ribbon.js`                  | Shadow-DOM Web Component, rendering, command routing, interaction, adaptive overflow and personalization |
| `src/styles.js`, `src/icons.js`  | Scoped CSS tokens and original geometric UI icons                                                        |
| `src/ribbonx.js`                 | Safe XML parsing, explicit callbacks and invalidation adapter                                            |
| `src/dotnet.js`, `dotnet/`       | Data-only JS/.NET bridge and Razor wrapper                                                               |
| `examples/`                      | Independent browser hosts showcasing the library                                                         |
| `scripts/`, `.github/workflows/` | Dependency-free builds, archives, static serving, CI and publishing                                      |

Only the selected tab renders its controls. State updates batch into microtasks. A `ResizeObserver` maintains overflow, and listeners are detached on disconnection. The rendering strategy rebuilds the selected panel on state changes and restores focused inputs; it is not a virtualized or incremental DOM engine. Very large tabs and galleries should be measured against application workloads.

MIT licensed. See [LICENSE](LICENSE).
