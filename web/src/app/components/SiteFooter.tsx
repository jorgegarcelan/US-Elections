import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <span className="eyebrow">US presidential elections · 2016—2024</span>
        <p>Data, geography and machine learning at county level.</p>
      </div>
      <div className="site-footer-links">
        <Link href="/project">About the project</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/data">Sources &amp; data</Link>
        <a href="https://github.com/jorgegarcelan/US-Elections" target="_blank" rel="noreferrer">Repository ↗</a>
      </div>
      <p className="site-footer-credit">Lucía Cordero &amp; Jorge Garcelán</p>
    </footer>
  );
}
