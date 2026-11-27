import type { Link } from '../types/content'

export function Footer({ content, developerLinks, privacyHref }: { content: { brand: string; location: string; authorLinks: Link[]; role: string }; developerLinks: Link[]; privacyHref: string }) {
  return <footer id="contato" className="footer container">
    <div>
      <p className="footer-brand">{content.brand}</p>
      <div className="footer-meta">
        <p>{content.location}</p>
        <a href={privacyHref}>privacidade</a>
      </div>
    </div>
    <nav className="footer-links" aria-label="links dev">
      <p>github</p>
      <ul>
        {developerLinks.map((link) => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span></a></li>)}
      </ul>
    </nav>
    <nav className="footer-links footer-author" aria-label={content.role}>
      <p>{content.role}</p>
      <ul>
        {content.authorLinks.map((link) => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span></a></li>)}
      </ul>
    </nav>
  </footer>
}
