# Multi-sport live data providers for a livescore.cz-style site (football, tennis, volleyball, basketball) — checked 2026-10-25

Coverage note: ~20 tool calls. Several official pages were blocked by the fetch allowlist or failed (api-sports.io/pricing, api-football.com/terms, sportdevs.com/pricing, TheSportsDB docs, Sportradar/Enetpulse/LSports pricing). Those items are listed under Gaps, not guessed.

## 1. Which single provider (or minimal combination) covers all four sports, and what do plans cost?

### Takeaway
No fully verified "one integration, all four sports, real-time, commercially licensed, student-affordable" option was found. API-Sports (cheap, $19-$39/mo) is the best budget candidate but I could not verify tennis coverage or its commercial-display terms. Goalserve is the best verified all-sports vendor but starts at $800/mo for all sports. Sportradar and SportsDataIO are enterprise-priced. Sportmonks is football/cricket/F1 only.

### Cited Findings
- API-Sports plans: Free $0 / 100 req/day; Pro $19 / 7,500; Ultra $29 / 75,000; Mega $39 / 150,000; Custom up to 1,500,000/day. Page says "All our plans include all competitions and endpoints." Prepaid, no auto-renew, exceeding quota stops requests (no overage charge). — [API-Football pricing](https://www.api-football.com/pricing) (checked 2026-10-25)
- Free plan is limited in available seasons; a beginner's guide says all endpoints are on free incl. live endpoints (`live=all`), but only 100 requests/day. Per-minute cap exists on all plans (number not stated). — [API-Football beginner guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- The API-Football pricing page lists multiple sports (Football, Basketball, NFL, others) but does not say whether one subscription covers all sports. — [API-Football pricing](https://www.api-football.com/pricing)
- Sportmonks football plans: Starter EUR29/mo (5 leagues), Growth EUR99 (30), Pro EUR249 (120), Enterprise custom (all 2,300+). Rate limit 2,000-5,000 calls per entity per hour. 14-day trial; livescores in all plans. Cricket and F1 are separate APIs; no basketball/tennis/volleyball. — [Sportmonks pricing](https://www.sportmonks.com/football-api/plans-pricing/); sports list corroborated by [Highlightly comparison (competitor content)](https://highlightly.net/blogs/top-sports-data-apis-in-2025)
- Goalserve (USD, currency not stated on page): Football Live Score $150/mo; Full football package $550/mo; Full package all sports $800/mo (6 mo $3,550; 12 mo $4,000). WebSocket add-on $200/mo. 30-day free trial. No request limits stated. — [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)
- Goalserve claims 20+ sports, 99% uptime, 2-4 s live score refresh (vendor claim, unverified; describes refresh, not end-to-end latency). — [Goalserve blog](https://www.goalserve.com/blog/which-are-the-fastest-soccer-api-providers)
- Sportradar: pricing not public, enterprise contracts, rated $1,000+/mo by a directory; 50+ sports incl. soccer and tennis; trial via marketplace; B2B APIs meant to be called from a backend. — [sportsapis.dev Sportradar review](https://sportsapis.dev/apis/sportradar) (directory with affiliate relationships)
- SportsDataIO: quotes per client based on leagues/feeds/use case, minimum license fees apply, call volume does not affect price; free Discovery Lab is personal non-commercial only. — [SportsDataIO data rights FAQ](https://sportsdata.io/help/data-rights-and-licensing-questions)
- SportriX: soccer, basketball, tennis, volleyball (plus ice hockey, cricket, American football); no public prices, no free tier. — [sportsapis.dev SportriX](https://sportsapis.dev/apis/sportrix)
- SportsAPIPro (a different vendor, easily confused with API-Sports): Free $0 / 100; Pro $45 / 7,500; Ultra $89 / 75,000; Mega $179 / 150,000; 25+ sports incl. football, basketball, tennis; WebSocket traffic unmetered; daily quota shared across all sports. — [SportsAPIPro rate limits](https://docs.sportsapipro.com/rate-limits.md)
- TheSportsDB: described by a third party as free/low-cost with no real-time updates. — [Highlightly comparison](https://highlightly.net/blogs/top-sports-data-apis-in-2025) (competitor content; weak source)
- iSports API claims 2,000+ football leagues, 800 basketball leagues, <10 s live latency, 15-day trial; no prices published; vendor marketing. — [IndieHackers post by vendor](https://www.indiehackers.com/post/2026-developer-checklist-how-to-choose-the-best-sports-api-9WKLRfoF7rLmLsjVgSoE)

### Inferences
- Cheapest realistic all-four-sports real-time route: API-Sports Pro/Ultra ($19-$29/mo) IF each sport is covered and a separate subscription per sport is not required. Prior knowledge (not verified today): API-Sports sells separate per-sport APIs (football, basketball, volleyball, etc.) and I do not recall a tennis API. If true, the minimal combination is API-Sports (football, basketball, volleyball) + a second provider for tennis. Verify on the dashboard before building.
- Cheapest verified all-sports vendor: Goalserve at $800/mo monthly ($4,000/yr, about $333/mo), far above a student budget. A football-only Goalserve live feed is $150/mo.
- Cost by scale for central polling is mostly flat, since visitors hit your cache, not the provider (see section 2): prototype $0-$19/mo, growing $19-$29/mo (Pro or Ultra), large $29-$39/mo on Mega or Custom if API-Sports terms permit. Real costs at scale are hosting/bandwidth and, more importantly, licensing (section 3). These tiers are my estimate, not vendor-quoted.

### Gaps
- Official API-Sports pricing at api-sports.io and per-sport subscription structure: page blocked by allowlist.
- Whether API-Sports (or any listed cheap provider) offers tennis: not verified.
- Enetpulse, LSports/Betradar, Sportdevs, Highlightly pricing: not obtained (Sportdevs page blocked; others no usable source). Betradar/LSports are betting-oriented enterprise feeds, likely out of student range (unverified).
- RapidAPI "livescore" listings: not individually evaluated; these are typically resellers of scraped data (unverified).

## 2. Upstream request math for central polling (15-60 s) and which plans sustain it

### Takeaway
One bulk "all live matches" call per sport per interval makes upstream usage independent of visitor count. 4 sports at 60 s all day = 5,760/day; at 30 s = 11,520/day; at 15 s = 23,040/day. Free (100/day) cannot sustain it; Pro (7,500) covers 60 s round-the-clock; Ultra (75,000) covers 15 s round-the-clock with headroom.

### Cited Findings
- Quotas for API-Sports: Free 100, Pro 7,500, Ultra 75,000, Mega 150,000 requests/day. — [API-Football pricing](https://www.api-football.com/pricing)
- Live endpoints exist as bulk queries (e.g. `fixtures?live=all`). — [API-Football beginner guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- Sportmonks limits are per entity per hour (2,000-5,000), not daily, so central polling fits easily. — [Sportmonks pricing](https://www.sportmonks.com/football-api/plans-pricing/)
- Goalserve states no request limits. — [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)

### Inferences
Calculation (requests/day = 86,400 / interval x sports; assumes one bulk call per sport):
| Interval | 24 h, 4 sports | 12 h active window, 4 sports |
|---|---|---|
| 60 s | 5,760 | 2,880 |
| 30 s | 11,520 | 5,760 |
| 15 s | 23,040 | 11,520 |
- Add overhead for fixtures-by-date, standings, and match-detail calls (events, lineups, stats): budget +20-50% (my estimate). Smarter: poll only sports with live matches, and drop to slow polling when nothing is live; this can cut usage 50%+.
- Plan fit: 60 s and 30 s (12 h window) fit Pro; 30 s 24 h and 15 s 12 h need Ultra; 15 s 24 h fits Ultra (23k of 75k). Mega only needed with detail-heavy polling per match.
- Visitors: 100,000 visitors/day add zero upstream requests if served from your cache/CDN; the cost shifts to bandwidth. Mobile-friendly design for East Africa (small JSON deltas, gzip, 15-30 s client polling or SSE) matters more than provider tier.
- If a provider's per-minute cap is low (API-Sports number not found), 4 calls per cycle is still far below any plausible cap.

### Gaps
- API-Sports per-minute limit value: not found.
- Whether bulk live endpoints exist for volleyball and tennis on any candidate: not verified.

## 3. Licensing: public display, caching, redistribution, attribution

### Takeaway
Terms are the main risk. Enterprise vendors (SportsDataIO) allow caching and public display only under a commercial license with required attribution. API-Sports' terms could not be read. SportsAPIPro (cheap reseller-looking vendor) explicitly bars public republishing of its data, which would rule it out for this site.

### Cited Findings
- SportsDataIO: public-facing products need a commercial license; ingesting/caching/storing responses on your infrastructure is allowed for the licensed product; reselling the feed as a standalone data product is not; attribution required, wording set in agreement; free Discovery Lab is personal non-commercial only. — [SportsDataIO data rights](https://sportsdata.io/help/data-rights-and-licensing-questions)
- SportsAPIPro: "Publicly republishing the data" is barred; internal caching allowed; redistribution/bulk access to third parties not allowed; no provenance attribution in public products. — [SportsAPIPro data rights](https://docs.sportsapipro.com/data-rights)
- Sportradar B2B APIs are "not intended to be called directly from a client application", i.e. backend caching is the intended pattern; contract terms are custom. — [sportsapis.dev Sportradar](https://sportsapis.dev/apis/sportradar)
- API-Football pricing page and guide both defer to Terms of use without giving content. — [pricing](https://www.api-football.com/pricing), [guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- Goalserve page defers to its Terms and conditions, not retrieved. — [Goalserve prices](https://goalserve.com/es/sport-data-feeds/soccer-api/prices)

### Inferences
- A public livescore site that serves cached data to thousands of users is a "public display" use, so it needs a plan whose terms explicitly allow commercial/public display. Free tiers and "personal/non-commercial" tiers likely will not qualify (SportsDataIO's does not).
- Before paying, email the provider and get written confirmation of: public website display, server-side caching, ads on the page, and logo/attribution requirements.
- Competition-level rights (e.g. UEFA, ATP/WTA, FIBA/FIVB data, player photos, team logos) can carry separate restrictions even when the vendor licenses scores; SportsAPIPro notes player photos have separate copyright. Treat logos and photos as a separate licensing question.

### Gaps
- Actual text of API-Sports, Goalserve, Sportmonks, Enetpulse, LSports, Sportdevs terms: not retrieved. Do not assume permission.

## 4. Reliability, latency, reputation

### Takeaway
No independent uptime or latency benchmark was found. Only vendor claims and competitor-authored comparisons exist; treat as unverified.

### Cited Findings
- Goalserve claims 99% uptime, 3 data centres, 2-4 s live score refresh (vendor's own, unmeasured). — [Goalserve blog](https://www.goalserve.com/blog/which-are-the-fastest-soccer-api-providers)
- iSports claims <10 s delivery (vendor marketing). — [IndieHackers post](https://www.indiehackers.com/post/2026-developer-checklist-how-to-choose-the-best-sports-api-9WKLRfoF7rLmLsjVgSoE)
- A competitor comparison says Sportmonks data is "not as deep or as fast" as Stats Perform or Sportradar; Sportradar is described as the market leader but B2B-negotiated. — [Highlightly](https://highlightly.net/blogs/top-sports-data-apis-in-2025) (competitor), [sportsapis.dev](https://sportsapis.dev/apis/sportradar) (affiliate directory)

### Inferences
- Enterprise vendors (Sportradar, Stats Perform) have the strongest SLAs but are out of budget. For a prototype, use 1-2 week trial/free tiers to measure latency yourself against a reference (e.g. compare goal timestamps to a TV or official site).

### Gaps
- Reddit/Hacker News/GitHub user experiences for API-Sports etc.: search returned only vendor blog posts; no first-hand complaint threads were retrieved.

## 5. Legal alternatives to scraping, and scraping risks

### Takeaway
Scraping Flashscore/Sofascore/Livescore is a bad foundation: ToS restrict copying, blocking is likely, and legal exposure falls on a public commercial site. A licensed API (even a cheap one with verified terms) is safer.

### Cited Findings
- Flashscore terms (Livesport, Maltese law) forbid copying, modifying, distributing, downloading or uploading content without written authorisation; reserve the right to block visitors, close accounts, seek damages and sue; Flashscore trademark use prohibited. The terms do not use the words "scraping" or "automated". — [Flashscore General Terms of Use](https://livesport.eu/terms/flashscore_ae)
- Third-party scrapers of Flashscore/Sofascore/LiveScore sold on Apify exist, which shows demand but not legality. — [Apify listing](https://apify.com/superapis/flashscore)

### Inferences
- Risks: ToS/IP claims from the data owner (more likely once the site is public with ads), IP bans and anti-bot changes breaking the feed, and no commercial licence to the underlying league data. Sourced mainly from the Flashscore terms above; I did not retrieve case law on Sofascore/Livescore (general scraping case law was not read).
- Lower-risk paths: (a) API-Sports/Goalserve/Sportmonks style paid APIs with written permission; (b) free/open data for non-live content (TheSportsDB for schedules, logos, metadata, where its licence allows); (c) prototype in non-commercial mode on free tiers, then license before public launch; (d) ask a regional provider or the national federations/leagues directly; (e) start with football only on a cheap plan and add sports as revenue allows.

### Gaps
- No court case or Sofascore/Livescore ToS text retrieved. Not legal advice; Ugandan and EU/Malta law implications not researched.
