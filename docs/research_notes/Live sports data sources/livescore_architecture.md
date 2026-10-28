# Livescore-style sites: data pipeline, live-update delivery, and the pattern a small team should copy

## Who operates livescore.cz, where does its data come from, and how does it relate to other Livescore/Livesport brands?

### Takeaway
Livesport (Prague) operates the Flashscore network and, by weak evidence, livescore.cz; Livesport's data comes largely from its own staff and ~400 "data administrators/reporters" plus its owned B2B provider Enetpulse. Livescore.com (LiveScore Group) is a separate, unrelated company; I found no reliable source tying it to Livesport.

### Cited Findings
- Livesport Ltd. is a Czech company in Prague, founded 2006 by Martin Hájek and Jiří Mareš; its first project was Livesport.cz (April 2006), later Flashscore.com; about 100M monthly Flashscore users — [Wikipedia: Livesport](https://en.wikipedia.org/wiki/Livesport)
- Livesport acquired a share in Danish B2B sports-data provider Enetpulse in January 2015 and later became sole owner — [Wikipedia: Livesport](https://en.wikipedia.org/wiki/Livesport)
- Data is supplied by the main Prague editorial office plus smaller foreign teams (~70 people) and many external contributors; about 400 "reporters" (internally "data administrators") follow streams and other sources, often tied to betting offices; one can handle four hockey matches at once; automation/AI is used, and live text commentary is picked from ~17,000-18,000 prepared phrases — [Seznam Zprávy](https://www.seznamzpravy.cz/clanek/ekonomika-b2b-sto-milionu-lidi-chodi-pro-sportovni-vysledky-do-ceska-vse-se-ridi-z-prahy-215993)
- Flashscore claims "faster than the TV" delivery, a Prague data centre (capacity tripled), distributed cloud to keep data near users; on a Champions League matchday: 34M users in a day, 700M notifications, up to 1.3M requests/second — [IT Brief UK](https://itbrief.co.uk/story/flashscore-named-uk-s-fastest-sports-results-platform)
- Livesport reported >150M users and 400M app downloads (Oct 2025 per Lupa teaser); a 2018 interview with its technology director mentions ~30 Gb/s peaks, and a 2024 headline says it will build a new data centre — [Lupa.cz topic page](https://www.lupa.cz/n/livesport/)
- A domain-intel page lists livescore.cz's operator/hosting as "Livesport s.r.o." (domain registered 2001) — [URLert](https://www.urlert.com/domains/livescore.cz) (low-quality aggregator)
- Sofascore, by contrast, mixes purchased provider data (Opta), scraping, manual entry by its data team and crowdsourcing — [Sofascore/NOG.hr slides](https://nog.hr/files/meetup5/05_Karlo_Knezevic-Harnessing_RealTime_Power_Inside_Sofascores_DataDriven_Infrastructure.pdf)
- LiveScore Group (Livescore.com) is associated with Entain (which also bought 365Scores in 2023) — [SBC News](https://sbcnews.co.uk/sportsbook/2023/04/05/entain-buys-365scores/) (search snippet only; ownership of Livescore.com itself not verified by me)

### Inferences
- livescore.cz is probably a Livesport-run localized brand sharing Flashscore's backend, but this rests only on a weak aggregator page; treat as unconfirmed.
- Top-tier sites combine human scouts with licensed/owned feeds. A small team cannot replicate scouts, so a licensed API is the realistic source.

### Gaps
- No authoritative statement of livescore.cz ownership or its link to Flashscore/Livesport brands.
- No source on Livescore.com's data providers (Sportradar/Betradar etc.) or its relationship to Livesport.
- Enetpulse's role as Flashscore's actual feed supplier is not stated in sources I could open.

## How does the browser receive live updates (polling, SSE, WebSockets, delta formats, compression)?

### Takeaway
Publicly citable detail is thin. Large sites use push plus edge caching; Sofascore documents a CDN-first approach (3 s TTL fallback, instant purge, 97-99% hit rate). I could not source Flashscore's delimiter-encoded feed format or its push protocol from reliable material.

### Cited Findings
- Sofascore uses Fastly: cache hit rate 97% normal and 99% peak; before Fastly it cut TTL to 3 s as a workaround; Instant Purge ~150 ms globally; goals in big matches cause ~20x traffic spikes via push notifications; latency fell 200->20 ms (Brazil) — [Fastly case study](https://www.fastly.com/es/customers/sofascore)
- Sofascore handled "1.7 million concurrent connections" and moved to bare metal (summary of conference talk; full detail behind login) — [WeAreDevelopers](https://www.wearedevelopers.com/videos/676-scaling-from-0-to-20-million-users.md?t=158)
- Sofascore slides mention a real-time pipeline with NATS (no detail on client delivery) — [NOG.hr PDF](https://nog.hr/files/meetup5/05_Karlo_Knezevic-Harnessing_RealTime_Power_Inside_Sofascores_DataDriven_Infrastructure.pdf)
- Generic tradeoffs: polling works with any HTTP infra and suits 30 s+ intervals; SSE is one-way, proxy friendly, auto-reconnect but browsers can be unreliable (add heartbeats), connection limits on HTTP/1.1; WebSockets suit bidirectional needs, need WebSocket-aware infra and manual reconnect — [DEV Community](https://dev.to/crit3cal/websockets-vs-server-sent-events-vs-polling-a-full-stack-developers-guide-to-real-time-3312)
- Interview-style reference design: provider -> Kafka -> Redis state -> fan-out via WebSocket/SSE, with polling fallback via CDN (2-5 s TTL, invalidate on change) — [techinterview.org](https://techinterview.org/system-design-live-sports-scores/) (design exercise, not a real site)

### Inferences
- Both Livesport and Sofascore are evidently push-plus-edge architectures; for a small team, short-TTL cached JSON polling captures most of the benefit with far less operational risk.
- Long-lived SSE/WebSocket connections are awkward on short-lived serverless functions (my inference, not from the source); polling maps naturally to stateless handlers.

### Gaps
- Flashscore's feed format (delimiter-encoded strings), push mechanism and compression: only scraper-vendor pages surfaced (e.g. Apify listings); no engineering-authored documentation. Not pursued, since scraping should not be recommended.
- No public engineering material found for Livescore.com's web app delivery.
- No documentation found on delta formats used by any of these sites.

## Best-practice architecture for a small project (poller, cache, CDN, TTLs, ETag, payload size)

### Takeaway
Central poller -> shared cache/store -> small CDN-cacheable JSON endpoints, with state-dependent poll intervals and TTLs; upstream cost then scales with number of live matches, not users.

### Cited Findings
- Suggested provider polling: ~every 5-10 s for live matches, ~30 s for scheduled; avoid 1 s polling; stop frequent checks at final states; handle postponed/cancelled/abandoned separately; use "latest updated" endpoints to fetch only changed fixtures; separate static data (logos, players) from live data; respect rate limits and back off — [Sportmonks](https://www.sportmonks.com/blogs/building-a-real-time-livescore-app-with-a-football-api-best-practices/) (vendor blog; it gives no TTL values)
- Reference design: per-match state in Redis (TTL 24 h after finish), score endpoint with 5 s TTL purged on change, ~95% CDN hits claimed, pre-scale/warm before kickoff, notification dedupe window of 30 s — [techinterview.org](https://techinterview.org/system-design-live-sports-scores/)

### Inferences
- Suggested TTLs (my engineering judgment, not sourced): live 10-30 s (or 5-10 s with stale-while-revalidate), scheduled 1-5 min, finished hours to days, season/static data a day or more.
- Use ETag/If-None-Match plus 304 so unchanged polls cost ~200 bytes; gzip/brotli; send compact JSON with short keys or numeric status codes; one "day scoreboard" endpoint plus one per-match endpoint; optional `?since=version` delta. These suit Ugandan mobile networks but are unsourced recommendations.
- Poller should adapt: only poll leagues with matches in the next ~15 min or in progress; one upstream request can cover all live matches ("livescores" endpoints) rather than one per match.

### Gaps
- No source with measured payload sizes or Ugandan network data; no verified provider free-tier limits gathered here (another researcher covers providers).

## Status handling and normalization across sports

### Takeaway
No authoritative source found for site-specific status schemes; recommend an internal normalized enum mapped from each provider.

### Cited Findings
- Reference design stores a status field but does not define transitions; a source treating postponed/cancelled/abandoned with distinct logic exists — [techinterview.org](https://techinterview.org/system-design-live-sports-scores/); [Sportmonks](https://www.sportmonks.com/blogs/building-a-real-time-livescore-app-with-a-football-api-best-practices/)

### Inferences
- Proposed normalized model (unsourced): `state` in {scheduled, live, break, finished, postponed, cancelled, abandoned, interrupted, suspended}, with a separate `phase` field (1H, HT, 2H, ET1, ETHT, ET2, PEN; sets 1-5 for tennis/volleyball; quarters for basketball) and `finish_reason` in {regular, extra_time, penalties, walkover, retired, awarded}. Tennis walkover/retired are finished with a reason, not a distinct live state. Store raw provider status alongside, and keep UI logic keyed to `state`, not provider strings.
- Treat finished as correctable for a short window (scores sometimes amended); keep short TTL for recently finished matches before lengthening.

### Gaps
- Provider-specific code tables not collected; no documentation of Flashscore/Sofascore status codes.

## Time-zone handling

### Takeaway
No site-specific source found; standard practice applies.

### Cited Findings
- None sourced.

### Inferences
- Store and transmit kickoff as UTC epoch seconds/ISO 8601; render in the browser with `Intl.DateTimeFormat` using the user's zone (Africa/Kampala is UTC+3, no DST). Build "day" lists by converting the selected local-day start/end to UTC and querying that range, rather than by provider date, so late-night matches land on the correct day. Cache day endpoints keyed by UTC date plus filter client-side, to keep the CDN hit rate high.

### Gaps
- No evidence of how the named sites define day boundaries.

## Notifications (web push, optional later phase)

### Takeaway
Big sites rely heavily on push; for a small team it is a later phase layered on the same event stream.

### Cited Findings
- Flashscore reported 700M notifications on a Champions League matchday — [IT Brief UK](https://itbrief.co.uk/story/flashscore-named-uk-s-fastest-sports-results-platform)
- Sofascore sees ~20x traffic spikes after goal push notifications — [Fastly case study](https://www.fastly.com/es/customers/sofascore)
- Reference design: notification worker restricted to followers of the match with batching/dedupe — [techinterview.org](https://techinterview.org/system-design-live-sports-scores/)

### Inferences
- Implement with the Web Push API (service worker + VAPID), triggered when the poller detects a score or state diff; limit to followed teams; add jitter because notification-driven spikes hit the origin (mitigate with CDN caching and purge-on-change). Be aware that iOS web push requires an installed home-screen PWA (general knowledge, not verified here).

### Gaps
- No sourced Web Push implementation guidance gathered in this pass.
