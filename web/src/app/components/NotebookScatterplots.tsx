"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type ElectionYear = 2016 | 2020 | 2024;
type Party = "dem" | "gop";
type ScatterKey =
  | "log_pop_total"
  | "median_age"
  | "pop_total_male_rate"
  | "pop_total_female_rate"
  | "high_school_rate"
  | "bachelors_rate"
  | "white_rate"
  | "black_rate"
  | "hispanic_rate"
  | "asian_rate"
  | "native_rate"
  | "median_income"
  | "unemployment_rate"
  | "households_avg_size";

interface ScatterDefinition {
  label: string;
  shortLabel: string;
  description: string;
  format: "percent" | "currency" | "number" | "age" | "household";
  sourceKey?: string;
}

interface CountyDatum {
  county: string;
  state: string;
  winner: "gop" | "dem";
  perDem: number;
  perGop: number;
  values: Record<ScatterKey, number>;
}

interface ScatterPoint extends CountyDatum {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

interface PointTooltip {
  clientX: number;
  clientY: number;
  point: ScatterPoint;
}

const YEARS: ElectionYear[] = [2016, 2020, 2024];
const PLOT = { width: 1060, height: 590, left: 76, right: 30, top: 30, bottom: 66 };
const EDUCATION_STATES = new Set(["California", "Idaho", "Illinois", "Kentucky", "Maine", "New York", "Oregon", "Pennsylvania", "Vermont", "Washington", "West Virginia", "Wyoming"]);
const BLACK_SOUTH_STATES = new Set(["Alabama", "Mississippi", "Louisiana", "North Carolina", "South Carolina", "Georgia"]);

const SCATTER_DEFINITIONS: Record<ScatterKey, ScatterDefinition> = {
  log_pop_total: { label: "Population (log scale)", shortLabel: "Population", description: "County size on a logarithmic scale, as used in the notebook to keep large urban counties legible.", format: "number", sourceKey: "pop_total" },
  median_age: { label: "Median age", shortLabel: "Median age", description: "Median age of the county population.", format: "age" },
  pop_total_male_rate: { label: "Male population share", shortLabel: "Male share", description: "Share of county residents recorded as male.", format: "percent" },
  pop_total_female_rate: { label: "Female population share", shortLabel: "Female share", description: "Share of county residents recorded as female.", format: "percent" },
  high_school_rate: { label: "High-school education", shortLabel: "High school", description: "County education indicator for high-school attainment in the model dataset.", format: "percent" },
  bachelors_rate: { label: "Bachelor’s degree", shortLabel: "Bachelor’s", description: "Share of residents with a bachelor’s degree, one of the notebook’s clearest education plots.", format: "percent" },
  white_rate: { label: "White population share", shortLabel: "White share", description: "Share of county residents identifying as White.", format: "percent" },
  black_rate: { label: "Black population share", shortLabel: "Black share", description: "Share of county residents identifying as Black or African American.", format: "percent" },
  hispanic_rate: { label: "Hispanic population share", shortLabel: "Hispanic share", description: "Share of county residents identifying as Hispanic or Latino.", format: "percent" },
  asian_rate: { label: "Asian population share", shortLabel: "Asian share", description: "Share of county residents identifying as Asian.", format: "percent" },
  native_rate: { label: "Native population share", shortLabel: "Native share", description: "Share of county residents identifying as American Indian or Alaska Native.", format: "percent" },
  median_income: { label: "Median household income", shortLabel: "Income", description: "Estimated annual median household income in U.S. dollars.", format: "currency" },
  unemployment_rate: { label: "Unemployment rate", shortLabel: "Unemployment", description: "Share of the county labor force recorded as unemployed.", format: "percent" },
  households_avg_size: { label: "Average household size", shortLabel: "Household size", description: "Average number of people per household.", format: "household" },
};

const SCATTER_KEYS = Object.keys(SCATTER_DEFINITIONS) as ScatterKey[];

function valueFromRaw(raw: Record<string, string>, key: ScatterKey) {
  const definition = SCATTER_DEFINITIONS[key];
  const value = Number(raw[definition.sourceKey ?? key]);
  if (key === "log_pop_total") return value > 0 ? Math.log10(value) : Number.NaN;
  if (key === "median_income" && value <= 0) return Number.NaN;
  return value;
}

function parseCsv(csv: string): CountyDatum[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return parsed.data.flatMap((raw) => {
    const perDem = Number(raw.per_dem);
    const perGop = Number(raw.per_gop);
    if (!raw.county || !raw.state || !Number.isFinite(perDem) || !Number.isFinite(perGop)) return [];
    return [{
      county: raw.county,
      state: raw.state,
      winner: raw.winner === "dem" ? "dem" : "gop",
      perDem,
      perGop,
      values: Object.fromEntries(SCATTER_KEYS.map((key) => [key, valueFromRaw(raw, key)])) as Record<ScatterKey, number>,
    }];
  });
}

function formatX(value: number, definition: ScatterDefinition, compact = false) {
  if (definition.format === "percent") return `${value.toFixed(compact ? 0 : 1)}%`;
  if (definition.format === "currency") return `$${Math.round(value / 1000)}k`;
  if (definition.format === "age") return `${value.toFixed(compact ? 0 : 1)} yrs`;
  if (definition.format === "household") return value.toFixed(compact ? 1 : 2);
  const population = 10 ** value;
  if (population >= 1_000_000) return `${(population / 1_000_000).toFixed(1)}m`;
  if (population >= 1_000) return `${Math.round(population / 1_000)}k`;
  return Math.round(population).toLocaleString("en-US");
}

function correlation(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return 0;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let xSquare = 0;
  let ySquare = 0;
  for (const point of points) {
    const xDelta = point.x - xMean;
    const yDelta = point.y - yMean;
    numerator += xDelta * yDelta;
    xSquare += xDelta ** 2;
    ySquare += yDelta ** 2;
  }
  return numerator / Math.sqrt(xSquare * ySquare) || 0;
}

function regression(points: Array<{ x: number; y: number }>) {
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / Math.max(points.length, 1);
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / Math.max(points.length, 1);
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  const slope = denominator ? points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator : 0;
  return { slope, intercept: yMean - slope * xMean };
}

function scopeLabel(scope: string) {
  if (scope === "all") return "All U.S. counties";
  if (scope === "education") return "Notebook focus · Education states";
  if (scope === "black-south") return "Notebook focus · Black share / South";
  return scope;
}

function associationCopy(value: number) {
  const strength = Math.abs(value) >= 0.5 ? "strong" : Math.abs(value) >= 0.3 ? "clear" : Math.abs(value) >= 0.15 ? "modest" : "weak";
  const direction = value >= 0 ? "positive" : "negative";
  return `${strength} ${direction} association`;
}

export default function NotebookScatterplots() {
  const [datasets, setDatasets] = useState<Partial<Record<ElectionYear, CountyDatum[]>>>({});
  const [year, setYear] = useState<ElectionYear>(2024);
  const [party, setParty] = useState<Party>("dem");
  const [variable, setVariable] = useState<ScatterKey>("bachelors_rate");
  const [scope, setScope] = useState("all");
  const [tooltip, setTooltip] = useState<PointTooltip | null>(null);

  useEffect(() => {
    Promise.all(YEARS.map(async (electionYear) => {
      const csv = await fetch(`/data/final_data_${electionYear}.csv`).then((response) => response.text());
      return [electionYear, parseCsv(csv)] as const;
    })).then((entries) => setDatasets(Object.fromEntries(entries)));
  }, []);

  const rows = useMemo(() => datasets[year] ?? [], [datasets, year]);
  const states = useMemo(() => [...new Set(rows.map((row) => row.state))].sort(), [rows]);
  const selectedRows = useMemo(() => rows.filter((row) => {
    if (scope === "education") return EDUCATION_STATES.has(row.state);
    if (scope === "black-south") return BLACK_SOUTH_STATES.has(row.state);
    return scope === "all" || row.state === scope;
  }), [rows, scope]);

  const chart = useMemo(() => {
    const sourcePoints = selectedRows.flatMap((row) => {
      const x = row.values[variable];
      const y = party === "dem" ? row.perDem : row.perGop;
      return Number.isFinite(x) && Number.isFinite(y) ? [{ ...row, x, y }] : [];
    });
    if (!sourcePoints.length) return null;
    const xValues = sourcePoints.map((point) => point.x);
    const rawMin = Math.min(...xValues);
    const rawMax = Math.max(...xValues);
    const padding = Math.max((rawMax - rawMin) * 0.04, 0.01);
    const xMin = rawMin - padding;
    const xMax = rawMax + padding;
    const innerWidth = PLOT.width - PLOT.left - PLOT.right;
    const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;
    const xScale = (value: number) => PLOT.left + ((value - xMin) / (xMax - xMin)) * innerWidth;
    const yScale = (value: number) => PLOT.top + (1 - value) * innerHeight;
    const points: ScatterPoint[] = sourcePoints.map((point) => ({ ...point, cx: xScale(point.x), cy: yScale(point.y) }));
    const fit = regression(sourcePoints);
    const lineStart = Math.max(0, Math.min(1, fit.intercept + fit.slope * xMin));
    const lineEnd = Math.max(0, Math.min(1, fit.intercept + fit.slope * xMax));
    return {
      points,
      xMin,
      xMax,
      xScale,
      yScale,
      fit,
      lineStart,
      lineEnd,
      correlation: correlation(sourcePoints),
    };
  }, [party, selectedRows, variable]);

  const definition = SCATTER_DEFINITIONS[variable];
  const partyLabel = party === "dem" ? "Democratic" : "Republican";

  function chooseNotebookFocus(nextVariable: ScatterKey) {
    setVariable(nextVariable);
    if (nextVariable === "bachelors_rate") setScope("education");
    if (nextVariable === "black_rate") setScope("black-south");
  }

  return (
    <section className="scatter-lab" aria-labelledby="scatter-lab-title">
      <header className="scatter-lab-heading">
        <p className="section-index">02 / Notebook relationships</p>
        <div>
          <h2 id="scatter-lab-title">Variables meet <em>the vote.</em></h2>
          <p>The notebook’s county scatterplots, rebuilt as one interactive lab. Change the election, isolate a state and inspect the relationship without losing the original winner colors.</p>
        </div>
      </header>

      <div className="scatter-preset-rail" aria-label="Notebook variable plots">
        {SCATTER_KEYS.map((key, index) => (
          <button key={key} type="button" aria-pressed={variable === key} onClick={() => chooseNotebookFocus(key)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {SCATTER_DEFINITIONS[key].shortLabel}
          </button>
        ))}
      </div>

      <div className="scatter-workbench">
        <header className="scatter-toolbar">
          <div className="scatter-toolbar-copy">
            <span>{year} county results · {scopeLabel(scope)}</span>
            <strong>{definition.label} × {partyLabel} vote</strong>
          </div>
          <div className="scatter-controls">
            <div className="scatter-segmented" aria-label="Election year">
              {YEARS.map((option) => <button key={option} type="button" aria-pressed={year === option} onClick={() => setYear(option)}>{option}</button>)}
            </div>
            <div className="scatter-segmented" aria-label="Vote share">
              <button type="button" aria-pressed={party === "dem"} onClick={() => setParty("dem")}>Dem vote</button>
              <button type="button" aria-pressed={party === "gop"} onClick={() => setParty("gop")}>GOP vote</button>
            </div>
            <label>
              <span className="sr-only">Geographic focus</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="all">All U.S. counties</option>
                <option value="education">Notebook · Education states</option>
                <option value="black-south">Notebook · Black share / South</option>
                <optgroup label="Single state">
                  {states.map((state) => <option key={state} value={state}>{state}</option>)}
                </optgroup>
              </select>
            </label>
          </div>
        </header>

        <div className="scatter-stage">
          <div className="scatter-plot-wrap">
            {!chart && <div className="scatter-loading">[ Loading notebook data… ]</div>}
            {chart && (
              <svg className="scatter-plot" viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-label={`${definition.label} versus ${partyLabel} vote share for ${chart.points.length} counties in ${year}`}>
                <g className="scatter-grid" aria-hidden="true">
                  {[0, .25, .5, .75, 1].map((tick) => (
                    <g key={tick}>
                      <line x1={PLOT.left} x2={PLOT.width - PLOT.right} y1={chart.yScale(tick)} y2={chart.yScale(tick)} />
                      <text x={PLOT.left - 14} y={chart.yScale(tick) + 4} textAnchor="end">{Math.round(tick * 100)}%</text>
                    </g>
                  ))}
                  {[0, .25, .5, .75, 1].map((progress) => {
                    const value = chart.xMin + (chart.xMax - chart.xMin) * progress;
                    const x = chart.xScale(value);
                    return <g key={progress}><line x1={x} x2={x} y1={PLOT.top} y2={PLOT.height - PLOT.bottom} /><text x={x} y={PLOT.height - PLOT.bottom + 27} textAnchor="middle">{formatX(value, definition, true)}</text></g>;
                  })}
                </g>
                <line className="scatter-majority-line" x1={PLOT.left} x2={PLOT.width - PLOT.right} y1={chart.yScale(.5)} y2={chart.yScale(.5)} />
                <text className="scatter-majority-label" x={PLOT.width - PLOT.right - 4} y={chart.yScale(.5) - 9} textAnchor="end">50% vote line</text>
                <g className="scatter-points" aria-hidden="true">
                  {chart.points.map((point, index) => (
                    <circle
                      key={`${point.state}-${point.county}-${index}`}
                      className={point.winner === "gop" ? "is-gop-point" : "is-dem-point"}
                      cx={point.cx}
                      cy={point.cy}
                      r={tooltip?.point === point ? 6 : 3.2}
                      onMouseEnter={(event) => setTooltip({ clientX: event.clientX, clientY: event.clientY, point })}
                      onMouseMove={(event) => setTooltip({ clientX: event.clientX, clientY: event.clientY, point })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </g>
                <line className="scatter-trend-line" x1={chart.xScale(chart.xMin)} x2={chart.xScale(chart.xMax)} y1={chart.yScale(chart.lineStart)} y2={chart.yScale(chart.lineEnd)} />
                <text className="scatter-axis-label" x={(PLOT.left + PLOT.width - PLOT.right) / 2} y={PLOT.height - 12} textAnchor="middle">{definition.label}</text>
                <text className="scatter-axis-label" transform={`translate(19 ${(PLOT.top + PLOT.height - PLOT.bottom) / 2}) rotate(-90)`} textAnchor="middle">{partyLabel} vote share</text>
              </svg>
            )}
          </div>

          <aside className="scatter-inspector" aria-live="polite">
            <p className="section-index">Reading the plot</p>
            <h3>{definition.label}</h3>
            <p>{definition.description}</p>
            <dl>
              <div><dt>Pearson r</dt><dd className={(chart?.correlation ?? 0) >= 0 ? "is-positive" : "is-negative"}>{chart ? `${chart.correlation >= 0 ? "+" : ""}${chart.correlation.toFixed(2)}` : "—"}</dd></div>
              <div><dt>Counties shown</dt><dd>{chart?.points.length.toLocaleString("en-US") ?? "—"}</dd></div>
              <div><dt>Pattern</dt><dd>{chart ? associationCopy(chart.correlation) : "Loading"}</dd></div>
            </dl>
            <div className="scatter-legend"><span><i className="is-gop" /> Republican county winner</span><span><i className="is-dem" /> Democratic county winner</span><span><i className="is-trend" /> Linear trend</span></div>
            <p className="scatter-caveat">Correlation is descriptive, not causal. The line summarizes county-level association and does not represent the model’s prediction on its own.</p>
          </aside>
        </div>
      </div>

      <div className="scatter-notebook-notes">
        <article><span>Notebook focus A</span><strong>Education states</strong><p>The bachelor’s preset isolates the twelve states highlighted in the original analysis, from California and Washington to Pennsylvania and West Virginia.</p></article>
        <article><span>Notebook focus B</span><strong>Black share / South</strong><p>The Black-share preset recreates the notebook’s southern comparison across Alabama, Mississippi, Louisiana, the Carolinas and Georgia.</p></article>
        <article><span>How to read</span><strong>Dots are counties</strong><p>Horizontal position is the selected census variable; vertical position is vote share. Color always shows the recorded county winner.</p></article>
      </div>

      {tooltip && (
        <div className="scatter-tooltip" style={{ left: tooltip.clientX + 15, top: tooltip.clientY - 12 }}>
          <strong>{tooltip.point.county}</strong><span>{tooltip.point.state}</span>
          <dl>
            <div><dt>{definition.shortLabel}</dt><dd>{formatX(tooltip.point.x, definition)}</dd></div>
            <div><dt>{partyLabel} vote</dt><dd>{(tooltip.point.y * 100).toFixed(1)}%</dd></div>
          </dl>
          <em className={tooltip.point.winner === "gop" ? "gop-text" : "dem-text"}>{tooltip.point.winner === "gop" ? "Republican" : "Democratic"} winner</em>
        </div>
      )}
    </section>
  );
}
