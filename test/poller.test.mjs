import test from 'node:test';
import assert from 'node:assert/strict';
import { runPoll, fileKey, utcDate, leagueFilter } from '../worker/src/poller.js';
import { footballItem, envelope } from './fixtures.mjs';

// Minimal in-memory stand-in for an R2 bucket.
function memoryR2() {
  const store = new Map();
  return {
    store,
    async get(k) {
      if (!store.has(k)) return null;
      const v = store.get(k);
      return { json: async () => JSON.parse(v), text: async () => v, httpEtag: '"' + v.length + '"' };
    },
    async put(k, v) { store.set(k, typeof v === 'string' ? v : String(v)); },
    async delete(k) { store.delete(k); },
  };
}

// Fake provider: tracks calls and answers from a mutable state.
function fakeProvider(state) {
  const calls = [];
  const fetchFn = async (url) => {
    const u = new URL(url);
    calls.push(u.search);
    if (state.error) return { ok: true, json: async () => ({ errors: { token: 'Error/Missing application key' }, response: [] }) };
    if (u.searchParams.get('live')) return { ok: true, json: async () => envelope(state.live) };
    const d = u.searchParams.get('date');
    return { ok: true, json: async () => envelope(state.byDate[d] || []) };
  };
  return { calls, fetchFn };
}

const at = (iso) => Date.parse(iso);
const env = (r2, extra = {}) => ({ SCORES: r2, SPORTS: 'football', APISPORTS_KEY: 'test', DAILY_BUDGET: '1000', ...extra });
const read = async (r2, k) => JSON.parse(r2.store.get(k));

test('first run fetches seven days of fixtures and writes live.json', async () => {
  const r2 = memoryR2();
  const now = at('2026-10-26T10:03:00Z'); // 10:03, minute % 5 != 0
  const p = fakeProvider({
    live: [],
    byDate: { '2026-10-26': [footballItem({ id: 1, ts: Math.floor(at('2026-10-26T15:00:00Z') / 1000) })] },
  });
  const out = await runPoll(env(r2), { now: () => now, fetch: p.fetchFn });
  assert.equal(p.calls.length, 7); // no live call: nothing is live or about to start
  assert.ok(p.calls.every((c) => c.includes('date=')));
  const today = await read(r2, fileKey('football', '2026-10-26'));
  assert.equal(today.matches.length, 1);
  assert.equal(today.matches[0].state, 'scheduled');
  const live = await read(r2, 'live.json');
  assert.deepEqual(live.enabled, ['football']);
  assert.equal(live.counts.football, 0);
  assert.equal(out.requests.football, 7);
});

test('a live match triggers a live poll and its score is patched into the day file', async () => {
  const r2 = memoryR2();
  const kickoff = at('2026-10-26T15:00:00Z');
  const base = { id: 7, ts: Math.floor(kickoff / 1000) };
  const state = { live: [], byDate: { '2026-10-26': [footballItem(base)] } };
  const p = fakeProvider(state);

  await runPoll(env(r2), { now: () => at('2026-10-26T14:51:00Z'), fetch: p.fetchFn });
  p.calls.length = 0;

  // 14:52 is within 10 minutes of kick-off, so the live list is polled.
  state.live = [footballItem({ ...base, short: '1H', elapsed: 2, gh: 1, ga: 0 })];
  state.byDate['2026-10-26'] = state.live; // a real provider reports the same state on both endpoints
  await runPoll(env(r2), { now: () => at('2026-10-26T15:02:00Z'), fetch: p.fetchFn });
  assert.ok(p.calls.some((c) => c.includes('live=all')));
  let f = await read(r2, fileKey('football', '2026-10-26'));
  assert.equal(f.matches[0].state, 'live');
  assert.deepEqual(f.matches[0].score, [1, 0]);
  assert.equal((await read(r2, 'live.json')).counts.football, 1);

  // Next minute the score changes.
  state.live = [footballItem({ ...base, short: '1H', elapsed: 3, gh: 1, ga: 1 })];
  await runPoll(env(r2), { now: () => at('2026-10-26T15:03:00Z'), fetch: p.fetchFn });
  f = await read(r2, fileKey('football', '2026-10-26'));
  assert.deepEqual(f.matches[0].score, [1, 1]);
  assert.equal(f.matches[0].label, "3'");
});

test('a match that drops off the live list is re-checked and ends up finished', async () => {
  const r2 = memoryR2();
  const kickoff = at('2026-10-26T15:00:00Z');
  const base = { id: 9, ts: Math.floor(kickoff / 1000) };
  const state = {
    live: [footballItem({ ...base, short: '2H', elapsed: 88, gh: 2, ga: 0 })],
    byDate: { '2026-10-26': [footballItem({ ...base, short: '2H', elapsed: 88, gh: 2, ga: 0 })] },
  };
  const p = fakeProvider(state);
  await runPoll(env(r2), { now: () => at('2026-10-26T16:41:00Z'), fetch: p.fetchFn });
  assert.equal((await read(r2, fileKey('football', '2026-10-26'))).matches[0].state, 'live');

  // Final whistle: gone from the live list, date endpoint says FT.
  state.live = [];
  state.byDate['2026-10-26'] = [footballItem({ ...base, short: 'FT', elapsed: 90, gh: 2, ga: 0, hth: 1, hta: 0, fth: 2, fta: 0 })];
  p.calls.length = 0;
  await runPoll(env(r2), { now: () => at('2026-10-26T16:43:00Z'), fetch: p.fetchFn });
  const f = await read(r2, fileKey('football', '2026-10-26'));
  assert.equal(f.matches[0].state, 'finished');
  assert.equal(f.matches[0].label, 'FT');
});

test('daily budget stops upstream calls', async () => {
  const r2 = memoryR2();
  const p = fakeProvider({ live: [], byDate: {} });
  const now = at('2026-10-26T10:03:00Z');
  await runPoll(env(r2, { DAILY_BUDGET: '2' }), { now: () => now, fetch: p.fetchFn });
  assert.ok(p.calls.length <= 2);
  const status = await read(r2, 'status.json');
  assert.equal(status.budgetHit.football, true);
});

test('provider errors are recorded and do not crash the run', async () => {
  const r2 = memoryR2();
  const p = fakeProvider({ error: true });
  const out = await runPoll(env(r2), { now: () => at('2026-10-26T10:03:00Z'), fetch: p.fetchFn });
  assert.ok(out.errors.football.length > 0);
  assert.match(out.errors.football[0], /provider error/);
  assert.equal((await read(r2, 'status.json')).errors.football.length > 0, true);
});

test('missing key is reported', async () => {
  const r2 = memoryR2();
  const p = fakeProvider({ live: [], byDate: {} });
  const out = await runPoll({ SCORES: r2, SPORTS: 'football' }, { now: () => at('2026-10-26T10:03:00Z'), fetch: p.fetchFn });
  assert.match(out.errors.football[0], /No API key/);
  assert.equal(p.calls.length, 0);
});

test('utcDate uses UTC, not local time', () => {
  assert.equal(utcDate(at('2026-10-26T23:30:00Z')), '2026-10-26');
  assert.equal(utcDate(at('2026-10-27T00:10:00Z')), '2026-10-27');
});

test('LIVE_EVERY spaces out live-list calls', async () => {
  const r2 = memoryR2();
  const kickoff = at('2026-10-26T15:00:00Z');
  const base = { id: 21, ts: Math.floor(kickoff / 1000) };
  const state = { live: [footballItem({ ...base, short: '1H', elapsed: 5, gh: 0, ga: 0 })], byDate: { '2026-10-26': [footballItem({ ...base, short: '1H', elapsed: 5, gh: 0, ga: 0 })] } };
  const p = fakeProvider(state);
  const e = env(r2, { LIVE_EVERY: '3', TODAY_EVERY: '1000', OTHER_EVERY: '1000' });
  await runPoll(e, { now: () => at('2026-10-26T15:05:00Z'), fetch: p.fetchFn }); // first run loads days
  p.calls.length = 0;
  let live = 0;
  for (let m = 6; m <= 11; m++) {
    await runPoll(e, { now: () => at(`2026-10-26T15:${String(m).padStart(2, '0')}:00Z`), fetch: p.fetchFn });
  }
  live = p.calls.filter((c) => c.includes('live=all')).length;
  assert.equal(live, 2); // minutes 15:06 and 15:09 only
});

test('TOP_LEAGUES keeps only the listed leagues', async () => {
  const r2 = memoryR2();
  const ts = Math.floor(at('2026-10-26T15:00:00Z') / 1000);
  const p = fakeProvider({ live: [], byDate: { '2026-10-26': [
    footballItem({ id: 31, ts, leagueId: 39, leagueName: 'Premier League', country: 'England' }),
    footballItem({ id: 32, ts, leagueId: 99, leagueName: 'Some Minor Cup', country: 'Nowhere' }),
  ] } });
  await runPoll(env(r2, { TOP_LEAGUES: 'England:Premier League' }), { now: () => at('2026-10-26T10:03:00Z'), fetch: p.fetchFn });
  const f = await read(r2, fileKey('football', '2026-10-26'));
  assert.deepEqual(f.matches.map((m) => m.id), ['fb31']);
});

test('leagueFilter matching rules', () => {
  const all = leagueFilter('');
  assert.equal(all({ country: 'X', name: 'Y' }), true);
  const f = leagueFilter('England:Premier League, World:UEFA Champions League, La Liga');
  assert.equal(f({ country: 'england', name: 'premier league' }), true);
  assert.equal(f({ country: 'World', name: 'UEFA Champions League' }), true);
  assert.equal(f({ country: 'Spain', name: 'La Liga' }), true);   // name only
  assert.equal(f({ country: 'England', name: 'Premier League 2' }), false); // exact, not substring
});

test('files record when data was last fetched, not just rewritten', async () => {
  const r2 = memoryR2();
  const p = fakeProvider({ live: [], byDate: {} });
  await runPoll(env(r2), { now: () => at('2026-10-26T10:03:00Z'), fetch: p.fetchFn });
  const f = await read(r2, fileKey('football', '2026-10-26'));
  assert.equal(f.fetched, at('2026-10-26T10:03:00Z'));
});
