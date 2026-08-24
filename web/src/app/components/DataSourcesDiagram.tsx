"use client";

import { useState } from "react";

const sources = [
  {
    key: "elections",
    number: "01",
    title: "Election returns",
    signal: "Votes · shares · winner",
    copy: "County-level presidential returns for the historical and 2024 election cycles.",
    href: "https://github.com/tonmcg/US_County_Level_Election_Results_08-20",
    link: "View collection",
  },
  {
    key: "acs",
    number: "02",
    title: "American Community Survey",
    signal: "People · housing · economy",
    copy: "Five-year Census estimates for 2015, 2019 and 2023, aligned to the following election.",
    href: "https://www.census.gov/data/developers/data-sets/acs-5year.html",
    link: "Open documentation",
  },
  {
    key: "geography",
    number: "03",
    title: "Geography",
    signal: "FIPS · boundaries · coordinates",
    copy: "County identifiers and cartographic boundaries connect every row to the map.",
    href: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
    link: "See boundary files",
  },
];

export default function DataSourcesDiagram() {
  const [activeSource, setActiveSource] = useState(0);
  const active = sources[activeSource];

  return (
    <section className="data-source-diagram">
      <header className="data-section-heading">
        <p className="section-index">01 / Source architecture</p>
        <h2>Three inputs.<br /><em>One county table.</em></h2>
        <p>Select a source to see what it contributes before the tables are joined into one comparable analytical schema.</p>
      </header>

      <div className="data-source-flow">
        <div className="data-source-stack">
          {sources.map((source, index) => (
            <article className={`data-source-card ${activeSource === index ? "is-active" : ""}`} key={source.key}>
              <button type="button" onClick={() => setActiveSource(index)} onMouseEnter={() => setActiveSource(index)} onFocus={() => setActiveSource(index)} aria-pressed={activeSource === index}>
                <span>{source.number}</span><strong>{source.title}</strong><small>{source.signal}</small>
              </button>
              <a href={source.href} target="_blank" rel="noreferrer">{source.link} <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>

        <div className="data-source-connectors" aria-hidden="true">
          {sources.map((source, index) => <i className={activeSource === index ? "is-active" : ""} key={source.key}><b /></i>)}
        </div>

        <div className="data-output-node" aria-live="polite" key={active.key}>
          <span>Harmonised output</span>
          <strong>3,107</strong>
          <small>county rows per cycle</small>
          <div><b>{active.title}</b><p>{active.copy}</p></div>
          <dl><div><dt>3</dt><dd>cycles</dd></div><div><dt>52</dt><dd>columns</dd></div><div><dt>FIPS</dt><dd>join key</dd></div></dl>
        </div>
      </div>
    </section>
  );
}
