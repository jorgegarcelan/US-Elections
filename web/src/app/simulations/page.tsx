import type { Metadata } from "next";
import ElectionDashboard from "../components/ElectionDashboard";
import ModelExplainability from "../components/ModelExplainability";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "1,000 Election Simulations",
  description: "See the final county map and uncertainty from the executed Monte Carlo election model.",
};

export default function SimulationsPage() {
  return (
    <main className="dashboard-page simulations-page">
      <SiteHeader />
      <section className="dashboard-intro simulations-intro">
        <div><span className="section-index">Monte Carlo / Executed model</span><h1>One election, 1,000 possible endings.</h1></div>
        <p>The map opens with the XGBoost configuration used in <code>simulation.ipynb</code>. Change N or the model to generate a new final map and uncertainty range.</p>
      </section>
      <ElectionDashboard initialYear="predict" predictionOnly defaultModel="xgboost" defaultNSim={1000} autoRun />
      <section className="notebook-benchmark">
        <div><p className="section-index">Executed notebook benchmark</p><h2>The original 1,000 runs.</h2><p>These are the saved outputs already present in the notebook, kept as a reproducible reference beside the live simulator.</p></div>
        <dl>
          <div><dt>1,000</dt><dd>completed simulations</dd></div>
          <div className="benchmark-gop"><dt>592</dt><dd>Republican wins · 59.2%</dd></div>
          <div className="benchmark-dem"><dt>408</dt><dd>Democratic wins · 40.8%</dd></div>
          <div><dt>+3 R</dt><dd>Alaska prior from the notebook</dd></div>
        </dl>
      </section>
      <ModelExplainability />
    </main>
  );
}
