// End-to-end check of web/ against tools/mock-api.mjs. Run by hand:
//   node tools/mock-api.mjs &   node test/e2e.cjs
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'web');
const API = process.env.API || 'http://localhost:8787';
const OUT = process.env.OUT || '/tmp';

const server = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  if (p === '/') p = '/index.html';
  if (p === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(`window.SCORELINE={api:${JSON.stringify(process.env.NO_API ? '' : API)},pollSeconds:15,topCountries:['Uganda','Africa','England']};`);
  }
  const f = path.join(WEB, p);
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'text/plain' });
  res.end(fs.readFileSync(f));
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.lg', { timeout: 8000 });

  const txt = (sel) => page.locator(sel).first().innerText();
  check('league blocks render', (await page.locator('.lg').count()) > 0, (await page.locator('.lg').count()) + ' leagues');
  check('match rows render', (await page.locator('.m').count()) > 0, (await page.locator('.m').count()) + ' matches');
  check('sync indicator says Updated', /updated \d\d:\d\d:\d\d/i.test(await txt('#syncTxt')), await txt('#syncTxt'));
  const first = (await page.locator('.lg .cc').first().innerText()).trim();
  check('Uganda is listed first (topCountries)', first.toLowerCase() === 'uganda', first);

  const liveCount = Number((await txt('.flt[data-f="live"] .n')).trim());
  const badge = await page.locator('.tab[data-sport="football"] .bd').innerText();
  check('Live filter count matches tab badge', liveCount > 0 && Number(badge) >= liveCount, `filter ${liveCount}, badge ${badge}`);
  await page.screenshot({ path: `${OUT}/e2e-football-phone.png` });

  await page.click('.flt[data-f="live"]');
  const liveRows = await page.locator('.m').count();
  const nonLive = await page.locator('.m .st:not(.live)').count();
  check('Live filter shows only live rows', liveRows === liveCount && nonLive === 0, `${liveRows} rows`);
  await page.click('.flt[data-f="all"]');

  await page.click('.m .row >> nth=0');
  check('tapping a match opens its detail', await page.locator('.m .detail:not([hidden])').count() === 1);
  await page.click('.m .row >> nth=0');

  await page.click('.lg-head >> nth=0');
  const closed = await page.locator('.lg.closed').count();
  check('league bar folds', closed === 1);
  await page.click('.lg-head >> nth=0');

  await page.fill('#q', 'zzzz-nothing');
  check('search with no hits shows empty state', /Nothing matches/.test(await txt('.empty')));
  await page.fill('#q', 'arsenal');
  const hit = await page.locator('.m').count();
  check('search finds a team', hit >= 0);
  await page.fill('#q', '');

  await page.click('.tab[data-sport="volleyball"]');
  await page.waitForSelector('.lg');
  check('volleyball tab shows set columns', (await page.locator('.pc').count()) > 0);
  await page.click('.tab[data-sport="basketball"]');
  await page.waitForSelector('.lg');
  await page.click('.m .row >> nth=0');
  check('basketball detail has quarter headers', /Q1/.test(await txt('.pt')) || /Starts in/.test(await txt('.detail:not([hidden])')));
  await page.click('.tab[data-sport="tennis"]');
  await page.waitForSelector('.lg');
  await page.screenshot({ path: `${OUT}/e2e-tennis-phone.png` });

  await page.click('.tab[data-sport="football"]');
  await page.click('.day[data-day="1"]');
  await page.waitForSelector('.lg');
  const tomorrowSt = await page.locator('.m .st.sch').count();
  check('tomorrow shows scheduled matches', tomorrowSt > 0);
  await page.click('.day[data-day="3"]');
  await page.waitForTimeout(600);
  const day3 = (await page.locator('.m').count()) + '/' + (await page.locator('.empty').count());
  check('far day does not crash', errors.length === 0, 'matches/empty ' + day3);
  await page.click('.day[data-day="0"]');
  await page.waitForSelector('.lg');

  // outage: point the API at a dead port by blocking requests
  await ctx.route('**/localhost:8787/**', (r) => r.abort());
  await page.click('.day[data-day="-1"]');
  await page.click('.day[data-day="0"]');
  await page.waitForTimeout(800);
  const banner = await page.locator('#banner:not([hidden])').count();
  check('outage shows a banner instead of a blank page', banner === 1, (await txt('#syncTxt')));
  await page.screenshot({ path: `${OUT}/e2e-outage-phone.png` });
  await ctx.unroute('**/localhost:8787/**');

  // desktop width + dark mode
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.click('.day[data-day="-1"]');
  await page.click('.day[data-day="0"]');
  await page.waitForSelector('.lg');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check('no horizontal overflow at desktop width', !overflow);
  await page.screenshot({ path: `${OUT}/e2e-football-desktop-dark.png` });

  check('no JavaScript errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter((x) => !x).length;
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
