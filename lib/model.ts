// Token Launch Radar — the valuation model (model version "signal-2").
//
// One sealed DefiLlama snapshot in, one ranked board of token-launch candidates out.
// A protocol is a candidate when the snapshot records no token for it (gecko_id and
// symbol both null, and no market cap): it operates today without a traded token, so
// a launch is still ahead of it. Protocols that already record a token are never
// ranked here; the dashboard shows them apart, at the market's own values.
//
// The board ranks the snapshot's whole universe — all 758 protocols. The 342
// candidates that record no token are ranked by the model below. The 416 that
// already record a token are carried at the market's own value where the
// snapshot records a market cap, and by the same model where it does not;
// every row says which, and the dashboard never mixes the two sets: its radar
// view is candidates only, its live view is the token-bearing set, apart.
// The snapshot's watchlist (TVL at or above the $50M floor, 40 protocols) is
// the floor of the coverage, never the ceiling: every watchlist protocol is
// ranked, and so are the 302 candidates the watchlist leaves out.
//
// The implied value of a candidate is its TVL carried through five factors, each
// computed from the snapshot's own fields and nothing else — no protocol name is
// ever special-cased, and the same function scores every row:
//
//   implied = TVL x category x momentum x breadth x maturity x structure
//
//   category   What a dollar of TVL is worth in this sector. Fee-taking markets
//              and networks (Chain, Prediction Market, Derivatives, Dexs) carry
//              high multiples because a token can claim a share of real fees;
//              pass-through wrappers (Canonical Bridge, Liquid Staking,
//              Stablecoin Wrapper) carry low ones because most value in them
//              belongs to the assets they wrap. A centralised exchange takes
//              the table's floor, 0.10: its snapshot TVL is custodial customer
//              balances, not product TVL a token would govern, and the snapshot
//              records none of the fee revenue that would price it properly.
//              The table below states every multiple; an unlisted or null
//              category takes the default 0.50.
//   momentum   The 7-day TVL change, saturated: 1 + 0.55 x g / (60 + |g|).
//              One hot week (+4448% exists in this snapshot) must not multiply a
//              valuation tenfold, and one bad week must not erase it, so the
//              factor is bounded to roughly [0.45, 1.55]. No reading -> 1.00.
//   breadth    Live on more chains means more users a launch can reach:
//              1 + 0.10 x log2(chain count), capped at 1.50.
//   maturity   Survival is evidence: 0.75 + 0.45 x min(age_days, 1460) / 1460,
//              where age runs from listed_at to the snapshot's as_of date.
//              A protocol DefiLlama has tracked for four years has outlived
//              most launch candidates. Unknown listing date -> 200 days.
//   structure  A name ending in a version marker (V2, v3, 2.0 ...) marks one
//              deployment of a product line whose other deployments share the
//              same future token, so the line's value is discounted to 0.55.
//              This is the snapshot's own watchlist pattern, applied as a
//              number rather than an exclusion.
//
// implied_value_usd is the model's claim of what the protocol's token would be
// worth, fully diluted, if it launched at the snapshot date. The board sorts by
// it, largest first; rank is that order, and ties break on TVL then slug so two
// runs of this program agree byte for byte.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's tunable constants, mirrored in the dashboard's model sandbox. */
export interface ModelConstants {
  default_multiple: number;
  momentum_weight: number;
  momentum_scale: number;
  breadth_weight: number;
  breadth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  versioned_discount: number;
}

export const MODEL: ModelConstants = {
  default_multiple: 0.5,
  momentum_weight: 0.55,
  momentum_scale: 60,
  breadth_weight: 0.1,
  breadth_cap: 1.5,
  maturity_floor: 0.75,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 200,
  versioned_discount: 0.55,
};

/** The model's version label: the dashboard names it and the board rows carry it. */
export const MODEL_VERSION = 'signal-2';

/**
 * What one TVL dollar is worth, by DefiLlama category: the model's sector table.
 * High for businesses whose token can claim fees or govern a network; low for
 * wrappers whose TVL is other people's assets in transit.
 */
export const CATEGORY_MULTIPLES: Record<string, number> = {
  'Chain': 1.6,
  'Prediction Market': 1.4,
  'Launchpad': 1.2,
  'Decentralized AI': 1.2,
  'AI Agents': 1.2,
  'Derivatives': 1.1,
  'Options': 1.0,
  'Synthetics': 0.95,
  'Dexs': 0.9,
  'Interest Rate Derivatives': 0.9,
  'Payments': 0.9,
  'CEX': 0.1,
  'Stablecoin Issuer': 0.8,
  'Crypto Card Issuer': 0.8,
  'Privacy': 0.8,
  'CDP': 0.75,
  'Lending': 0.7,
  'CDP Manager': 0.7,
  'Options Vault': 0.7,
  'NFT Marketplace': 0.7,
  'OTC Marketplace': 0.7,
  'RWA': 0.65,
  'Risk Curators': 0.65,
  'Uncollateralized Lending': 0.65,
  'Collateral Markets': 0.65,
  'Yield Aggregator': 0.6,
  'Onchain Capital Allocator': 0.6,
  'Collateral Management': 0.6,
  'CeDeFi': 0.6,
  'Insurance': 0.6,
  'DOR': 0.6,
  'Yield': 0.55,
  'Dual-Token Stablecoin': 0.55,
  'Liquidity Manager': 0.55,
  'Leveraged Farming': 0.5,
  'Farm': 0.5,
  'Algo-Stables': 0.5,
  'Indexes': 0.5,
  'Token Locker': 0.5,
  'Restaking': 0.45,
  'Basis Trading': 0.45,
  'Staking Pool': 0.4,
  'Governance Incentives': 0.4,
  'Reserve Currency': 0.4,
  'Liquid Restaking': 0.35,
  'Decentralized BTC': 0.35,
  'Liquid Staking': 0.3,
  'Bridge': 0.3,
  'Cross Chain Bridge': 0.3,
  'Stablecoin Wrapper': 0.3,
  'Anchor BTC': 0.3,
  'Restaked BTC': 0.3,
  'Canonical Bridge': 0.22,
};

/** One farm step before it becomes a board string: the action, its cost, its time. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The five factors one protocol's implied value is built from. */
export interface Factors {
  category_multiple: number;
  momentum: number;
  breadth: number;
  maturity: number;
  structure: number;
}

/** One row of board.json. Extra fields beyond the gate's five are the model's working. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token' | 'live';
  value_source: 'model' | 'market';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  signal: number | null;
  factors: Factors | null;
  farm_steps: string[];
}

/** The dashboard's compact view of one candidate row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  signal: number;
  factors: Factors;
}

/** A token-bearing protocol for the dashboard's live view: the market's figures, not the model's. */
export interface LiveRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  category_multiples: Record<string, number>;
  model_version: string;
  universe_size: number;
  board_size: number;
  candidate_size: number;
  watchlist_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** DefiLlama's version-marker rule: a name ending in a release is one deployment of a line. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole day count from listed_at to as_of, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether the snapshot records no token for a protocol: no CoinGecko id, no symbol, no market cap. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}

/** The category multiple for a protocol: its sector's row of the table, else the default. */
export function categoryMultiple(category: string | null): number {
  if (category !== null && Object.prototype.hasOwnProperty.call(CATEGORY_MULTIPLES, category)) {
    return CATEGORY_MULTIPLES[category]!;
  }
  return MODEL.default_multiple;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The five factors and the implied value one protocol gets under the model. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): { implied: number; factors: Factors; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const cat = categoryMultiple(p.category);
  const g = typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0;
  const momentum = 1 + model.momentum_weight * (g / (model.momentum_scale + Math.abs(g)));
  const chainCount = Math.max(1, p.chains.length);
  const breadth = Math.min(model.breadth_cap, 1 + model.breadth_weight * Math.log2(chainCount));
  const ageForModel = age ?? model.unknown_age_days;
  const maturity = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const structure = VERSIONED.test(p.name) ? model.versioned_discount : 1;
  const implied = Math.max(1, Math.round(p.tvl_usd * cat * momentum * breadth * maturity * structure));
  return {
    implied,
    age,
    factors: {
      category_multiple: cat,
      momentum: round4(momentum),
      breadth: round4(breadth),
      maturity: round4(maturity),
      structure,
    },
  };
}

/** A dollar figure the way a reader scans it: $1.24B, $45.6M, $789K, $950. */
export function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/** A step as one board string: the action, then its cost and time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position open and re-check it weekly.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL: deeper pools absorb more. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  if (age < 730) return 35;
  return 30;
}

/** The category group a farm plan is written for: the plan's verbs follow the protocol's business. */
function groupOf(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('dex')) return 'dex';
  if (c.includes('staking') || c.includes('stak') || c.includes('restak') || c.includes('anchor') || c.includes('decentralized btc')) return 'staking';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('deriv') || c.includes('option') || c.includes('synthetic')) return 'derivatives';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('stable') || c.includes('reserve currency')) return 'stable';
  if (c.includes('curator') || c.includes('allocator') || c.includes('index') || c.includes('manager')) return 'vault';
  if (c.includes('yield') || c.includes('farm') || c.includes('basis')) return 'yield';
  if (c.includes('chain')) return 'chain';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('cex') || c.includes('cedefi') || c.includes('exchange')) return 'exchange';
  return 'general';
}

/** The group's opening position: the one action that makes a wallet a real user of this protocol. */
function primaryAction(group: string, p: SnapshotProtocol, capital: number, chain: string): string {
  const n = p.name;
  switch (group) {
    case 'lending': return `Supply $${capital} of USDC to ${n} on ${chain} so the wallet is a live lender in its biggest market.`;
    case 'dex': return `Swap $${capital} of USDC through ${n} on ${chain}, then add the proceeds to its main liquidity pool.`;
    case 'staking': return `Stake $${capital} of the chain's native asset through ${n} and keep the staking receipt in the wallet.`;
    case 'bridge': return `Bridge $${capital} of USDC from Ethereum to ${chain} through ${n}, and use the bridged funds in one app on arrival.`;
    case 'derivatives': return `Deposit $${capital} of USDC as margin on ${n} and open one small position you are willing to hold for a week.`;
    case 'rwa': return `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it in the wallet.`;
    case 'stable': return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and keep it for the full hold.`;
    case 'vault': return `Deposit $${capital} into a ${n} vault on ${chain} and keep the vault shares untouched.`;
    case 'yield': return `Deposit $${capital} into ${n}'s main strategy on ${chain} and leave the position to compound.`;
    case 'chain': return `Bridge $${capital} of USDC onto the network through its canonical route and make one native swap, so the wallet has real activity on ${n}.`;
    case 'prediction': return `Fund the wallet with $${capital} and take one position in ${n}'s most liquid market.`;
    case 'insurance': return `Buy $${capital} of cover from ${n} on ${chain} for a position you actually hold, and keep the policy active.`;
    case 'exchange': return `Create an account, complete its verification, deposit $${capital} and make one spot trade on ${n}.`;
    default: return `Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open.`;
  }
}

/** The group's second leg: the follow-up action that separates a user from a one-click sybil. */
function secondAction(group: string, p: SnapshotProtocol): string {
  const n = p.name;
  switch (group) {
    case 'lending': return `Borrow a small amount against the supply for one week, then repay it: lenders who also borrow are the users ${n} counts twice.`;
    case 'dex': return `Make one swap a week in the same pool instead of a single large trade; steady volume reads as a real trader to ${n}.`;
    case 'staking': return `Claim and re-stake the rewards once, so the wallet shows a full staking cycle with ${n} rather than a single deposit.`;
    case 'bridge': return `Bridge a smaller amount back a week later; a round trip is the usage pattern ${n} cannot get from a one-way transfer.`;
    case 'derivatives': return `Place one limit order and let it rest for a day before cancelling or filling, so the wallet shows maker behaviour on ${n}.`;
    case 'rwa': return `Hold through one full yield distribution from ${n} before moving anything; distributions are where holder snapshots are taken.`;
    case 'stable': return `Use the stable asset in one payment or swap, then return to the position: circulation is what ${n} measures.`;
    case 'vault': return `Leave the shares through one full rebalancing cycle of the vault, and vote in any ${n} governance poll that opens meanwhile.`;
    case 'yield': return `Harvest the strategy's rewards once and re-deposit them, so the wallet's history with ${n} shows compounding, not parking.`;
    case 'chain': return `Use one native application on the network each week (a swap, a mint, a name registration) so the wallet ages as a resident of ${n}.`;
    case 'prediction': return `Settle the first position and take a second one in a different market, so the record on ${n} is a trader's, not a single bet.`;
    case 'insurance': return `Renew or extend the cover once before it lapses; a continuous cover history is the record ${n} rewards.`;
    case 'exchange': return `Make one withdrawal back to your own wallet, so the account shows a full deposit-trade-withdraw cycle on ${n}.`;
    default: return `Repeat the core action once a week in a small amount, so the wallet's history with ${n} is a pattern, not an event.`;
  }
}

/**
 * A candidate's farm plan: six steps from its own record — category verbs, its first
 * chain, capital scaled to its TVL, a hold window scaled to its age, the weekly
 * cadence, and claim hygiene. No step names a date the snapshot cannot support:
 * durations run from the day the farmer starts.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const group = groupOf(p);
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 200 ? 8 : capital >= 100 ? 5 : 3;
  const chainNote = group !== 'exchange' && p.chains.length > 1 ? ` It is live on ${p.chains.length} chains; start on ${chain} and add a second chain only in week three.` : '';
  return [
    {
      text: `Set up a fresh wallet for ${p.name} alone, fund it with the position money plus gas, and keep its seed phrase offline on paper.`,
      cost: 'under $3 for the first funding transaction',
      time: '10 minutes',
    },
    {
      text: `${primaryAction(group, p, capital, chain)} ${p.name} holds ${fmtUsd(p.tvl_usd)} of TVL in the snapshot, so a $${capital} position is a user, not a whale.${chainNote}`,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction(group, p),
      cost: 'about $2 of gas',
      time: '10 minutes, in the first week',
    },
    {
      text: `Hold the position for at least ${hold} days and repeat one qualifying action each week, so the activity spans more than one weekly snapshot of ${p.name}.`,
      cost: `about $2 of gas a week, with the $${capital} staying in the position`,
      time: `${hold} days, 10 minutes a week`,
    },
    {
      text: `Once a week, check ${p.name}'s own app and official announcements for a points program, a testnet or a launch post, and save the position's balance as a screenshot for your log.`,
      cost: 'nothing to check',
      time: '5 minutes a week',
    },
    {
      text: `Keep a farm log with the wallet address, every date and every transaction hash. When a launch comes, claim only from a link inside ${p.name}'s own app, and never pay a fee to claim.`,
      cost: 'nothing but the log',
      time: '5 minutes to keep, 15 minutes at the claim',
    },
  ];
}

/**
 * A token-bearing protocol's steps: there is no launch to farm, so the plan says so
 * and tracks what is still worth doing — using the product, watching for the new
 * deployments that do sometimes carry their own distribution, and staying safe.
 */
export function liveSteps(p: SnapshotProtocol): FarmStep[] {
  const token = p.symbol !== null ? ` (its token trades as ${p.symbol})` : '';
  const cap = p.mcap_usd !== null ? ` The snapshot records a market cap of ${fmtUsd(p.mcap_usd)}.` : ' The snapshot records a token but no market cap for it.';
  return [
    {
      text: `${p.name} already records a token${token}, so there is no token launch to farm here.${cap}`,
      cost: 'nothing',
      time: '1 minute to note',
    },
    {
      text: `Use ${p.name} normally on ${chainOf(p)} when you need what it does; genuine usage is the only history that counts if it ever runs a loyalty or retroactive program.`,
      cost: 'the normal fees of the action itself',
      time: 'as long as the action takes',
    },
    {
      text: `Watch ${p.name}'s announcements for new chain deployments or a new version: those launches sometimes carry their own points or distribution even when the main token already trades.`,
      cost: 'nothing to watch',
      time: '5 minutes a week',
    },
    {
      text: `Log the wallet, dates and transaction hashes for your activity with ${p.name}, and claim anything only from links inside its own app, never from a message or a search ad.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** Percentile of each item in an ascending sort, 0..1, ties broken by slug so runs agree. */
function percentiles<T>(items: T[], key: (item: T) => number, slug: (item: T) => string): Map<T, number> {
  const sorted = [...items].sort((a, b) => key(a) - key(b) || (slug(a) < slug(b) ? -1 : slug(a) > slug(b) ? 1 : 0));
  const out = new Map<T, number>();
  sorted.forEach((item, i) => out.set(item, sorted.length <= 1 ? 1 : i / (sorted.length - 1)));
  return out;
}

interface Scored {
  p: SnapshotProtocol;
  implied: number;
  factors: Factors | null;
  age: number | null;
  status: 'pre-token' | 'live';
  source: 'model' | 'market';
  signal: number | null;
}

/**
 * The board: every protocol in the snapshot, ranked by implied value. Candidates
 * (no token recorded) are scored by the model; token-bearing protocols sit at
 * their recorded market cap where the snapshot has one, else at the model's
 * value, and say so in value_source. Signal is a candidate-only percentile
 * blend (size 45%, momentum 30%, breadth 15%, maturity 10%) the dashboard
 * shows as a 0..100 launch-signal score; it never affects rank.
 */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const watch = new Set(snapshot.watchlist);
  const scored: Scored[] = snapshot.protocols.map((p) => {
    const { implied, factors, age } = impliedValue(p, snapshot.as_of);
    if (recordsNoToken(p)) return { p, implied, factors, age, status: 'pre-token', source: 'model', signal: null };
    // A recorded market cap of exactly 0 is a placeholder, not a valuation: the model prices those too.
    if (p.mcap_usd !== null && p.mcap_usd > 0) return { p, implied: p.mcap_usd, factors: null, age, status: 'live', source: 'market', signal: null };
    return { p, implied, factors, age, status: 'live', source: 'model', signal: null };
  });
  const candidates = scored.filter((s) => s.status === 'pre-token');
  const tvlPct = percentiles(candidates, (s) => Math.log10(Math.max(1, s.p.tvl_usd)), (s) => s.p.slug);
  const momPct = percentiles(candidates, (s) => s.factors!.momentum, (s) => s.p.slug);
  const brPct = percentiles(candidates, (s) => s.factors!.breadth, (s) => s.p.slug);
  const agePct = percentiles(candidates, (s) => s.age ?? MODEL.unknown_age_days, (s) => s.p.slug);
  for (const s of candidates) {
    s.signal = Math.round(100 * (0.45 * tvlPct.get(s)! + 0.3 * momPct.get(s)! + 0.15 * brPct.get(s)! + 0.1 * agePct.get(s)!));
  }
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: s.status,
    value_source: s.source,
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    signal: s.signal,
    factors: s.factors,
    farm_steps: (s.status === 'pre-token' ? farmSteps(s.p, s.age) : liveSteps(s.p)).map(stepText),
  }));
}

/** The token-bearing protocols, by TVL, for the dashboard's live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot and the board. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const rows: RadarRow[] = board
    .filter((r) => r.token_status === 'pre-token')
    .map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      watchlist: r.watchlist,
      implied_value_usd: r.implied_value_usd,
      signal: r.signal ?? 0,
      factors: r.factors!,
    }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    category_multiples: CATEGORY_MULTIPLES,
    model_version: MODEL_VERSION,
    universe_size: snapshot.protocols.length,
    board_size: board.length,
    candidate_size: rows.length,
    watchlist_size: snapshot.watchlist.length,
    live_size: live.length,
    rows,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: size, coverage, ranks, order, values, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board has ${board.length} rows, outside 100..4000`;
  const inSnapshot = new Set(snapshot.protocols.map((p) => p.slug));
  const slugs = new Set<string>();
  for (const r of board) {
    if (!inSnapshot.has(r.slug)) return `${r.slug} is not a slug in the snapshot`;
    if (slugs.has(r.slug)) return `${r.slug} appears twice`;
    slugs.add(r.slug);
  }
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `rank ${byRank[i]!.rank} outranks rank ${byRank[i - 1]!.rank} on implied value`;
  }
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) return 'every row shares one implied value: not a ranking';
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}



