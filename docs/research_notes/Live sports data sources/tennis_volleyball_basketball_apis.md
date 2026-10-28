# Live data APIs for TENNIS, VOLLEYBALL, BASKETBALL (livescore.cz-style site, Uganda/East Africa, near-zero budget)

Research date: 2026-10-25. Tool budget was limited and many official pages (api-sports.io pricing, api-tennis.com, balldontlie.io, api-football.com docs) were blocked by the fetch allowlist, so several items are secondary-source or unconfirmed. Treat anything marked UNCONFIRMED as needing a check on the official page.

## Tennis: which providers give live point/game/set scores for ATP, WTA, Challenger, ITF, and at what price?

### Takeaway
Goalserve is the only well-documented commercial tennis feed found with explicit ATP/WTA/Challenger/ITF live point-by-point coverage (5s updates, $150/month, 30-day trial). It is too expensive for a zero-budget launch. Cheaper options are Flashscore-scraping Apify actors (about $4 per 1,000 matches, polled) and the "sportsapipro" aggregator (free 100 req/day, but its upstream source and display terms are undisclosed). API-Tennis.com, Sportmonks tennis, TheSportsDB and an API-Sports tennis API could not be verified.

### Cited Findings
- Goalserve Tennis Package: $150/month, $900 per 6 months (body text elsewhere on the same page says $1000, internal conflict), $1200 per 12 months (listed sale price, struck-through $1500). Full all-sports package: $800/month, $3550/6 months, $4000/12 months. — [Goalserve tennis prices](https://goalserve.com/en/sport-data-feeds/tennis-api/prices)
- Goalserve tennis coverage: ATP, WTA, Challenger, ITF, Olympics, Davis Cup, Fed Cup, exhibitions, juniors, also table tennis. Includes live scores, point-by-point, live game stats, odds comparison, profiles. — [Goalserve tennis prices](https://goalserve.com/en/sport-data-feeds/tennis-api/prices)
- Goalserve freshness: live point-by-point updated every 5 seconds; live rankings every 30 minutes; start times in UTC; 99% uptime claimed; 30-day free trial. — [Goalserve tennis prices](https://goalserve.com/en/sport-data-feeds/tennis-api/prices)
- Goalserve general: formats XML and JSON; live scores refresh roughly every 2 to 4 seconds for most sports; license allows integrating and displaying data in your application but not reselling or redistributing raw feeds; free 30-day trial for all packages. — [Goalserve llms.txt](https://www.goalserve.com/llms.txt)
- Apify "Tennis Live Scores API" (appears to scrape Flashscore; the page's own error messages mention Flashscore): covers ATP, WTA, Challenger, ITF Men/Women, qualifying, singles and doubles; window 7 days back to 2 days ahead (UTC); price $0.004 per match ($4 per 1,000), $0.002 per run start, stats $0.01 per match, read 17 Aug 2026; no API key; no latency figure stated, suggests scheduling every 1-2 minutes; no point-by-point for most matches. — [Apify tennis-live-scores](https://apify.com/tagadanar/tennis-live-scores)
- Apify actor response fields (one row per match): `matchId` (stable), `status`, `statusDetail`, `currentSet`, `startTime`, `endTime`, `tournament`, `tour`, `tournamentCategory`, `surface`, `isDoubles`, `isQualification`, `homePlayer`, `awayPlayer`, `homeSets`, `awaySets`, `sets` (games per set plus tiebreak points), `score`, `winner`, `serving`, `homeGamePoints`, `awayGamePoints`; raw `statusCode` provided because `statusDetail` can be empty. — [Apify tennis-live-scores](https://apify.com/tagadanar/tennis-live-scores)
- Sportsapipro (docs.sportsapipro.com) Tennis V2: base `https://api.sportsapipro.com/v2/tennis`, auth header `x-api-key`; endpoints `/live`, `/api/today`, `/api/schedule/{date}`, `/api/rankings`, `/api/match/{id}/point-by-point`, `/statistics`, `/odds`. Doc is internally inconsistent (lists a different host `v2.tennis.sportsapipro.com`; endpoint count 88 vs category sums of 63). — [Sportsapipro tennis V2](https://docs.sportsapipro.com/api-reference/tennis-v2/overview)
- Sportsapipro tennis response: `success` + `data`; match `status` object with `type` (`notstarted`, `inprogress`, `finished`), integer `code` (in-progress = 7 + set number, so 8 = set 1, 9 = set 2, 10 = set 3), `description` (e.g. "2nd set"); set scores in `period1`..`period5`, tiebreaks separate. Tournament categories include ATP (3), WTA (6), Challenger (72), Grand Slam (-100); advises reading `tournament.category.id` from real events. ITF coverage is not stated in the page. Errors: 504 upstream_timeout (retry), 502/503 retry with backoff; recommends 30 s client timeout. — [Sportsapipro tennis V2](https://docs.sportsapipro.com/api-reference/tennis-v2/overview)
- Sportradar tennis status model: `status` values `not_started`, `match_about_to_start`, `started`, `live`, `interrupted`, `suspended`, `delayed`, `ended`, `closed`, `cancelled`, `abandoned`; `match_status` `1st_set`..`5th_set`, `walkover`, `retired`, `defaulted`; `game_state` gives point score and server; feeds named: Live Summaries, Live Timelines, Sport Event Summary, Daily Summaries; push feeds exist. Trial/pricing not on this page. — [Sportradar tennis match status workflow](https://developer.sportradar.com/tennis/docs/tennis-ig-match-status-workflow)
- Sportradar pricing generally is quote-only with a 30-day trial; third-party estimates of $500-$1,000+/month for one sport (estimate, not an official figure). — [Highlightly NBA API article](https://highlightly.net/blogs/best-nba-apis-in-2026), [api.market best sports APIs](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- AllSportsAPI (RapidAPI/api.market family) lists tennis and basketball; Lite plan $7/month for 1.4M units, 7-day trial of 150 units; volleyball not listed. — [api.market best sports APIs](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- RapidAPI free plans on the AllSportsAPI2 family have a hard limit of 50-100 requests/day, which the plugin author says is not enough for even a single-league import. Volleyball "planned, not available yet" at the time of that page (page date unknown). — [ANWP Sports API Hub setup](https://anwp.pro/docs/sports-api-hub/getting-started/api-setup/)

### Inferences
- For a public site, Goalserve is the cleanest licensed tennis source but $150/month is a big step from zero; the 30-day trial is useful for building and testing parsers.
- Scraper-based actors (Flashscore-derived) are cheap but are a legal grey area for public redistribution (upstream terms not reviewed) and are poll-only; at 1 run/minute, 24h, the per-run fee alone is about $2.88/day plus match fees, so continuous polling is not "near zero" either.
- Sportsapipro's 5-second `ttl` guidance and WebSocket mention suggest near-live freshness, but the upstream source is undisclosed, so licensing for public display is unknown.

### Gaps
- API-Tennis.com (plans, free limits, `get_livescore` fields): official site blocked by allowlist and searches returned no usable doc; UNCONFIRMED.
- Sportmonks tennis, TheSportsDB tennis live support, and any API-Sports tennis product: no sources retrieved; existence of API-Sports tennis UNCONFIRMED (the api.market article lists API-Sports as 12 sports without naming tennis).
- ITF coverage depth at Sportradar and sportsapipro: not verified.
- Public-display terms for Sportradar, sportsapipro, Apify actors: not found.

## Volleyball: which providers give live set-by-set scores for national leagues and CEV/FIVB?

### Takeaway
Only thin evidence was retrievable. Sportradar covers FIVB and CEV indoor officially (enterprise pricing only). Goalserve lists a Volleyball product (price not shown). Sportsapipro has a Volleyball V2 API with `period1`..`period5` set scores. The API-Sports volleyball API (api-volleyball) is widely known to exist but its docs and limits could not be fetched, so its details below are UNCONFIRMED.

### Cited Findings
- Sportradar Volleyball: "currently supports only indoor volleyball tournaments by FIVB and CEV"; beach volleyball planned from May 2024; CEV lineups/injuries/substitutions from May 2024; REST and WebSocket interfaces; no trial or pricing in the docs; support@sportradar.com. National leagues (Italy, Poland, Brazil, Turkey) are not mentioned on that page. — [Sportradar volleyball docs](https://docs.sportradar.com/volleyball)
- Goalserve lists a Volleyball API among its products; per-sport price and update frequency not given on the page retrieved. — [Goalserve tennis prices page (product list)](https://goalserve.com/en/sport-data-feeds/tennis-api/prices)
- Sportsapipro Volleyball V2: base `https://api.sportsapipro.com/v2/volleyball`, header `x-api-key`; `GET /v2/volleyball/live`; 115 endpoints (Live & Schedule 14, Match 26, Tournament 27, Team 15, Player 18, Manager/Referee/Venue 15); score fields `period1`..`period5` = set scores. Response schema and status codes are not documented on the overview page. — [Sportsapipro volleyball overview](https://docs.sportsapipro.com/api-reference/volleyball-v2/overview)
- Sportsapipro plans (quota shared across 25+ sports APIs, one key): Free 100 req/day $0; Pro 7,500/day $45/month; Ultra 75,000/day $89/month; Mega 150,000/day $179/month; resets midnight UTC; HTTP 429 `RATE_LIMIT_EXCEEDED`; headers `X-RateLimit-Limit/Remaining/Reset`; WebSocket traffic unmetered; each response has a `ttl` field (suggested about 5 s for live scores); no formal display or redistribution terms on the page; upstream source not named. — [Sportsapipro rate limits](https://docs.sportsapipro.com/rate-limits.md)
- AllSportsAPI2 (RapidAPI) listed volleyball as "planned" at the time of the ANWP page. — [ANWP Sports API Hub setup](https://anwp.pro/docs/sports-api-hub/getting-started/api-setup/)

### Inferences
- With only 100 requests/day on free tiers, a "live now" endpoint polled every minute would exhaust the quota in under two hours; free tiers only work with long cache intervals or WebSocket (sportsapipro WebSocket is unmetered).
- Coverage of Italy/Poland/Brazil/Turkey domestic leagues cannot be confirmed for any provider from retrieved sources.

### Gaps
- API-Sports volleyball: free limits, price, endpoint fields (expected `/games?live=all`, status short codes, per-set scores): official docs not retrievable; UNCONFIRMED.
- National league coverage lists for any provider: not found.
- Goalserve volleyball price and refresh rate: not found.

## Basketball: NBA plus EuroLeague, ACB and international

### Takeaway
For NBA-only, balldontlie's free tier (5 req/min, teams/players/games) is the cheapest legitimate start. For international leagues (EuroLeague, ACB), API-Sports Basketball (100 req/day free; paid roughly $10-$35/month per secondary reports) is the likely budget option but is unconfirmed on official pages. Sportradar and SportsDataIO are quote-only.

### Cited Findings
- balldontlie free tier: teams, players, games endpoints, 5 requests/minute. ALL-STAR $9.99/month per sport (adds player stats, injuries); GOAT $39.99/month per sport (box scores, lineups, standings, odds, props, contracts, play-by-play); All-Access $499.99/month for every sport and endpoint. — [Highlightly: best NBA APIs 2026](https://highlightly.net/blogs/best-nba-apis-in-2026)
- balldontlie covers NBA and WNBA for basketball; not tennis or volleyball; free is 5 req/min for one sport. — [api.market best sports APIs](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- API-Sports (API-NBA): free 100 requests/day; Pro $15/month, Ultra $25/month for 75,000 requests/day, Mega $35/month for 150,000; plans don't gate features; no overage (requests stop at daily limit); prepaid, no auto-renewal; NCAAB and international basketball need the separate Basketball API subscription (price not given). — [Highlightly: best NBA APIs 2026](https://highlightly.net/blogs/best-nba-apis-in-2026); conflicting phrasing: api.market says free 100/day per API, paid from $10/month and each sport billed as a separate subscription — [api.market](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- SportsDataIO: free trial 1,000 calls/month (trial data reported as scrambled in the other source); production pricing is quote-based, third-party estimate $500-$1,000+/month. — [Highlightly](https://highlightly.net/blogs/best-nba-apis-in-2026), [api.market](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- Sportradar: 30-day developer trial with real data at reduced rate limits; official NBA partnership; B2B contract. — [Highlightly](https://highlightly.net/blogs/best-nba-apis-in-2026)
- Goalserve lists an NBA API product (description page exists); per-sport price not retrieved; the cross-sport Full Package is $800/month. — [Goalserve NBA description](https://goalserve.com/en/sport-data-feeds/nba-api/description/14), [Goalserve tennis prices](https://goalserve.com/en/sport-data-feeds/tennis-api/prices)
- AllSportsAPI2 / BasketAPI1 (RapidAPI): basketball, free tier 50-100 requests/day hard limit; one RapidAPI key works across the four providers but the plugin makes the provider setting global. — [ANWP Sports API Hub setup](https://anwp.pro/docs/sports-api-hub/getting-started/api-setup/)

### Inferences
- One API-Sports account key reportedly covers its sports APIs, but api.market says each sport is a separate subscription, so "one key, shared quota" is not confirmed for API-Sports (it IS stated for sportsapipro).
- Legal status of NBA's unofficial stats.nba.com endpoints was not researched; no source retrieved. Public commercial display of them is commonly considered risky, but this is general knowledge, not a cited finding.

### Gaps
- NBA official endpoints' legal status/ToS: not retrieved.
- EuroLeague official API / ACB coverage at balldontlie or API-Sports: not verified.
- Response shapes for balldontlie (`/v1/games`) and API-Sports basketball (`/games?live=all`): not retrieved; developers should read official docs.
- Official pricing pages (api-sports.io/pricing, balldontlie.io/pricing): blocked; figures above are secondary and dated 2026 per the articles but undated precisely.

## Terms of service, caching and public display (all three sports)

### Takeaway
Little hard ToS evidence was retrievable. Goalserve explicitly permits display in your app but forbids reselling raw feeds. Sportsapipro states no display terms but gives a ttl caching hint. Everything else is UNCONFIRMED.

### Cited Findings
- Goalserve: integrate and display data in your application allowed; reselling or redistributing raw feeds not allowed. — [Goalserve llms.txt](https://www.goalserve.com/llms.txt)
- Sportsapipro: no formal display/redistribution terms on the rate-limit page; respect response `ttl` (about 5 s live, 60 s player stats, 300 s standings). — [Sportsapipro rate limits](https://docs.sportsapipro.com/rate-limits.md)
- Apify actor: seller notes the pricing is its own and data-source reliability varies across the actor pool. — [Apify tennis-live-scores](https://apify.com/tagadanar/tennis-live-scores)

### Inferences
- Free tiers of most providers commonly restrict commercial or high-traffic use, but no source retrieved confirms this for balldontlie, API-Sports or sportsapipro; verify before launch.
- To keep within free quotas, a server-side cache/proxy (one upstream poll shared by all visitors) is necessary; clients must never call the API directly.

### Gaps
- ToS pages for API-Sports, balldontlie, Sportradar, SportsDataIO, API-Tennis: not retrieved.
- Latency from Uganda: no data; a server-side proxy removes this concern for the upstream call.
