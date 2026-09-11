# RibbonWeb API reference

RibbonWeb provides a native `<ribbon-web>` custom element, observable JavaScript models, commands, binding helpers, RibbonX import, and a JavaScript bridge for .NET hosts. Applications own document editing, persistence, undo history, and domain operations. The ribbon presents controls and routes their actions to that application logic.

The JavaScript API accepts plain configuration objects or model instances. camelCase is the canonical representation; PascalCase property names and the semantic aliases below support .NET-oriented code. TypeScript declarations ship with the library.

## Module entry points

| Import                              | Runtime exports                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `@wieslawsoltes/ribbon-web`         | All exports below; registers `<ribbon-web>` when Custom Elements are available        |
| `@wieslawsoltes/ribbon-web/core`    | Observable types, commands, bindings, ribbon models, normalization and lookup helpers |
| `@wieslawsoltes/ribbon-web/ribbonx` | `parseRibbonXml`, `createRibbonXAdapter`                                              |
| `@wieslawsoltes/ribbon-web/dotnet`  | `createDotNetBridge`                                                                  |

With the browser distribution, import `./dist/index.js` and retain neighboring module files. The package is ESM, and the core module has no DOM requirement. The element needs a browser with Custom Elements, Shadow DOM, and ResizeObserver. Load the element on the client in server-rendered applications. See [distribution.md](distribution.md) for installation, source builds, archives, and publishing.

## First component

```html
<ribbon-web id="editor-ribbon" theme="system"></ribbon-web>
<script type="module">
  import { RibbonModel, RelayCommand } from './dist/index.js';

  const ribbon = document.querySelector('#editor-ribbon');
  const save = new RelayCommand(() => console.log('Save the current document'));
  ribbon.model = new RibbonModel({
    id: 'editor',
    title: 'Document editor',
    quickAccessToolbar: [{ id: 'quick-save', label: 'Save', icon: 'save', command: save }],
    tabs: [
      {
        id: 'home',
        header: 'Home',
        keyTip: 'H',
        groups: [
          {
            id: 'document',
            header: 'Document',
            priority: 10,
            items: [
              {
                id: 'save',
                type: 'button',
                label: 'Save',
                icon: 'save',
                size: 'large',
                command: save,
              },
            ],
          },
        ],
      },
    ],
  });
  ribbon.addEventListener('ribbon-command', (event) => console.log(event.detail.id));
</script>
```

Use stable, unique IDs throughout a ribbon, including nested menus, Backstage, and quick-access controls. Generated IDs are convenient for temporary controls; explicit IDs support persistence, lookup, shortcuts, imported documents, and interop.

## Property naming and semantic aliases

A model's standard properties have camelCase and PascalCase accessors: `control.label` and `control.Label`, `tab.header` and `tab.Header`, `model.tabs` and `model.Tabs`. Constructor input, direct assignment, `GetProperty`, `SetProperty`, and binding paths understand these names.

| .NET-oriented name                          | Canonical property | Applicable models                                   |
| ------------------------------------------- | ------------------ | --------------------------------------------------- |
| `IsEnabled` / `isEnabled`                   | `enabled`          | Controls                                            |
| `IsVisible` / `isVisible`                   | `visible`          | Controls, tabs, groups                              |
| `IsChecked` / `isChecked`                   | `checked`          | Controls; rendered by toggle, checkbox, radio       |
| `Header` / `header`                         | `label`            | Controls; tab/group `Header` still maps to `header` |
| `ItemsSource` / `itemsSource`               | `items`            | Controls and groups                                 |
| `SelectedValue` / `selectedValue`           | `value`            | Controls                                            |
| `Text` / `text`                             | `value`            | `RibbonTextBox` and `RibbonComboBox`                |
| `SmallImageSource` / `smallImageSource`     | `icon`             | Controls                                            |
| `LargeImageSource` / `largeImageSource`     | `icon`             | Controls                                            |
| `ToolTipTitle` / `toolTipTitle`             | `tooltip`          | Controls                                            |
| `ToolTipDescription` / `toolTipDescription` | `description`      | Controls                                            |
| `KeyTip`                                    | `keyTip`           | Controls and tabs                                   |

Canonical properties win when constructor input includes both a canonical property and an alias. Explicit camelCase wins over a duplicated PascalCase canonical name. Both image-source aliases address the same `icon` value; independent small/large image resources are not stored. If both aliases are supplied without `icon`, `SmallImageSource` wins. An alias assignment emits one change for the canonical property. Serialization writes canonical names once.

```js
const bold = new RibbonToggleButton({
  Id: 'bold',
  Header: 'Bold',
  IsChecked: false,
  IsEnabled: true,
  SmallImageSource: 'bold',
  KeyTip: 'B',
});
bold.IsChecked = true;
bold.SetProperty('Header', 'Bold text');
console.log(bold.label, bold.GetProperty('IsChecked'));
```

Aliases provide familiar property semantics; the component does not instantiate WPF dependency properties, routed events, templates, CLR types, or Office automation objects.

## Ribbon structure

### `RibbonModel(options)`

| Property             | Default                                    | Meaning                                                 |
| -------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `id`                 | Generated string                           | Ribbon identity                                         |
| `tabs`               | `[]`                                       | `RibbonTab` instances or tab configuration objects      |
| `quickAccessToolbar` | `[]`                                       | Controls shown above the tabs                           |
| `backstage`          | `[]`                                       | File commands/pages; may also be an object with `items` |
| `selectedTab`        | First visible tab ID or `null`             | Selected tab ID                                         |
| `layout`             | `"classic"`                                | `"classic"` or `"simplified"`                           |
| `theme`              | `"system"`                                 | `"light"`, `"dark"`, or `"system"`                      |
| `context`            | `{}`                                       | Context ID → boolean activation map                     |
| `title`              | Element displays `"RibbonWeb"` when absent | Application/document title                              |
| `fileLabel`          | Element displays `"File"` when absent      | Backstage tab label                                     |
| `storageKey`         | Absent                                     | Optional localStorage customization key                 |

Element attributes override model layout/theme at rendering time. For interactive changes, set `ribbon.layout` and `ribbon.theme`; select tabs and activate contexts with element methods.

### `RibbonTab(options)`

| Property          | Default            | Meaning                                         |
| ----------------- | ------------------ | ----------------------------------------------- |
| `id`, `header`    | Generated ID, `""` | Identity and visible tab caption                |
| `keyTip`          | `""`               | Keyboard access sequence                        |
| `groups`          | `[]`               | `RibbonGroup` instances or group configurations |
| `visible`         | `true`             | Explicit visibility                             |
| `contextualGroup` | `null`             | Optional context ID required for visibility     |
| `contextColor`    | Theme fallback     | CSS color for contextual-tab accent             |

Activate a contextual tab with `ribbon.setContext('picture', true)`, then `ribbon.selectTab('picture-format')`. Set its `contextualGroup` to `'picture'`. Disabling the context hides the tab; the ribbon chooses an available visible tab.

### `RibbonGroup(options)`

| Property       | Default            | Meaning                                                                 |
| -------------- | ------------------ | ----------------------------------------------------------------------- |
| `id`, `header` | Generated ID, `""` | Identity and group caption                                              |
| `items`        | `[]`               | Controls; also accepts `ItemsSource`                                    |
| `priority`     | `0`                | Higher values retain a group in the ribbon longer when space is limited |
| `visible`      | `true`             | Explicit visibility                                                     |
| `launcher`     | `null`             | Function, command object, or control used by the group launcher         |

Classic layout stacks small/medium controls in columns. Large controls, galleries, separators, and custom controls occupy dedicated positions. Simplified layout uses a shorter row. Groups that do not fit move to the overflow menu; the layout does not virtualize arbitrarily large galleries or lists.

## Control configuration

All controls derive from `RibbonControl`, which derives from `ObservableObject`. `new RibbonButton(options)` sets its own type. Plain objects use `type`, for example `{ type: 'button', label: 'Save' }`. `normalizeControl` accepts documented type strings and familiar names such as `RibbonToggleButton`, `CheckBox`, and `ColorPicker`.

### Shared fields

| Field                   | Default              | Meaning                                                                     |
| ----------------------- | -------------------- | --------------------------------------------------------------------------- |
| `id`                    | Generated            | Stable command/control identity                                             |
| `type`                  | Constructor-specific | Control kind                                                                |
| `label`                 | `""`                 | Caption and default accessible label                                        |
| `icon`                  | `""`                 | Built-in icon key, text symbol, or supported image URL                      |
| `keyTip`                | `""`                 | Ribbon keyboard sequence                                                    |
| `tooltip`               | `""`                 | Screen-tip title                                                            |
| `description`           | `""`                 | Screen-tip detail and command-search text                                   |
| `command`               | `null`               | Function, `RelayCommand`, `AsyncRelayCommand`, or compatible command object |
| `commandParameter`      | `undefined`          | Explicit value passed to command execution                                  |
| `enabled`, `visible`    | `true`, `true`       | Availability and rendering flags                                            |
| `checked`               | `false`              | Toggle/check/radio state                                                    |
| `value`                 | `""`                 | Text, selection, numeric, or color state                                    |
| `items`                 | `[]`                 | Nested controls or selection/gallery options                                |
| `size`                  | `"medium"`           | `"small"`, `"medium"`, or `"large"`                                         |
| `bindings`              | `null`               | Property → source path/binding map                                          |
| `shortcut`              | Absent               | Combination such as `"Ctrl+S"` or `"Meta+S"`                                |
| `allowInInput`          | `false` when absent  | Permit the shortcut while editing text fields                               |
| `showLabel`, `showIcon` | Shown when absent    | Caption/icon presentation flags                                             |
| `onChange`              | Absent               | `(value, control)` callback after a control-state change                    |

### Available controls

| Constructor           | `type`      | Additional configuration and behavior                                                            |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `RibbonButton`        | `button`    | Executes a command                                                                               |
| `RibbonToggleButton`  | `toggle`    | Toggles `checked`; exposes pressed state                                                         |
| `RibbonCheckBox`      | `checkbox`  | Toggles `checked`; exposes checkbox semantics                                                    |
| `RibbonRadioButton`   | `radio`     | Selects itself and clears controls sharing `groupName`; provide an explicit group name           |
| `RibbonSplitButton`   | `split`     | Primary command plus separate menu arrow; `items` or `getItems` supply menu contents             |
| `RibbonMenuButton`    | `menu`      | Opens a nested command menu                                                                      |
| `RibbonMenuItem`      | `menuitem`  | Menu command or submenu with `items`                                                             |
| `RibbonTextBox`       | `textbox`   | Text `value`; `placeholder`, `maxLength`, `width`, `validate`, `validationMessage`               |
| `RibbonComboBox`      | `combobox`  | Editable text with datalist suggestions in `items`; `Text` aliases `value`                       |
| `RibbonDropDown`      | `dropdown`  | Native selection control backed by `items`                                                       |
| `RibbonSpinner`       | `spinner`   | Native numeric input; `min: 0`, `max: 100`, `step: 1` defaults                                   |
| `RibbonSlider`        | `slider`    | Native range input; same numeric defaults; emits live preview during input                       |
| `RibbonGallery`       | `gallery`   | Inline options and popup gallery; `inlineCount`, `columns`, categorized items, preview callbacks |
| `RibbonColorPicker`   | `color`     | Native color input; use a browser-compatible color value such as `"#2458c6"`                     |
| `RibbonSeparator`     | `separator` | Visual and semantic separator                                                                    |
| `RibbonLabel`         | `label`     | Noninteractive text                                                                              |
| `RibbonCustomControl` | `custom`    | `render({ control, ribbon, document })` returning a DOM Node, or a named `slot`                  |

Text/numeric controls commit on native `change`. Sliders and color controls additionally emit `ribbon-preview` during `input`. `validate(value)` returns a boolean and `validationMessage` supplies the browser validation text. Numeric bounds and steps use native input attributes; domain validation remains the host application's responsibility.

Menu children are normalized as controls. Dropdown, combo, and gallery option objects are retained as option data. Prefer lower camelCase option fields:

```js
const fontSize = new RibbonDropDown({
  id: 'font-size',
  label: 'Size',
  value: '12',
  items: [
    { label: '10 pt', value: '10' },
    { label: '12 pt', value: '12' },
  ],
});
const styles = new RibbonGallery({
  id: 'styles',
  label: 'Styles',
  value: 'body',
  inlineCount: 3,
  columns: 4,
  items: [
    { id: 'body', value: 'body', label: 'Body', category: 'Text', preview: 'AaBb' },
    {
      id: 'title',
      value: 'title',
      label: 'Title',
      category: 'Headings',
      preview: 'Title',
      style: { fontSize: '24px', fontWeight: '600', color: '#2458c6' },
    },
  ],
  preview(value) {
    console.log('Temporary style:', value);
  },
  cancelPreview() {
    console.log('Restore original style');
  },
});
```

Gallery item fields include `id`, `value`, `label`, `icon`, `category`, and preview text. Supported preview style properties are `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `backgroundColor`, `textDecoration`, `textAlign`, and `borderColor`. Store the host's original state when preview begins and restore it when preview ends without commitment.

Dynamic menus may supply `getItems(control)`, returning controls or a promise of controls. Errors emit `ribbon-error`. Keep the owner control's `items` updated if dynamic children must also participate in global ID lookup and command search.

### Custom DOM and slots

```html
<ribbon-web id="ribbon">
  <button slot="account">Account settings</button>
</ribbon-web>
```

```js
const account = new RibbonCustomControl({ id: 'account', slot: 'account' });
const status = new RibbonCustomControl({
  id: 'status',
  render({ document }) {
    const label = document.createElement('span');
    label.textContent = 'All changes saved';
    return label;
  },
});
```

Put these controls in a group's `items`. Return DOM nodes from `render`; markup strings are not inserted as HTML. Rendering can be repeated, so keep application state outside temporary rendered nodes. A slot is useful when the host framework owns the custom control's DOM.

## Observable state

### `EventSource`

`subscribe(listener)` / `Subscribe(listener)` returns an idempotent subscription handle. Call it as a function, use `.dispose()`, or use `.Dispose()`. `emit(...args)` / `Emit(...args)` synchronously calls listeners. `clear()` removes listeners; `count` reports their count. Listener exceptions propagate to the caller.

### `ObservableObject(initial)`

Initial properties receive observable accessors. `SetProperty(name, value)` returns `true` when the value changed and `false` for `Object.is` equality. `GetProperty(name)` reads a property. `get(path)` / `set(path, value)` accept dot-separated paths and understand aliases on nested observable models. Setting a missing parent path throws; create that parent first.

`PropertyChanged` / `propertyChanged` emits one event object:

```js
viewModel.PropertyChanged.subscribe((event) => {
  console.log(event.propertyName, event.oldValue, event.newValue);
  // Also available: sender, name, value, Sender, PropertyName, OldValue, NewValue.
});
```

`propertyName` uses canonical camelCase; `PropertyName` uses its PascalCase form. Alias writes do not create duplicate events. Plain nested records are not proxy-observed: change them using the parent's `set(path, value)`, replace the record, or use nested `ObservableObject` instances.

`toJSON()` produces canonical configuration data and omits runtime functions, commands, and event sources. Rehydrate application commands explicitly after deserialization. Circular configuration data throws.

### `ObservableCollection(items)`

| Members                                   | Behavior                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `Add` / `add`                             | Append; returns new item index                                      |
| `Insert` / `insert`                       | Insert at a validated index                                         |
| `Remove` / `remove`                       | Remove an item; returns whether it existed                          |
| `RemoveAt` / `removeAt`                   | Remove and return item at a validated index                         |
| `Move` / `move`                           | Move between validated indices                                      |
| `SetItem` / `setItem`                     | Replace one item                                                    |
| `Clear` / `clear`                         | Remove all items                                                    |
| `Count`, `count`, `length`                | Item count                                                          |
| `Items`, `items`                          | Snapshot arrays; mutating a snapshot does not change the collection |
| Iterator, `at`, `map`, `forEach`          | Read access                                                         |
| `CollectionChanged` / `collectionChanged` | Synchronous collection notifications                                |
| `PropertyChanged` / `propertyChanged`     | Count notifications                                                 |

Collection events contain `action`, `newItems`, `oldItems`, `index`, and `oldIndex`; PascalCase fields include `Action`, `NewItems`, `OldItems`, `NewStartingIndex`, and `OldStartingIndex`. Actions are add, remove, move, replace, and reset.

Collection-backed ribbon fields expose renderer-friendly arrays and mirror mutations from their supplied `ObservableCollection`. Existing normalized model identities survive insertions and removals. Later assignment detaches the old source and normalizes the replacement.

```js
const commands = new ObservableCollection([{ id: 'save', label: 'Save' }]);
const group = new RibbonGroup({ Header: 'Document', ItemsSource: commands });
commands.Add({ id: 'print', label: 'Print', icon: 'print' });
group.items[0].IsEnabled = false;
// Release this model's source-collection subscriptions when its owner is disposed:
group.Dispose();
```

`dispose()` / `Dispose()` on an observable model detaches that model's managed collection subscriptions. It does not recursively dispose independently owned children, commands, external event subscriptions, or host application services. Disconnecting the element removes its view subscriptions; application-owned model lifetimes remain with the application.

## Commands and execution

`RelayCommand(execute, canExecute = () => true)` supplies `Execute(parameter)`, `CanExecute(parameter)`, `CanExecuteChanged`, and `NotifyCanExecuteChanged()`, with corresponding lowercase aliases. Disabled execution returns `undefined`; successful execution returns the callback result. Errors propagate from the command itself.

```js
let dirty = false;
const save = new RelayCommand(
  (documentId) => saveDocument(documentId),
  () => dirty,
);
function documentChanged() {
  dirty = true;
  save.NotifyCanExecuteChanged();
}
```

`AsyncRelayCommand(execute, canExecute)` passes `(parameter, AbortSignal)` to the callback. It exposes `IsRunning`, `IsCancellationRequested`, `Error`, their camelCase equivalents, and property notifications. Concurrent `Execute()` calls share one pending promise; `CanExecute()` is false during execution. `Cancel()` / `cancel()` aborts the signal. Cancellation is cooperative: the callback must observe or pass the signal to its asynchronous operation. Errors reject the promise; running state is restored in `finally`.

```js
const exportDocument = new AsyncRelayCommand(async (documentId, signal) => {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/export`, {
    signal,
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.blob();
});
const running = exportDocument.Execute('document-1');
// exportDocument.Cancel();
try {
  await running;
} catch (error) {
  console.error(error);
}
```

Controls also accept a function `(parameter, control) => result`, or an object with `Execute`/`CanExecute` or `execute`/`canExecute`. Set `commandParameter` when `CanExecute` depends on a parameter. Without an explicit parameter, a committed input value can be passed to execution; the availability check occurs before that future value exists.

The element's `execute(idOrControl, value)` is asynchronous. It checks availability, emits cancelable `ribbon-command-executing`, applies toggle/radio/value changes, invokes the command, waits for returned promises, and emits `ribbon-command`. `event.preventDefault()` cancels execution before state changes. Element execution returns `true` on completion or `false` for unavailable/canceled/failed execution; failures emit `ribbon-error`. The underlying command classes retain their own exception-propagation behavior. Domain-level rollback after a failed command belongs to the application.

## Bindings and MVVM

`Binding(path, options)` supports `mode: 'OneWay' | 'TwoWay' | 'OneTime'`; the default is `OneWay`. Options accept PascalCase equivalents. A converter may be a function or an object with `convert` / `Convert` and `convertBack` / `ConvertBack`. Standalone `bind` also passes `converterParameter` and supports `fallbackValue` when a source path resolves to `undefined`.

```js
const vm = new ObservableObject({ bold: false, fontName: 'Serif' });
const bold = new RibbonToggleButton({
  Header: 'Bold',
  Bindings: { IsChecked: new Binding('bold', { Mode: 'TwoWay' }) },
});
const font = new RibbonComboBox({
  Header: 'Font',
  ItemsSource: ['Serif', 'Sans', 'Monospace'],
  Bindings: { Text: new Binding('fontName', { Mode: 'TwoWay' }) },
});
ribbon.dataContext = vm;
```

Add those controls to the ribbon model. The element resolves `bindings` against `dataContext`; commonly bound properties are `enabled`, `visible`, `checked`, `value`, `label`, `icon`, `command`, and `commandParameter`. Constructor and reassigned binding maps accept canonical, PascalCase, and semantic alias keys. Use explicit `Binding` instances and modes for predictable application code.

The element's path-only shorthand, such as `bindings: { checked: 'bold' }`, reads the source and writes interactive changes back. A binding object with no mode has the same element-level shorthand behavior. A `new Binding(path)` explicitly carries `OneWay` and does not write back. The element resolves display values during rendering; it does not implement the standalone helper's full OneTime/fallback/converter-parameter lifecycle. Use `bind()` for those semantics:

```js
const percentage = new RibbonSlider({ min: 0, max: 100 });
const vm = new ObservableObject({ opacity: 0.5 });
const connection = bind(
  percentage,
  'SelectedValue',
  vm,
  new Binding('opacity', {
    mode: 'TwoWay',
    converter: {
      Convert: (value) => value * 100,
      ConvertBack: (value) => value / 100,
    },
  }),
);
// Later: connection.dispose();
```

`bind(target, targetProperty, source, binding)` performs the initial transfer, observes source changes and nested observable replacements, and watches target changes in TwoWay mode. DOM targets use `input` and `change`; plain JavaScript targets can be refreshed with `connection.updateSource()` / `updateTarget()`. Its disposable return value removes every subscription. Binding paths are property paths, not evaluated JavaScript expressions.

## Element properties, methods, and attributes

| Member                                                     | Purpose                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `model` / `Model`                                          | Assign model/configuration; getter returns normalized model                                 |
| `dataContext` / `DataContext`                              | Source object for control binding maps                                                      |
| `selectedTab` / `SelectedTab`                              | Selected tab ID; assigning selects an available tab                                         |
| `layout`                                                   | `classic` or `simplified`                                                                   |
| `theme`                                                    | `light`, `dark`, or `system`                                                                |
| `minimized`                                                | Boolean; tab selection can temporarily show a floating panel                                |
| `selectTab(id)` / `ActivateTab(id)`                        | Select an available tab; boolean result                                                     |
| `setContext(name, active = true)` / `SetContext(...)`      | Set contextual-tab activation                                                               |
| `getControl(id)` / `GetControl(id)`                        | Find a control, including nested controls; returns `undefined` when absent                  |
| `updateControl(id, changes)` / `UpdateControl(...)`        | Apply observable changes; throws for an unknown ID                                          |
| `addTab(tab, index?)` / `AddTab(...)`                      | Normalize and insert a tab; returns the tab; duplicate tab IDs throw                        |
| `removeTab(id)` / `RemoveTab(id)`                          | Remove a tab; returns whether it existed                                                    |
| `addGroup(tabId, group, index?)` / `AddGroup(...)`         | Normalize and insert a group into a known tab; returns the group                            |
| `addControl(groupId, control, index?)` / `AddControl(...)` | Normalize and insert a control into a known group; returns the control; duplicate IDs throw |
| `removeControl(id)` / `RemoveControl(id)`                  | Remove a direct group control and its quick-access entry; returns whether it existed        |
| `setQuickAccess(ids)`                                      | Replace quick-access IDs; deduplicates and retains known controls                           |
| `addToQuickAccess(id)`, `removeFromQuickAccess(id)`        | Add or remove a quick-access entry                                                          |
| `moveQuickAccess(id, index)`                               | Move an existing quick-access entry; boolean result                                         |
| `execute(idOrControl, value?)` / `Execute(...)`            | Execute a command control; returns `Promise<boolean>`                                       |
| `invalidate()` / `Invalidate()`                            | Rebuild view subscriptions and schedule rendering after externally managed mutations        |
| `requestRender()`                                          | Schedule a batched render                                                                   |
| `render()`                                                 | Immediate rendering; normally use requestRender/invalidate                                  |
| `openBackstage(id?)`, `closeBackstage()`                   | File/backstage surface                                                                      |
| `openSearch(anchor?)`                                      | Command search                                                                              |
| `showContextMenu(items, { x, y })`                         | Popup menu of controls/configurations/known control IDs                                     |
| `showMiniToolbar(items, { x, y })`                         | Horizontal selection toolbar                                                                |
| `closePopup(restoreFocus = true)`                          | Close the current popup                                                                     |
| `openQuickAccessMenu()`                                    | Quick-access customization                                                                  |
| `openCustomization()`                                      | Tab/group visibility, naming, ordering interface                                            |
| `exportCustomization()`                                    | Versioned customization object                                                              |
| `importCustomization(data)`                                | Apply a version-1 customization object                                                      |
| `saveCustomization()`                                      | Export and persist when a storage key exists                                                |
| `loadCustomization()`                                      | Load configured localStorage customization                                                  |
| `resetCustomization()`                                     | Reset visibility/QAT/minimized state and classic layout                                     |

`theme`, `layout`, `density`, `dir`, and `minimized` are observed attributes. Use `density="touch"` for larger targets; use `dir="rtl"` for RTL layout. `minimized` is a boolean attribute: remove it or set the property to false to expand. `storage-key` selects the optional localStorage key. Stable model IDs are required for meaningful saved customization across sessions.

Customization version 1 includes `selectedTab`, `layout`, `theme`, `minimized`, hidden tab/group IDs, quick-access IDs, tab order/labels, and per-tab group order. Visibility reset does not restore application-supplied tab names or ordering; retain an original configuration if a complete factory reset is required.

Insertion methods accept plain configurations or model instances and schedule rendering. `removeControl` currently targets controls directly contained in a group; replace a menu's `items` or mutate its `ObservableCollection` to remove nested entries. If a group/tab is driven by an application-owned `ObservableCollection`, mutate that source collection so later source updates retain the application's intended order. Quick-access methods save customization when storage is configured.

### DOM events

All library DOM events bubble and cross the shadow boundary. Read `event.detail`.

| Event                         | Detail                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `ribbon-command-executing`    | `{ id, value, parameter, control }`; cancelable                                     |
| `ribbon-command`              | `{ id, value, parameter, control }`; completed action; toggles report checked state |
| `ribbon-change`               | `{ id, property, value }`; canonical property name                                  |
| `ribbon-tab-change`           | `{ id }`                                                                            |
| `ribbon-context-change`       | `{ name, active }`                                                                  |
| `ribbon-backstage-change`     | `{ open, id? }`                                                                     |
| `ribbon-preview`              | `{ id, value, item? }`                                                              |
| `ribbon-preview-end`          | `{ id, committed, value? }`                                                         |
| `ribbon-launcher`             | `{ id }`; group ID                                                                  |
| `ribbon-customization-change` | Customization object                                                                |
| `ribbon-error`                | `{ id?, error }`                                                                    |
| `ribbon-storage-error`        | `{ error }`                                                                         |
| `ribbon-dotnet-error`         | `{ error, event }`; failed interop payload                                          |

TypeScript exports `RibbonEventMap` and typed `addEventListener` overloads. Standard browser events remain available.

## Keyboard and accessibility

Tabs expose tablist/tab/tabpanel relationships; controls expose button, checkbox, radio, menu, option, and listbox semantics as applicable. Native inputs retain browser editing behavior. Arrow keys, Home, and End move within supported tab/control collections; Escape closes popups or Backstage. Alt or F10 enters key-tip navigation, Alt+Q opens search, and Ctrl+F1 changes minimized state. The quick-access toolbar assigns numeric key tips. Browser/operating-system shortcuts can take precedence.

Provide visible labels, meaningful tooltips, unique key tips within each scope, and distinct radio `groupName` values. Review custom controls, custom colors, long translated labels, and keyboard workflows in the actual host application. The component supports forced-color and reduced-motion media settings; these affordances are not a formal accessibility certification.

## Styling and icons

The component owns an open shadow root. Public CSS parts are `ribbon`, `panel`, `group`, and `control`.

```css
ribbon-web {
  --rw-accent: #6b46c1;
  --rw-active: #ece5ff;
  --rw-border: #d8d3e5;
}
ribbon-web::part(ribbon) {
  border-radius: 0;
}
ribbon-web::part(group) {
  padding-inline: 12px;
}
```

| CSS variable   | Purpose                          | Light default           |
| -------------- | -------------------------------- | ----------------------- |
| `--rw-accent`  | Selected state and focus accents | `#2458c6`               |
| `--rw-bg`      | Base/control background          | `#fff`                  |
| `--rw-surface` | Secondary surface                | `#f6f7fa`               |
| `--rw-hover`   | Hover background                 | `#e8edf6`               |
| `--rw-active`  | Pressed/selected background      | `#dce7fc`               |
| `--rw-text`    | Primary text                     | `#242830`               |
| `--rw-muted`   | Secondary text                   | `#616875`               |
| `--rw-border`  | Borders and dividers             | `#dce0e7`               |
| `--rw-shadow`  | Popup/floating shadow            | `0 10px 36px #16264324` |
| `--rw-context` | Contextual tab accent            | Fallback `#ab529b`      |

Dark and system themes supply corresponding overrides. A tab's `contextColor` sets its contextual accent directly. Gallery popup columns are controlled by the gallery's `columns` field.

`createIcon(name, document?)` returns an `HTMLSpanElement`. Built-in keys are `clipboard`, `copy`, `cut`, `save`, `undo`, `redo`, `search`, `bold`, `italic`, `underline`, `left`, `center`, `right`, `justify`, `list`, `table`, `image`, `chart`, `link`, `comment`, `page`, `slides`, `shape`, `brush`, `delete`, `settings`, `print`, `download`, `paint`, `sort`, `filter`, `check`, `close`, `plus`, `play`, `grid`, `formula`, `color`, `indent`, `full`, and `clock`. Icons use original geometric paths. Unknown names display as text symbols. Supported image forms include HTTP(S), relative/root-relative URLs, and raster PNG/JPEG/WebP/GIF data URLs.

## Native use in frameworks

These examples use the same custom element and native events. They do not introduce framework-specific wrapper packages. Keep model objects stable between ordinary renders and use observable updates or explicit replacements for state changes.

### React 19

Use a ref to assign object properties and native event listeners, with cleanup on unmount. This follows React's custom-element/property and ref model. [React custom elements](https://react.dev/reference/react-dom/components#custom-html-elements)

```jsx
import { useEffect, useRef } from 'react';
import '@wieslawsoltes/ribbon-web';

export function EditorRibbon({ model, viewModel, onCommand }) {
  const ribbonRef = useRef(null);
  useEffect(() => {
    ribbonRef.current.model = model;
  }, [model]);
  useEffect(() => {
    ribbonRef.current.dataContext = viewModel;
  }, [viewModel]);
  useEffect(() => {
    const ribbon = ribbonRef.current;
    const listener = (event) => onCommand?.(event.detail);
    ribbon.addEventListener('ribbon-command', listener);
    return () => ribbon.removeEventListener('ribbon-command', listener);
  }, [onCommand]);
  return <ribbon-web ref={ribbonRef} theme="system" />;
}
```

For a TypeScript React application, declare the custom JSX tag in that application:

```ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { RibbonElement, RibbonTheme } from '@wieslawsoltes/ribbon-web';
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ribbon-web': DetailedHTMLProps<HTMLAttributes<RibbonElement>, RibbonElement> & {
        theme?: RibbonTheme;
      };
    }
  }
}
```

### Vue 3

Mark the tag as a custom element at template compilation and assign complex values as properties. The `.prop` modifier makes the intended assignment explicit. [Vue custom elements](https://vuejs.org/guide/extras/web-components.html)

```js
// vite.config.js: options passed to @vitejs/plugin-vue
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'ribbon-web' } } });
```

```vue
<script setup>
import { shallowRef } from 'vue';
import '@wieslawsoltes/ribbon-web';
const props = defineProps(['model', 'viewModel']);
const emit = defineEmits(['command']);
const ribbon = shallowRef(null);
</script>

<template>
  <ribbon-web
    ref="ribbon"
    :model.prop="props.model"
    :dataContext.prop="props.viewModel"
    theme="system"
    @ribbon-command="emit('command', $event.detail)"
  />
</template>
```

Keep RibbonWeb model instances outside deep Vue proxy wrapping; use stable objects or `shallowRef`/`markRaw` at the application boundary. Call `ribbon.value.selectTab('home')` through the native ref when needed.

### Angular

Allow the custom element with `CUSTOM_ELEMENTS_SCHEMA`. This example assigns the model through its native `ElementRef` and cleans up the event listener. [Angular custom-element schema](https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA)

```ts
import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { RibbonElement, RibbonModel } from '@wieslawsoltes/ribbon-web';

@Component({
  selector: 'app-editor-ribbon',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: '<ribbon-web #ribbon theme="system"></ribbon-web>',
})
export class EditorRibbonComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ribbon', { static: true }) ribbon!: ElementRef<RibbonElement>;
  readonly model = new RibbonModel({ tabs: [{ id: 'home', header: 'Home', groups: [] }] });
  private readonly onCommand = (event: Event) => console.log((event as CustomEvent).detail);
  ngAfterViewInit() {
    const element = this.ribbon.nativeElement;
    element.model = this.model;
    element.addEventListener('ribbon-command', this.onCommand);
  }
  ngOnDestroy() {
    this.ribbon.nativeElement.removeEventListener('ribbon-command', this.onCommand);
  }
}
```

Import the element on the browser side when using Angular server rendering. Update observable properties on the retained model, or explicitly replace `element.model` when the application switches documents.

## Remaining exports and interop

| Export                                                   | Purpose                                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeRibbon(config)`                                | Normalize plain ribbon configuration; preserves an existing `RibbonModel` instance                                               |
| `normalizeControl(config, defaultType = 'button')`       | Normalize one control; preserves an existing control; unknown types throw                                                        |
| `traverseControls(model)`                                | Generator over controls in QAT, Backstage, tabs/groups, nested menus, and model control launchers; deduplicates shared instances |
| `findControl(model, id)`                                 | First matching control or `undefined`                                                                                            |
| `RibbonElement`                                          | Custom-element class                                                                                                             |
| `registerRibbon(tagName = 'ribbon-web')`                 | Idempotent registration; returns registered constructor or `undefined` without a Custom Elements registry                        |
| `parseRibbonXml(xml, callbacks?, options?)`              | Import supported RibbonX vocabulary into configuration                                                                           |
| `createRibbonXAdapter(xml, callbacks?, options?)`        | Import with attach/invalidation API                                                                                              |
| `createDotNetBridge(element, dotNetReference, options?)` | Ordered JSON-safe event forwarding and host update methods                                                                       |
| `createIcon(name, document?)`                            | Create a geometric/text/image icon node                                                                                          |

The full RibbonX callback map, supported XML vocabulary, import warnings, adapter disposal, .NET bridge payload, and Blazor source-wrapper examples are documented in [interop.md](interop.md). Use stable IDs and serializable DTOs across .NET interop; native JavaScript command objects and DOM nodes are not serialized as application objects.

A custom registration name renders the same component, but document-level shortcut routing currently discovers the default `ribbon-web` tag when no ribbon owns keyboard focus. For applications depending on global shortcuts, use the default tag.
