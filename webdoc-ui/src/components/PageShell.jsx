export default function PageShell({ children, home = false, flush = false, className = '' }) {
  return (
    <main
      id="VPContent"
      className={`VPContent wd-page-shell${home ? ' wd-page-shell--home' : ''}${flush ? ' wd-page-shell--flush' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="wd-page-shell__inner">{children}</div>
    </main>
  )
}
