/**
 * Serves `dist/` the way Cloudflare will, headers and all.
 *
 * `vite preview` ignores `public/_headers`, so it cannot show whether the content
 * security policy that ships actually lets the app work. This can, which is why the
 * browser tests run against it rather than against the preview server: a policy that
 * breaks the app then fails the suite instead of being found by hand.
 *
 * It is deliberately literal about the rest of Cloudflare's behaviour too — a directory
 * gets its `index.html`, a missing path gets `404.html` with a 404 — so a test can tell
 * a real 404 from the old single-page fallback.
 *
 *   npm run serve:dist -- 4180
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.argv[2] ?? 4180);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

/** The `/*` block of `_headers`: the ones that apply to every response. */
function globalHeaders(): Array<[string, string]> {
  const file = join(ROOT, '_headers');
  if (!existsSync(file)) return [];
  const source = readFileSync(file, 'utf8');
  const block = source.split(/^\/\*$/m)[1] ?? '';
  return [...block.matchAll(/^ {2}([A-Za-z-]+): (.+)$/gm)]
    .map((match) => [match[1], match[2]] as [string, string])
    .filter(([name]) => name !== 'Cache-Control');
}

const headers = globalHeaders();

/** Resolve a request path the way Cloudflare's asset serving does. */
function resolve(pathname: string): string | undefined {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(ROOT, safe);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, 'index.html');
    return existsSync(index) ? index : undefined;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const asDirectory = join(candidate, 'index.html');
  return existsSync(asDirectory) ? asDirectory : undefined;
}

createServer((request, response) => {
  const pathname = (request.url ?? '/').split('?')[0];
  const file = resolve(pathname);
  for (const [name, value] of headers) response.setHeader(name, value);

  if (!file) {
    const notFound = join(ROOT, '404.html');
    response.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return response.end(existsSync(notFound) ? readFileSync(notFound) : 'not found');
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
}).listen(PORT, () => {
  console.log('dist served with its shipping headers on http://localhost:%d', PORT);
});
