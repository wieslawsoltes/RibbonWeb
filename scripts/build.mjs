import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const exists = async path => stat(path).then(() => true, () => false);

export async function build() {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const dist = resolve(root, 'dist');
  for (const name of ['index.js', 'core.js', 'ribbon.js', 'ribbonx.js', 'dotnet.js']) {
    if (!await exists(resolve(root, 'src', name))) throw new Error(`Missing source module: src/${name}`);
  }
  const declarations = ['index.d.ts', 'src/index.d.ts'].map(path => resolve(root, path));
  const types = (await Promise.all(declarations.map(exists))).findIndex(Boolean);
  if (types < 0) throw new Error('Missing public declarations: index.d.ts or src/index.d.ts');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(resolve(root, 'src'), dist, { recursive: true });
  await cp(declarations[types], resolve(dist, 'index.d.ts'));
  await cp(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
  await writeFile(resolve(dist, 'version.json'), JSON.stringify({ name: pkg.name, version: pkg.version, format: 'esm' }, null, 2) + '\n');
  console.log(`Built ${pkg.name}@${pkg.version}: native ESM modules and TypeScript declarations in dist/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
