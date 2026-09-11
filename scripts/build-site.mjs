import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const site = resolve(root, 'site');
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const exists = async (path) =>
  stat(path).then(
    () => true,
    () => false,
  );
await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
for (const name of ['examples', 'src', 'dist', 'docs']) {
  if (await exists(resolve(root, name)))
    await cp(resolve(root, name), resolve(site, name), { recursive: true });
}
if (!(await exists(resolve(site, 'examples/index.html'))))
  throw new Error('Missing examples/index.html showcase');
await writeFile(resolve(site, '.nojekyll'), '');
await writeFile(
  resolve(site, 'index.html'),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./examples/"><title>RibbonWeb showcase</title><a href="./examples/">Open the RibbonWeb showcase</a></html>\n',
);
const style =
  'body{font:16px/1.65 system-ui,sans-serif;max-width:980px;margin:56px auto;padding:0 24px;color:#172b3f;background:#f7f9fc}a{color:#165bc6}h1{letter-spacing:-.04em}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:28px;border:1px solid #dde3ec;border-radius:12px}li{margin:12px 0}small{color:#536478}';
await mkdir(resolve(site, 'downloads'), { recursive: true });
if (await exists(resolve(root, 'artifacts')))
  await cp(resolve(root, 'artifacts'), resolve(site, 'downloads'), { recursive: true });
const files = (await readdir(resolve(site, 'downloads'))).sort();
await writeFile(
  resolve(site, 'downloads/index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RibbonWeb downloads</title><style>${style}</style><a href="../examples/">← Showcase</a><h1>RibbonWeb downloads</h1><p>Native ESM library, standalone browser files, complete source and SHA-256 checksums.</p><ul>${files.map((name) => `<li><a href="./${encodeURIComponent(name)}" download>${escape(name)}</a></li>`).join('')}</ul><p><a href="../docs/">Documentation</a> · <a href="https://github.com/wieslawsoltes/RibbonWeb/releases">GitHub releases</a></p></html>`,
);
await mkdir(resolve(site, 'docs'), { recursive: true });
for (const name of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE'])
  if (await exists(resolve(root, name))) await cp(resolve(root, name), resolve(site, 'docs', name));
const docs = (await readdir(resolve(site, 'docs'))).filter((name) => name.endsWith('.md')).sort();
for (const name of docs) {
  const content = await readFile(resolve(site, 'docs', name), 'utf8');
  await writeFile(
    resolve(site, 'docs', `${name}.html`),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)} — RibbonWeb</title><style>${style}</style><a href="./">← Documentation</a><h1>${escape(name.replace('.md', ''))}</h1><p><a href="./${encodeURIComponent(name)}" download>Download Markdown</a></p><pre>${escape(content)}</pre></html>`,
  );
}
await writeFile(
  resolve(site, 'docs/index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RibbonWeb documentation</title><style>${style}</style><a href="../examples/">← Showcase</a><h1>RibbonWeb documentation</h1><ul>${docs.map((name) => `<li><a href="./${encodeURIComponent(name)}.html">${escape(name.replace('.md', ''))}</a></li>`).join('')}</ul><p><a href="../downloads/">Downloads</a></p></html>`,
);
console.log(
  'Built GitHub Pages site in site/ (showcase, native ESM, documentation and downloads).',
);
