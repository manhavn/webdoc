import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import PageShell from '../components/PageShell'

export default function NotFound() {
  const { t } = useI18n()

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
