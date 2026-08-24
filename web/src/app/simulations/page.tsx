import type { Metadata } from "next";
import ElectionDashboard from "../components/ElectionDashboard";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Run a New Simulation",
  description: "Configure and run a new county-level Monte Carlo election simulation.",
};

export default function SimulationsPage() {
  return (
    <main className="dashboard-page simulations-page">
      <SiteHeader />
      <section className="dashboard-intro simulations-intro">
        <div><span className="section-index">Simulation lab / New run</span><h1>Generate a new possible ending.</h1></div>
        <p>Choose a model and N, then run a fresh Monte Carlo simulation. These new executions are separate from the fixed result reported in Our Results.</p>
      </section>
      <ElectionDashboard initialYear="predict" predictionOnly defaultModel="xgboost" defaultNSim={200} />
      <section className="prediction-notes" aria-label="New simulation guidance">
        <article><span>01</span><h2>Choose N</h2><p>More runs make the distribution more stable but take longer to calculate.</p></article>
        <article><span>02</span><h2>Choose a model</h2><p>XGBoost, Random Forest and Ridge encode different relationships between counties and electoral shifts.</p></article>
        <article><span>03</span><h2>Keep the distinction</h2><p>This page creates new stochastic runs. The published fixed-seed output lives under Our Results.</p></article>
      </section>
    </main>
  );
}
