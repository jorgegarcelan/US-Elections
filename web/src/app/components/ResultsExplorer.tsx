"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type ResultLevel = "state" | "county";
type ResultYear = "2016" | "2020" | "2024";

interface ResultRow {
  id: string;
  place: string;
  state?: string;
  votesGop: number;
  votesDem: number;
  totalVotes: number;
  perGop: number;
  perDem: number;
  winner: "gop" | "dem";
  electoralVotes?: number;
  assumption?: boolean;
}

interface SeatRow {
  state: string;
  ElectoralVotes2024: number;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const fmt = (value: number) => value ? Math.round(value).toLocaleString("en-US") : "—";
const OFFICIAL_EV: Record<ResultYear, { gop: number; dem: number }> = {
  "2016": { gop: 306, dem: 232 },
  "2020": { gop: 232, dem: 306 },
  "2024": { gop: 312, dem: 226 },
};

export default function ResultsExplorer() {
  const [year, setYear] = useState<ResultYear>("2024");
  const [level, setLevel] = useState<ResultLevel>("state");
  const [countyRows, setCountyRows] = useState<ResultRow[]>([]);
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"closest" | "largest">("closest");

  useEffect(() => {
    fetch("/data/seats.csv").then((response) => response.text()).then((csv) => {
      const parsed = Papa.parse<SeatRow>(csv, { header: true, skipEmptyLines: true, dynamicTyping: true });
      setSeats(Object.fromEntries(parsed.data.map((row) => [row.state, row.ElectoralVotes2024])));
    });
  }, []);

  useEffect(() => {
    fetch(`/data/final_data_${year}.csv`).then((response) => response.text()).then((csv) => {
      const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
      setCountyRows(parsed.data.map((row) => {
        const votesGop = Number(row.votes_gop) || 0;
        const votesDem = Number(row.votes_dem) || 0;
        const totalVotes = Number(row.total_votes) || votesGop + votesDem;
        const perGop = Number(row.per_gop) || votesGop / Math.max(totalVotes, 1);
        const perDem = Number(row.per_dem) || votesDem / Math.max(totalVotes, 1);
        return {
          id: row.county_fips?.padStart(5, "0"),
          place: row.county,
          state: row.state,
          votesGop,
          votesDem,
          totalVotes,
          perGop,
          perDem,
          winner: perGop > perDem ? "gop" : "dem",
        };
      }));
    });
  }, [year]);

  const stateRows = useMemo(() => {
    const grouped: Record<string, ResultRow> = {};
    for (const county of countyRows) {
      const row = grouped[county.state ?? ""] ??= {
        id: county.state ?? "",
        place: county.state ?? "",
        votesGop: 0,
        votesDem: 0,
        totalVotes: 0,
        perGop: 0,
        perDem: 0,
        winner: "gop",
        electoralVotes: seats[county.state ?? ""] ?? 0,
      };
      row.votesGop += county.votesGop;
      row.votesDem += county.votesDem;
      row.totalVotes += county.totalVotes;
    }
    for (const row of Object.values(grouped)) {
      row.perGop = row.votesGop / Math.max(row.totalVotes, 1);
      row.perDem = row.votesDem / Math.max(row.totalVotes, 1);
      row.winner = row.perGop > row.perDem ? "gop" : "dem";
      row.electoralVotes = seats[row.place] ?? 0;
    }
    if (seats.Alaska) {
      grouped.Alaska = {
        id: "Alaska",
        place: "Alaska",
        votesGop: 0,
        votesDem: 0,
        totalVotes: 0,
        perGop: 1,
        perDem: 0,
        winner: "gop",
        electoralVotes: seats.Alaska,
        assumption: true,
      };
    }
    return Object.values(grouped);
  }, [countyRows, seats]);

  const displayedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = level === "state" ? stateRows : countyRows;
    return source
      .filter((row) => !query || row.place.toLowerCase().includes(query) || row.state?.toLowerCase().includes(query))
      .sort((a, b) => {
        const marginA = Math.abs(a.perGop - a.perDem);
        const marginB = Math.abs(b.perGop - b.perDem);
        return sort === "closest" ? marginA - marginB : b.totalVotes - a.totalVotes;
      });
  }, [countyRows, level, search, sort, stateRows]);

  const totals = useMemo(() => {
    const stateSource = stateRows.filter((row) => !row.assumption);
    return {
      gopEV: OFFICIAL_EV[year].gop,
      demEV: OFFICIAL_EV[year].dem,
      gopVotes: stateSource.reduce((sum, row) => sum + row.votesGop, 0),
      demVotes: stateSource.reduce((sum, row) => sum + row.votesDem, 0),
    };
  }, [stateRows, year]);

  return (
    <section className="results-explorer">
      <header className="results-toolbar">
        <div className="results-years" aria-label="Election year">
          {(["2016", "2020", "2024"] as ResultYear[]).map((option) => <button key={option} type="button" aria-pressed={year === option} onClick={() => setYear(option)}>{option}</button>)}
        </div>
        <div className="results-level" aria-label="Result geography">
          {(["state", "county"] as ResultLevel[]).map((option) => <button key={option} type="button" aria-pressed={level === option} onClick={() => setLevel(option)}>{option}</button>)}
        </div>
        <label className="results-search"><span className="sr-only">Search results</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search place…" /></label>
        <select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value as "closest" | "largest")}><option value="closest">Closest races</option><option value="largest">Largest turnout</option></select>
      </header>

      <div className="results-summary">
        <div><span>Republican EV</span><strong className="gop-text">{totals.gopEV}</strong></div>
        <div><span>Democratic EV</span><strong className="dem-text">{totals.demEV}</strong></div>
        <div><span>Republican votes</span><strong>{fmt(totals.gopVotes)}</strong></div>
        <div><span>Democratic votes</span><strong>{fmt(totals.demVotes)}</strong></div>
      </div>

      <div className="results-table-wrap">
        <table className="results-table">
          <thead><tr><th>Place</th><th>Winner</th><th>Republican</th><th>Democrat</th><th>Margin</th><th>Total votes</th>{level === "state" && <th>EV</th>}</tr></thead>
          <tbody>
            {displayedRows.map((row) => {
              const margin = Math.abs(row.perGop - row.perDem);
              return (
                <tr key={row.id}>
                  <td><strong>{row.place}</strong>{row.state && <span>{row.state}</span>}{row.assumption && <em>Republican result · county data unavailable</em>}</td>
                  <td><b className={row.winner === "gop" ? "result-gop" : "result-dem"}>{row.winner === "gop" ? "Republican" : "Democrat"}</b></td>
                  <td>{row.assumption ? "—" : pct(row.perGop)}</td>
                  <td>{row.assumption ? "—" : pct(row.perDem)}</td>
                  <td>{row.assumption ? "—" : `${row.winner === "gop" ? "R" : "D"} +${pct(margin)}`}</td>
                  <td>{fmt(row.totalVotes)}</td>
                  {level === "state" && <td>{row.electoralVotes}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
