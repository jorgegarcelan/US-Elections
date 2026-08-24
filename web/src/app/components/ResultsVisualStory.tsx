"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { PredResult } from "./ElectionDashboard";

type Winner = "dem" | "gop";

interface CountyRow {
  county_fips: string | number;
  county: string;
  state: string;
  state_code: string | number;
  votes_gop: number;
  votes_dem: number;
  total_votes: number;
  pop_total: number;
  delta_per_gop: number;
}

interface SeatRow {
  state: string;
  state_code: string;
  ElectoralVotes2024: number;
}

interface GeoFeature {
  rsmKey?: string;
  properties: { STATE: string; COUNTY: string; CENSUSAREA?: number };
}

interface GeoCollection {
  type: string;
  features: GeoFeature[];
}

interface ActualState {
  state: string;
  stateCode: string;
  winner: Winner;
  electoralVotes: number;
}

interface DensityBand {
  key: string;
  label: string;
  description: string;
  counties: number;
  medianDensity: number;
  shift: number;
}

interface LocalPoint {
  fips: string;
  county: string;
  state: string;
  contribution: number;
  feature_value: number;
  value_percentile: number;
}

interface LocalExplainability {
  model: string;
  method: string;
  unit: string;
  note: string;
  features: { feature: string; mean_abs_contribution: number; points: LocalPoint[] }[];
}

interface StoryData {
  geo: GeoCollection;
  actualStates: ActualState[];
  fipsToState: Record<string, string>;
  densityBands: DensityBand[];
}

const FEATURE_LABELS: Record<string, string> = {
  households_median_gross_rent: "Median gross rent",
  households_median_value: "Median home value",
  bachelors_rate: "Bachelor’s degree share",
  longitude: "Longitude",
  two_more_races_rate: "Two or more races",
  households_total: "Households",
  high_school_rate: "High school share",
  hispanic_rate: "Hispanic population share",
  no_health_insurance_rate: "Without health insurance",
  inmigrants_rate: "Immigrant population share",
  median_income: "Median household income",
  white_rate: "White population share",
  black_rate: "Black population share",
  public_transport_rate: "Public transport rate",
};

const BAND_META = [
  ["most-rural", "Most rural", "Bottom density quintile"],
  ["rural", "Rural", "Lower-middle density"],
  ["mixed", "Mixed", "Middle density"],
  ["urban", "Urban", "Upper-middle density"],
  ["urban-core", "Urban core", "Top density quintile"],
] as const;

const winnerColor = (winner?: Winner) => winner === "gop" ? "#d71921" : winner === "dem" ? "#5b9bf6" : "#383834";
const humanize = (feature: string) => FEATURE_LABELS[feature] ?? feature.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const fipsString = (value: string | number) => String(value).padStart(5, "0");
const stateFipsString = (value: string | number) => String(Number(value)).padStart(2, "0");

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function featureColor(percentile: number) {
  const amount = Math.max(0, Math.min(1, percentile));
  const from = [49, 90, 166];
  const to = [209, 37, 51];
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(",")})`;
}

function MiniElectionMap({
  title,
  geo,
  fipsToState,
  winners,
  missedStates,
  onHover,
}: {
  title: string;
  geo: GeoCollection;
  fipsToState: Record<string, string>;
  winners: Map<string, Winner>;
  missedStates: Set<string>;
  onHover: (state: string | null) => void;
}) {
  return (
    <figure className="comparison-map">
      <figcaption>{title}</figcaption>
      <ComposableMap projection="geoAlbersUsa" width={760} height={470} role="img" aria-label={`${title} state winner map; incorrect model calls are outlined in yellow`}>
        <Geographies geography={geo}>
          {({ geographies }: { geographies: GeoFeature[] }) => geographies.map((geography) => {
            const state = fipsToState[geography.properties.STATE];
            const missed = missedStates.has(state);
            return (
              <Geography
                key={geography.rsmKey ?? `${geography.properties.STATE}${geography.properties.COUNTY}`}
                geography={geography}
                fill={winnerColor(winners.get(state))}
                stroke={missed ? "#ffe36d" : "rgba(8,8,6,.78)"}
                strokeWidth={missed ? 1.25 : 0.32}
                onMouseEnter={() => onHover(state || null)}
                onMouseLeave={() => onHover(null)}
                style={{ default: { outline: "none" }, hover: { outline: "none", filter: "brightness(1.18)" }, pressed: { outline: "none" } }}
              />
            );
          })}
        </Geographies>
      </ComposableMap>
    </figure>
  );
}

export default function ResultsVisualStory({ result }: { result: PredResult }) {
  const [data, setData] = useState<StoryData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [localExplain, setLocalExplain] = useState<LocalExplainability | null>(null);
  const [localExplainError, setLocalExplainError] = useState(false);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [activeMatrix, setActiveMatrix] = useState("actual-dem-pred-dem");
  const [activeBand, setActiveBand] = useState(0);
  const [hoverPoint, setHoverPoint] = useState<(LocalPoint & { feature: string }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/final_data_2024.csv").then((response) => response.text()),
      fetch("/data/seats.csv").then((response) => response.text()),
      fetch("/counties.json").then((response) => response.json() as Promise<GeoCollection>),
    ]).then(([countyText, seatText, geo]) => {
      const counties = Papa.parse<CountyRow>(countyText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
      const seats = Papa.parse<SeatRow>(seatText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
      const areaByCounty = new Map(geo.features.map((feature) => [`${feature.properties.STATE}${feature.properties.COUNTY}`, Number(feature.properties.CENSUSAREA ?? 0)]));
      const fipsToState: Record<string, string> = { "02": "Alaska" };
      const stateVotes = new Map<string, { dem: number; gop: number }>();
      const densityRows: { density: number; shift: number; votes: number }[] = [];

      counties.forEach((county) => {
        const countyFips = fipsString(county.county_fips);
        const stateFips = stateFipsString(county.state_code);
        fipsToState[stateFips] = county.state;
        const votes = stateVotes.get(county.state) ?? { dem: 0, gop: 0 };
        votes.dem += Number(county.votes_dem) || 0;
        votes.gop += Number(county.votes_gop) || 0;
        stateVotes.set(county.state, votes);
        const area = areaByCounty.get(countyFips) ?? 0;
        const population = Number(county.pop_total);
        const shift = Number(county.delta_per_gop);
        const totalVotes = Number(county.total_votes);
        if (area > 0 && Number.isFinite(population) && Number.isFinite(shift) && Number.isFinite(totalVotes) && totalVotes > 0) {
          densityRows.push({ density: population / area, shift, votes: totalVotes });
        }
      });

      const actualStates = seats.map((seat) => {
        const votes = stateVotes.get(seat.state);
        const winner: Winner = seat.state === "Alaska" ? "gop" : (votes?.gop ?? 0) > (votes?.dem ?? 0) ? "gop" : "dem";
        return { state: seat.state, stateCode: seat.state_code, winner, electoralVotes: Number(seat.ElectoralVotes2024) };
      });

      const sortedDensity = densityRows.sort((a, b) => a.density - b.density);
      const densityBands = BAND_META.map(([key, label, description], bandIndex) => {
        const start = Math.floor((bandIndex / BAND_META.length) * sortedDensity.length);
        const end = Math.floor(((bandIndex + 1) / BAND_META.length) * sortedDensity.length);
        const rows = sortedDensity.slice(start, end);
        const voteTotal = rows.reduce((sum, row) => sum + row.votes, 0);
        const shift = rows.reduce((sum, row) => sum + row.shift * row.votes, 0) / Math.max(voteTotal, 1);
        const medianDensity = rows[Math.floor(rows.length / 2)]?.density ?? 0;
        return { key, label, description, counties: rows.length, medianDensity, shift };
      });

      if (!cancelled) setData({ geo, actualStates, fipsToState, densityBands });
    }).catch(() => { if (!cancelled) setDataError(true); });

    fetch("/api/explain-local?limit=280")
      .then((response) => { if (!response.ok) throw new Error("Local explainability unavailable"); return response.json(); })
      .then((response: LocalExplainability) => { if (!cancelled) setLocalExplain(response); })
      .catch(() => { if (!cancelled) setLocalExplainError(true); });

    return () => { cancelled = true; };
  }, []);

  const comparison = useMemo(() => {
    if (!data) return null;
    const predicted = new Map(result.states.map((state) => [state.state, state.winner as Winner]));
    const actual = new Map(data.actualStates.map((state) => [state.state, state.winner]));
    const missed = data.actualStates.filter((state) => predicted.get(state.state) !== state.winner);
    const missedSet = new Set(missed.map((state) => state.state));
    const actualGopEv = data.actualStates.filter((state) => state.winner === "gop").reduce((sum, state) => sum + state.electoralVotes, 0);
    const actualDemEv = 538 - actualGopEv;
    return { predicted, actual, missed, missedSet, actualGopEv, actualDemEv, correct: data.actualStates.length - missed.length };
  }, [data, result]);

  const matrixCells = useMemo(() => {
    if (!data) return [];
    const predicted = new Map(result.states.map((state) => [state.state, state.winner as Winner]));
    return (["dem", "gop"] as Winner[]).flatMap((actualWinner) => (["dem", "gop"] as Winner[]).map((predictedWinner) => {
      const states = data.actualStates.filter((state) => state.winner === actualWinner && predicted.get(state.state) === predictedWinner);
      return {
        key: `actual-${actualWinner}-pred-${predictedWinner}`,
        actual: actualWinner,
        predicted: predictedWinner,
        states,
        electoralVotes: states.reduce((sum, state) => sum + state.electoralVotes, 0),
        correct: actualWinner === predictedWinner,
      };
    }));
  }, [data, result]);

  const selectedMatrixCell = matrixCells.find((cell) => cell.key === activeMatrix) ?? matrixCells[0];
  const globalMaxContribution = useMemo(() => Math.max(...(localExplain?.features.flatMap((feature) => feature.points.map((point) => Math.abs(point.contribution))) ?? [1])), [localExplain]);
  const hoveredPrediction = hoveredState ? result.states.find((state) => state.state === hoveredState) : null;
  const hoveredActual = hoveredState ? data?.actualStates.find((state) => state.state === hoveredState) : null;
  return (
    <section className="results-visual-story">
      <header className="visual-story-heading">
        <p className="section-index">Four views of the result</p>
        <h2>From county signals<br />to the final call.</h2>
        <p>These linked visualizations compare the prediction with reality and show where geography and variables move the model. The aggregation pipeline now lives in Methodology.</p>
      </header>

      {dataError && <div className="visual-story-loading">[ Historical result data could not be loaded ]</div>}
      {!data && !dataError && <div className="visual-story-loading">[ Building the five-view result story… ]</div>}

      {data && comparison && (
        <>
          <article className="visual-story-panel comparison-panel">
            <header className="visual-panel-heading"><span>01 / Prediction vs real result</span><div><h3>Two maps.<br />One reality check.</h3><p>The yellow outline marks a state where the averaged model call differs from the recorded 2024 winner.</p></div></header>
            <div className="comparison-kpis">
              <div><strong>{comparison.correct} / {data.actualStates.length}</strong><span>state calls correct</span></div>
              <div><strong>{comparison.missed.reduce((sum, state) => sum + state.electoralVotes, 0)} EV</strong><span>attached to missed calls</span></div>
              <div><strong>{result.electoral.gop}—{result.electoral.dem}</strong><span>model · R—D</span></div>
              <div><strong>{comparison.actualGopEv}—{comparison.actualDemEv}</strong><span>recorded · R—D</span></div>
            </div>
            <div className="comparison-map-grid">
              <MiniElectionMap title="Model prediction" geo={data.geo} fipsToState={data.fipsToState} winners={comparison.predicted} missedStates={comparison.missedSet} onHover={setHoveredState} />
              <MiniElectionMap title="Recorded 2024 result" geo={data.geo} fipsToState={data.fipsToState} winners={comparison.actual} missedStates={comparison.missedSet} onHover={setHoveredState} />
            </div>
            <div className="comparison-readout" aria-live="polite">
              {hoveredState ? <><strong>{hoveredState}</strong><span>Model: {hoveredPrediction?.winner === "gop" ? "Republican" : "Democratic"}</span><span>Recorded: {hoveredActual?.winner === "gop" ? "Republican" : "Democratic"}</span><em>{comparison.missedSet.has(hoveredState) ? "Missed call" : "Correct call"}</em></> : <><strong>Missed states</strong>{comparison.missed.map((state) => <span key={state.state}>{state.state} · {state.electoralVotes} EV</span>)}</>}
            </div>
          </article>

          <article className="visual-story-panel matrix-panel">
            <header className="visual-panel-heading"><span>03 / Accuracy matrix</span><div><h3>Correct calls,<br />errors and their cost.</h3><p>Counts alone hide electoral weight. Each cell reports both the number of states and the electors attached to those calls.</p></div></header>
            <div className="accuracy-layout">
              <div className="accuracy-matrix" role="group" aria-label="State prediction accuracy matrix">
                <span className="matrix-axis matrix-axis-top">Predicted winner →</span>
                <span className="matrix-axis matrix-axis-side">Recorded winner →</span>
                <span className="matrix-party-label">D</span><span className="matrix-party-label">R</span>
                <span className="matrix-row-label matrix-row-dem">D</span><span className="matrix-row-label matrix-row-gop">R</span>
                {matrixCells.map((cell) => (
                  <button key={cell.key} type="button" className={`${cell.correct ? "is-correct" : "is-error"} ${activeMatrix === cell.key ? "is-active" : ""}`} onClick={() => setActiveMatrix(cell.key)} onMouseEnter={() => setActiveMatrix(cell.key)} onFocus={() => setActiveMatrix(cell.key)}>
                    <strong>{cell.states.length}</strong><span>states</span><em>{cell.electoralVotes} EV</em>
                  </button>
                ))}
              </div>
              <div className="matrix-detail" aria-live="polite">
                <span>{selectedMatrixCell?.correct ? "Correct calls" : "Model errors"}</span>
                <h4>{selectedMatrixCell?.actual === "gop" ? "Republican" : "Democratic"} in reality,<br />{selectedMatrixCell?.predicted === "gop" ? "Republican" : "Democratic"} in the model.</h4>
                <p>{selectedMatrixCell?.states.length ? selectedMatrixCell.states.map((state) => `${state.state} (${state.electoralVotes})`).join(" · ") : "No state falls in this cell."}</p>
              </div>
            </div>
          </article>

          <article className="visual-story-panel urban-panel">
            <header className="visual-panel-heading"><span>04 / Urban–rural shift</span><div><h3>The same direction.<br />Different intensity.</h3><p>Counties are split into population-density quintiles. Arrow length shows the vote-weighted change in Republican share from 2020 to 2024.</p></div></header>
            <div className="urban-shift-chart">
              <div className="urban-shift-axis" aria-hidden="true"><span>More Democratic</span><i>0</i><span>More Republican</span></div>
              {data.densityBands.map((band, index) => {
                const length = 32 + Math.min(Math.abs(band.shift) / 4, 1) * 160;
                return (
                  <button type="button" className={`urban-shift-row ${activeBand === index ? "is-active" : ""}`} key={band.key} onClick={() => setActiveBand(index)} onMouseEnter={() => setActiveBand(index)} onFocus={() => setActiveBand(index)}>
                    <span><strong>{band.label}</strong><small>{fmt(band.medianDensity)} people / sq mi median</small></span>
                    <div className="urban-shift-track"><i className={band.shift >= 0 ? "is-gop-shift" : "is-dem-shift"} style={{ width: `${length}px` }} /></div>
                    <em className={band.shift >= 0 ? "gop-text" : "dem-text"}>{band.shift >= 0 ? "+" : ""}{band.shift.toFixed(2)} pp R</em>
                  </button>
                );
              })}
            </div>
            <p className="urban-shift-detail"><strong>{data.densityBands[activeBand].label}</strong>{data.densityBands[activeBand].description} · {data.densityBands[activeBand].counties.toLocaleString("en-US")} counties · vote-weighted actual shift.</p>
          </article>

          <article className="visual-story-panel beeswarm-panel">
            <header className="visual-panel-heading"><span>05 / Variables → electoral change</span><div><h3>Every dot<br />is a county.</h3><p>Local XGBoost contributions show how a variable pushes the modeled Republican-minus-Democratic shift. Colour encodes whether that county has a relatively low or high feature value.</p></div></header>
            {localExplainError && <div className="beeswarm-loading">[ Start the prediction service to calculate county-level contributions ]</div>}
            {!localExplain && !localExplainError && <div className="beeswarm-loading">[ Calculating local county contributions… ]</div>}
            {localExplain && (
              <div className="beeswarm-wrap">
                <div className="beeswarm-legend"><span>Low feature value</span><i /><span>High feature value</span><em>← Democratic shift · 0 · Republican shift →</em></div>
                <div className="beeswarm-chart">
                  {localExplain.features.map((feature) => {
                    const strongest = [...feature.points].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
                    return (
                      <div className="beeswarm-row" key={feature.feature} role="img" tabIndex={0} aria-label={`${humanize(feature.feature)} county contribution distribution`} onFocus={() => setHoverPoint({ ...strongest, feature: feature.feature })} onBlur={() => setHoverPoint(null)}>
                        <div><strong>{humanize(feature.feature)}</strong><small>mean |impact| {feature.mean_abs_contribution.toFixed(2)} pp</small></div>
                        <div className="beeswarm-plot" onPointerLeave={() => setHoverPoint(null)}>
                          <i className="beeswarm-zero" aria-hidden="true" />
                          {feature.points.map((point) => {
                            const left = 50 + (point.contribution / globalMaxContribution) * 47;
                            const top = 50 + ((hashString(`${feature.feature}-${point.fips}`) % 1000) / 1000 - .5) * 68;
                            return <span aria-hidden="true" className="beeswarm-point" key={`${feature.feature}-${point.fips}`} style={{ left: `${left}%`, top: `${top}%`, backgroundColor: featureColor(point.value_percentile) }} onPointerEnter={() => setHoverPoint({ ...point, feature: feature.feature })} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="beeswarm-inspector" aria-live="polite">
                  {hoverPoint ? <><strong>{hoverPoint.county}, {hoverPoint.state}</strong><span>{humanize(hoverPoint.feature)} · {Math.round(hoverPoint.value_percentile * 100)}th percentile</span><em className={hoverPoint.contribution >= 0 ? "gop-text" : "dem-text"}>{hoverPoint.contribution >= 0 ? "+" : ""}{hoverPoint.contribution.toFixed(2)} pp toward {hoverPoint.contribution >= 0 ? "R" : "D"} shift</em></> : <><strong>Inspect a county</strong><span>Hover a dot or focus a variable row.</span></>}
                </div>
                <p className="beeswarm-note">{localExplain.method} · {localExplain.note}</p>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
