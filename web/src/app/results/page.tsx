import type { Metadata } from "next";
import ResultsExplorer from "../components/ResultsExplorer";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Election Results",
  description: "Compare presidential election results by state and county for 2016, 2020 and 2024.",
};

export default function ResultsPage() {
  return (
    <main className="dashboard-page results-page">
      <SiteHeader />
      <section className="dashboard-intro results-intro">
        <div><span className="section-index">Results / State & county</span><h1>Read every result at two scales.</h1></div>
        <p>Move from Electoral College totals to individual counties, search any place and sort the closest races or the largest vote totals.</p>
      </section>
      <ResultsExplorer />
    </main>
  );
}
