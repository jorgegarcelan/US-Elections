"use client";

import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import Papa from "papaparse";

type VariableKey = "black_rate" | "white_rate" | "hispanic_rate" | "median_income" | "bachelors_rate" | "poverty_rate" | "unemployment_rate" | "median_age" | "pop_total";
type GeoLevel = "county" | "state";
type LayerMode = "variable" | "winner" | "compare";

interface VariableDefinition {
  label: string;
  shortLabel: string;
  description: string;
  format: "percent" | "currency" | "number" | "age";
}

interface VariableRow {
  fips: string;
  county: string;
  state: string;
  population: number;
  votesGop: number;
  votesDem: number;
  winner: "gop" | "dem";
  values: Record<VariableKey, number>;
}

interface StateVariableRow {
  state: string;
  population: number;
  winner: "gop" | "dem";
  values: Record<VariableKey, number>;
}

interface VariableTooltip {
  x: number;
  y: number;
  name: string;
  state?: string;
  value: number;
  winner: "gop" | "dem";
}

const VARIABLE_DEFINITIONS: Record<VariableKey, VariableDefinition> = {
  black_rate: { label: "Black population", shortLabel: "Black", description: "Share of residents identifying as Black or African American.", format: "percent" },
  white_rate: { label: "White population", shortLabel: "White", description: "Share of residents identifying as White.", format: "percent" },
  hispanic_rate: { label: "Hispanic population", shortLabel: "Hispanic", description: "Share of residents identifying as Hispanic or Latino.", format: "percent" },
  median_income: { label: "Median household income", shortLabel: "Income", description: "Estimated median annual household income in U.S. dollars.", format: "currency" },
  bachelors_rate: { label: "Bachelor’s degree", shortLabel: "College", description: "Share of residents with a bachelor’s degree or higher.", format: "percent" },
  poverty_rate: { label: "Poverty rate", shortLabel: "Poverty", description: "Share of residents living below the poverty threshold.", format: "percent" },
  unemployment_rate: { label: "Unemployment rate", shortLabel: "Unemployment", description: "Share of the labor force recorded as unemployed.", format: "percent" },
  median_age: { label: "Median age", shortLabel: "Age", description: "Median age of the resident population.", format: "age" },
  pop_total: { label: "Total population", shortLabel: "Population", description: "Estimated resident population.", format: "number" },
};

const VARIABLE_KEYS = Object.keys(VARIABLE_DEFINITIONS) as VariableKey[];
const COLOR_STEPS = ["#132126", "#18353d", "#20505b", "#2b6b75", "#4c898c", "#85aaa3", "#c6c7a1", "#f0cf83"];

const formatValue = (value: number, format: VariableDefinition["format"]) => {
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "currency") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (format === "age") return `${value.toFixed(1)} years`;
  return Math.round(value).toLocaleString("en-US");
};

function colorForValue(value: number, low: number, high: number) {
  if (!Number.isFinite(value)) return "#2d2d28";
  const progress = high === low ? 0.5 : Math.max(0, Math.min(1, (value - low) / (high - low)));
  return COLOR_STEPS[Math.min(COLOR_STEPS.length - 1, Math.floor(progress * COLOR_STEPS.length))];
}

export default function VariableExplorer() {
  const [rows, setRows] = useState<Record<string, VariableRow>>({});
  const [geoData, setGeoData] = useState<object | null>(null);
  const [variable, setVariable] = useState<VariableKey>("black_rate");
  const [geoLevel, setGeoLevel] = useState<GeoLevel>("county");
  const [layer, setLayer] = useState<LayerMode>("compare");
  const [tooltip, setTooltip] = useState<VariableTooltip | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/counties.json").then((response) => response.json()),
      fetch("/data/final_data_2024.csv").then((response) => response.text()),
    ]).then(([geography, csv]) => {
      const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
      const nextRows: Record<string, VariableRow> = {};
      for (const raw of parsed.data) {
        const fips = raw.county_fips?.padStart(5, "0");
        if (!fips) continue;
        const values = {} as Record<VariableKey, number>;
        for (const key of VARIABLE_KEYS) values[key] = Number(raw[key]) || 0;
        nextRows[fips] = {
          fips,
          county: raw.county,
          state: raw.state,
          population: Number(raw.pop_total) || 0,
          votesGop: Number(raw.votes_gop) || 0,
          votesDem: Number(raw.votes_dem) || 0,
          winner: raw.winner === "dem" ? "dem" : "gop",
          values,
        };
      }
      setGeoData(geography);
      setRows(nextRows);
    });
  }, []);

  const stateRows = useMemo(() => {
    const accumulators: Record<string, { population: number; votesGop: number; votesDem: number; weighted: Record<VariableKey, number> }> = {};
    for (const row of Object.values(rows)) {
      const accumulator = accumulators[row.state] ??= {
        population: 0,
        votesGop: 0,
        votesDem: 0,
        weighted: Object.fromEntries(VARIABLE_KEYS.map((key) => [key, 0])) as Record<VariableKey, number>,
      };
      accumulator.population += row.population;
      accumulator.votesGop += row.votesGop;
      accumulator.votesDem += row.votesDem;
      for (const key of VARIABLE_KEYS) {
        accumulator.weighted[key] += key === "pop_total" ? row.values[key] : row.values[key] * row.population;
      }
    }
    const result: Record<string, StateVariableRow> = {};
    for (const [state, accumulator] of Object.entries(accumulators)) {
      const values = {} as Record<VariableKey, number>;
      for (const key of VARIABLE_KEYS) {
        values[key] = key === "pop_total"
          ? accumulator.weighted[key]
          : accumulator.weighted[key] / Math.max(accumulator.population, 1);
      }
      result[state] = { state, population: accumulator.population, winner: accumulator.votesGop > accumulator.votesDem ? "gop" : "dem", values };
    }
    return result;
  }, [rows]);

  const visibleRows = useMemo(() => geoLevel === "state" ? Object.values(stateRows) : Object.values(rows), [geoLevel, rows, stateRows]);
  const domain = useMemo(() => {
    const sorted = visibleRows.map((row) => row.values[variable]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { low: 0, high: 1 };
    return {
      low: sorted[Math.floor(sorted.length * 0.03)],
      high: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.97))],
    };
  }, [variable, visibleRows]);
  const ranking = useMemo(() => [...visibleRows].sort((a, b) => b.values[variable] - a.values[variable]).slice(0, 8), [variable, visibleRows]);
  const definition = VARIABLE_DEFINITIONS[variable];

  return (
    <section className="variable-explorer" aria-label="Demographic variable explorer">
      <header className="variable-toolbar">
        <div>
          <span>2023 ACS estimate</span>
          <strong>{definition.label}</strong>
        </div>
        <div className="variable-controls">
          <label>
            <span className="sr-only">Variable</span>
            <select value={variable} onChange={(event) => setVariable(event.target.value as VariableKey)}>
              {VARIABLE_KEYS.map((key) => <option key={key} value={key}>{VARIABLE_DEFINITIONS[key].label}</option>)}
            </select>
          </label>
          <div className="variable-level" aria-label="Geography level">
            {(["county", "state"] as GeoLevel[]).map((level) => (
              <button key={level} type="button" aria-pressed={geoLevel === level} onClick={() => setGeoLevel(level)}>{level}</button>
            ))}
          </div>
          <div className="variable-layer" aria-label="Map layer">
            {(["variable", "winner", "compare"] as LayerMode[]).map((option) => (
              <button key={option} type="button" aria-pressed={layer === option} onClick={() => setLayer(option)}>{option === "winner" ? "2024 winner" : option}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="variable-body">
        <div className="variable-map" onMouseMove={(event) => setTooltip((current) => current && { ...current, x: event.clientX, y: event.clientY })}>
          {!geoData && <div className="map-loading">[ Loading census layer… ]</div>}
          {geoData && (
            <ComposableMap role="img" aria-label={`${definition.label} by ${geoLevel}`} projection="geoAlbersUsa" projectionConfig={{ scale: 1050 }}>
              <ZoomableGroup zoom={1}>
                <Geographies geography={geoData}>
                  {({ geographies }: { geographies: Array<{ rsmKey: string; properties: { STATE: string; COUNTY: string } }> }) => geographies.map((geography) => {
                    const fips = geography.properties.STATE + geography.properties.COUNTY;
                    const county = rows[fips];
                    const item = geoLevel === "state" && county ? stateRows[county.state] : county;
                    const value = item?.values[variable];
                    const winner = item?.winner;
                    const variableFill = value === undefined ? "#2d2d28" : colorForValue(value, domain.low, domain.high);
                    const winnerColor = winner === "gop" ? "#D71921" : winner === "dem" ? "#5B9BF6" : "#2d2d28";
                    return (
                      <Geography
                        key={geography.rsmKey}
                        geography={geography}
                        fill={layer === "winner" ? winnerColor : variableFill}
                        stroke={layer === "compare" ? winnerColor : geoLevel === "state" ? "rgba(0,0,0,.16)" : "#080806"}
                        strokeWidth={layer === "compare" ? (geoLevel === "state" ? 0.65 : 0.85) : geoLevel === "state" ? 0.2 : 0.5}
                        style={{ default: { outline: "none" }, hover: { outline: "none", filter: "brightness(1.25)" }, pressed: { outline: "none" } }}
                        onMouseEnter={(event) => {
                          if (!item || value === undefined) return;
                          setTooltip({
                            x: (event as unknown as React.MouseEvent).clientX,
                            y: (event as unknown as React.MouseEvent).clientY,
                            name: geoLevel === "state" ? item.state : (item as VariableRow).county,
                            state: geoLevel === "county" ? (item as VariableRow).state : undefined,
                            value,
                            winner: item.winner,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          )}
          {layer === "winner" ? (
            <div className="winner-layer-legend"><span><i className="is-gop" />Republican winner</span><span><i className="is-dem" />Democratic winner</span></div>
          ) : (
            <div className="variable-legend">
              <span>{formatValue(domain.low, definition.format)}</span>
              <i aria-hidden="true" />
              <span>{formatValue(domain.high, definition.format)}</span>
              {layer === "compare" && <b><em className="gop-border" /> R border <em className="dem-border" /> D border</b>}
            </div>
          )}
        </div>

        <aside className="variable-sidebar">
          <p className="section-index">Variable guide</p>
          <h2>{definition.label}</h2>
          <p>{definition.description}</p>
          <div className="variable-range"><span>Displayed range</span><strong>{formatValue(domain.low, definition.format)}—{formatValue(domain.high, definition.format)}</strong></div>
          <div className="variable-ranking">
            <span>Highest {geoLevel === "state" ? "states" : "counties"}</span>
            {ranking.map((row, index) => (
              <div key={geoLevel === "state" ? row.state : (row as VariableRow).fips}>
                <em>{String(index + 1).padStart(2, "0")}</em>
                <span>{geoLevel === "state" ? row.state : `${(row as VariableRow).county}, ${(row as VariableRow).state}`}</span>
                <strong>{formatValue(row.values[variable], definition.format)}</strong>
              </div>
            ))}
          </div>
          <p className="variable-note">State values are population-weighted aggregations of the county estimates. Colors are clipped at the 3rd and 97th percentiles so outliers do not flatten the map.</p>
        </aside>
      </div>

      {tooltip && (
        <div className="variable-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y - 12 }}>
          <strong>{tooltip.name}</strong>
          {tooltip.state && <span>{tooltip.state}</span>}
          <em>{definition.shortLabel}</em>
          <b>{formatValue(tooltip.value, definition.format)}</b>
          <span className={tooltip.winner === "gop" ? "tooltip-winner-gop" : "tooltip-winner-dem"}>{tooltip.winner === "gop" ? "Republican winner" : "Democratic winner"}</span>
        </div>
      )}
    </section>
  );
}
