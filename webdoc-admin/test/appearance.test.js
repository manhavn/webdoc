import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_APPEARANCE,
  buildAppearancePayload,
  createDefaultAppearance,
  isHexColor,
  normalizeAppearance,
  toColorInputValue,
} from '../src/lib/appearance.js';

test('default appearance exposes the complete backend schema', () => {
  const defaults = createDefaultAppearance();
  assert.deepEqual(defaults, DEFAULT_APPEARANCE);
  assert.equal(Object.keys(defaults.colors).length, 12);
  assert.deepEqual(defaults.navigation, []);
  assert.deepEqual(defaults.pages, []);

  defaults.colors.primary = '#000000';
  defaults.pages.push({ slug: 'x' });
  assert.equal(createDefaultAppearance().colors.primary, '#0f766e');
  assert.deepEqual(createDefaultAppearance().pages, []);
});

test('normalizeAppearance fills defaults for partial and malformed documents', () => {
  assert.deepEqual(normalizeAppearance(null), createDefaultAppearance());
  assert.deepEqual(normalizeAppearance('nonsense'), createDefaultAppearance());

  const normalized = normalizeAppearance({
    colors: { primary: '#123456' },
    fonts: { baseSize: '18px' },
    background: { overlay: 4, fixed: 1 },
    header: { sticky: false, showSearch: 'false' },
    footer: { show: 0 },
  });

  assert.equal(normalized.colors.primary, '#123456');
  assert.equal(normalized.colors.accent, DEFAULT_APPEARANCE.colors.accent);
  assert.equal(normalized.fonts.baseSize, '18px');
  assert.equal(normalized.fonts.body, DEFAULT_APPEARANCE.fonts.body);
  assert.equal(normalized.background.overlay, 1);
  assert.equal(normalized.background.fixed, true);
  assert.equal(normalized.header.sticky, false);
  assert.equal(normalized.header.showSearch, false);
  assert.equal(normalized.footer.show, false);
  assert.equal(normalized.header.ctaUrl, '');
});

test('navigation, footer links and pages are normalized and invalid entries dropped', () => {
  const normalized = normalizeAppearance({
    footer: {
      links: [
        { label: 'About', labelVi: 'Giới thiệu', labels: { en: 'About', vi: 'Giới thiệu' }, href: '/about' },
        null,
        'not-an-object',
      ],
    },
    navigation: [
      {
        label: 'Resources',
        labelVi: 'Tài nguyên',
        href: '/resources',
        links: [{ label: 'Guides', labelVi: 'Hướng dẫn', href: '/guides' }, undefined],
      },
      false,
    ],
    pages: [
      { slug: 'about', title: 'About', titleVi: 'Giới thiệu', titles: { en: 'About', vi: 'Giới thiệu' }, content: '<p>Hello</p>' },
      null,
    ],
  });

  assert.deepEqual(normalized.footer.links, [
    { label: 'About', labelVi: 'Giới thiệu', labels: { en: 'About', vi: 'Giới thiệu' }, href: '/about' },
  ]);
  assert.deepEqual(normalized.navigation, [
    {
      label: 'Resources',
      labelVi: 'Tài nguyên',
      labels: { en: 'Resources', vi: 'Tài nguyên' },
      href: '/resources',
      links: [{ label: 'Guides', labelVi: 'Hướng dẫn', labels: { en: 'Guides', vi: 'Hướng dẫn' }, href: '/guides', links: [] }],
    },
  ]);
  assert.deepEqual(normalized.pages, [
    { slug: 'about', title: 'About', titleVi: 'Giới thiệu', titles: { en: 'About', vi: 'Giới thiệu' }, content: '<p>Hello</p>' },
  ]);
});

test('nested navigation children survive normalization and payload', () => {
  const normalized = normalizeAppearance({
    navigation: [
      {
        label: 'Docs',
        href: '/docs',
        links: [
          {
            label: 'Admin',
            href: '/admin',
            links: [
              {
                label: 'DOI',
                href: '/doi',
                links: [{ label: 'Assign', href: '/assign' }],
              },
            ],
          },
        ],
      },
    ],
  });

  const assign = normalized.navigation[0].links[0].links[0].links[0];
  assert.equal(assign.href, '/assign');
  assert.deepEqual(assign.links, []);

  const payload = buildAppearancePayload(normalized);
  const nested = payload.navigation[0].links[0].links[0].links[0];
  assert.equal(nested.href, '/assign');
  assert.deepEqual(nested.links, []);
});

test('buildAppearancePayload returns the exact PUT payload and trims text fields', () => {
  const payload = buildAppearancePayload({
    colors: { primary: '  #0a0b0c  ' },
    fonts: {
      body: '  Georgia, serif ',
      heading: 'Inter, sans-serif',
      baseSize: ' 17px ',
      googleFontsUrl: ' https://fonts.example/x ',
    },
    background: { image: ' /uploads/bg.jpg ', color: '#ffffff', overlay: 0.35, fixed: true },
    header: {
      show: true,
      sticky: false,
      showSearch: true,
      showLanguage: false,
      background: '',
      text: ' #111111 ',
      ctaLabel: ' Contact ',
      ctaLabelVi: ' Liên hệ ',
      ctaUrl: ' /contact ',
    },
    footer: {
      show: true,
      background: ' #000000 ',
      text: '',
      copyright: ' © 2026 ',
      note: ' Note ',
      links: [{ label: ' About ', labelVi: ' Giới thiệu ', href: ' /about ' }],
    },
    navigation: [
      {
        label: ' Resources ',
        labelVi: ' Tài nguyên ',
        href: ' /resources ',
        links: [{ label: ' Guides ', labelVi: ' Hướng dẫn ', href: ' /guides ' }],
      },
    ],
    pages: [
      {
        slug: ' about ',
        title: ' About ',
        titleVi: ' Giới thiệu ',
        content: '  <p> Hello </p>  ',
      },
    ],
    unexpected: 'ignored',
  });

  assert.deepEqual(Object.keys(payload), [
    'colors',
    'fonts',
    'background',
    'header',
    'theme',
    'footer',
    'navigation',
    'pages',
  ]);
  assert.equal(payload.colors.primary, '#0a0b0c');
  assert.equal(payload.colors.accent, DEFAULT_APPEARANCE.colors.accent);
  assert.equal(payload.fonts.body, 'Georgia, serif');
  assert.equal(payload.fonts.heading, 'Inter, sans-serif');
  assert.equal(payload.background.image, '/uploads/bg.jpg');
  assert.equal(payload.background.overlay, 0.35);
  assert.deepEqual(payload.header, {
    show: true,
    sticky: false,
    showSearch: true,
    showLanguage: false,
    background: '',
    text: '#111111',
    ctaLabel: 'Contact',
    ctaLabelVi: 'Liên hệ',
    ctaLabels: { en: 'Contact', vi: 'Liên hệ' },
    ctaUrl: '/contact',
  });
  assert.deepEqual(payload.footer.links, [
    { label: 'About', labelVi: 'Giới thiệu', labels: { en: 'About', vi: 'Giới thiệu' }, href: '/about' },
  ]);
  assert.equal(payload.footer.copyright, '© 2026');
  assert.equal(payload.footer.note, 'Note');
  assert.deepEqual(payload.navigation[0].links, [
    { label: 'Guides', labelVi: 'Hướng dẫn', labels: { en: 'Guides', vi: 'Hướng dẫn' }, href: '/guides', links: [] },
  ]);
  assert.deepEqual(payload.pages[0], {
    slug: 'about',
    title: 'About',
    titleVi: 'Giới thiệu',
    titles: { en: 'About', vi: 'Giới thiệu' },
    content: '  <p> Hello </p>  ',
  });
  assert.equal(payload.unexpected, undefined);
});

test('hex color helpers accept css hex values and normalize color inputs', () => {
  assert.equal(isHexColor('#fff'), true);
  assert.equal(isHexColor('#0F766E'), true);
  assert.equal(isHexColor('#0f766e80'), true);
  assert.equal(isHexColor(' #fff '), true);
  assert.equal(isHexColor('fff'), false);
  assert.equal(isHexColor('#12'), false);
  assert.equal(isHexColor(''), false);

  assert.equal(toColorInputValue('#0F766E'), '#0f766e');
  assert.equal(toColorInputValue('#abc'), '#aabbcc');
  assert.equal(toColorInputValue('#abcd'), '#aabbcc');
  assert.equal(toColorInputValue('#11223344'), '#112233');
  assert.equal(toColorInputValue(''), '#000000');
  assert.equal(toColorInputValue('red'), '#000000');
});
