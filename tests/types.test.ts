import {
  ObservableObject, ObservableCollection, RelayCommand, AsyncRelayCommand, Binding, bind,
  RibbonModel, RibbonGroup, RibbonTab, RibbonButton, RibbonToggleButton, RibbonGallery,
  RibbonElement, normalizeControl, createRibbonXAdapter, createDotNetBridge, EventSource,
  type RibbonControlOptions, type RibbonEventMap,
} from '../src/index.js';
const viewModel = new ObservableObject({ bold: false, title: 'Untitled', count: 2 });
const title: string = viewModel.Title;
viewModel.bold = true;
viewModel.Bold = false;
const count: number = viewModel.get('count');
const command = new RelayCommand((parameter: string) => parameter.length, parameter => parameter.length > 0);
const asyncCommand = new AsyncRelayCommand(async (parameter: string, signal) => {
  signal.throwIfAborted(); return parameter.length;
});
const work: Promise<number | undefined> = asyncCommand.Execute('a');
asyncCommand.Cancel();
const button = new RibbonButton({ Id: 'save', Label: title, Command: command });
const toggle = new RibbonToggleButton({ Label: 'Bold', Bindings: { checked: new Binding<boolean, boolean>('bold', { mode: 'TwoWay' }) } });
const subscription = bind(toggle, 'checked', viewModel, new Binding('bold', { Mode: 'TwoWay' }));
subscription.Dispose();
const items = new ObservableCollection<RibbonControlOptions>([{ Type: 'button', Label: 'New' }]);
const group = new RibbonGroup({ Header: 'Font', Items: items, Launcher: command });
const tab = new RibbonTab({ Id: 'home', Header: 'Home', Groups: [group] });
const model = new RibbonModel({ Tabs: [tab], QuickAccessToolbar: [button], Theme: 'dark' });
model.Tabs[0].Header = 'Home updated';
const gallery = new RibbonGallery({ Items: [{ label: 'Title', value: 'title', style: { fontSize: '20px' } }] });
const element = document.createElement('ribbon-web');
const nativeElement: RibbonElement = element;
element.model = { Tabs: [{ Id: 'file', Header: 'File' }] };
element.Model = model;
element.DataContext = viewModel;
element.addEventListener('ribbon-command', event => {
  const id: string = event.detail.id;
  const control = event.detail.control;
  control.Label = id;
});
element.addEventListener('click', event => { const x: number = event.clientX; });
const eventName: keyof RibbonEventMap = 'ribbon-tab-change';
const source = new EventSource<[string, number]>();
source.subscribe((name, value) => name.repeat(value)); source.emit('x', 3);
const adapter = createRibbonXAdapter('<customUI/>', { onLoad(api) { api.Invalidate(); } });
adapter.attach(element).InvalidateControl('save');
const bridge = createDotNetBridge(element, { invokeMethodAsync: async (name, payload) => undefined });
bridge.setModel(model); bridge.updateControl('save', { Enabled: false }); bridge.dispose();
const normalized = normalizeControl('Label');
// @ts-expect-error Layout values are intentionally constrained.
element.layout = 'unsupported';
// @ts-expect-error Inferred observable properties retain their source value type.
viewModel.Title = 42;
// @ts-expect-error Event arguments are type checked.
source.emit(3, 'x');
void [title, count, work, gallery, nativeElement, eventName, normalized];
const dotNetButton = new RibbonButton({ Header: 'Save', IsEnabled: true, IsVisible: true, SmallImageSource: 'save', ToolTipTitle: 'Save document' });
dotNetButton.IsEnabled = false;
dotNetButton.IsChecked = true;
dotNetButton.Header = 'Save all';
dotNetButton.SelectedValue = 'all';
dotNetButton.LargeImageSource = 'save';
dotNetButton.ToolTipDescription = 'Write every document';
dotNetButton.ItemsSource = new ObservableCollection([{ Id: 'child', Header: 'Child' }]);
const dotNetGroup = new RibbonGroup({ Header: 'Font', IsVisible: false, ItemsSource: [dotNetButton] });
dotNetGroup.ItemsSource = items;
const dotNetTab = new RibbonTab({ Header: 'Home', IsVisible: true });
dotNetTab.IsVisible = false;
// @ts-expect-error Semantic aliases preserve boolean property types.
dotNetButton.IsEnabled = 'false';
