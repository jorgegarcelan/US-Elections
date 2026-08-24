import Link from "next/link";
import type { CSSProperties } from "react";
import AnimatedNumber from "./components/AnimatedNumber";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";

const electionYears = [
  { year: "2016", dem: 232, gop: 306, note: "The geography of disruption" },
  { year: "2020", dem: 306, gop: 232, note: "A narrow map, reversed" },
  { year: "2024", dem: 226, gop: 309, note: "A nationwide Republican shift" },
];

export default function Home() {
  return (
    <main className="editorial-page">
      <SiteHeader />
      <section className="home-hero">
        <div className="hero-kicker"><span>01 / The project</span><span>3,107 counties</span><span>2016—2024</span></div>
        <div className="hero-title-wrap">
          <h1>America,<br /><em>county by county.</em></h1>
          <p className="hero-intro">Three presidential elections, thousands of local stories and one question: how do people, place and history shape the vote?</p>
        </div>
        <div className="hero-board" aria-label="2024 electoral result">
          <div className="hero-result hero-result-gop"><span className="hero-party">Republican</span><AnimatedNumber value={309} className="hero-total" /><span>electoral votes</span></div>
          <div className="hero-threshold"><span>270</span><span>to win</span></div>
          <div className="hero-result hero-result-dem"><span className="hero-party">Democrat</span><AnimatedNumber value={226} className="hero-total" /><span>electoral votes</span></div>
          <div className="electoral-stripe" aria-hidden="true">
            {Array.from({ length: 36 }, (_, index) => (
              <span
                key={index}
                className={`electoral-box ${index < 20 ? "is-gop" : "is-dem"}`}
                style={{ "--box-index": index } as CSSProperties}
              />
            ))}
          </div>
        </div>
        <div className="hero-actions">
          <Link className="button button-primary" href="/explore">Explore the map <span aria-hidden="true">→</span></Link>
          <Link className="button button-quiet" href="/methodology">Read the methodology</Link>
        </div>
      </section>

      <section className="statement-section">
        <p className="section-index">02 / Why counties</p>
        <div><h2>A national election is decided locally.</h2><p>State totals hide the contrasts that define American politics. County-level results reveal urban–rural divides, demographic change and the places where elections actually move.</p></div>
        <dl className="fact-grid">
          <div><dt><AnimatedNumber value={3107} /></dt><dd>counties analysed</dd></div><div><dt><AnimatedNumber value={3} minimumIntegerDigits={2} /></dt><dd>election cycles</dd></div>
          <div><dt><AnimatedNumber value={30} suffix="+" /></dt><dd>census variables</dd></div><div><dt><AnimatedNumber value={538} /></dt><dd>electoral votes</dd></div>
        </dl>
      </section>

      <section className="timeline-section">
        <div className="section-heading"><p className="section-index">03 / Three elections</p><h2>The map moved.<br /><em>Then moved again.</em></h2></div>
        <div className="election-timeline">
          {electionYears.map((election, index) => (
            <article key={election.year} className="timeline-card"><span className="timeline-number">0{index + 1}</span><h3>{election.year}</h3><p>{election.note}</p><div className="mini-result"><span className="dem-text">D <AnimatedNumber value={election.dem} /></span><span className="gop-text">R <AnimatedNumber value={election.gop} /></span></div></article>
          ))}
        </div>
        <Link className="text-link" href="/explore">Compare all three elections <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="model-teaser">
        <div className="model-copy"><p className="section-index">04 / The model</p><h2>From historical patterns to possible outcomes.</h2><p>We combine electoral history with demographic and socioeconomic data, compare several algorithms and run Monte Carlo simulations to quantify uncertainty—not to pretend it does not exist.</p><Link className="button button-light" href="/prediction">Open prediction lab →</Link></div>
        <div className="model-console" aria-label="Model pipeline overview">
          <div><span>Input</span><strong>Census ACS + election results</strong></div><div><span>Models</span><strong>Ridge · Random Forest · XGBoost</strong></div><div><span>Scale</span><strong>County → State → Electoral College</strong></div><div><span>Output</span><strong>Vote share + win probability</strong></div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
