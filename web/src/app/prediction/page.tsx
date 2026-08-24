import type { Metadata } from "next";
import ElectionDashboard from "../components/ElectionDashboard";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Prediction Lab",
  description: "Run county-level machine-learning models and Monte Carlo election simulations.",
};

export default function PredictionPage() {
  return (
    <main className="dashboard-page prediction-page">
      <SiteHeader />
      <section className="dashboard-intro prediction-intro">
        <div><span className="section-index">Prediction lab / Experimental</span><h1>Model the uncertain.</h1></div>
        <p>Choose an algorithm and number of simulations. Results are estimates based on historical relationships—not forecasts or polling averages.</p>
      </section>
      <ElectionDashboard initialYear="predict" />
      <section className="prediction-notes" aria-label="Prediction caveats">
        <article><span>01</span><h2>What changes</h2><p>The models estimate county-level shifts from historical elections and current census characteristics.</p></article>
        <article><span>02</span><h2>What varies</h2><p>Each simulation varies historical weighting and turnout, producing a distribution of Electoral College outcomes.</p></article>
        <article><span>03</span><h2>What it cannot know</h2><p>Campaign events, polling errors and structural breaks are outside the model. Uncertainty is part of the result.</p></article>
      </section>
    </main>
  );
}
