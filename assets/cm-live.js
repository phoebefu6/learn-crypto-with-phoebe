/* cm-live.js - the exchange tape engine for learn-crypto-with-phoebe.

   Everything here is synthetic and says so. Sizes are in abstract units, prices are in ticks of
   an abstract unit of account, there is no asset, no currency and no venue name. A seeded
   generator produces an exchange tape (trades, optionally a planted wash trader) and the
   detectors from the forensic literature run over it for real: Benford first-digit deviation,
   roundness share and size clustering, calibrated on honest tapes so the false-positive rate on
   an honest venue is a measured number rather than a promise.

   Trade sizes are integers in micro-units (1,000,000 = one unit), so every detector is integer
   arithmetic and the Python reference in materials/cm_reference.py reproduces it exactly.
*/
(function (root) {
  "use strict";

  var DAY = 86400;
  var MICRO = 1000000;
  var MU = 1.6;          // ln of the median honest size, in units
  var SIGMA = 1.9;       // ln spread of honest sizes: heavy tailed, several orders of magnitude
  var P_ROUND = 0.25;    // honest traders who pick a one-significant-digit size
  var P_TWO = 0.45;      // honest traders who pick a two-significant-digit size; the rest use three
  var LOTS = [1, 2, 5, 10, 20, 50, 100];            // the round lots a naive wash bot cycles through
  var LOT_W = [0.10, 0.18, 0.22, 0.25, 0.15, 0.07, 0.03];

  function mulberry(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normal(rnd) {
    var u1 = rnd(), u2 = rnd();
    if (u1 < 1e-300) u1 = 1e-300;
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /* Round a positive micro-unit quantity to `sig` significant digits. Returns an integer. */
  function roundSig(rawMicro, sig) {
    if (rawMicro < 1) rawMicro = 1;
    var e = Math.floor(Math.log10(rawMicro));
    var shift = e - sig + 1;
    if (shift <= 0) return Math.floor(rawMicro + 0.5);
    var q = Math.pow(10, shift);
    return Math.floor(rawMicro / q + 0.5) * q;
  }

  /* An honest size: log-normal, then rounded the way a person types a number. */
  function honestSize(rnd) {
    var z = normal(rnd);
    var raw = Math.exp(MU + SIGMA * z) * MICRO;
    var r = rnd();
    var sig = r < P_ROUND ? 1 : (r < P_ROUND + P_TWO ? 2 : 3);
    return roundSig(raw, sig);
  }

  /* A wash size. "round": a naive bot cycling round lots. "flat": a bot drawing unrounded sizes
     from one narrow band. "copy": a bot that samples the honest size distribution, which is the
     honest limit of every size-based detector. */
  function washSize(rnd, style) {
    if (style === "copy") return honestSize(rnd);
    if (style === "flat") return roundSig((2 + 18 * rnd()) * MICRO, 4);
    var r = rnd(), acc = 0;
    for (var i = 0; i < LOTS.length; i++) {
      acc += LOT_W[i];
      if (r < acc) return LOTS[i] * MICRO;
    }
    return LOTS[LOTS.length - 1] * MICRO;
  }

  /* ---------- the tape ----------
     opts: seed, days, perDay (honest trades per day), washShare (share of REPORTED volume that
     is wash), washStyle, pxStart (ticks), pxOffset (venue basis in ticks), pxPath (optional per
     minute price path shared across venues), stale (minute after which pxPath freezes). */
  function makeTape(opts) {
    opts = opts || {};
    var seed = opts.seed == null ? 11 : opts.seed;
    var days = opts.days == null ? 1 : opts.days;
    var perDay = opts.perDay == null ? 3000 : opts.perDay;
    var washShare = opts.washShare == null ? 0 : opts.washShare;
    var washStyle = opts.washStyle || "round";
    var pxStart = opts.pxStart == null ? 100000 : opts.pxStart;
    var pxOffset = opts.pxOffset == null ? 0 : opts.pxOffset;
    var pxPath = opts.pxPath || null;
    var stale = opts.stale == null ? -1 : opts.stale;
    var rnd = mulberry(seed);
    var span = DAY * days;
    var trades = [], seq = 0, i;
    var n = days * perDay;
    var honestVol = 0, washVol = 0, pairs = 0;

    for (i = 0; i < n; i++) {
      var t = Math.floor(rnd() * span);
      var side = rnd() < 0.5 ? 0 : 1;
      var size = honestSize(rnd);
      trades.push({ t: t, side: side, size: size, px: 0, wash: 0, seq: seq++ });
      honestVol += size;
    }

    var target = washShare >= 1 ? Infinity : honestVol * washShare / (1 - washShare);
    while (washVol < target) {
      var tw = Math.floor(rnd() * span);
      var sz = washSize(rnd, washStyle);
      var gap = 1 + Math.floor(rnd() * 4);
      var first = rnd() < 0.5 ? 0 : 1;
      trades.push({ t: tw, side: first, size: sz, px: 0, wash: 1, seq: seq++ });
      trades.push({ t: tw + gap, side: 1 - first, size: sz, px: 0, wash: 1, seq: seq++ });
      washVol += 2 * sz;
      pairs++;
    }

    trades.sort(function (a, b) { return a.t - b.t || a.seq - b.seq; });

    /* The price. Honest trades move it by -3..+3 ticks; wash trades print at it and move nothing.
       With a shared pxPath the venue follows the market path plus its own basis and a jitter. */
    var px = pxStart + pxOffset;
    for (i = 0; i < trades.length; i++) {
      var tr = trades[i];
      if (pxPath) {
        var m = Math.floor(tr.t / 60);
        if (m >= pxPath.length) m = pxPath.length - 1;
        if (stale >= 0 && m > stale) m = stale;
        tr.px = pxPath[m] + pxOffset + (Math.floor(rnd() * 5) - 2);
      } else {
        if (!tr.wash) {
          px += Math.floor(rnd() * 7) - 3;
          if (px < 1000) px = 1000;
        }
        tr.px = px;
      }
    }

    return {
      seed: seed, days: days, perDay: perDay, washShare: washShare, washStyle: washStyle,
      trades: trades, honest: n, pairs: pairs,
      honestVol: honestVol, washVol: washVol, reportedVol: honestVol + washVol
    };
  }

  function sizesOf(tape) {
    var out = new Array(tape.trades.length);
    for (var i = 0; i < out.length; i++) out[i] = tape.trades[i].size;
    return out;
  }

  /* ---------- derived objects: candles, closes, a book snapshot ---------- */
  function buildCandles(tape, barSec) {
    var bars = [], cur = null;
    for (var i = 0; i < tape.trades.length; i++) {
      var tr = tape.trades[i];
      var b = Math.floor(tr.t / barSec);
      if (!cur || cur.bar !== b) {
        cur = { bar: b, t: b * barSec, o: tr.px, h: tr.px, l: tr.px, c: tr.px, v: 0, n: 0 };
        bars.push(cur);
      }
      if (tr.px > cur.h) cur.h = tr.px;
      if (tr.px < cur.l) cur.l = tr.px;
      cur.c = tr.px;
      cur.v += tr.size;
      cur.n += 1;
    }
    return bars;
  }

  /* The "close" under a convention: the last print before each boundary at offsetSec past
     midnight. Returns one row per boundary that has a print before it. */
  function closesAt(tape, offsetSec) {
    var out = [], last = null, d = 0;
    var boundary = offsetSec + DAY * d;
    for (var i = 0; i <= tape.trades.length; i++) {
      var tr = i < tape.trades.length ? tape.trades[i] : null;
      while (tr === null || tr.t >= boundary) {
        if (last !== null) out.push({ day: d, at: boundary, close: last.px });
        d++; boundary = offsetSec + DAY * d;
        if (tr === null || boundary > DAY * tape.days + offsetSec) break;
      }
      if (tr === null) break;
      last = tr;
    }
    var rets = [];
    for (var k = 1; k < out.length; k++) {
      rets.push({ day: out[k].day, ret: (out[k].close - out[k - 1].close) / out[k - 1].close });
    }
    return { closes: out, returns: rets };
  }

  function bookSnapshot(tape, atSec, levels) {
    levels = levels || 8;
    var last = null;
    for (var i = 0; i < tape.trades.length && tape.trades[i].t <= atSec; i++) last = tape.trades[i];
    var mid = last ? last.px : 100000;
    var rnd = mulberry(tape.seed + 7 + atSec);
    var bids = [], asks = [];
    for (var k = 0; k < levels; k++) {
      bids.push({ px: mid - 5 - 10 * k, size: honestSize(rnd) });
      asks.push({ px: mid + 5 + 10 * k, size: honestSize(rnd) });
    }
    return { at: atSec, lastPx: mid, bids: bids, asks: asks, spread: asks[0].px - bids[0].px, depth: levels };
  }

  /* ---------- many venues, one asset ---------- */
  function makeMarket(opts) {
    opts = opts || {};
    var seed = opts.seed == null ? 11 : opts.seed;
    var days = opts.days == null ? 1 : opts.days;
    var venues = opts.venues || [
      { name: "Venue A", perDay: 3000, offset: 0 },
      { name: "Venue B", perDay: 1500, offset: 40 },
      { name: "Venue C", perDay: 600, offset: -30 },
      { name: "Venue D", perDay: 250, offset: 0, stale: 600 }
    ];
    var rnd = mulberry(seed + 999);
    var path = [], px = 100000;
    for (var m = 0; m < days * 1440; m++) {
      path.push(px);
      px += Math.floor(rnd() * 41) - 20;
      if (px < 1000) px = 1000;
    }
    var out = [];
    for (var v = 0; v < venues.length; v++) {
      var cfg = venues[v];
      out.push({
        name: cfg.name,
        tape: makeTape({ seed: seed + v + 1, days: days, perDay: cfg.perDay, pxPath: path,
                         pxOffset: cfg.offset, stale: cfg.stale == null ? -1 : cfg.stale,
                         washShare: cfg.washShare || 0, washStyle: cfg.washStyle })
      });
    }
    return { seed: seed, path: path, venues: out };
  }

  /* The quote a venue gives at a moment: its last print and its volume in the trailing window. */
  function venueQuote(tape, atSec, windowSec) {
    var last = null, vol = 0, n = 0;
    for (var i = 0; i < tape.trades.length; i++) {
      var tr = tape.trades[i];
      if (tr.t > atSec) break;
      last = tr;
      if (tr.t > atSec - windowSec) { vol += tr.size; n++; }
    }
    return { px: last ? last.px : null, age: last ? atSec - last.t : null, vol: vol, n: n };
  }

  function median(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var n = s.length;
    if (n === 0) return null;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  /* An index level from venue quotes. method: mean | vwap | median | vwmedian.
     opts.maxAge drops stale quotes; opts.tol drops quotes further than tol from the median. */
  function indexPrice(quotes, method, opts) {
    opts = opts || {};
    var used = [], dropped = [];
    var med = median(quotes.filter(function (q) { return q.px !== null; }).map(function (q) { return q.px; }));
    quotes.forEach(function (q) {
      if (q.px === null) { dropped.push({ q: q, why: "no print" }); return; }
      if (opts.maxAge != null && q.age > opts.maxAge) { dropped.push({ q: q, why: "stale" }); return; }
      if (opts.tol != null && Math.abs(q.px - med) / med > opts.tol) { dropped.push({ q: q, why: "outlier" }); return; }
      used.push(q);
    });
    if (!used.length) return { level: null, used: used, dropped: dropped };
    var level;
    if (method === "mean") {
      level = used.reduce(function (a, q) { return a + q.px; }, 0) / used.length;
    } else if (method === "vwap") {
      var vol = used.reduce(function (a, q) { return a + q.vol; }, 0);
      level = vol ? used.reduce(function (a, q) { return a + q.px * q.vol; }, 0) / vol : median(used.map(function (q) { return q.px; }));
    } else if (method === "vwmedian") {
      var s = used.slice().sort(function (a, b) { return a.px - b.px || a.vol - b.vol; });
      var tot = s.reduce(function (a, q) { return a + q.vol; }, 0), acc = 0;
      level = s[s.length - 1].px;
      for (var i = 0; i < s.length; i++) { acc += s[i].vol; if (acc * 2 >= tot) { level = s[i].px; break; } }
    } else {
      level = median(used.map(function (q) { return q.px; }));
    }
    return { level: level, used: used, dropped: dropped };
  }

  /* ---------- the unit of account can move ----------
     A per-minute path of the quoting unit against a reference, normally 1.000000 give or take
     a thousandth, with one declared depeg: a linear fall of `depth` over `fall` minutes from
     minute `start`, held for `hold`, then a linear recovery over `recover`. Values in micro. */
  function unitPath(opts) {
    opts = opts || {};
    var seed = opts.seed == null ? 11 : opts.seed;
    var minutes = opts.minutes == null ? 1440 : opts.minutes;
    var depth = opts.depth == null ? 0 : opts.depth;
    var start = opts.start == null ? 600 : opts.start;
    var fall = opts.fall == null ? 90 : opts.fall;
    var hold = opts.hold == null ? 120 : opts.hold;
    var recover = opts.recover == null ? 240 : opts.recover;
    var rnd = mulberry(seed + 4242);
    var out = [];
    for (var m = 0; m < minutes; m++) {
      var jitter = Math.floor(rnd() * 2001) - 1000;
      var f = 0;
      if (m >= start && m < start + fall) f = (m - start) / fall;
      else if (m >= start + fall && m < start + fall + hold) f = 1;
      else if (m >= start + fall + hold && m < start + fall + hold + recover) f = 1 - (m - start - fall - hold) / recover;
      out.push(Math.floor(MICRO * (1 - depth * f) + 0.5) + jitter);
    }
    return out;
  }

  /* Restate a tape's prices from the quoting unit into the reference unit. */
  function restate(tape, path) {
    var out = [];
    for (var i = 0; i < tape.trades.length; i++) {
      var tr = tape.trades[i];
      var m = Math.floor(tr.t / 60);
      if (m >= path.length) m = path.length - 1;
      out.push({ t: tr.t, px: tr.px, pxRef: Math.floor(tr.px * path[m] / MICRO + 0.5) });
    }
    return out;
  }

  /* The largest hour-over-hour move of the last print, in the quoted and the restated unit. */
  function hourlyExtremes(restated) {
    var closes = {}, hours = [];
    restated.forEach(function (r) {
      var h = Math.floor(r.t / 3600);
      if (!(h in closes)) hours.push(h);
      closes[h] = r;
    });
    var worstQ = 0, worstR = 0, hourQ = null, hourR = null;
    for (var i = 1; i < hours.length; i++) {
      var a = closes[hours[i - 1]], b = closes[hours[i]];
      var mq = (b.px - a.px) / a.px, mr = (b.pxRef - a.pxRef) / a.pxRef;
      if (Math.abs(mq) > Math.abs(worstQ)) { worstQ = mq; hourQ = hours[i]; }
      if (Math.abs(mr) > Math.abs(worstR)) { worstR = mr; hourR = hours[i]; }
    }
    return { quoted: worstQ, quotedHour: hourQ, restated: worstR, restatedHour: hourR, hours: hours.length };
  }

  /* ---------- the three forensic detectors ---------- */
  var BENFORD = [];
  for (var d = 1; d <= 9; d++) BENFORD.push(Math.log10(1 + 1 / d));

  function firstDigit(m) { while (m >= 10) m = Math.floor(m / 10); return m; }
  function isRound(m) { while (m > 0 && m % 10 === 0) m = m / 10; return m < 10; }

  function benford(sizes) {
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0], n = sizes.length, i;
    for (i = 0; i < n; i++) counts[firstDigit(sizes[i]) - 1]++;
    var obs = [], mad = 0, chi2 = 0;
    for (i = 0; i < 9; i++) {
      var p = n ? counts[i] / n : 0;
      obs.push(p);
      mad += Math.abs(p - BENFORD[i]) / 9;
      chi2 += n ? n * (p - BENFORD[i]) * (p - BENFORD[i]) / BENFORD[i] : 0;
    }
    return { n: n, counts: counts, obs: obs, expected: BENFORD, mad: mad, chi2: chi2 };
  }

  function roundShare(sizes) {
    var r = 0;
    for (var i = 0; i < sizes.length; i++) if (isRound(sizes[i])) r++;
    return sizes.length ? r / sizes.length : 0;
  }

  function clusterShare(sizes, k) {
    k = k || 5;
    var counts = {}, i;
    for (i = 0; i < sizes.length; i++) counts[sizes[i]] = (counts[sizes[i]] || 0) + 1;
    var keys = Object.keys(counts).map(Number);
    keys.sort(function (a, b) { return counts[b] - counts[a] || a - b; });
    var top = [], sum = 0;
    for (i = 0; i < keys.length && i < k; i++) { top.push({ size: keys[i], count: counts[keys[i]] }); sum += counts[keys[i]]; }
    return { share: sizes.length ? sum / sizes.length : 0, top: top, distinct: keys.length };
  }

  function readings(sizes) {
    var b = benford(sizes), c = clusterShare(sizes, 5);
    return { n: sizes.length, mad: b.mad, chi2: b.chi2, round: roundShare(sizes), cluster: c.share, benford: b, top: c.top, distinct: c.distinct };
  }

  /* Calibrate on honest tapes: mean and population sd of each reading over `seeds` honest venues. */
  function calibrate(opts) {
    opts = opts || {};
    var seeds = opts.seeds == null ? 40 : opts.seeds;
    var from = opts.from == null ? 1001 : opts.from;
    var perDay = opts.perDay == null ? 3000 : opts.perDay;
    var keys = ["mad", "round", "cluster"], sum = { mad: 0, round: 0, cluster: 0 }, sq = { mad: 0, round: 0, cluster: 0 };
    var rows = [];
    for (var s = 0; s < seeds; s++) {
      var r = readings(sizesOf(makeTape({ seed: from + s, perDay: perDay })));
      rows.push({ seed: from + s, mad: r.mad, round: r.round, cluster: r.cluster });
      keys.forEach(function (k) { sum[k] += r[k]; sq[k] += r[k] * r[k]; });
    }
    var mean = {}, sd = {};
    keys.forEach(function (k) {
      mean[k] = sum[k] / seeds;
      var v = sq[k] / seeds - mean[k] * mean[k];
      sd[k] = Math.sqrt(v > 0 ? v : 0);
    });
    return { seeds: seeds, from: from, perDay: perDay, mean: mean, sd: sd, rows: rows };
  }

  /* The verdict at a sensitivity k (in honest standard deviations). Benford deviation is one
     sided: more deviation is the anomaly. Roundness and clustering are two sided, because the
     published finding on unregulated venues was LESS roundness than human traders show, while
     a naive bot shows more. A venue is flagged when at least two of the three fire. */
  function verdict(r, cal, k) {
    var z = {
      mad: (r.mad - cal.mean.mad) / cal.sd.mad,
      round: (r.round - cal.mean.round) / cal.sd.round,
      cluster: (r.cluster - cal.mean.cluster) / cal.sd.cluster
    };
    var fired = { mad: z.mad > k, round: Math.abs(z.round) > k, cluster: Math.abs(z.cluster) > k };
    var count = (fired.mad ? 1 : 0) + (fired.round ? 1 : 0) + (fired.cluster ? 1 : 0);
    return { z: z, fired: fired, count: count, flagged: count >= 2 };
  }

  /* Readings on fresh honest venues never used for calibration; computed once, judged at any k. */
  function honestRows(opts) {
    opts = opts || {};
    var seeds = opts.seeds == null ? 200 : opts.seeds;
    var from = opts.from == null ? 2001 : opts.from;
    var perDay = opts.perDay == null ? 3000 : opts.perDay;
    var rows = [];
    for (var s = 0; s < seeds; s++) {
      var r = readings(sizesOf(makeTape({ seed: from + s, perDay: perDay })));
      rows.push({ seed: from + s, mad: r.mad, round: r.round, cluster: r.cluster });
    }
    return rows;
  }

  /* The false-positive rate: how often an honest venue is flagged at sensitivity k. */
  function falsePositives(cal, k, opts) {
    opts = opts || {};
    var rows = opts.rows || honestRows({ seeds: opts.seeds, from: opts.from, perDay: cal.perDay });
    var fp = { mad: 0, round: 0, cluster: 0, flagged: 0 };
    for (var s = 0; s < rows.length; s++) {
      var v = verdict(rows[s], cal, k);
      if (v.fired.mad) fp.mad++;
      if (v.fired.round) fp.round++;
      if (v.fired.cluster) fp.cluster++;
      if (v.flagged) fp.flagged++;
    }
    var n = rows.length;
    return { seeds: n, from: rows.length ? rows[0].seed : null, k: k, counts: fp,
             rates: { mad: fp.mad / n, round: fp.round / n, cluster: fp.cluster / n, flagged: fp.flagged / n } };
  }

  /* ---------- the bench: two venues, one planted washer ---------- */
  function ladder(opts) {
    opts = opts || {};
    var seedA = opts.seedA == null ? 11 : opts.seedA;
    var seedB = opts.seedB == null ? 12 : opts.seedB;
    var shares = opts.shares || [0, 0.1, 0.3, 0.5, 0.7];
    var style = opts.washStyle || "round";
    var k = opts.k == null ? 2 : opts.k;
    var cal = opts.cal || calibrate();
    var A = makeTape({ seed: seedA });
    var rA = readings(sizesOf(A)), vA = verdict(rA, cal, k);
    var rows = [];
    for (var i = 0; i < shares.length; i++) {
      var B = makeTape({ seed: seedB, washShare: shares[i], washStyle: style });
      var rB = readings(sizesOf(B)), vB = verdict(rB, cal, k);
      var weightB = B.reportedVol / (A.reportedVol + B.reportedVol);
      rows.push({
        share: shares[i], actualShare: B.reportedVol ? B.washVol / B.reportedVol : 0,
        trades: B.trades.length, pairs: B.pairs,
        honestVol: B.honestVol, washVol: B.washVol, reportedVol: B.reportedVol,
        readings: { mad: rB.mad, chi2: rB.chi2, round: rB.round, cluster: rB.cluster, distinct: rB.distinct },
        z: vB.z, fired: vB.fired, count: vB.count, flagged: vB.flagged,
        rankByReported: B.reportedVol > A.reportedVol ? 1 : 2,
        weightByReported: weightB,
        weightHonest: B.honestVol / (A.honestVol + B.honestVol)
      });
    }
    return {
      k: k, washStyle: style, seedA: seedA, seedB: seedB,
      venueA: { trades: A.trades.length, reportedVol: A.reportedVol, readings: { mad: rA.mad, chi2: rA.chi2, round: rA.round, cluster: rA.cluster }, z: vA.z, fired: vA.fired, count: vA.count, flagged: vA.flagged },
      rows: rows
    };
  }

  /* The break button: pool every size on both venues and deal them back out at random, so the
     planted structure is spread evenly and the gap between the venues should vanish. */
  function shuffleSizes(tapeA, tapeB, seed) {
    var pool = sizesOf(tapeA).concat(sizesOf(tapeB));
    var rnd = mulberry(seed == null ? 99 : seed);
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var nA = tapeA.trades.length;
    return { sizesA: pool.slice(0, nA), sizesB: pool.slice(nA), total: pool.reduce(function (a, b) { return a + b; }, 0) };
  }

  /* ---------- self test ----------
     Each property names the fault it exists to catch. Property 5 is the one that fails when the
     two-sided roundness test is made one-sided (the fault a naive implementation introduces),
     and it was run against that fault before this file shipped. */
  function selfTest() {
    var out = [];
    var cal = calibrate({ seeds: 12, from: 3001 });

    // 1. an honest tape conforms to Benford at Nigrini's "acceptable" bound.
    var h = readings(sizesOf(makeTape({ seed: 11 })));
    out.push({ name: "an honest tape conforms to Benford (MAD under 0.012)", expected: "< 0.012", got: h.mad.toFixed(4), ok: h.mad < 0.012 });

    // 2. a planted round-lot washer at half the reported volume is flagged.
    var w = makeTape({ seed: 12, washShare: 0.5 });
    var vw = verdict(readings(sizesOf(w)), cal, 2.5);
    out.push({ name: "a round-lot washer at 50 percent is flagged", expected: "flagged", got: vw.count + " of 3 fired", ok: vw.flagged });

    // 3. reported volume is honest plus wash, and the wash share lands within one lot of target.
    var gap = Math.abs(w.washVol / w.reportedVol - 0.5);
    out.push({ name: "reported volume equals honest plus wash, share within one lot of target", expected: "< 0.01", got: gap.toFixed(4), ok: w.reportedVol === w.honestVol + w.washVol && gap < 0.01 });

    // 4. every wash trade has a same-size opposite-side partner within 4 seconds.
    var byKey = {}, unmatched = 0, ws = w.trades.filter(function (t) { return t.wash; });
    ws.forEach(function (t) { (byKey[t.size] = byKey[t.size] || []).push(t); });
    ws.forEach(function (t) {
      var ok = byKey[t.size].some(function (u) { return u !== t && u.side !== t.side && Math.abs(u.t - t.t) <= 4; });
      if (!ok) unmatched++;
    });
    out.push({ name: "every wash trade has an opposite-side twin within 4 seconds", expected: 0, got: unmatched, ok: unmatched === 0 });

    // 5. a flat bot (too FEW round sizes) is caught: the roundness test must be two sided.
    var f = makeTape({ seed: 12, washShare: 0.5, washStyle: "flat" });
    var vf = verdict(readings(sizesOf(f)), cal, 2.5);
    out.push({ name: "a bot with too few round sizes still fires the roundness test", expected: "round fires", got: vf.fired.round ? "fires" : "silent", ok: vf.fired.round });

    // 6. the break button keeps the multiset: total size is conserved.
    var A = makeTape({ seed: 11 });
    var sh = shuffleSizes(A, w, 99);
    out.push({ name: "shuffling sizes across venues conserves total size", expected: A.reportedVol + w.reportedVol, got: sh.total, ok: sh.total === A.reportedVol + w.reportedVol });

    return { ok: out.every(function (o) { return o.ok; }), results: out };
  }

  root.CM = {
    DAY: DAY, MICRO: MICRO, LOTS: LOTS, BENFORD: BENFORD,
    mulberry: mulberry, honestSize: honestSize, washSize: washSize, roundSig: roundSig,
    makeTape: makeTape, sizesOf: sizesOf,
    buildCandles: buildCandles, closesAt: closesAt, bookSnapshot: bookSnapshot,
    makeMarket: makeMarket, venueQuote: venueQuote, indexPrice: indexPrice, median: median,
    unitPath: unitPath, restate: restate, hourlyExtremes: hourlyExtremes,
    firstDigit: firstDigit, isRound: isRound, benford: benford, roundShare: roundShare, clusterShare: clusterShare,
    readings: readings, calibrate: calibrate, verdict: verdict, honestRows: honestRows, falsePositives: falsePositives,
    ladder: ladder, shuffleSizes: shuffleSizes, selfTest: selfTest,
    fmtUnits: function (micro) {
      var s = (micro / MICRO).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
      return s;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).CM;
}
