// Where the site reads scores from.
//
// Local testing:  run `node tools/mock-api.mjs` and use "http://localhost:8787".
// Production:     the URL of your deployed Worker, e.g.
//                 "https://scoreline-api.YOURNAME.workers.dev"
//                 (a custom domain is better, see README).
window.SCORELINE = {
  api: '.',

  // Sports to show. With one sport the tab bar is hidden.
  // Add 'basketball', 'volleyball' or 'tennis' once you have a feed for them
  // (and list them in SPORTS in worker/wrangler.toml too).
  sports: ['football'],

  // Seconds between refreshes while viewing today. Keep at 20 or more.
  pollSeconds: 20,

  // Countries listed first, in this order. Everything else follows A to Z.
  topCountries: ['England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal', 'World', 'Europe', 'Africa', 'Uganda'],
};
