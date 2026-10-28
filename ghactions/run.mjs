// Runs one poll for GitHub Actions. Same poller as the Cloudflare Worker, but
// the "bucket" is a plain folder (_site) that GitHub Pages then publishes.
//
//   node ghactions/run.mjs
//
// Settings come from environment variables (see .github/workflows/poll.yml).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPoll } from '../worker/src/poller.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(process.env.SITE_DIR || path.join(ROOT, '_site'));

// Minimal stand-in for an R2 bucket, backed by files under SITE.
const bucket = {
  async get(key) {
    try {
      const text = await fs.readFile(path.join(SITE, key), 'utf8');
      return { json: async () => JSON.parse(text), text: async () => text };
    } catch { return null; }
  },
  async put(key, body) {
    const f = path.join(SITE, key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, typeof body === 'string' ? body : String(body));
  },
  async delete(key) { await fs.rm(path.join(SITE, key), { force: true }); },
};

await fs.mkdir(SITE, { recursive: true });
const out = await runPoll({ ...process.env, SCORES: bucket });

// Publish the website next to the data. On GitHub Pages the data lives on the
// same site, so the page reads it with a relative address.
await fs.copyFile(path.join(ROOT, 'web', 'index.html'), path.join(SITE, 'index.html'));
const cfg = await fs.readFile(path.join(ROOT, 'web', 'config.js'), 'utf8');
await fs.writeFile(path.join(SITE, 'config.js'), cfg.replace(/api:\s*'[^']*'/, "api: '.'"));
await fs.writeFile(path.join(SITE, '.nojekyll'), '');

console.log('poll result:', JSON.stringify(out));
for (const [sport, errs] of Object.entries(out.errors || {})) {
  for (const e of errs) console.log(`::warning title=${sport}::${e}`);
}
