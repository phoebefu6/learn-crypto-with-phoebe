# Agent brief - shared by every fan-out page of learn-crypto-with-phoebe

Filled from `~/.claude/skills/course-builder/references/agent-brief.template.md` on 2026-10-09,
adapted to the emrg two-track shape (donor learn-web3-with-phoebe). Internal build document:
never link it from an audience page.

You are writing ONE static HTML session page. No servers, no npm. **If your target file already
exists on disk, do not write it; report that and stop.** Write the file, return its path and one
line of coverage. No HTML in your reply.

## Read first, in this order

1. The template page for YOUR track. Copy its structure, classes, SVG grammar, widget pattern and
   quiz markup EXACTLY (3 options per question, `div.qopt`, `q.qwhy`):
   - Leader (a2-a6): `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/courses/a1-there-is-no-close-price.html`
   - Practitioner (p2-p9): `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/courses/p1-reading-an-exchange-tape.html`
   - Both tracks, for the larger live-widget pattern: `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/courses/p10-the-tape-bench.html`
2. The course map: every verified number, its evidence tier, per-session coverage, the seams. Use
   ONLY its numbers; never invent a statistic; if a fact is missing, teach the uncertainty.
   `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/materials/official-course-map.md`
3. The engine API (the `root.CM = {...}` block near the end and the doc comments of the
   functions you call): `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/assets/cm-live.js`
4. The stylesheet `:root` block for palette tokens:
   `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-crypto-with-phoebe/assets/style.css`

## Page skeleton (keep every component, in the template's order)

toolbar (crumb EXACTLY `<a href="../index.html">learn-crypto-with-phoebe</a> / Leader session N of 6`
or `/ Practitioner session N of 10`, #toggle-all, #zoom-toggle) · masthead (eyebrow
"Learn Crypto with Phoebe · Leader session N of 6" or "· Practitioner session N of 10", h1 with
one `<span class="accent">`, .sub, .chip-row with the level chip "🟠 Leader track" or
"🔧 Practitioner track" + two audience chips + "45 min", .agenda a1-a4 summing to 45) ·
main.wrap · section#intro (Part 0: kicker, .lede, .legend pills, .callout.win "★ What you walk
out with tonight", details.card accordions, first one `open`) · section#part-1, #part-2, #part-3
exactly as the template (section-kicker with klabel "Part N · covers ...", h2, `.tag.concept
"N min live"`; .lede; figures; `details.card` with summary `.mode.live`/`.mode.self`, title,
`.mini`, `.caret ▶`; at least one `.callout.example` with `span.ex-pill` "Real world" on the
page). Practitioner Part 3 is the build-along (`.steps > .step`, each with a
`.prompt-box.good` carrying `span.label`, python against a CSV/DataFrame of the constructed tape;
escape `&` `<` `>`). · section#quiz (3 x `.quiz-q data-answer="0-based"`, `p.qtext`, three
`div.qopt` "A · ...", `q.qwhy`, then one `p.quiz-score` as the template) · section#homework ·
section#official, h2 EXACTLY "What this session teaches, and where it came from",
`.covered > .covered-row` (pill solid ✓ / inkpill ◐ / light ○ + name + note), then the `.mono`
line EXACTLY as the template · section.cheat#cheatsheet (h3 "<Title> <span>· pin this</span>",
grid of cheat items as the template) · `.callout.next` with `.nx-pill` "Next session" ·
footer.pagefoot · `<script src="../assets/cm-live.js?v=1">` (only if the page has a live
widget) then `<script src="../assets/app.js?v=1">` then the page's own inline script.

Head: the template's social meta block (between `<!-- social:start -->` and `<!-- social:end -->`)
with this page's own description/title/url; og:image stays `.../assets/og-cover.png`;
`<title>Leader session N · <Title> - learn crypto with phoebe</title>` (or Practitioner);
`<link rel="stylesheet" href="../assets/style.css?v=1">`. Nothing else external.

The first `details.card` of Part 0, Part 1 and Part 2 is `open`; no other, as the template.
Sentence case headings. Warm practitioner voice, concrete, never dry. 500 to 650 lines is
guidance about depth, never a target: never collapse whitespace, dissolve a list into a
paragraph, or drop a component to fit.

## Live widget (at least one per page, in Part 1 or Part 2)

Copy the `.wk` pattern from the template: `div.wk#cr<page>-<name>` > `.wk-head` (`<b>Live</b>` +
`.wk-hint` that says the tape is constructed and running in the page) > `.wk-body` (selects or
buttons with `sql-label`/`sql-code` classes, an output div, a `p.sql-note` verdict) > `.wk-foot`
filled from `CM.selfTest()` with the template's wording ("The engine's six properties pass in this
browser ..."). The inline script is an IIFE that returns if `typeof CM === "undefined"`, computes
with the real engine (`CM.makeTape`, `CM.readings`, `CM.buildCandles`, `CM.makeMarket`,
`CM.venueQuote`, `CM.indexPrice`, `CM.unitPath`, `CM.restate`, `CM.hourlyExtremes`,
`CM.calibrate`, `CM.falsePositives`, `CM.ladder`, `CM.shuffleSizes`, ...) and prints the result.
Seeds offered on widgets are only 11, 101, 2024, 7, 55555 (labelled "Tape A" ... "Tape E").
Widget ids, classes and any page `<style>` are prefixed `cr<page>-` (e.g. `#crp4-benford`).
**Every number your prose quotes for the default widget state must be one the widget prints and
the course map records.** Expensive calls (`calibrate`, `falsePositives`, `honestRows`) run once
on load, never on every input event. Never show a dark surface you add.

## Hard rules (a violation is rework)

- NEVER an em dash or en dash, anywhere (prose, code, aria-labels, comments). Hyphen only.
- No meta text: never "this course", "in this course", "the course teaches", "banned here". State
  the professional norm directly with its reason. The two exact estate phrases (the official h2
  and the `.mono` line) are the only self-references; "session 5" cross-references are fine.
- Attribution "by Phoebe Fu". Never "built with" a tool.
- Every number comes from the map or is printed by the widget. For constructed data say
  "constructed"; never present an invented output as if run.
- Contested evidence: teach the disagreement (77.5 percent academic vs 95 percent industry, with
  their different denominators, samples, windows and methods); never resolve it.
- Citations in the map's form; anything the map marks "reported" is "reported" on the page.
- NEVER "lottery" or "lotteries"; say the mechanism.
- English words by default; any Chinese term carries its English in brackets.
- **Content refusals (binding):** no coin, token, ticker, price of anything real, market data,
  exchange name, vendor name, data-provider name, index-provider name, chain name, product
  roadmap, named incident, hack or loss. No investment, trading or purchasing advice. Prices on
  the page are ticks of an abstract unit of account from the engine. The published study and the
  industry presentation are cited by authors/title as in the map, never by the venues they named.
  Any real index rulebook is "one public index rulebook", unnamed.
- Running case: Harrowgate, a constructed data team at a fund-administration firm; say
  "constructed" the first time it appears on the page. Never Phoebe's own work.
- Seams: chain mechanics belong to learn-blockchain-with-phoebe, on-chain data (addresses,
  clustering, sybils, reorgs, indexers) to learn-web3-with-phoebe, general detectors to
  learn-anomaly-detection-with-phoebe, record linkage to learn-entity-resolution-with-phoebe,
  stream mechanics to learn-streaming-data-with-phoebe. Name and link; never re-teach.
- Titles, widget ids, classes must not collide with siblings: use only the `cr` prefixes above;
  never reuse the donor's `w3`/`bc` prefixes or its titles.

## Figure grammar (hand-drawn, every figure; 2 or 3 figures per page as the template)

Palette, ONLY these hexes (no invented greys): `#3A1A58` deep · `#5B2A86` primary · `#9C7FBF` mid
· `#D3C3E6` soft · `#F4EFF9` 50-tint · `#1C1324` ink · `#5F5569` muted · `#6B6076` faint text ·
`#CFC5DA` faint · `#E6DFEE` hairline · `#B7791F` marigold · `#8A5A12` marigold solid · `#7A4F0C`
marigold ink text · `#FBF3E2` marigold 50 · `#FCFBFD` paper · `#FFFFFF` · universal reds
`#991B1B` `#FEF2F2` `#FCA5A5` only for a wrong-way panel.

- `<figure class="zoomable">` > `<svg viewBox="0 0 880 H" xmlns="http://www.w3.org/2000/svg"
  role="img" aria-label="the data, not the shape">` > `<defs>` + `<style>` + content, then
  `<figcaption>🔍 Click to zoom - takeaway</figcaption>`. Grow H, never W.
- Prefix unique per figure, used for every class and id: `cr<page><letter>` (`crp4a`, `crp4b`,
  `cra3a`).
- `<defs>` holds, with prefix P: a wobble filter `id="PSk"` (`feTurbulence type="fractalNoise"
  baseFrequency="0.02" numOctaves="2" seed="<int>"` + `feDisplacementMap scale="2.4"
  xChannelSelector="R" yChannelSelector="G"`, `x="-3%" y="-3%" width="106%" height="106%"`), a
  hachure pattern `id="PHc"` (7x7 userSpaceOnUse, rotate(-38), one `#5B2A86` line, opacity .5),
  an open arrowhead marker `id="PAr"` (path `M1 1 L9 5 L1 9`, fill none, `#1C1324` stroke 1.6).
  ALL shapes sit inside ONE `<g filter="url(#PSk)" fill="none" stroke="#1C1324" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round">`; rects carry a tiny rotation (-4 to 4 degrees
  for hand-placed items, under 1 for panels). Fills: white, `#F4EFF9`, the hachure for "the pile"
  or "the data", and marigold (`#FBF3E2` fill, `#B7791F` stroke) ONLY for the one thing the
  figure is about. One doodle anchor per figure, simple strokes, never a mascot.
- Text classes (copy the template's `<style>` block, renamed to your prefix): `.PH` 800 12px ink
  heading · `.PL` 600 12px ink label · `.PS` 400 11px muted · `.PB` 800 11px `#7A4F0C` · `.PV` 800
  16px `#3A1A58` value · `.PA` 700 11px `#5B2A86` axis caption · `.PN` 400 12px muted note ·
  `.PW` 800 12px white on a fill. Font stack `Inter, sans-serif` as the template.
- ALL `<text>` outside the filtered group, never below 10.5px.
- **Fit (the gate measures painted pixels and has failed these pages before):** at 11px allow
  5.3px per character (bold 5.6), at 12px 6.4. Every text must end at least 8px inside the box it
  sits in and inside x=872. A full-width note stays under 105 characters. Two text lines in the
  same column need at least 16px between baselines. Never let a text sit on top of a drawn
  divider or bracket line: end dividers 14px above any text row below them. Bottom note 22px
  below the last row, H clears it by 8px. When in doubt, shorten the words, never the font.
- Draw the MECHANISM (where a print is, what the boundary cuts, which venue's volume feeds the
  weight, what the restatement divides by), never a metaphor literally, never decoration.

## Voice and honesty

Every Part gets a concrete story, mostly Harrowgate (constructed). Real-world anchors are the
map's published findings and rulebook passages, attributed and tiered. "0 of 200" is a ceiling
statement about 200 trials, never "zero false positives". The copy bot is the honest limit of
size-based detectors, not a failure. The shuffle does NOT make the detectors read honest. Volume
weighting is correct when the volume is real; the rulebooks screen venues first. Nigrini bands
are "reported".

## Cross-links (absolute URLs)

- https://phoebefu6.github.io/learn-blockchain-with-phoebe/ · https://phoebefu6.github.io/learn-web3-with-phoebe/
- https://phoebefu6.github.io/learn-anomaly-detection-with-phoebe/ · https://phoebefu6.github.io/learn-entity-resolution-with-phoebe/
- https://phoebefu6.github.io/learn-streaming-data-with-phoebe/
- Hub: https://phoebefu6.github.io/learn-with-phoebe/

## Footer chains and session titles

Footer `<p>`: "Leader session N of 6 · learn-crypto-with-phoebe · by Phoebe Fu &nbsp;·&nbsp; 📚
<a href="https://phoebefu6.github.io/learn-with-phoebe/">Learn with Phoebe ↗</a>" (Practitioner
"of 10"). `nav.pagenav`: "← Prev: Leader session N-1 · <Title>" and "Next: Leader session N+1 ·
<Title> →"; the last page of a track has "← Prev" and "Course home →" (as p10). Each track chains
only within itself.

Leader (file, exact title):
a1-there-is-no-close-price.html · There is no close price
a2-the-volume-that-reports-itself.html · The volume that reports itself
a3-one-asset-many-prices.html · One asset, many prices
a4-the-unit-of-account-can-move.html · The unit of account can move
a5-why-the-market-data-playbook-breaks-here.html · Why the market-data playbook breaks here
a6-from-warehouse-to-crypto-desk.html · From warehouse to crypto desk: the transfer map

Practitioner:
p1-reading-an-exchange-tape.html · Reading an exchange tape
p2-candles-are-a-choice.html · Candles are a choice
p3-reconciling-venues-into-an-index.html · Reconciling venues into an index
p4-benfords-law-on-reported-volume.html · Benford's law on reported volume
p5-round-sizes-and-clustered-sizes.html · Round sizes and clustered sizes
p6-planting-a-wash-trader.html · Planting a wash trader
p7-measuring-the-detector.html · Measuring the detector
p8-depeg-events-in-the-tape.html · Depeg events in the tape
p9-joining-exchange-flows-to-chain-data.html · Joining exchange flows to chain data
p10-the-tape-bench.html · The tape bench
