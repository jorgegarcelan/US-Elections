import type { Metadata } from "next";
import AggregationFlow from "../components/AggregationFlow";
import MethodPipeline from "../components/MethodPipeline";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How the county-level U.S. election datasets, models and simulations were created.",
};

export default function MethodologyPage() {
  return (
    <main className="editorial-page project-page methodology-page">
      <SiteHeader />
      <header className="page-hero">
        <p className="section-index">Methodology / From source to simulation</p>
        <h1>Behind every result,<br /><em>a chain of decisions.</em></h1>
        <p>The project is designed as a reproducible pipeline: raw public data becomes a county-level analytical dataset, then a model, then an explicitly uncertain simulation.</p>
      </header>

      <MethodPipeline />

      <section className="method-detail dark-section">
        <div><p className="section-index">Model design</p><h2>Predict the shift,<br />not the winner.</h2></div>
        <div className="prose-column">
          <p>The central targets are changes in Democratic and Republican vote share. Modelling the shift lets the pipeline anchor predictions in a known electoral baseline rather than asking an algorithm to recreate the entire vote from scratch.</p>
          <div className="method-equation" aria-label="County prediction equals 2020 vote share plus estimated change, adjusted by turnout">
            <div className="method-equation-node"><span>Known baseline</span><strong>2020 vote share</strong><small>county result</small></div>
            <i className="method-equation-symbol" aria-hidden="true">+</i>
            <div className="method-equation-node is-delta"><span>Model output</span><strong>Estimated Δ</strong><small>vote-share change</small></div>
            <i className="method-equation-symbol" aria-hidden="true">=</i>
            <div className="method-equation-node is-result"><span>New estimate</span><strong>County prediction</strong><small>clipped to 0—100%</small></div>
            <div className="method-equation-turnout"><i aria-hidden="true" /><span>Turnout multiplier · 0.9—1.1</span></div>
          </div>
          <p>Models trained on the 2016 and 2020 cycles are blended with random historical weights. A turnout multiplier creates alternative county vote totals before results are aggregated to each state.</p>
        </div>
      </section>

      <AggregationFlow />

      <section className="evaluation-section">
        <div className="section-heading"><p className="section-index">Evaluation</p><h2>Accuracy is reported.<br /><em>Limitations are too.</em></h2></div>
        <div className="evaluation-grid">
          <article className="metric-card"><span>Ridge evaluation</span><strong>2.64</strong><p>test RMSE in percentage points for one recorded target evaluation</p></article>
          <article><h3>Cross-validation</h3><p>Models are compared on held-out counties and cross-validation error, rather than selected from training performance alone.</p></article>
          <article><h3>Geographic dependence</h3><p>Neighbouring counties are not truly independent. Results should be interpreted as exploratory evidence, not causal effects.</p></article>
          <article><h3>Temporal change</h3><p>Relationships learned from earlier cycles can break. The model does not ingest live polling, candidates or campaign events.</p></article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
