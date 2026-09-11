# RibbonWeb compatibility and capability matrix

RibbonWeb is an independent web implementation informed by public ribbon documentation. There is no single published “Office 365 Ribbon control API”: WPF Ribbon controls, RibbonX host extensibility, and Office.js commands are different APIs. The matrix describes this release without equating similarly named classes to framework-wide compatibility.

## Implemented library surfaces

| Surface | Included behavior | Scope and limits |
| --- | --- | --- |
| Tabs and groups | Ordered groups, visibility, contextual sets, selected tab, group launcher | Context is supplied by the host; native document selection is not inferred |
| Adaptive layout | Classic and simplified layouts, minimized panel, priority-based group overflow | No WPF measure/arrange engine or exact Office group-size algorithm |
| Actions | Button, toggle, check, radio, split, menu, nested menu, dynamic provider | Application owns action semantics and command data |
| Inputs | Text, editable combo, dropdown, numeric spinner, slider, color | Native browser popup/input behavior differs by platform; no full native Office font picker |
| Galleries | Inline items, popup grid, categories, selected value, preview/end events and item styles | Eager rendering; no virtualized thousands-item gallery or arbitrary WPF DataTemplate engine |
| Custom content | DOM renderer callback and named slots | Caller owns safety, focus behavior and cleanup of its custom nodes |
| Quick access | Shared commands, command chooser and stored selection | Application controls initial command list |
| Backstage | Navigation, command items, content callbacks and slots | Rich RibbonX backstage schema translation is incomplete |
| Context surfaces | Application-opened context menu and mini toolbar | Not automatic integration into external editors |
| Keyboard | Alt/F10 key tips, Alt+Q search, command shortcuts, tab/menu/control arrows, Home/End, Escape | Browser/OS-reserved shortcuts can take precedence; assistive-technology certification not claimed |
| Appearance | Light, dark, system, touch density, RTL, CSS tokens/parts, forced-colors rules | Original icons and styling; no proprietary Office assets or pixel-exact theme guarantee |
| Personalization | Tab/group visibility and order, tab labels, quick-access choices, import/export, local persistence | Saved schema version 1; does not consume native Office customization files |
| MVVM | Observable properties/collections, nested binding, converters, notifications, command gating, async cancellation | No CLR, dependency-property system, routed-event system, XAML engine or complete WPF binding language |
| Web usage | Native custom element, JSON/object models, DOM events, TypeScript | Framework examples use native integration rather than separate framework component implementations |
| .NET usage | JS bridge, ICommand routing, Blazor wrapper source and build project | Browser runtime remains JavaScript; arbitrary .NET UI binaries are not loaded |
| RibbonX | Common controls/callbacks, dynamic content, invalidation, contextual tabs | See [the detailed importer mapping](interop.md); unsupported features report warnings |
| Office.js | Comparable ribbon command patterns | No `Office` global or Office.js host implementation |

## Explicit remaining compatibility boundaries

- Microsoft built-in `idMso`/`imageMso` commands and assets, COM/VSTO behavior, native Office command repurposing, every RibbonX callback/schema node, and Office.js host services are not reproduced.
- WPF dependency properties, resources, routed commands/events, arbitrary XAML templates, full binding validation/update-trigger semantics and exact WPF layout contracts are not reproduced.
- RibbonX boxes/button groups are flattened and advanced positioning or rich backstage/context-menu XML is warned about. Read importer warnings when porting existing definitions.
- The three example editors demonstrate application command integration. They are not complete Word, Excel, or PowerPoint replacements; document file compatibility is outside the ribbon library's scope.
- Chromium behavioral tests exercise the shipped component. Firefox/WebKit, real mobile hardware, screen-reader combinations, localization completeness, and long-running production workloads require target-environment qualification.
- The package provides a practical initial release; exhaustive Office control/overload parity and production certification have not been established.

## Public reference sources

- [WPF Ribbon namespace and control families](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.ribbon?view=windowsdesktop-9.0)
- [WPF RibbonGallery](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.ribbon.ribbongallery?view=windowsdesktop-9.0)
- [RibbonGroup.GroupSizeDefinitions](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.ribbon.ribbongroup.groupsizedefinitions?view=windowsdesktop-10.0)
- [RibbonX Custom UI schema](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-customui/5f3e35d6-70d6-47ee-9e11-f5499559f93a)
- [CustomUI2 root / backstage](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-customui2/a232628d-f6fb-4630-a463-459989a68e7a)
- [IRibbonUI.Invalidate](https://learn.microsoft.com/en-us/office/vba/api/office.iribbonui.invalidate)
- [Office add-in command design](https://learn.microsoft.com/en-us/office/dev/add-ins/design/add-in-commands)
- [ICommand](https://learn.microsoft.com/en-us/dotnet/api/system.windows.input.icommand?view=net-9.0)
- [INotifyPropertyChanged](https://learn.microsoft.com/en-us/dotnet/api/system.componentmodel.inotifypropertychanged?view=net-9.0)
- [ObservableCollection](https://learn.microsoft.com/en-us/dotnet/api/system.collections.objectmodel.observablecollection-1?view=net-9.0)

These sources inform control/API mappings. Their existence is not evidence that RibbonWeb implements all behavior they describe.
