# Football (soccer) live data APIs for a livescore.cz-style site (checked 2026-10-25)

Caveat: official pricing/terms pages (api-football.com/pricing, football-data.org/coverage, sportmonks.com pricing, thesportsdb.com/pricing) were blocked by the session fetch allowlist. Figures below come from provider blog posts and third-party comparisons (dated where known); verify on official pages before committing. Several comparison sources are written by competing vendors (TheStatsAPI, Sportmonks, Goalserve) and are flagged.

## Which providers offer live scores + fixtures + results + status + goal events, and what do they cost (free tier and cheapest real-time paid plan)?

### Takeaway
API-Football (api-sports.io) is the best fit for a zero-budget start: free 100 req/day with all endpoints, $19/mo Pro for 7,500/day. football-data.org free tier is delayed and lacks African leagues. Sportmonks, Goalserve and Sportradar are far pricier; TheSportsDB is cheap but slow (2 min) for live data.

### Cited Findings
- API-Football free plan: 100 requests/day, all endpoints, no credit card; Pro $19/mo (7,500/day), Ultra $29/mo (75,000/day), Mega $39/mo (150,000/day); all plans include all endpoints — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- API-Football free tier also described as 100 req/day and 10 req/min; Pro 300 req/min; limits reset midnight UTC; coverage 1,236 leagues/cups but "uneven" outside top five European leagues (note: article is by competitor TheStatsAPI, updated June 2026) — [TheStatsAPI best football API](https://thestatsapi.com/blog/best-football-api)
- API-Football free daily limit is reportedly shared across all API-Sports products; some competitions have delays before data appears despite the 15 s claim; free users get less support — [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok)
- football-data.org free: 12 competitions, 10 calls/min, scores "slightly delayed"; paid: Livescores EUR 12/mo, Deep data EUR 29/mo, 25 competitions EUR 49/mo, 50 competitions EUR 99/mo, Pro EUR 199/mo (100 competitions, 120 calls/min). Founder has promised free competitions stay free — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api)
- football-data.org: live scores need a paid plan; free scores/schedules delayed; none of the 12 free competitions are African — [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok); [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives)
- Sportmonks: free plan = 2 leagues (Danish Superliga, Scottish Premiership); Starter EUR 29/mo (5 leagues), Growth EUR 99/mo (30), Pro EUR 249/mo (120), Enterprise custom; 14-day trial; claims "under 15 seconds latency"; 2,200+ leagues but gated by plan (as of March 2026, per competitor) — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api); Sportmonks' own page confirms the same paid prices and that trial needs a credit card — [Sportmonks vs API-Football](https://www.sportmonks.com/football-api/alternatives/api-football/)
- TheSportsDB: free key ~30 req/min and 2 results per search on free tier per one source; ~100 req/min per another (conflict); live scores "only updated every 2 minutes for paying supporters"; premium via $9/mo Patreon — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives); [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok)
- Goalserve soccer: Live Score plan $150/mo (1 mo), $800 (6 mo), $1,000 (12 mo); Full football package $550/mo; WebSockets add-on $200/mo (needs full package); 30-day free trial; formats XML/JSON; currency not stated on page — [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)
- Sportradar: no public pricing; rated $1,000+/mo by a directory; push feed as custom add-on; trial via developer portal; B2B, "not intended to be called directly from a client application" — [SportsAPIs.dev Sportradar](https://sportsapis.dev/apis/sportradar)
- SportsDataIO: free trial reportedly limited to Champions League data; another source says trial values are "scrambled"; soccer secondary to US sports; no public pricing — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api); [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok)
- Other options mentioned: OpenLigaDB (free, German-focused), StatsBomb Open Data (not live), TheStatsAPI (no free tier, 7-day trial, from $50/mo) — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives)

### Inferences
- With 100 req/day, one "live=all" poll every 15 min would exhaust the free quota; the free tier is for prototyping/caching, not real live scores. Pro at $19/mo (7,500/day ≈ one call per ~11.5 s) is the realistic cheapest real-time option; a server-side cache shared by all visitors is mandatory.
- Cheapest real-time-for-many-leagues options: API-Football Pro $19; football-data.org Livescores EUR 12 (only its limited competition set, no African leagues) — not directly comparable.

### Gaps
- Official pricing pages not fetchable; RapidAPI-listed LiveScore/Flashscore scrapers not researched (also legally dubious, scraping-based).
- Goalserve currency and Sportradar actual prices unconfirmed.

## Coverage of African football (Uganda Premier League, CAF CL/CC, AFCON) and European competitions

### Takeaway
I found no source confirming Uganda Premier League or CAF competition coverage for any provider. API-Football is the likeliest (1,200+ leagues, Algeria appears in its sample), but must be verified by calling /leagues?country=Uganda on a free key.

### Cited Findings
- API-Football claims 1,200+ leagues and cups; its guide does not describe African coverage specifically — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- Data quality is "uneven" outside top five European leagues — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api)
- football-data.org free tier has no African competitions — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives)
- Goalserve: 300-400+ football leagues, 500+ per FAQ; Uganda/CAF not mentioned; custom coverage on request — [Goalserve samples](https://www.goalserve.com/sport-data-feeds/soccer-api/samples); [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)
- Sportmonks free plan has no African league — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api)
- Big five leagues, Champions League are listed as popular Goalserve coverage — [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)

### Inferences
- Big five + UCL/UEL are covered by essentially all paid providers; Uganda/CAF is the differentiator and is unverified. Test each candidate's league list before paying. Sportmonks plans are per-league-count, so a Uganda-specific plan would need Starter (5 leagues) at minimum.

### Gaps
- Uganda Premier League, CAF Champions League, Confederation Cup, AFCON coverage not confirmed for any provider (searches returned only unrelated sites such as Soccerway/ESPN).

## Update frequency, polling vs push

### Takeaway
API-Football updates live fixtures/events every 15 s (poll only); Goalserve claims 2-4 s plus a paid WebSocket add-on; Sportmonks claims <15 s; Sportradar has an enterprise push feed.

### Cited Findings
- API-Football: /fixtures live and /fixtures/events every 15 s; statistics/players every 1 min; standings hourly — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- Goalserve: scores "updating every 2-4 seconds"; WebSockets add-on available — [Goalserve samples](https://www.goalserve.com/sport-data-feeds/soccer-api/samples); [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)
- Sportmonks "under 15 seconds latency" (vendor claim; polling details not published) — [TheStatsAPI](https://thestatsapi.com/blog/best-football-api); [Sportmonks](https://www.sportmonks.com/football-api/alternatives/api-football/)
- TheSportsDB live: 2 min refresh for paying supporters — [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok)

### Inferences
- Recommended design: one backend poller (cron/worker) calls the single "all live" endpoint every 15-30 s only while matches are in progress, stores result in memory/Redis/static JSON, and all visitors read that cache; browsers poll your own cache (or SSE) every 10-20 s. This uses 1 request per poll regardless of traffic.
- 15 s polling = 5,760 req/day, within Pro's 7,500/day if restricted to live match windows.

### Gaps
- No provider has confirmed websocket/push on cheap tiers apart from Goalserve ($200+/mo add-on) and Sportradar (enterprise).

## Terms of service: public / ad-supported use, attribution, caching

### Takeaway
Only one weak signal found: a secondary source says API-Football permits commercial use on all tiers including free. Official ToS text was not retrievable for any provider.

### Cited Findings
- API-Football: "terms allow commercial use on all tiers, including free" (secondary source) — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives); API-Football's own guide does not address commercial licensing — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- football-data.org: commercial use allowed on paid plans; free-tier terms not stated; provider says it "cannot guarantee the data to be accurate" — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives); [DEV Community](https://dev.to/checklive/navigating-the-challenges-of-free-sports-data-apis-football-basketball-and-baseball-insights-3gok)
- TheSportsDB: commercial use requires the $9/mo Patreon plan — [TheStatsAPI free alternatives](https://thestatsapi.com/blog/free-football-api-alternatives)
- Sportradar: calls should be from your backend, not client; public-display rights are contractual — [SportsAPIs.dev](https://sportsapis.dev/apis/sportradar)

### Inferences
- Safe pattern regardless of provider: call API server-side only (never expose key in browser), cache briefly, show provider attribution/logo if required by ToS. Redistribution of raw feed (public JSON mirror) is the likeliest prohibited act; rendering scores in HTML is the normal use.

### Gaps
- Attribution requirements and caching/redistribution bans not confirmed for any provider; read each ToS directly (api-sports.io terms, football-data.org terms, sportmonks terms).

## Response shape and endpoints for parsers

### Takeaway
API-Football v3 is documented enough here to write a parser; other providers' shapes were not retrieved.

### Cited Findings
- API-Football wrapper: get, parameters, errors, results, paging, response; fixture objects hold fixture ID, date and Unix timestamp, venue, referee, status (short, long, elapsed), league, teams, goals, score breakdown (halftime, fulltime, extratime, penalty) — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- Endpoints: /fixtures, /fixtures/events, /fixtures/statistics, /fixtures/lineups, /fixtures/rounds, /standings, /leagues, /countries, etc.; all live matches via fixtures?live=all; status codes 1H, HT, 2H, FT appear in the status list; headers x-ratelimit-requests-remaining and X-Ratelimit-Remaining; 429 on rate limit — [API-Football guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)

### Inferences
- From my own prior knowledge of API-Football v3 (not verified this session): host v3.football.api-sports.io, header x-apisports-key; by date: GET /fixtures?date=YYYY-MM-DD&timezone=Africa/Kampala; live: GET /fixtures?live=all (or live=39-61 league IDs). Item shape: response[].fixture.{id,timestamp,status.{long,short,elapsed}}, response[].league.{id,name,country,logo}, response[].teams.{home,away}.{id,name,logo,winner}, response[].goals.{home,away}, response[].score.{halftime,fulltime,extratime,penalty}. Other short codes: NS, 1H, HT, 2H, ET, P, FT, AET, PEN, PST, CANC, SUSP, INT, LIVE. Events: GET /fixtures/events?fixture=ID returns time.elapsed, team, player, type (Goal/Card/subst/Var), detail. Treat as unverified.

### Gaps
- football-data.org (v4 /matches, status SCHEDULED/TIMED/IN_PLAY/PAUSED/FINISHED) and Sportmonks (/v3/football/livescores) response shapes not retrieved; no sample JSON seen this session.
