import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useContent } from '../lib/ContentContext'
import { useI18n } from '../i18n/I18nContext'
import PageShell from '../components/PageShell'
import { formatDocumentTitle } from '../lib/title'

export default function NotFound() {
  const { t } = useI18n()
  const { site, loading } = useContent()

  useEffect(() => {
    document.title = loading
      ? ''
      : formatDocumentTitle(t('notFound.title') || 'Page not found', site.siteName)
  }, [loading, site.siteName, t])


  return (
    <PageShell>
      <div className="wd-doc">
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.body')}</p>
        <Link className="wd-btn wd-btn--solid" to="/">
          {t('notFound.home')}
        </Link>
      </div>
    </PageShell>
  )
}
