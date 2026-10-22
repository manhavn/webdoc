import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const LABEL_KEYS = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
};

export default function ThemeSwitch({ className = '' }) {
  const { t } = useI18n();
  const { mode, setMode } = useTheme();
  return (
    <select
      className={`theme-select ${className}`.trim()}
      value={mode}
      aria-label={t('theme.label')}
      title={t('theme.label')}
      onChange={(event) => setMode(event.target.value)}
    >
      {['system', 'light', 'dark'].map((option) => (
        <option key={option} value={option}>
          {t(LABEL_KEYS[option])}
        </option>
      ))}
    </select>
  );
}
