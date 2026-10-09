// canon.js - run the whole cm-live.js ladder in node and print canon JSON (sorted keys).
const CM = require(require("path").join(__dirname, "..", "assets", "cm-live.js"));
const r4 = x => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x);
const rd = r => ({ n: r.n, mad: r4(r.mad), chi2: r4(r.chi2), round: r4(r.round), cluster: r4(r.cluster), distinct: r.distinct });
const out = {};
const t0 = Date.now();
out.selfTest = CM.selfTest();

const h = CM.readings(CM.sizesOf(CM.makeTape({ seed: 11 })));
out.honest11 = Object.assign(rd(h), { counts: h.benford.counts, obs: h.benford.obs.map(r4), expected: h.benford.expected.map(r4), top: h.top.map(t => ({ size: CM.fmtUnits(t.size), count: t.count })) });

const cal = CM.calibrate();
out.cal = { seeds: cal.seeds, from: cal.from, perDay: cal.perDay, mean: { mad: r4(cal.mean.mad), round: r4(cal.mean.round), cluster: r4(cal.mean.cluster) }, sd: { mad: r4(cal.sd.mad), round: r4(cal.sd.round), cluster: r4(cal.sd.cluster) } };

const rows = CM.honestRows();
out.fp = {};
for (const k of [2, 2.5, 3, 4]) {
  const f = CM.falsePositives(cal, k, { rows });
  out.fp["k" + k] = { counts: f.counts, rates: { mad: r4(f.rates.mad), round: r4(f.rates.round), cluster: r4(f.rates.cluster), flagged: r4(f.rates.flagged) },
    thresholds: { mad: r4(cal.mean.mad + k * cal.sd.mad), roundLo: r4(cal.mean.round - k * cal.sd.round), roundHi: r4(cal.mean.round + k * cal.sd.round), clusterLo: r4(cal.mean.cluster - k * cal.sd.cluster), clusterHi: r4(cal.mean.cluster + k * cal.sd.cluster) } };
}

function ladRow(x) {
  return { share: x.share, actualShare: r4(x.actualShare), trades: x.trades, pairs: x.pairs, honestVol: x.honestVol, washVol: x.washVol, reportedVol: x.reportedVol,
    mad: r4(x.readings.mad), chi2: r4(x.readings.chi2), round: r4(x.readings.round), cluster: r4(x.readings.cluster), distinct: x.readings.distinct,
    z: { mad: r4(x.z.mad), round: r4(x.z.round), cluster: r4(x.z.cluster) }, fired: x.fired, count: x.count, flagged: x.flagged,
    rankByReported: x.rankByReported, weightByReported: r4(x.weightByReported), weightHonest: r4(x.weightHonest) };
}
function lad(opts) {
  const L = CM.ladder(Object.assign({ cal, k: 2 }, opts));
  return { k: L.k, washStyle: L.washStyle, seedA: L.seedA, seedB: L.seedB,
    venueA: { trades: L.venueA.trades, reportedVol: L.venueA.reportedVol, mad: r4(L.venueA.readings.mad), round: r4(L.venueA.readings.round), cluster: r4(L.venueA.readings.cluster), z: { mad: r4(L.venueA.z.mad), round: r4(L.venueA.z.round), cluster: r4(L.venueA.z.cluster) }, fired: L.venueA.fired, count: L.venueA.count, flagged: L.venueA.flagged },
    rows: L.rows.map(ladRow) };
}
out.ladder = lad({});
out.ladderK = {};
for (const k of [2.5, 3, 4]) out.ladderK["k" + k] = lad({ k }).rows.map(x => ({ share: x.share, count: x.count, flagged: x.flagged }));
out.ladderFlat = lad({ washStyle: "flat" });
out.ladderCopy = lad({ washStyle: "copy" });
out.ladderSeeds = {};
for (const [a, b] of [[101, 102], [2024, 2025], [7, 8], [55555, 55556]]) {
  out.ladderSeeds[a + "-" + b] = lad({ seedA: a, seedB: b }).rows.map(x => ({ share: x.share, mad: x.mad, round: x.round, cluster: x.cluster, count: x.count, flagged: x.flagged, rankByReported: x.rankByReported, weightByReported: x.weightByReported }));
}

// the detection floor: one percent steps, two bot styles, three sensitivities
out.floor = {};
for (const style of ["round", "flat"]) for (const k of [2, 2.5, 3]) {
  const L = CM.ladder({ cal, k, washStyle: style, shares: Array.from({ length: 11 }, (_, i) => i / 100) });
  out.floor[style + "-k" + k] = L.rows.map(x => ({ share: x.share, count: x.count, flagged: x.flagged, mad: r4(x.readings.mad), round: r4(x.readings.round), cluster: r4(x.readings.cluster) }));
}
// the break button at every rung
out.break = [];
const A = CM.makeTape({ seed: 11 });
for (const share of [0, 0.1, 0.3, 0.5, 0.7]) {
  const B = CM.makeTape({ seed: 12, washShare: share });
  const before = { A: rd(CM.readings(CM.sizesOf(A))), B: rd(CM.readings(CM.sizesOf(B))) };
  const sh = CM.shuffleSizes(A, B, 99);
  const after = { A: rd(CM.readings(sh.sizesA)), B: rd(CM.readings(sh.sizesB)) };
  const vA = CM.verdict(after.A, cal, 2), vB = CM.verdict(after.B, cal, 2), vb0 = CM.verdict(before.B, cal, 2);
  out.break.push({ share, before, after, total: sh.total, gapBefore: { mad: r4(before.B.mad - before.A.mad), round: r4(before.B.round - before.A.round), cluster: r4(before.B.cluster - before.A.cluster) },
    gapAfter: { mad: r4(after.B.mad - after.A.mad), round: r4(after.B.round - after.A.round), cluster: r4(after.B.cluster - after.A.cluster) },
    flaggedBefore: { B: vb0.flagged, countB: vb0.count }, flaggedAfter: { A: vA.flagged, countA: vA.count, B: vB.flagged, countB: vB.count } });
}

// candles
const T = CM.makeTape({ seed: 11 });
out.candles = {};
for (const bar of [60, 300, 900, 3600]) {
  const c = CM.buildCandles(T, bar);
  let up = 0, down = 0, flat = 0, maxV = c[0], maxRange = c[0];
  for (const b of c) { if (b.c > b.o) up++; else if (b.c < b.o) down++; else flat++; if (b.v > maxV.v) maxV = b; if (b.h - b.l > maxRange.h - maxRange.l) maxRange = b; }
  out.candles["bar" + bar] = { bars: c.length, possible: Math.floor(CM.DAY / bar), first: { t: c[0].t, o: c[0].o, h: c[0].h, l: c[0].l, c: c[0].c, n: c[0].n, v: c[0].v }, last: { t: c[c.length - 1].t, o: c[c.length - 1].o, h: c[c.length - 1].h, l: c[c.length - 1].l, c: c[c.length - 1].c, n: c[c.length - 1].n, v: c[c.length - 1].v }, up, down, flat, maxVolBar: { t: maxV.t, v: maxV.v, n: maxV.n }, maxRangeBar: { t: maxRange.t, range: maxRange.h - maxRange.l } };
}
out.tape11 = { trades: T.trades.length, reportedVol: T.reportedVol, first5: T.trades.slice(0, 5).map(t => ({ t: t.t, side: t.side, size: t.size, px: t.px })), lastPx: T.trades[T.trades.length - 1].px, minPx: Math.min(...T.trades.map(t => t.px)), maxPx: Math.max(...T.trades.map(t => t.px)) };
out.book = (() => { const b = CM.bookSnapshot(T, 43200, 8); return { at: b.at, lastPx: b.lastPx, spread: b.spread, bids: b.bids.map(x => ({ px: x.px, size: x.size })), asks: b.asks.map(x => ({ px: x.px, size: x.size })) }; })();

// closes under four conventions on a five-day tape
const T5 = CM.makeTape({ seed: 11, days: 5 });
out.closes = {};
for (const off of [0, 8 * 3600, 16 * 3600, 21 * 3600]) {
  const c = CM.closesAt(T5, off);
  out.closes["off" + off] = { closes: c.closes.map(x => ({ day: x.day, at: x.at, close: x.close })), returns: c.returns.map(x => ({ day: x.day, ret: r4(x.ret) })) };
}
out.tape11d5 = { trades: T5.trades.length, lastPx: T5.trades[T5.trades.length - 1].px };

// the market: four venues, one asset, at 13:00
const M = CM.makeMarket({ seed: 11 });
const AT = 13 * 3600, W = 300;
const quotes = M.venues.map(v => Object.assign({ name: v.name }, CM.venueQuote(v.tape, AT, W)));
out.market = { at: AT, window: W, pathAt: M.path[Math.floor(AT / 60)], quotes: quotes.map(q => ({ name: q.name, px: q.px, age: q.age, vol: q.vol, n: q.n })), index: {} };
for (const m of ["mean", "vwap", "median", "vwmedian"]) {
  const plain = CM.indexPrice(quotes, m), excl = CM.indexPrice(quotes, m, { maxAge: 600, tol: 0.002 });
  out.market.index[m] = { plain: r4(plain.level), excluded: r4(excl.level), dropped: excl.dropped.map(d => d.q.name + ":" + d.why) };
}
// a washed venue inside the market: venue B at 60 percent wash
const M2 = CM.makeMarket({ seed: 11, venues: [
  { name: "Venue A", perDay: 3000, offset: 0 }, { name: "Venue B", perDay: 1500, offset: 40, washShare: 0.6 },
  { name: "Venue C", perDay: 600, offset: -30 }, { name: "Venue D", perDay: 250, offset: 0, stale: 600 }] });
const q2 = M2.venues.map(v => Object.assign({ name: v.name }, CM.venueQuote(v.tape, AT, W)));
out.marketWashed = { quotes: q2.map(q => ({ name: q.name, px: q.px, age: q.age, vol: q.vol, n: q.n })), vwap: r4(CM.indexPrice(q2, "vwap").level), vwmedian: r4(CM.indexPrice(q2, "vwmedian").level), median: r4(CM.indexPrice(q2, "median").level), mean: r4(CM.indexPrice(q2, "mean").level),
  weightB: r4(q2[1].vol / q2.reduce((a, q) => a + q.vol, 0)), dayVolShareB: r4(M2.venues[1].tape.reportedVol / M2.venues.reduce((a, v) => a + v.tape.reportedVol, 0)), dayHonestShareB: r4(M2.venues[1].tape.honestVol / M2.venues.reduce((a, v) => a + v.tape.honestVol, 0)) };

// depeg
out.depeg = {};
for (const depth of [0, 0.03, 0.06, 0.12]) {
  const U = CM.unitPath({ seed: 11, depth });
  const R = CM.restate(T, U);
  const e = CM.hourlyExtremes(R);
  out.depeg["d" + depth] = { minUnit: Math.min(...U), maxUnit: Math.max(...U), quoted: r4(e.quoted), quotedHour: e.quotedHour, restated: r4(e.restated), restatedHour: e.restatedHour, hours: e.hours, refAtNoon: R.find(x => x.t >= 43200) ? R.find(x => x.t >= 43200).pxRef : null };
}
out.elapsedMs = Date.now() - t0;
const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === "object" ? Object.keys(o).sort().reduce((a, k) => (a[k] = sortKeys(o[k]), a), {}) : o);
process.stdout.write(JSON.stringify(sortKeys(out), null, 1) + "\n");
