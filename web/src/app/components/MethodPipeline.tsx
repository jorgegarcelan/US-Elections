"use client";

import { useState } from "react";

const stages = [
  {
    number: "01",
    title: "Collect",
    copy: "Pair county election results with five-year American Community Survey estimates for each cycle.",
    input: "Election returns + ACS",
    process: "Join by cycle and FIPS",
    output: "County source table",
  },
  {
    number: "02",
    title: "Clean",
    copy: "Normalise FIPS codes, Connecticut planning regions, missing values and year-specific fields.",
    input: "Raw county tables",
    process: "Align geography + schema",
    output: "Comparable cycles",
  },
  {
    number: "03",
    title: "Describe",
    copy: "Connect vote outcomes with income, education, race, age, geography and employment.",
    input: "Aligned variables",
    process: "Map + compare patterns",
    output: "Candidate signals",
  },
  {
    number: "04",
    title: "Model",
    copy: "Compare Linear, Ridge, KNN, Random Forest and XGBoost estimates of vote-share change.",
    input: "Historical signals",
    process: "Fit + cross-validate",
    output: "County shift Δ",
  },
  {
    number: "05",
    title: "Simulate",
    copy: "Vary historical weights and turnout, aggregate county estimates and repeat the election.",
    input: "Baseline + modeled Δ",
    process: "1,000 weighted runs",
    output: "Outcome distribution",
  },
];

export default function MethodPipeline() {
  const [activeStage, setActiveStage] = useState(0);
  const stage = stages[activeStage];

  return (
    <section className="method-pipeline">
      <header className="method-pipeline-heading">
        <p className="section-index">01 / Reproducible pipeline</p>
        <h2>Five stages.<br /><em>No black box.</em></h2>
        <p>Select a stage to follow what enters the pipeline, what happens to it and what leaves for the next decision.</p>
      </header>

      <div className="method-pipeline-track" role="list" aria-label="Methodology stages">
        {stages.map((item, index) => (
          <div className="method-stage-wrap" key={item.number}>
            <button type="button" className={`method-stage ${activeStage === index ? "is-active" : ""}`} onClick={() => setActiveStage(index)} onMouseEnter={() => setActiveStage(index)} onFocus={() => setActiveStage(index)} aria-pressed={activeStage === index}>
              <span>{item.number}</span><strong>{item.title}</strong><small>{item.copy}</small>
            </button>
            {index < stages.length - 1 && <i className="method-stage-connector" aria-hidden="true"><b /></i>}
          </div>
        ))}
      </div>

      <div className="method-stage-detail" aria-live="polite" key={stage.number}>
        <div className="method-stage-detail-title"><span>{stage.number}</span><strong>{stage.title}</strong></div>
        <div className="method-stage-node"><span>Input</span><strong>{stage.input}</strong></div>
        <i className="method-stage-detail-arrow" aria-hidden="true"><b /></i>
        <div className="method-stage-node is-process"><span>Process</span><strong>{stage.process}</strong></div>
        <i className="method-stage-detail-arrow" aria-hidden="true"><b /></i>
        <div className="method-stage-node"><span>Output</span><strong>{stage.output}</strong></div>
      </div>
    </section>
  );
}
