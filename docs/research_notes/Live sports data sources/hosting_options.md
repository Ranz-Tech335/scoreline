# Hosting options for a live-scores backend (central poller + cache + JSON API + static frontend), near-zero budget, as of October 2026

Pages fetched 2026-10-26. Items marked "(inference)" are my reasoning, not source text. Pricing beyond free tiers was mostly NOT verified (see Gaps).

## 1. Netlify: Scheduled Functions, Functions, storage, bandwidth, edge caching

### Takeaway
Netlify can do the pattern. Scheduled Functions are available on all plans, run at most 30 s, and a secondary source says one-minute cron works on every plan. A 15-30 s refresh is not possible from cron alone, and the free plan is a 300-credit/month hard cap (about 15 GB of bandwidth). That cap is the real constraint, because CDN-served JSON still counts against it.

### Cited Findings
- Scheduled Functions are "available on all pricing plans", with a 30-second execution limit. Cron is standard crontab in UTC, and shorthands like `@hourly` are supported. The docs state no minimum interval. — [Netlify docs: Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- Scheduled Functions run only on published (production) deploys, cannot be invoked by URL, get no payload (only `next_run`), and return no response body. — [Netlify docs: Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- A third-party article (crontap, a competing cron service) states "Netlify supports one-minute cron on every plan". This is secondary and not official. — [crontap](https://crontap.com/blog/netlify-scheduled-functions-alternative)
- The Netlify forum shows cron expressions restart each hour, so uneven intervals need multiple cron entries. A Netlify staff reply suggested roughly 6-12 jobs for a 32-minute cadence. — [Netlify Answers thread](https://answers.netlify.com/t/netlify-scheduled-functions-cron-executing-at-31-29-31-29-intervals-instead-of-31-min-intervals/114132)
- Free plan: 300 credits/month, a hard cap ("cannot be exceeded or incur any costs"). When credits run out the site pauses until the next cycle. Notifications come at 50/75/100%. — [Netlify pricing](https://www.netlify.com/pricing/); [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- Credit rates: 20 credits per GB of bandwidth (includes function API responses), 2 credits per 10,000 web requests (includes API calls and asset requests), 10 credits per GB-hour of compute (covers scheduled functions), 15 credits per production deploy. Free accounts cannot buy credit packs. — [Netlify pricing](https://www.netlify.com/pricing/); [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- Rough scale of 300 credits: about 15 GB of bandwidth, or about 1.5M web requests, or about 20 deploys. These are derived figures, not Netlify's stated allowances. — [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- The docs do not say whether CDN cache hits count toward web requests and bandwidth. The definitions ("whenever a user or system accesses content", "all data sent to the internet") suggest they do. — [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- Caching: functions are not cached by default. Add `Netlify-CDN-Cache-Control: public, durable, max-age=..., stale-while-revalidate=...` to cache function responses at the CDN. `durable` shares the cached response across edge nodes (serverless functions only). It is eventually consistent, so it does not guarantee a single function call per version. `Netlify-Vary: query=...` controls cache keys. Purge is limited to 2 per 5 s per tag or site. — [Netlify docs: Caching overview](https://docs.netlify.com/build/caching/caching-overview/)
- Netlify Blobs: default eventual consistency, where updates and deletes propagate to all edge locations within 60 seconds (strong consistency is optional per read, but slower). Objects can be up to 5 GB. Site-wide stores default to region `us-east-2`; the selectable regions are ap-southeast-1, ap-southeast-2, eu-central-1, us-east-1 and us-east-2. — [Netlify docs: Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- Netlify Blobs is not listed as a metered item on the credits page, and the Blobs page gives no plan quotas. — [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- Secrets: the poller reads the provider key from a Netlify environment variable at runtime. The visitor-facing function or static JSON never contains it. (Only the definition of env vars was confirmed on the docs page I could fetch.) — [Netlify docs: Functions get started](https://docs.netlify.com/build/functions/get-started/)

### Inferences
- Design on Netlify (inference): a Scheduled Function every minute calls the sports API and writes normalized JSON to Blobs. A public function path such as `/api/scores` reads the blob and returns `Netlify-CDN-Cache-Control: public, durable, max-age=20, stale-while-revalidate=30`. Visitors never trigger the upstream API; at most one origin function call per edge refresh occurs.
- Cron gives a 60 s floor (inference). Reaching about 30 s means a second cron entry plus an in-function `sleep(30)` and a second fetch within the 30 s cap. That is tight, since the sleep and two upstream calls must fit in 30 s. Using one fetch per minute plus `stale-while-revalidate` is simpler. A 60 s cadence is fine for most live-score displays.
- The same 60 s limit means the free sports API quota is consumed at 1,440 calls/day per sport/endpoint, regardless of visitor load (inference).
- The Blobs 60 s edge propagation may make the stored value up to a minute stale after each write. Use `consistency: "strong"` in the reading function if that matters (inference).
- Bandwidth is the weak point: all JSON served to visitors, even from cache, appears to be billed against the 300-credit pool, and the whole site pauses when it is exhausted (inference from the cited credit definitions).

### Gaps
- Whether Netlify enforces a minimum cron interval below the one-minute that a third-party blog claims. The official page states none, and I found no official statement either way.
- Whether CDN cache hits consume credits. Netlify's pages did not state it.
- Netlify's paid-plan pricing (Personal/Pro) and Blobs billing. These were not retrievable.
- Whether Netlify has edge nodes in Africa. I found no Netlify-published PoP list, so East Africa latency on Netlify could not be established.
- SSE/streaming support on Netlify serverless functions (the pages I could fetch did not say). Scheduled functions explicitly do not support response streaming.

## 2. Cloudflare: Workers, Cron Triggers, KV, Durable Objects, R2, Cache API, Pages

### Takeaway
Cloudflare fits this pattern better than Netlify. Static assets are free and unlimited, the free Worker quota (100k requests/day, 10 ms CPU) is enough if only a few visitors invoke the Worker, and R2 egress is free. The best trick is to avoid invoking a Worker per visitor: a Cron Worker writes JSON to R2 or KV, and visitors fetch it through a CDN-cached path.

### Cited Findings
- Workers Free: 100,000 requests/day per account (resets 00:00 UTC; over the limit gives Error 1027 or fails open), 10 ms CPU per HTTP request and per Cron Trigger invocation, 50 subrequests per invocation, 5 Cron Triggers per account. — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Cron Triggers accept five-field cron in UTC. The doc's finest example is every minute (`* * * * *`), and it states no sub-minute option. Trigger changes can take up to 15 minutes to propagate. — [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- KV Free: 100,000 reads/day, 1,000 writes/day, 1,000 deletes/day, 1,000 list requests/day, 1 GB storage. Writes to the same key are limited to 1/s. `cacheTtl` minimum is 30 s. — [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/); [KV limits](https://developers.cloudflare.com/kv/platform/limits/)
- Durable Objects (SQLite) Free: 100,000 requests/day, 13,000 GB-s/day, 5M rows read/day, 100k rows written/day, 5 GB storage. WebSocket outgoing messages are not charged and incoming ones count 20:1. The Hibernation API avoids duration charges for idle sockets. — [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- R2 Free (monthly): 10 GB storage, 1M Class A (writes), 10M Class B (reads), free egress. — [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- R2 `r2.dev` public URLs are rate-limited and for development only. A custom domain is needed for Cloudflare caching, and only certain file types are cached by default (a Cache Everything rule is needed for JSON). — [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- Static assets requests are "free and unlimited". Requests that invoke the Worker (including `run_worker_first` matches) count toward Workers limits and return 429 once the free quota is exhausted. — [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- Cache API: contents are per data center and do not replicate. `stale-while-revalidate` is not supported with `put`/`match`, and it is incompatible with tiered caching. It works on custom domains and Pages Functions. — [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- Secrets: the sports API key lives as a Worker secret (not in the frontend). Only the Cron Worker uses it. (Not confirmed on a fetched page; standard Workers feature, stated from background knowledge.)

### Inferences
- Write budget: one KV write per minute is 1,440/day, which exceeds the free 1,000 writes/day cap. KV is therefore awkward on free at 1-min cadence (inference from cited numbers). Options: write only when data changes, cron every 2 min, or use R2 (1M Class A/month, 43,200 writes/month at 1/min, well within limits).
- Recommended Cloudflare layout (inference): Cron Worker (1/min) fetches and normalizes, writes `scores.json` to R2. The JSON is served via an R2 custom domain with a Cache Rule (Edge TTL 15-30 s, "Cache Everything"), so visitor requests are answered at the edge without invoking a Worker. The static frontend goes on Pages or Workers Static Assets. This needs a domain on Cloudflare (r2.dev is rate-limited) (inference).
- Alternative with Worker per visitor (inference): a Worker reads R2/KV and calls `cache.put` with `max-age=20`. That is simpler but counts each request toward the 100k/day free cap. Cache API is per-colo, so each colo refreshes independently.
- Sub-minute cadence (inference): cron minimum is 1 min. A Worker can loop with a 30 s wait inside a single invocation, since sleeping is not CPU time, but I did not verify wall-clock limits for cron invocations.
- Better than Netlify here because the free tier does not meter bandwidth or static requests, and R2 egress is free.

### Gaps
- Workers Paid price ($5/month base) and overage rates were not fetched. Any figure in section 8 for paid Workers is background knowledge only.
- Workers Free wall-clock limit for cron invocations.
- Whether Cloudflare's own docs show the Workers free quota applying to Cache-Everything R2 custom-domain hits (my inference is that it does not, since no Worker runs).

## 3. Others: Vercel, Supabase/Firebase, Render/Railway/Fly.io, VPS

### Takeaway
Vercel Hobby is out (cron limited to once a day). Render free sleeps after 15 min idle, which defeats a poller. A Hetzner-class VPS is the most capable cheap option and fits the builder's Linux skills, but it costs about 4-6 EUR/month and needs upkeep. Cloudflare remains the better zero-cost choice.

### Cited Findings
- Vercel Hobby: cron jobs only once per day, with hourly precision (the run can land anywhere in the hour). Faster expressions fail the deployment. Pro allows once per minute. — [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) (page last updated 2026-07-15)
- Render free web service: spins down after 15 minutes without inbound traffic, takes about a minute to wake, 750 free instance hours/month, local filesystem is lost on spin-down, and bandwidth overage can suspend the service. — [Render free docs](https://render.com/docs/free)
- Hetzner repriced new orders in June 2026: CX23 from 3.99 to 5.49 EUR/month, CAX11 (ARM) from 4.49 to 5.99 EUR/month, excluding IPv4 (Germany/Finland). Existing instances keep old prices. This is a secondary source. — [privatedevops.com](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do)

### Inferences
- VPS design (inference): Node (or Python) systemd service polls every 15-30 s into memory or a file and serves `/api/scores` on localhost. Nginx adds `proxy_cache` or `Cache-Control: s-maxage`, and Cloudflare's free plan sits in front for global caching. This allows true 15 s polling and native SSE. Effort: server hardening, updates, TLS, monitoring.
- Poll interval is not limited by cron on a VPS, so quota use can be tuned exactly (e.g., 30 s = 2,880 calls/day).
- Render free is unsuitable for the poller: the process sleeps when no one hits it (inference). Render and Railway paid tiers were not researched.
- Supabase/Firebase realtime would put a database in the loop and still need a poller somewhere. It adds complexity without helping the low-budget goal (inference).

### Gaps
- Not verified: Railway and Fly.io current free or trial terms, Supabase/Firebase free-tier limits, DigitalOcean (hetzner.com and digitalocean.com pages were not on the fetch allowlist) and Contabo prices, Hetzner included traffic and region list.
- Hetzner has no African region as far as I know, but I did not confirm this on a source.

## 4. Keeping the provider API key secret and the sports API quota safe

### Takeaway
Keep the key only in the poller's environment (Netlify env var, Worker secret, or VPS env file). Only the poller calls the provider, once per cycle, and visitors read cached normalized JSON, so provider calls are constant (about 1,440/day at 1-min cadence, 2,880/day at 30 s) regardless of traffic.

### Cited Findings
- Netlify serves function responses from the CDN only when `Netlify-CDN-Cache-Control` is set, and `stale-while-revalidate` lets the edge serve stale data while refreshing. — [Netlify caching overview](https://docs.netlify.com/build/caching/caching-overview/)
- Cloudflare Cache API never contacts the origin on `match()`, and it is per data center. — [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- Netlify Scheduled Functions cannot be called by URL, so visitors cannot trigger the poller. — [Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)

### Inferences
- Never use a pattern where the visitor-facing function falls back to calling the provider on a cache miss; that makes quota depend on traffic. Keep poller and API separate (inference).
- On Netlify, durable cache is eventually consistent, and the docs say it does not guarantee a single call per version. That matters only if the API function itself calls the provider, which it should not (inference).
- Also add a "last updated" timestamp inside the JSON so the frontend can show data age. Add a kill-switch (skip polling when no matches are live) to save quota (inference).

### Gaps
- The free sports API provider's quota is covered by a different research track; I do not know the quota here.

## 5. Latency for Uganda / East Africa, and whether a Europe-only origin is a problem

### Takeaway
Cloudflare has in-region edge presence, including Kampala and Mombasa. A cached response on Cloudflare should reach Ugandan visitors in tens of ms. A Europe-only VPS origin is fine if it sits behind a CDN that caches and keeps the origin out of the path. Netlify's African edge presence could not be confirmed.

### Cited Findings
- Cloudflare lists 348 cities, 33 in Africa. — [Cloudflare network](https://www.cloudflare.com/network/) (the page has inconsistent counts and "0+" placeholders)
- Cloudflare's Mombasa data center (its 43rd PoP at the time) cut latency in Uganda from up to about 150 ms to about 20 ms, and in Tanzania from 150 ms to under 15 ms. The earlier African PoP named is Johannesburg. The article does not mention Nairobi and carries no date. — [Cloudflare blog: Mombasa](https://blog.cloudflare.com:2087/mombasa-kenya-cloudflares-43rd-data-center)
- A data-center directory lists Cloudflare as the only provider with a Kampala site (`africa-kampala`). — [getdeploying: Uganda](https://getdeploying.com/datacenters-in-uganda)
- Netlify Blobs default to `us-east-2`, with eu-central-1 among the options, and are cached at the edge. — [Netlify Blobs docs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

### Inferences
- A cache hit on Cloudflare in Kampala or Mombasa should be near 20-50 ms, while a miss goes to the origin (R2 or the Worker origin region) at roughly 150-250 ms (inference, no measured numbers).
- Netlify serves from edge nodes, but I have no source on which African cities are covered. East African visitors may be served from Europe or South Africa with roughly 100-200 ms (inference, unverified). That is acceptable for a JSON poll at 20-30 s intervals, and the first page load would be slower.
- Because the data is refreshed every 15-60 s, the extra latency of a Europe origin only matters on edge cache misses. The origin location is not a problem if every request is cache-hit-heavy (inference).

### Gaps
- No measured latency for Uganda on Netlify or Cloudflare; no Netlify PoP list; the Cloudflare blog article is undated, and Nairobi presence was not confirmed.

## 6. SSE vs plain polling

### Takeaway
Polling a CDN-cached JSON endpoint every 15-30 s is the better choice at this budget. SSE holds a connection per visitor, which defeats edge caching and consumes compute.

### Cited Findings
- Netlify Scheduled Functions do not support response streaming. For synchronous functions the pages fetched did not state SSE support. — [Scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/); [Functions get started](https://docs.netlify.com/build/functions/get-started/)
- Cloudflare Durable Objects support WebSockets, with the Hibernation API to avoid duration charges, and incoming messages are billed 20:1. — [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Vercel Hobby offers no sub-daily cron, so it cannot even feed an SSE stream. — [Vercel cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)

### Inferences
- Polling cached JSON means each visitor costs one cache hit per interval, with no long-lived connection. SSE would need a Durable Object (Cloudflare) or a VPS process holding thousands of sockets (inference).
- A VPS can serve SSE natively with Nginx (`proxy_buffering off`), but at thousands of concurrent users it adds load for little gain over polling (inference).
- Hybrid (inference): poll every 20-30 s, pause when the tab is hidden (`document.visibilityState`), and use `ETag`/`If-None-Match` so unchanged data returns 304.

### Gaps
- Streaming/SSE on Netlify synchronous functions, Cloudflare Workers SSE specifics, Render/Fly.io SSE: not verified.

## 7. Recommendation

### Takeaway
Primary: Cloudflare (Cron Worker, then R2 JSON on a custom domain with an edge cache rule, with the static frontend on Cloudflare Pages or Workers Static Assets). It is free at 1k-10k daily visitors and has better African edge presence. Fallback: Netlify (Scheduled Function, Blobs and `Netlify-CDN-Cache-Control` durable caching) if the builder wants everything on one platform, accepting the 300-credit hard cap. Optional later step: Hetzner VPS behind Cloudflare.

### Inferences
- Netlify is simplest if the builder already uses it, but its free plan pauses the site when credits run out, so a traffic spike would take the frontend down too (inference from the cited hard cap).
- Frontend and backend can be split (inference): host static HTML on Netlify as planned, and point `fetch()` at the Cloudflare JSON endpoint (with CORS headers). This keeps the builder's existing workflow and moves the traffic-heavy JSON to Cloudflare's free egress.
- The 15-30 s refresh is simplest on a VPS or with an in-invocation loop on Cloudflare cron; otherwise use a 60 s poll (inference).

### Gaps
- Effort comparisons are my judgement, not sourced.

## 8. Approximate monthly cost, top two options (Cloudflare and Netlify)

### Takeaway
Rough estimates only. Assumptions (mine): each visit makes 1 page load (about 150 KB with assets) plus 6 JSON polls of about 10 KB gzipped (about 0.2 MB and 7 requests per visit), a 30-day month. Cloudflare stays free at 1k-10k visitors/day on the R2 approach and probably needs only the paid Workers plan at 100k. Netlify's free plan holds at 1k/day and runs out before 10k/day.

### Cited Findings
- Netlify free pool: 300 credits (20 per GB, 2 per 10,000 requests), hard cap. — [Netlify pricing](https://www.netlify.com/pricing/)
- Cloudflare Workers Free: 100k requests/day; static assets free; R2 egress free. — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/); [Static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/); [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

### Inferences
| Daily visitors | Monthly bandwidth / requests (assumed) | Netlify (credits) | Cloudflare |
|---|---|---|---|
| 1,000 | about 6 GB, about 210k requests | about 120 + 42 = about 162 of 300 credits, so free | Free: R2 plus CDN cache costs 0 and Worker requests stay under 100k/day |
| 10,000 | about 60 GB, about 2.1M requests | about 1,200 + 420 = about 1,620 credits, roughly 5x the free pool, so a paid plan is needed (price not verified) | Free if JSON is served from the edge cache with no Worker (or about 60k Worker requests/day if each poll hits a Worker, still under 100k) |
| 100,000 | about 600 GB, about 21M requests | about 16,200 credits; paid plan with overage (price unverified) | Cached R2 path: likely free or a few dollars (domain only). Worker per poll: 600k/day exceeds the free cap, so Workers Paid (about 5 USD/month from memory, unverified) |

- At 100k visitors a month on a VPS: Hetzner CX23 at about 5.49 EUR/month plus IPv4 fees (source above), with Cloudflare free in front to absorb traffic (inference). At 600 GB/month, direct serving without a CDN might exceed the included traffic (not verified).
- Figures are estimates; real usage depends on JSON size, poll interval, and tab behavior. Assuming 6 polls per visit may understate usage for people who leave the page open (a 20 s poll over 30 minutes is 90 requests).

### Gaps
- Netlify paid-plan pricing and overage rates, Cloudflare paid Workers pricing, and DigitalOcean/Contabo prices were not verified on official pages.
- The user said "$4-6/month VPS" so the Hetzner numbers are only the one secondary-source datapoint.
