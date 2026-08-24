import Link from "next/link";

const navigation = [
  { href: "/explore", label: "Elections" },
  { href: "/variables", label: "Variables" },
  { href: "/simulations", label: "Simulations" },
  { href: "/results", label: "Our Results" },
  { href: "/methodology", label: "Method" },
  { href: "/data", label: "Data" },
  { href: "/project", label: "Project" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="County by County home">
        <span className="site-brand-mark" aria-hidden="true" />
        <span>County <i>by</i> County</span>
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
      </nav>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
      </details>
      <a className="site-source-link" href="https://github.com/jorgegarcelan/US-Elections" target="_blank" rel="noreferrer">
        GitHub <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}
