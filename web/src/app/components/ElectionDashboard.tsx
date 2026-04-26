"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import Papa from "papaparse";

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

type Year = "2016" | "2020" | "2024";
type MapMode = "winner" | "margin" | "shift";

const MATCHUP: Record<Year, string> = {
  "2016": "CLINTON VS. TRUMP",
  "2020": "BIDEN VS. TRUMP",
  "2024": "HARRIS VS. TRUMP",
};

const PREV_YEAR: Record<Year, string> = {
  "2016": "2012",
  "2020": "2016",
  "2024": "2020",
};

// ── Nothing-adapted color helpers ─────────────────────────────────────────────

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
  if (delta > 0.12) return "#D71921";
  if (delta > 0.06) return "rgba(215,25,33,0.65)";
  if (delta > 0.02) return "rgba(215,25,33,0.30)";
  if (delta > -0.02) return "#2A2A2A";
  if (delta > -0.06) return "rgba(91,155,246,0.30)";
  if (delta > -0.12) return "rgba(91,155,246,0.65)";
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
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// ── Inline label component ─────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        color: "var(--nd-text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: "var(--nd-border)",
        margin: "0 16px",
      }}
    />
  );
}

// ── Segmented Control ──────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        border: "1px solid var(--nd-border-visible)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "6px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            border: "none",
            borderRight:
              i < options.length - 1
                ? "1px solid var(--nd-border-visible)"
                : "none",
            backgroundColor:
              value === opt.value
                ? "var(--nd-text-display)"
                : "transparent",
            color:
              value === opt.value
                ? "var(--nd-black)"
                : "var(--nd-text-secondary)",
            transition: "background-color 200ms ease-out, color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── EC State Blocks Bar ────────────────────────────────────────────────────────

interface StateBlock {
  state: string;
  state_code: string;
  ev: number;
  winner: "gop" | "dem" | "unknown";
}

function ECBar({ blocks }: { blocks: StateBlock[] }) {
  const gopEV = blocks
    .filter((b) => b.winner === "gop")
    .reduce((s, b) => s + b.ev, 0);
  const demEV = blocks
    .filter((b) => b.winner === "dem")
    .reduce((s, b) => s + b.ev, 0);
  const total = blocks.reduce((s, b) => s + b.ev, 0) || 538;

  // Sort: GOP states first (largest to smallest), then DEM states (smallest to largest)
  const sorted = [
    ...blocks
      .filter((b) => b.winner === "gop")
      .sort((a, b) => b.ev - a.ev),
    ...blocks
      .filter((b) => b.winner !== "gop")
      .sort((a, b) => a.ev - b.ev),
  ];

  return (
    <div
      style={{
        backgroundColor: "var(--nd-surface)",
        borderBottom: "1px solid var(--nd-border)",
        padding: "20px 24px 16px",
      }}
    >
      {/* Numbers row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1,
              color: "#D71921",
              letterSpacing: "-0.02em",
            }}
          >
            {gopEV}
          </div>
          <Label>Republican</Label>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--nd-text-disabled)",
              textTransform: "uppercase",
            }}
          >
            270 to win
          </div>
          {gopEV >= 270 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "#D71921",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              [ R WINS ]
            </div>
          )}
          {demEV >= 270 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "#5B9BF6",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              [ D WINS ]
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1,
              color: "#5B9BF6",
              letterSpacing: "-0.02em",
            }}
          >
            {demEV}
          </div>
          <Label>Democrat</Label>
        </div>
      </div>

      {/* State block segments — the Nothing segmented bar */}
      <div
        style={{
          display: "flex",
          height: 20,
          gap: 2,
          position: "relative",
        }}
      >
        {sorted.map((b) => (
          <div
            key={b.state_code}
            title={`${b.state} · ${b.ev} EV`}
            style={{
              flex: b.ev,
              backgroundColor:
                b.winner === "gop"
                  ? "#D71921"
                  : b.winner === "dem"
                  ? "#5B9BF6"
                  : "var(--nd-border-visible)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              cursor: "default",
            }}
          >
            {b.ev >= 10 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: "0.04em",
                  color:
                    b.winner === "gop"
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(0,0,0,0.6)",
                  userSelect: "none",
                  textTransform: "uppercase",
                }}
              >
                {b.state_code}
              </span>
            )}
          </div>
        ))}
        {/* 270 marker */}
        <div
          style={{
            position: "absolute",
            left: `${(270 / total) * 100}%`,
            top: -4,
            bottom: -4,
            width: 1,
            backgroundColor: "var(--nd-text-disabled)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Sidebar stat row ────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "8px 0",
      }}
    >
      <Label>{label}</Label>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 700,
          color: color ?? "var(--nd-text-primary)",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Inline vote bar ─────────────────────────────────────────────────────────────

function VoteBar({
  gopPct,
  demPct,
}: {
  gopPct: number;
  demPct: number;
}) {
  return (
    <div>
      <div
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}
      >
        <Label>Popular vote</Label>
      </div>

      {/* GOP bar */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <Label>R</Label>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#D71921",
              fontWeight: 700,
            }}
          >
            {(gopPct * 100).toFixed(1)}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            backgroundColor: "var(--nd-border-visible)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${gopPct * 100}%`,
              backgroundColor: "#D71921",
              transition: "width 400ms cubic-bezier(0.25,0.1,0.25,1)",
            }}
          />
        </div>
      </div>

      {/* DEM bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <Label>D</Label>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#5B9BF6",
              fontWeight: 700,
            }}
          >
            {(demPct * 100).toFixed(1)}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            backgroundColor: "var(--nd-border-visible)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${demPct * 100}%`,
              backgroundColor: "#5B9BF6",
              transition: "width 400ms cubic-bezier(0.25,0.1,0.25,1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

const LEGENDS: Record<MapMode, { color: string; label: string }[]> = {
  winner: [
    { color: "#D71921", label: "Republican" },
    { color: "#5B9BF6", label: "Democrat" },
  ],
  margin: [
    { color: "#D71921", label: "R +40%" },
    { color: "rgba(215,25,33,0.40)", label: "R +10%" },
    { color: "rgba(215,25,33,0.20)", label: "R +1%" },
    { color: "#2A2A2A", label: "Toss-up" },
    { color: "rgba(91,155,246,0.20)", label: "D +1%" },
    { color: "rgba(91,155,246,0.40)", label: "D +10%" },
    { color: "#5B9BF6", label: "D +40%" },
  ],
  shift: [
    { color: "#D71921", label: "R swing +12%" },
    { color: "rgba(215,25,33,0.40)", label: "R swing +3%" },
    { color: "#2A2A2A", label: "No shift" },
    { color: "rgba(91,155,246,0.40)", label: "D swing +3%" },
    { color: "#5B9BF6", label: "D swing +12%" },
  ],
};

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ElectionDashboard() {
  const [year, setYear] = useState<Year>("2024");
  const [mode, setMode] = useState<MapMode>("winner");
  const [countyMap, setCountyMap] = useState<Record<string, CountyData>>({});
  const [geoData, setGeoData] = useState<object | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // Load GeoJSON once
  useEffect(() => {
    fetch("/counties.json").then((r) => r.json()).then(setGeoData);
  }, []);

  // Load seats once
  useEffect(() => {
    fetch("/data/seats.csv")
      .then((r) => r.text())
      .then((t) => {
        const res = Papa.parse<SeatRow>(t, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });
        setSeats(res.data);
      });
  }, []);

  // Load CSV per year
  useEffect(() => {
    setLoading(true);
    fetch(`/data/final_data_${year}.csv`)
      .then((r) => r.text())
      .then((t) => {
        const res = Papa.parse<Record<string, string>>(t, {
          header: true,
          skipEmptyLines: true,
        });
        const map: Record<string, CountyData> = {};
        for (const row of res.data) {
          const fips = row.county_fips?.padStart(5, "0");
          if (!fips) continue;
          map[fips] = {
            county_fips: fips,
            county: row.county,
            state: row.state,
            votes_gop: parseFloat(row.votes_gop) || 0,
            votes_dem: parseFloat(row.votes_dem) || 0,
            total_votes: parseFloat(row.total_votes) || 0,
            per_gop: parseFloat(row.per_gop) || 0,
            per_dem: parseFloat(row.per_dem) || 0,
            winner: row.winner,
            delta_per_gop: parseFloat(row.delta_per_gop) || 0,
            median_income: parseFloat(row.median_income) || 0,
            bachelors_rate: parseFloat(row.bachelors_rate) || 0,
            pop_total: parseFloat(row.pop_total) || 0,
            median_age: parseFloat(row.median_age) || 0,
            unemployment_rate: parseFloat(row.unemployment_rate) || 0,
          };
        }
        setCountyMap(map);
        setLoading(false);
      });
  }, [year]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const counties = useMemo(() => Object.values(countyMap), [countyMap]);

  const stats = useMemo(() => {
    let gopC = 0, demC = 0, gopV = 0, demV = 0;
    for (const c of counties) {
      if (c.winner === "gop") gopC++;
      else demC++;
      gopV += c.votes_gop;
      demV += c.votes_dem;
    }
    return { gopC, demC, gopV, demV };
  }, [counties]);

  // Per-state votes
  const stateVotes = useMemo(() => {
    const sv: Record<string, { gop: number; dem: number }> = {};
    for (const c of counties) {
      if (!sv[c.state]) sv[c.state] = { gop: 0, dem: 0 };
      sv[c.state].gop += c.votes_gop;
      sv[c.state].dem += c.votes_dem;
    }
    return sv;
  }, [counties]);

  // State blocks for EC bar
  const stateBlocks = useMemo((): StateBlock[] => {
    return seats.map((s) => {
      const sv = stateVotes[s.state];
      const winner: "gop" | "dem" | "unknown" = sv
        ? sv.gop > sv.dem
          ? "gop"
          : "dem"
        : "unknown";
      return {
        state: s.state,
        state_code: s.state_code,
        ev: s.ElectoralVotes2024,
        winner,
      };
    });
  }, [seats, stateVotes]);

  // Biggest swings
  const swings = useMemo(() => {
    return [...counties]
      .filter((c) => Math.abs(c.delta_per_gop) > 0.005)
      .sort((a, b) => Math.abs(b.delta_per_gop) - Math.abs(a.delta_per_gop))
      .slice(0, 7);
  }, [counties]);

  // Search highlight
  const searchFips = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const s = new Set<string>();
    for (const c of counties) {
      if (c.county.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
        s.add(c.county_fips);
    }
    return s;
  }, [search, counties]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return counties
      .filter((c) => c.county.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
      .slice(0, 5);
  }, [search, counties]);

  // Hovered state stats
  const stateDetail = useMemo(() => {
    if (!hoveredState) return null;
    const sv = stateVotes[hoveredState];
    if (!sv) return null;
    const total = sv.gop + sv.dem;
    const stateCts = counties.filter((c) => c.state === hoveredState);
    return {
      name: hoveredState,
      gopPct: sv.gop / total,
      demPct: sv.dem / total,
      gopCts: stateCts.filter((c) => c.winner === "gop").length,
      demCts: stateCts.filter((c) => c.winner === "dem").length,
      winner: sv.gop > sv.dem ? "gop" : "dem",
    };
  }, [hoveredState, stateVotes, counties]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleEnter = useCallback(
    (geo: { properties: { STATE: string; COUNTY: string } }, evt: React.MouseEvent) => {
      const fips = geo.properties.STATE + geo.properties.COUNTY;
      const d = countyMap[fips];
      if (d) {
        setTooltip({ x: evt.clientX, y: evt.clientY, d });
        setHoveredState(d.state);
      }
    },
    [countyMap]
  );

  const handleMove = useCallback((evt: React.MouseEvent) => {
    setTooltip((p) => p && { ...p, x: evt.clientX, y: evt.clientY });
  }, []);

  const handleLeave = useCallback(() => {
    setTooltip(null);
    setHoveredState(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalVotes = stats.gopV + stats.demV;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "var(--nd-black)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          backgroundColor: "var(--nd-surface)",
          borderBottom: "1px solid var(--nd-border)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Nothing-style signal dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--nd-accent)",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--nd-text-display)",
                letterSpacing: "-0.01em",
              }}
            >
              U.S. Presidential Elections
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--nd-text-disabled)",
                marginTop: 2,
              }}
            >
              {MATCHUP[year]} · County Level
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SegmentedControl<Year>
            options={[
              { value: "2016", label: "2016" },
              { value: "2020", label: "2020" },
              { value: "2024", label: "2024" },
            ]}
            value={year}
            onChange={setYear}
          />
          <SegmentedControl<MapMode>
            options={[
              { value: "winner", label: "Winner" },
              { value: "margin", label: "Margin" },
              { value: "shift", label: "Shift" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      </header>

      {/* ── Electoral College ── */}
      <ECBar blocks={stateBlocks} />

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Map */}
        <div
          style={{
            flex: 1,
            position: "relative",
            backgroundColor: "var(--nd-black)",
          }}
          onMouseMove={handleMove}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--nd-text-secondary)",
                }}
              >
                [ LOADING... ]
              </span>
            </div>
          )}

          {geoData && (
            <ComposableMap
              projection="geoAlbersUsa"
              style={{ width: "100%", height: "100%" }}
              projectionConfig={{ scale: 1050 }}
            >
              <ZoomableGroup zoom={1}>
                <Geographies geography={geoData}>
                  {({
                    geographies,
                  }: {
                    geographies: Array<{
                      rsmKey: string;
                      properties: { STATE: string; COUNTY: string };
                    }>;
                  }) =>
                    geographies.map((geo) => {
                      const fips = geo.properties.STATE + geo.properties.COUNTY;
                      const d = countyMap[fips];

                      const dimmed =
                        searchFips !== null && !searchFips.has(fips);

                      const fill = d
                        ? countyFill(d, mode)
                        : "var(--nd-border-visible)";

                      const isHoveredState = d?.state === hoveredState;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#000000"
                          strokeWidth={0.5}
                          opacity={dimmed ? 0.15 : 1}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              outline: isHoveredState
                                ? "none"
                                : "1px solid rgba(255,255,255,0.4)",
                              opacity: 0.85,
                            },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={(evt) =>
                            handleEnter(
                              geo,
                              evt as unknown as React.MouseEvent
                            )
                          }
                          onMouseLeave={handleLeave}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          )}

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              backgroundColor: "var(--nd-surface)",
              border: "1px solid var(--nd-border-visible)",
              borderRadius: 4,
              padding: "10px 14px",
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <Label>
                {mode === "winner"
                  ? "Winner"
                  : mode === "margin"
                  ? "Vote margin"
                  : `Shift vs. ${PREV_YEAR[year]}`}
              </Label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {LEGENDS[mode].map(({ color, label }) => (
                <div
                  key={label}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 10,
                      backgroundColor: color,
                      flexShrink: 0,
                      border: color === "#2A2A2A" ? "1px solid #444" : "none",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--nd-text-secondary)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside
          style={{
            width: 256,
            backgroundColor: "var(--nd-surface)",
            borderLeft: "1px solid var(--nd-border)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {/* Popular vote */}
          <div style={{ padding: "16px 16px 14px" }}>
            <VoteBar
              gopPct={totalVotes ? stats.gopV / totalVotes : 0}
              demPct={totalVotes ? stats.demV / totalVotes : 0}
            />
            <div style={{ marginTop: 8 }}>
              <StatRow
                label="Total votes"
                value={fmt(totalVotes)}
              />
            </div>
          </div>

          <Divider />

          {/* Counties */}
          <div style={{ padding: "12px 16px" }}>
            <StatRow label="R counties" value={fmt(stats.gopC)} color="#D71921" />
            <StatRow label="D counties" value={fmt(stats.demC)} color="#5B9BF6" />
          </div>

          <Divider />

          {/* Hovered state detail */}
          {stateDetail ? (
            <>
              <div
                style={{
                  padding: "12px 16px 14px",
                  backgroundColor: "var(--nd-surface-raised)",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 700,
                      fontSize: 13,
                      color:
                        stateDetail.winner === "gop"
                          ? "#D71921"
                          : "#5B9BF6",
                    }}
                  >
                    {stateDetail.name}
                  </span>
                </div>
                <StatRow
                  label="R vote"
                  value={pct(stateDetail.gopPct)}
                  color="#D71921"
                />
                <StatRow
                  label="D vote"
                  value={pct(stateDetail.demPct)}
                  color="#5B9BF6"
                />
                <StatRow
                  label="R counties"
                  value={String(stateDetail.gopCts)}
                  color="#D71921"
                />
                <StatRow
                  label="D counties"
                  value={String(stateDetail.demCts)}
                  color="#5B9BF6"
                />
              </div>
              <Divider />
            </>
          ) : (
            <>
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "var(--nd-surface-raised)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--nd-text-disabled)",
                  }}
                >
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
                Biggest swings
                {" · "}
                vs. {PREV_YEAR[year]}
              </Label>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {swings.map((c, i) => {
                const toGOP = c.delta_per_gop > 0;
                return (
                  <div
                    key={c.county_fips}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 0",
                      borderBottom:
                        i < swings.length - 1
                          ? "1px solid var(--nd-border)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 28,
                        backgroundColor: toGOP ? "#D71921" : "#5B9BF6",
                        flexShrink: 0,
                        borderRadius: 1,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--nd-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.county}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--nd-text-disabled)",
                          letterSpacing: "0.04em",
                          marginTop: 1,
                        }}
                      >
                        {c.state}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: toGOP ? "#D71921" : "#5B9BF6",
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                      }}
                    >
                      {toGOP ? "▲R" : "▼D"} {pct(Math.abs(c.delta_per_gop), 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Divider />

          {/* Search */}
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ marginBottom: 8 }}>
              <Label>Search county</Label>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Maricopa, Arizona…"
              style={{
                width: "100%",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: "1px solid var(--nd-border-visible)",
                color: "var(--nd-text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                padding: "6px 0",
                outline: "none",
                letterSpacing: "0.02em",
              }}
              onFocus={(e) =>
                (e.target.style.borderBottomColor = "var(--nd-text-primary)")
              }
              onBlur={(e) =>
                (e.target.style.borderBottomColor = "var(--nd-border-visible)")
              }
            />

            {searchResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {searchResults.map((c, i) => (
                  <div
                    key={c.county_fips}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom:
                        i < searchResults.length - 1
                          ? "1px solid var(--nd-border)"
                          : "none",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 12,
                          color: "var(--nd-text-primary)",
                        }}
                      >
                        {c.county}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--nd-text-disabled)",
                          marginLeft: 4,
                        }}
                      >
                        {c.state}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: c.winner === "gop" ? "#D71921" : "#5B9BF6",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {c.winner === "gop" ? "R" : "D"}
                      {" "}
                      {pct(
                        c.winner === "gop"
                          ? c.per_gop - c.per_dem
                          : c.per_dem - c.per_gop,
                        0
                      )}
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
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 16,
            top: tooltip.y - 12,
            backgroundColor: "var(--nd-surface-raised)",
            border: "1px solid var(--nd-border-visible)",
            borderRadius: 4,
            padding: "12px 14px",
            pointerEvents: "none",
            zIndex: 50,
            minWidth: 196,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--nd-text-display)",
              marginBottom: 2,
            }}
          >
            {tooltip.d.county}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--nd-text-disabled)",
              marginBottom: 12,
            }}
          >
            {tooltip.d.state}
          </div>

          {/* Vote bars */}
          {[
            {
              label: "R",
              pct: tooltip.d.per_gop,
              color: "#D71921",
            },
            {
              label: "D",
              pct: tooltip.d.per_dem,
              color: "#5B9BF6",
            },
          ].map(({ label, pct: p, color }) => (
            <div key={label} style={{ marginBottom: 6 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    color: "var(--nd-text-secondary)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color,
                  }}
                >
                  {(p * 100).toFixed(1)}%
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  backgroundColor: "var(--nd-border-visible)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${p * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          ))}

          {/* Demographics */}
          <div
            style={{
              borderTop: "1px solid var(--nd-border)",
              marginTop: 10,
              paddingTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 12px",
            }}
          >
            {[
              { label: "Votes", value: fmt(tooltip.d.total_votes) },
              { label: "Population", value: fmt(tooltip.d.pop_total) },
              { label: "Income", value: money(tooltip.d.median_income) },
              {
                label: "College",
                value: pct(tooltip.d.bachelors_rate / 100),
              },
              { label: "Med. Age", value: String(tooltip.d.median_age) },
              {
                label: "Unemployed",
                value: pct(tooltip.d.unemployment_rate / 100),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--nd-text-disabled)",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--nd-text-primary)",
                    marginTop: 1,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {mode === "shift" && (
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                color:
                  tooltip.d.delta_per_gop > 0 ? "#D71921" : "#5B9BF6",
                letterSpacing: "0.04em",
              }}
            >
              {tooltip.d.delta_per_gop > 0 ? "▲ R +" : "▼ D +"}
              {pct(Math.abs(tooltip.d.delta_per_gop))} vs. {PREV_YEAR[year]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
