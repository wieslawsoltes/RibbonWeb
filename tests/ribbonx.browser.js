import { parseRibbonXml, createRibbonXAdapter } from '../src/ribbonx.js';

/** Run in a real browser: await (await import('./tests/ribbonx.browser.js')).runRibbonXTests(). */
export async function runRibbonXTests() {
  const checks = [];
  function assert(condition, name) {
    if (!condition) throw new Error(name);
    checks.push(name);
  }
  function throws(action, name) {
    let thrown = false;
    try {
      action();
    } catch {
      thrown = true;
    }
    assert(thrown, name);
  }
  const wrap = (content) =>
    `<customUI xmlns="http://schemas.microsoft.com/office/2009/07/customui"><ribbon><tabs><tab id="home" label="Home"><group id="font" label="Font">${content}</group></tab></tabs></ribbon></customUI>`;
  const basic = parseRibbonXml(
    wrap(
      '<button id="save" label="Save"/><toggleButton id="bold" label="Bold"/><editBox id="font-name" label="Font"/>',
    ),
  );
  assert(
    basic.tabs[0].header === 'Home' && basic.tabs[0].groups[0].header === 'Font',
    'tab/group labels map to headers',
  );
  assert(
    basic.tabs[0].groups[0].items.map((item) => item.type).join(',') === 'button,toggle,textbox',
    'control types map to web vocabulary',
  );
  throws(() => parseRibbonXml('<customUI><invalid>'), 'malformed XML rejected');
  throws(() => parseRibbonXml('<!DOCTYPE test><customUI/>'), 'document type rejected');
  throws(
    () => parseRibbonXml(wrap('<button id="dup"/><button id="dup"/>')),
    'duplicate ids rejected',
  );
  throws(() => parseRibbonXml(wrap(''), {}, { maxXmlLength: 2 }), 'XML size limit enforced');
  let enabled = true;
  let pressed = false;
  let label = 'Bold';
  let loaded;
  const events = [];
  const source = wrap(
    '<toggleButton id="bold" getEnabled="enabled" getPressed="pressed" getLabel="label" onAction="toggle"/><editBox id="text" onChange="change"/>',
  ).replace('<customUI ', '<customUI onLoad="load" ');
  const adapter = createRibbonXAdapter(source, {
    enabled: () => enabled,
    pressed: () => pressed,
    label: () => label,
    toggle: (control, value) => events.push([control.id, value]),
    change: (control, value) => events.push([control.id, value]),
    load: (ui) => {
      loaded = ui;
    },
  });
  assert(loaded === adapter, 'onLoad receives invalidation API');
  const ribbon = {
    selectTab(id) {
      this.selection = id;
    },
  };
  adapter.attach(ribbon);
  const bold = adapter.model.tabs[0].groups[0].items[0];
  assert(bold.enabled && !bold.checked && bold.label === 'Bold', 'initial getter values applied');
  enabled = false;
  pressed = true;
  label = 'Strong';
  adapter.InvalidateControl('bold');
  assert(
    !bold.enabled && bold.checked && bold.label === 'Strong',
    'control invalidation refreshes state',
  );
  assert(!bold.command.CanExecute(), 'CanExecute follows disabled state');
  bold.command.Execute();
  adapter.model.tabs[0].groups[0].items[1].onChange('hello');
  assert(
    JSON.stringify(events) ===
      JSON.stringify([
        ['bold', true],
        ['text', 'hello'],
      ]),
    'action/change callback signatures',
  );
  assert(
    adapter.ActivateTab('home') && ribbon.selection === 'home',
    'ActivateTab selects attached element tab',
  );
  assert(
    !adapter.InvalidateControl('unknown') && !adapter.ActivateTab('unknown'),
    'unknown IDs return false',
  );
  const clonedBold = { ...bold, checked: false };
  bold.command(undefined, clonedBold);
  assert(events.at(-1)[1] === false, 'action callback reads normalized live control state');
  adapter.dispose();
  assert(
    !adapter.Invalidate() && !bold.command.CanExecute(),
    'disposed adapter no longer executes callbacks',
  );

  const selected = [];
  let count = 2;
  const selections = createRibbonXAdapter(
    wrap(
      '<dropDown id="fonts" getItemCount="count" getItemLabel="itemLabel" getItemID="itemId" getSelectedItemIndex="selectedIndex" onAction="select"/>',
    ),
    {
      count: () => count,
      itemLabel: (control, i) => `Font ${i}`,
      itemId: (control, i) => `font-${i}`,
      selectedIndex: () => 1,
      select: (control, id, i) => selected.push([control.id, id, i]),
    },
  );
  const fonts = selections.model.tabs[0].groups[0].items[0];
  assert(
    fonts.items.length === 2 && fonts.value === 'font-1',
    'dynamic dropdown items and initial selection',
  );
  fonts.command.Execute();
  assert(
    JSON.stringify(selected) === JSON.stringify([['fonts', 'font-1', 1]]),
    'dropdown onAction selection signature',
  );
  count = 3;
  selections.InvalidateControl('fonts');
  assert(fonts.items.length === 3, 'dropdown invalidation refreshes generated items');
  const clonedFonts = { ...fonts, value: 'font-2' };
  fonts.command(undefined, clonedFonts);
  assert(
    selected.at(-1)[1] === 'font-2' && selected.at(-1)[2] === 2,
    'dropdown callback reads normalized live selection',
  );
  selections.dispose();

  const contextModel = parseRibbonXml(
    `<customUI xmlns="http://schemas.microsoft.com/office/2009/07/customui"><ribbon><contextualTabs><tabSet idMso="TabSetPictureTools"><tab id="picture" label="Picture"><group id="picture-group" label="Picture" /></tab></tabSet></contextualTabs></ribbon></customUI>`,
  );
  assert(
    contextModel.tabs[0].contextualGroup === 'TabSetPictureTools',
    'contextual tabs use the renderer contextualGroup field',
  );
  let mirroredLabel = 'Initial';
  const mirrored = createRibbonXAdapter(wrap('<button id="mirror" getLabel="mirrorLabel"/>'), {
    mirrorLabel: () => mirroredLabel,
  });
  let liveModel;
  let renderCount = 0;
  const host = {
    set model(value) {
      liveModel = {
        ...value,
        tabs: value.tabs.map((tab) => ({
          ...tab,
          groups: tab.groups.map((group) => ({
            ...group,
            items: group.items.map((item) => ({ ...item })),
          })),
        })),
      };
    },
    get model() {
      return liveModel;
    },
    getControl(id) {
      return liveModel.tabs
        .flatMap((tab) => tab.groups)
        .flatMap((group) => group.items)
        .find((item) => item.id === id);
    },
    invalidate() {
      renderCount++;
    },
  };
  mirrored.attach(host);
  const identity = host.model;
  identity.tabs[0].header = 'Custom tab name';
  mirroredLabel = 'Updated';
  mirrored.Invalidate();
  assert(
    host.getControl('mirror').label === 'Updated',
    'invalidation updates cloned live controls',
  );
  assert(
    host.model === identity && identity.tabs[0].header === 'Custom tab name' && renderCount === 1,
    'invalidation preserves model identity and unbound customization',
  );
  mirrored.dispose();

  let menuLabel = 'First';
  const dynamic = createRibbonXAdapter(wrap('<dynamicMenu id="recent" getContent="content"/>'), {
    content: () =>
      `<menu xmlns="http://schemas.microsoft.com/office/2009/07/customui"><button id="recent-1" label="${menuLabel}"/></menu>`,
  });
  const menu = dynamic.model.tabs[0].groups[0].items[0];
  assert(menu.items[0].label === 'First', 'dynamic XML menu loaded');
  menuLabel = 'Next';
  dynamic.InvalidateControl('recent');
  assert(menu.items[0].label === 'Next', 'dynamic XML menu invalidation replaces prior IDs');
  const refreshed = await menu.getItems();
  assert(refreshed[0].label === 'Next', 'dynamic menu getItems returns control models');
  dynamic.dispose();

  const warned = parseRibbonXml(
    wrap(
      '<box id="row"><button idMso="FileSave" imageMso="FileSave"/></box><unknown id="unsupported"/>',
    ),
  );
  assert(
    warned.ribbonX.warnings.some((w) => w.code === 'flattened-layout'),
    'flattened layout explicitly warned',
  );
  assert(
    warned.ribbonX.warnings.some((w) => w.code === 'built-in-control'),
    'unimplemented built-in commands explicitly warned',
  );
  assert(
    warned.ribbonX.warnings.some((w) => w.code === 'unsupported-element'),
    'unsupported XML explicitly warned',
  );
  const callbackWarnings = parseRibbonXml(wrap('<button id="unsafe" onAction="constructor"/>'), {});
  assert(
    callbackWarnings.ribbonX.warnings.some((w) => w.code === 'missing-callback'),
    'callback lookup rejects inherited methods',
  );
  return { passed: checks.length, checks };
}
