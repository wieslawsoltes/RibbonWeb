import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createStaticServer } from '../scripts/serve.mjs';
import { createZip } from '../scripts/package.mjs';

async function serverFixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'ribbon-web-server-'));
  const root = join(folder, 'public');
  await mkdir(join(root, 'examples'), { recursive: true });
  await writeFile(join(root, 'examples/index.html'), '<h1>Ribbon fixture</h1>');
  await writeFile(join(root, 'component.js'), 'export const ready = true;');
  await writeFile(join(root, '.env'), 'SHOULD_NOT_BE_SERVED');
  await writeFile(join(folder, 'outside.txt'), 'SHOULD_NOT_BE_SERVED');
  const server = await createStaticServer({ root, port: 0 });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  });
  return { folder, root, base: `http://127.0.0.1:${server.address().port}` };
}

test('static server serves native modules and preserves HEAD metadata', async (t) => {
  const { base } = await serverFixture(t);
  const response = await fetch(`${base}/component.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/javascript/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.text();
  assert.equal(body, 'export const ready = true;');
  const head = await fetch(`${base}/component.js`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), Buffer.byteLength(body));
  assert.equal(await head.text(), '');
});

test('static server routes the showcase and rejects unsupported methods', async (t) => {
  const { base } = await serverFixture(t);
  const response = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), './examples/');
  assert.match(await (await fetch(`${base}/examples/`)).text(), /Ribbon fixture/);
  assert.equal((await fetch(`${base}/examples`, { redirect: 'manual' })).status, 301);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  const post = await fetch(`${base}/component.js`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('static server rejects hidden paths, malformed encoding and traversal', async (t) => {
  const { base } = await serverFixture(t);
  for (const path of ['/.env', '/%2eenv', '/%2e%2e%2foutside.txt', '/..%5coutside.txt', '/%00']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, path);
    assert.doesNotMatch(await response.text(), /SHOULD_NOT_BE_SERVED/);
  }
  assert.equal((await fetch(`${base}/%zz`)).status, 400);
});

test('static server rejects symlink targets outside the public root', async (t) => {
  const { base, root, folder } = await serverFixture(t);
  try {
    await symlink(join(folder, 'outside.txt'), join(root, 'linked.txt'));
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Creating symlinks requires local permission');
      return;
    }
    throw error;
  }
  const response = await fetch(`${base}/linked.txt`);
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /SHOULD_NOT_BE_SERVED/);
});

test('release ZIP is deterministic, UTF-8 encoded and contains deflatable payloads', () => {
  const payload = Buffer.from('export const label = "Ribbon";\n');
  const files = [
    { name: 'dist/组件.js', data: payload },
    { name: 'LICENSE', data: Buffer.from('MIT') },
  ];
  const first = createZip(files);
  assert.deepEqual(first, createZip(files));
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt16LE(6), 0x0800);
  const nameSize = first.readUInt16LE(26);
  assert.equal(first.subarray(30, 30 + nameSize).toString('utf8'), 'dist/组件.js');
  assert.deepEqual(
    inflateRawSync(first.subarray(30 + nameSize, 30 + nameSize + first.readUInt32LE(18))),
    payload,
  );
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
  assert.equal(first.readUInt16LE(first.length - 12), files.length);
});

test('release ZIP rejects archive paths that can escape extraction', () => {
  for (const name of [
    '',
    '/absolute.js',
    '../outside.js',
    'dist/../../outside.js',
    'C:/outside.js',
    '..\\outside.js',
  ])
    assert.throws(() => createZip([{ name, data: Buffer.from('x') }]), /Unsafe archive path/);
});
