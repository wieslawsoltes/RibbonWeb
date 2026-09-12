import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRegistryArtifact,
  fetchRegistryJson,
  integrityOf,
} from '../scripts/npm-registry.mjs';

test('npm retry validates immutable bytes and trusted public tarball origin', () => {
  const pkg = { name: '@wieslawsoltes/ribbon-web', version: '0.1.1' };
  const integrity = integrityOf(Buffer.from('verified release archive'));
  const metadata = {
    ...pkg,
    dist: {
      integrity,
      tarball: 'https://registry.npmjs.org/@wieslawsoltes/ribbon-web/-/ribbon-web-0.1.1.tgz',
    },
  };
  assert.equal(assertRegistryArtifact(metadata, pkg, integrity).host, 'registry.npmjs.org');
  assert.throws(
    () => assertRegistryArtifact(metadata, pkg, integrityOf(Buffer.from('changed archive'))),
    /different bytes/,
  );
  assert.throws(
    () =>
      assertRegistryArtifact(
        { ...metadata, dist: { ...metadata.dist, tarball: 'https://another.example/package.tgz' } },
        pkg,
        integrity,
      ),
    /Unexpected registry/,
  );
  assert.throws(
    () => assertRegistryArtifact({ ...metadata, version: '0.1.0' }, pkg, integrity),
    /version differs/,
  );
});

test('only anonymous public npm 404 means publication is absent', async () => {
  let request;
  assert.equal(
    await fetchRegistryJson('https://registry.npmjs.org/example/0.1.1', async (url, options) => {
      request = { url, options };
      return new Response(null, { status: 404 });
    }),
    null,
  );
  assert.equal(request.options.headers, undefined);
  assert.equal(request.options.redirect, 'error');
  await assert.rejects(
    fetchRegistryJson(
      'https://registry.npmjs.org/example',
      async () => new Response(null, { status: 403 }),
    ),
    (error) => error.retryable === false && /403/.test(error.message),
  );
  await assert.rejects(
    fetchRegistryJson(
      'https://registry.npmjs.org/example',
      async () => new Response(null, { status: 503 }),
    ),
    (error) => error.retryable === true && /503/.test(error.message),
  );
});

test('npm metadata failures reject malformed successful responses', async () => {
  await assert.rejects(
    fetchRegistryJson('https://registry.npmjs.org/example', async () => Response.json([])),
    /malformed metadata/,
  );
  const metadata = { name: 'example', version: '0.1.1' };
  assert.deepEqual(
    await fetchRegistryJson('https://registry.npmjs.org/example', async () =>
      Response.json(metadata),
    ),
    metadata,
  );
});
