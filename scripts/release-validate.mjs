import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const requested = process.env.RELEASE_VERSION || process.argv[2] || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : pkg.version);
const version = requested.replace(/^v/, '');
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) throw new Error('Provide a valid version, for example 0.1.0 or v0.1.0');
if (version !== pkg.version) throw new Error(`Release version ${version} differs from package.json ${pkg.version}. Commit the version change before releasing.`);
try { const manifest=JSON.parse(await readFile(new URL('../release.json', import.meta.url),'utf8')); if(manifest.version!==version)throw new Error('release.json must match package.json'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
if (lock.version !== version || lock.packages?.['']?.version !== version) throw new Error('package-lock.json version must match package.json');
const root = fileURLToPath(new URL('../', import.meta.url));
const tagCommit = spawnSync('git', ['rev-list', '-n', '1', `v${version}`], { cwd: root, encoding: 'utf8' });
if (tagCommit.status === 0 && tagCommit.stdout.trim()) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (head.status !== 0 || head.stdout.trim() !== tagCommit.stdout.trim()) throw new Error(`Tag v${version} points to a different commit. Check out the tagged commit before rerunning its release.`);
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\nprerelease=${version.includes('-')}\n`);
console.log(`Validated ${pkg.name}@${version} from ${fileURLToPath(new URL('../', import.meta.url))}`);
