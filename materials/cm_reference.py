#!/usr/bin/env python3
"""cm_reference.py - Python mirror of assets/cm-live.js for learn-crypto-with-phoebe.

Reproduces the exchange-tape generator, the three forensic detectors, the calibration, the
false-positive sweep, the bench ladder, the break button, the candles, the close conventions,
the venue index and the depeg restatement, step for step, from the same seeds. Sizes are
integer micro-units, so every detector is integer arithmetic; the only floating point is the
log-normal draw and the index levels. Run it and diff against the node run of the engine:

    python3 materials/cm_reference.py > /tmp/py.json
    node materials/cm_canon.js > /tmp/node.json      (prints the same keys)

Everything here is synthetic and says so: abstract units, no asset, no currency, no venue.
"""
import json
import math
import sys

DAY = 86400
MICRO = 1000000
MU = 1.6
SIGMA = 1.9
P_ROUND = 0.25
P_TWO = 0.45
LOTS = [1, 2, 5, 10, 20, 50, 100]
LOT_W = [0.10, 0.18, 0.22, 0.25, 0.15, 0.07, 0.03]
M32 = 0xFFFFFFFF


def imul(a, b):
    """Math.imul: 32-bit signed multiply."""
    r = (a * b) & M32
    return r - (1 << 32) if r & 0x80000000 else r


def to_i32(x):
    x &= M32
    return x - (1 << 32) if x & 0x80000000 else x


def mulberry(seed):
    state = [seed & M32]

    def rnd():
        state[0] = (state[0] + 0x6D2B79F5) & M32
        t = state[0]
        r = imul(t ^ (t >> 15), 1 | t)
        r = to_i32(r ^ ((r + imul(r ^ ((r & M32) >> 7), 61 | r)) & M32))
        ru = r & M32
        return ((ru ^ (ru >> 14)) & M32) / 4294967296
    return rnd


def normal(rnd):
    u1 = rnd()
    u2 = rnd()
    if u1 < 1e-300:
        u1 = 1e-300
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def round_sig(raw_micro, sig):
    if raw_micro < 1:
        raw_micro = 1
    e = math.floor(math.log10(raw_micro))
    shift = e - sig + 1
    if shift <= 0:
        return math.floor(raw_micro + 0.5)
    q = 10 ** shift
    return math.floor(raw_micro / q + 0.5) * q


def honest_size(rnd):
    z = normal(rnd)
    raw = math.exp(MU + SIGMA * z) * MICRO
    r = rnd()
    sig = 1 if r < P_ROUND else (2 if r < P_ROUND + P_TWO else 3)
    return round_sig(raw, sig)


def wash_size(rnd, style):
    if style == "copy":
        return honest_size(rnd)
    if style == "flat":
        return round_sig((2 + 18 * rnd()) * MICRO, 4)
    r = rnd()
    acc = 0.0
    for lot, w in zip(LOTS, LOT_W):
        acc += w
        if r < acc:
            return lot * MICRO
    return LOTS[-1] * MICRO


def make_tape(seed=11, days=1, per_day=3000, wash_share=0.0, wash_style="round",
              px_start=100000, px_offset=0, px_path=None, stale=-1):
    rnd = mulberry(seed)
    span = DAY * days
    trades = []
    seq = 0
    n = days * per_day
    honest_vol = 0
    wash_vol = 0
    pairs = 0
    for _ in range(n):
        t = math.floor(rnd() * span)
        side = 0 if rnd() < 0.5 else 1
        size = honest_size(rnd)
        trades.append({"t": t, "side": side, "size": size, "px": 0, "wash": 0, "seq": seq})
        seq += 1
        honest_vol += size
    target = math.inf if wash_share >= 1 else honest_vol * wash_share / (1 - wash_share)
    while wash_vol < target:
        tw = math.floor(rnd() * span)
        sz = wash_size(rnd, wash_style)
        gap = 1 + math.floor(rnd() * 4)
        first = 0 if rnd() < 0.5 else 1
        trades.append({"t": tw, "side": first, "size": sz, "px": 0, "wash": 1, "seq": seq}); seq += 1
        trades.append({"t": tw + gap, "side": 1 - first, "size": sz, "px": 0, "wash": 1, "seq": seq}); seq += 1
        wash_vol += 2 * sz
        pairs += 1
    trades.sort(key=lambda tr: (tr["t"], tr["seq"]))
    px = px_start + px_offset
    for tr in trades:
        if px_path is not None:
            m = tr["t"] // 60
            if m >= len(px_path):
                m = len(px_path) - 1
            if stale >= 0 and m > stale:
                m = stale
            tr["px"] = px_path[m] + px_offset + (math.floor(rnd() * 5) - 2)
        else:
            if not tr["wash"]:
                px += math.floor(rnd() * 7) - 3
                if px < 1000:
                    px = 1000
            tr["px"] = px
    return {"seed": seed, "days": days, "perDay": per_day, "washShare": wash_share, "washStyle": wash_style,
            "trades": trades, "honest": n, "pairs": pairs,
            "honestVol": honest_vol, "washVol": wash_vol, "reportedVol": honest_vol + wash_vol}


def sizes_of(tape):
    return [tr["size"] for tr in tape["trades"]]


def build_candles(tape, bar_sec):
    bars = []
    cur = None
    for tr in tape["trades"]:
        b = tr["t"] // bar_sec
        if cur is None or cur["bar"] != b:
            cur = {"bar": b, "t": b * bar_sec, "o": tr["px"], "h": tr["px"], "l": tr["px"], "c": tr["px"], "v": 0, "n": 0}
            bars.append(cur)
        cur["h"] = max(cur["h"], tr["px"])
        cur["l"] = min(cur["l"], tr["px"])
        cur["c"] = tr["px"]
        cur["v"] += tr["size"]
        cur["n"] += 1
    return bars


def closes_at(tape, offset_sec):
    out = []
    last = None
    d = 0
    boundary = offset_sec + DAY * d
    trades = tape["trades"]
    i = 0
    stop = False
    while i <= len(trades) and not stop:
        tr = trades[i] if i < len(trades) else None
        while tr is None or tr["t"] >= boundary:
            if last is not None:
                out.append({"day": d, "at": boundary, "close": last["px"]})
            d += 1
            boundary = offset_sec + DAY * d
            if tr is None or boundary > DAY * tape["days"] + offset_sec:
                break
        if tr is None:
            break
        last = tr
        i += 1
    rets = [{"day": out[k]["day"], "ret": (out[k]["close"] - out[k - 1]["close"]) / out[k - 1]["close"]} for k in range(1, len(out))]
    return {"closes": out, "returns": rets}


def book_snapshot(tape, at_sec, levels=8):
    last = None
    for tr in tape["trades"]:
        if tr["t"] > at_sec:
            break
        last = tr
    mid = last["px"] if last else 100000
    rnd = mulberry(tape["seed"] + 7 + at_sec)
    bids, asks = [], []
    for k in range(levels):
        bids.append({"px": mid - 5 - 10 * k, "size": honest_size(rnd)})
        asks.append({"px": mid + 5 + 10 * k, "size": honest_size(rnd)})
    return {"at": at_sec, "lastPx": mid, "bids": bids, "asks": asks, "spread": asks[0]["px"] - bids[0]["px"], "depth": levels}


DEFAULT_VENUES = [
    {"name": "Venue A", "perDay": 3000, "offset": 0},
    {"name": "Venue B", "perDay": 1500, "offset": 40},
    {"name": "Venue C", "perDay": 600, "offset": -30},
    {"name": "Venue D", "perDay": 250, "offset": 0, "stale": 600},
]


def make_market(seed=11, days=1, venues=None):
    venues = venues or DEFAULT_VENUES
    rnd = mulberry(seed + 999)
    path = []
    px = 100000
    for _ in range(days * 1440):
        path.append(px)
        px += math.floor(rnd() * 41) - 20
        if px < 1000:
            px = 1000
    out = []
    for v, cfg in enumerate(venues):
        out.append({"name": cfg["name"], "tape": make_tape(seed=seed + v + 1, days=days, per_day=cfg["perDay"], px_path=path,
                                                            px_offset=cfg["offset"], stale=cfg.get("stale", -1),
                                                            wash_share=cfg.get("washShare", 0.0), wash_style=cfg.get("washStyle", "round"))})
    return {"seed": seed, "path": path, "venues": out}


def venue_quote(tape, at_sec, window_sec):
    last = None
    vol = 0
    n = 0
    for tr in tape["trades"]:
        if tr["t"] > at_sec:
            break
        last = tr
        if tr["t"] > at_sec - window_sec:
            vol += tr["size"]
            n += 1
    return {"px": last["px"] if last else None, "age": (at_sec - last["t"]) if last else None, "vol": vol, "n": n}


def median(xs):
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return None
    return s[(n - 1) // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def index_price(quotes, method, max_age=None, tol=None):
    used, dropped = [], []
    med = median([q["px"] for q in quotes if q["px"] is not None])
    for q in quotes:
        if q["px"] is None:
            dropped.append((q, "no print")); continue
        if max_age is not None and q["age"] > max_age:
            dropped.append((q, "stale")); continue
        if tol is not None and abs(q["px"] - med) / med > tol:
            dropped.append((q, "outlier")); continue
        used.append(q)
    if not used:
        return {"level": None, "used": used, "dropped": dropped}
    if method == "mean":
        level = sum(q["px"] for q in used) / len(used)
    elif method == "vwap":
        vol = sum(q["vol"] for q in used)
        level = sum(q["px"] * q["vol"] for q in used) / vol if vol else median([q["px"] for q in used])
    elif method == "vwmedian":
        s = sorted(used, key=lambda q: (q["px"], q["vol"]))
        tot = sum(q["vol"] for q in s)
        acc = 0
        level = s[-1]["px"]
        for q in s:
            acc += q["vol"]
            if acc * 2 >= tot:
                level = q["px"]
                break
    else:
        level = median([q["px"] for q in used])
    return {"level": level, "used": used, "dropped": dropped}


def unit_path(seed=11, minutes=1440, depth=0.0, start=600, fall=90, hold=120, recover=240):
    rnd = mulberry(seed + 4242)
    out = []
    for m in range(minutes):
        jitter = math.floor(rnd() * 2001) - 1000
        f = 0.0
        if start <= m < start + fall:
            f = (m - start) / fall
        elif start + fall <= m < start + fall + hold:
            f = 1.0
        elif start + fall + hold <= m < start + fall + hold + recover:
            f = 1 - (m - start - fall - hold) / recover
        out.append(math.floor(MICRO * (1 - depth * f) + 0.5) + jitter)
    return out


def restate(tape, path):
    out = []
    for tr in tape["trades"]:
        m = tr["t"] // 60
        if m >= len(path):
            m = len(path) - 1
        out.append({"t": tr["t"], "px": tr["px"], "pxRef": math.floor(tr["px"] * path[m] / MICRO + 0.5)})
    return out


def hourly_extremes(restated):
    closes = {}
    hours = []
    for r in restated:
        h = r["t"] // 3600
        if h not in closes:
            hours.append(h)
        closes[h] = r
    worst_q = 0.0
    worst_r = 0.0
    hour_q = None
    hour_r = None
    for i in range(1, len(hours)):
        a, b = closes[hours[i - 1]], closes[hours[i]]
        mq = (b["px"] - a["px"]) / a["px"]
        mr = (b["pxRef"] - a["pxRef"]) / a["pxRef"]
        if abs(mq) > abs(worst_q):
            worst_q, hour_q = mq, hours[i]
        if abs(mr) > abs(worst_r):
            worst_r, hour_r = mr, hours[i]
    return {"quoted": worst_q, "quotedHour": hour_q, "restated": worst_r, "restatedHour": hour_r, "hours": len(hours)}


BENFORD = [math.log10(1 + 1 / d) for d in range(1, 10)]


def first_digit(m):
    while m >= 10:
        m //= 10
    return m


def is_round(m):
    while m > 0 and m % 10 == 0:
        m //= 10
    return m < 10


def benford(sizes):
    counts = [0] * 9
    n = len(sizes)
    for s in sizes:
        counts[first_digit(s) - 1] += 1
    obs = []
    mad = 0.0
    chi2 = 0.0
    for i in range(9):
        p = counts[i] / n if n else 0
        obs.append(p)
        mad += abs(p - BENFORD[i]) / 9
        chi2 += n * (p - BENFORD[i]) * (p - BENFORD[i]) / BENFORD[i] if n else 0
    return {"n": n, "counts": counts, "obs": obs, "expected": BENFORD, "mad": mad, "chi2": chi2}


def round_share(sizes):
    return sum(1 for s in sizes if is_round(s)) / len(sizes) if sizes else 0


def cluster_share(sizes, k=5):
    counts = {}
    for s in sizes:
        counts[s] = counts.get(s, 0) + 1
    keys = sorted(counts, key=lambda s: (-counts[s], s))
    top = [{"size": s, "count": counts[s]} for s in keys[:k]]
    tot = sum(t["count"] for t in top)
    return {"share": tot / len(sizes) if sizes else 0, "top": top, "distinct": len(keys)}


def readings(sizes):
    b = benford(sizes)
    c = cluster_share(sizes, 5)
    return {"n": len(sizes), "mad": b["mad"], "chi2": b["chi2"], "round": round_share(sizes), "cluster": c["share"],
            "benford": b, "top": c["top"], "distinct": c["distinct"]}


def calibrate(seeds=40, start=1001, per_day=3000):
    keys = ["mad", "round", "cluster"]
    tot = {k: 0.0 for k in keys}
    sq = {k: 0.0 for k in keys}
    rows = []
    for s in range(seeds):
        r = readings(sizes_of(make_tape(seed=start + s, per_day=per_day)))
        rows.append({"seed": start + s, "mad": r["mad"], "round": r["round"], "cluster": r["cluster"]})
        for k in keys:
            tot[k] += r[k]
            sq[k] += r[k] * r[k]
    mean = {k: tot[k] / seeds for k in keys}
    sd = {}
    for k in keys:
        v = sq[k] / seeds - mean[k] * mean[k]
        sd[k] = math.sqrt(v if v > 0 else 0)
    return {"seeds": seeds, "from": start, "perDay": per_day, "mean": mean, "sd": sd, "rows": rows}


def verdict(r, cal, k):
    z = {key: (r[key] - cal["mean"][key]) / cal["sd"][key] for key in ("mad", "round", "cluster")}
    fired = {"mad": z["mad"] > k, "round": abs(z["round"]) > k, "cluster": abs(z["cluster"]) > k}
    count = sum(1 for v in fired.values() if v)
    return {"z": z, "fired": fired, "count": count, "flagged": count >= 2}


def honest_rows(seeds=200, start=2001, per_day=3000):
    rows = []
    for s in range(seeds):
        r = readings(sizes_of(make_tape(seed=start + s, per_day=per_day)))
        rows.append({"seed": start + s, "mad": r["mad"], "round": r["round"], "cluster": r["cluster"]})
    return rows


def false_positives(cal, k, rows):
    fp = {"mad": 0, "round": 0, "cluster": 0, "flagged": 0}
    for r in rows:
        v = verdict(r, cal, k)
        for key in ("mad", "round", "cluster"):
            if v["fired"][key]:
                fp[key] += 1
        if v["flagged"]:
            fp["flagged"] += 1
    n = len(rows)
    return {"seeds": n, "from": rows[0]["seed"] if rows else None, "k": k, "counts": fp,
            "rates": {key: fp[key] / n for key in fp}}


def ladder(cal, seed_a=11, seed_b=12, shares=(0, 0.1, 0.3, 0.5, 0.7), wash_style="round", k=2.0):
    A = make_tape(seed=seed_a)
    rA = readings(sizes_of(A))
    vA = verdict(rA, cal, k)
    rows = []
    for share in shares:
        B = make_tape(seed=seed_b, wash_share=share, wash_style=wash_style)
        rB = readings(sizes_of(B))
        vB = verdict(rB, cal, k)
        rows.append({"share": share, "actualShare": B["washVol"] / B["reportedVol"] if B["reportedVol"] else 0,
                     "trades": len(B["trades"]), "pairs": B["pairs"],
                     "honestVol": B["honestVol"], "washVol": B["washVol"], "reportedVol": B["reportedVol"],
                     "readings": {"mad": rB["mad"], "chi2": rB["chi2"], "round": rB["round"], "cluster": rB["cluster"], "distinct": rB["distinct"]},
                     "z": vB["z"], "fired": vB["fired"], "count": vB["count"], "flagged": vB["flagged"],
                     "rankByReported": 1 if B["reportedVol"] > A["reportedVol"] else 2,
                     "weightByReported": B["reportedVol"] / (A["reportedVol"] + B["reportedVol"]),
                     "weightHonest": B["honestVol"] / (A["honestVol"] + B["honestVol"])})
    return {"k": k, "washStyle": wash_style, "seedA": seed_a, "seedB": seed_b,
            "venueA": {"trades": len(A["trades"]), "reportedVol": A["reportedVol"],
                       "readings": {"mad": rA["mad"], "chi2": rA["chi2"], "round": rA["round"], "cluster": rA["cluster"]},
                       "z": vA["z"], "fired": vA["fired"], "count": vA["count"], "flagged": vA["flagged"]},
            "rows": rows}


def shuffle_sizes(tape_a, tape_b, seed=99):
    pool = sizes_of(tape_a) + sizes_of(tape_b)
    rnd = mulberry(seed)
    for i in range(len(pool) - 1, 0, -1):
        j = math.floor(rnd() * (i + 1))
        pool[i], pool[j] = pool[j], pool[i]
    n_a = len(tape_a["trades"])
    return {"sizesA": pool[:n_a], "sizesB": pool[n_a:], "total": sum(pool)}


def fmt_units(micro):
    s = ("%.6f" % (micro / MICRO)).rstrip("0").rstrip(".")
    return s


# ---------- the canon run, same keys as canon.js ----------
def r4(x):
    return round(x * 1e6) / 1e6 if isinstance(x, float) else x


def rd(r):
    return {"n": r["n"], "mad": r4(r["mad"]), "chi2": r4(r["chi2"]), "round": r4(r["round"]), "cluster": r4(r["cluster"]), "distinct": r["distinct"]}


def lad_row(x):
    return {"share": x["share"], "actualShare": r4(x["actualShare"]), "trades": x["trades"], "pairs": x["pairs"],
            "honestVol": x["honestVol"], "washVol": x["washVol"], "reportedVol": x["reportedVol"],
            "mad": r4(x["readings"]["mad"]), "chi2": r4(x["readings"]["chi2"]), "round": r4(x["readings"]["round"]),
            "cluster": r4(x["readings"]["cluster"]), "distinct": x["readings"]["distinct"],
            "z": {k: r4(v) for k, v in x["z"].items()}, "fired": x["fired"], "count": x["count"], "flagged": x["flagged"],
            "rankByReported": x["rankByReported"], "weightByReported": r4(x["weightByReported"]), "weightHonest": r4(x["weightHonest"])}


def lad(cal, **kw):
    L = ladder(cal, **kw)
    a = L["venueA"]
    return {"k": L["k"], "washStyle": L["washStyle"], "seedA": L["seedA"], "seedB": L["seedB"],
            "venueA": {"trades": a["trades"], "reportedVol": a["reportedVol"], "mad": r4(a["readings"]["mad"]), "round": r4(a["readings"]["round"]),
                       "cluster": r4(a["readings"]["cluster"]), "z": {k: r4(v) for k, v in a["z"].items()}, "fired": a["fired"], "count": a["count"], "flagged": a["flagged"]},
            "rows": [lad_row(x) for x in L["rows"]]}


def main():
    out = {}
    out["selfTest"] = None  # the JS self test has no Python twin; the node run owns it
    h = readings(sizes_of(make_tape(seed=11)))
    out["honest11"] = dict(rd(h), counts=h["benford"]["counts"], obs=[r4(x) for x in h["benford"]["obs"]],
                           expected=[r4(x) for x in h["benford"]["expected"]], top=[{"size": fmt_units(t["size"]), "count": t["count"]} for t in h["top"]])
    cal = calibrate()
    out["cal"] = {"seeds": cal["seeds"], "from": cal["from"], "perDay": cal["perDay"],
                  "mean": {k: r4(v) for k, v in cal["mean"].items()}, "sd": {k: r4(v) for k, v in cal["sd"].items()}}
    rows = honest_rows()
    out["fp"] = {}
    for k in (2, 2.5, 3, 4):
        f = false_positives(cal, k, rows)
        out["fp"]["k" + (str(int(k)) if float(k).is_integer() else str(k))] = {
            "counts": f["counts"], "rates": {key: r4(v) for key, v in f["rates"].items()},
            "thresholds": {"mad": r4(cal["mean"]["mad"] + k * cal["sd"]["mad"]),
                           "roundLo": r4(cal["mean"]["round"] - k * cal["sd"]["round"]), "roundHi": r4(cal["mean"]["round"] + k * cal["sd"]["round"]),
                           "clusterLo": r4(cal["mean"]["cluster"] - k * cal["sd"]["cluster"]), "clusterHi": r4(cal["mean"]["cluster"] + k * cal["sd"]["cluster"])}}
    out["ladder"] = lad(cal)
    out["ladderK"] = {}
    for k in (2.5, 3, 4):
        out["ladderK"]["k" + (str(int(k)) if float(k).is_integer() else str(k))] = [{"share": x["share"], "count": x["count"], "flagged": x["flagged"]} for x in lad(cal, k=k)["rows"]]
    out["ladderFlat"] = lad(cal, wash_style="flat")
    out["ladderCopy"] = lad(cal, wash_style="copy")
    out["ladderSeeds"] = {}
    for a, b in ((101, 102), (2024, 2025), (7, 8), (55555, 55556)):
        out["ladderSeeds"]["%d-%d" % (a, b)] = [{"share": x["share"], "mad": x["mad"], "round": x["round"], "cluster": x["cluster"], "count": x["count"],
                                                "flagged": x["flagged"], "rankByReported": x["rankByReported"], "weightByReported": x["weightByReported"]}
                                               for x in lad(cal, seed_a=a, seed_b=b)["rows"]]
    out["floor"] = {}
    for style in ("round", "flat"):
        for k in (2, 2.5, 3):
            L = ladder(cal, shares=[i / 100 for i in range(0, 11)], wash_style=style, k=k)
            out["floor"][style + "-k" + (str(int(k)) if float(k).is_integer() else str(k))] = [{"share": x["share"], "count": x["count"], "flagged": x["flagged"], "mad": r4(x["readings"]["mad"]), "round": r4(x["readings"]["round"]), "cluster": r4(x["readings"]["cluster"])} for x in L["rows"]]
    out["break"] = []
    A = make_tape(seed=11)
    for share in (0, 0.1, 0.3, 0.5, 0.7):
        B = make_tape(seed=12, wash_share=share)
        before = {"A": rd(readings(sizes_of(A))), "B": rd(readings(sizes_of(B)))}
        sh = shuffle_sizes(A, B, 99)
        after = {"A": rd(readings(sh["sizesA"])), "B": rd(readings(sh["sizesB"]))}
        vA, vB, vb0 = verdict(after["A"], cal, 2), verdict(after["B"], cal, 2), verdict(before["B"], cal, 2)
        out["break"].append({"share": share, "before": before, "after": after, "total": sh["total"],
                             "gapBefore": {k: r4(before["B"][k] - before["A"][k]) for k in ("mad", "round", "cluster")},
                             "gapAfter": {k: r4(after["B"][k] - after["A"][k]) for k in ("mad", "round", "cluster")},
                             "flaggedBefore": {"B": vb0["flagged"], "countB": vb0["count"]},
                             "flaggedAfter": {"A": vA["flagged"], "countA": vA["count"], "B": vB["flagged"], "countB": vB["count"]}})
    T = make_tape(seed=11)
    out["candles"] = {}
    for bar in (60, 300, 900, 3600):
        c = build_candles(T, bar)
        up = sum(1 for b in c if b["c"] > b["o"]); down = sum(1 for b in c if b["c"] < b["o"]); flat = len(c) - up - down
        maxv = c[0]; maxr = c[0]
        for b in c:
            if b["v"] > maxv["v"]:
                maxv = b
            if b["h"] - b["l"] > maxr["h"] - maxr["l"]:
                maxr = b
        pick = lambda b: {"t": b["t"], "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"], "n": b["n"], "v": b["v"]}
        out["candles"]["bar%d" % bar] = {"bars": len(c), "possible": DAY // bar, "first": pick(c[0]), "last": pick(c[-1]), "up": up, "down": down, "flat": flat,
                                          "maxVolBar": {"t": maxv["t"], "v": maxv["v"], "n": maxv["n"]}, "maxRangeBar": {"t": maxr["t"], "range": maxr["h"] - maxr["l"]}}
    out["tape11"] = {"trades": len(T["trades"]), "reportedVol": T["reportedVol"],
                     "first5": [{"t": t["t"], "side": t["side"], "size": t["size"], "px": t["px"]} for t in T["trades"][:5]],
                     "lastPx": T["trades"][-1]["px"], "minPx": min(t["px"] for t in T["trades"]), "maxPx": max(t["px"] for t in T["trades"])}
    b = book_snapshot(T, 43200, 8)
    out["book"] = {"at": b["at"], "lastPx": b["lastPx"], "spread": b["spread"], "bids": [{"px": x["px"], "size": x["size"]} for x in b["bids"]], "asks": [{"px": x["px"], "size": x["size"]} for x in b["asks"]]}
    T5 = make_tape(seed=11, days=5)
    out["closes"] = {}
    for off in (0, 8 * 3600, 16 * 3600, 21 * 3600):
        c = closes_at(T5, off)
        out["closes"]["off%d" % off] = {"closes": c["closes"], "returns": [{"day": x["day"], "ret": r4(x["ret"])} for x in c["returns"]]}
    out["tape11d5"] = {"trades": len(T5["trades"]), "lastPx": T5["trades"][-1]["px"]}
    M = make_market(seed=11)
    AT, W = 13 * 3600, 300
    quotes = [dict(venue_quote(v["tape"], AT, W), name=v["name"]) for v in M["venues"]]
    out["market"] = {"at": AT, "window": W, "pathAt": M["path"][AT // 60], "quotes": [{"name": q["name"], "px": q["px"], "age": q["age"], "vol": q["vol"], "n": q["n"]} for q in quotes], "index": {}}
    for m in ("mean", "vwap", "median", "vwmedian"):
        plain = index_price(quotes, m)
        excl = index_price(quotes, m, max_age=600, tol=0.002)
        out["market"]["index"][m] = {"plain": r4(float(plain["level"])), "excluded": r4(float(excl["level"])), "dropped": [d[0]["name"] + ":" + d[1] for d in excl["dropped"]]}
    M2 = make_market(seed=11, venues=[{"name": "Venue A", "perDay": 3000, "offset": 0}, {"name": "Venue B", "perDay": 1500, "offset": 40, "washShare": 0.6},
                                      {"name": "Venue C", "perDay": 600, "offset": -30}, {"name": "Venue D", "perDay": 250, "offset": 0, "stale": 600}])
    q2 = [dict(venue_quote(v["tape"], AT, W), name=v["name"]) for v in M2["venues"]]
    tot_rep = sum(v["tape"]["reportedVol"] for v in M2["venues"]); tot_hon = sum(v["tape"]["honestVol"] for v in M2["venues"])
    out["marketWashed"] = {"quotes": [{"name": q["name"], "px": q["px"], "age": q["age"], "vol": q["vol"], "n": q["n"]} for q in q2],
                           "vwap": r4(float(index_price(q2, "vwap")["level"])), "vwmedian": r4(float(index_price(q2, "vwmedian")["level"])),
                           "median": r4(float(index_price(q2, "median")["level"])), "mean": r4(float(index_price(q2, "mean")["level"])),
                           "weightB": r4(q2[1]["vol"] / sum(q["vol"] for q in q2)), "dayVolShareB": r4(M2["venues"][1]["tape"]["reportedVol"] / tot_rep),
                           "dayHonestShareB": r4(M2["venues"][1]["tape"]["honestVol"] / tot_hon)}
    out["depeg"] = {}
    for depth in (0, 0.03, 0.06, 0.12):
        U = unit_path(seed=11, depth=depth)
        R = restate(T, U)
        e = hourly_extremes(R)
        noon = next((x for x in R if x["t"] >= 43200), None)
        out["depeg"]["d" + str(depth)] = {"minUnit": min(U), "maxUnit": max(U), "quoted": r4(e["quoted"]), "quotedHour": e["quotedHour"], "restated": r4(e["restated"]),
                                           "restatedHour": e["restatedHour"], "hours": e["hours"], "refAtNoon": noon["pxRef"] if noon else None}
    json.dump(out, sys.stdout, indent=1, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
