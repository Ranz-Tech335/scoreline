// Checks the GitHub path end to end without GitHub:
//   fake API-Football  ->  ghactions/run.mjs (3 runs)  ->  _site folder  ->  browser
// Run by hand: node test/gh-chain.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { footballItem, envelope } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreline-site-'));
const SHOT = process.env.SHOT || path.join(os.tmpdir(), 'gh-chain.png');
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

// Fake provider with three matches placed relative to now.
const now = Date.now();
const mk = (id, minsFromNow, o) => footballItem({ id, ts: Math.floor((now + minsFromNow * 60e3) / 1000), ...o });
const MATCHES = [
  mk(1, -30, { short: '1H', elapsed: 30, gh: 1, ga: 0, leagueId: 39, leagueName: 'Premier League', country: 'England', home: 'Arsenal', away: 'Chelsea' }),
  mk(2, 120, { leagueId: 400, leagueName: 'StarTimes Uganda Premier League', country: 'Uganda', home: 'KCCA FC', away: 'Vipers SC' }),
  mk(3, -200, { short: 'FT', elapsed: 90, gh: 2, ga: 2, hth: 1, hta: 1, fth: 2, fta: 2, leagueId: 140, leagueName: 'La Liga', country: 'Spain', home: 'Sevilla', away: 'Valencia' }),
];
const utc = (ms) => new Date(ms).toISOString().slice(0, 10);
const hits = { live: 0, date: 0, keys: new Set() };
const provider = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  hits.keys.add(req.headers['x-apisports-key']);
  let list;
  if (u.searchParams.get('live')) { hits.live++; list = MATCHES.filter((m) => m.fixture.status.short === '1H'); }
  else { hits.date++; const d = u.searchParams.get('date'); list = MATCHES.filter((m) => utc(m.fixture.timestamp * 1000) === d); }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(envelope(list)));
});

// Must not block: the fake provider lives in this same process.
const run = () => new Promise((resolve) => {
  const child = spawn('node', ['ghactions/run.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SITE_DIR: SITE, APISPORTS_KEY: 'test-key', PROVIDER_BASE_FOOTBALL: `http://localhost:${provider.address().port}`, SPORTS: 'football', DAILY_BUDGET: '95', LIVE_EVERY: '10', TODAY_EVERY: '120', OTHER_EVERY: '720', OLD_EVERY: '1440' },
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  child.on('close', (status) => resolve({ status, stderr: err }));
});

await new Promise((r) => provider.listen(0, r));

let r = await run();
check('run 1 exits cleanly', r.status === 0, (r.stderr || '').slice(0, 200));
const afterFirst = { ...hits };
check('run 1 fetches 7 days of fixtures and no live call', afterFirst.date === 7 && afterFirst.live === 0, `date ${afterFirst.date}, live ${afterFirst.live}`);

r = await run();
check('run 2 polls live because a match is live', hits.live === 1 && hits.date === 7, `date ${hits.date}, live ${hits.live}`);
r = await run();
check('run 3 right after makes no requests (nothing due yet)', hits.live === 1 && hits.date === 7, `date ${hits.date}, live ${hits.live}`);
check('API key is sent in the x-apisports-key header', hits.keys.has('test-key'));

const files = fs.readdirSync(path.join(SITE, 'scores', 'football'));
check('day files and site files exist', files.length >= 6 && fs.existsSync(path.join(SITE, 'index.html')) && fs.existsSync(path.join(SITE, 'live.json')), files.length + ' day files');
const cfg = fs.readFileSync(path.join(SITE, 'config.js'), 'utf8');
check("published config.js reads data from the same site (api '.')", /api:\s*'\.'/.test(cfg));
const status = JSON.parse(fs.readFileSync(path.join(SITE, 'status.json'), 'utf8'));
check('status.json records requests used', status.requests.football === hits.live + hits.date, JSON.stringify(status.requests));
const live = JSON.parse(fs.readFileSync(path.join(SITE, 'live.json'), 'utf8'));
check('live.json counts 1 live match and the refresh interval', live.counts.football === 1 && live.refreshMinutes === 10);

// Serve the published folder like GitHub Pages (under a sub-path) and open it.
const site = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://x').pathname.replace(/^\/scoreline/, '') || '/';
  if (p === '/') p = '/index.html';
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.json') ? 'application/json' : f.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'max-age=600' });
  res.end(fs.readFileSync(f));
});
await new Promise((r2) => site.listen(0, r2));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 400, height: 800 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${site.address().port}/scoreline/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.lg', { timeout: 8000 });
const text = await page.locator('#list').innerText();
check('site shows the live match with its score', /Arsenal/.test(text) && /Chelsea/.test(text));
check('site shows the upcoming and finished matches', /KCCA FC/.test(text) && /Sevilla/.test(text));
check('Uganda league is listed first', (await page.locator('.lg .cc').first().innerText()).trim().toLowerCase() === 'uganda');
const sync = await page.locator('#syncTxt').innerText();
check('sync indicator shows an update time', /updated \d\d:\d\d/i.test(sync), sync);
check('banner is hidden when data is fresh', (await page.locator('#banner:not([hidden])').count()) === 0);
await page.click('.flt[data-f="live"]');
check('Live filter shows exactly the live match', (await page.locator('.m').count()) === 1);
await page.click('.flt[data-f="all"]');
await page.screenshot({ path: SHOT });
check('no JavaScript errors', errs.length === 0, errs.join(' | '));
await browser.close(); site.close(); provider.close();
fs.rmSync(SITE, { recursive: true, force: true });
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
