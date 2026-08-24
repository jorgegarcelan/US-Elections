"use client";

import { useMemo, useState } from "react";
import ElectionDashboard, { type PredResult } from "./ElectionDashboard";
import ModelExplainability from "./ModelExplainability";

export default function OurResultsExperience() {
  const [result, setResult] = useState<PredResult | null>(null);
  const maxOutcome = Math.max(...(result?.simulation.ev_distribution.map((outcome) => outcome.count) ?? [1]));
  const outcomeCount = result?.simulation.ev_distribution.length ?? 1;
  const thresholdPosition = ((result?.simulation.ev_distribution.filter((outcome) => outcome.gop_ev < 270).length ?? 0) / outcomeCount) * 100;
  const uncertainStates = useMemo(() => result?.states
    .filter((state) => !state.assumption && state.gop_win_prob !== undefined)
    .sort((a, b) => Math.abs((a.gop_win_prob ?? 0) - 0.5) - Math.abs((b.gop_win_prob ?? 0) - 0.5))
    .slice(0, 10) ?? [], [result]);

  return (
    <>
      <section className="our-results-map-heading">
        <span className="section-index">Final simulated map / Reproducible run</span>
        <p>This is our model result: 1,000 XGBoost Monte Carlo runs with a fixed seed, averaged county by county and then aggregated through the Electoral College.</p>
      </section>
      <ElectionDashboard
        initialYear="predict"
        predictionOnly
        defaultModel="xgboost"
        defaultNSim={1000}
        autoRun
        predictionSeed={20240824}
        onPredictionComplete={setResult}
        lockPredictionConfig
      />

      <section className="simulation-distribution">
        <div className="distribution-heading">
          <div><p className="section-index">Outcome distribution</p><h2>Not one prediction.<br />A range of endings.</h2></div>
          <p>Each column is an Electoral College outcome across the reproducible 1,000-run simulation. The 270 line separates winning and losing Republican totals.</p>
        </div>
        {!result ? (
          <div className="distribution-loading">[ Running the reproducible 1,000-simulation result… ]</div>
        ) : (
          <>
            <dl className="distribution-kpis">
              <div><dt>{(result.simulation.gop_win_prob * 100).toFixed(1)}%</dt><dd>Republican win probability</dd></div>
              <div><dt>{(result.simulation.dem_win_prob * 100).toFixed(1)}%</dt><dd>Democratic win probability</dd></div>
              <div><dt>{result.simulation.gop_ev_p05}—{result.simulation.gop_ev_p95}</dt><dd>Republican 90% EV interval</dd></div>
              <div><dt>{result.simulation.dem_ev_p05}—{result.simulation.dem_ev_p95}</dt><dd>Democratic 90% EV interval</dd></div>
            </dl>
            <div className="ev-distribution-chart" aria-label="Distribution of Republican electoral votes">
              <div className="win-threshold" style={{ left: `${Math.max(0, Math.min(100, thresholdPosition))}%` }}><span>270 to win</span></div>
              {result.simulation.ev_distribution.map((outcome) => (
                <div className={outcome.gop_ev >= 270 ? "is-winning" : ""} key={outcome.gop_ev}>
                  <span>{(outcome.probability * 100).toFixed(1)}%</span>
                  <i style={{ height: `${Math.max(3, (outcome.count / maxOutcome) * 100)}%` }} />
                  <strong>{outcome.gop_ev}</strong>
                </div>
              ))}
            </div>
            <div className="state-uncertainty">
              <div><p className="section-index">Closest state calls</p><h3>Where the model is least certain.</h3></div>
              <div>
                {uncertainStates.map((state) => (
                  <article key={state.state_code}>
                    <span>{state.state_code}</span><strong>{state.state}</strong>
                    <div><i style={{ width: `${(state.gop_win_prob ?? 0) * 100}%` }} /></div>
                    <em><b>{((state.gop_win_prob ?? 0) * 100).toFixed(0)}% R</b> · {((1 - (state.gop_win_prob ?? 0)) * 100).toFixed(0)}% D</em>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="notebook-benchmark">
        <div><p className="section-index">Executed notebook reference</p><h2>The saved original run.</h2><p>The notebook output remains the historical benchmark. The fixed-seed run above makes the website result reproducible while preserving the same modelling pipeline.</p></div>
        <dl>
          <div><dt>1,000</dt><dd>completed notebook simulations</dd></div>
          <div className="benchmark-gop"><dt>592</dt><dd>Republican wins · 59.2%</dd></div>
          <div className="benchmark-dem"><dt>408</dt><dd>Democratic wins · 40.8%</dd></div>
          <div><dt>+3 R</dt><dd>Alaska prior from the notebook</dd></div>
        </dl>
      </section>
      <ModelExplainability />
    </>
  );
}
