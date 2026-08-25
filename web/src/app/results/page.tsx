import type { Metadata } from "next";
import OurResultsExperience from "../components/OurResultsExperience";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Our Simulation Results",
  description: "Our final simulated election map, Electoral College distribution and model explainability.",
};

export default function ResultsPage() {
  return (
    <main className="dashboard-page our-results-page">
      <SiteHeader />
      <section className="dashboard-intro results-intro">
        <div><span className="section-index">Our results / Model output</span><h1>What our simulation predicts.</h1></div>
        <p>Our final map is the averaged output of 1,000 reproducible runs—not an official result or a polling forecast. Explore the distribution, state uncertainty and variables behind it.</p>
      </section>
      <OurResultsExperience />
    </main>
  );
}
