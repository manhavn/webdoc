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
