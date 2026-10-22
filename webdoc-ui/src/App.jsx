import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import AppearanceTheme from './components/AppearanceTheme'
import RouteProgress from './components/RouteProgress'
import { RouteProgressProvider } from './lib/routeProgress'
import { useContent } from './lib/ContentContext'
import { useI18n } from './i18n/I18nContext'
import HomePage from './pages/HomePage'
import ContactPage from './pages/ContactPage'
import DocPage from './pages/DocPage'

export default function App() {
  const { site, loading } = useContent()
  const { t } = useI18n()

  useEffect(() => {
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
      link.setAttribute('href', site.favicon || '/favicon.svg')
    })
    const meta = document.querySelector('meta[property="og:image"]')
    if (meta) meta.setAttribute('content', site.ogImage || '/assets/images/og-image.png')
  }, [site.favicon, site.ogImage])

  useEffect(() => {
    document.documentElement.classList.add('site-has-footer')
    return () => document.documentElement.classList.remove('site-has-footer')
  }, [])

  return (
    <div className="Layout" data-v-f5dfc737="">
      <a href="#VPContent" className="VPSkipLink visually-hidden">
        {t('app.skipToContent')}
      </a>
      <ScrollToTop />
      <AppearanceTheme />
      <RouteProgressProvider>
        <RouteProgress />
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/*" element={<DocPage />} />
        </Routes>
      </RouteProgressProvider>
      {/* No footer under the boot skeleton: wait for the appearance payload. */}
      {!loading && <Footer />}
    </div>
  )
}
