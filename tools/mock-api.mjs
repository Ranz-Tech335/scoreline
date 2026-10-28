// Local stand-in for the Worker. Serves the same JSON files, with invented
// matches that progress in real time. For development only: none of this is
// real data.
//
//   node tools/mock-api.mjs            # http://localhost:8787
//   SPEED=60 node tools/mock-api.mjs   # run the match clock 60x faster
//   DISABLE=tennis node tools/mock-api.mjs   # pretend a feed is not connected

import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const SPEED = Number(process.env.SPEED || 1);
const DISABLED = String(process.env.DISABLE || '').split(',').filter(Boolean);
const MIN = 60e3;
const T0 = Date.now();
const vnow = () => T0 + (Date.now() - T0) * SPEED;
const utcDate = (ts) => new Date(ts).toISOString().slice(0, 10);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const shuffle = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const poisson = (r, l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };

const CAT = {
  football: [
    { id: 1, country: 'Uganda', name: 'Premier League', n: [3, 5], teams: ['KCCA FC', 'Vipers SC', 'Express FC', 'URA FC', 'SC Villa', 'Bright Stars', 'Police FC', 'Mbarara City', 'Busoga United', 'NEC FC'] },
    { id: 2, country: 'Africa', name: 'CAF Champions League', n: [1, 2], teams: ['Al Ahly', 'Mamelodi Sundowns', 'Wydad', 'Esperance', 'TP Mazembe', 'Simba SC', 'Young Africans', 'Pyramids'] },
    { id: 39, country: 'England', name: 'Premier League', n: [4, 5], teams: ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Man Utd', 'Tottenham', 'Newcastle', 'Aston Villa', 'Brighton', 'Brentford', 'Everton', 'Fulham'] },
    { id: 140, country: 'Spain', name: 'LaLiga', n: [2, 3], teams: ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Valencia', 'Villarreal'] },
    { id: 78, country: 'Germany', name: 'Bundesliga', n: [2, 3], teams: ['Bayern Munich', 'Dortmund', 'Leverkusen', 'RB Leipzig', 'Frankfurt', 'Freiburg'] },
  ],
  tennis: [
    { id: 1, country: 'ATP', name: 'Indoor Open', n: [4, 6], teams: ['Marchetti L.', 'Okafor T.', 'Brandvold E.', 'Kimura J.', 'Delacroix R.', 'Nakamura S.', 'Haddad Y.', 'Lindqvist O.', 'Moreau C.', 'Fernandes D.', 'Abara N.', 'Vasquez M.'] },
    { id: 2, country: 'WTA', name: 'Autumn Cup', n: [3, 5], teams: ['Ferrari G.', 'Achieng R.', 'Kowal M.', 'Santoro E.', 'Lindgren A.', 'Nasser L.', 'Duval C.', 'Okello B.'] },
  ],
  volleyball: [
    { id: 1, country: 'Italy', name: 'SuperLega', n: [2, 3], teams: ['Perugia', 'Trentino', 'Civitanova', 'Modena', 'Piacenza', 'Verona'] },
    { id: 2, country: 'Poland', name: 'PlusLiga', n: [2, 3], teams: ['Jastrzebski Wegiel', 'ZAKSA', 'Resovia', 'Projekt Warszawa', 'Skra Belchatow', 'Gdansk'] },
  ],
  basketball: [
    { id: 12, country: 'USA', name: 'NBA', n: [3, 5], teams: ['Lakers', 'Celtics', 'Warriors', 'Knicks', 'Nuggets', 'Heat', 'Bucks', 'Suns', 'Mavericks', '76ers'] },
    { id: 5, country: 'Spain', name: 'Liga ACB', n: [2, 3], teams: ['Real Madrid', 'Barcelona', 'Baskonia', 'Valencia', 'Unicaja', 'Joventut'] },
  ],
};

function plan(sport, r) {
  if (sport === 'football') {
    const mk = (n) => Array.from({ length: n }, () => ri(r, 1, 90)).sort((a, b) => a - b);
    return { h: mk(poisson(r, 1.45)), a: mk(poisson(r, 1.15)), dur: 105 };
  }
  if (sport === 'basketball') {
    const q = () => Array.from({ length: 4 }, () => ri(r, 21, 35));
    const h = q(), a = q();
    if (h.reduce((x, y) => x + y) === a.reduce((x, y) => x + y)) h[0] += 1;
    return { qh: h, qa: a, dur: 132 };
  }
  const sets = []; let hw = 0, aw = 0; const strong = r() < 0.5;
  if (sport === 'volleyball') {
    while (hw < 3 && aw < 3) {
      const target = sets.length === 4 ? 15 : 25, w = r() < (strong ? 0.58 : 0.42);
      const lo = r() < 0.2 ? target - 1 + ri(r, 0, 2) : ri(r, Math.round(target * 0.5), target - 3);
      const hi = lo >= target - 1 ? lo + 2 : target;
      sets.push(w ? { h: hi, a: lo } : { h: lo, a: hi }); w ? hw++ : aw++;
    }
    return { sets, stride: 30, setDur: 26, dur: sets.length * 30 - 4 };
  }
  while (hw < 2 && aw < 2) {
    const w = r() < (strong ? 0.62 : 0.38), x = r();
    const [hi, lo] = x < 0.18 ? [7, 6] : x < 0.38 ? [7, 5] : [6, ri(r, 0, 4)];
    sets.push(w ? { h: hi, a: lo } : { h: lo, a: hi }); w ? hw++ : aw++;
  }
  return { sets, stride: 45, setDur: 42, dur: sets.length * 45 - 3 };
}

const ANCHOR = Math.floor(T0 / (5 * MIN)) * 5 * MIN;
const ALL = [];
let seq = 1;
for (const [sport, leagues] of Object.entries(CAT)) {
  for (let slot = -2; slot <= 4; slot++) {
    let k = 0;
    for (const lg of leagues) {
      const r = rng(hash(`${sport}|${lg.id}|${slot}`));
      const n = ri(r, lg.n[0], lg.n[1]);
      const t = shuffle(r, lg.teams);
      for (let i = 0; i < n && 2 * i + 1 < t.length; i++) {
        const p = plan(sport, r);
        let off;
        if (slot === 0) { off = k % 4 === 1 ? -ri(r, 6, p.dur - 6) : ri(r, -(p.dur + 90), 330); k++; }
        else off = ri(r, -300, 540);
        off = Math.round(off / 5) * 5;
        ALL.push({ id: sport.slice(0, 2) + seq++, sport, lg, home: t[2 * i], away: t[2 * i + 1], p, start: ANCHOR + slot * 1440 * MIN + off * MIN });
      }
    }
  }
}

function setState(m, e, stride, setDur, fin) {
  const sets = m.p.sets; let wh = 0, wa = 0, cur = -1; const periods = [];
  sets.forEach((s, i) => {
    const st = i * stride, en = st + setDur;
    if (e < st) return;
    if (e >= en) { periods.push({ h: s.h, a: s.a }); s.h > s.a ? wh++ : wa++; }
    else { const f = (e - st) / setDur; cur = periods.length; periods.push({ h: Math.floor(s.h * f), a: Math.floor(s.a * f), live: true }); }
  });
  const done = e >= m.p.dur;
  return { state: done ? 'finished' : 'live', label: done ? fin : cur >= 0 ? 'Set ' + (cur + 1) : 'Break', score: [wh, wa], periods: done ? periods.map(({ h, a }) => ({ h, a })) : periods };
}

function evalMatch(m, now) {
  const e = (now - m.start) / MIN, p = m.p;
  if (e < 0) return { state: 'scheduled', label: '', score: null, periods: [] };
  if (m.sport === 'football') {
    const done = e >= 105, ht = e >= 45 && e < 60;
    const gm = e < 45 ? e : e < 60 ? 45 : e < 105 ? 45 + (e - 60) : 90;
    const c = (arr, lo, hi) => arr.filter((x) => x >= lo && x <= hi && x <= gm).length;
    const h1 = c(p.h, 0, 45), a1 = c(p.a, 0, 45), h2 = c(p.h, 46, 90), a2 = c(p.a, 46, 90);
    const periods = [{ h: h1, a: a1 }]; if (e >= 60) periods.push({ h: h2, a: a2 });
    return { state: done ? 'finished' : 'live', label: done ? 'FT' : ht ? 'HT' : Math.min(90, Math.floor(gm) + 1) + "'", score: [h1 + h2, a1 + a2], periods };
  }
  if (m.sport === 'basketball') {
    const S = [[0, 28], [32, 60], [72, 100], [104, 132]]; let H = 0, A = 0; const periods = [];
    S.forEach((s, i) => { if (e < s[0]) return; const f = e >= s[1] ? 1 : (e - s[0]) / 28; const h = Math.floor(p.qh[i] * f), a = Math.floor(p.qa[i] * f); H += h; A += a; periods.push({ h, a, ...(f < 1 ? { live: true } : {}) }); });
    const done = e >= 132; let label = 'Final';
    if (!done) { const qi = S.findIndex((s) => e >= s[0] && e < s[1]); label = qi >= 0 ? 'Q' + (qi + 1) : e < 72 ? 'Half' : 'Break'; }
    return { state: done ? 'finished' : 'live', label, score: [H, A], periods };
  }
  return m.sport === 'volleyball' ? setState(m, e, 30, 26, 'FT') : setState(m, e, 45, 42, 'Fin');
}

function toMatch(m, now) {
  const ev = evalMatch(m, now);
  return { id: m.id, sport: m.sport, start: m.start, league: { key: `${m.sport}:${m.lg.id}`, name: m.lg.name, country: m.lg.country }, home: { name: m.home }, away: { name: m.away }, ...ev };
}

const SPORTS_ON = Object.keys(CAT).filter((s) => !DISABLED.includes(s));
const SCORES = /^\/scores\/(football|tennis|volleyball|basketball)\/(\d{4}-\d{2}-\d{2})\.json$/;

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=10' });
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  const now = vnow();
  if (pathname === '/live.json') {
    const counts = {};
    for (const s of SPORTS_ON) counts[s] = ALL.filter((m) => m.sport === s && toMatch(m, now).state === 'live').length;
    return send(res, 200, { updated: Date.now(), enabled: SPORTS_ON, counts });
  }
  const m = pathname.match(SCORES);
  if (m) {
    if (!SPORTS_ON.includes(m[1])) return send(res, 404, { error: 'not found' });
    const list = ALL.filter((x) => x.sport === m[1] && utcDate(x.start) === m[2]).map((x) => toMatch(x, now)).sort((a, b) => a.start - b.start);
    if (!list.length) return send(res, 404, { error: 'not found' });
    return send(res, 200, { sport: m[1], date: m[2], updated: Date.now(), matches: list });
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`Mock API on http://localhost:${PORT} (speed ${SPEED}x, sports: ${SPORTS_ON.join(', ')})`));
