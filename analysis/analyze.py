"""Pre-registered analysis for "Beyond the Banner".

Usage:  python analysis/analyze.py trials_long.csv participants.csv
Inputs are the two CSVs exported from /results.
Requires: pandas, numpy, scipy, statsmodels
"""
import sys
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
import statsmodels.formula.api as smf


def gee_logit(df, formula):
    m = smf.gee(formula, groups="pid", data=df, family=sm.families.Binomial(),
                cov_struct=sm.cov_struct.Exchangeable()).fit()
    return m


def report_or(m, terms):
    ci = m.conf_int()
    for t in terms:
        if t in m.params:
            print(f"   {t:<28} OR={np.exp(m.params[t]):6.2f}  95% CI [{np.exp(ci.loc[t,0]):.2f}, {np.exp(ci.loc[t,1]):.2f}]  p={m.pvalues[t]:.4f}")


def sdt(h, nt, f, nn):
    H = (h + .5) / (nt + 1); F = (f + .5) / (nn + 1)
    return stats.norm.ppf(H) - stats.norm.ppf(F), -.5 * (stats.norm.ppf(H) + stats.norm.ppf(F))


def main(trials_path, parts_path):
    t = pd.read_csv(trials_path)
    p = pd.read_csv(parts_path)
    full = t.groupby("pid").filter(lambda g: len(g) == 4).copy()
    print(f"Participants with all 4 trials: {full.pid.nunique()}  (trials: {len(full)})")
    print(f"Tracked pages where every tracker was blocked: {((full.tracked_assigned==1)&(full.tracked_actual==0)).sum()}")

    # Centre the knowledge score for moderation analyses.
    p["knowledge_c"] = p.knowledge_score - p.knowledge_score.mean()
    full = full.merge(p[["pid", "knowledge_c", "iuipc_mean"]], on="pid", how="left")
    full["computing"] = (full.field == "computing").astype(int)

    print("\n== Descriptives: % saying 'recorded data' ==")
    print((full.groupby(["banner", "tracked_actual"]).believed_tracked.mean() * 100).round(1).unstack())

    print("\n== H1 & H2: GEE logistic, believed ~ banner * tracked (clustered by participant) ==")
    m = gee_logit(full, "believed_tracked ~ banner * tracked_actual + C(position)")
    report_or(m, ["banner", "tracked_actual", "banner:tracked_actual"])

    print("\n== H3: does knowledge improve discrimination? (tracked x knowledge) ==")
    if full.knowledge_c.std() > 0:
        m3 = gee_logit(full, "believed_tracked ~ banner * knowledge_c + tracked_actual * knowledge_c + C(position)")
        report_or(m3, ["tracked_actual:knowledge_c", "banner:knowledge_c"])
    else:
        print("   knowledge score has no variance; skipped")

    print("\n== Signal detection per participant (log-linear corrected) ==")
    rows = []
    for pid, g in full.groupby("pid"):
        T, N = g[g.tracked_actual == 1], g[g.tracked_actual == 0]
        if len(T) and len(N):
            d, c = sdt(T.believed_tracked.sum(), len(T), N.believed_tracked.sum(), len(N))
            rows.append((pid, d, c))
    s = pd.DataFrame(rows, columns=["pid", "dprime", "c"])
    w = stats.wilcoxon(s.dprime) if (s.dprime != 0).any() else None
    print(f"   mean d' = {s.dprime.mean():.3f} (SD {s.dprime.std():.3f}); Wilcoxon vs 0: "
          + (f"W={w.statistic:.1f}, p={w.pvalue:.4f}" if w else "all zero"))
    # Equivalence (TOST) on d': is sensitivity practically zero? Bounds +/-0.5 (pre-registered).
    lo, hi = -0.5, 0.5
    t1 = stats.ttest_1samp(s.dprime, lo, alternative="greater"); t2 = stats.ttest_1samp(s.dprime, hi, alternative="less")
    print(f"   TOST d' within [{lo},{hi}]: p_lower={t1.pvalue:.4f}, p_upper={t2.pvalue:.4f} -> equivalent if both < .05")

    print("\n== H4: within banner pages, does clicking Reject lower belief? ==")
    b = full[(full.banner == 1) & full.banner_action.isin(["accept", "reject"])].copy()
    if b.pid.nunique() > 5 and b.banner_action.nunique() == 2:
        b["rejected"] = (b.banner_action == "reject").astype(int)
        m4 = gee_logit(b, "believed_tracked ~ rejected + tracked_actual")
        report_or(m4, ["rejected"])
    else:
        print("   not enough accept/reject variation")

    print("\n== Checklist accuracy (5 real items vs 5 impossible items) ==")
    tr = full[full.tracked_actual == 1]
    print(f"   tracked pages: hit rate on real items = {(tr.checklist_hits / tr.checklist_true_items).mean():.2f}")
    print("   impossible-item ticks per page, by banner:")
    print(full.groupby("banner").checklist_impossible_ticks.mean().round(2).to_string())
    wb = full.groupby(["pid", "banner"]).checklist_impossible_ticks.mean().unstack()
    if wb.shape[1] == 2:
        r = stats.wilcoxon(wb[1], wb[0])
        print(f"   Wilcoxon banner vs no banner: W={r.statistic:.1f}, p={r.pvalue:.4f}")

    print("\n== HCI constructs and cognitive load (within person, Wilcoxon signed-rank, Holm-corrected) ==")
    outcomes = [("effort_paas", "Mental effort (Paas 1-9)"), ("trust", "Trust (1-7)"),
                ("transparency", "Transparency / visibility (1-7)"), ("control", "Perceived control (1-7)")]
    for factor in ("banner", "tracked_actual"):
        print(f"   factor: {factor}")
        res = []
        for col, label in outcomes:
            if col not in full or full[col].isna().all():
                continue
            m = full.groupby(["pid", factor])[col].mean().unstack().dropna()
            if m.shape[1] < 2 or len(m) < 6:
                continue
            diff = m[1] - m[0]
            nz = diff[diff != 0]
            if not len(nz):
                res.append((label, m[1].mean(), m[0].mean(), np.nan, 1.0, 0.0)); continue
            w = stats.wilcoxon(m[1], m[0])
            ranks = stats.rankdata(nz.abs())
            r_rb = (ranks[nz > 0].sum() - ranks[nz < 0].sum()) / ranks.sum()  # matched-pairs rank-biserial
            res.append((label, m[1].mean(), m[0].mean(), w.statistic, w.pvalue, r_rb))
        # Holm correction across the outcomes for this factor
        order = np.argsort([r[4] for r in res]); k = len(res); adj = [0] * k; running = 0
        for rank, i in enumerate(order):
            running = max(running, min(1, (k - rank) * res[i][4])); adj[i] = running
        for (label, a, b, W, pv, rr), pa in zip(res, adj):
            print(f"     {label:<34} level1={a:.2f} level0={b:.2f}  W={W}  p={pv:.4f}  p_holm={pa:.4f}  r_rb={rr:.2f}")

    print("\n== Illusion of control: tracked pages WITH banner (B1T1) vs WITHOUT (B0T1) ==")
    tt = full[full.tracked_assigned == 1]
    m = tt.groupby(["pid", "banner"]).control.mean().unstack().dropna()
    if m.shape[1] == 2 and len(m) >= 6 and (m[1] != m[0]).any():
        w = stats.wilcoxon(m[1], m[0])
        print(f"   perceived control: banner {m[1].mean():.2f} vs no banner {m[0].mean():.2f}; W={w.statistic:.1f}, p={w.pvalue:.4f}")
        rej = full[(full.condition == "B1T1") & (full.banner_action == "reject")]
        print(f"   on B1T1 pages where people clicked Reject (tracking continued): mean control = {rej.control.mean():.2f} (n={len(rej)})")

    print("\n== Does mental effort relate to relying on the banner? (exploratory) ==")
    pp = full.groupby("pid").apply(lambda g: pd.Series({
        "effort": g.effort_paas.mean(),
        "banner_reliance": g[g.banner == 1].believed_tracked.mean() - g[g.banner == 0].believed_tracked.mean()}))
    pp = pp.dropna()
    if len(pp) >= 6:
        rho = stats.spearmanr(pp.effort, pp.banner_reliance)
        print(f"   Spearman rho(mean effort, banner reliance) = {rho.statistic:.2f}, p={rho.pvalue:.4f}, n={len(pp)}")
    if "banner_decision_ms" in full:
        bd = full.banner_decision_ms.dropna()
        if len(bd):
            print(f"   time to click the banner: median {bd.median()/1000:.1f}s (IQR {bd.quantile(.25)/1000:.1f}-{bd.quantile(.75)/1000:.1f}s)")

    tlx_cols = [c for c in p.columns if c.startswith("tlx_")]
    if tlx_cols:
        print("\n== NASA-TLX (raw, 0-100) ==")
        print(p[tlx_cols].mean().round(1).to_string())
        print(f"   raw TLX overall: {p.tlx_raw.mean():.1f} (SD {p.tlx_raw.std():.1f})")

    print("\n== Robustness: first website only (between subjects, unprimed) ==")
    f1 = full[full.position == 1]
    tab = pd.crosstab(f1.banner, f1.believed_tracked)
    if tab.shape == (2, 2):
        o, pv = stats.fisher_exact(tab)
        print(tab.to_string()); print(f"   Fisher exact, banner -> belief: OR={o:.2f}, p={pv:.4f}")

    print("\n== Computing vs non-computing (exploratory) ==")
    print(full.groupby(["field", "banner"]).believed_tracked.mean().round(2).unstack())

    if "surprise" in p:
        print("\n== Reaction after reveal ==")
        print(p[["surprise", "concern"]].describe().round(2).loc[["count", "mean", "std"]])
        print(f"   deleted device data: {p.deleted_device_data.sum()} / {len(p)};  opened tips: {p.opened_tips.sum()} / {len(p)}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
