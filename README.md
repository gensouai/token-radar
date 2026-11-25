# Token Launch Radar

An entry for the make.fun bounty [Build the best token launch radar](https://make.fun/bounty/token-radar-01).

![make.fun bounty](https://make.fun/badge/token-radar-01.svg)
![rank](https://make.fun/badge/token-radar-01/gensouai/token-radar/rank.svg)
![reward](https://make.fun/badge/token-radar-01/gensouai/token-radar/reward.svg)

`main.ts` (Node 22, standard library only, no network) reads the sealed DefiLlama
snapshot of 758 protocols and ranks the whole universe in `/output/board.json`.
The 342 protocols that record no token are launch candidates, priced by the
signal-2 model from the snapshot's own numbers:

    implied = TVL x category x momentum x breadth x maturity x structure

The 416 that already record a token are carried at the market's own values and
kept apart in the dashboard's *Already trading* view. Every candidate row states
its five factors and carries a farm plan written from its own record — category,
chains, capital scaled to its TVL, a hold window scaled to its age.

The static dashboard in `dashboard/` renders the board with search, category and
watchlist filters, sorting, a per-protocol detail view with the factor breakdown
and farm plan, and a model sandbox that re-scores the board live with the same
code the program scores with. `screenshots/` holds the board, a detail view and
a filtered view, rendered from the dashboard itself.

License: MIT (see `LICENSE`).
