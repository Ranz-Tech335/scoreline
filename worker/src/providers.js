// One entry per sport. Adding a provider means adding an entry here and a
// normalizer in normalize.js. Nothing else in the project changes.
//
// Tennis is intentionally missing: the research found no affordable licensed
// tennis feed. See README, "Tennis".

import { normalizeFootball, normalizeBasketball, normalizeVolleyball } from './normalize.js';

export const PROVIDERS = {
  football: {
    base: 'https://v3.football.api-sports.io',
    path: '/fixtures',
    keyVar: 'APISPORTS_KEY_FOOTBALL',
    live: { live: 'all' },
    byDate: (d) => ({ date: d, timezone: 'UTC' }),
    normalize: normalizeFootball,
  },
  basketball: {
    base: 'https://v1.basketball.api-sports.io',
    path: '/games',
    keyVar: 'APISPORTS_KEY_BASKETBALL',
    live: { live: 'all' },
    byDate: (d) => ({ date: d, timezone: 'UTC' }),
    normalize: normalizeBasketball,
  },
  volleyball: {
    base: 'https://v1.volleyball.api-sports.io',
    path: '/games',
    keyVar: 'APISPORTS_KEY_VOLLEYBALL',
    live: { live: 'all' },
    byDate: (d) => ({ date: d, timezone: 'UTC' }),
    normalize: normalizeVolleyball,
  },
};

function hasErrors(e) {
  if (!e) return false;
  if (Array.isArray(e)) return e.length > 0;
  if (typeof e === 'object') return Object.keys(e).length > 0;
  return Boolean(e);
}

// Calls the provider once and returns normalized matches.
// API-Sports answers HTTP 200 even for a bad key or an exhausted quota and
// reports the problem in an "errors" field, so that is checked too.
export async function fetchMatches(sport, params, env, doFetch) {
  const p = PROVIDERS[sport];
  const key = env[p.keyVar] || env.APISPORTS_KEY;
  if (!key) throw new Error(`No API key set for ${sport} (${p.keyVar} or APISPORTS_KEY)`);

  // PROVIDER_BASE_FOOTBALL etc. lets tests point at a local fake provider.
  const url = new URL(p.path, env['PROVIDER_BASE_' + sport.toUpperCase()] || p.base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await doFetch(url.toString(), { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`${sport}: provider returned HTTP ${res.status}`);
  const json = await res.json();
  if (hasErrors(json.errors)) {
    throw new Error(`${sport}: provider error ${JSON.stringify(json.errors).slice(0, 200)}`);
  }
  const items = Array.isArray(json.response) ? json.response : [];
  const out = [];
  for (const it of items) {
    const m = p.normalize(it);
    if (m) out.push(m);
  }
  return out;
}
