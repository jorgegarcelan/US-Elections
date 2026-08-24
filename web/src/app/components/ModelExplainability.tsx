"use client";

import { useEffect, useState } from "react";

type ExplainModel = "xgboost" | "random_forest" | "ridge";

interface ExplainResult {
  model: ExplainModel;
  method: string;
  note: string;
  features: { feature: string; importance: number }[];
}

const LABELS: Record<string, string> = {
  per_dem: "Previous Democratic share",
  per_gop: "Previous Republican share",
  pop_total: "Population",
  median_age: "Median age",
  median_income: "Median household income",
  households_median_value: "Median home value",
  households_avg_size: "Average household size",
  households_total: "Households",
  households_median_gross_rent: "Median gross rent",
  mean_travel_time: "Commute time",
  white_rate: "White population share",
  black_rate: "Black population share",
  hispanic_rate: "Hispanic population share",
  bachelors_rate: "Bachelor’s degree share",
  high_school_rate: "High school share",
  poverty_rate: "Poverty rate",
  unemployment_rate: "Unemployment rate",
  immigrants_rate: "Immigrant population share",
  veterans_rate: "Veteran population share",
  households_owner_rate: "Home ownership rate",
  households_renter_rate: "Renter rate",
  public_transport_rate: "Public transport rate",
  no_health_insurance_rate: "Without health insurance",
  latitude: "Latitude",
  longitude: "Longitude",
};

const MODEL_LABELS: Record<ExplainModel, string> = { xgboost: "XGBoost", random_forest: "Random Forest", ridge: "Ridge" };

const humanize = (feature: string) => LABELS[feature] ?? feature.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

export default function ModelExplainability() {
  const [model, setModel] = useState<ExplainModel>("xgboost");
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/explain?model=${model}`)
      .then((response) => {
        if (!response.ok) throw new Error("Explainability unavailable");
        return response.json();
      })
      .then(setResult)
      .catch(() => setError(true));
  }, [model]);

  const maxImportance = Math.max(...(result?.features.map((feature) => feature.importance) ?? [1]));

  return (
    <section className="explainability-section">
      <div className="explainability-heading">
        <div><p className="section-index">Model explainability</p><h2>What the model pays attention to.</h2></div>
        <p>Feature importance shows how strongly each input contributes to the model’s decisions across counties. It describes the fitted model—not causality or an individual voter.</p>
      </div>
      <div className="explainability-panel">
        <div className="explainability-models" aria-label="Model to explain">
          {(Object.keys(MODEL_LABELS) as ExplainModel[]).map((option) => <button key={option} type="button" aria-pressed={model === option} onClick={() => { setModel(option); setResult(null); setError(false); }}>{MODEL_LABELS[option]}</button>)}
        </div>
        {error && <div className="explainability-empty">[ Start the prediction service to load model importance ]</div>}
        {!error && !result && <div className="explainability-empty">[ Calculating global importance… ]</div>}
        {result && (
          <div className="importance-chart">
            {result.features.slice(0, 12).map((feature, index) => (
              <div className="importance-row" key={feature.feature}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{humanize(feature.feature)}</strong>
                <div><i style={{ width: `${(feature.importance / maxImportance) * 100}%` }} /></div>
                <em>{(feature.importance * 100).toFixed(1)}%</em>
              </div>
            ))}
            <p>{result.method} · averaged across 2016/2020 and Democratic/Republican targets. {result.note}</p>
          </div>
        )}
      </div>
    </section>
  );
}
