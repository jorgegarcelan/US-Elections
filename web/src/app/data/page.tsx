import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Data",
  description: "Sources, coverage, variables and downloadable county-level election datasets.",
};

const downloads = [
  ["2016", "Election + ACS 2015", "/data/final_data_2016.csv"],
  ["2020", "Election + ACS 2019", "/data/final_data_2020.csv"],
  ["2024", "Election + ACS 2023", "/data/final_data_2024.csv"],
];

const variables = ["Vote totals & shares", "Population", "Median age", "Median income", "Education", "Race & ethnicity", "Unemployment", "Health insurance", "Family size", "Latitude & longitude"];

export default function DataPage() {
  return (
    <main className="editorial-page project-page">
      <SiteHeader />
      <header className="page-hero data-hero">
        <p className="section-index">Sources &amp; data / Open and inspectable</p>
        <h1>The evidence<br /><em>under the map.</em></h1>
        <p>Three harmonised county-level datasets connect presidential election returns with demographic and socioeconomic estimates.</p>
      </header>

      <section className="source-section">
        <p className="section-index">Primary sources</p>
        <div className="source-grid">
          <article><span>01</span><h2>Election returns</h2><p>County-level presidential results from the public US County Level Election Results collection, supplemented with 2024 returns.</p><a href="https://github.com/tonmcg/US_County_Level_Election_Results_08-20" target="_blank" rel="noreferrer">View source ↗</a></article>
          <article><span>02</span><h2>American Community Survey</h2><p>Five-year ACS estimates retrieved through the official U.S. Census API for the 2015, 2019 and 2023 data releases.</p><a href="https://www.census.gov/data/developers/data-sets/acs-5year.html" target="_blank" rel="noreferrer">Documentation ↗</a></article>
          <article><span>03</span><h2>Geography</h2><p>County FIPS identifiers and Census cartographic boundaries connect tabular results to the interactive map.</p><a href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html" target="_blank" rel="noreferrer">Boundary files ↗</a></article>
        </div>
      </section>

      <section className="download-section dark-section">
        <div><p className="section-index">Downloads</p><h2>Use the prepared datasets.</h2><p>CSV files are provided for inspection and reproducibility. Each combines election outcomes, Census characteristics, geographic identifiers and cycle-over-cycle deltas.</p></div>
        <div className="download-list">
          {downloads.map(([year, label, href]) => <a key={year} href={href} download><strong>{year}</strong><span>{label}</span><span>CSV ↓</span></a>)}
        </div>
      </section>

      <section className="dictionary-section">
        <div className="section-heading"><p className="section-index">Variable groups</p><h2>People, place<br /><em>and the vote.</em></h2></div>
        <div className="variable-grid">{variables.map((variable, index) => <div key={variable}><span>{String(index + 1).padStart(2, "0")}</span><p>{variable}</p></div>)}</div>
        <aside className="data-note"><strong>Important:</strong> ACS figures are estimates, electoral deltas are stored in percentage points, and Alaska is excluded from county-level modelling because its reporting geography is not directly comparable. Its three electoral votes follow the notebook&apos;s explicit Republican prior.</aside>
      </section>
      <SiteFooter />
    </main>
  );
}
