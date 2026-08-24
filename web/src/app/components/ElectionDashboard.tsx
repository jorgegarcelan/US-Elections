"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import Papa from "papaparse";
import AnimatedNumber from "./AnimatedNumber";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CountyData {
  county_fips: string;
  county: string;
  state: string;
  votes_gop: number;
  votes_dem: number;
  total_votes: number;
  per_gop: number;
  per_dem: number;
  winner: string;
  delta_per_gop: number;
  median_income: number;
  bachelors_rate: number;
  pop_total: number;
  median_age: number;
  unemployment_rate: number;
  latitude: number;
  longitude: number;
  isPrediction?: boolean;
  isStateView?: boolean;
}

interface SeatRow {
  state: string;
  state_code: string;
  ElectoralVotes2024: number;
}

interface Tooltip {
  x: number;
  y: number;
  d: CountyData;
}

interface PredCounty {
  fips: string;
  county: string;
  state: string;
  per_dem: number;
  per_gop: number;
  winner: string;
  delta_dem: number;
  delta_gop: number;
  latitude: number;
  longitude: number;
}

interface PredState {
  state: string;
  state_code: string;
  per_dem: number;
  per_gop: number;
  winner: string;
  electoral_votes: number;
  status: string;
  assumption?: boolean;
  gop_win_prob?: number;
}

export interface PredResult {
  counties: PredCounty[];
  states: PredState[];
  electoral: { dem: number; gop: number; unallocated?: number; winner: string };
  simulation: {
    n_sim: number;
    model: string;
    dem_win_prob: number;
    gop_win_prob: number;
    dem_ev_mean: number;
    gop_ev_mean: number;
    dem_ev_std: number;
    gop_ev_std: number;
    dem_ev_p05: number;
    dem_ev_p50: number;
    dem_ev_p95: number;
    gop_ev_p05: number;
    gop_ev_p50: number;
    gop_ev_p95: number;
    ev_distribution: { gop_ev: number; dem_ev: number; count: number; probability: number }[];
    seed?: number | null;
    dem_popular_share: number;
    gop_popular_share: number;
  };
}

type Year = "2016" | "2020" | "2024" | "predict";
type MapMode = "winner" | "margin" | "shift";
type PredModel = "xgboost" | "random_forest" | "ridge";
type GeoLevel = "county" | "state";

const MATCHUP: Record<string, string> = {
  "2016": "CLINTON VS. TRUMP",
  "2020": "BIDEN VS. TRUMP",
  "2024": "HARRIS VS. TRUMP",
  "predict": "ML PREDICTION · 2024",
};

const PREV_YEAR: Record<string, string> = {
  "2016": "2012",
  "2020": "2016",
  "2024": "2020",
  "predict": "2020",
};

// ── Color helpers ──────────────────────────────────────────────────────────────

function winnerFill(winner: string) {
  return winner === "gop" ? "#D71921" : "#5B9BF6";
}

function marginFill(pg: number, pd: number) {
  const m = pg - pd;
  if (m > 0.40) return "#D71921";
  if (m > 0.20) return "rgba(215,25,33,0.70)";
  if (m > 0.05) return "rgba(215,25,33,0.40)";
  if (m > 0.01) return "rgba(215,25,33,0.20)";
  if (m > -0.01) return "#2A2A2A";
  if (m > -0.05) return "rgba(91,155,246,0.20)";
  if (m > -0.20) return "rgba(91,155,246,0.40)";
  if (m > -0.40) return "rgba(91,155,246,0.70)";
  return "#5B9BF6";
}

function shiftFill(delta: number) {
  // Delta columns are stored as percentage points, not 0—1 proportions.
  if (delta > 12) return "#D71921";
  if (delta > 6) return "rgba(215,25,33,0.65)";
  if (delta > 2) return "rgba(215,25,33,0.30)";
  if (delta > -2) return "#2A2A2A";
  if (delta > -6) return "rgba(91,155,246,0.30)";
  if (delta > -12) return "rgba(91,155,246,0.65)";
  return "#5B9BF6";
}

function countyFill(d: CountyData, mode: MapMode) {
  if (mode === "winner") return winnerFill(d.winner);
  if (mode === "margin") return marginFill(d.per_gop, d.per_dem);
  return shiftFill(d.delta_per_gop);
}

// ── Formatting ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number, d = 1) => (n * 100).toFixed(d) + "%";
const points = (n: number, d = 1) => Math.abs(n).toFixed(d) + " pp";
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// ── Inline components ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--nd-text-secondary)" }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: "var(--nd-border)", margin: "0 16px" }} />;
}

function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented-control" style={{ display: "flex", border: "1px solid var(--nd-border-visible)", borderRadius: 4, overflow: "hidden" }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            padding: "6px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            border: "none",
            borderRight: i < options.length - 1 ? "1px solid var(--nd-border-visible)" : "none",
            backgroundColor: value === opt.value ? "var(--nd-text-display)" : "transparent",
            color: value === opt.value ? "var(--nd-black)" : "var(--nd-text-secondary)",
            transition: "background-color 200ms ease-out, color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── EC Bar ────────────────────────────────────────────────────────────────────

interface StateBlock { state: string; state_code: string; ev: number; winner: "gop" | "dem" | "unknown" }

function ECBar({
  blocks, predResult,
}: {
  blocks: StateBlock[];
  predResult: PredResult | null;
}) {
  const [activeStateCode, setActiveStateCode] = useState<string | null>(null);
  const gopEV = blocks.filter((b) => b.winner === "gop").reduce((s, b) => s + b.ev, 0);
  const demEV = blocks.filter((b) => b.winner === "dem").reduce((s, b) => s + b.ev, 0);
  const total = blocks.reduce((s, b) => s + b.ev, 0) || 538;
  const unallocatedEV = blocks.filter((b) => b.winner === "unknown").reduce((s, b) => s + b.ev, 0);

  const sorted = [
    ...blocks.filter((b) => b.winner === "gop").sort((a, b) => b.ev - a.ev),
    ...blocks.filter((b) => b.winner !== "gop").sort((a, b) => a.ev - b.ev),
  ];
  let allocatedEV = 0;
  const positionedBlocks = sorted.map((block) => {
    const position = ((allocatedEV + block.ev / 2) / total) * 100;
    allocatedEV += block.ev;
    return { ...block, position };
  });
  const activeBlock = positionedBlocks.find((block) => block.state_code === activeStateCode);
  const winnerLabel = (winner: StateBlock["winner"]) =>
    winner === "gop" ? "Republican" : winner === "dem" ? "Democrat" : "Unallocated";

  return (
    <div className="ec-bar" style={{ backgroundColor: "var(--nd-surface)", borderBottom: "1px solid var(--nd-border)", padding: "20px 24px 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
        {/* GOP */}
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, color: "#D71921", letterSpacing: "-0.02em" }}>
            <AnimatedNumber value={gopEV} />
          </div>
          <Label>Republican</Label>
        </div>

        {/* Centre */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--nd-text-disabled)", textTransform: "uppercase" }}>
            270 to win
          </div>
          {unallocatedEV > 0 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--nd-text-secondary)", textTransform: "uppercase", marginTop: 3 }}>
              {unallocatedEV} unallocated
            </div>
          )}
          {gopEV >= 270 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: "#D71921", textTransform: "uppercase", marginTop: 2 }}>[ R WINS ]</div>}
          {demEV >= 270 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: "#5B9BF6", textTransform: "uppercase", marginTop: 2 }}>[ D WINS ]</div>}
          {/* Win probability when in predict mode */}
          {predResult && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#D71921", letterSpacing: "0.06em" }}>
                R {(predResult.simulation.gop_win_prob * 100).toFixed(0)}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#5B9BF6", letterSpacing: "0.06em" }}>
                D {(predResult.simulation.dem_win_prob * 100).toFixed(0)}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nd-text-disabled)", letterSpacing: "0.06em", marginTop: 2 }}>
                WIN PROB · {predResult.simulation.n_sim} SIMS
              </div>
            </div>
          )}
        </div>

        {/* DEM */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, color: "#5B9BF6", letterSpacing: "-0.02em" }}>
            <AnimatedNumber value={demEV} />
          </div>
          <Label>Democrat</Label>
        </div>
      </div>

      {/* State blocks */}
      <div key={`${gopEV}-${demEV}-${unallocatedEV}`} style={{ display: "flex", height: 20, gap: 2, position: "relative" }}>
        {positionedBlocks.map((b, index) => (
          <div
            key={b.state_code}
            className="ec-state-block"
            tabIndex={0}
            aria-label={`${b.state}, ${b.ev} electoral votes, ${winnerLabel(b.winner)}`}
            aria-describedby={activeStateCode === b.state_code ? "electoral-state-tooltip" : undefined}
            onMouseEnter={() => setActiveStateCode(b.state_code)}
            onMouseLeave={() => setActiveStateCode(null)}
            onFocus={() => setActiveStateCode(b.state_code)}
            onBlur={() => setActiveStateCode(null)}
            style={{
              "--box-index": index,
              flex: b.ev,
              backgroundColor: b.winner === "gop" ? "#D71921" : b.winner === "dem" ? "#5B9BF6" : "var(--nd-border-visible)",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "help",
            } as React.CSSProperties}
          >
            {b.ev >= 10 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.04em", color: b.winner === "gop" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)", userSelect: "none", textTransform: "uppercase" }}>
                {b.state_code}
              </span>
            )}
          </div>
        ))}
        {activeBlock && (
          <div
            id="electoral-state-tooltip"
            className={`ec-state-tooltip is-${activeBlock.winner}`}
            role="tooltip"
            style={{ "--tooltip-position": `${activeBlock.position}%` } as React.CSSProperties}
          >
            <span className="ec-tooltip-code">{activeBlock.state_code}</span>
            <strong>{activeBlock.state}</strong>
            <span className="ec-tooltip-detail">
              <span>{activeBlock.ev} electoral votes</span>
              <span aria-hidden="true">·</span>
              <span className="ec-tooltip-party">{winnerLabel(activeBlock.winner)}</span>
            </span>
          </div>
        )}
        <div style={{ position: "absolute", left: `${(270 / total) * 100}%`, top: -4, bottom: -4, width: 1, backgroundColor: "var(--nd-text-disabled)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ── Sidebar components ─────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0" }}>
      <Label>{label}</Label>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: color ?? "var(--nd-text-primary)", letterSpacing: "0.02em" }}>{value}</span>
    </div>
  );
}

function VoteBar({ gopPct, demPct }: { gopPct: number; demPct: number }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}><Label>Two-party vote share</Label></div>
      {[{ label: "R", p: gopPct, color: "#D71921" }, { label: "D", p: demPct, color: "#5B9BF6" }].map(({ label, p, color }) => (
        <div key={label} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <Label>{label}</Label>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color, fontWeight: 700 }}>{(p * 100).toFixed(1)}%</span>
          </div>
          <div style={{ height: 4, backgroundColor: "var(--nd-border-visible)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${p * 100}%`, backgroundColor: color, transition: "width 400ms cubic-bezier(0.25,0.1,0.25,1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legends ────────────────────────────────────────────────────────────────────

const LEGENDS: Record<MapMode, { color: string; label: string }[]> = {
  winner:  [{ color: "#D71921", label: "Republican" }, { color: "#5B9BF6", label: "Democrat" }],
  margin:  [{ color: "#D71921", label: "R +40%" }, { color: "rgba(215,25,33,0.40)", label: "R +10%" }, { color: "rgba(215,25,33,0.20)", label: "R +1%" }, { color: "#2A2A2A", label: "Toss-up" }, { color: "rgba(91,155,246,0.20)", label: "D +1%" }, { color: "rgba(91,155,246,0.40)", label: "D +10%" }, { color: "#5B9BF6", label: "D +40%" }],
  shift:   [{ color: "#D71921", label: "→ R swing +12 pp" }, { color: "rgba(215,25,33,0.40)", label: "→ R swing +3 pp" }, { color: "#2A2A2A", label: "No shift" }, { color: "rgba(91,155,246,0.40)", label: "← D swing +3 pp" }, { color: "#5B9BF6", label: "← D swing +12 pp" }],
};

// ── Main ───────────────────────────────────────────────────────────────────────

interface ElectionDashboardProps {
  initialYear?: Year;
  predictionOnly?: boolean;
  defaultModel?: PredModel;
  defaultNSim?: number;
  autoRun?: boolean;
  historicalOnly?: boolean;
  predictionSeed?: number;
  onPredictionComplete?: (result: PredResult) => void;
  lockPredictionConfig?: boolean;
}

export default function ElectionDashboard({
  initialYear = "2024",
  predictionOnly = false,
  defaultModel = "ridge",
  defaultNSim = 200,
  autoRun = false,
  historicalOnly = false,
  predictionSeed,
  onPredictionComplete,
  lockPredictionConfig = false,
}: ElectionDashboardProps) {
  const [year, setYear]           = useState<Year>(initialYear);
  const [mode, setMode]           = useState<MapMode>("winner");
  const [geoLevel, setGeoLevel]   = useState<GeoLevel>("county");
  const [countyMap, setCountyMap] = useState<Record<string, CountyData>>({});
  const [geoData, setGeoData]     = useState<object | null>(null);
  const [seats, setSeats]         = useState<SeatRow[]>([]);
  const [tooltip, setTooltip]     = useState<Tooltip | null>(null);
  const [loadedYear, setLoadedYear] = useState<Exclude<Year, "predict"> | null>(null);
  const [search, setSearch]       = useState("");
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // Prediction state
  const [predModel, setPredModel]     = useState<PredModel>(defaultModel);
  const [nSim, setNSim]               = useState(defaultNSim);
  const [predLoading, setPredLoading] = useState(false);
  const [predResult, setPredResult]   = useState<PredResult | null>(null);
  const [predError, setPredError]     = useState<string | null>(null);
  const didAutoRun = useRef(false);

  // Load GeoJSON once
  useEffect(() => {
    fetch("/counties.json").then((r) => r.json()).then(setGeoData);
  }, []);

  // Load seats once
  useEffect(() => {
    fetch("/data/seats.csv").then((r) => r.text()).then((t) => {
      const res = Papa.parse<SeatRow>(t, { header: true, skipEmptyLines: true, dynamicTyping: true });
      setSeats(res.data);
    });
  }, []);

  // Load CSV when year changes (historical only)
  useEffect(() => {
    if (year === "predict") return;
    fetch(`/data/final_data_${year}.csv`).then((r) => r.text()).then((t) => {
      const res = Papa.parse<Record<string, string>>(t, { header: true, skipEmptyLines: true });
      const map: Record<string, CountyData> = {};
      for (const row of res.data) {
        const fips = row.county_fips?.padStart(5, "0");
        if (!fips) continue;
        map[fips] = {
          county_fips: fips, county: row.county, state: row.state,
          votes_gop: parseFloat(row.votes_gop) || 0, votes_dem: parseFloat(row.votes_dem) || 0,
          total_votes: parseFloat(row.total_votes) || 0,
          per_gop: parseFloat(row.per_gop) || 0, per_dem: parseFloat(row.per_dem) || 0,
          winner: row.winner, delta_per_gop: parseFloat(row.delta_per_gop) || 0,
          median_income: parseFloat(row.median_income) || 0, bachelors_rate: parseFloat(row.bachelors_rate) || 0,
          pop_total: parseFloat(row.pop_total) || 0, median_age: parseFloat(row.median_age) || 0,
          unemployment_rate: parseFloat(row.unemployment_rate) || 0,
          latitude: parseFloat(row.latitude) || 0, longitude: parseFloat(row.longitude) || 0,
        };
      }
      setCountyMap(map);
      setLoadedYear(year);
    });
  }, [year]);

  // Prediction results are derived separately so historical data never flashes in prediction mode.
  const predictionCountyMap = useMemo(() => {
    const map: Record<string, CountyData> = {};
    if (!predResult) return map;
    for (const c of predResult.counties) {
      map[c.fips] = {
        county_fips: c.fips, county: c.county, state: c.state,
        votes_gop: 0, votes_dem: 0, total_votes: 0,
        per_gop: c.per_gop, per_dem: c.per_dem, winner: c.winner,
        delta_per_gop: c.delta_gop,
        median_income: 0, bachelors_rate: 0, pop_total: 0, median_age: 0, unemployment_rate: 0,
        latitude: c.latitude, longitude: c.longitude,
        isPrediction: true,
      };
    }
    return map;
  }, [predResult]);

  const activeCountyMap = year === "predict" ? predictionCountyMap : countyMap;

  // Run prediction
  const runPrediction = useCallback(async () => {
    setPredLoading(true);
    setPredError(null);
    try {
      const query = new URLSearchParams({ n_sim: String(nSim), model: predModel });
      if (predictionSeed !== undefined) query.set("seed", String(predictionSeed));
      const res = await fetch(`/api/predict?${query}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data: PredResult = await res.json();
      setPredResult(data);
      onPredictionComplete?.(data);
    } catch (e) {
      setPredError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPredLoading(false);
    }
  }, [predModel, nSim, onPredictionComplete, predictionSeed]);

  useEffect(() => {
    if (!autoRun || didAutoRun.current) return;
    didAutoRun.current = true;
    void runPrediction();
  }, [autoRun, runPrediction]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const counties = useMemo(() => Object.values(activeCountyMap), [activeCountyMap]);

  const stats = useMemo(() => {
    let gopC = 0, demC = 0, gopV = 0, demV = 0;
    for (const c of counties) {
      if (c.winner === "gop") gopC++; else demC++;
      gopV += c.votes_gop; demV += c.votes_dem;
    }
    return { gopC, demC, gopV, demV };
  }, [counties]);

  const stateVotes = useMemo(() => {
    const sv: Record<string, { gop: number; dem: number }> = {};
    for (const c of counties) {
      if (!sv[c.state]) sv[c.state] = { gop: 0, dem: 0 };
      sv[c.state].gop += c.votes_gop; sv[c.state].dem += c.votes_dem;
    }
    return sv;
  }, [counties]);

  const stateViewMap = useMemo(() => {
    const grouped: Record<string, {
      votesGop: number; votesDem: number; totalVotes: number; delta: number; deltaWeight: number;
      perGop: number; perDem: number; count: number; population: number; latitude: number; longitude: number; coordWeight: number;
    }> = {};
    for (const county of counties) {
      const group = grouped[county.state] ??= {
        votesGop: 0, votesDem: 0, totalVotes: 0, delta: 0, deltaWeight: 0,
        perGop: 0, perDem: 0, count: 0, population: 0, latitude: 0, longitude: 0, coordWeight: 0,
      };
      const deltaWeight = county.total_votes || county.pop_total || 1;
      const coordWeight = county.pop_total || 1;
      group.votesGop += county.votes_gop;
      group.votesDem += county.votes_dem;
      group.totalVotes += county.total_votes;
      group.delta += county.delta_per_gop * deltaWeight;
      group.deltaWeight += deltaWeight;
      group.perGop += county.per_gop;
      group.perDem += county.per_dem;
      group.count += 1;
      group.population += county.pop_total;
      group.latitude += county.latitude * coordWeight;
      group.longitude += county.longitude * coordWeight;
      group.coordWeight += coordWeight;
    }

    const result: Record<string, CountyData> = {};
    for (const [stateName, group] of Object.entries(grouped)) {
      const predicted = predResult?.states.find((state) => state.state === stateName);
      const voteTotal = group.votesGop + group.votesDem;
      const perGop = predicted?.per_gop ?? (voteTotal > 0 ? group.votesGop / voteTotal : group.perGop / group.count);
      const perDem = predicted?.per_dem ?? (voteTotal > 0 ? group.votesDem / voteTotal : group.perDem / group.count);
      result[stateName] = {
        county_fips: `state-${stateName}`,
        county: stateName,
        state: stateName,
        votes_gop: group.votesGop,
        votes_dem: group.votesDem,
        total_votes: group.totalVotes,
        per_gop: perGop,
        per_dem: perDem,
        winner: predicted?.winner ?? (perGop > perDem ? "gop" : "dem"),
        delta_per_gop: group.delta / Math.max(group.deltaWeight, 1),
        median_income: 0,
        bachelors_rate: 0,
        pop_total: group.population,
        median_age: 0,
        unemployment_rate: 0,
        latitude: group.latitude / Math.max(group.coordWeight, 1),
        longitude: group.longitude / Math.max(group.coordWeight, 1),
        isPrediction: year === "predict",
        isStateView: true,
      };
    }
    return result;
  }, [counties, predResult, year]);

  const shiftMarkers = useMemo(() => {
    const source = geoLevel === "state" ? Object.values(stateViewMap) : counties;
    const threshold = geoLevel === "state" ? 0.5 : 4;
    return source
      .filter((item) => item.latitude && item.longitude && Math.abs(item.delta_per_gop) >= threshold)
      .sort((a, b) => Math.abs(b.delta_per_gop) - Math.abs(a.delta_per_gop))
      .slice(0, geoLevel === "state" ? 51 : 90);
  }, [counties, geoLevel, stateViewMap]);

  const stateBlocks = useMemo((): StateBlock[] => {
    if (year === "predict" && predResult) {
      return seats.map((seat) => {
        const predicted = predResult.states.find((state) => state.state === seat.state);
        return {
          state: seat.state,
          state_code: seat.state_code,
          ev: seat.ElectoralVotes2024,
          winner: predicted ? predicted.winner as "gop" | "dem" : "unknown",
        };
      });
    }
    return seats.map((s) => {
      const sv = stateVotes[s.state];
      const winner: "gop" | "dem" | "unknown" = s.state === "Alaska" ? "gop" : sv ? (sv.gop > sv.dem ? "gop" : "dem") : "unknown";
      return { state: s.state, state_code: s.state_code, ev: s.ElectoralVotes2024, winner };
    });
  }, [seats, stateVotes, year, predResult]);

  const swings = useMemo(() => {
    return [...counties].filter((c) => Math.abs(c.delta_per_gop) > 0.005)
      .sort((a, b) => Math.abs(b.delta_per_gop) - Math.abs(a.delta_per_gop)).slice(0, 7);
  }, [counties]);

  const searchFips = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const s = new Set<string>();
    for (const c of counties) {
      if (c.county.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)) s.add(c.county_fips);
    }
    return s;
  }, [search, counties]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return counties.filter((c) => c.county.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 5);
  }, [search, counties]);

  const stateDetail = useMemo(() => {
    if (!hoveredState) return null;
    if (year === "predict" && predResult) {
      const s = predResult.states.find((st) => st.state === hoveredState);
      if (!s) return null;
      const stateCts = counties.filter((c) => c.state === hoveredState);
      return {
        name: hoveredState, gopPct: s.per_gop, demPct: s.per_dem,
        gopCts: stateCts.filter((c) => c.winner === "gop").length,
        demCts: stateCts.filter((c) => c.winner === "dem").length,
        winner: s.winner, status: s.status,
      };
    }
    const sv = stateVotes[hoveredState];
    if (!sv) return null;
    const total = sv.gop + sv.dem;
    const stateCts = counties.filter((c) => c.state === hoveredState);
    return {
      name: hoveredState, gopPct: sv.gop / total, demPct: sv.dem / total,
      gopCts: stateCts.filter((c) => c.winner === "gop").length,
      demCts: stateCts.filter((c) => c.winner === "dem").length,
      winner: sv.gop > sv.dem ? "gop" : "dem", status: undefined,
    };
  }, [hoveredState, stateVotes, counties, year, predResult]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleEnter = useCallback(
    (geo: { properties: { STATE: string; COUNTY: string } }, evt: React.MouseEvent) => {
      const fips = geo.properties.STATE + geo.properties.COUNTY;
      const county = activeCountyMap[fips];
      const d = geoLevel === "state" && county ? stateViewMap[county.state] : county;
      if (d) { setTooltip({ x: evt.clientX, y: evt.clientY, d }); setHoveredState(d.state); }
    },
    [activeCountyMap, geoLevel, stateViewMap]
  );
  const handleMove  = useCallback((evt: React.MouseEvent) => { setTooltip((p) => p && { ...p, x: evt.clientX, y: evt.clientY }); }, []);
  const handleLeave = useCallback(() => { setTooltip(null); setHoveredState(null); }, []);

  const totalVotes = stats.gopV + stats.demV;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="election-dashboard" style={{ display: "flex", flexDirection: "column", height: "calc(100svh - 72px)", overflow: "hidden", backgroundColor: "var(--nd-black)", fontFamily: "var(--font-sans)" }}>

      {/* ── Header ── */}
      <header className="dashboard-toolbar" style={{ backgroundColor: "var(--nd-surface)", borderBottom: "1px solid var(--nd-border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--nd-accent)", flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--nd-text-display)", letterSpacing: "-0.01em" }}>
              U.S. Presidential Elections
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nd-text-disabled)", marginTop: 2 }}>
              {MATCHUP[year]} · County Level
            </div>
          </div>
        </div>

        <div className="dashboard-controls" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Predict controls */}
          {year === "predict" && !lockPredictionConfig && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Model selector */}
              <SegmentedControl<PredModel>
                options={[
                  { value: "xgboost",       label: "XGBoost" },
                  { value: "random_forest", label: "RF" },
                  { value: "ridge",         label: "Ridge" },
                ]}
                value={predModel}
                onChange={setPredModel}
              />
              {/* N simulations */}
              <select
                aria-label="Number of Monte Carlo simulations"
                value={nSim}
                onChange={(e) => setNSim(Number(e.target.value))}
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid var(--nd-border-visible)",
                  borderRadius: 4,
                  color: "var(--nd-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  padding: "6px 10px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {[50, 100, 200, 500, 1000].map((n) => (
                  <option key={n} value={n} style={{ backgroundColor: "var(--nd-surface)" }}>
                    {n} SIMS
                  </option>
                ))}
              </select>
              {/* Run button */}
              <button
                onClick={runPrediction}
                disabled={predLoading}
                style={{
                  padding: "6px 18px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: predLoading ? "default" : "pointer",
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: predLoading ? "var(--nd-border-visible)" : "var(--nd-accent)",
                  color: predLoading ? "var(--nd-text-disabled)" : "#FFFFFF",
                  transition: "background-color 200ms ease-out",
                }}
              >
                {predLoading ? "[ Running... ]" : "[ Run ]"}
              </button>
            </div>
          )}

          {/* Geography level */}
          <SegmentedControl<GeoLevel>
            options={[
              { value: "county", label: "County" },
              { value: "state", label: "State" },
            ]}
            value={geoLevel}
            onChange={setGeoLevel}
          />

          {/* Year selector */}
          {!predictionOnly && (
            <SegmentedControl<Year>
              options={[
                { value: "2016",    label: "2016" },
                { value: "2020",    label: "2020" },
                { value: "2024",    label: "2024" },
                ...(!historicalOnly ? [{ value: "predict" as Year, label: "Predict" }] : []),
              ]}
              value={year}
              onChange={setYear}
            />
          )}

          {/* Map mode */}
          <SegmentedControl<MapMode>
            options={[
              { value: "winner", label: "Winner" },
              { value: "margin", label: "Margin" },
              { value: "shift",  label: "Shift"  },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      </header>

      {/* ── EC Bar ── */}
      <ECBar blocks={stateBlocks} predResult={year === "predict" ? predResult : null} />

      {/* ── Body ── */}
      <div className="dashboard-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Map */}
        <div
          className="dashboard-map"
          style={{ flex: 1, position: "relative", backgroundColor: "var(--nd-black)" }}
          onMouseMove={handleMove}
        >
          {/* Loading / empty states */}
          {((year !== "predict" && loadedYear !== year) || predLoading) && (
            <div role="status" aria-live="polite" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nd-text-secondary)" }}>
                {predLoading ? "[ Simulating... ]" : "[ Loading... ]"}
              </span>
            </div>
          )}

          {year === "predict" && !predResult && !predLoading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 5 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nd-text-disabled)" }}>
                Select model and run simulation
              </div>
              {predError && (
                <div role="alert" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nd-accent)", letterSpacing: "0.06em" }}>
                  [ {predError} ] — The prediction service may be offline.
                </div>
              )}
            </div>
          )}

          {geoData && (
            <ComposableMap
              role="img"
              aria-label={`County-level election map for ${year === "predict" ? "the current prediction" : year}`}
              projection="geoAlbersUsa"
              style={{ width: "100%", height: "100%" }}
              projectionConfig={{ scale: 1050 }}
            >
              <ZoomableGroup zoom={1}>
                <Geographies geography={geoData}>
                  {({ geographies }: { geographies: Array<{ rsmKey: string; properties: { STATE: string; COUNTY: string } }> }) =>
                    geographies.map((geo) => {
                      const fips = geo.properties.STATE + geo.properties.COUNTY;
                      const county = activeCountyMap[fips];
                      const d = geoLevel === "state" && county ? stateViewMap[county.state] : county;
                      const dimmed = searchFips !== null && !searchFips.has(fips);
                      const fill = d ? countyFill(d, mode) : "var(--nd-border-visible)";

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke={geoLevel === "state" ? "rgba(0,0,0,0.16)" : "#000000"}
                          strokeWidth={geoLevel === "state" ? 0.2 : 0.5}
                          opacity={dimmed ? 0.15 : 1}
                          style={{ default: { outline: "none" }, hover: { outline: "none", opacity: 0.85 }, pressed: { outline: "none" } }}
                          onMouseEnter={(evt) => handleEnter(geo, evt as unknown as React.MouseEvent)}
                          onMouseLeave={handleLeave}
                        />
                      );
                    })
                  }
                </Geographies>
                {mode === "shift" && shiftMarkers.map((item) => (
                  <Marker key={item.county_fips} coordinates={[item.longitude, item.latitude]}>
                    <text
                      aria-hidden="true"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      stroke={item.delta_per_gop > 0 ? "#8f0f18" : "#214e9d"}
                      strokeWidth={geoLevel === "state" ? 1.5 : 1}
                      paintOrder="stroke"
                      fontFamily="var(--font-mono)"
                      fontSize={geoLevel === "state" ? 12 : 7}
                      fontWeight={700}
                      style={{ pointerEvents: "none" }}
                    >
                      {item.delta_per_gop > 0 ? "→" : "←"}
                    </text>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          )}

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 16, left: 16, backgroundColor: "var(--nd-surface)", border: "1px solid var(--nd-border-visible)", borderRadius: 4, padding: "10px 14px" }}>
            <div style={{ marginBottom: 8 }}><Label>{mode === "winner" ? "Winner" : mode === "margin" ? "Vote margin" : `Shift vs. ${PREV_YEAR[year]}`}</Label></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {LEGENDS[mode].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 14, height: 10, backgroundColor: color, flexShrink: 0, border: color === "#2A2A2A" ? "1px solid #444" : "none" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-secondary)", letterSpacing: "0.04em" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Predict badge */}
          {year === "predict" && predResult && (
            <div style={{ position: "absolute", bottom: 16, right: 16, backgroundColor: "var(--nd-surface)", border: "1px solid var(--nd-border-visible)", borderRadius: 4, padding: "10px 14px" }}>
              <div style={{ marginBottom: 4 }}><Label>{predResult.simulation.model} · {predResult.simulation.n_sim} sims</Label></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#D71921", letterSpacing: "0.04em" }}>
                R win prob: {(predResult.simulation.gop_win_prob * 100).toFixed(0)}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#5B9BF6", letterSpacing: "0.04em" }}>
                D win prob: {(predResult.simulation.dem_win_prob * 100).toFixed(0)}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-disabled)", letterSpacing: "0.04em", marginTop: 4 }}>
                D EV: {predResult.simulation.dem_ev_mean} ± {predResult.simulation.dem_ev_std}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-disabled)", letterSpacing: "0.04em" }}>
                R EV: {predResult.simulation.gop_ev_mean} ± {predResult.simulation.gop_ev_std}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="dashboard-sidebar" style={{ width: 280, backgroundColor: "var(--nd-surface)", borderLeft: "1px solid var(--nd-border)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 }}>

          {/* Popular vote / prediction stats */}
          <div style={{ padding: "16px 16px 14px" }}>
            {year !== "predict" && totalVotes > 0 ? (
              <>
                <VoteBar gopPct={stats.gopV / totalVotes} demPct={stats.demV / totalVotes} />
                <div style={{ marginTop: 8 }}><StatRow label="Total votes" value={fmt(totalVotes)} /></div>
              </>
            ) : year === "predict" && predResult ? (
              <>
                <div style={{ marginBottom: 8 }}><Label>Predicted popular vote</Label></div>
                <VoteBar gopPct={predResult.simulation.gop_popular_share} demPct={predResult.simulation.dem_popular_share} />
              </>
            ) : (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                { year === "predict" ? "[ Run simulation ]" : "[ Loading... ]"}
              </div>
            )}
          </div>

          <Divider />

          {/* County counts */}
          <div style={{ padding: "12px 16px" }}>
            <StatRow label="R counties" value={fmt(stats.gopC)} color="#D71921" />
            <StatRow label="D counties" value={fmt(stats.demC)} color="#5B9BF6" />
          </div>

          <Divider />

          {/* State detail on hover */}
          {stateDetail ? (
            <>
              <div style={{ padding: "12px 16px 14px", backgroundColor: "var(--nd-surface-raised)" }}>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, color: stateDetail.winner === "gop" ? "#D71921" : "#5B9BF6" }}>
                    {stateDetail.name}
                  </span>
                  {stateDetail.status && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--nd-text-disabled)", textTransform: "uppercase" }}>
                      {stateDetail.status}
                    </span>
                  )}
                </div>
                <StatRow label="R vote"     value={pct(stateDetail.gopPct)} color="#D71921" />
                <StatRow label="D vote"     value={pct(stateDetail.demPct)} color="#5B9BF6" />
                <StatRow label="R counties" value={String(stateDetail.gopCts)} color="#D71921" />
                <StatRow label="D counties" value={String(stateDetail.demCts)} color="#5B9BF6" />
              </div>
              <Divider />
            </>
          ) : (
            <>
              <div style={{ padding: "12px 16px", backgroundColor: "var(--nd-surface-raised)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nd-text-disabled)" }}>
                  [ Hover a county ]
                </span>
              </div>
              <Divider />
            </>
          )}

          {/* Biggest swings */}
          <div style={{ padding: "12px 16px" }}>
            <div style={{ marginBottom: 10 }}>
              <Label>
                {year === "predict" ? "Predicted swings" : "Biggest swings"}
                {" · "}vs. {PREV_YEAR[year]}
              </Label>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {swings.map((c, i) => {
                const toGOP = c.delta_per_gop > 0;
                return (
                  <div key={c.county_fips} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < swings.length - 1 ? "1px solid var(--nd-border)" : "none" }}>
                    <div style={{ width: 3, height: 28, backgroundColor: toGOP ? "#D71921" : "#5B9BF6", flexShrink: 0, borderRadius: 1, marginTop: "5px" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--nd-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.county}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-disabled)", letterSpacing: "0.04em", marginTop: 1 }}>
                        {c.state}
                      </div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: toGOP ? "#D71921" : "#5B9BF6", letterSpacing: "0.02em", flexShrink: 0 }}>
                      {toGOP ? "→ R" : "← D"} {points(c.delta_per_gop)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Divider />

          {/* Search */}
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ marginBottom: 8 }}><Label>Search county</Label></div>
            <input
              aria-label="Search for a county or state"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Maricopa, Arizona…"
              style={{ width: "100%", backgroundColor: "transparent", border: "none", borderBottom: "1px solid var(--nd-border-visible)", color: "var(--nd-text-primary)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 0", outline: "none", letterSpacing: "0.02em" }}
              onFocus={(e) => (e.target.style.borderBottomColor = "var(--nd-text-primary)")}
              onBlur={(e) => (e.target.style.borderBottomColor = "var(--nd-border-visible)")}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {searchResults.map((c, i) => (
                  <div key={c.county_fips} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < searchResults.length - 1 ? "1px solid var(--nd-border)" : "none" }}>
                    <div>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--nd-text-primary)" }}>{c.county}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nd-text-disabled)", marginLeft: 4 }}>{c.state}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: c.winner === "gop" ? "#D71921" : "#5B9BF6", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {c.winner === "gop" ? "R" : "D"} {pct(c.winner === "gop" ? c.per_gop - c.per_dem : c.per_dem - c.per_gop, 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x + 16, top: tooltip.y - 12, backgroundColor: "var(--nd-surface-raised)", border: "1px solid var(--nd-border-visible)", borderRadius: 4, padding: "12px 14px", pointerEvents: "none", zIndex: 50, minWidth: 196 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14, color: "var(--nd-text-display)", marginBottom: 2 }}>
            {tooltip.d.county}
            {tooltip.d.isPrediction && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nd-accent)", letterSpacing: "0.08em", marginLeft: 8, textTransform: "uppercase" }}>PREDICTED</span>
            )}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nd-text-disabled)", marginBottom: 12 }}>
            {tooltip.d.isStateView ? "State result" : tooltip.d.state}
          </div>

          {[{ label: "R", p: tooltip.d.per_gop, color: "#D71921" }, { label: "D", p: tooltip.d.per_dem, color: "#5B9BF6" }].map(({ label, p, color }) => (
            <div key={label} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", color: "var(--nd-text-secondary)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color }}>{(p * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, backgroundColor: "var(--nd-border-visible)", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${p * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}

          {!tooltip.d.isPrediction && !tooltip.d.isStateView && (
            <div style={{ borderTop: "1px solid var(--nd-border)", marginTop: 10, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
              {[
                { label: "Votes",      value: fmt(tooltip.d.total_votes) },
                { label: "Population", value: fmt(tooltip.d.pop_total) },
                { label: "Income",     value: money(tooltip.d.median_income) },
                { label: "College",    value: pct(tooltip.d.bachelors_rate / 100) },
                { label: "Med. Age",   value: String(tooltip.d.median_age) },
                { label: "Unemployed", value: pct(tooltip.d.unemployment_rate / 100) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nd-text-disabled)" }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--nd-text-primary)", marginTop: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {(mode === "shift" || tooltip.d.isPrediction) && (
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: tooltip.d.delta_per_gop > 0 ? "#D71921" : "#5B9BF6", letterSpacing: "0.04em" }}>
              {tooltip.d.delta_per_gop > 0 ? "→ R +" : "← D +"}
              {points(tooltip.d.delta_per_gop)} vs. {PREV_YEAR[year]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
