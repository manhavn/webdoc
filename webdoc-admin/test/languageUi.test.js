import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLanguagePayload,
  countVisibleUiLocales,
  normalizeLanguageList,
  resolveUiState,
  runLanguageReset,
  uiDefaultPayload,
  uiVisibilityPayload,
} from '../src/lib/languageUi.js';

const LOCALES = [
  {
    code: 'en',
    name: 'English',
    enabled: true,
    isDefault: true,
    uiEnabled: true,
    uiDefault: true,
    order: 1,
  },
  {
    code: 'vi',
    name: 'Tiếng Việt',
    enabled: true,
    isDefault: false,
    uiEnabled: true,
    uiDefault: false,
    order: 2,
  },
  {
    code: 'fr',
    name: 'Français',
    enabled: true,
    isDefault: false,
    uiEnabled: false,
    uiDefault: false,
    order: 3,
  },
];

test('legacy locale documents default to visible and follow the CMS default', () => {
  assert.deepEqual(resolveUiState({ code: 'fr', enabled: true }), {
    uiEnabled: true,
    uiDefault: false,
  });
  assert.deepEqual(
    resolveUiState({ code: 'en', enabled: true, isDefault: true }),
    { uiEnabled: true, uiDefault: true },
  );
  assert.deepEqual(resolveUiState({ code: 'de', enabled: false }), {
    uiEnabled: false,
    uiDefault: false,
  });
});

test('explicit website flags win and stay consistent with enabled/visible rules', () => {
  assert.deepEqual(
    resolveUiState({ enabled: true, uiEnabled: false, uiDefault: true }),
    { uiEnabled: false, uiDefault: false },
  );
  assert.deepEqual(
    resolveUiState({ enabled: false, uiEnabled: true, uiDefault: true }),
    { uiEnabled: false, uiDefault: false },
  );
  assert.deepEqual(
    resolveUiState({ enabled: true, uiEnabled: true, uiDefault: true }),
    { uiEnabled: true, uiDefault: true },
  );
});

test('list normalization keeps sorting and resolves the CMS default', () => {
  const { items, defaultLocale } = normalizeLanguageList([
    LOCALES[2],
    LOCALES[0],
    LOCALES[1],
  ]);
  assert.deepEqual(
    items.map((item) => item.code),
    ['en', 'vi', 'fr'],
  );
  assert.equal(defaultLocale, 'en');

  const wrapped = normalizeLanguageList({
    defaultLocale: 'vi',
    locales: [LOCALES[1], LOCALES[0]],
  });
  assert.equal(wrapped.defaultLocale, 'vi');
  assert.deepEqual(
    wrapped.items.map((item) => item.code),
    ['en', 'vi'],
  );
});

test('website visibility and default toggles produce partial PUT payloads', () => {
  assert.equal(countVisibleUiLocales(LOCALES), 2);
  assert.deepEqual(uiVisibilityPayload(LOCALES[1]), { uiEnabled: false });
  assert.deepEqual(uiVisibilityPayload(LOCALES[2]), { uiEnabled: true });
  assert.deepEqual(uiDefaultPayload(), { uiDefault: true });

  const afterHide = LOCALES.map((item) =>
    item.code === 'vi' ? { ...item, uiEnabled: false } : item,
  );
  assert.equal(countVisibleUiLocales(afterHide), 1);
  assert.deepEqual(
    afterHide.filter((item) => resolveUiState(item).uiEnabled).map((item) => item.code),
    ['en'],
  );
});

test('save payload keeps the website flags inside the global constraints', () => {
  const base = { name: '  Français  ', enabled: true, order: '4', uiEnabled: true, uiDefault: true };
  assert.deepEqual(buildLanguagePayload(base, { ui: {}, admin: {} }), {
    name: 'Français',
    enabled: true,
    isDefault: false,
    uiEnabled: true,
    uiDefault: true,
    order: 4,
    ui: {},
    admin: {},
  });

  assert.equal(
    buildLanguagePayload({ ...base, uiEnabled: false }, { ui: {}, admin: {} }).uiDefault,
    false,
  );
  assert.deepEqual(
    buildLanguagePayload({ ...base, enabled: false }, { ui: {}, admin: {} }),
    {
      name: 'Français',
      enabled: false,
      isDefault: false,
      uiEnabled: false,
      uiDefault: false,
      order: 4,
      ui: {},
      admin: {},
    },
  );
});

test('reset is only requested on confirmation and refreshes both stores', async () => {
  const calls = [];
  const client = {
    resetLanguages: async () => {
      calls.push('reset');
    },
  };
  const loadList = async () => {
    calls.push('list');
  };
  const loadI18n = async () => {
    calls.push('i18n');
  };

  // Cancel leaves the page untouched.
  assert.deepEqual(calls, []);

  await runLanguageReset({
    client,
    loadList,
    loadI18n,
    onDone: () => calls.push('done'),
  });

  assert.deepEqual(calls, ['reset', 'list', 'i18n', 'done']);
  assert.equal(countVisibleUiLocales(LOCALES), 2);
});

test('reset reload yields EN and VI visible with the third locale hidden', () => {
  const { items } = normalizeLanguageList([
    { ...LOCALES[0], uiEnabled: true, uiDefault: true },
    { ...LOCALES[1], uiEnabled: true, uiDefault: false },
    { ...LOCALES[2], uiEnabled: false, uiDefault: false },
  ]);
  assert.deepEqual(
    items.filter((item) => resolveUiState(item).uiEnabled).map((item) => item.code),
    ['en', 'vi'],
  );
  assert.equal(
    items.find((item) => resolveUiState(item).uiDefault)?.code,
    'en',
  );
  assert.equal(resolveUiState(items[2]).uiEnabled, false);
});

test('reset failures surface and skip the refresh', async () => {
  const calls = [];
  const failure = new Error('Không thể đặt lại ngôn ngữ.');
  await assert.rejects(
    runLanguageReset({
      client: {
        resetLanguages: async () => {
          calls.push('reset');
          throw failure;
        },
      },
      loadList: async () => calls.push('list'),
      loadI18n: async () => calls.push('i18n'),
      onDone: () => calls.push('done'),
    }),
    failure,
  );
  assert.deepEqual(calls, ['reset']);
});
