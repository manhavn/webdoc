import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useContent } from '../lib/ContentContext'
import { useI18n } from '../i18n/I18nContext'
import { localizedLabel } from '../data/appearance'
import CookieConsent from './CookieConsent'

export default function Footer() {
  const { site, appearance } = useContent()
  const { t, lang } = useI18n()
  const [cookieOpen, setCookieOpen] = useState(false)
  const footer = appearance.footer
  const facebookLabel = String(site.facebook || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

  if (!footer.show) {
    return (
      <CookieConsent forceOpen={cookieOpen} onClose={() => setCookieOpen(false)} />
    )
  }

  const note = String(footer.note || '').trim() || t('footer.demoNotice')
  const copyrightShort =
    String(footer.copyright || '').trim() || t('footer.copyrightShort')
  const copyright =
    String(footer.copyright || '').trim() || t('footer.copyright')
  const links = footer.links.filter((link) => link.href)
  const products = footer.products.filter((link) => link.href)

  return (
    <>
      <footer className="VPFooter" data-v-f5dfc737="" data-v-f3067b71="">
        <div className="container" data-v-f3067b71="">
          <p className="message" data-v-f3067b71="">{note}</p>
          <p className="copyright" data-v-f3067b71="">{copyrightShort}</p>
        </div>
      </footer>
      <footer className="site-footer">
        {(site.footerLogo || site.siteName) && (
          <div className="site-footer__brand">
            {site.footerLogo && (
              <img src={site.footerLogo} alt={site.siteName || 'Logo'} />
            )}
            <div>
              <strong>{site.siteName}</strong>
              {site.tagline && <span>{site.tagline}</span>}
            </div>
          </div>
        )}
        <div className="site-footer__inner">
          {links.length > 0 && (
            <div className="site-footer__col">
              <h3 className="site-footer__title">{t('footer.learnMore')}</h3>
              <ul>
                {links.map((link, index) => {
                  const label = localizedLabel(link, lang) || link.href
                  return (
                    <li key={`${link.href}-${index}`}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href}>{label}</Link>
                      ) : (
                        <a href={link.href} target="_blank" rel="noopener noreferrer">
                          {label}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {products.length > 0 && (
            <div className="site-footer__col">
              <h3 className="site-footer__title">{t('footer.products')}</h3>
              <ul>
                {products.map((product, index) => (
                  <li key={`${product.href}-${index}`}>
                    <a href={product.href} target="_blank" rel="noopener noreferrer">
                      {localizedLabel(product, lang) || product.href}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="site-footer__col">
            <h3 className="site-footer__title">{t('footer.contact')}</h3>
            <ul>
              <li>
                <a href={`mailto:${site.email}`} target="_blank" rel="noopener noreferrer">
                  <i className="fas fa-envelope" /> {t('footer.email')}: {site.email}
                </a>
              </li>
              <li>
                <a href={`tel:${site.hotline.replace(/\./g, '')}`}>
                  <i className="fas fa-phone-alt" /> {t('footer.hotline')}: {site.hotline}
                </a>
              </li>
              <li>
                <a href={site.facebook} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-facebook-f" /> {t('footer.facebook')}
                </a>
              </li>
              <li>
                <a href={site.youtube} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-youtube" /> {t('footer.youtube')}
                </a>
              </li>
              <li>
                <Link to="/contact">
                  <i className="far fa-hand-point-right" /> {t('footer.requestTrial')}
                </Link>
              </li>
            </ul>
          </div>
          <div className="site-footer__col">
            <h3 className="site-footer__title">{t('footer.about')}</h3>
            <div className="site-footer__about">
              <p>
                {t('footer.operator')}:{' '}
                <a href="https://example.com/" target="_blank" rel="noopener noreferrer">
                  WebDoc
                </a>
              </p>
              <p>{t('footer.address')}: {site.address}</p>
              <p>{t('footer.registration')}</p>
              <p>
                {t('footer.email')}: <a href={`mailto:${site.email}`}>{site.email}</a> —{' '}
                {t('footer.hotline')}:{' '}
                <a href={`tel:${site.hotline.replace(/\./g, '')}`}>{site.hotline}</a>
              </p>
              <p>
                {t('footer.fanpage')}:{' '}
                <a href={site.facebook} target="_blank" rel="noopener noreferrer">
                  {facebookLabel}
                </a>
              </p>
            </div>
          </div>
        </div>
        {note && <p className="site-footer__note">{note}</p>}
        <div className="site-footer__bottom">
          {' '}
          {copyright}{' '}
          <span className="site-footer__sep">·</span>{' '}
          <button
            type="button"
            className="site-footer__cookie"
            onClick={() => setCookieOpen(true)}
          >
            {t('footer.cookieSettings')}
          </button>
        </div>
      </footer>
      <CookieConsent forceOpen={cookieOpen} onClose={() => setCookieOpen(false)} />
    </>
  )
}
