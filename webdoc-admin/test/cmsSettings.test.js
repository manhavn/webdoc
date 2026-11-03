import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CMS_SETTINGS } from '../src/lib/cmsDefaults.js';

test('DEFAULT_CMS_SETTINGS defines loginPanelBg property in root and colors', () => {
  assert.equal(typeof DEFAULT_CMS_SETTINGS.loginPanelBg, 'string');
  assert.equal(typeof DEFAULT_CMS_SETTINGS.colors.loginPanelBg, 'string');
  assert.equal(DEFAULT_CMS_SETTINGS.loginPanelBg, '');
  assert.equal(DEFAULT_CMS_SETTINGS.colors.loginPanelBg, '');
});

test('loginPanelBg can be configured as custom hex or gradient string', () => {
  const customHex = '#1e293b';
  const customGradient = 'linear-gradient(150deg, #1e3a8a 0%, #1d4ed8 48%, #3b82f6 100%)';

  const settingsWithHex = {
    ...DEFAULT_CMS_SETTINGS,
    colors: {
      ...DEFAULT_CMS_SETTINGS.colors,
      loginPanelBg: customHex,
    },
    loginPanelBg: customHex,
  };
  assert.equal(settingsWithHex.colors.loginPanelBg, customHex);
  assert.equal(settingsWithHex.loginPanelBg, customHex);

  const settingsWithGradient = {
    ...DEFAULT_CMS_SETTINGS,
    colors: {
      ...DEFAULT_CMS_SETTINGS.colors,
      loginPanelBg: customGradient,
    },
    loginPanelBg: customGradient,
  };
  assert.equal(settingsWithGradient.colors.loginPanelBg, customGradient);
  assert.equal(settingsWithGradient.loginPanelBg, customGradient);
});

test('DEFAULT_CMS_SETTINGS defines tokenDays property with default value 1', () => {
  assert.equal(typeof DEFAULT_CMS_SETTINGS.tokenDays, 'number');
  assert.equal(DEFAULT_CMS_SETTINGS.tokenDays, 1);
});

test('tokenDays can be configured to custom lifespan such as 30 or 365 days', () => {
  const settings30 = {
    ...DEFAULT_CMS_SETTINGS,
    tokenDays: 30,
  };
  assert.equal(settings30.tokenDays, 30);

  const settings365 = {
    ...DEFAULT_CMS_SETTINGS,
    tokenDays: 365,
  };
  assert.equal(settings365.tokenDays, 365);
});

test('tokenDays normalization clamps to valid positive numbers', () => {
  const normalizeDays = (raw) => Math.max(1, Math.min(3650, parseInt(raw, 10) || 1));
  assert.equal(normalizeDays('30'), 30);
  assert.equal(normalizeDays(365), 365);
  assert.equal(normalizeDays(''), 1);
  assert.equal(normalizeDays('0'), 1);
  assert.equal(normalizeDays(-5), 1);
  assert.equal(normalizeDays('10000'), 3650);
});
