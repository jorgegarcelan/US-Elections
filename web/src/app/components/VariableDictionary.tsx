"use client";

import { useState } from "react";

const groups = [
  { key: "vote", number: "01", title: "Election outcome", count: 11, description: "Recorded vote totals, party shares, the county winner and cycle-over-cycle change.", fields: ["votes_gop", "votes_dem", "total_votes", "per_dem", "per_gop", "winner", "delta_per_gop"] },
  { key: "geo", number: "02", title: "Geography & IDs", count: 7, description: "Stable identifiers and coordinates used to join tables and draw every county.", fields: ["state", "county", "county_fips", "state_code", "county_code", "latitude", "longitude"] },
  { key: "population", number: "03", title: "Population & age", count: 10, description: "Population size, median age and age-by-sex composition rates.", fields: ["pop_total", "median_age", "pop_total_male_rate", "pop_total_female_rate", "pop_18_39_male_rate", "pop_over_65_female_rate"] },
  { key: "housing", number: "04", title: "Income & housing", count: 7, description: "Household resources, tenure, size, rent and estimated home value.", fields: ["median_income", "households_total", "households_avg_size", "households_median_value", "households_median_gross_rent", "households_owner_rate"] },
  { key: "race", number: "05", title: "Race & ethnicity", count: 10, description: "ACS population shares across racial, ethnic, immigrant and veteran groups.", fields: ["white_rate", "black_rate", "hispanic_rate", "asian_rate", "native_rate", "two_more_races_rate", "inmigrants_rate"] },
  { key: "education", number: "06", title: "Education", count: 2, description: "County educational-attainment shares used as socioeconomic signals.", fields: ["high_school_rate", "bachelors_rate"] },
  { key: "work", number: "07", title: "Work & mobility", count: 3, description: "Employment and commuting characteristics from the ACS.", fields: ["unemployment_rate", "mean_travel_time", "public_transport_rate"] },
  { key: "health", number: "08", title: "Health & poverty", count: 2, description: "Two indicators of economic and healthcare vulnerability.", fields: ["poverty_rate", "no_health_insurance_rate"] },
];

export default function VariableDictionary() {
  const [activeGroup, setActiveGroup] = useState(0);
  const group = groups[activeGroup];

  return (
    <section className="data-dictionary-section">
      <header className="data-section-heading">
        <p className="section-index">03 / Variable dictionary</p>
        <h2>People, place<br /><em>and the vote.</em></h2>
        <p>The 52-column schema is organised into eight families. Select one to inspect its role and representative field names.</p>
      </header>

      <div className="data-dictionary-layout">
        <div className="data-group-grid" role="list" aria-label="Variable groups">
          {groups.map((item, index) => (
            <button type="button" className={activeGroup === index ? "is-active" : ""} key={item.key} onClick={() => setActiveGroup(index)} onMouseEnter={() => setActiveGroup(index)} onFocus={() => setActiveGroup(index)} aria-pressed={activeGroup === index}>
              <span>{item.number}</span><strong>{item.title}</strong><small>{item.count} fields</small>
            </button>
          ))}
        </div>
        <div className="data-group-detail" key={group.key} aria-live="polite">
          <div><span>{group.number} / 08</span><strong>{group.count}</strong><small>columns in this family</small></div>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
          <div className="data-field-list">{group.fields.map((field) => <code key={field}>{field}</code>)}</div>
        </div>
      </div>
    </section>
  );
}
