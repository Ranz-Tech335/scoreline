# Scoreline

A livescore.cz-style site for football, tennis, volleyball and basketball.
Real data comes from a licensed sports API. Your visitors never call the API:
one small server job fetches scores once a minute and the website reads the
result.

```
 API-Football / API-Sports            (your key, never sent to browsers)
          │  1 request per sport per minute, only while games are on
          ▼
 Cloudflare Worker, cron every minute (worker/src/poller.js)
          │  normalises every provider into one shape, writes JSON
          ▼
 Cloudflare R2 bucket          scores/football/2026-10-26.json, live.json, status.json
          │  served by the same Worker with a 15 s cache header
          ▼
 web/index.html                polls every 20 s, shows the same layout as before
```

## What works and what does not (read this first)

| Part | Status |
|---|---|
| Website (`web/`) | Built and tested in a browser against the mock API |
| Worker poller, merge, budget guard, error handling | Built and unit-tested with a fake clock and fake provider |
| Football, basketball, volleyball adapters | Written to the documented API-Sports response shapes. **Not yet run against the real API.** Field names may need small fixes |
| Tennis | **No feed connected.** No affordable licensed provider was found (see Tennis) |
| Uganda Premier League / CAF coverage | **Unknown.** Test it before anything else (next section) |
| Terms of use for public display | **Unconfirmed** for every provider. Email the vendor (see Legal) |

## First tests (free, 15 minutes)

1. Create a free account at API-Football and copy your key.
2. Check that your leagues exist. If Uganda is missing, stop and reconsider:

   ```
   curl -H "x-apisports-key: YOUR_KEY" "https://v3.football.api-sports.io/leagues?country=Uganda"
   curl -H "x-apisports-key: YOUR_KEY" "https://v3.football.api-sports.io/leagues?search=CAF"
   ```
3. On a day with a Ugandan or CAF match, compare the provider's goal times with
   TV. The provider says live data refreshes every 15 seconds. Verify it.
4. Save a real response of `fixtures?live=all` into `test/` and run
   `normalizeFootball` on it. If a field name differs, fix `worker/src/normalize.js`.

## Try it locally (no key needed)

```
node tools/mock-api.mjs          # fake matches that progress in real time
```
Set `api: 'http://localhost:8787'` in `web/config.js`, then serve `web/` with any
static server, for example `npx serve web`. `SPEED=60` runs the match clock
60 times faster; `DISABLE=tennis` simulates a feed that is not connected.

## Deploy from a phone (GitHub, free, no card, no computer)

GitHub runs the poller every ~5 minutes (`.github/workflows/poll.yml`) and
publishes the site on GitHub Pages at `https://YOURNAME.github.io/scoreline/`.
Same poller, same site. The only differences from Cloudflare:

- Live data refreshes about every 10 minutes on the free API plan (simulated
  busy day: on average 7 minutes old during play, at worst about 17, using about
  60 of 100 requests). GitHub cannot run faster than every 5 minutes and
  sometimes starts runs several minutes late.
- GitHub may pause scheduled runs if the repository has no activity for 60 days.
  If that happens, open the Actions tab and re-enable the workflow.
- The repository must be public (GitHub Pages is free only for public repos).
  Your API key stays private in "Secrets".

Steps, using Termux for git:

1. Create a GitHub account and an empty public repository called `scoreline`.
2. Create a personal access token (classic) with the `repo` and `workflow` permissions.
3. In Termux: `pkg install git unzip`, unzip the project, then
   `git init -b main`, `git add .`, `git commit -m "Scoreline"`,
   `git remote add origin https://github.com/YOURNAME/scoreline.git`,
   `git push -u origin main` (the password is the token).
4. Repo, Settings, Secrets and variables, Actions: add a secret named `APISPORTS_KEY`.
5. Repo, Actions tab, "Poll scores", Run workflow. Wait for the green tick.
6. Repo, Settings, Pages: Source "Deploy from a branch", branch `live`, folder `/ (root)`.
7. Open `https://YOURNAME.github.io/scoreline/`.

To change leagues or limits, edit the `env:` block in `.github/workflows/poll.yml`
(you can edit it in the GitHub app or website).

## Deploy (Cloudflare, $0 to start)

```
cd worker
npx wrangler login
npx wrangler r2 bucket create scoreline-scores
npx wrangler secret put APISPORTS_KEY
npx wrangler deploy
```

Wait two minutes, then open `https://scoreline-api.<your-subdomain>.workers.dev/status.json`.
It shows the last poll time, requests used today, and any provider errors.
Put that Worker URL into `web/config.js` and publish `web/` on Netlify
(drag and drop the folder) or Cloudflare Pages. Then set `ALLOW_ORIGIN` in
`wrangler.toml` to your site address.

Edit `wrangler.toml` first:

- `SPORTS`: only list sports you have a subscription for.
- `DAILY_BUDGET`: requests per sport per UTC day. The default 90 suits the free
  plan (100/day). Set about 7000 on API-Football Pro.

## Quota and cost

- **Free API plan (100 requests/day)** works all day with the default settings in
  `wrangler.toml`: live scores update about every 10 minutes while a match is on,
  and fixtures refresh every 2 hours. Tested in a simulated busy day at about 75
  requests. If you list `TOP_LEAGUES`, only those leagues are stored and shown, so
  live polling only runs when one of them has a match.
- **Real live football on Pro ($19/month, 7,500/day)**, set `LIVE_EVERY` 1, `TODAY_EVERY` 5, `OTHER_EVERY` 60, `DAILY_BUDGET` 7000: roughly 1,800 requests a day
  at most. The poller only asks for the live list while a match is live or
  starts within 10 minutes. Today's fixtures refresh every 5 minutes, other
  days hourly.
- **Basketball and volleyball** at API-Sports appear to be separate
  subscriptions with their own keys (`APISPORTS_KEY_BASKETBALL`,
  `APISPORTS_KEY_VOLLEYBALL`). Confirm in your dashboard.
- **Cloudflare free Workers allow 100,000 requests a day.** Every browser
  refresh is a Worker request, and a visitor watching today makes about 9 a
  minute. That is roughly 185 visitor-hours a day before you hit the cap.
  Two fixes when you grow: the Workers Paid plan ($5/month), or serve the R2
  bucket on a custom domain with a cache rule so visitors never invoke a Worker.

## Tennis

The research found one well-documented licensed tennis feed, Goalserve, at
$150 per month with a 30-day trial. Cheaper options are scrapers or vendors
whose terms forbid public republishing. Until you pick one, the Tennis tab says
"The tennis feed is not connected yet." To add a provider later, write a
normaliser that returns the shape documented at the top of `normalize.js`,
add it to `providers.js`, and add `tennis` to `SPORTS`. The website already
renders tennis (sets and games) correctly.

## Legal

Do not scrape Flashscore, Sofascore or Livescore. Their terms forbid it and a
public site is exactly what draws a claim. Before launch, email your data
vendor and ask for written confirmation that you may (1) show their data on a
public website, (2) cache it on your server, (3) run ads next to it, and
(4) use team logos. Keep the API key in Worker secrets only. This is not legal
advice.

## Files

```
web/index.html, web/config.js     the site
worker/src/normalize.js           provider response -> shared match shape
worker/src/providers.js           which API, which endpoints, which key
worker/src/poller.js              what to fetch each minute, merge, budget guard
worker/src/index.js               Cloudflare only: serves the JSON files, runs the cron
ghactions/run.mjs                 GitHub only: runs one poll, writes the site folder
.github/workflows/poll.yml        GitHub only: the schedule and settings
tools/mock-api.mjs                local fake feed for development
tools/demo-simulated.html         the earlier all-simulated demo
test/                             node --test test/normalize.test.mjs test/poller.test.mjs
                                  node test/e2e.cjs   (needs the mock API running)
                                  node test/gh-chain.mjs   (fake provider -> runner -> site -> browser)
docs/                             research report and notes
```
