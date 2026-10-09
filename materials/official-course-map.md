# Official course map - learn-crypto-with-phoebe

"Crypto Markets as a Data Problem". Bucket `emrg`, difficulty d2, audience both, 16 sessions,
Leader 6 + Practitioner 10, **every session 45 minutes.** Engine `assets/cm-live.js`, Python
reference `materials/cm_reference.py`, PASSPORT_KEY `lwp-passport:crypto`.

**Scope, approved by Phoebe 2026-10-08: the OFF-CHAIN data of crypto markets.** Exchange tapes,
order books, candles, venues, indices. Not a technology tour and not a money course. What is
different from a traditional market-data feed: there is no close price (24/7, no settlement
day), no central consolidated tape, venues self-report their own volume with no auditor and an
incentive to inflate it, identity is absent, the unit of account is itself a traded asset
(it can depeg), and the same asset has many prices at once.

**Content refusals (binding on every page).** No coins, tokens, tickers, prices, market data,
exchange names, vendor names, chain names, product roadmaps, named incidents, hacks or losses.
No investment, trading or purchasing advice; "not investment advice" on the landing blurb,
index.html and a1. Every figure a page quotes is in this file. Running case: **Harrowgate**, a
fictional data team at a fund-administration firm that has to publish a daily reference level
and a venue volume table for an abstract asset; labelled constructed on every page that uses it.

---

## The seam

| Subject | Owner | This course |
|---|---|---|
| Hashing, Merkle trees, consensus, signatures, mining, what a chain is | `learn-blockchain-with-phoebe` (emrg d2, LIVE) | **Never re-taught.** Named as a prerequisite only where p9 joins to the chain. |
| ON-CHAIN data: addresses, clustering, sybils, reorgs, indexers, retraction | `learn-web3-with-phoebe` (emrg d3, LIVE) | **Never re-taught.** p9 joins exchange flows to chain data and hands the chain side across. |
| General anomaly detectors: z-scores, isolation forests, control charts | `learn-anomaly-detection-with-phoebe` (LIVE) | Named. The detectors here are the forensic ones specific to a self-reported tape (first-digit law, roundness, clustering), calibrated on honest tapes. |
| Entity resolution, record linkage | `learn-entity-resolution-with-phoebe` (LIVE) | Named in p9 only: a venue label is a reported attribute, not a resolved identity. |
| Streaming ingestion, late data, watermarks | `learn-streaming-data-with-phoebe` (LIVE) | Named in p1 and p2: the tape is a stream and a candle is a windowed aggregate; the mechanics live there. |
| Money, price, trading, portfolios | nobody on the hub | **Not taught.** No price is ever quoted; prices in the engine are ticks of an abstract unit of account. |

**Estate vocabulary check before this build (grep of every live `courses/*.html`).** `close price`
**0**, `Benford` **0**, `wash trad` **0**, `depeg` **0**, `stablecoin` **0**, `exchange tape` **0**,
`unit of account` **2** (both the economics sense), `candle` **5** (all the lighting or metaphor
sense), `order book` **2** (an ops-process sense). No heading, title, widget id or figure
prefix below exists in a sibling. Figure prefixes use `cr` + page + letter (`cra1a`, `crp10b`).

---

## Frozen canon - the Harrowgate tape

Computed in node from `assets/cm-live.js` and reproduced by `materials/cm_reference.py` before
any page quoted a number. **Node and Python agree on every value to 1e-9 relative (0 diffs over
the whole harness, 2026-10-08).** Everything is synthetic and every page says so: trade sizes
are integers in micro-units of an abstract unit, prices are ticks (0.001) of an abstract unit of
account, there is no asset, no currency and no venue name. **No figure here describes any real
market, and no page may imply otherwise.**

### How to reproduce

```
CM.makeTape({ seed: s, days: 1, perDay: 3000, washShare: w, washStyle: "round" | "flat" | "copy" })
```

Honest sizes are log-normal (ln median 1.6, ln spread 1.9, so several orders of magnitude),
then rounded the way a person types a number: 25 percent to one significant digit, 45 percent
to two, the rest to three. Wash trades come in matched pairs: a buy and a sell of the same size,
1 to 4 seconds apart, until the wash volume reaches `w / (1 - w)` of the honest volume, so `w`
is the share of REPORTED volume that is wash. The "round" bot cycles seven round lots (1, 2, 5,
10, 20, 50, 100 units). The "flat" bot draws unrounded four-digit sizes from one narrow band
(2 to 20 units). The "copy" bot samples the honest size distribution. Bench pairs: venue A is
seed `s`, honest; venue B is seed `s + 1` with the washer. Calibration seeds 1001 to 1040;
false-positive seeds 2001 to 2200; the five tape seeds offered on widgets are 11, 101, 2024, 7,
55555 (and their B partners 12, 102, 2025, 8, 55556).

### The engine is checked, not assumed

`selfTest()` runs **six** properties on every page load, all passing. Each names the fault it
exists to catch, and two faults were reintroduced in node to confirm the right property fails.

| Property | Result | Fault it catches |
|---|---|---|
| An honest tape conforms to Benford (MAD under 0.012) | 0.0065 | a size generator that does not span orders of magnitude |
| A round-lot washer at 50 percent is flagged | 3 of 3 fired | detectors wired to the wrong field |
| Reported volume equals honest plus wash; share within one lot of target | gap 0.0000 | a wash loop that stops early or double counts |
| Every wash trade has an opposite-side twin within 4 seconds | 0 unmatched | a pair generator that forgets to flip the side (**fails** with that fault reintroduced) |
| A bot with too few round sizes still fires the roundness test | fires | a one-sided roundness test (**fails** with that fault reintroduced; the other five pass) |
| Shuffling sizes across venues conserves total size | 305,357,878,700 micro-units | a break button that drops or duplicates trades |

Any page stating a count of these properties says **six**.

### The honest tape, seed 11 (one day, 3,000 trades)

| Quantity | Value |
|---|---|
| Trades | 3,000 |
| Reported volume | 94,615.2287 units |
| Price range (ticks of 0.001) | 99.934 to 100.065; last print 99.957 |
| First five prints | t=12 buy 0.223 at 99.998 · t=33 sell 0.3 at 99.995 · t=45 sell 3 at 99.996 · t=59 buy 6.9 at 99.999 · t=70 sell 1.2 at 99.997 |
| Distinct sizes | 989 |
| Five most frequent sizes | 10 (85 trades), 2 (73), 20 (71), 3 (64), 1 (52) |
| Benford MAD | **0.0065** (chi-square 12.41 on 8 degrees of freedom) |
| Round share (one significant digit) | **29.0 percent** |
| Cluster share (top five sizes) | **11.5 percent** |

First-digit counts 1 to 9: 831, 566, 366, 308, 234, 206, 192, 163, 134, so shares 27.7, 18.9,
12.2, 10.3, 7.8, 6.9, 6.4, 5.4, 4.5 percent against Benford's 30.1, 17.6, 12.5, 9.7, 7.9, 6.7,
5.8, 5.1, 4.6. **The honest tape conforms**: 0.0065 is inside the "acceptable" band
(0.006 to 0.012) in the reported Nigrini thresholds, close to the 0.006 "close conformity" line.

Book snapshot at 12:00 (seed 11): last print 100.007, best bid 100.002 for 33.3 units, best ask
100.012 for 6 units, spread 10 ticks (0.010), 8 levels a side. The snapshot is generated from
the tape's seed and the clock; it is a drawing of what a book looks like, not a matching engine.

### Calibration, 40 honest venues (seeds 1001 to 1040)

| Reading | Mean | Population sd |
|---|---|---|
| Benford MAD | 0.00797 | 0.00125 |
| Round share | 29.96 percent | 0.84 points |
| Cluster share | 12.17 percent | 0.67 points |

Bands at sensitivity k (honest sd units). MAD is one-sided (more deviation is the anomaly);
roundness and clustering are two-sided, because the published finding on unregulated venues was
LESS roundness than human traders show, while a naive bot shows more. A venue is **flagged when
at least two of the three fire.**

| k | MAD fires above | Round band | Cluster band |
|---|---|---|---|
| 2 (default) | 0.0105 | 28.3 to 31.6 percent | 10.8 to 13.5 percent |
| 2.5 | 0.0111 | 27.9 to 32.0 | 10.5 to 13.8 |
| 3 | 0.0117 | 27.5 to 32.5 | 10.2 to 14.2 |
| 4 | 0.0130 | 26.6 to 33.3 | 9.5 to 14.8 |

### The false-positive rate on honest venues (200 fresh seeds, 2001 to 2200)

| k | MAD fires | Round fires | Cluster fires | **Flagged (2 of 3)** |
|---|---|---|---|---|
| 2 | 6.5 percent (13) | 3.5 percent (7) | 2.5 percent (5) | **1.5 percent (3 of 200)** |
| 2.5 | 4.0 percent (8) | 1.5 percent (3) | 0 | **0 of 200** |
| 3 | 1.5 percent (3) | 0 | 0 | 0 of 200 |
| 4 | 0 | 0 | 0 | 0 of 200 |

**The printed number the bench exists for: at the default k=2, 3 of 200 honest venues are flagged
by the majority rule, 1.5 percent.** A single detector is noisier than the majority: the MAD alone
fires on 6.5 percent of honest venues. "0 of 200" at k of 2.5 and above is a ceiling statement
about 200 trials, never "zero false positives".

### The ladder (p10 canon): venue A seed 11 honest, venue B seed 12 with the round-lot washer, k=2

| Wash share of B's reported volume | B trades (pairs) | MAD | Round | Cluster | Fired | Verdict | B's weight if weighted by reported volume |
|---|---|---|---|---|---|---|---|
| 0 | 3,000 (0) | 0.0062 | 29.4 percent | 12.0 percent | 0 of 3 | honest | 52.7 percent |
| 10 percent | 3,848 (424) | 0.0193 | 44.9 | 28.2 | 3 of 3 | **flagged** | 55.3 |
| 30 percent | 6,418 (1,709) | 0.0507 | 67.0 | 53.2 | 3 of 3 | flagged | 61.4 |
| 50 percent | 10,708 (3,854) | 0.0699 | 80.2 | 67.7 | 3 of 3 | flagged | 69.0 |
| 70 percent | 21,312 (9,156) | 0.0842 | 90.1 | 79.0 | 3 of 3 | flagged | **78.8** |

Venue A on the same bench: MAD 0.0065, round 29.0 percent, cluster 11.5 percent, 0 of 3 fired,
reported volume 94,615.2287 units. Venue B honest volume is 105,370.65 units on every rung (the
honest tape does not change when the washer is added); its reported volume is 117,086.65 at 10
percent, 150,530.65 at 30, 210,742.65 at 50 and 351,304.65 at 70. **B's honest share of the
two-venue market is 52.7 percent at every rung**; only the reported share moves.

Across the other four seed pairs (101/102, 2024/2025, 7/8, 55555/55556) every rung at 10
percent and above fires 3 of 3 and is flagged; the honest rung never fires.

### A strip of the planted tape (p6 figure), venue B seed 12, round bot, 10 percent

The first two wash pairs: sell then buy 50 units at t=96 and 97 s (00:01:36, 00:01:37); buy then
sell 5 units at t=147 and 148 s. The nine prints from 00:01:28 to 00:02:38 carry 137.44 units of
reported volume, 27.44 honest and 110 wash (node, checked 2026-10-09; the p6 widget prints the
same pairs). Each pair leaves the washer's net position at zero.

### The anti-lever: rank venues by reported volume

Weighting by reported volume is what an index or a league table does by default. On the bench
it never improves anything: the washed venue's weight rises from its honest share to a number
that is mostly wash. At 70 percent wash, B's weight by reported volume is **78.8 percent** on
seeds 11/12, and 76.3 (101/102), 75.3 (2024/2025), 73.5 (7/8) and 73.1 (55555/55556) on the other
four pairs, against honest weights of 52.7, 49.1, 47.7, 45.4 and 44.9 in the same order. On pairs 101/102 and 2024/2025 the washed venue moves from rank
2 to rank 1 at 10 percent wash; on 7/8 and 55555/55556 it takes rank 1 at 30 percent. **The
honest nuance the page must carry:** volume weighting is standard practice in every index
rulebook read for this course, and it is correct when the volume is real; the rulebooks address
the problem by screening which venues may contribute at all, not by abandoning weights.

### The detection floor (p7): one-percent steps, k=2

| Wash share | Round bot fired | Flat bot fired |
|---|---|---|
| 1 percent | 0 | 0 |
| 2 percent | 2 (round 32.9, cluster 14.9; MAD 0.0064 silent) | 1 |
| 3 percent | 2 | 1 |
| 4 percent | 2 | **2 (flagged)** |
| 5 percent | **3** (MAD 0.0107 crosses 0.0105) | 2 |
| 8 percent | 3 | 3 |

So at k=2 the bench flags a round-lot bot from **2 percent** of reported volume and a flat bot
from **4 percent**; at k=2.5 the flat floor is 5 percent and at k=3 it is 6 percent, while the
round floor stays at 2 percent at every k up to 3. The Benford test is the LAST of the three to
fire on BOTH bots at k=2: on the round bot roundness and clustering fire at 2 percent and the MAD
joins at 5 percent (round lots keep first digits 1, 2 and 5, which Benford already favours); on
the flat bot roundness fires alone at 2 percent (27.6, below the band), clustering joins at 4
percent (10.5) and the MAD only at 8 percent (0.0111). (Correction 2026-10-09: an earlier draft
said the MAD fires first on a flat bot; the floor run says otherwise.)

### The flat bot and the copy bot (p7 and p10 honesty rows), seed 12, k=2

| Wash share | Flat bot: round / cluster / MAD / fired | Copy bot: round / cluster / MAD / fired |
|---|---|---|
| 10 percent | 21.7 / 8.8 / 0.0131 / 3 | 29.2 / 12.0 / 0.0060 / 0 |
| 30 percent | 12.4 / 5.0 / 0.0317 / 3 | 29.8 / 12.4 / 0.0080 / 0 |
| 50 percent | 7.1 / 2.9 / 0.0448 / 3 | 29.9 / 12.4 / 0.0071 / 0 |
| 70 percent | 3.6 / 1.4 / 0.0521 / 3 | 30.7 / 12.6 / 0.0074 / 0 |

**The flat bot is caught because the tests are two-sided:** its roundness and clustering fall
BELOW the honest band, which is the direction the published study found on unregulated venues.
**The copy bot is never caught at any share up to 70 percent.** A washer that samples the honest
size distribution is invisible to every size-based detector by construction; what remains is the
matched-pair structure (same size, opposite side, seconds apart), which the bench generates but
these three detectors do not read. Pages must say this is the honest limit, not a failure.

### The break button: shuffle sizes across the two venues (seed 99)

Pooling every size on both venues and dealing them back out at random spreads the planted
structure evenly. **The gap between the venues collapses to noise and the verdict stops
distinguishing them.** At 50 percent wash the round-share gap goes from 51.2 points to -0.1,
the cluster gap from 56.2 to +0.7, the MAD gap from 0.0634 to -0.0001. After the shuffle both
venues read 3 of 3 at every rung from 10 percent up, because the pooled tape IS contaminated;
at 0 percent both stay honest. **What the break proves:** the detectors read the size
distribution and nothing else; the venue label carries no information once the sizes are mixed.
It does NOT make the detectors read honest, and no page may say it does (correction to the
build brief, which expected "every detector reads honest").

### Candles are a choice (p2), seed 11

| Bar | Bars printed (possible) | Up / down / flat bars | Busiest bar by volume (its trade count) |
|---|---|---|---|
| 1 minute | **1,271 of 1,440** (169 empty minutes) | 401 / 375 / 495 | 09:17, 4 trades |
| 5 minutes | 288 of 288 | 129 / 136 / 23 | 09:15, 13 trades |
| 15 minutes | 96 of 96 | 46 / 47 / 3 | 09:15, 37 trades |
| 1 hour | 24 of 24 | 10 / 13 / 1 | 09:00, 125 trades |

The last close is 99.957 on every bar size (the last print is the last print). 12 percent of
minute bars have no trade at all, so "the 1-minute close" at those minutes is a convention
(carry forward, or print nothing), not an observation. The widest 1-hour range is 57 ticks at
04:00; the widest 1-minute range is 10 ticks.

### There is no close price (a1), seed 11, five-day tape (15,000 trades)

Last print before each boundary, under four boundary conventions:

| Boundary | Closes (units) | Day-over-day returns |
|---|---|---|
| 00:00 | 100.039, 100.091, 100.247, 100.264, 100.306 | +0.052, +0.156, +0.017, +0.042 percent |
| 08:00 | 100.082, 100.062, 100.067, 100.254, 100.323, 100.306 | -0.020, +0.005, +0.187, +0.069, -0.017 |
| 16:00 | 100.063, 100.002, 100.168, 100.328, 100.301, 100.306 | -0.061, +0.166, +0.160, -0.027, +0.005 |
| 21:00 | 100.029, 100.083, 100.195, 100.265, 100.287, 100.306 | +0.054, +0.112, +0.070, +0.022, +0.019 |

**The first full-day return is +0.052 percent at midnight, -0.020 at 08:00, -0.061 at 16:00
and +0.054 at 21:00: the sign of "yesterday's return" depends on when you decided the day
ends.** The final close is 100.306 under every convention only because the tape ends at the
same print; everything before it differs. The 00:00 convention prints four returns and the
others five, because the first boundary at 00:00 has no print before it.

### One asset, many prices (a3, p3): four venues at 13:00, seed 11, 5-minute window

| Venue | Last print | Age of last print | Trades in window | Volume in window |
|---|---|---|---|---|
| A (3,000 trades a day) | 99.670 | 12 s | 13 | 249.101 units |
| B (1,500 a day, basis +0.040) | 99.706 | 80 s | 4 | 207.500 |
| C (600 a day, basis -0.030) | 99.637 | 73 s | 2 | 35.653 |
| D (250 a day, price frozen since 10:00) | 99.969 | 392 s | 0 | 0 |

| Method | All four venues | Excluding D (0.28 percent from the median, 0.2 percent tolerance) |
|---|---|---|
| Simple mean | 99.7455 | 99.671 |
| Median | 99.688 | 99.670 |
| Volume-weighted mean | 99.6828 | 99.6828 (D had no volume to weight) |
| Volume-weighted median | 99.670 | 99.670 |

**Four defensible methods, four levels, 75.5 ticks apart (0.076 percent) before exclusion.** The
market path itself sits at 99.665 at that minute. With the washed market (B at 60 percent wash):
B's volume share in the 5-minute window is 45.9 percent against a 24.8 percent share of the
day's honest volume (45.2 percent of reported); VWAP 99.6866, volume-weighted median 99.670.

### The unit of account can move (a4, p8), seed 11

The quoting unit's path against a reference: normally 1.000 with a jitter of a thousandth, then
a declared depeg from minute 600 (10:00): a linear fall over 90 minutes, held 120, recovered
over 240. Largest hour-over-hour move of the last print:

| Depeg depth | Unit bottoms at | In the quoted unit | Restated into the reference |
|---|---|---|---|
| 0 | 0.999000 | -0.046 percent (hour 4) | -0.155 percent (hour 21, jitter) |
| 3 percent | 0.969016 | -0.046 percent | **-1.99 percent** (hour 10) |
| 6 percent | 0.939016 | -0.046 percent | **-3.96 percent** (hour 10) |
| 12 percent | 0.879016 | -0.046 percent | **-7.89 percent** (hour 10) |

**The quoted tape never moves more than 0.046 percent in an hour at any depth, because the move
is in the unit.** The first print at or after noon (t=43,239, 12:00:39) is quoted at 100.009; it restates to
94.025 reference units at depth 6 percent and to 100.025 at depth 0 (the unit's jitter).
(Correction 2026-10-09: an earlier draft paired 94.025 with 100.025 "quoted"; 100.025 is the
depth-0 restatement.)

---

## Verified facts, with their evidence tier

`read at source` = the document itself was read for this course. `reported` = a secondary
account; the page says "reported".

### Cong, Li, Tang and Yang, "Crypto Wash Trading" (read at source: NBER working paper w30783 text; published version Management Science 69(11) 6427 to 6454, DOI 10.1287/mnsc.2021.02709, reported)

- Sample: **29 exchanges**, tick data from a data provider, **9 July to 3 November 2019**, four
  trading pairs against the US dollar. Regulated means licensed by the state of New York under
  its definition (3 exchanges); unregulated split by web-traffic rank into **10 Tier-1** and
  **16 Tier-2**. (p. 3 to 9 of the working paper.)
- Three tests: first-significant-digit distribution against Benford's law; clustering at round
  trade sizes (windows around multiples of 100 and 500 base units); the tail exponent of the
  size distribution against the Pareto-Levy range. "Tier-1 exchanges failing more than 20% of
  the tests and Tier-2 exchanges failing more than 60%." (p. 4.)
- Direction of the roundness finding: "regulated exchanges display an evident clustering
  effect in trade size, whereas unregulated Tier-1 and Tier-2 exchanges contain little
  clustering, with 30% and 50% of exchanges displaying no trade-size clustering in all
  cryptocurrencies, respectively." Round trades "constitute around 30% of total trades on
  regulated crypto exchanges". **So on their sample the anomaly is too LITTLE roundness, not too
  much.** (Sections 3.2 and 4.1.)
- Quantification: a benchmark ratio of unrounded to round volume is estimated on the regulated
  exchanges (weekly pooled regression); the unrounded volume on an unregulated exchange above
  what that ratio predicts from its round volume is the wash estimate. (Section 4.2.)
- Estimates: wash trading "on average, is as high as 77.5% of the total trading volume on
  unregulated exchanges, with a median of 79.1%"; "above 53.4% for Tier-1 and 81.7% for Tier-2";
  "over 70% ... and about 61% even after controlling for exchange characteristics". The published
  abstract says "averaged over 70% of the reported volume". (p. 4 and section 4.2.)
- Ranking: "70% of wash trading of total reported volume moves an exchange's rank up by 46
  positions" on a third-party ranking site's data. (p. 4.)
- Caveats stated by the authors: Benford-based estimates "are significantly lower" and provide
  "somewhat lower bounds"; if authentic algorithmic trading inflates unrounded volume "our
  estimates should be viewed more as upper bounds"; the usual Lucas critique applies (venues may
  have adapted since the 2019 online draft); "we cannot assert that our estimates are the gold
  standard". (Sections 4.3, 4.4.) **Pages present every figure as the authors' estimate on
  their 2019 sample, with these bounds.**
- Dollar magnitudes in the paper are NOT quoted on any page (content refusal).

### Bitwise Asset Management presentation to the SEC, March 2019 (reported; the SEC-hosted PDF is image-only and could not be read as text)

- Reported claims: roughly **95 percent** of the volume reported on a widely used aggregator
  for one asset was "fake or non-economic"; 81 exchanges analysed over four days in March 2019;
  **10** found to have real volume; methods were trade-size histograms, volume patterns and
  spread behaviour. An industry presentation, not peer reviewed. Cong et al. name it (as Fusaro
  and Hougan 2019) and say their own estimates "are in the same order of magnitude" as the
  industry reports.
- **The disagreement to teach:** 95 percent (of aggregator-reported volume across 81 venues,
  four days, industry method) against 77.5 percent (of unregulated venues' volume across 26
  venues, four months, academic roundness method, with the regulated venues at roughly zero).
  Different denominators, samples, windows and methods; neither number is "the" wash rate.

### Benford, Newcomb, Hill, Nigrini

- Benford, F. (1938), "The law of anomalous numbers", Proceedings of the American
  Philosophical Society 78(4), 551 to 572 (bibliographic record **reported**; the article is
  behind a paywall). Newcomb, S. (1881), "Note on the frequency of use of the different digits in
  natural numbers", American Journal of Mathematics 4(1/4), 39 to 40 (reported).
- The first-digit law P(d) = log10(1 + 1/d), d = 1 to 9, giving 30.1, 17.6, 12.5, 9.7, 7.9, 6.7,
  5.8, 5.1, 4.6 percent: **read at source** in Hill's text and computed by the engine.
- Hill, T. P. (1995), "A statistical derivation of the significant-digit law", Statistical
  Science 10(4), 354 to 363 (journal record reported). **Read at source** as the author's 1996
  preprint text: "If distributions are selected at random (in any 'unbiased' way), and random
  samples are then taken from each of these distributions, the significant digits of the
  combined sample will converge to the logarithmic (Benford) distribution." This is why a tape of
  many traders with many size habits conforms, and why a single bot with one size habit does not.
- Nigrini's mean-absolute-deviation thresholds for first digits, 0.006 / 0.012 / 0.015 (close,
  acceptable, marginal, non-conformity), from "Benford's Law: Applications for Forensic
  Accounting, Auditing, and Fraud Detection" (Wiley, 2012): **reported** via secondary sources;
  boundary wording differs between them. Pages say "the reported Nigrini bands".
- Data that does not conform (assigned numbers such as invoice numbers, bounded ranges, data
  that does not span an order of magnitude): Durtschi, Hillison and Pacini 2004, **reported**.

### Market-data definitions (read at source, unnamed on pages)

- OHLC bar: open, high, low and close over "one unit of time, e.g., one day or one hour"; a
  candlestick shows "exactly the same data" in a different drawing. Volume as a fifth field is
  a convention (OHLCV), reported.
- Order book: the list of resting orders a venue uses to match; "the difference between the
  highest bid and the lowest ask is called the bid-ask spread"; "the book depth refers simply to
  the number of price levels available at a particular time in the book"; several orders at one
  price are "a price level". A book belongs to one venue.
- One public index rulebook (read at source, unnamed; every passage below re-checked word for word
  against the downloaded rulebook text on 2026-10-09): hourly fixings on a fixed 3,600-second
  calculation window split into **10 partitions of 6 minutes**; trades from all selected venues
  pooled and sorted by price; each partition's "most representative trade is defined as the
  volume median one", described as "outlier resistant by nature"; partition medians carry
  **time weights 1/10 to 10/10** favouring the recent ones; venues screened quarterly on criteria
  including "Regulated by an independent government body", "KYC/AML controls", "Trading
  Policies", five years of operation, absence from sanction lists and reliable trade feeds, plus a
  liquidity floor (a venue must carry at least 0.5 percent of observed liquidity in the pair over
  the past 3 months); exclusion actions include "Fraud", "Market manipulation", "Significant loss of volume or
  liquidity"; a partition with no trades is excluded and weights adjusted ("adjusted accordingly"); a
  partition whose data could not be retrieved in time is excluded too; no trades in the whole
  window means "the price is not published"; for suspect transactions "the most representative
  trade may be adjusted to disregard the spurious data". A second
  methodology (reported): 12 five-minute partitions, volume-weighted median per partition,
  equal-weighted average of the partitions, medians chosen to reduce "susceptibility to price
  extremes" on any one venue.

### Sources for the a6 90-day ladder (free; official ones marked)

- IOSCO, "Policy Recommendations for Crypto and Digital Asset Markets", Final Report FR11/2023,
  16 November 2023 (**official**, international securities standard setter; non-binding;
  covers market manipulation, conflicts from vertically integrated venues, custody, surveillance).
  **Reported**: title, number, date and scope confirmed by search on 2026-10-09; the text was not
  read for this course, so pages cite it as a reading, never quote it. IOSCO reported a thematic
  review of implementation in October 2025 (reported).
- pandas user guide on time series resampling and groupby (**official** library documentation).
- Cong, Li, Tang and Yang, NBER working paper w30783 (free; read at source above).
- Hill 1995 / the 1996 preprint (free preprint; read at source above).
- One public index provider's published methodology rulebook (**official** for that index; read
  at source above, unnamed on pages; learners pick any public rulebook).
- Sibling courses: learn-streaming-data, learn-anomaly-detection, learn-web3, learn-blockchain
  (free, by Phoebe Fu, not official).

---

## Coverage per session

`✓` taught to working depth. `◐` named and handed on.

### Leader track

| Session | Covers | Depth |
|---|---|---|
| a1 There is no close price | 24/7 tape, no settlement day, the close as a convention, four conventions four signs; not investment advice | ✓ |
| a2 The volume that reports itself | Self-reported volume, the incentive, 77.5 vs 95 as a disagreement, rank by volume as the trap | ✓ |
| a3 One asset, many prices | No consolidated tape, venue basis, stale venues, four index methods 75.5 ticks apart | ✓ |
| a4 The unit of account can move | A quoting unit that is itself traded, depeg as a data event, quoted versus restated | ✓ |
| a5 Why the market-data playbook breaks here | Source, identity, ground truth, feedback loop, cost of being wrong, each drawn | ✓ |
| a6 From warehouse to crypto desk: the transfer map | Carries over / must learn / must unlearn, 90-day ladder of official free sources | ✓ |
| Chain mechanics, on-chain identity | Handed to `learn-blockchain`, `learn-web3` | ◐ |

### Practitioner track

| Session | Covers | Depth |
|---|---|---|
| p1 Reading an exchange tape | Trades, book snapshot, grain, timestamps, candles as a derived object | ✓ |
| p2 Candles are a choice | OHLCV from trades, empty bars, up/down counts that move with the bar | ✓ |
| p3 Reconciling venues into an index | Mean, median, VWAP, volume-weighted median, staleness and outlier exclusion, partitions | ✓ |
| p4 Benford's law on reported volume | First-digit law, MAD, chi-square, why mixtures conform, honest 0.0065 | ✓ |
| p5 Round sizes and clustered sizes | Roundness share, top-five clustering, the direction in the published study | ✓ |
| p6 Planting a wash trader | The declared synthetic structure: pairs, lots, three bot styles, share of reported volume | ✓ |
| p7 Measuring the detector | Calibration, k, false positives 1.5 percent, the detection floor, the copy bot limit | ✓ |
| p8 Depeg events in the tape | Restating a tape, quoted -0.046 against restated -3.96 percent | ✓ |
| p9 Joining exchange flows to chain data | Labels are reported not verified; join coverage; hand to `learn-web3` | ✓ |
| p10 The tape bench | Ladder, anti-lever, break button, copy bot, honest false positives, all live | ✓ |
| General anomaly detection | Pointed at `learn-anomaly-detection` | ◐ |
| Stream ingestion mechanics | Pointed at `learn-streaming-data` | ◐ |

## Not covered, by design

- **Any coin, token, ticker, price, exchange, vendor, chain or incident.** None appears on any page.
- **Investment, trading or purchasing advice.** The landing blurb, index.html and a1 say so.
- **Chain mechanics and on-chain identity.** `learn-blockchain`, `learn-web3`.
- **Real market statistics of any kind.** Every figure comes from the generator.
- **Derivatives, funding rates, perpetuals, options.** Out of scope; the tape here is spot-like.
- **Regulatory regimes by jurisdiction.** Named only as the regulated/unregulated split the
  published study used.

## Re-verify before delivery

The engine is seeded and deterministic. If `cm-live.js` is edited: run `selfTest()`, then
`node materials/cm_canon.js` and `python3 materials/cm_reference.py`, diff them to zero, and update
every number in this file before touching a page. The published study is from a 2019 sample and
its authors say venues may have adapted since; re-check for a newer peer-reviewed estimate
before delivery and teach any new disagreement rather than replacing the old figure.
