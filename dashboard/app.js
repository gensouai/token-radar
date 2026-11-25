'use strict';
/* Token Launch Radar — the page. It renders window.RADAR (written next to this
   page by main.ts) and carries the whole valuation model in this file, so the
   ranking can be audited — and re-run with other constants in the sandbox —
   without trusting the program that wrote the board.

   THE MODEL (version signal-2, identical to lib/model.ts):
   A protocol is a launch candidate when the snapshot records no token for it
   (no CoinGecko id, no symbol, no market cap). Every candidate is priced:

     implied = TVL x category x momentum x breadth x maturity x structure

   category   sector multiple from the table below (default 0.50): fee-taking
              markets and networks high, pass-through wrappers low.
   momentum   1 + 0.55 x g / (60 + |g|) on the 7-day TVL change g: saturating,
              so one hot week cannot multiply a value tenfold. No reading: 1.
   breadth    1 + 0.10 x log2(chains), capped 1.50: more chains, more reach.
   maturity   0.75 + 0.45 x min(age_days, 1460) / 1460: survival is evidence.
              Unknown listing date counts as 200 days.
   structure  0.55 when the name ends in a version marker (V2, v3, 2.0): one
              deployment of a line whose deployments share one future token.
   Protocols that already record a token are never priced by the model here:
   the live view shows the market's own TVL and market cap for them. */
const MODEL = { default_multiple: 0.5, momentum_weight: 0.55, momentum_scale: 60,
  breadth_weight: 0.1, breadth_cap: 1.5, maturity_floor: 0.75, maturity_range: 0.45,
  maturity_days: 1460, unknown_age_days: 200, versioned_discount: 0.55 };
const CATMULT = { 'Chain': 1.6, 'Prediction Market': 1.4, 'Launchpad': 1.2,
  'Decentralized AI': 1.2, 'AI Agents': 1.2, 'Derivatives': 1.1, 'Options': 1.0,
  'Synthetics': 0.95, 'Dexs': 0.9, 'Interest Rate Derivatives': 0.9, 'Payments': 0.9,
  'CEX': 0.1, 'Stablecoin Issuer': 0.8, 'Crypto Card Issuer': 0.8, 'Privacy': 0.8,
  'CDP': 0.75, 'Lending': 0.7, 'CDP Manager': 0.7, 'Options Vault': 0.7,
  'NFT Marketplace': 0.7, 'OTC Marketplace': 0.7, 'RWA': 0.65, 'Risk Curators': 0.65,
  'Uncollateralized Lending': 0.65, 'Collateral Markets': 0.65, 'Yield Aggregator': 0.6,
  'Onchain Capital Allocator': 0.6, 'Collateral Management': 0.6, 'CeDeFi': 0.6,
  'Insurance': 0.6, 'DOR': 0.6, 'Yield': 0.55, 'Dual-Token Stablecoin': 0.55,
  'Liquidity Manager': 0.55, 'Leveraged Farming': 0.5, 'Farm': 0.5, 'Algo-Stables': 0.5,
  'Indexes': 0.5, 'Token Locker': 0.5, 'Restaking': 0.45, 'Basis Trading': 0.45,
  'Staking Pool': 0.4, 'Governance Incentives': 0.4, 'Reserve Currency': 0.4,
  'Liquid Restaking': 0.35, 'Decentralized BTC': 0.35, 'Liquid Staking': 0.3,
  'Bridge': 0.3, 'Cross Chain Bridge': 0.3, 'Stablecoin Wrapper': 0.3,
  'Anchor BTC': 0.3, 'Restaked BTC': 0.3, 'Canonical Bridge': 0.22 };
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fmtUsd(n) { if (n === null || n === undefined) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + Math.round(n); }
function fmtPct(g) { if (g === null || g === undefined) return '<span class="flat">—</span>';
  const cls = g > 0.05 ? 'up' : g < -0.05 ? 'down' : 'flat';
  return '<span class="' + cls + '">' + (g > 0 ? '+' : '') + g.toFixed(1) + '%</span>'; }
function fmtAge(d) { if (d === null || d === undefined) return 'unknown';
  if (d >= 730) return (d / 365.25).toFixed(1) + ' yrs'; if (d >= 60) return Math.round(d / 30.4) + ' mo'; return d + ' d'; }
/* The model, runnable in the page: same inputs, same factors, live constants. */
function score(row, knobs) {
  const cat = Object.prototype.hasOwnProperty.call(CATMULT, row.category) ? CATMULT[row.category] : MODEL.default_multiple;
  const g = typeof row.change_7d === 'number' ? row.change_7d : 0;
  const momentum = 1 + knobs.momentum_weight * (g / (MODEL.momentum_scale + Math.abs(g)));
  const breadth = Math.min(MODEL.breadth_cap, 1 + knobs.breadth_weight * Math.log2(Math.max(1, row.chains.length)));
  const age = row.age_days === null ? MODEL.unknown_age_days : row.age_days;
  const maturity = MODEL.maturity_floor + Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days * knobs.maturity_range;
  const structure = VERSIONED.test(row.name) ? MODEL.versioned_discount : 1;
  const implied = Math.max(1, Math.round(row.tvl_usd * cat * knobs.cat_scale * momentum * breadth * maturity * structure));
  return { implied, cat, momentum, breadth, maturity, structure };
}
/* The farm plan, generated in the page from the row's own record — the same
   plan board.json carries, written by lib/model.ts from the same templates. */
function groupOf(cat) { const c = (cat || '').toLowerCase();
  if (/lend|cdp|collateral/.test(c)) return 'lending'; if (c.includes('dex')) return 'dex';
  if (/staking|stak|restak|anchor|decentralized btc/.test(c)) return 'staking'; if (c.includes('bridge')) return 'bridge';
  if (/deriv|option|synthetic/.test(c)) return 'derivatives'; if (c.includes('rwa')) return 'rwa';
  if (/stable|reserve currency/.test(c)) return 'stable'; if (/curator|allocator|index|manager/.test(c)) return 'vault';
  if (/yield|farm|basis/.test(c)) return 'yield'; if (c.includes('chain')) return 'chain';
  if (c.includes('prediction')) return 'prediction'; if (c.includes('insurance')) return 'insurance';
  if (/cex|cedefi|exchange/.test(c)) return 'exchange'; return 'general'; }
function capitalFor(tvl) { return tvl >= 5e9 ? 250 : tvl >= 1e9 ? 200 : tvl >= 2.5e8 ? 150 : tvl >= 5e7 ? 100 : 50; }
function holdFor(age) { return age === null ? 45 : age < 180 ? 60 : age < 365 ? 45 : age < 730 ? 35 : 30; }
function primaryAction(g, r, cap, chain) { const n = r.name; switch (g) {
  case 'lending': return 'Supply $' + cap + ' of USDC to ' + n + ' on ' + chain + ' so the wallet is a live lender in its biggest market.';
  case 'dex': return 'Swap $' + cap + ' of USDC through ' + n + ' on ' + chain + ', then add the proceeds to its main liquidity pool.';
  case 'staking': return 'Stake $' + cap + " of the chain's native asset through " + n + ' and keep the staking receipt in the wallet.';
  case 'bridge': return 'Bridge $' + cap + ' of USDC from Ethereum to ' + chain + ' through ' + n + ', and use the bridged funds in one app on arrival.';
  case 'derivatives': return 'Deposit $' + cap + ' of USDC as margin on ' + n + ' and open one small position you are willing to hold for a week.';
  case 'rwa': return 'Mint $' + cap + ' of ' + n + "'s yield-bearing asset on " + chain + ' and hold it in the wallet.';
  case 'stable': return 'Mint or deposit $' + cap + ' of the stable asset through ' + n + ' on ' + chain + ' and keep it for the full hold.';
  case 'vault': return 'Deposit $' + cap + ' into a ' + n + ' vault on ' + chain + ' and keep the vault shares untouched.';
  case 'yield': return 'Deposit $' + cap + ' into ' + n + "'s main strategy on " + chain + ' and leave the position to compound.';
  case 'chain': return 'Bridge $' + cap + ' of USDC onto the network through its canonical route and make one native swap, so the wallet has real activity on ' + n + '.';
  case 'prediction': return 'Fund the wallet with $' + cap + ' and take one position in ' + n + "'s most liquid market.";
  case 'insurance': return 'Buy $' + cap + ' of cover from ' + n + ' on ' + chain + ' for a position you actually hold, and keep the policy active.';
  case 'exchange': return 'Create an account, complete its verification, deposit $' + cap + ' and make one spot trade on ' + n + '.';
  default: return 'Deposit $' + cap + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.'; } }
function secondAction(g, r) { const n = r.name; switch (g) {
  case 'lending': return 'Borrow a small amount against the supply for one week, then repay it: lenders who also borrow are the users ' + n + ' counts twice.';
  case 'dex': return 'Make one swap a week in the same pool instead of a single large trade; steady volume reads as a real trader to ' + n + '.';
  case 'staking': return 'Claim and re-stake the rewards once, so the wallet shows a full staking cycle with ' + n + ' rather than a single deposit.';
  case 'bridge': return 'Bridge a smaller amount back a week later; a round trip is the usage pattern ' + n + ' cannot get from a one-way transfer.';
  case 'derivatives': return 'Place one limit order and let it rest for a day before cancelling or filling, so the wallet shows maker behaviour on ' + n + '.';
  case 'rwa': return 'Hold through one full yield distribution from ' + n + ' before moving anything; distributions are where holder snapshots are taken.';
  case 'stable': return 'Use the stable asset in one payment or swap, then return to the position: circulation is what ' + n + ' measures.';
  case 'vault': return 'Leave the shares through one full rebalancing cycle of the vault, and vote in any ' + n + ' governance poll that opens meanwhile.';
  case 'yield': return "Harvest the strategy's rewards once and re-deposit them, so the wallet's history with " + n + ' shows compounding, not parking.';
  case 'chain': return 'Use one native application on the network each week (a swap, a mint, a name registration) so the wallet ages as a resident of ' + n + '.';
  case 'prediction': return 'Settle the first position and take a second one in a different market, so the record on ' + n + " is a trader's, not a single bet.";
  case 'insurance': return 'Renew or extend the cover once before it lapses; a continuous cover history is the record ' + n + ' rewards.';
  case 'exchange': return 'Make one withdrawal back to your own wallet, so the account shows a full deposit-trade-withdraw cycle on ' + n + '.';
  default: return "Repeat the core action once a week in a small amount, so the wallet's history with " + n + ' is a pattern, not an event.'; } }
function farmPlan(r) {
  const g = groupOf(r.category), chain = r.chains.length ? r.chains[0] : 'its main chain';
  const cap = capitalFor(r.tvl_usd), hold = holdFor(r.age_days), gas = cap >= 200 ? 8 : cap >= 100 ? 5 : 3;
  const note = g !== 'exchange' && r.chains.length > 1 ? ' It is live on ' + r.chains.length + ' chains; start on ' + chain + ' and add a second chain only in week three.' : '';
  return [
    'Set up a fresh wallet for ' + r.name + ' alone, fund it with the position money plus gas, and keep its seed phrase offline on paper. Cost: under $3 for the first funding transaction. Time: 10 minutes.',
    primaryAction(g, r, cap, chain) + ' ' + r.name + ' holds ' + fmtUsd(r.tvl_usd) + ' of TVL in the snapshot, so a $' + cap + ' position is a user, not a whale.' + note + ' Cost: $' + cap + ' of capital and about $' + gas + ' of gas. Time: 15 minutes to set up.',
    secondAction(g, r) + ' Cost: about $2 of gas. Time: 10 minutes, in the first week.',
    'Hold the position for at least ' + hold + ' days and repeat one qualifying action each week, so the activity spans more than one weekly snapshot of ' + r.name + '. Cost: about $2 of gas a week, with the $' + cap + ' staying in the position. Time: ' + hold + ' days, 10 minutes a week.',
    "Once a week, check " + r.name + "'s own app and official announcements for a points program, a testnet or a launch post, and save the position's balance as a screenshot for your log. Cost: nothing to check. Time: 5 minutes a week.",
    'Keep a farm log with the wallet address, every date and every transaction hash. When a launch comes, claim only from a link inside ' + r.name + "'s own app, and never pay a fee to claim. Cost: nothing but the log. Time: 5 minutes to keep, 15 minutes at the claim." ];
}
/* ---- the board ---- */
let knobs = { cat_scale: 1, momentum_weight: MODEL.momentum_weight, breadth_weight: MODEL.breadth_weight, maturity_range: MODEL.maturity_range };
let shown = [];
function currentRows() {
  const q = $('q').value.trim().toLowerCase(), cat = $('cat').value;
  let rows = R.rows.filter((r) =>
    (cat === '' || r.category === cat) &&
    (!$('watch').checked || r.watchlist) &&
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q) || r.chains.join(' ').toLowerCase().includes(q)));
  const s = $('sort').value;
  const by = { rank: (a, b) => b.implied_value_usd - a.implied_value_usd, tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    signal: (a, b) => b.signal - a.signal, change: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1) }[s];
  rows = rows.slice().sort((a, b) => by(a, b) || (a.slug < b.slug ? -1 : 1));
  if ($('topn').checked) rows = rows.slice(0, 100);
  return rows;
}
function renderBoard() {
  shown = currentRows().map((r) => ({ r, v: score(r, knobs).implied }));
  if (knobs.cat_scale !== 1 || knobs.momentum_weight !== MODEL.momentum_weight ||
      knobs.breadth_weight !== MODEL.breadth_weight || knobs.maturity_range !== MODEL.maturity_range) {
    shown.sort((a, b) => b.v - a.v || (a.r.slug < b.r.slug ? -1 : 1));
    shown.forEach((x, i) => { x.r._v = x.v; x.dispRank = i + 1; });
  } else {
    shown.forEach((x, i) => { x.r._v = x.r.implied_value_usd; x.dispRank = i + 1; });
  }
  const tb = document.querySelector('#board tbody');
  tb.innerHTML = shown.map(({ r, v, dispRank }) =>
    '<tr data-slug="' + esc(r.slug) + '">' +
    '<td class="rk">' + dispRank + '</td>' +
    '<td><span class="pname">' + esc(r.name) + '</span>' + (r.watchlist ? '<span class="wl">WATCHLIST</span>' : '') +
    '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
    '<td class="cat">' + esc(r.category ?? 'Uncategorised') + '</td>' +
    '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
    '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
    '<td class="num">' + r.chains.length + '</td>' +
    '<td class="num">' + fmtAge(r.age_days) + '</td>' +
    '<td class="imp">' + fmtUsd(v) + '</td>' +
    '<td class="sigcell"><span class="sigv">' + r.signal + '</span><div class="sigbar"><i style="width:' + r.signal + '%"></i></div></td>' +
    '<td class="cat">plan &rsaquo;</td></tr>').join('');
  tb.querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => openDetail(tr.dataset.slug, tr)));
  $('count').textContent = 'Showing ' + shown.length + ' of ' + R.candidate_size + ' launch candidates — every protocol in the snapshot that records no token. Click a row for its factor breakdown and farm plan.';
}
function openDetail(slug, tr) {
  const r = R.rows.find((x) => x.slug === slug); if (!r) return;
  document.querySelectorAll('#board tr.sel').forEach((x) => x.classList.remove('sel'));
  if (tr) tr.classList.add('sel');
  const f = score(r, { cat_scale: 1, momentum_weight: MODEL.momentum_weight, breadth_weight: MODEL.breadth_weight, maturity_range: MODEL.maturity_range });
  const bar = (label, val, max) => '<div class="frow"><span class="fl">' + label + '</span><span class="fbar"><i style="width:' +
    Math.min(100, Math.round(val / max * 100)) + '%"></i></span><span class="fv">&times;' + val.toFixed(3) + '</span></div>';
  const d = $('detail'); d.hidden = false;
  d.innerHTML =
    '<button class="xbtn" type="button" id="xdetail">Close</button>' +
    '<h2>' + esc(r.name) + (r.watchlist ? '<span class="wl">WATCHLIST</span>' : '') + '</h2>' +
    '<p class="sub">Board rank #' + r.rank + ' of ' + R.universe_size + ' &middot; ' + esc(r.category ?? 'Uncategorised') +
    ' &middot; records no token in the snapshot, so a launch is still ahead of it</p>' +
    '<div class="dgrid">' +
    '<div class="stat"><b>' + fmtUsd(r.implied_value_usd) + '</b><span>implied value</span></div>' +
    '<div class="stat"><b>' + fmtUsd(r.tvl_usd) + '</b><span>TVL</span></div>' +
    '<div class="stat"><b>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>TVL change, 7d</span></div>' +
    '<div class="stat"><b>' + r.signal + ' / 100</b><span>launch signal</span></div>' +
    '<div class="stat"><b>' + fmtAge(r.age_days) + '</b><span>tracked for</span></div>' +
    '<div class="stat"><b>' + r.chains.length + '</b><span>chains</span></div></div>' +
    '<div class="factors"><h3>How the implied value is built</h3>' +
    bar('Category &times;' + f.cat.toFixed(2), f.cat, 1.6) + bar('Momentum', f.momentum, 1.6) +
    bar('Breadth', f.breadth, 1.5) + bar('Maturity', f.maturity, 1.2) + bar('Structure', f.structure, 1) +
    '<p class="eq">implied = ' + fmtUsd(r.tvl_usd) + ' TVL &times; ' + f.cat.toFixed(2) + ' category &times; ' + f.momentum.toFixed(3) +
    ' momentum &times; ' + f.breadth.toFixed(3) + ' breadth &times; ' + f.maturity.toFixed(3) + ' maturity &times; ' +
    f.structure.toFixed(2) + ' structure = ' + fmtUsd(r.implied_value_usd) + '</p>' +
    '<p class="sub">Chains: ' + esc(r.chains.join(', ') || 'none recorded') + ' &middot; first tracked ' +
    esc(r.listed_at ?? 'date not recorded') + ' &middot; snapshot date ' + esc(R.as_of) + '</p></div>' +
    '<h3>The farm plan — earning a place in the launch</h3><ol class="steps">' +
    farmPlan(r).map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
  $('xdetail').addEventListener('click', () => { d.hidden = true; });
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
/* ---- the live view: already trading, kept apart ---- */
function renderLive() {
  const q = $('lq').value.trim().toLowerCase(), cat = $('lcat').value;
  const rows = R.live.filter((r) => (cat === '' || r.category === cat) &&
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.symbol ?? '').toLowerCase().includes(q)));
  document.querySelector('#livetab tbody').innerHTML = rows.map((r) =>
    '<tr><td><span class="pname">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span></td>' +
    '<td class="num">' + esc(r.symbol ?? 'recorded') + '</td><td class="cat">' + esc(r.category ?? 'Uncategorised') + '</td>' +
    '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
    '<td class="num">' + fmtPct(r.change_7d) + '</td><td class="num">' + r.chains.length + '</td></tr>').join('');
  $('lcount').textContent = 'Showing ' + rows.length + ' of ' + R.live_size + ' token-bearing protocols, by TVL. A dash for market cap means the snapshot records a token but no cap for it.';
}
/* ---- the model view: the formula, the sector table, and a live sandbox ---- */
function renderModel() {
  const cats = Object.entries(CATMULT).sort((a, b) => b[1] - a[1]);
  $('view-model').innerHTML = '<div class="model"><h2>How the model works — signal-2</h2>' +
  '<p>The radar prices a launch that has not happened, from a snapshot that contains no prices for it. ' +
  'It uses only what the snapshot itself records — TVL, the 7-day TVL change, the chain list, the listing ' +
  'date and the category — and one formula for every protocol, with no name ever special-cased:</p>' +
  '<p class="eq">implied_value = TVL &times; category &times; momentum &times; breadth &times; maturity &times; structure</p>' +
  '<h3>The five factors</h3><ul>' +
  '<li><b>Category.</b> What a TVL dollar is worth depends on the business. A token on a derivatives venue or a ' +
  'prediction market can claim a share of large fee flows, so those multiples run 1.1–1.4; a canonical bridge mostly ' +
  'holds other people\'s assets in transit, so it takes 0.22. The floor, 0.10, is the centralised exchange: its ' +
  'snapshot TVL is custodial customer balances rather than product TVL, and the snapshot records none of the fee ' +
  'revenue that would price it properly, so the model credits a tenth and says why. The full table is below — it ' +
  'is the same table the program scores with, not a summary of it.</li>' +
  '<li><b>Momentum.</b> <code>1 + 0.55 &times; g / (60 + |g|)</code> on the 7-day change g. The saturating form is the ' +
  'point: this snapshot contains a +4,448% week, and a formula that believed it would price a small protocol above ' +
  'a chain. Momentum can move a value by about half, never by an order of magnitude.</li>' +
  '<li><b>Breadth.</b> <code>1 + 0.10 &times; log2(chains)</code>, capped at 1.50. A launch airdrops to users; a protocol ' +
  'live on twelve chains has twelve communities to reach, and the log keeps a 176-chain outlier from running away.</li>' +
  '<li><b>Maturity.</b> <code>0.75 + 0.45 &times; min(age, 1460d) / 1460d</code> from the day DefiLlama first tracked the ' +
  'protocol. Survival is the cheapest fraud filter there is: most launch candidates die young, and the ones that ' +
  'have operated tokenless for years have demonstrated the product a token would govern.</li>' +
  '<li><b>Structure.</b> 0.55 when the name ends in a version marker. A "V3" deployment and its "V2" sibling will ' +
  'share one future token between them, so each deployment is credited with a share, not the whole. The watchlist ' +
  'excludes such names outright; the model prefers a discount to an exclusion.</li></ul>' +
  '<h3>What the model refuses to do</h3><p>It never prices a protocol that already records a token — those sit in the ' +
  'live view at the market\'s own figures, because an implied value for a traded token is a price target, not a radar. ' +
  'It never reads a protocol\'s name except for the version-marker pattern. And it caps the board at nothing: all ' +
  R.candidate_size + ' candidates are ranked, so a miss is the model\'s fault in the open, not a quiet omission.</p>' +
  '<h3>The launch signal</h3><p>The 0–100 score is a percentile blend inside the candidate set — size 45%, momentum 30%, ' +
  'breadth 15%, maturity 10% — a reading order for farmers, not a second valuation. Rank is implied value alone.</p>' +
  '<h3>Try it: the model sandbox</h3><p>Move a constant and the board re-scores and re-ranks live, with the same code ' +
  'that produced board.json. Reset returns to the published signal-2 constants.</p>' +
  '<div class="sandbox">' +
  '<label>Sector multiples scale <input type="range" id="k-cat" min="0.4" max="2" step="0.05" value="1"><output id="o-cat">1.00</output></label>' +
  '<label>Momentum weight <input type="range" id="k-mom" min="0" max="1.2" step="0.05" value="0.55"><output id="o-mom">0.55</output></label>' +
  '<label>Breadth weight <input type="range" id="k-br" min="0" max="0.3" step="0.01" value="0.10"><output id="o-br">0.10</output></label>' +
  '<label>Maturity range <input type="range" id="k-mat" min="0" max="0.9" step="0.05" value="0.45"><output id="o-mat">0.45</output></label>' +
  '<button type="button" id="k-reset">Reset to signal-2</button></div>' +
  '<h3>The sector table (value per $1 of TVL)</h3><div class="tablewrap"><table><thead><tr><th>Category</th><th class="num">Multiple</th></tr></thead><tbody>' +
  cats.map(([c, m]) => '<tr><td class="cat">' + esc(c) + '</td><td class="num">&times;' + m.toFixed(2) + '</td></tr>').join('') +
  '<tr><td class="cat">Any other or unrecorded category</td><td class="num">&times;' + MODEL.default_multiple.toFixed(2) + '</td></tr>' +
  '</tbody></table></div></div>';
  const bind = (id, out, key, fmt) => { $(id).addEventListener('input', (e) => { knobs[key] = parseFloat(e.target.value); $(out).textContent = fmt(knobs[key]); renderBoard(); }); };
  bind('k-cat', 'o-cat', 'cat_scale', (v) => v.toFixed(2)); bind('k-mom', 'o-mom', 'momentum_weight', (v) => v.toFixed(2));
  bind('k-br', 'o-br', 'breadth_weight', (v) => v.toFixed(2)); bind('k-mat', 'o-mat', 'maturity_range', (v) => v.toFixed(2));
  $('k-reset').addEventListener('click', () => { knobs = { cat_scale: 1, momentum_weight: MODEL.momentum_weight, breadth_weight: MODEL.breadth_weight, maturity_range: MODEL.maturity_range };
    $('k-cat').value = 1; $('o-cat').textContent = '1.00'; $('k-mom').value = MODEL.momentum_weight; $('o-mom').textContent = MODEL.momentum_weight.toFixed(2);
    $('k-br').value = MODEL.breadth_weight; $('o-br').textContent = MODEL.breadth_weight.toFixed(2); $('k-mat').value = MODEL.maturity_range; $('o-mat').textContent = MODEL.maturity_range.toFixed(2); renderBoard(); });
}
/* ---- chrome: stats, tabs, filters ---- */
function fillCats(sel, rows) { const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All categories</option>' + cats.map((c) => '<option>' + esc(c) + '</option>').join(''); }
function init() {
  $('mver').textContent = R.model_version; $('asof').textContent = R.as_of;
  const totalImplied = R.rows.reduce((a, r) => a + r.implied_value_usd, 0);
  $('stats').innerHTML =
    '<div class="stat"><b>' + R.candidate_size + '</b><span>launch candidates</span></div>' +
    '<div class="stat"><b>' + R.watchlist_size + '</b><span>on the watchlist</span></div>' +
    '<div class="stat"><b>' + fmtUsd(totalImplied) + '</b><span>total implied value</span></div>' +
    '<div class="stat"><b>' + R.live_size + '</b><span>already trading</span></div>' +
    '<div class="stat"><b>' + R.universe_size + '</b><span>protocols ranked</span></div>';
  fillCats($('cat'), R.rows); fillCats($('lcat'), R.live);
  ['q', 'cat', 'watch', 'topn', 'sort'].forEach((id) => $(id).addEventListener('input', renderBoard));
  ['lq', 'lcat'].forEach((id) => $(id).addEventListener('input', renderLive));
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
    ['board', 'live', 'model'].forEach((v) => { $('view-' + v).hidden = v !== t.dataset.view; });
    if (t.dataset.view === 'model') renderModel();
  }));
  R.rows.forEach((r) => { r._v = r.implied_value_usd; });
  renderBoard(); renderLive();
  const top = R.rows.slice().sort((a, b) => a.rank - b.rank)[0];
  if (top) openDetail(top.slug, null);
}
init();


