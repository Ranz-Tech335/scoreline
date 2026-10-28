// Hand-written payloads in the documented API-Sports response shapes.
// These are NOT recordings of real responses. Replace them with real
// samples once you have an API key (see README, "First tests").

const T = (iso) => Math.floor(Date.parse(iso) / 1000);

export const footballItem = (o = {}) => ({
  fixture: {
    id: o.id ?? 1001,
    date: o.date ?? '2026-10-26T15:00:00+00:00',
    timestamp: o.ts ?? T('2026-10-26T15:00:00Z'),
    status: { long: 'x', short: o.short ?? 'NS', elapsed: o.elapsed ?? null, extra: o.extra ?? null },
  },
  league: { id: o.leagueId ?? 39, name: o.leagueName ?? 'Premier League', country: o.country ?? 'England' },
  teams: { home: { id: 1, name: o.home ?? 'Liverpool' }, away: { id: 2, name: o.away ?? 'Brighton' } },
  goals: { home: o.gh ?? null, away: o.ga ?? null },
  score: {
    halftime: { home: o.hth ?? null, away: o.hta ?? null },
    fulltime: { home: o.fth ?? null, away: o.fta ?? null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
});

export const basketballItem = (o = {}) => ({
  id: o.id ?? 2001,
  date: '2026-10-26T01:00:00+00:00',
  timestamp: o.ts ?? T('2026-10-26T01:00:00Z'),
  status: { long: 'x', short: o.short ?? 'NS', timer: null },
  league: { id: 12, name: 'NBA', type: 'League', season: '2026-2027' },
  country: { id: 5, name: 'USA' },
  teams: { home: { id: 1, name: 'Lakers' }, away: { id: 2, name: 'Celtics' } },
  scores: {
    home: { quarter_1: o.h?.[0] ?? null, quarter_2: o.h?.[1] ?? null, quarter_3: o.h?.[2] ?? null, quarter_4: o.h?.[3] ?? null, over_time: o.h?.[4] ?? null, total: o.ht ?? null },
    away: { quarter_1: o.a?.[0] ?? null, quarter_2: o.a?.[1] ?? null, quarter_3: o.a?.[2] ?? null, quarter_4: o.a?.[3] ?? null, over_time: o.a?.[4] ?? null, total: o.at ?? null },
  },
});

export const volleyballItem = (o = {}) => ({
  id: o.id ?? 3001,
  date: '2026-10-26T17:00:00+00:00',
  timestamp: o.ts ?? T('2026-10-26T17:00:00Z'),
  status: { long: 'x', short: o.short ?? 'NS' },
  country: { id: 1, name: 'Italy' },
  league: { id: 7, name: 'SuperLega' },
  teams: { home: { id: 1, name: 'Perugia' }, away: { id: 2, name: 'Trentino' } },
  scores: { home: o.sh ?? null, away: o.sa ?? null },
  periods: {
    first: { home: o.p?.[0]?.[0] ?? null, away: o.p?.[0]?.[1] ?? null },
    second: { home: o.p?.[1]?.[0] ?? null, away: o.p?.[1]?.[1] ?? null },
    third: { home: o.p?.[2]?.[0] ?? null, away: o.p?.[2]?.[1] ?? null },
    fourth: { home: o.p?.[3]?.[0] ?? null, away: o.p?.[3]?.[1] ?? null },
    fifth: { home: o.p?.[4]?.[0] ?? null, away: o.p?.[4]?.[1] ?? null },
  },
});

export const envelope = (response, errors = []) => ({ get: 'fixtures', errors, results: response.length, response });
