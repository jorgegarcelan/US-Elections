import type { Metadata } from "next";
import ElectionDashboard from "../components/ElectionDashboard";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Explore",
  description: "Explore county-level presidential election results for 2016, 2020 and 2024.",
};

export default function ExplorePage() {
  return (
    <main className="dashboard-page">
      <SiteHeader />
      <section className="dashboard-intro">
        <div><span className="section-index">Interactive atlas / 2016—2024</span><h1>Explore the electoral map.</h1></div>
        <p>Switch years, compare margins and trace each county&apos;s movement. Hover, zoom or search to inspect the local data behind the national result.</p>
      </section>
      <ElectionDashboard />
    </main>
  );
}
