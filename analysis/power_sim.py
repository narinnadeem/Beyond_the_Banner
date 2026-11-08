"""Simulation-based power for the 2x2 within-subjects design.

Each simulated participant judges 4 websites (banner x tracked). Belief is generated from a
logistic model with a random participant intercept. We count how often the GEE analysis
detects the banner effect (H1) at alpha = .05.

Usage: python analysis/power_sim.py
"""
import warnings
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

warnings.filterwarnings("ignore")
rng = np.random.default_rng(2026)


def simulate(n, base_p, banner_or, track_or, sd_person=1.0):
    rows = []
    b0 = np.log(base_p / (1 - base_p))
    for i in range(n):
        u = rng.normal(0, sd_person)
        for banner in (0, 1):
            for tracked in (0, 1):
                eta = b0 + np.log(banner_or) * banner + np.log(track_or) * tracked + u
                rows.append((i, banner, tracked, rng.random() < 1 / (1 + np.exp(-eta))))
    return pd.DataFrame(rows, columns=["pid", "banner", "tracked", "y"]).astype(int)


def power(n, banner_or, base_p=0.35, track_or=1.0, sims=400):
    hits = 0
    for _ in range(sims):
        d = simulate(n, base_p, banner_or, track_or)
        try:
            m = smf.gee("y ~ banner + tracked", groups="pid", data=d, family=sm.families.Binomial(),
                        cov_struct=sm.cov_struct.Exchangeable()).fit()
            hits += m.pvalues["banner"] < 0.05
        except Exception:
            pass
    return hits / sims


if __name__ == "__main__":
    print("Power to detect the banner effect (H1), alpha=.05, 4 trials/person, person SD=1.0 (logit)")
    print("baseline P(yes | no banner) = 0.35")
    print(f"{'banner OR':>10} {'P(yes|banner)':>14} " + " ".join(f"n={n:>3}" for n in (16, 20, 24)))
    for OR in (2.0, 3.0, 4.0, 6.0):
        b0 = np.log(.35 / .65); pb = 1 / (1 + np.exp(-(b0 + np.log(OR))))
        print(f"{OR:>10.1f} {pb:>14.2f} " + " ".join(f"{power(n, OR):>5.2f}" for n in (16, 20, 24)))
