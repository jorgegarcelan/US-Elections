"use client";

import { useMemo, useState } from "react";
import ElectionDashboard, { type PredResult } from "./ElectionDashboard";
import ModelExplainability from "./ModelExplainability";
import ResultsVisualStory from "./ResultsVisualStory";

const ELECTORAL_REGIONS = [
  {
    key: "rust-belt",
    name: "Rust Belt",
    description: "Industrial states where the old blue wall meets recent Republican gains.",
    states: ["Illinois", "Indiana", "Michigan", "Minnesota", "Ohio", "Pennsylvania", "Wisconsin"],
  },
  {
    key: "sun-belt",
    name: "Sun Belt & South",
    description: "Fast-growing metros, the Deep South and the largest southern prizes.",
    states: ["Alabama", "Arizona", "Florida", "Georgia", "Kentucky", "Louisiana", "Mississippi", "Nevada", "North Carolina", "South Carolina", "Tennessee", "Texas", "West Virginia"],
  },
  {
    key: "middle-rural",
    name: "Middle & Rural",
    description: "The Plains and interior states where rural voting patterns dominate.",
    states: ["Arkansas", "Iowa", "Kansas", "Missouri", "Nebraska", "North Dakota", "Oklahoma", "South Dakota"],
  },
  {
    key: "west-coast",
    name: "West Coast & Pacific",
    description: "The Pacific coast, Alaska and Hawaii on one regional axis.",
    states: ["Alaska", "California", "Hawaii", "Oregon", "Washington"],
  },
  {
    key: "mountain-west",
    name: "Mountain West",
    description: "A mix of safe interior states and rapidly changing western battlegrounds.",
    states: ["Colorado", "Idaho", "Montana", "New Mexico", "Utah", "Wyoming"],
  },
  {
    key: "east-coast",
    name: "East Coast",
    description: "The Northeast corridor through Virginia, dominated by large Democratic states.",
    states: ["Connecticut", "Delaware", "District of Columbia", "Maine", "Maryland", "Massachusetts", "New Hampshire", "New Jersey", "New York", "Rhode Island", "Vermont", "Virginia"],
  },
] as const;

type ResultState = PredResult["states"][number];

function tierColor(gopProbability: number) {
  if (gopProbability >= 0.85) return "#D71921";
  if (gopProbability >= 0.60) return "#FF7A84";
  if (gopProbability > 0.40) return "#C9C2A8";
  if (gopProbability > 0.15) return "#79A7F6";
  return "#274F9F";
}

function tierLabel(gopProbability: number) {
  if (gopProbability >= 0.85) return "Safe R";
  if (gopProbability >= 0.60) return "Lean R";
  if (gopProbability > 0.40) return "Toss-up";
  if (gopProbability > 0.15) return "Lean D";
  return "Safe D";
}

function ElectoralDensityChart({ result }: { result: PredResult }) {
  const [visibleParties, setVisibleParties] = useState({ dem: true, gop: true });
  const [hoverVote, setHoverVote] = useState<number | null>(null);
  const chart = useMemo(() => {
    const outcomes = result.simulation.ev_distribution;
    const allVotes = outcomes.flatMap((outcome) => [outcome.gop_ev, outcome.dem_ev]);
    const xMin = Math.floor((Math.min(...allVotes) - 8) / 10) * 10;
    const xMax = Math.ceil((Math.max(...allVotes) + 8) / 10) * 10;
    const width = 1000;
    const height = 380;
    const margin = { top: 44, right: 24, bottom: 48, left: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const baseline = margin.top + plotHeight;
    const bandwidth = Math.max(4, (xMax - xMin) / 26);
    const sampleCount = 180;
    const totalRuns = outcomes.reduce((sum, outcome) => sum + outcome.count, 0);
    const samples = Array.from({ length: sampleCount }, (_, index) => xMin + (index / (sampleCount - 1)) * (xMax - xMin));
    const density = (x: number, key: "gop_ev" | "dem_ev") => outcomes.reduce((sum, outcome) => {
      const distance = (x - outcome[key]) / bandwidth;
      return sum + outcome.count * Math.exp(-0.5 * distance * distance);
    }, 0) / Math.max(totalRuns * bandwidth, 1);
    const demDensity = samples.map((x) => ({ x, y: density(x, "dem_ev") }));
    const gopDensity = samples.map((x) => ({ x, y: density(x, "gop_ev") }));
    const maxDensity = Math.max(...demDensity.map((point) => point.y), ...gopDensity.map((point) => point.y), 0.001);
    const xScale = (value: number) => margin.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (value: number) => baseline - (value / maxDensity) * plotHeight * 0.9;
    const linePath = (points: { x: number; y: number }[]) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`).join(" ");
    const areaPath = (points: { x: number; y: number }[]) => `M ${xScale(points[0].x).toFixed(2)} ${baseline} ${linePath(points).replace(/^M/, "L")} L ${xScale(points.at(-1)?.x ?? xMax).toFixed(2)} ${baseline} Z`;
    const tickStep = xMax - xMin > 100 ? 20 : 10;
    const ticks = Array.from({ length: Math.floor((xMax - xMin) / tickStep) + 1 }, (_, index) => xMin + index * tickStep);

    return { width, height, margin, baseline, xMin, xMax, xScale, yScale, density, maxDensity, demDensity, gopDensity, linePath, areaPath, ticks };
  }, [result]);

  const meanMarkers = [
    { party: "dem" as const, label: `D mean ${result.simulation.dem_ev_mean.toFixed(0)}`, value: result.simulation.dem_ev_mean, color: "#315aa6" },
    { party: "gop" as const, label: `R mean ${result.simulation.gop_ev_mean.toFixed(0)}`, value: result.simulation.gop_ev_mean, color: "#d12533" },
  ];
  const hoverData = hoverVote === null ? null : {
    vote: hoverVote,
    x: chart.xScale(hoverVote),
    demDensity: chart.density(hoverVote, "dem_ev"),
    gopDensity: chart.density(hoverVote, "gop_ev"),
  };
  const setPartyVisibility = (party: "dem" | "gop") => {
    setVisibleParties((current) => {
      const otherParty = party === "dem" ? "gop" : "dem";
      if (current[party] && !current[otherParty]) return current;
      return { ...current, [party]: !current[party] };
    });
  };
  const updateHoverFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * chart.width;
    const clampedX = Math.max(chart.margin.left, Math.min(chart.width - chart.margin.right, pointerX));
    const vote = chart.xMin + ((clampedX - chart.margin.left) / (chart.width - chart.margin.left - chart.margin.right)) * (chart.xMax - chart.xMin);
    setHoverVote(Math.round(vote));
  };
  const handleChartKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setHoverVote((current) => Math.max(chart.xMin, Math.min(chart.xMax, (current ?? 270) + direction)));
  };

  return (
    <figure className="ev-density-chart">
      <figcaption>
        <button type="button" className={!visibleParties.dem ? "is-muted" : ""} aria-pressed={visibleParties.dem} onClick={() => setPartyVisibility("dem")}><i className="density-swatch density-dem" /><span>Democratic EV density</span></button>
        <button type="button" className={!visibleParties.gop ? "is-muted" : ""} aria-pressed={visibleParties.gop} onClick={() => setPartyVisibility("gop")}><i className="density-swatch density-gop" /><span>Republican EV density</span></button>
        <small>Weighted KDE · {result.simulation.n_sim.toLocaleString("en-US")} runs</small>
      </figcaption>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        tabIndex={0}
        aria-label="Interactive Democratic and Republican Electoral College density distributions. Use the arrow keys or move the pointer to inspect electoral-vote values."
        onPointerMove={updateHoverFromPointer}
        onPointerLeave={() => setHoverVote(null)}
        onFocus={() => setHoverVote((current) => current ?? 270)}
        onBlur={() => setHoverVote(null)}
        onKeyDown={handleChartKey}
      >
        <title>Electoral College outcome density from the reproducible simulation</title>
        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line className="density-grid" x1={chart.xScale(tick)} x2={chart.xScale(tick)} y1={chart.margin.top} y2={chart.baseline} />
            <text className="density-tick" x={chart.xScale(tick)} y={chart.baseline + 27} textAnchor="middle">{tick}</text>
          </g>
        ))}
        {visibleParties.dem && <path className="density-area density-area-dem" d={chart.areaPath(chart.demDensity)} />}
        {visibleParties.gop && <path className="density-area density-area-gop" d={chart.areaPath(chart.gopDensity)} />}
        {visibleParties.dem && <path className="density-line density-line-dem" d={chart.linePath(chart.demDensity)} />}
        {visibleParties.gop && <path className="density-line density-line-gop" d={chart.linePath(chart.gopDensity)} />}
        {meanMarkers.filter((marker) => visibleParties[marker.party]).map((marker) => (
          <g key={marker.label}>
            <line className="density-mean" x1={chart.xScale(marker.value)} x2={chart.xScale(marker.value)} y1={chart.margin.top + 32} y2={chart.baseline} style={{ stroke: marker.color }} />
            <text className="density-mean-label" x={chart.xScale(marker.value) + (marker.party === "dem" ? -7 : 7)} y={chart.margin.top + (marker.party === "dem" ? 10 : 24)} textAnchor={marker.party === "dem" ? "end" : "start"} style={{ fill: marker.color }}>{marker.label}</text>
          </g>
        ))}
        {270 >= chart.xMin && 270 <= chart.xMax && (
          <g>
            <line className="density-threshold" x1={chart.xScale(270)} x2={chart.xScale(270)} y1={chart.margin.top} y2={chart.baseline} />
            <text className="density-threshold-label" x={chart.xScale(270) + 8} y={chart.margin.top + 42} textAnchor="start">270 TO WIN</text>
          </g>
        )}
        <line className="density-axis" x1={chart.margin.left} x2={chart.width - chart.margin.right} y1={chart.baseline} y2={chart.baseline} />
        <text className="density-axis-label" x={chart.width / 2} y={chart.height - 5} textAnchor="middle">ELECTORAL VOTES</text>
        <rect className="density-hit-area" x={chart.margin.left} y={chart.margin.top} width={chart.width - chart.margin.left - chart.margin.right} height={chart.baseline - chart.margin.top} />
        {hoverData && (
          <g className="density-inspector">
            <line x1={hoverData.x} x2={hoverData.x} y1={chart.margin.top} y2={chart.baseline} />
            {visibleParties.dem && <circle className="density-point-dem" cx={hoverData.x} cy={chart.yScale(hoverData.demDensity)} r="5" />}
            {visibleParties.gop && <circle className="density-point-gop" cx={hoverData.x} cy={chart.yScale(hoverData.gopDensity)} r="5" />}
            <g transform={`translate(${hoverData.x > chart.width - 225 ? hoverData.x - 205 : hoverData.x + 12}, ${chart.margin.top + 54})`}>
              <rect width="193" height="78" rx="3" />
              <text x="12" y="19" className="density-tooltip-title">{hoverData.vote} electoral votes</text>
              {visibleParties.dem && <text x="12" y="41" className="density-tooltip-dem">D · {((hoverData.demDensity / chart.maxDensity) * 100).toFixed(0)}% of peak density</text>}
              {visibleParties.gop && <text x="12" y={visibleParties.dem ? 61 : 41} className="density-tooltip-gop">R · {((hoverData.gopDensity / chart.maxDensity) * 100).toFixed(0)}% of peak density</text>}
            </g>
          </g>
        )}
      </svg>
    </figure>
  );
}

function StateCallRow({ state }: { state: ResultState }) {
  const gopProbability = state.gop_win_prob ?? 0;
  const demProbability = 1 - gopProbability;
  return (
    <article className="state-call-row" aria-label={`${state.state}: Republicans win ${(gopProbability * 100).toFixed(0)} percent of simulations and Democrats win ${(demProbability * 100).toFixed(0)} percent`}>
      <span>{state.state_code}</span>
      <strong>{state.state}</strong>
      <small>{state.electoral_votes} EV</small>
      <div><i style={{ width: `${gopProbability * 100}%` }} /></div>
      <em><b>R wins {(gopProbability * 100).toFixed(0)}%</b><span>D wins {(demProbability * 100).toFixed(0)}%</span></em>
    </article>
  );
}

export default function OurResultsExperience() {
  const [result, setResult] = useState<PredResult | null>(null);
  const modeledStates = useMemo(() => result?.states
    .filter((state) => !state.assumption && state.gop_win_prob !== undefined) ?? [], [result]);
  const uncertainStates = useMemo(() => [...modeledStates]
    .sort((a, b) => Math.abs((a.gop_win_prob ?? 0) - 0.5) - Math.abs((b.gop_win_prob ?? 0) - 0.5))
    .slice(0, 10), [modeledStates]);
  const stateCallGroups = useMemo(() => {
    const republican = modeledStates.filter((state) => (state.gop_win_prob ?? 0) >= 0.5);
    const democratic = modeledStates.filter((state) => (state.gop_win_prob ?? 0) < 0.5);
    const closestSort = (a: ResultState, b: ResultState) => (
      Math.abs((a.gop_win_prob ?? 0) - 0.5) - Math.abs((b.gop_win_prob ?? 0) - 0.5)
      || b.electoral_votes - a.electoral_votes
    );
    const safestRepublicanSort = (a: ResultState, b: ResultState) => (
      (b.gop_win_prob ?? 0) - (a.gop_win_prob ?? 0)
      || b.electoral_votes - a.electoral_votes
    );
    const safestDemocraticSort = (a: ResultState, b: ResultState) => (
      (a.gop_win_prob ?? 0) - (b.gop_win_prob ?? 0)
      || b.electoral_votes - a.electoral_votes
    );

    return [
      {
        key: "tossup",
        title: "Toss-up",
        description: "Neither party wins 60% of model runs. These states remain genuinely unresolved.",
        rule: "40%–60% win probability",
        republican: republican.filter((state) => (state.gop_win_prob ?? 0) < 0.60).sort(closestSort),
        democratic: democratic.filter((state) => (state.gop_win_prob ?? 0) > 0.40).sort(closestSort),
        republicanTotal: republican.filter((state) => (state.gop_win_prob ?? 0) < 0.60).length,
        democraticTotal: democratic.filter((state) => (state.gop_win_prob ?? 0) > 0.40).length,
      },
      {
        key: "lean",
        title: "Leans",
        description: "One party leads clearly, but the other still wins at least 15% of model runs.",
        rule: "60%–84% win probability",
        republican: republican.filter((state) => (state.gop_win_prob ?? 0) >= 0.60 && (state.gop_win_prob ?? 0) < 0.85).sort(closestSort),
        democratic: democratic.filter((state) => (state.gop_win_prob ?? 0) <= 0.40 && (state.gop_win_prob ?? 0) > 0.15).sort(closestSort),
        republicanTotal: republican.filter((state) => (state.gop_win_prob ?? 0) >= 0.60 && (state.gop_win_prob ?? 0) < 0.85).length,
        democraticTotal: democratic.filter((state) => (state.gop_win_prob ?? 0) <= 0.40 && (state.gop_win_prob ?? 0) > 0.15).length,
      },
      {
        key: "safe",
        title: "Safe",
        description: "The leading party wins at least 85% of model runs. The largest calls are shown.",
        rule: "85%+ win probability",
        republican: republican.filter((state) => (state.gop_win_prob ?? 0) >= 0.85).sort(safestRepublicanSort).slice(0, 6),
        democratic: democratic.filter((state) => (state.gop_win_prob ?? 0) <= 0.15).sort(safestDemocraticSort).slice(0, 6),
        republicanTotal: republican.filter((state) => (state.gop_win_prob ?? 0) >= 0.85).length,
        democraticTotal: democratic.filter((state) => (state.gop_win_prob ?? 0) <= 0.15).length,
      },
    ];
  }, [modeledStates]);
  const regionCalls = useMemo(() => ELECTORAL_REGIONS.map((region) => {
    const states = region.states
      .map((stateName) => result?.states.find((state) => state.state === stateName))
      .filter((state): state is ResultState => Boolean(state));
    const totalEv = states.reduce((sum, state) => sum + state.electoral_votes, 0);
    const expectedGopEv = states.reduce((sum, state) => sum + (state.gop_win_prob ?? 0) * state.electoral_votes, 0);
    const averageGopProbability = expectedGopEv / Math.max(totalEv, 1);
    const averageUncertainty = states.reduce((sum, state) => sum + Math.abs((state.gop_win_prob ?? 0) - 0.5), 0) / Math.max(states.length, 1);
    return {
      ...region,
      states,
      averageGopProbability,
      averageUncertainty,
      totalEv,
      expectedGopEv,
      gopLeans: states.filter((state) => (state.gop_win_prob ?? 0) >= 0.5).length,
    };
  }), [result]);
  const interpretation = useMemo(() => {
    if (!result) return null;
    const gopFavored = result.simulation.gop_win_prob >= result.simulation.dem_win_prob;
    const favoredParty = gopFavored ? "Republicans" : "Democrats";
    const favoredProbability = gopFavored ? result.simulation.gop_win_prob : result.simulation.dem_win_prob;
    const edge = Math.abs(result.simulation.gop_win_prob - result.simulation.dem_win_prob) * 100;
    const simulatedWins = Math.round(favoredProbability * result.simulation.n_sim);
    const mapWinner = result.electoral.gop >= 270 ? "Republican" : result.electoral.dem >= 270 ? "Democratic" : "unresolved";
    const tightestRegion = [...regionCalls].sort((a, b) => a.averageUncertainty - b.averageUncertainty)[0];
    const closestState = uncertainStates[0];
    const gopRange = result.simulation.gop_ev_p95 - result.simulation.gop_ev_p05;

    return {
      national: `${favoredParty} win ${simulatedWins} of ${result.simulation.n_sim.toLocaleString("en-US")} runs, a ${edge.toFixed(1)}-point probability advantage. That is a measurable edge, but the losing side still wins ${Math.round((1 - favoredProbability) * result.simulation.n_sim)} runs.`,
      map: `The averaged county map produces a ${mapWinner} Electoral College win: ${result.electoral.gop} Republican votes to ${result.electoral.dem} Democratic votes. The median simulation is ${result.simulation.gop_ev_p50}–${result.simulation.dem_ev_p50}, showing how the final map sits inside the wider distribution.`,
      hinge: tightestRegion && closestState
        ? `${tightestRegion.name} is the tighter regional hinge in this run. ${closestState.state} is the closest individual call at ${((closestState.gop_win_prob ?? 0) * 100).toFixed(0)}% Republican and ${((1 - (closestState.gop_win_prob ?? 0)) * 100).toFixed(0)}% Democratic.`
        : "The election remains most sensitive to the states closest to an even probability split.",
      range: `The central 90% of Republican outcomes spans ${result.simulation.gop_ev_p05} to ${result.simulation.gop_ev_p95} electoral votes—a ${gopRange}-vote range. Small changes across the battlegrounds can therefore move the result across the 270-vote line.`,
    };
  }, [result, regionCalls, uncertainStates]);

  return (
    <>
      <section className="our-results-map-heading">
        <span className="section-index">Final simulated map / Reproducible run</span>
        <p>This is our model result: 1,000 XGBoost Monte Carlo runs with a fixed seed, averaged county by county and then aggregated through the Electoral College.</p>
      </section>
      <ElectionDashboard
        initialYear="predict"
        predictionOnly
        defaultModel="xgboost"
        defaultNSim={1000}
        autoRun
        predictionSeed={20240824}
        onPredictionComplete={setResult}
        lockPredictionConfig
      />

      {result && <ResultsVisualStory result={result} />}

      <section className="simulation-distribution">
        <div className="distribution-heading">
          <div><p className="section-index">Outcome distribution</p><h2>Not one prediction.<br />A range of endings.</h2></div>
          <p>The interactive curves estimate the density of Democratic and Republican Electoral College outcomes across the reproducible 1,000-run simulation. The 270 line marks the winning threshold.</p>
        </div>
        {!result ? (
          <div className="distribution-loading">[ Running the reproducible 1,000-simulation result… ]</div>
        ) : (
          <>
            <dl className="distribution-kpis">
              <div><dt>{(result.simulation.gop_win_prob * 100).toFixed(1)}%</dt><dd>Republican win probability</dd></div>
              <div><dt>{(result.simulation.dem_win_prob * 100).toFixed(1)}%</dt><dd>Democratic win probability</dd></div>
              <div><dt>{result.simulation.gop_ev_p05}—{result.simulation.gop_ev_p95}</dt><dd>Republican 90% EV interval</dd></div>
              <div><dt>{result.simulation.dem_ev_p05}—{result.simulation.dem_ev_p95}</dt><dd>Democratic 90% EV interval</dd></div>
            </dl>
            <ElectoralDensityChart result={result} />
            <div className="state-uncertainty">
              <div><p className="section-index">State-call confidence</p><h3>From toss-ups to safe calls.</h3></div>
              <div className="state-call-lists">
                <p className="state-call-explainer"><strong>How to read this</strong> “R wins 56%” means Republicans carry that state in 560 of every 1,000 model runs. It is a win probability, not projected vote share. Toss-up covers 40–60%, Lean 60–84% and Safe 85%+; the center mark is 50 / 50.</p>
                <div className="state-certainty-groups">
                  {stateCallGroups.map((group) => (
                    <section className={`state-certainty-block is-${group.key}`} key={group.key}>
                      <header><div><span>{group.title}</span><p>{group.description}</p></div><small>{group.rule}</small></header>
                      <div className="party-state-groups">
                        <div className="party-state-group party-gop">
                          <h4><span>{group.key === "tossup" ? "Republican edge" : group.key === "lean" ? "Lean Republican" : "Safe Republican"}</span><small>{group.republicanTotal} states{group.republicanTotal > group.republican.length ? ` · showing ${group.republican.length}` : ""}</small></h4>
                          {group.republican.length > 0
                            ? group.republican.map((state) => <StateCallRow key={state.state_code} state={state} />)
                            : <p className="state-group-empty">No state falls on the Republican side of this band.</p>}
                        </div>
                        <div className="party-state-group party-dem">
                          <h4><span>{group.key === "tossup" ? "Democratic edge" : group.key === "lean" ? "Lean Democratic" : "Safe Democratic"}</span><small>{group.democraticTotal} states{group.democraticTotal > group.democratic.length ? ` · showing ${group.democratic.length}` : ""}</small></h4>
                          {group.democratic.length > 0
                            ? group.democratic.map((state) => <StateCallRow key={state.state_code} state={state} />)
                            : <p className="state-group-empty">No state falls on the Democratic side of this band.</p>}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {result && (
        <section className="regional-axes-section">
          <div className="regional-axes-heading">
            <div><p className="section-index">Regional axes</p><h2>Six routes through<br />the electoral map.</h2></div>
            <p>Each dot is the electoral-vote-weighted average Republican win probability across the states in that region. It compares regional direction on one shared D ← 50 / 50 → R scale; it is not a probability of winning the region as a bloc.</p>
          </div>
          <div className="regional-axis-key" aria-hidden="true"><span>Democratic advantage</span><i>50 / 50</i><span>Republican advantage</span></div>
          <div className="regional-axis-list">
            {regionCalls.map((region) => (
              <article key={region.key} aria-label={`${region.name}: ${(region.averageGopProbability * 100).toFixed(0)} percent electoral-vote-weighted Republican win probability`}>
                <div className="regional-axis-name"><strong>{region.name}</strong><p>{region.description}</p><small>{region.totalEv} EV · {region.gopLeans} R-leaning / {region.states.length - region.gopLeans} D-leaning states</small></div>
                <div className="regional-axis-plot">
                  <div><span /><i style={{ left: `${region.averageGopProbability * 100}%`, backgroundColor: tierColor(region.averageGopProbability) }} /></div>
                  <small>{region.states.map((state) => state.state_code).join(" · ")}</small>
                </div>
                <div className="regional-axis-result"><strong style={{ color: tierColor(region.averageGopProbability) }}>{tierLabel(region.averageGopProbability)}</strong><span>{(region.averageGopProbability * 100).toFixed(0)}% weighted R</span><small>{region.expectedGopEv.toFixed(1)} expected R EV</small></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {interpretation && (
        <section className="result-interpretation">
          <div className="interpretation-heading">
            <p className="section-index">Reading the result</p>
            <h2>What the simulation<br />is telling us.</h2>
            <p>A model-based interpretation of the national advantage, the electoral map and the regional axes that organize its path to 270.</p>
          </div>
          <div className="interpretation-grid">
            <article><span>01 / National edge</span><h3>Advantage, not certainty.</h3><p>{interpretation.national}</p></article>
            <article><span>02 / Electoral map</span><h3>One map inside a distribution.</h3><p>{interpretation.map}</p></article>
            <article><span>03 / Regional hinge</span><h3>The decisive belt.</h3><p>{interpretation.hinge}</p></article>
            <article><span>04 / Uncertainty</span><h3>Why 270 remains movable.</h3><p>{interpretation.range}</p></article>
          </div>
        </section>
      )}

      <section className="notebook-benchmark">
        <div><p className="section-index">Executed notebook reference</p><h2>The saved original run.</h2><p>The notebook output remains the historical benchmark. The fixed-seed run above makes the website result reproducible while preserving the same modelling pipeline.</p></div>
        <dl>
          <div><dt>1,000</dt><dd>completed notebook simulations</dd></div>
          <div className="benchmark-gop"><dt>592</dt><dd>Republican wins · 59.2%</dd></div>
          <div className="benchmark-dem"><dt>408</dt><dd>Democratic wins · 40.8%</dd></div>
          <div><dt>+3 R</dt><dd>Alaska prior from the notebook</dd></div>
        </dl>
      </section>
      <ModelExplainability />
    </>
  );
}
