import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "The Project",
  description: "Meet the people behind County by County and find the talk, code, results and resources that tell the full story.",
};

const projectLinks = [
  { number: "01", href: "/results", title: "Our results", copy: "Read the final simulation, electoral map, distributions and state-level uncertainty.", action: "Open results" },
  { number: "02", href: "/explore", title: "Election atlas", copy: "Explore historical presidential results at state and county level.", action: "Explore elections" },
  { number: "03", href: "/variables", title: "Variables", copy: "Compare vote outcomes with income, education, race, age and other county characteristics.", action: "Explore variables" },
  { number: "04", href: "/simulations", title: "Simulation lab", copy: "Change the assumptions and run a new electoral scenario of your own.", action: "Run a simulation" },
  { number: "05", href: "/methodology", title: "Methodology", copy: "Follow the path from raw public data to county estimates and Electoral College outcomes.", action: "Read the method" },
  { number: "06", href: "/data", title: "Data", copy: "Find the public sources, feature dictionary and downloadable project datasets.", action: "See the sources" },
];

const people = [
  {
    initials: "LC",
    name: "Lucía Cordero Sánchez",
    role: "Data scientist & AI engineer",
    bio: "MSc in Applied Artificial Intelligence. Lucía works across data engineering, applied AI and cloud solutions, turning complex technical systems into useful products.",
    links: [
      { label: "LinkedIn", href: "https://linkedin.com/in/luciacordero" },
      { label: "GitHub", href: "https://github.com/lucia-corsan" },
      { label: "Articles", href: "https://neptune.ai/blog/author/lucia-cordero-sanchez" },
    ],
  },
  {
    initials: "JG",
    name: "Jorge Garcelán Gómez",
    role: "Data scientist & AI researcher",
    bio: "MSc in Applied Artificial Intelligence. Jorge combines data engineering, research and visual storytelling, with a focus on inclusive and bias-aware technology.",
    links: [
      { label: "LinkedIn", href: "https://linkedin.com/in/jgarcelan" },
      { label: "GitHub", href: "https://github.com/jorgegarcelan" },
    ],
  },
];

export default function ProjectPage() {
  return (
    <main className="editorial-page project-links-page">
      <SiteHeader />

      <header className="project-hub-hero">
        <p className="section-index">Project / Talk / People / Links</p>
        <div className="project-hub-title">
          <h1>One project.<br /><em>Many ways in.</em></h1>
          <span aria-hidden="true">R ↔ D</span>
        </div>
        <p className="project-hub-intro">County by County is a data-science project about the 2024 U.S. presidential election: from demographic patterns and county-level models to uncertainty, simulation and public conversation.</p>
      </header>

      <section className="project-talk" aria-labelledby="talk-title">
        <div className="project-talk-rail">
          <p className="section-index">Featured talk</p>
          <span>T3chFest 10</span>
          <span>Madrid · 2025</span>
          <span>50 minutes</span>
        </div>
        <div className="project-talk-main">
          <p className="project-talk-kicker">Lucía Cordero Sánchez + Jorge Garcelán Gómez</p>
          <h2 id="talk-title">¿Puede la IA predecir al presidente?</h2>
          <p className="project-talk-subtitle">Machine Learning y patrones de voto en EEUU</p>
          <p className="project-talk-copy">The talk behind this project: how demographic and electoral data can reveal patterns, how models turn those patterns into state calls, and why every prediction must make its uncertainty visible.</p>
          <div className="project-talk-actions">
            <a className="project-link-button project-link-button-primary" href="https://www.youtube.com/watch?v=XGsaWqbOf9w" target="_blank" rel="noreferrer">
              <span>Watch the full talk</span><b aria-hidden="true">▶</b>
            </a>
            <a className="project-link-button" href="https://t3chfest.es/2025/programa/puede-la-ia-predecir-al-presidente/" target="_blank" rel="noreferrer">
              <span>Official T3chFest page</span><b aria-hidden="true">↗</b>
            </a>
          </div>
        </div>
        <div className="project-talk-signal" aria-hidden="true">
          <span>DATA</span><i /><span>MODEL</span><i /><span>VOTE</span>
        </div>
      </section>

      <section className="project-people" aria-labelledby="people-title">
        <div className="project-section-heading">
          <p className="section-index">The people behind the model</p>
          <h2 id="people-title">Two perspectives.<br /><em>One shared question.</em></h2>
          <p>Data collection, modelling, simulation and visual storytelling developed collaboratively by Lucía and Jorge.</p>
        </div>
        <div className="project-people-grid">
          {people.map((person, index) => (
            <article className={index === 0 ? "person-card person-card-dem" : "person-card person-card-gop"} key={person.name}>
              <div className="person-card-topline"><span>{person.initials}</span><small>0{index + 1} / 02</small></div>
              <div className="person-card-copy">
                <p>{person.role}</p>
                <h3>{person.name}</h3>
                <div className="person-card-rule" aria-hidden="true" />
                <p>{person.bio}</p>
              </div>
              <div className="person-links" aria-label={`${person.name} links`}>
                {person.links.map((link) => <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>{link.label} <span aria-hidden="true">↗</span></a>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="project-resource-index" aria-labelledby="resources-title">
        <div className="project-section-heading project-resource-heading">
          <p className="section-index">Explore the work</p>
          <h2 id="resources-title">Follow the data,<br /><em>not just the headline.</em></h2>
          <a href="https://github.com/jorgegarcelan/US-Elections" target="_blank" rel="noreferrer">View the source code <span aria-hidden="true">↗</span></a>
        </div>
        <div className="project-resource-grid">
          {projectLinks.map((item) => (
            <Link href={item.href} className="project-resource-card" key={item.href}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <strong>{item.action} <i aria-hidden="true">→</i></strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="project-repository-callout">
        <p className="section-index">Open project</p>
        <div>
          <h2>Inspect it.<br />Question it.<br /><em>Build on it.</em></h2>
          <p>The notebooks, data pipeline, modelling work and website live together in the public repository.</p>
          <a className="button button-light" href="https://github.com/jorgegarcelan/US-Elections" target="_blank" rel="noreferrer">Open GitHub repository <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
