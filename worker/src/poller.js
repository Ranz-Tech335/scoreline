// The poller runs on a schedule (Cloudflare cron every minute, or GitHub
// Actions every ~5 minutes). Visitors never reach the provider: they read the
// JSON files this writes.
//
// Each run, per sport:
//  - Fetches the provider's "live now" list when one is due (LIVE_EVERY
//    minutes since the last one) AND a match is live or about to start.
//  - Refreshes today's fixtures every TODAY_EVERY minutes, other days less.
//  - Re-fetches today at once if a match we think is live drops off the live
//    list (so finished games do not stay "live").
//  - Stops when the per-sport daily request budget is used up.
//
// "Due" is measured from the time of the last call, stored in status.json, so
// it works however irregularly the scheduler fires.

import { PROVIDERS, fetchMatches } from './providers.js';

const DAY = 864e5;
const MIN = 60e3;
export const utcDate = (ts) => new Date(ts).toISOString().slice(0, 10);
export const fileKey = (sport, date) => `scores/${sport}/${date}.json`;

async function readJson(r2, key) {
  const o = await r2.get(key);
  if (!o) return null;
  try { return await o.json(); } catch { return null; }
}
const writeJson = (r2, key, obj) =>
  r2.put(key, JSON.stringify(obj), { httpMetadata: { contentType: 'application/json' } });

const isLive = (m) => m.state === 'live' || m.state === 'interrupted';

// True when a live-list call is worth spending quota on.
export function isActive(files, now) {
  for (const f of Object.values(files)) {
    if (!f) continue;
    for (const m of f.matches) {
      if (isLive(m)) return true;
      if (m.state === 'scheduled' && m.start - now <= 10 * MIN && now - m.start <= 4 * 60 * MIN) return true;
    }
  }
  return false;
}

function sortMatches(list) {
  return list.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
}

// TOP_LEAGUES="England:Premier League,Spain:La Liga,World:UEFA Champions League"
// Empty means every league. Names must match what the provider reports.
export function leagueFilter(spec) {
  const rules = String(spec || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf(':');
    const c = i < 0 ? '*' : x.slice(0, i).trim();
    const n = i < 0 ? x : x.slice(i + 1).trim();
    return [c.toLowerCase(), n.toLowerCase()];
  });
  if (!rules.length) return () => true;
  return (lg) => rules.some(([c, n]) =>
    (c === '*' || c === '' || lg.country.toLowerCase() === c) &&
    (n === '*' || n === '' || lg.name.toLowerCase() === n));
}

export async function runPoll(env, deps = {}) {
  const now = (deps.now || Date.now)();
  const doFetch = deps.fetch || fetch;
  const r2 = env.SCORES;
  const sports = String(env.SPORTS || 'football').split(',').map((s) => s.trim()).filter((s) => PROVIDERS[s]);
  const budget = Number(env.DAILY_BUDGET || 7000);
  const today = utcDate(now);
  // A scheduler can fire a little early or late; 20 s of slack avoids skipping a slot.
  const due = (t, everyMin) => !t || now - t >= everyMin * MIN - 20e3;
  const num = (name, dflt) => Math.max(1, Number(env[name]) || dflt);
  const LIVE_EVERY = num('LIVE_EVERY', 1);     // minutes between live-list calls
  const TODAY_EVERY = num('TODAY_EVERY', 5);   // minutes between refreshes of today
  const OTHER_EVERY = num('OTHER_EVERY', 60);  // yesterday and upcoming days
  const OLD_EVERY = num('OLD_EVERY', 1440);    // older results (final)
  const keep = leagueFilter(env.TOP_LEAGUES);

  const status = (await readJson(r2, 'status.json')) || {};
  if (status.day !== today) { status.day = today; status.requests = {}; status.budgetHit = {}; }
  status.requests = status.requests || {};
  status.budgetHit = status.budgetHit || {};
  status.last = status.last || {};
  const errors = {};
  const counts = {};

  for (let i = 0; i < sports.length; i++) {
    const sport = sports[i];
    const errs = [];
    const spend = (kind) => {
      const used = status.requests[sport] || 0;
      // Live polling stops at 85% so the last requests are always left for
      // fixtures, which is what turns a finished match from "live" to "FT".
      const limit = kind === 'live' ? budget * 0.85 : budget;
      if (used >= limit) { status.budgetHit[sport] = true; return false; }
      status.requests[sport] = used + 1;
      return true;
    };
    const call = async (params) => {
      try { return (await fetchMatches(sport, params, env, doFetch)).filter((m) => keep(m.league)); }
      catch (e) { errs.push(String(e.message || e).slice(0, 240)); return null; }
    };

    const dates = [-1, 0, 1].map((o) => utcDate(now + o * DAY));
    const last = (status.last[sport] ||= { live: 0, dates: {} });
    last.dates = Object.fromEntries(Object.entries(last.dates || {}).filter(([d]) => dates.includes(d)));
    const files = {};
    for (const d of dates) files[d] = await readJson(r2, fileKey(sport, d));
    const dirty = new Set();
    const ensure = (d) => (files[d] ||= { sport, date: d, updated: now, matches: [] });

    const want = new Set();
    const yesterday = utcDate(now - DAY);
    for (const d of dates) {
      // today often; yesterday and upcoming days less; older results are final
      const every = d === today ? TODAY_EVERY : d < yesterday ? OLD_EVERY : OTHER_EVERY;
      if (!files[d] || due(last.dates[d], every)) want.add(d);
    }

    // 1. live list
    if (due(last.live, LIVE_EVERY) && isActive(files, now) && spend('live')) {
      last.live = now;
      const live = await call(PROVIDERS[sport].live);
      if (live) {
        const seen = new Set();
        for (const m of live) {
          seen.add(m.id);
          const d = utcDate(m.start);
          if (!dates.includes(d)) continue;
          const f = ensure(d);
          const at = f.matches.findIndex((x) => x.id === m.id);
          if (at >= 0) f.matches[at] = m; else f.matches.push(m);
          dirty.add(d);
        }
        // A match we show as live that the provider no longer lists as live
        // needs a fresh look at its day.
        for (const d of dates) {
          if (files[d] && files[d].matches.some((m) => isLive(m) && !seen.has(m.id))) want.add(d);
        }
      }
    }

    // 2. fixtures by date
    for (const d of want) {
      if (!spend('date')) break;
      last.dates[d] = now;
      const list = await call(PROVIDERS[sport].byDate(d));
      if (!list) continue;
      const f = ensure(d);
      f.matches = list.filter((m) => utcDate(m.start) === d);
      dirty.add(d);
    }

    // 3. write what changed (and refresh the timestamp at least every 5 min)
    for (const d of dates) {
      const f = files[d];
      if (!f) continue;
      const stale = now - (f.updated || 0) >= 5 * MIN;
      if (!dirty.has(d) && !stale) continue;
      sortMatches(f.matches);
      const next = { sport, date: d, updated: now, fetched: dirty.has(d) ? now : (f.fetched || f.updated || now), matches: f.matches };
      await writeJson(r2, fileKey(sport, d), next);
      files[d] = next;
    }

    // old files (the site shows 3 days back, so keep those)
    if (r2.delete) await r2.delete(fileKey(sport, utcDate(now - 4 * DAY)));

    counts[sport] = Object.values(files).reduce(
      (n, f) => n + (f ? f.matches.filter((m) => m.state === 'live').length : 0), 0);
    if (errs.length) errors[sport] = errs;
  }

  await writeJson(r2, 'live.json', { updated: now, enabled: sports, counts, refreshMinutes: LIVE_EVERY });
  await writeJson(r2, 'status.json', { ...status, updated: now, errors });
  return { counts, errors, requests: status.requests };
}
