import test from 'node:test';
import assert from 'node:assert/strict';
import { createDotNetBridge } from '../src/dotnet.js';

function element() {
  const ribbon = new EventTarget();
  ribbon.updates = [];
  ribbon.updateControl = (id, changes) => ribbon.updates.push([id, changes]);
  ribbon.setContext = (name, active) => (ribbon.context = [name, active]);
  ribbon.selectTab = (id) => (ribbon.selectedTab = id);
  return ribbon;
}
const fire = (ribbon, type, detail) => ribbon.dispatchEvent(new CustomEvent(type, { detail }));

test('bridge forwards ordered data-only events to the configured .NET method', async () => {
  const ribbon = element();
  const calls = [];
  const bridge = createDotNetBridge(
    ribbon,
    {
      async invokeMethodAsync(...args) {
        calls.push(args);
      },
    },
    { methodName: 'Receive' },
  );
  fire(ribbon, 'ribbon-command', { id: 'save', parameter: { file: 'report' }, control: ribbon });
  fire(ribbon, 'ribbon-change', { id: 'zoom', value: 125 });
  fire(ribbon, 'ribbon-tab-change', { id: 'insert', model: { secret: true } });
  await bridge.flush();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['Receive', { type: 'ribbon-command', id: 'save', parameter: { file: 'report' } }],
    ['Receive', { type: 'ribbon-change', id: 'zoom', value: 125 }],
    ['Receive', { type: 'ribbon-tab-change', id: 'insert' }],
  ]);
  bridge.dispose();
});

test('bridge excludes live objects, cycles, functions, and accessor values', async () => {
  const ribbon = element();
  const calls = [];
  const bridge = createDotNetBridge(ribbon, {
    async invokeMethodAsync(method, value) {
      calls.push(value);
    },
  });
  const parameter = { ok: false, number: Infinity, fn() {}, node: ribbon, list: [1, undefined] };
  parameter.self = parameter;
  Object.defineProperty(parameter, 'getter', {
    enumerable: true,
    get() {
      throw new Error('getter was executed');
    },
  });
  fire(ribbon, 'ribbon-command', { id: 'safe', parameter });
  await bridge.flush();
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    type: 'ribbon-command',
    id: 'safe',
    parameter: { ok: false, number: null, list: [1, null] },
  });
  bridge.dispose();
});

test('bridge mutation methods call the element and reject use after disposal', () => {
  const ribbon = element();
  const bridge = createDotNetBridge(ribbon, { invokeMethodAsync() {} });
  const model = { tabs: [] };
  bridge.setModel(model);
  bridge.setDataContext({ title: 'Report' });
  bridge.updateControl('save', { enabled: false });
  bridge.setContext('picture', 1);
  bridge.selectTab('home');
  assert.equal(ribbon.model, model);
  assert.deepEqual(ribbon.dataContext, { title: 'Report' });
  assert.deepEqual(ribbon.updates, [['save', { enabled: false }]]);
  assert.deepEqual(ribbon.context, ['picture', true]);
  assert.equal(ribbon.selectedTab, 'home');
  bridge.dispose();
  bridge.dispose();
  assert.throws(() => bridge.setModel(model), /disposed/);
});

test('rejected calls report errors and allow the next event to run', async () => {
  const ribbon = element();
  const calls = [];
  const errors = [];
  const bridge = createDotNetBridge(
    ribbon,
    {
      async invokeMethodAsync(method, payload) {
        calls.push(payload.id);
        if (payload.id === 'fail') throw new Error('Failure');
      },
    },
    {
      onError(error, payload) {
        errors.push([error.message, payload.id]);
      },
    },
  );
  fire(ribbon, 'ribbon-command', { id: 'fail' });
  fire(ribbon, 'ribbon-command', { id: 'pass' });
  await bridge.flush();
  assert.deepEqual(calls, ['fail', 'pass']);
  assert.deepEqual(errors, [['Failure', 'fail']]);
  bridge.dispose();
});

test('disposal removes listeners and cancels queued notifications', async () => {
  const ribbon = element();
  const calls = [];
  const bridge = createDotNetBridge(ribbon, {
    async invokeMethodAsync(method, payload) {
      calls.push(payload);
    },
  });
  fire(ribbon, 'ribbon-command', { id: 'queued' });
  bridge.dispose();
  fire(ribbon, 'ribbon-command', { id: 'after' });
  await bridge.flush();
  assert.deepEqual(calls, []);
});

test('bridge validates host references', () => {
  assert.throws(() => createDotNetBridge({}, {}), /element/);
  assert.throws(() => createDotNetBridge(element(), {}), /DotNetObjectReference/);
  assert.throws(
    () => createDotNetBridge(element(), { invokeMethodAsync() {} }, { methodName: '' }),
    /methodName/,
  );
});
