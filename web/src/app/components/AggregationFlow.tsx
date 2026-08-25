"use client";

import { useState } from "react";

const steps = [
  {
    label: "County",
    value: "3,107",
    detail: "Each county receives a modeled Democratic and Republican vote-share shift, anchored to its previous result.",
  },
  {
    label: "State",
    value: "51",
    detail: "County vote estimates are summed into 50 states plus the District of Columbia, producing one statewide call for this project.",
  },
  {
    label: "Electoral College",
    value: "538",
    detail: "State calls are converted into electoral votes. A candidate needs at least 270 to win the modeled election.",
  },
];

export default function AggregationFlow() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="visual-story-panel flow-panel methodology-flow-panel">
      <header className="visual-panel-heading">
        <span>02 / Aggregation flow</span>
        <div>
          <h2>County → State →<br />Electoral College.</h2>
          <p>The model never predicts the presidency in one jump. Every national result is built upward through two explicit aggregations.</p>
        </div>
      </header>
      <div className="model-flow" role="list" aria-label="Model aggregation stages">
        {steps.map((step, index) => (
          <div className="model-flow-item-wrap" key={step.label}>
            <button type="button" className={`model-flow-item ${activeStep === index ? "is-active" : ""}`} onMouseEnter={() => setActiveStep(index)} onFocus={() => setActiveStep(index)} onClick={() => setActiveStep(index)}>
              <span>0{index + 1}</span><strong>{step.value}</strong><b>{step.label}</b>
            </button>
            {index < steps.length - 1 && <i className="model-flow-connector" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <p className="model-flow-detail"><span>0{activeStep + 1}</span>{steps[activeStep].detail}</p>
    </section>
  );
}
