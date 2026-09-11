import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const files = [];
for (const name of (await readdir(resolve(root, 'artifacts'))).sort()) {
  if (!/\.(zip|tgz|nupkg|snupkg)$/.test(name)) continue;
  const data = await readFile(resolve(root, 'artifacts', name));
  files.push({ name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(
  resolve(root, 'artifacts/SHA256SUMS.txt'),
  files.map((f) => `${f.sha256}  ${f.name}`).join('\n') + '\n',
);
await writeFile(
  resolve(root, 'artifacts/manifest.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      format: 'esm',
      npm: files.find((f) => f.name.endsWith('.tgz'))?.name,
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Recorded SHA-256 checksums for ${files.length} distribution archives.`);
