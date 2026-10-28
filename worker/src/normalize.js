// Turns provider responses into one shared match shape so the website never
// depends on a specific provider.
//
// Normalized match:
// {
//   id: 'fb123', sport, start: epoch ms,
//   league: { key: 'football:39', name, country },
//   state: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'interrupted',
//   label: "67'" | 'HT' | 'FT' | 'Q3' | 'Set 2' | 'Postp.' ...,
//   home: { name }, away: { name },
//   score: [home, away] | null,          // goals, points, or sets won
//   periods: [{ h, a, live? }, ...]      // halves, quarters or sets
// }
//
// The field names below follow the API-Sports documentation (v3 football,
// v1 basketball, v1 volleyball). They have NOT been checked against live
// responses yet. Unknown status codes become 'interrupted' so they show up
// on screen instead of silently looking like a normal match.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sum = (a) => a.reduce((p, c) => p + c, 0);

function startMs(seconds, iso) {
  if (num(seconds) !== null) return seconds * 1000;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function leagueOf(sport, l, country) {
  if (!l || l.id == null) return null;
  return {
    key: `${sport}:${l.id}`,
    name: String(l.name || 'Unknown league'),
    country: String(country || l.country || 'World'),
  };
}

function lastLive(periods, state) {
  if (state === 'live' && periods.length) periods[periods.length - 1].live = true;
  return periods;
}

/* ---------------- football (API-Football v3) ---------------- */

const FOOTBALL = {
  NS: ['scheduled'], TBD: ['scheduled', 'TBD'],
  '1H': ['live'], '2H': ['live'], ET: ['live'], LIVE: ['live'], P: ['live', 'Pen.'],
  HT: ['live', 'HT'], BT: ['live', 'Break'],
  INT: ['interrupted', 'Susp.'], SUSP: ['interrupted', 'Susp.'],
  FT: ['finished', 'FT'], AET: ['finished', 'AET'], PEN: ['finished', 'Pen'],
  AWD: ['finished', 'AWD'], WO: ['finished', 'WO'],
  PST: ['postponed', 'Postp.'], CANC: ['cancelled', 'Canc.'], ABD: ['cancelled', 'Aband.'],
};

export function normalizeFootball(it) {
  const fx = it && it.fixture;
  if (!fx || fx.id == null) return null;
  const start = startMs(fx.timestamp, fx.date);
  const lg = leagueOf('football', it.league, it.league && it.league.country);
  if (start === null || !lg || !it.teams) return null;

  const short = (fx.status && fx.status.short) || 'NS';
  const hit = FOOTBALL[short];
  const state = hit ? hit[0] : 'interrupted';
  let label = hit ? hit[1] || '' : short;
  if (state === 'live' && !label) {
    const el = num(fx.status.elapsed);
    const ex = num(fx.status.extra);
    label = el === null ? 'Live' : `${el}${ex ? '+' + ex : ''}'`;
  }

  const g = it.goals || {};
  const score = state === 'scheduled' || (num(g.home) === null && num(g.away) === null)
    ? null : [num(g.home) ?? 0, num(g.away) ?? 0];

  const periods = [];
  const sc = it.score || {};
  const ht = sc.halftime;
  if (score && ht && num(ht.home) !== null && num(ht.away) !== null) {
    periods.push({ h: ht.home, a: ht.away });
    const ft = sc.fulltime && num(sc.fulltime.home) !== null ? sc.fulltime : null;
    const secondHalfStarted = state === 'finished' || short === '2H' || short === 'ET' || short === 'P';
    if (secondHalfStarted) {
      const th = ft ? ft.home : score[0];
      const ta = ft ? ft.away : score[1];
      periods.push({ h: th - ht.home, a: ta - ht.away });
    }
  }

  return {
    id: 'fb' + fx.id, sport: 'football', start, league: lg, state, label,
    home: { name: String(it.teams.home && it.teams.home.name || '?') },
    away: { name: String(it.teams.away && it.teams.away.name || '?') },
    score, periods,
  };
}

/* ---------------- basketball (API-Basketball v1) ---------------- */

const BASKETBALL = {
  NS: ['scheduled'],
  Q1: ['live', 'Q1'], Q2: ['live', 'Q2'], Q3: ['live', 'Q3'], Q4: ['live', 'Q4'], OT: ['live', 'OT'],
  BT: ['live', 'Break'], HT: ['live', 'Half'],
  FT: ['finished', 'Final'], AOT: ['finished', 'Final OT'], AWD: ['finished', 'AWD'],
  POST: ['postponed', 'Postp.'], CANC: ['cancelled', 'Canc.'], ABD: ['cancelled', 'Aband.'],
  SUSP: ['interrupted', 'Susp.'],
};

export function normalizeBasketball(it) {
  if (!it || it.id == null) return null;
  const start = startMs(it.timestamp, it.date);
  const lg = leagueOf('basketball', it.league, it.country && it.country.name);
  if (start === null || !lg || !it.teams) return null;

  const short = (it.status && it.status.short) || 'NS';
  const hit = BASKETBALL[short];
  const state = hit ? hit[0] : 'interrupted';
  const label = hit ? hit[1] || '' : short;

  const sh = (it.scores && it.scores.home) || {};
  const sa = (it.scores && it.scores.away) || {};
  const keys = ['quarter_1', 'quarter_2', 'quarter_3', 'quarter_4', 'over_time'];
  const periods = [];
  for (const k of keys) {
    if (num(sh[k]) !== null || num(sa[k]) !== null) periods.push({ h: num(sh[k]) ?? 0, a: num(sa[k]) ?? 0 });
  }
  let score = null;
  if (state !== 'scheduled') {
    const th = num(sh.total) ?? (periods.length ? sum(periods.map((p) => p.h)) : null);
    const ta = num(sa.total) ?? (periods.length ? sum(periods.map((p) => p.a)) : null);
    if (th !== null || ta !== null) score = [th ?? 0, ta ?? 0];
  }

  return {
    id: 'bk' + it.id, sport: 'basketball', start, league: lg, state, label,
    home: { name: String(it.teams.home && it.teams.home.name || '?') },
    away: { name: String(it.teams.away && it.teams.away.name || '?') },
    score, periods: lastLive(periods, state),
  };
}

/* ---------------- volleyball (API-Volleyball v1) ---------------- */

const VOLLEYBALL = {
  NS: ['scheduled'],
  S1: ['live', 'Set 1'], S2: ['live', 'Set 2'], S3: ['live', 'Set 3'], S4: ['live', 'Set 4'], S5: ['live', 'Set 5'],
  FT: ['finished', 'FT'], AWD: ['finished', 'AWD'], WO: ['finished', 'WO'],
  POST: ['postponed', 'Postp.'], CANC: ['cancelled', 'Canc.'], ABD: ['cancelled', 'Aband.'],
  INTR: ['interrupted', 'Susp.'],
};

export function normalizeVolleyball(it) {
  if (!it || it.id == null) return null;
  const start = startMs(it.timestamp, it.date);
  const lg = leagueOf('volleyball', it.league, it.country && it.country.name);
  if (start === null || !lg || !it.teams) return null;

  const short = (it.status && it.status.short) || 'NS';
  const hit = VOLLEYBALL[short];
  const state = hit ? hit[0] : 'interrupted';
  const label = hit ? hit[1] || '' : short;

  const p = it.periods || {};
  const periods = [];
  for (const k of ['first', 'second', 'third', 'fourth', 'fifth']) {
    const x = p[k];
    if (x && (num(x.home) !== null || num(x.away) !== null)) periods.push({ h: num(x.home) ?? 0, a: num(x.away) ?? 0 });
  }
  const sc = it.scores || {};
  const score = state === 'scheduled' || (num(sc.home) === null && num(sc.away) === null)
    ? null : [num(sc.home) ?? 0, num(sc.away) ?? 0];

  return {
    id: 'vb' + it.id, sport: 'volleyball', start, league: lg, state, label,
    home: { name: String(it.teams.home && it.teams.home.name || '?') },
    away: { name: String(it.teams.away && it.teams.away.name || '?') },
    score, periods: lastLive(periods, state),
  };
}
