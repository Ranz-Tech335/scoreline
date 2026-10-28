import { runPoll } from './poller.js';

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Max-Age': '86400',
});

const NOT_FOUND = (env) =>
  new Response(JSON.stringify({ error: 'not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15', ...cors(env) },
  });

const SCORES = /^\/scores\/(football|tennis|volleyball|basketball)\/(\d{4}-\d{2}-\d{2})\.json$/;

export default {
  // Visitors read files that the poller wrote to R2.
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    const { pathname } = new URL(request.url);
    let key = null;
    let ttl = 15;
    const m = pathname.match(SCORES);
    if (m) key = `scores/${m[1]}/${m[2]}.json`;
    else if (pathname === '/live.json') key = 'live.json';
    else if (pathname === '/status.json') { key = 'status.json'; ttl = 30; }
    if (!key) return NOT_FOUND(env);

    const obj = await env.SCORES.get(key);
    if (!obj) return NOT_FOUND(env);

    const etag = obj.httpEtag;
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      ETag: etag,
      ...cors(env),
    };
    if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
  },

  // Runs every minute (see wrangler.toml).
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runPoll(env).catch((e) => console.error('poll failed', e)));
  },
};
