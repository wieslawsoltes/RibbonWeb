import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createStaticServer } from './serve.mjs';

const project = resolve('.');
const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'ribbonweb-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd = temporary) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', timeout: 120_000 });
  assert.equal(
    result.status,
    0,
    `Consumer command failed: ${command} ${args.join(' ')} (${result.error?.message ?? result.signal ?? result.status})`,
  );
}
try {
  const index = process.argv.indexOf('--tarball');
  let tarball;
  if (index >= 0) {
    assert(process.argv[index + 1], '--tarball requires a path');
    tarball = resolve(process.argv[index + 1]);
  } else {
    const packed = spawnSync(
      npm,
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary],
      { cwd: project, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(packed.status, 0, packed.stderr || 'npm pack failed');
    tarball = join(temporary, JSON.parse(packed.stdout)[0].filename);
  }
  await writeFile(
    join(temporary, 'package.json'),
    JSON.stringify({
      name: 'ribbonweb-installed-consumer',
      version: '1.0.0',
      private: true,
      type: 'module',
    }),
  );
  run(npm, ['install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = join(temporary, 'node_modules', ...pkg.name.split('/'));
  const installedPackage = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(installedPackage.name, pkg.name);
  assert.equal(installedPackage.version, pkg.version);
  for (const entry of Object.values(installedPackage.exports)) {
    for (const path of typeof entry === 'string' ? [entry] : Object.values(entry))
      assert((await readFile(join(installed, path))).length > 0, `Missing package export: ${path}`);
  }
  assert.equal(
    JSON.parse(await readFile(join(installed, 'dist/version.json'), 'utf8')).version,
    pkg.version,
  );
  for (const name of ['styles.js', 'icons.js', 'ribbon.js'])
    assert(
      (await readFile(join(installed, 'dist', name))).length > 0,
      `Missing browser asset: ${name}`,
    );
  const esm = `import assert from 'node:assert/strict';
import * as main from ${JSON.stringify(pkg.name)};
import * as core from ${JSON.stringify(pkg.name + '/core')};
import * as ribbonx from ${JSON.stringify(pkg.name + '/ribbonx')};
import * as dotnet from ${JSON.stringify(pkg.name + '/dotnet')};
for (const [name, value] of Object.entries(core)) assert.equal(main[name], value, 'Shared core export identity: ' + name);
assert.equal(main.parseRibbonXml, ribbonx.parseRibbonXml);
assert.equal(main.createDotNetBridge, dotnet.createDotNetBridge);
const vm = new core.ObservableObject({ Title: 'Before', Enabled: true });
const target = new main.ObservableObject({ Text: '' });
const binding = main.bind(target, 'Text', vm, new core.Binding('Title', { Mode: 'TwoWay' }));
assert.equal(target.Text, 'Before'); vm.Title = 'Changed'; assert.equal(target.Text, 'Changed');
target.Text = 'Edited'; assert.equal(vm.Title, 'Edited'); binding.Dispose();
vm.Title = 'Detached'; assert.equal(target.Text, 'Edited');
const command = new core.RelayCommand(value => value * 2, () => vm.Enabled);
assert.equal(command.Execute(3), 6); vm.Enabled = false; assert.equal(command.Execute(3), undefined);
const items = new core.ObservableCollection([new main.RibbonButton({ Id: 'save', Command: command })]);
const model = new main.RibbonModel({ Tabs: [new core.RibbonTab({ Id: 'home', Groups: [new main.RibbonGroup({ Id: 'file', Items: items })] })] });
assert(model instanceof core.ObservableObject); assert.equal(model.Tabs[0].Groups[0].Items.length, 1);
items.Add(new core.RibbonButton({ Id: 'next' })); assert.equal(model.Tabs[0].Groups[0].Items.length, 2);
const { styles } = await import(new URL('./styles.js', import.meta.resolve(${JSON.stringify(pkg.name)})));
assert.match(styles, /:host/); assert.match(styles, /theme=dark/); assert.match(styles, /forced-colors/);
console.log('Installed ESM, public subpaths, class identity, MVVM bindings, commands, collections and component styles passed.');`;
  await writeFile(join(temporary, 'consumer.mjs'), esm);
  run(process.execPath, ['consumer.mjs']);
  await writeFile(
    join(temporary, 'consumer.cjs'),
    `(async () => { const assert = require('node:assert/strict'); const main = await import(${JSON.stringify(pkg.name)}); const core = await import(${JSON.stringify(pkg.name + '/core')}); assert.equal(main.ObservableObject, core.ObservableObject); assert.equal(new main.RelayCommand(x => x + 1).Execute(2), 3); })().catch(error => { console.error(error); process.exitCode = 1; });`,
  );
  run(process.execPath, ['consumer.cjs']);
  const types = `import { ObservableObject, RibbonModel, RibbonButton, RibbonElement, bind } from ${JSON.stringify(pkg.name)};
import { Binding, RelayCommand, RibbonTab, RibbonGroup, ObservableCollection } from ${JSON.stringify(pkg.name + '/core')};
import { createRibbonXAdapter, type RibbonXOptions } from ${JSON.stringify(pkg.name + '/ribbonx')};
import { createDotNetBridge, type DotNetBridge } from ${JSON.stringify(pkg.name + '/dotnet')};
const vm = new ObservableObject({ Title: 'Typed' }); const title: string = vm.Title;
const command = new RelayCommand((value: number) => value + 1);
const model = new RibbonModel({ Tabs: [new RibbonTab({ Groups: [new RibbonGroup({ Items: [new RibbonButton({ Command: command })] })] })] });
const ribbon: RibbonElement = document.createElement('ribbon-web'); ribbon.Model = model; ribbon.DataContext = vm;
const subscription = bind(new ObservableObject({ Text: '' }), 'Text', vm, new Binding('Title', { Mode: 'TwoWay' })); subscription.Dispose();
const factory: typeof createDotNetBridge = createDotNetBridge; const options: RibbonXOptions = {};
// @ts-expect-error Title is a string
vm.Title = 12;
void [title, command, factory, options, createRibbonXAdapter, ObservableCollection];`;
  await writeFile(join(temporary, 'consumer.ts'), types);
  const require = createRequire(import.meta.url);
  const compilerManifest = require.resolve('typescript/package.json');
  const compiler = JSON.parse(await readFile(compilerManifest, 'utf8'));
  run(process.execPath, [
    join(dirname(compilerManifest), compiler.bin.tsc),
    '--noEmit',
    '--strict',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--lib',
    'ES2022,DOM',
    'consumer.ts',
  ]);
  if (process.argv.includes('--browser')) {
    const { chromium } = await import('playwright');
    const server = await createStaticServer({ root: temporary, port: 0 });
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {}),
      });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await writeFile(
        join(temporary, 'index.html'),
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Installed RibbonWeb consumer</title><body></body></html>',
      );
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
      await page.evaluate(async (name) => {
        const root = '/node_modules/' + name + '/dist/';
        const main = await import(root + 'index.js');
        const core = await import(root + 'core.js');
        if (main.ObservableObject !== core.ObservableObject)
          throw Error('Browser exports duplicated core classes');
        const vm = new core.ObservableObject({ Bold: false });
        window.ribbonConsumer = vm;
        const ribbon = document.createElement('ribbon-web');
        ribbon.DataContext = vm;
        ribbon.Model = new main.RibbonModel({
          Tabs: [
            new main.RibbonTab({
              Id: 'home',
              Header: 'Home',
              Groups: [
                new core.RibbonGroup({
                  Id: 'font',
                  Header: 'Font',
                  Items: [
                    new main.RibbonToggleButton({
                      Id: 'bold',
                      Label: 'Bold',
                      Bindings: { checked: { path: 'Bold', mode: 'TwoWay' } },
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
        document.body.append(ribbon);
      }, pkg.name);
      await page.locator('ribbon-web [data-control-id="bold"]').click();
      assert.equal(await page.evaluate(() => window.ribbonConsumer.Bold), true);
      assert.equal(
        await page
          .locator('ribbon-web')
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--rw-accent').trim()),
        '#2458c6',
      );
      assert.deepEqual(errors, []);
      console.log(
        'Installed browser modules, Shadow DOM styles, shared core identity and two-way MVVM interaction passed.',
      );
    } finally {
      await browser?.close();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  }
  console.log(`Verified installed ${pkg.name}@${pkg.version} from ${tarball}.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
