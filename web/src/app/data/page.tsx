import type { Metadata } from "next";
import DataSourcesDiagram from "../components/DataSourcesDiagram";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import VariableDictionary from "../components/VariableDictionary";

export const metadata: Metadata = {
  title: "Data",
  description: "Sources, coverage, variables and downloadable county-level election datasets.",
};

const cycles = [
  { election: "2016", census: "ACS 2015", file: "final_data_2016.csv", href: "/data/final_data_2016.csv" },
  { election: "2020", census: "ACS 2019", file: "final_data_2020.csv", href: "/data/final_data_2020.csv" },
  { election: "2024", census: "ACS 2023", file: "final_data_2024.csv", href: "/data/final_data_2024.csv" },
];

export default function DataPage() {
  return (
    <main className="editorial-page project-page data-page">
      <SiteHeader />
      <header className="page-hero data-hero">
        <p className="section-index">Sources &amp; data / Open and inspectable</p>
        <h1>The evidence<br /><em>under the map.</em></h1>
        <p>Three harmonised county-level datasets connect presidential election returns with demographic and socioeconomic estimates.</p>
      </header>

      <DataSourcesDiagram />

      <section className="data-cycle-section dark-section">
        <header className="data-section-heading">
          <p className="section-index">02 / Cycle alignment</p>
          <h2>Election year<br /><em>meets Census year.</em></h2>
          <p>Each election is paired with the latest available five-year ACS release, then transformed into the same 52-column county schema.</p>
        </header>
        <div className="data-cycle-grid">
          {cycles.map((cycle, index) => <article key={cycle.election}>
            <span>0{index + 1} / 03</span>
            <div className="data-cycle-inputs"><div><small>Election</small><strong>{cycle.election}</strong></div><i aria-hidden="true">+</i><div><small>Census</small><strong>{cycle.census}</strong></div></div>
            <div className="data-cycle-merge" aria-hidden="true"><i /></div>
            <a href={cycle.href} download><div><small>Prepared output</small><strong>{cycle.file}</strong></div><span>CSV ↓</span></a>
          </article>)}
        </div>
        <div className="data-schema-rail"><span>Same schema</span><i><b /></i><strong>3 cycles × 3,107 counties × 52 columns</strong></div>
      </section>

      <VariableDictionary />
      <aside className="data-note data-page-note"><strong>Important:</strong> ACS figures are estimates, electoral deltas are stored in percentage points, and Alaska is excluded from county-level modelling because its reporting geography is not directly comparable. Its three electoral votes follow the notebook&apos;s explicit Republican prior.</aside>
      <SiteFooter />
    </main>
  );
}
