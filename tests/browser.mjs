import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/serve.mjs';

const root = process.cwd();
const output = resolve(process.env.RIBBON_TEST_OUTPUT || resolve(root, 'artifacts'));
await mkdir(output, { recursive: true });
const server = await createStaticServer({ root, port: 0 });
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(6000);
page.setDefaultNavigationTimeout(15000);
let pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
await page.route('**/__ribbon_test__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><meta charset="utf-8"><title>RibbonWeb browser regressions</title><style>body{margin:20px;font-family:system-ui}#outside{margin:20px}ribbon-web{width:100%}</style><body><button id="outside">Outside ribbon</button></body></html>' }));
const cases = [];
const test = (name, run) => cases.push({ name, run });
const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const control = id => page.locator(`ribbon-web .panel [data-control-id="${id}"]`);
const input = id => page.locator(`ribbon-web #input-${id}`);
const attr = (locator, name) => locator.getAttribute(name);
async function setup(initialize) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/__ribbon_test__`);
  await page.evaluate(async () => {
    window.api = await import('/src/index.js');
    window.state = { calls: [], events: [], preview: [], errors: [] };
    window.makeRibbon = (options = {}, dataContext) => {
      const homeItems = options.items || [{ id: 'run', label: 'Run action', icon: 'save', keyTip: 'R', command: parameter => state.calls.push(['run', parameter]), commandParameter: 42 }];
      const modelOptions = { title: 'Regression ribbon', theme: 'light', tabs: [
        { id: 'home', header: 'Home', keyTip: 'H', groups: [{ id: 'main', header: 'Main', items: homeItems }] },
        { id: 'insert', header: 'Insert', keyTip: 'N', groups: [{ id: 'insert-tools', header: 'Insert tools', items: [{ id: 'shape', label: 'Insert shape', command: () => state.calls.push(['shape']) }] }] },
        { id: 'picture', header: 'Picture', keyTip: 'P', contextualGroup: 'picture', groups: [{ id: 'picture-tools', header: 'Picture tools', items: [{ id: 'crop', label: 'Crop', command: () => state.calls.push(['crop']) }] }] }
      ], ...options };
      delete modelOptions.items;
      const r = document.createElement('ribbon-web');
      r.model = new api.RibbonModel(modelOptions);
      if (dataContext) r.dataContext = dataContext;
      for (const name of ['ribbon-command', 'ribbon-change', 'ribbon-tab-change', 'ribbon-context-change', 'ribbon-customization-change', 'ribbon-backstage-change', 'ribbon-launcher']) r.addEventListener(name, e => state.events.push({ name, id: e.detail.id, value: e.detail.value, property: e.detail.property }));
      for (const name of ['ribbon-preview', 'ribbon-preview-end']) r.addEventListener(name, e => state.preview.push({ name, ...e.detail }));
      r.addEventListener('ribbon-error', e => state.errors.push({ id: e.detail.id, message: e.detail.error?.message }));
      document.body.prepend(r);
      window.ribbon = r;
      return r;
    };
  });
  await page.evaluate(initialize || (() => { makeRibbon(); }));
  await flush();
}

test('native custom element renders typed model, tabs, groups and linked ARIA', async () => {
  await setup();
  assert.equal(await page.evaluate(() => ribbon instanceof api.RibbonElement), true);
  assert.equal(await page.getByRole('tab').count(), 2);
  assert.equal(await attr(page.getByRole('tab', { name: 'Home', exact: true }), 'aria-selected'), 'true');
  assert.equal(await attr(page.getByRole('tabpanel'), 'aria-labelledby'), 'tab-home');
  assert.equal(await attr(page.getByRole('tab', { name: 'Home', exact: true }), 'aria-controls'), 'panel-home');
  assert.equal(await page.locator('ribbon-web .group[aria-label="Main"]').count(), 1);
  assert.equal(await control('run').isVisible(), true);
});

test('tab click activates the appropriate panel and raises selection events', async () => {
  await setup();
  await page.getByRole('tab', { name: 'Insert', exact: true }).click();
  assert.equal(await control('shape').isVisible(), true);
  assert.equal(await control('run').count(), 0);
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'insert');
  assert.equal(await page.evaluate(() => state.events.at(-1).id), 'insert');
});

test('tab keyboard navigation supports arrows, Home, End and roving focus', async () => {
  await setup();
  await page.getByRole('tab', { name: 'Home', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => ribbon.shadowRoot.activeElement.dataset.tabId), 'insert');
  assert.equal(await attr(page.getByRole('tab', { name: 'Home', exact: true }), 'tabindex'), '-1');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'home');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'insert');
});

test('RTL arrow navigation follows visual tab order', async () => {
  await setup(() => { makeRibbon(); ribbon.setAttribute('dir', 'rtl'); ribbon.setContext('picture', true); });
  await page.getByRole('tab', { name: 'Home', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'insert');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'home');
});

test('contextual tabs show on activation and selection recovers when removed', async () => {
  await setup();
  assert.equal(await page.getByRole('tab', { name: 'Picture', exact: true }).count(), 0);
  await page.evaluate(() => ribbon.SetContext('picture', true));
  await page.getByRole('tab', { name: 'Picture', exact: true }).click();
  assert.equal(await control('crop').isVisible(), true);
  await page.evaluate(() => ribbon.SetContext('picture', false));
  await flush();
  assert.equal(await page.getByRole('tab', { name: 'Picture', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'home');
});

test('commands execute exactly once with parameters and composed events', async () => {
  await setup(() => { makeRibbon(); document.body.addEventListener('ribbon-command', e => window.bubbledCommand = e.detail.id); });
  await control('run').click();
  assert.deepEqual(await page.evaluate(() => state.calls), [['run', 42]]);
  assert.equal(await page.evaluate(() => window.bubbledCommand), 'run');
  assert.equal(await page.evaluate(() => state.events.filter(e => e.name === 'ribbon-command').length), 1);
});

test('RelayCommand CanExecute notifications update disabled state', async () => {
  await setup(() => { window.allowed = false; window.command = new api.RelayCommand(() => state.calls.push('executed'), () => allowed); makeRibbon({ items: [{ id: 'gated', label: 'Gated action', command }] }); });
  assert.equal(await control('gated').isDisabled(), true);
  assert.equal(await page.evaluate(() => ribbon.Execute('gated')), false);
  await page.evaluate(() => { window.allowed = true; command.NotifyCanExecuteChanged(); });
  await flush();
  assert.equal(await control('gated').isEnabled(), true);
  await control('gated').click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['executed']);
});

test('cancelable pre-execution event prevents command and state mutation', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'cancelled', type: 'toggle', label: 'Cancelled action', command: () => state.calls.push('unexpected') }] }); ribbon.addEventListener('ribbon-command-executing', e => e.preventDefault()); });
  await control('cancelled').click();
  assert.deepEqual(await page.evaluate(() => state.calls), []);
  assert.equal(await attr(control('cancelled'), 'aria-pressed'), 'false');
});

test('command failures raise ribbon-error without an unhandled browser error', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'failure', label: 'Fail safely', command: async () => { throw new Error('Expected command failure'); } }] }); });
  assert.equal(await page.evaluate(() => ribbon.Execute('failure')), false);
  assert.deepEqual(await page.evaluate(() => state.errors), [{ id: 'failure', message: 'Expected command failure' }]);
  assert.equal(await control('failure').isEnabled(), true);
});

test('AsyncRelayCommand prevents duplicate execution while work is pending', async () => {
  await setup(() => { window.command = new api.AsyncRelayCommand(() => new Promise(resolve => { state.calls.push('started'); window.finishCommand = resolve; })); makeRibbon({ items: [{ id: 'async', label: 'Async work', command }] }); });
  await control('async').click();
  assert.equal(await control('async').isDisabled(), true);
  assert.equal(await page.evaluate(() => ribbon.Execute('async')), false);
  await page.evaluate(() => finishCommand('done'));
  await flush();
  assert.equal(await control('async').isEnabled(), true);
  assert.deepEqual(await page.evaluate(() => state.calls), ['started']);
});

test('toggle TwoWay MVVM binding synchronizes model and view model', async () => {
  await setup(() => { window.vm = new api.ObservableObject({ bold: false }); makeRibbon({ items: [{ id: 'bold', type: 'toggle', label: 'Bold', bindings: { checked: new api.Binding('Bold', { mode: 'TwoWay' }) } }] }, vm); });
  await control('bold').click();
  assert.equal(await page.evaluate(() => vm.Bold), true);
  assert.equal(await attr(control('bold'), 'aria-pressed'), 'true');
  await page.evaluate(() => { vm.Bold = false; });
  await flush();
  assert.equal(await attr(control('bold'), 'aria-pressed'), 'false');
});

test('textbox TwoWay binding updates both directions and command event values', async () => {
  await setup(() => { window.vm = new api.ObservableObject({ name: 'Initial' }); makeRibbon({ items: [{ id: 'name', type: 'textbox', label: 'Document name', bindings: { value: { path: 'Name', mode: 'TwoWay' } } }] }, vm); });
  assert.equal(await input('name').inputValue(), 'Initial');
  await input('name').fill('New document');
  await input('name').press('Tab');
  assert.equal(await page.evaluate(() => vm.Name), 'New document');
  assert.equal(await page.evaluate(() => state.events.find(e => e.name === 'ribbon-command')?.value), 'New document');
  await page.evaluate(() => { vm.Name = 'From view model'; });
  await flush();
  assert.equal(await input('name').inputValue(), 'From view model');
});

test('dropdown selection preserves selected value and change notification', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'font', type: 'dropdown', label: 'Font', value: 'a', items: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }] }] }); });
  assert.equal(await input('font').inputValue(), 'a');
  await input('font').selectOption('b');
  assert.equal(await page.evaluate(() => ribbon.GetControl('font').Value), 'b');
  assert.equal(await page.evaluate(() => state.events.find(e => e.name === 'ribbon-change')?.value), 'b');
});

test('combobox offers suggestions while accepting free text', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'combo', type: 'combobox', label: 'Font family', items: [{ label: 'Arial' }, { label: 'Georgia' }] }] }); });
  assert.equal(await page.locator('ribbon-web datalist option').count(), 2);
  assert.equal(await attr(input('combo'), 'list'), 'list-combo');
  await input('combo').fill('Custom family');
  await input('combo').press('Tab');
  assert.equal(await page.evaluate(() => ribbon.GetControl('combo').Value), 'Custom family');
});

test('numeric spinner returns numbers and rejects application validation failures', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'size', type: 'spinner', label: 'Font size', min: 1, max: 100, value: 12, validate: value => value >= 1 && value <= 100, validationMessage: 'Use a size from 1 to 100' }] }); });
  await input('size').fill('18');
  await input('size').press('Tab');
  assert.equal(await page.evaluate(() => ribbon.GetControl('size').Value), 18);
  await input('size').fill('101');
  await input('size').press('Tab');
  assert.equal(await page.evaluate(() => ribbon.GetControl('size').Value), 18);
  assert.equal(await input('size').evaluate(n => n.validity.valid), false);
});

test('slider previews intermediate values and commits a numeric value', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'zoom', type: 'slider', label: 'Zoom', value: 20, min: 0, max: 100 }] }); });
  await input('zoom').evaluate(n => { n.value = '65'; n.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.evaluate(() => state.preview.at(-1).value), 65);
  await input('zoom').dispatchEvent('change');
  assert.equal(await page.evaluate(() => ribbon.GetControl('zoom').Value), 65);
});

test('color picker emits live preview and commits chosen color', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'color', type: 'color', label: 'Text color', value: '#000000' }] }); });
  await input('color').evaluate(n => { n.value = '#336699'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await page.evaluate(() => state.preview.at(-1).value), '#336699');
  assert.equal(await page.evaluate(() => ribbon.GetControl('color').Value), '#336699');
});

test('checkbox state and radio group exclusivity have accessible semantics', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'check', type: 'checkbox', label: 'Show grid' }, { id: 'left', type: 'radio', label: 'Align left', groupName: 'alignment', checked: true }, { id: 'right', type: 'radio', label: 'Align right', groupName: 'alignment' }] }); });
  await control('check').click();
  assert.equal(await attr(control('check'), 'role'), 'checkbox');
  assert.equal(await attr(control('check'), 'aria-checked'), 'true');
  await control('right').click();
  assert.equal(await attr(control('right'), 'role'), 'radio');
  assert.equal(await attr(control('right'), 'aria-checked'), 'true');
  assert.equal(await attr(control('left'), 'aria-checked'), 'false');
});

test('menus support keyboard navigation, disabled items, activation and focus return', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'menu', type: 'menu', label: 'Actions', items: [{ id: 'first', label: 'First', command: () => state.calls.push('first') }, { id: 'disabled', label: 'Disabled', enabled: false }, { id: 'last', label: 'Last', command: () => state.calls.push('last') }] }] }); });
  await control('menu').click();
  assert.equal(await page.getByRole('menu').isVisible(), true);
  assert.equal(await attr(control('menu'), 'aria-expanded'), 'true');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => ribbon.shadowRoot.activeElement.dataset.controlId), 'last');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => state.calls), ['last']);
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.equal(await page.evaluate(() => ribbon.shadowRoot.activeElement.dataset.controlId), 'menu');
});

test('nested and dynamic menus use current items on each opening', async () => {
  await setup(() => { window.generation = 0; makeRibbon({ items: [{ id: 'dynamic', type: 'menu', label: 'Recent', getItems: async () => [{ id: 'nested', type: 'menu', label: `Generation ${++generation}`, items: [{ id: 'leaf', label: 'Open recent', command: () => state.calls.push('recent') }] }] }] }); });
  await control('dynamic').click();
  await page.getByRole('menuitem', { name: 'Generation 1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open recent', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['recent']);
  await control('dynamic').click();
  assert.equal(await page.getByRole('menuitem', { name: 'Generation 2', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
});

test('split button separates default command from its options menu', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'paste', type: 'split', label: 'Paste', command: () => state.calls.push('paste'), items: [{ id: 'paste-text', label: 'Paste text', command: () => state.calls.push('text') }] }] }); });
  await control('paste').click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['paste']);
  await page.getByRole('button', { name: 'Paste options', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['paste']);
  await page.getByRole('menuitem', { name: 'Paste text', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['paste', 'text']);
});

test('gallery supports preview/cancel, categories and committed selection', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'styles', type: 'gallery', label: 'Styles', value: 'plain', items: [{ id: 'plain', label: 'Plain', category: 'Basic' }, { id: 'title', label: 'Title', category: 'Heading' }, { id: 'subtitle', label: 'Subtitle', category: 'Heading' }], preview: value => state.calls.push(['preview', value]), cancelPreview: () => state.calls.push(['cancel']) }] }); });
  await page.getByRole('option', { name: 'Title', exact: true }).hover();
  assert.equal(await page.evaluate(() => state.preview.at(-1).value), 'title');
  await page.locator('#outside').hover();
  assert.equal(await page.evaluate(() => state.preview.at(-1).committed), false);
  await page.getByRole('button', { name: 'More Styles', exact: true }).click();
  await page.getByRole('combobox', { name: 'Gallery category', exact: true }).selectOption('Heading');
  assert.equal(await page.getByRole('dialog').getByRole('listbox').getByRole('option').count(), 2);
  await page.getByRole('dialog').getByRole('option', { name: 'Subtitle', exact: true }).click();
  assert.equal(await page.evaluate(() => ribbon.GetControl('styles').Value), 'subtitle');
  assert.equal(await page.getByRole('dialog').count(), 0);
});

test('custom rendering accepts DOM nodes and declarative slots', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'custom', type: 'custom', render: () => { const n = document.createElement('button'); n.textContent = 'Custom action'; n.onclick = () => state.calls.push('custom'); return n; } }, { id: 'slot', type: 'custom', slot: 'extra' }] }); const n = document.createElement('span'); n.slot = 'extra'; n.textContent = 'Slotted content'; ribbon.append(n); });
  await page.getByRole('button', { name: 'Custom action', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['custom']);
  assert.equal(await page.locator('ribbon-web slot').evaluate(n => n.assignedNodes()[0].textContent), 'Slotted content');
});

test('untrusted titles, labels and gallery previews are rendered as text', async () => {
  await setup(() => { window.xssExecuted = false; const payload = '<img src=x onerror="window.xssExecuted=true">'; makeRibbon({ title: payload, items: [{ id: 'xss', label: payload }, { id: 'gallery', type: 'gallery', label: 'Text previews', items: [{ id: 'p', label: payload, preview: payload }] }] }); });
  assert.equal(await page.evaluate(() => ribbon.shadowRoot.querySelectorAll('img').length), 0);
  assert.equal(await page.evaluate(() => xssExecuted), false);
  assert.match(await control('xss').textContent(), /<img src=x/);
});

test('Ctrl+F1 minimizes ribbon and selected tab opens a dismissible peek panel', async () => {
  await setup();
  await page.locator('#outside').focus();
  await page.keyboard.press('Control+F1');
  assert.equal(await page.getByRole('tabpanel').count(), 0);
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  assert.equal(await page.locator('ribbon-web .floating-panel').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('tabpanel').count(), 0);
  await page.keyboard.press('Control+F1');
  assert.equal(await control('run').isVisible(), true);
});

test('layout, theme and touch density visibly change the control surface', async () => {
  await setup();
  const classicHeight = await page.getByRole('tabpanel').evaluate(n => n.getBoundingClientRect().height);
  await page.evaluate(() => { ribbon.layout = 'simplified'; ribbon.theme = 'dark'; });
  await flush();
  assert.equal(await page.locator('ribbon-web .shell.simplified').count(), 1);
  assert.ok(await page.getByRole('tabpanel').evaluate(n => n.getBoundingClientRect().height) < classicHeight);
  assert.equal(await page.locator('ribbon-web').evaluate(n => getComputedStyle(n).colorScheme), 'dark');
  await page.evaluate(() => ribbon.setAttribute('density', 'touch'));
  await flush();
  assert.ok(await control('run').evaluate(n => n.getBoundingClientRect().height) >= 40);
});

test('Alt+Q command search finds commands from another tab and executes them', async () => {
  await setup();
  await page.locator('#outside').focus();
  await page.keyboard.press('Alt+q');
  await page.getByRole('textbox', { name: 'Search commands', exact: true }).fill('Insert shape');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => state.calls), [['shape']]);
  assert.equal(await page.getByRole('dialog').count(), 0);
});

test('key tips activate a tab and command without pointer interaction', async () => {
  await setup();
  await page.locator('#outside').focus();
  await page.keyboard.press('F10');
  assert.ok(await page.locator('ribbon-web .key-tip').count() >= 2);
  await page.keyboard.press('h');
  await page.keyboard.press('r');
  assert.deepEqual(await page.evaluate(() => state.calls), [['run', 42]]);
  assert.equal(await page.locator('ribbon-web .key-tip').count(), 0);
});

test('backstage pages render content, execute actions and return to ribbon', async () => {
  await setup(() => { makeRibbon({ backstage: [{ id: 'info', label: 'Information', description: 'Document details', items: [{ id: 'export', label: 'Export document', command: () => state.calls.push('export') }] }] }); });
  await page.getByRole('button', { name: 'File', exact: true }).click();
  assert.equal(await page.getByRole('heading', { name: 'Information', exact: true }).isVisible(), true);
  await page.getByRole('button', { name: 'Export document', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['export']);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await control('run').isVisible(), true);
});

test('quick access customization adds a command and saves serializable state', async () => {
  await setup(() => { makeRibbon({ storageKey: 'ribbon-browser-qat' }); localStorage.removeItem('ribbon-browser-qat'); });
  await page.getByRole('button', { name: 'Customize quick access toolbar', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Run action', exact: true }).click();
  assert.equal(await page.getByRole('toolbar', { name: 'Quick access toolbar', exact: true }).locator('[data-control-id="run"]').count(), 1);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ribbon-browser-qat')).quickAccessToolbar), ['run']);
  await page.getByRole('toolbar', { name: 'Quick access toolbar', exact: true }).locator('[data-control-id="run"]').click();
  assert.deepEqual(await page.evaluate(() => state.calls), [['run', 42]]);
});

test('customization dialog applies tab visibility and exported order survives import', async () => {
  await setup();
  await page.evaluate(() => ribbon.openCustomization());
  await page.getByRole('checkbox', { name: 'Show Insert', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'Insert', exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => ribbon.exportCustomization().hiddenTabs), ['insert']);
  await page.evaluate(() => { const data = ribbon.exportCustomization(); data.hiddenTabs = []; data.tabOrder = ['insert', 'home', 'picture']; data.tabLabels = { insert: 'Create' }; data.selectedTab = 'insert'; ribbon.importCustomization(data); });
  await flush();
  assert.equal(await page.getByRole('tab').first().textContent(), 'Create');
  assert.equal(await page.evaluate(() => ribbon.SelectedTab), 'insert');
});

test('group launcher, context menu and selection mini toolbar dispatch commands', async () => {
  await setup(() => { makeRibbon({ tabs: [{ id: 'home', header: 'Home', groups: [{ id: 'main', header: 'Main', launcher: () => state.calls.push('launcher'), items: [{ id: 'run', label: 'Run action', command: () => state.calls.push('run') }] }] }] }); });
  await page.getByRole('button', { name: 'Main settings', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['launcher']);
  await page.evaluate(() => ribbon.showContextMenu(['run'], { x: 100, y: 250 }));
  await page.getByRole('menuitem', { name: 'Run action', exact: true }).click();
  await page.evaluate(() => ribbon.showMiniToolbar(['run'], { x: 100, y: 250 }));
  assert.equal(await page.getByRole('toolbar', { name: 'Selection formatting', exact: true }).isVisible(), true);
  await page.getByRole('toolbar', { name: 'Selection formatting', exact: true }).getByRole('menuitem', { name: 'Run action', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['launcher', 'run', 'run']);
});

test('ObservableCollection additions stay reactive after their first render', async () => {
  await setup(() => { window.items = new api.ObservableCollection([{ id: 'first', label: 'First action' }]); makeRibbon({ items }); });
  await page.evaluate(() => items.Add({ id: 'added', label: 'Added action' }));
  await flush();
  assert.equal(await control('added').isVisible(), true);
  await page.evaluate(() => { ribbon.GetControl('added').Label = 'Updated after add'; });
  await flush();
  assert.equal(await control('added').textContent(), 'Updated after add');
  await page.evaluate(() => items.RemoveAt(0));
  await flush();
  assert.equal(await control('first').count(), 0);
});

test('disconnect releases subscriptions and reattach observes model changes once', async () => {
  await setup(() => { window.command = new api.RelayCommand(() => state.calls.push('one')); makeRibbon({ items: [{ id: 'run', label: 'Before detach', command }] }); });
  const before = await page.evaluate(() => command.CanExecuteChanged.count);
  assert.ok(before >= 1);
  await page.evaluate(() => { ribbon.remove(); ribbon.GetControl('run').Label = 'While detached'; });
  assert.equal(await page.evaluate(() => command.CanExecuteChanged.count), 0);
  await page.evaluate(() => document.body.prepend(ribbon));
  await flush();
  assert.equal(await control('run').textContent(), 'While detached');
  assert.equal(await page.evaluate(() => command.CanExecuteChanged.count), before);
  await control('run').click();
  assert.deepEqual(await page.evaluate(() => state.calls), ['one']);
});

test('multiple ribbons route a shortcut only to the focused ribbon', async () => {
  await setup(() => { window.first = makeRibbon({ items: [{ id: 'first', label: 'First command', shortcut: 'Ctrl+k', command: () => state.calls.push('first') }] }); window.second = makeRibbon({ items: [{ id: 'second', label: 'Second command', shortcut: 'Ctrl+k', command: () => state.calls.push('second') }] }); first.after(second); });
  await page.locator('ribbon-web [data-control-id="first"]').focus();
  await page.keyboard.press('Control+k');
  assert.deepEqual(await page.evaluate(() => state.calls), ['first']);
  await page.evaluate(() => { state.calls = []; });
  await page.locator('ribbon-web [data-control-id="second"]').focus();
  await page.keyboard.press('Control+k');
  assert.deepEqual(await page.evaluate(() => state.calls), ['second']);
});

test('shortcuts avoid text inputs unless explicitly allowed', async () => {
  await setup(() => { makeRibbon({ items: [{ id: 'run', label: 'Run', shortcut: 'Ctrl+k', command: () => state.calls.push('run') }, { id: 'text', type: 'textbox', label: 'Typing area' }] }); });
  await input('text').focus();
  await page.keyboard.press('Control+k');
  assert.deepEqual(await page.evaluate(() => state.calls), []);
  await page.evaluate(() => ribbon.UpdateControl('run', { allowInInput: true }));
  await input('text').focus();
  await page.keyboard.press('Control+k');
  assert.deepEqual(await page.evaluate(() => state.calls), ['run']);
});

test('responsive overflow keeps hidden groups and their commands reachable', async () => {
  await setup(() => { makeRibbon({ tabs: [{ id: 'home', header: 'Home', groups: Array.from({ length: 10 }, (_, i) => ({ id: `group-${i}`, header: `Group ${i}`, priority: 10 - i, items: [{ id: `action-${i}`, label: `Wide command number ${i}`, command: () => state.calls.push(i) }] })) }] }); });
  await page.setViewportSize({ width: 390, height: 844 });
  await flush();
  assert.equal(await page.getByRole('button', { name: 'More ribbon groups', exact: true }).isVisible(), true);
  assert.ok(await page.locator('ribbon-web .panel > .group[hidden]').count() > 0);
  const group = await page.locator('ribbon-web .panel > .group[hidden]').first().getAttribute('data-group-id');
  const number = Number(group.split('-')[1]);
  await page.getByRole('button', { name: 'More ribbon groups', exact: true }).click();
  await page.getByRole('menuitem', { name: `Group ${number}`, exact: true }).click();
  await page.getByRole('menuitem', { name: `Wide command number ${number}`, exact: true }).click();
  assert.deepEqual(await page.evaluate(() => state.calls), [number]);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
});

test('markup-only custom element builds groups and controls without an imperative model', async () => {
  await setup(() => { document.body.insertAdjacentHTML('afterbegin', '<ribbon-web><ribbon-tab id="markup" header="Markup"><ribbon-group id="declarative" header="Declarative"><ribbon-button id="hello" label="Hello markup"></ribbon-button><ribbon-toggle id="toggle" label="Markup toggle"></ribbon-toggle></ribbon-group></ribbon-tab></ribbon-web>'); window.ribbon = document.querySelector('ribbon-web'); });
  assert.equal(await page.getByRole('tab', { name: 'Markup', exact: true }).isVisible(), true);
  assert.equal(await control('hello').isVisible(), true);
  await control('toggle').click();
  assert.equal(await attr(control('toggle'), 'aria-pressed'), 'true');
});

test('RibbonX browser parser and callback conformance suite', async () => {
  await setup();
  const results = await page.evaluate(async () => (await import('/tests/ribbonx.browser.js')).runRibbonXTests());
  assert.ok(results.passed >= 20, `Expected substantial RibbonX assertions, got ${results.passed}`);
  console.log(`  RibbonX: ${results.passed} assertions passed`);
});

test('showcase loads without page errors and captures desktop/mobile screenshots', async () => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${base}/examples/`);
  await page.locator('ribbon-web [role="tab"]').first().waitFor({ state: 'visible' });
  await flush();
  await page.screenshot({ path: resolve(output, 'ribbon-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await flush();
  await page.screenshot({ path: resolve(output, 'ribbon-mobile.png'), fullPage: true });
  assert.ok(await page.locator('ribbon-web [role="tab"]').count() >= 1);
});

const results = [];
try {
  for (const { name, run } of cases) {
    pageErrors = [];
    const started = performance.now();
    try {
      await run();
      assert.deepEqual(pageErrors, [], 'Unexpected page errors');
      results.push({ name, passed: true, milliseconds: Math.round(performance.now() - started) });
      console.log(`PASS ${name}`);
    } catch (error) {
      const failure = { name, passed: false, milliseconds: Math.round(performance.now() - started), message: error.stack || String(error), pageErrors: [...pageErrors] };
      results.push(failure);
      console.error(`FAIL ${name}\n${failure.message}`);
      if (!page.isClosed()) await page.screenshot({ path: resolve(output, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
    }
  }
} finally {
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify({ browser: 'chromium', passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2) + '\n');
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
const failures = results.filter(r => !r.passed);
console.log(`Browser regressions: ${results.length - failures.length}/${results.length} groups passed.`);
if (failures.length) process.exitCode = 1;
