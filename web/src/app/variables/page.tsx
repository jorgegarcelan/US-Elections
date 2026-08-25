import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import NotebookScatterplots from "../components/NotebookScatterplots";
import VariableExplorer from "../components/VariableExplorer";

export const metadata: Metadata = {
  title: "Variable Explorer",
  description: "Explore the demographic and socioeconomic variables used by the county-level election models.",
};

export default function VariablesPage() {
  return (
    <main className="dashboard-page">
      <SiteHeader />
      <section className="dashboard-intro variable-intro">
        <div><span className="section-index">Explore / Census variables</span><h1>See the variables behind the vote.</h1></div>
        <p>Move between county and state views, then switch between the census variable, the 2024 winner map or a combined layer with party-colored borders.</p>
      </section>
      <VariableExplorer />
      <NotebookScatterplots />
    </main>
  );
}
