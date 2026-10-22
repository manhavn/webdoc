import { useMemo } from 'react'
import { useContent } from '../lib/ContentContext'
import { useI18n } from '../i18n/I18nContext'
import { prepareArticle } from '../lib/content'
import { useInternalLinks } from '../lib/internalLinks'
import PageShell from '../components/PageShell'
import {
  Benefits,
  Contact,
  Demo,
  Deploy,
  Evolution,
  Features,
  Hero,
  Journals,
  Process,
  Upgrade,
} from '../components/HomeSections'

const RENDERERS = {
  hero: Hero,
  benefits: Benefits,
  evolution: Evolution,
  upgrade: Upgrade,
  journals: Journals,
  features: Features,
  demo: Demo,
  process: Process,
  deploy: Deploy,
  contact: Contact,
}

export default function HomePage() {
  const { layout, appearance, loading } = useContent()
  const { lang, t } = useI18n()
  const onInternalClick = useInternalLinks()

  const home = (appearance.pages || []).find((page) => page.slug === 'home')
  const prepared = useMemo(
    () => prepareArticle(home?.content || ''),
    [home?.content],
  )

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
      <PageShell home>
        <div className="VPHome">
          <div className="wd-container wd-home-html">
            <article
              className="vp-doc"
              onClick={onInternalClick}
              dangerouslySetInnerHTML={{ __html: prepared.html }}
            />
          </div>
        </div>
      </PageShell>
    )
  }

  const sections = layout.sections.filter((s) => s.enabled !== false)

  return (
    <PageShell home>
      <div className="VPHome" data-v-9749c0f9="" data-v-9749bb45="">
      {sections.map((section, index) => {
        const Renderer = RENDERERS[section.key]
        if (!Renderer) return null
        return (
          <div key={section.key}>
            <Renderer data={section.data} />
            {index < sections.length - 1 && <div className="section-divider" />}
          </div>
        )
      })}
      </div>
    </PageShell>
  )
}
