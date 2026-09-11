import { readdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function collect(dir) {
  if (
    !(await stat(dir).then(
      () => true,
      () => false,
    ))
  )
    return [];
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await collect(path)));
    else if (['.js', '.mjs', '.cjs'].includes(extname(path))) result.push(path);
  }
  return result;
}
const files = (
  await Promise.all(
    ['src', 'scripts', 'examples', 'tests'].map((name) => collect(resolve(root, name))),
  )
)
  .flat()
  .sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript modules.`);

const typecheck = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
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
    'tests/types.test.ts',
  ],
  { cwd: root, stdio: 'inherit' },
);
if (typecheck.status !== 0) process.exit(typecheck.status || 1);
