import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'artifacts');
const exists = async path => stat(path).then(() => true, () => false);
async function walk(path, base = root) {
  if (!await exists(path)) return [];
  const info = await stat(path);
  if (info.isFile()) return [{ name: relative(base, path).replaceAll('\\', '/'), data: await readFile(path) }];
  const result = [];
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink() || ['node_modules', '.git', 'artifacts', 'site', 'bin', 'obj'].includes(entry.name)) continue;
    result.push(...await walk(resolve(path, entry.name), base));
  }
  return result;
}
const crcTable = Array.from({ length: 256 }, (_, value) => { for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
function crc32(data) { let value = 0xffffffff; for (const byte of data) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; }

/** Deterministic ZIP archive with a fixed 1980 timestamp and UTF-8 paths. */
export function createZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const file of files) {
    if (!file.name || file.name.startsWith('/') || file.name.includes('\\') || /^[A-Za-z]:/.test(file.name) || file.name.split('/').includes('..')) throw new Error('Unsafe archive path');
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.data);
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, compressed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(8, 10); header.writeUInt16LE(33, 14); header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(data.length, 24); header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + compressed.length;
  }
  if (files.length > 65535 || offset > 0xffffffff) throw new Error('Archive exceeds ZIP32 limits');
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}

export async function packageRelease() {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (!await exists(resolve(root, 'dist/index.js'))) throw new Error('Run npm run build first');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const packed = JSON.parse(result.stdout)[0];
  const browserFiles = (await Promise.all(['dist', 'src', 'examples', 'docs', 'LICENSE', 'README.md'].map(name => walk(resolve(root, name))))).flat();
  browserFiles.push({ name: 'index.html', data: Buffer.from('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0;url=./examples/"><title>RibbonWeb</title><a href="./examples/">Open the RibbonWeb showcase</a></html>\n') });
  await writeFile(resolve(output, `ribbon-web-${pkg.version}-browser.zip`), createZip(browserFiles));
  const sourceFiles = (await Promise.all(['src', 'scripts', 'examples', 'docs', 'dotnet', 'tests', '.github', 'package.json', 'package-lock.json', 'index.d.ts', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', '.gitignore'].map(name => walk(resolve(root, name))))).flat();
  await writeFile(resolve(output, `ribbon-web-${pkg.version}-source.zip`), createZip(sourceFiles));
  const manifest = { name: pkg.name, version: pkg.version, format: 'esm', npm: packed.filename, files: [] };
  for (const file of (await readdir(output)).sort()) {
    const data = await readFile(resolve(output, file));
    manifest.files.push({ name: file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  }
  await writeFile(resolve(output, 'SHA256SUMS.txt'), manifest.files.map(file => `${file.sha256}  ${file.name}`).join('\n') + '\n');
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Release artifacts: ${manifest.files.map(file => `${file.name} (${file.bytes} bytes)`).join(', ')}`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packageRelease();
