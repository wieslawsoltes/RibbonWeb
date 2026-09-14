import * as engine from '../../src/index.js';
export const api = engine;
const states = new WeakMap(), functions = new WeakMap(); let functionId = 0;
function configure(ribbon, options) {
  const state = states.get(ribbon), { model = {}, modelVersion = 0, ...properties } = options;
  const plain = model && (Object.getPrototypeOf(model) === Object.prototype || Array.isArray(model));
  const signature = plain ? JSON.stringify(model, (_key, value) => { if (typeof value !== 'function') return value; if (value.templateKey) return value.templateKey; if (!functions.has(value)) functions.set(value, ++functionId); return { functionId: functions.get(value) }; }) : model;
  if (state.signature !== signature || state.version !== modelVersion) { ribbon.model = model; state.signature = signature; state.version = modelVersion; }
  for (const [name, value] of Object.entries(properties)) if (ribbon[name] !== value) ribbon[name] = value;
}
export function mount(host, options) {
  const ribbon = document.createElement('ribbon-web'); states.set(ribbon, {});
  let disposed = false;
  ribbon.Dispose = () => { if (disposed) return; disposed = true; ribbon.remove(); states.delete(ribbon); };
  try { configure(ribbon, options); host.append(ribbon); return ribbon; }
  catch (error) { ribbon.Dispose(); throw error; }
}
export function update(ribbon, options) { configure(ribbon, options); }
