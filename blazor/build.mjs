import { readFileSync, writeFileSync } from 'node:fs';
await import('./runtime-source/blazor/build-consumer.mjs');
// The compatible component is named RibbonWeb. Keep generated imports outside
// its enclosing namespace so C# cannot resolve the type before the root namespace.
const sample = 'blazor/sample/Sample.csproj';
writeFileSync(sample, readFileSync(sample, 'utf8').replace('<RootNamespace>RibbonWeb.Blazor.Sample</RootNamespace>', '<RootNamespace>RibbonWebBlazorSample</RootNamespace>'));
for (const host of ['sample', 'server']) {
  const path = `blazor/${host}/_Imports.razor`;
  writeFileSync(path, readFileSync(path, 'utf8') + '\n@using RibbonEventArgs = global::RibbonWeb.RibbonEventArgs\n');
}
