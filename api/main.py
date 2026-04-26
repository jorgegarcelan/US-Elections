"""
Election Prediction API
Replicates the Monte-Carlo simulation from simulation.ipynb
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE = Path(__file__).parent.parent  # project root

# ── State shared across requests ──────────────────────────────────────────────

state: dict = {}

# ── Data preparation (mirrors simulation.ipynb cells 9–27) ───────────────────

def prepare_data():
    data_2020 = pd.read_csv(BASE / "data/final_data_2020.csv").sort_values("county_fips").reset_index(drop=True)
    data_2024 = pd.read_csv(BASE / "data/final_data_2024.csv").sort_values("county_fips").reset_index(drop=True)
    seats = pd.read_csv(BASE / "data/seats.csv")

    # Baseline 2020 per-county values (used to convert delta → absolute %)
    votes_2020     = data_2020["total_votes"].values.astype(float)
    per_dem_2020   = data_2020["per_dem"].values.astype(float)
    per_gop_2020   = data_2020["per_gop"].values.astype(float)
    county_fips    = data_2024["county_fips"].astype(str).str.zfill(5).values
    county_names   = data_2024["county"].values
    state_names    = data_2024["state"].values

    # Build X_sim: mirrors exactly the notebook preprocessing
    DROP_VOTE  = ["votes_dem", "total_votes", "votes_others", "per_votes_others", "winner", "votes_gop"]
    DROP_ID    = ["county_fips", "county", "state_code", "county_code"]
    DROP_TGTS  = ["delta_per_dem", "delta_per_gop", "delta_per_oth", "per_dem", "per_gop"]

    data_sim = data_2024.drop(columns=[c for c in DROP_VOTE + DROP_ID if c in data_2024.columns])
    data_sim = pd.get_dummies(data_sim, columns=["state"], drop_first=False)
    X_sim = data_sim.drop(columns=[c for c in DROP_TGTS if c in data_sim.columns])

    return {
        "X_sim":         X_sim,
        "votes_2020":    votes_2020,
        "per_dem_2020":  per_dem_2020,
        "per_gop_2020":  per_gop_2020,
        "county_fips":   county_fips,
        "county_names":  county_names,
        "state_names":   state_names,
        "seats":         seats,
    }


def load_models():
    available = {}
    for algo in ("xgboost", "random_forest", "ridge"):
        for year in ("2016", "2020"):
            for target in ("dem", "gop"):
                key  = f"{algo}_delta_{target}_{year}"
                path = BASE / f"models/{key}.pkl"
                if path.exists():
                    available[key] = joblib.load(str(path))
    return available


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[api] Loading data and models...")
    state["data"]   = prepare_data()
    state["models"] = load_models()
    print(f"[api] Loaded {len(state['models'])} model files.")
    yield
    state.clear()


app = FastAPI(title="Election Prediction API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Simulation ────────────────────────────────────────────────────────────────

def run_simulation(
    n_sim:  int,
    algo:   str,
    models: dict,
    data:   dict,
) -> dict:
    d            = data
    X_sim        = d["X_sim"]
    votes_2020   = d["votes_2020"]
    per_dem_2020 = d["per_dem_2020"]
    per_gop_2020 = d["per_gop_2020"]
    state_names  = d["state_names"]
    county_names = d["county_names"]
    county_fips  = d["county_fips"]
    seats        = d["seats"]

    n_counties = len(X_sim)

    # Retrieve the four required models
    try:
        m_dem_2016 = models[f"{algo}_delta_dem_2016"]
        m_gop_2016 = models[f"{algo}_delta_gop_2016"]
        m_dem_2020 = models[f"{algo}_delta_dem_2020"]
        m_gop_2020 = models[f"{algo}_delta_gop_2020"]
    except KeyError as e:
        raise HTTPException(400, f"Model not found: {e}")

    # Pre-compute deterministic model predictions (same for all simulations)
    pred_dem_2016 = m_dem_2016.predict(X_sim).astype(float)
    pred_gop_2016 = m_gop_2016.predict(X_sim).astype(float)
    pred_dem_2020 = m_dem_2020.predict(X_sim).astype(float)
    pred_gop_2020 = m_gop_2020.predict(X_sim).astype(float)

    # Accumulators
    acc_per_dem  = np.zeros(n_counties)
    acc_per_gop  = np.zeros(n_counties)
    acc_delta_d  = np.zeros(n_counties)
    acc_delta_g  = np.zeros(n_counties)
    acc_votes_d  = np.zeros(n_counties)
    acc_votes_g  = np.zeros(n_counties)
    acc_votes_t  = np.zeros(n_counties)

    sim_results = []  # (dem_ev, gop_ev, winner) per run

    rng = np.random.default_rng()

    for _ in range(n_sim):
        # Random weights (mirror notebook)
        w16      = rng.uniform(0.3, 1.0)
        w20      = 1.0 - w16
        delta_d  = (w16 * pred_dem_2016 + w20 * pred_dem_2020) / (w16 + w20)
        delta_g  = (w16 * pred_gop_2016 + w20 * pred_gop_2020) / (w16 + w20)

        # Turnout noise
        wt         = rng.uniform(0.9, 1.1)
        total_v    = votes_2020 * wt

        per_d      = np.clip(delta_d / 100.0 + per_dem_2020, 0.0, 1.0)
        per_g      = np.clip(delta_g / 100.0 + per_gop_2020, 0.0, 1.0)

        votes_d    = per_d * total_v
        votes_g    = per_g * total_v

        acc_per_dem  += per_d
        acc_per_gop  += per_g
        acc_delta_d  += delta_d
        acc_delta_g  += delta_g
        acc_votes_d  += votes_d
        acc_votes_g  += votes_g
        acc_votes_t  += total_v

        # State-level aggregation → electoral college
        df = pd.DataFrame({
            "state":   state_names,
            "votes_d": votes_d,
            "votes_g": votes_g,
            "votes_t": total_v,
        })
        agg = df.groupby("state").agg(
            votes_d=("votes_d", "sum"),
            votes_g=("votes_g", "sum"),
            votes_t=("votes_t", "sum"),
        ).reset_index()
        agg["winner"] = np.where(agg["votes_d"] > agg["votes_g"], "dem", "gop")

        merged = seats.merge(agg[["state", "winner"]], on="state", how="inner")
        ev = merged.groupby("winner")["ElectoralVotes2024"].sum().to_dict()
        ev_d = int(ev.get("dem", 0))
        ev_g = int(ev.get("gop", 0))
        # Alaska (+3) hardcoded in notebook — already in seats.csv so skip duplicate

        w = "dem" if ev_d > ev_g else ("gop" if ev_g > ev_d else "tie")
        sim_results.append((ev_d, ev_g, w))

    # Average over simulations
    avg_per_dem = acc_per_dem / n_sim
    avg_per_gop = acc_per_gop / n_sim
    avg_delta_d = acc_delta_d / n_sim
    avg_delta_g = acc_delta_g / n_sim
    avg_votes_d = acc_votes_d / n_sim
    avg_votes_g = acc_votes_g / n_sim
    avg_votes_t = acc_votes_t / n_sim

    # County-level results
    counties = []
    for i in range(n_counties):
        pd_  = float(avg_per_dem[i])
        pg_  = float(avg_per_gop[i])
        winner = "dem" if pd_ > pg_ else "gop"
        counties.append({
            "fips":     county_fips[i],
            "county":   county_names[i],
            "state":    state_names[i],
            "per_dem":  round(pd_, 4),
            "per_gop":  round(pg_, 4),
            "winner":   winner,
            "delta_dem": round(float(avg_delta_d[i]), 3),
            "delta_gop": round(float(avg_delta_g[i]), 3),
        })

    # State-level results — use accumulated vote totals (not per-county pct means)
    df_c = pd.DataFrame({
        "state":   state_names,
        "votes_d": avg_votes_d,
        "votes_g": avg_votes_g,
        "votes_t": avg_votes_t,
    })
    agg_s = df_c.groupby("state").agg(
        votes_d=("votes_d", "sum"),
        votes_g=("votes_g", "sum"),
        votes_t=("votes_t", "sum"),
    ).reset_index()
    agg_s["per_d"]   = agg_s["votes_d"] / agg_s["votes_t"]
    agg_s["per_g"]   = agg_s["votes_g"] / agg_s["votes_t"]
    agg_s["winner"]  = np.where(agg_s["per_d"] > agg_s["per_g"], "dem", "gop")
    agg_s["diff"]    = (agg_s["per_d"] - agg_s["per_g"]) * 100

    def classify(diff):
        if diff > 10:   return "Safe Democrat"
        if diff > 2.5:  return "Likely Democrat"
        if diff > -2.5: return "Toss-Up"
        if diff > -10:  return "Likely Republican"
        return "Safe Republican"

    agg_s["status"] = agg_s["diff"].apply(classify)

    merged_s = seats.merge(agg_s, on="state", how="inner")
    merged_s["state_code"] = merged_s["state_code"].str.upper()

    state_results = [
        {
            "state":           row["state"],
            "state_code":      row["state_code"],
            "per_dem":         round(float(row["per_d"]), 4),
            "per_gop":         round(float(row["per_g"]), 4),
            "winner":          row["winner"],
            "electoral_votes": int(row["ElectoralVotes2024"]),
            "status":          row["status"],
        }
        for _, row in merged_s.iterrows()
    ]

    # Electoral college totals from averaged state calls
    ev_by_winner = merged_s.groupby("winner")["ElectoralVotes2024"].sum().to_dict()
    total_ev_d = int(ev_by_winner.get("dem", 0))
    total_ev_g = int(ev_by_winner.get("gop", 0))
    ec_winner  = "dem" if total_ev_d > total_ev_g else "gop"

    # Simulation distribution
    evs_d  = [r[0] for r in sim_results]
    evs_g  = [r[1] for r in sim_results]
    wins   = [r[2] for r in sim_results]
    dem_p  = wins.count("dem") / n_sim
    gop_p  = wins.count("gop") / n_sim

    return {
        "counties":   counties,
        "states":     state_results,
        "electoral":  {
            "dem":    total_ev_d,
            "gop":    total_ev_g,
            "winner": ec_winner,
        },
        "simulation": {
            "n_sim":        n_sim,
            "model":        algo,
            "dem_win_prob": round(dem_p, 3),
            "gop_win_prob": round(gop_p, 3),
            "dem_ev_mean":  round(float(np.mean(evs_d)), 1),
            "gop_ev_mean":  round(float(np.mean(evs_g)), 1),
            "dem_ev_std":   round(float(np.std(evs_d)),  1),
            "gop_ev_std":   round(float(np.std(evs_g)),  1),
        },
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": list(state.get("models", {}).keys()),
    }


@app.get("/predict")
def predict(
    n_sim: int = Query(default=200, ge=10, le=1000),
    model: Literal["xgboost", "random_forest", "ridge"] = Query(default="xgboost"),
):
    if not state.get("data") or not state.get("models"):
        raise HTTPException(503, "Server not ready")
    return run_simulation(n_sim, model, state["models"], state["data"])
