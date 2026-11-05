
/* Empty shell rendered until the site document arrives: the boot screen must
   never show bundled demo content. */
export const blankSite = {
  siteName: '',
  tagline: '',
  hotline: '',
  email: '',
  address: '',
  facebook: '',
  youtube: '',
  footerText: '',
  headerLogo: '',
  footerLogo: '',
  favicon: '',
  ogImage: '',
  docsSkipGroups: false,
  skipHomepage: false,
  docsAccordion: false,
}

/* Last-resort identity, used only when the site document cannot be loaded. */
export const fallbackSite = {
  siteName: 'WebDoc Demo',
  tagline: 'Fictional sample content for product evaluation',
  hotline: '0000 0000',
  email: 'hello@example.com',
  address: '100 Example Avenue, Sample City',
  facebook: 'https://example.com/community',
  youtube: '',
  footerText: 'Demo content for evaluation only. © 2026 WebDoc Demo.',
  headerLogo: '',
  footerLogo: '',
  favicon: '/favicon.svg',
  ogImage: '/assets/images/og-image.png',
  docsSkipGroups: false,
  skipHomepage: false,
  docsAccordion: false,
}
