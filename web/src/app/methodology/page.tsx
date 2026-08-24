import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How the county-level U.S. election datasets, models and simulations were created.",
};

const steps = [
  ["01", "Collect", "County election results are paired with five-year American Community Survey estimates for the corresponding cycle."],
  ["02", "Clean", "FIPS codes, renamed Connecticut planning regions, missing values and year-specific variables are normalised into comparable tables."],
  ["03", "Describe", "Maps and exploratory analysis connect vote outcomes with income, education, race, age, density and employment."],
  ["04", "Model", "Linear, Ridge, KNN, Random Forest and XGBoost approaches estimate Democratic and Republican vote-share change."],
  ["05", "Simulate", "County estimates are aggregated to states, assigned electoral votes and repeated under varying historical weights and turnout."],
];

export default function MethodologyPage() {
  return (
    <main className="editorial-page project-page">
      <SiteHeader />
      <header className="page-hero">
        <p className="section-index">Methodology / From source to simulation</p>
        <h1>Behind every result,<br /><em>a chain of decisions.</em></h1>
        <p>The project is designed as a reproducible pipeline: raw public data becomes a county-level analytical dataset, then a model, then an explicitly uncertain simulation.</p>
      </header>

      <section className="method-steps">
        {steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></article>)}
      </section>

      <section className="method-detail dark-section">
        <div><p className="section-index">Model design</p><h2>Predict the shift,<br />not the winner.</h2></div>
        <div className="prose-column">
          <p>The central targets are changes in Democratic and Republican vote share. Modelling the shift lets the pipeline anchor predictions in a known electoral baseline rather than asking an algorithm to recreate the entire vote from scratch.</p>
          <div className="formula-card"><span>County prediction</span><strong>2020 vote share + estimated Δ</strong><small>clipped to a valid 0—100% range</small></div>
          <p>Models trained on the 2016 and 2020 cycles are blended with random historical weights. A turnout multiplier creates alternative county vote totals before results are aggregated to each state.</p>
        </div>
      </section>

      <section className="evaluation-section">
        <div className="section-heading"><p className="section-index">Evaluation</p><h2>Accuracy is reported.<br /><em>Limitations are too.</em></h2></div>
        <div className="evaluation-grid">
          <article className="metric-card"><span>Ridge evaluation</span><strong>2.64</strong><p>test RMSE in percentage points for one recorded target evaluation</p></article>
          <article><h3>Cross-validation</h3><p>Models are compared on held-out counties and cross-validation error, rather than selected from training performance alone.</p></article>
          <article><h3>Geographic dependence</h3><p>Neighbouring counties are not truly independent. Results should be interpreted as exploratory evidence, not causal effects.</p></article>
          <article><h3>Temporal change</h3><p>Relationships learned from earlier cycles can break. The model does not ingest live polling, candidates or campaign events.</p></article>
        </div>
      </section>

      <section className="authors-section">
        <p className="section-index">The team</p><h2>Lucía Cordero<br />&amp; Jorge Garcelán</h2><p>Data collection, analysis, modelling and visualisation developed as a collaborative data-science project.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
