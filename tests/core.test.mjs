import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventSource, ObservableObject, ObservableCollection, RelayCommand, AsyncRelayCommand,
  Binding, bind, RibbonModel, RibbonTab, RibbonGroup, RibbonButton, RibbonCheckBox,
  RibbonMenuButton, RibbonMenuItem, RibbonSlider, normalizeRibbon, normalizeControl,
  findControl, traverseControls,
} from '../src/core.js';

test('EventSource dispatch is stable and unsubscription is idempotent', () => {
  const source = new EventSource(); const log = [];
  const dispose = source.subscribe((a, b) => log.push(a + b));
  source.emit(2, 3); dispose.dispose(); dispose(); source.emit(8, 9);
  assert.deepEqual(log, [5]); assert.equal(source.count, 0);
  assert.throws(() => source.subscribe(null), TypeError);
});

test('ObservableObject exposes aliases and suppresses redundant property updates', () => {
  const vm = new ObservableObject({ DocumentTitle: 'A', count: 0 }); const events = [];
  vm.PropertyChanged.subscribe(event => events.push(event));
  assert.equal(vm.documentTitle, 'A'); assert.equal(vm.DocumentTitle, 'A');
  vm.DocumentTitle = 'B'; vm.documentTitle = 'B';
  assert.equal(vm.GetProperty('DocumentTitle'), 'B');
  assert.equal(vm.SetProperty('Count', 2), true); assert.equal(vm.set('count', 2), false);
  assert.equal(events.length, 2); assert.equal(events[0].propertyName, 'documentTitle');
  assert.equal(events[0].PropertyName, 'DocumentTitle'); assert.equal(events[0].oldValue, 'A');
  vm.set('newProperty', 42); assert.equal(vm.NewProperty, 42);
  assert.deepEqual(vm.toJSON(), { documentTitle: 'B', count: 2, newProperty: 42 });
});

test('ObservableObject reads and writes nested objects and rejects dangerous property paths', () => {
  const vm = new ObservableObject({ document: { title: 'Original' }, selection: new ObservableObject({ bold: false }) });
  vm.set('document.title', 'Edited'); vm.set('Selection.Bold', true);
  assert.equal(vm.get('Document.Title'), 'Edited'); assert.equal(vm.get('selection.bold'), true);
  assert.throws(() => vm.set('document.__proto__', {}), TypeError);
  assert.throws(() => vm.set('missing.title', 'x'), /parent does not exist/);
  assert.throws(() => new ObservableObject(JSON.parse('{"__proto__": {"polluted": true}}')), TypeError);
  assert.equal({}.polluted, undefined);
});

test('ObservableCollection emits .NET-style mutation details and preserves isolation', () => {
  const items = new ObservableCollection(['a', 'b']); const events = [];
  items.CollectionChanged.subscribe(event => events.push(event));
  items.Add('c'); items.Move(2, 0); items.Remove('a'); items.SetItem(0, 'C');
  assert.deepEqual([...items], ['C', 'b']);
  assert.equal(events[0].Action, 'Add'); assert.deepEqual(events[0].NewItems, ['c']);
  assert.equal(events[1].OldStartingIndex, 2); assert.equal(events[1].NewStartingIndex, 0);
  assert.deepEqual(events[2].OldItems, ['a']);
  const snapshot = items.Items; snapshot.push('cannot bypass notifications'); assert.equal(items.Count, 2);
  assert.equal(items.Remove('missing'), false); assert.throws(() => items.Move(-1, 0), RangeError);
  items.Clear(); assert.equal(items.count, 0); assert.equal(events.at(-1).Action, 'Reset');
});

test('RelayCommand gates execution and announces CanExecute changes', () => {
  let enabled = false; let notifications = 0; const calls = [];
  const command = new RelayCommand(value => { calls.push(value); return value * 2; }, value => enabled && value > 0);
  command.CanExecuteChanged.subscribe(() => notifications++);
  assert.equal(command.Execute(3), undefined); enabled = true; command.NotifyCanExecuteChanged();
  assert.equal(command.canExecute(3), true); assert.equal(command.execute(3), 6);
  assert.deepEqual(calls, [3]); assert.equal(notifications, 1);
});

test('AsyncRelayCommand shares concurrent execution and resets running state', async () => {
  let finish; let calls = 0; const states = [];
  const command = new AsyncRelayCommand(async (value, signal) => {
    calls++; assert.equal(signal.aborted, false); await new Promise(resolve => finish = resolve); return value + 1;
  });
  command.PropertyChanged.subscribe(event => { if (event.propertyName === 'isRunning') states.push(event.newValue); });
  const first = command.Execute(5); const second = command.Execute(50);
  assert.equal(first, second); assert.equal(command.IsRunning, true); assert.equal(command.CanExecute(1), false);
  await Promise.resolve(); finish(); assert.equal(await first, 6);
  assert.equal(calls, 1); assert.equal(command.isRunning, false); assert.deepEqual(states, [true, false]);
});

test('AsyncRelayCommand exposes cancellation signal and propagates errors with state restored', async () => {
  const command = new AsyncRelayCommand((_, signal) => new Promise((resolve, reject) => {
    const cancelled = () => reject(new DOMException('Cancelled', 'AbortError'));
    if (signal.aborted) cancelled(); else signal.addEventListener('abort', cancelled, { once: true });
  }));
  const promise = command.Execute(); command.Cancel();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(command.IsRunning, false); assert.equal(command.IsCancellationRequested, true);
  assert.equal(command.Error.name, 'AbortError'); assert.equal(command.CanExecute(), true);
  const broken = new AsyncRelayCommand(() => { throw new Error('Failure'); });
  await assert.rejects(broken.Execute(), /Failure/); assert.equal(broken.IsRunning, false);
});

test('OneWay binding follows nested replacements and disposes every subscription', () => {
  const original = new ObservableObject({ title: 'First' });
  const vm = new ObservableObject({ document: original }); const target = new RibbonButton();
  const binding = bind(target, 'Label', vm, new Binding('Document.Title'));
  assert.equal(target.Label, 'First'); original.Title = 'Second'; assert.equal(target.label, 'Second');
  const replacement = new ObservableObject({ title: 'Third' }); vm.Document = replacement;
  assert.equal(target.label, 'Third'); original.Title = 'Stale'; assert.equal(target.label, 'Third');
  replacement.Title = 'Fourth'; assert.equal(target.label, 'Fourth');
  assert.equal(original.PropertyChanged.count, 0);
  binding.dispose(); replacement.Title = 'Ignored'; assert.equal(target.label, 'Fourth');
  assert.equal(vm.PropertyChanged.count, 0); assert.equal(replacement.PropertyChanged.count, 0);
});

test('TwoWay binding uses converters and avoids recursive updates', () => {
  const vm = new ObservableObject({ opacity: 0.25 }); const target = new RibbonSlider();
  const changes = []; vm.PropertyChanged.subscribe(event => changes.push(event));
  const subscription = bind(target, 'value', vm, new Binding('opacity', {
    mode: 'TwoWay', converter: { Convert: value => value * 100, ConvertBack: value => value / 100 },
  }));
  assert.equal(target.Value, 25); target.Value = 75; assert.equal(vm.Opacity, 0.75);
  assert.equal(changes.length, 1); vm.Opacity = 0.5; assert.equal(target.Value, 50);
  subscription(); target.Value = 10; assert.equal(vm.Opacity, 0.5);
});

test('TwoWay binding works on EventTarget DOM-like properties and removes listeners', () => {
  const vm = new ObservableObject({ text: 'Hello' }); const input = new EventTarget(); input.value = '';
  const connection = bind(input, 'value', vm, new Binding('text', { mode: 'TwoWay' }));
  assert.equal(input.value, 'Hello'); input.value = 'Typed'; input.dispatchEvent(new Event('input'));
  assert.equal(vm.Text, 'Typed'); vm.Text = 'Programmatic'; assert.equal(input.value, 'Programmatic');
  connection.Dispose(); input.value = 'After disposal'; input.dispatchEvent(new Event('change'));
  assert.equal(vm.Text, 'Programmatic');
});

test('Models normalize PascalCase inputs, nested controls and collections without losing commands', () => {
  const command = new RelayCommand(() => 'saved');
  const model = new RibbonModel({
    Id: 'document-ribbon', Theme: 'dark', Tabs: new ObservableCollection([
      { Id: 'home', Header: 'Home', Groups: [{ Id: 'edit', Header: 'Editing', Items: [
        { Id: 'save', Type: 'RibbonButton', Label: 'Save', Command: command },
        { Id: 'bold', Type: 'ToggleButton', Checked: true },
        { Id: 'menu', Type: 'MenuButton', Items: [{ Id: 'nested', Label: 'Nested', Items: [{ Id: 'deeper', Label: 'Deep' }] }] },
      ] }] },
    ]), QuickAccessToolbar: [{ Id: 'quick', Label: 'Undo' }],
    Backstage: { Header: 'File', Items: [{ Id: 'open', Label: 'Open' }] },
  });
  assert.equal(model.Id, 'document-ribbon'); assert.equal(model.theme, 'dark'); assert.equal(model.SelectedTab, 'home');
  assert.ok(model.tabs[0] instanceof RibbonTab); assert.ok(model.tabs[0].groups[0] instanceof RibbonGroup);
  assert.equal(findControl(model, 'save').Command, command);
  assert.equal(findControl(model, 'bold').checked, true); assert.ok(findControl(model, 'nested') instanceof RibbonMenuItem);
  assert.deepEqual([...traverseControls(model)].map(item => item.id), ['quick', 'open', 'save', 'bold', 'menu', 'nested', 'deeper']);
  assert.equal(normalizeRibbon(model), model); assert.equal(normalizeControl(findControl(model, 'save')), findControl(model, 'save'));
});

test('Control constructors support aliases, preserve gallery options, and reject unknown types', () => {
  const control = new RibbonCheckBox({ Label: 'Grid', Checked: true, Enabled: false });
  assert.equal(control.type, 'checkbox'); assert.equal(control.checked, true); control.Checked = false; assert.equal(control.checked, false);
  const gallery = normalizeControl({ Type: 'Gallery', Items: [{ value: 'a', label: 'A', preview: 'abc' }] });
  assert.deepEqual(gallery.items, [{ value: 'a', label: 'A', preview: 'abc' }]);
  assert.equal(normalizeControl({ Type: 'TextBox', label: 'camel', Label: 'Pascal' }).Label, 'camel');
  assert.throws(() => normalizeControl({ type: 'no-such-control' }), /Unknown ribbon control/);
});

test('toJSON excludes runtime commands and event sources while preserving configuration', () => {
  const model = new RibbonModel({ tabs: [{ id: 'home', groups: [{ items: [new RibbonButton({ id: 'save', command: new RelayCommand(() => {}) })] }] }] });
  const json = JSON.parse(JSON.stringify(model));
  assert.equal(json.tabs[0].groups[0].items[0].id, 'save');
  assert.equal('command' in json.tabs[0].groups[0].items[0], false);
  assert.equal('PropertyChanged' in json, false); assert.equal('Tabs' in json, false);
});

test('Live model collections normalize insertions and preserve existing model identity', () => {
  const controls = new ObservableCollection([{ Id: 'first', Label: 'First' }]);
  const group = new RibbonGroup({ Items: controls }); const original = group.items[0];
  const events = []; group.PropertyChanged.subscribe(event => events.push(event));
  original.label = 'Locally updated'; controls.Add({ Id: 'second', Type: 'CheckBox', Checked: true });
  assert.equal(group.Items.length, 2); assert.equal(group.Items[0], original);
  assert.equal(group.Items[0].label, 'Locally updated'); assert.ok(group.Items[1] instanceof RibbonCheckBox);
  assert.equal(events.at(-1).propertyName, 'items');
  const next = new ObservableCollection([{ id: 'third' }]); group.Items = next;
  controls.Add({ id: 'detached' }); assert.equal(group.Items.length, 1);
  next.Add({ id: 'fourth' }); assert.equal(group.Items.length, 2);
  group.Dispose(); assert.equal(next.CollectionChanged.count, 0);
});

test('Later model assignments normalize plain objects and generated tab IDs remain selected', () => {
  const model = new RibbonModel({ Tabs: [{ Header: 'Home' }] });
  assert.equal(model.selectedTab, model.tabs[0].id);
  model.Tabs = [{ Id: 'insert', Groups: [{ Items: [{ Type: 'Slider', Min: 10, Max: 20, Value: 12 }] }] }];
  assert.ok(model.tabs[0] instanceof RibbonTab);
  const slider = model.tabs[0].groups[0].items[0]; assert.ok(slider instanceof RibbonSlider);
  assert.equal(slider.Min, 10); assert.equal(slider.Max, 20);
  model.tabs[0].Groups = [{ Id: 'new', Items: [{ Label: 'Button' }] }];
  assert.ok(model.tabs[0].groups[0] instanceof RibbonGroup);
});

test('Semantic .NET aliases normalize constructor inputs without duplicate stored properties', () => {
  const button = new RibbonButton({ Id: 'save', Header: 'Save', IsEnabled: false, IsVisible: true,
    IsChecked: true, SelectedValue: 'saved', SmallImageSource: 'save', ToolTipTitle: 'Save document',
    ToolTipDescription: 'Write the current document', KeyTip: 'S' });
  assert.equal(button.label, 'Save'); assert.equal(button.Header, 'Save');
  assert.equal(button.enabled, false); assert.equal(button.IsEnabled, false);
  assert.equal(button.visible, true); assert.equal(button.checked, true);
  assert.equal(button.value, 'saved'); assert.equal(button.icon, 'save');
  assert.equal(button.tooltip, 'Save document'); assert.equal(button.description, 'Write the current document');
  assert.equal(button.keyTip, 'S'); assert.equal(button.GetProperty('IsChecked'), true);
  const json = button.toJSON();
  for (const alias of ['header', 'isEnabled', 'isVisible', 'isChecked', 'selectedValue', 'smallImageSource', 'toolTipTitle']) assert.equal(alias in json, false);
  assert.equal(json.label, 'Save'); assert.equal(json.enabled, false);
});

test('Alias assignments and property APIs emit exactly one canonical change event', () => {
  const button = new RibbonButton(); const events = [];
  button.PropertyChanged.subscribe(event => events.push(event));
  button.IsEnabled = false; button.isEnabled = false;
  button.SetProperty('Header', 'Updated'); button.header = 'Updated';
  button.LargeImageSource = 'image'; button.ToolTipDescription = 'More information';
  assert.equal(button.GetProperty('Header'), 'Updated'); assert.equal(button.GetProperty('LargeImageSource'), 'image');
  assert.equal(button.GetProperty('SmallImageSource'), 'image'); assert.equal(button.GetProperty('IsEnabled'), false);
  assert.deepEqual(events.map(event => event.propertyName), ['enabled', 'label', 'icon', 'description']);
  assert.deepEqual(events.map(event => event.PropertyName), ['Enabled', 'Label', 'Icon', 'Description']);
});

test('Canonical constructor properties take precedence over semantic aliases in either input order', () => {
  for (const options of [
    { Header: 'Alias', Label: 'Canonical', IsEnabled: false, Enabled: true },
    { label: 'Canonical', Header: 'Alias', enabled: true, IsEnabled: false },
  ]) {
    const button = new RibbonButton(options);
    assert.equal(button.label, 'Canonical'); assert.equal(button.IsEnabled, true);
  }
  const button = new RibbonButton({ SmallImageSource: 'small', LargeImageSource: 'large', Icon: 'canonical' });
  assert.equal(button.SmallImageSource, 'canonical'); assert.equal(button.LargeImageSource, 'canonical');
});

test('Text and SelectedValue aliases share text input state while tab/group Header stays structural', () => {
  const input = normalizeControl({ Type: 'TextBox', Header: 'Document title', Text: 'Draft' });
  assert.equal(input.label, 'Document title'); assert.equal(input.value, 'Draft');
  input.Text = 'Final'; assert.equal(input.SelectedValue, 'Final');
  input.SetProperty('SelectedValue', 'Published'); assert.equal(input.GetProperty('Text'), 'Published');
  const combo = normalizeControl({ Type: 'ComboBox', Text: 'Serif' });
  assert.equal(combo.value, 'Serif'); combo.text = 'Sans'; assert.equal(combo.Value, 'Sans');
  const tab = new RibbonTab({ Header: 'Home', IsVisible: false });
  const group = new RibbonGroup({ Header: 'Font', IsVisible: false });
  tab.Header = 'Insert'; group.Header = 'Clipboard';
  assert.equal(tab.header, 'Insert'); assert.equal(group.header, 'Clipboard');
  assert.equal(tab.GetProperty('Header'), 'Insert'); assert.equal(group.GetProperty('Header'), 'Clipboard');
  assert.equal(tab.visible, false); assert.equal(group.visible, false);
});

test('ItemsSource aliases preserve live collection normalization and replacement', () => {
  const items = new ObservableCollection([{ Id: 'a', Header: 'A' }]);
  const menu = new RibbonMenuButton({ ItemsSource: items });
  assert.ok(menu.Items[0] instanceof RibbonMenuItem); assert.equal(menu.ItemsSource, menu.items);
  items.Add({ Id: 'b', Header: 'B' }); assert.equal(menu.ItemsSource.length, 2);
  const next = new ObservableCollection([{ Id: 'c', Header: 'C' }]);
  menu.SetProperty('ItemsSource', next); items.Add({ Id: 'detached' }); assert.equal(menu.Items.length, 1);
  next.Add({ Id: 'd' }); assert.equal(menu.items.length, 2);
  const group = new RibbonGroup({ ItemsSource: items }); assert.equal(group.ItemsSource.length, 3);
  menu.Dispose(); group.Dispose(); assert.equal(next.CollectionChanged.count, 0); assert.equal(items.CollectionChanged.count, 0);
});

test('Bindings watch semantic aliases as both source paths and target properties', () => {
  const source = new RibbonCheckBox({ IsChecked: false });
  const target = new RibbonCheckBox(); const subscription = bind(target, 'IsChecked', source, new Binding('IsChecked', { mode: 'TwoWay' }));
  source.Checked = true; assert.equal(target.IsChecked, true);
  target.IsChecked = false; assert.equal(source.Checked, false);
  source.SetProperty('isChecked', true); assert.equal(target.checked, true);
  const label = new RibbonButton(); const vm = new ObservableObject({ control: source });
  const nested = bind(label, 'Header', vm, new Binding('Control.IsChecked', { converter: value => value ? 'On' : 'Off' }));
  assert.equal(label.label, 'On'); source.checked = false; assert.equal(label.Header, 'Off');
  subscription(); nested();
});

test('Control binding maps accept PascalCase and semantic alias keys', () => {
  const checked = new Binding('bold', { mode: 'TwoWay' });
  const control = new RibbonCheckBox({ Bindings: { IsChecked: checked, IsEnabled: 'canEdit', Header: 'caption' } });
  assert.equal(control.bindings.checked, checked); assert.equal(control.bindings.enabled, 'canEdit'); assert.equal(control.bindings.label, 'caption');
  control.Bindings = { Checked: 'canonical', IsChecked: 'alias' }; assert.equal(control.bindings.checked, 'canonical');
  const textbox = normalizeControl({ Type: 'TextBox', Bindings: { Text: 'title' } }); assert.equal(textbox.bindings.value, 'title');
});
