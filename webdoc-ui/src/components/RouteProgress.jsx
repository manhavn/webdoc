import { useI18n } from '../i18n/I18nContext'
import { useRouteProgress } from '../lib/routeProgress'

/* Fixed to the very top of the viewport, which is the header's top edge: the
   bar stays visible while a long article is scrolled and the header is sticky. */
export default function RouteProgress() {
  const { loading } = useRouteProgress()
  const { t } = useI18n()
  return (
    <div
      className="wd-route-progress"
      data-active={loading ? 'true' : 'false'}
      role="progressbar"
      aria-label={t('doc.loading')}
      aria-hidden={loading ? undefined : true}
    />
  )
}
