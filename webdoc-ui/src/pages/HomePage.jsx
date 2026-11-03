import { useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useContent } from '../lib/ContentContext'
import { useI18n } from '../i18n/I18nContext'
import { prepareArticle } from '../lib/content'
import { useImageZoom } from '../lib/useImageZoom'
import { findFirstDocPath } from '../lib/docs'
import PageShell from '../components/PageShell'
import ImageZoomModal from '../components/ImageZoomModal'
import { formatHomeTitle } from '../lib/title'

export default function HomePage() {
  const { appearance, site, docsTree, loading } = useContent()
  const { lang, t } = useI18n()
  const { zoomImage, handleContentClick, closeZoom } = useImageZoom()

  const home = (appearance.pages || []).find((page) => page.slug === 'home')
  const prepared = useMemo(
    () => prepareArticle(home?.content || ''),
    [home?.content],
  )

  const firstDocPath = useMemo(() => findFirstDocPath(docsTree), [docsTree])

  useEffect(() => {
    if (!loading && site?.skipHomepage && firstDocPath) return
    document.title = formatHomeTitle(site.siteName, site.tagline)
  }, [firstDocPath, loading, site.siteName, site.skipHomepage, site.tagline])

  if (!loading && site?.skipHomepage && firstDocPath) {
    return <Navigate to={firstDocPath} replace />
  }

  // Do not render the bundled React fallback while the database appearance
  // document is still loading; otherwise a custom homepage flashes the old
  // default for one frame on reload.
  if (loading) {
    return (
      <PageShell home>
        <div className="VPHome">
          <div className="wd-home-loading" role="status" aria-live="polite">
            <span className="wd-home-loading__spinner" aria-hidden="true" />
            <span>{t('doc.loading')}</span>
          </div>
        </div>
      </PageShell>
    )
  }
  if (home?.content?.trim() && prepared.html) {
    return (
      <>
        <PageShell home>
          <div className="VPHome">
            <div className="wd-container wd-home-html">
              <article
                className="vp-doc"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: prepared.html }}
              />
            </div>
          </div>
        </PageShell>
        {zoomImage && (
          <ImageZoomModal
            src={zoomImage.src}
            alt={zoomImage.alt}
            naturalWidth={zoomImage.naturalWidth}
            naturalHeight={zoomImage.naturalHeight}
            onClose={closeZoom}
          />
        )}
      </>
    )
  }

  return (
    <PageShell home>
      <div className="VPHome">
        <div className="wd-container wd-home-html">
          <article className="vp-doc">
            <p>{t('doc.noContent') || ''}</p>
          </article>
        </div>
      </div>
    </PageShell>
  )
}
