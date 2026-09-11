import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.ts': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.zip': 'application/zip',
    '.tgz': 'application/gzip',
  }),
);
const within = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** Local development server. Real-path checks prevent path and symlink escapes. */
export async function createStaticServer({
  root = defaultRoot,
  port = 4173,
  host = '127.0.0.1',
} = {}) {
  const serveRoot = await realpath(resolve(root));
  const server = createServer(async (request, response) => {
    const reply = (status, message) => {
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(message);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return reply(405, 'Method not allowed');
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (
        pathname.includes('\0') ||
        pathname.includes('\\') ||
        pathname.split('/').some((part) => part.startsWith('.'))
      )
        return reply(403, 'Forbidden');
      let path = resolve(serveRoot, `.${pathname}`);
      if (!within(serveRoot, path)) return reply(403, 'Forbidden');
      let info = await stat(path);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
          return response.end();
        }
        const indexPath = resolve(path, 'index.html');
        try {
          info = await stat(indexPath);
          path = indexPath;
        } catch (error) {
          if (pathname === '/' && error.code === 'ENOENT') {
            response.writeHead(302, { Location: './examples/' });
            return response.end();
          }
          throw error;
        }
      }
      if (!info.isFile()) return reply(404, 'Not found');
      path = await realpath(path);
      if (!within(serveRoot, path)) return reply(403, 'Forbidden');
      response.writeHead(200, {
        'Content-Type': mime.get(extname(path).toLowerCase()) || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(path)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch (error) {
      reply(
        error.code === 'ENOENT' || error.code === 'ENOTDIR'
          ? 404
          : error instanceof URIError
            ? 400
            : 500,
        error.code === 'ENOENT' || error.code === 'ENOTDIR'
          ? 'Not found'
          : error instanceof URIError
            ? 'Bad request'
            : 'Server error',
      );
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolvePromise);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
  };
  const port = Number(option('--port', process.env.PORT || '4173'));
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('Port must be an integer from 0 to 65535');
  const host = option('--host', '127.0.0.1');
  const root = option('--root', defaultRoot);
  const server = await createStaticServer({ root, host, port });
  console.log(`RibbonWeb server: http://${host}:${server.address().port}/`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => server.close(() => process.exit(0)));
}
