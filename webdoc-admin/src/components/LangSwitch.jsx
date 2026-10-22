import { useI18n } from '../i18n/I18nContext';

export default function LangSwitch({ className = '' }) {
  const { lang, setLang, locales, ready, t } = useI18n();

  if (!ready || locales.length <= 1) return null;

  if (locales.length === 2) {
    return (
      <div
        className={`lang-switch ${className}`.trim()}
        role="group"
        aria-label={t('lang.label')}
      >
        {locales.map((locale) => (
          <button
            key={locale.code}
            type="button"
            className={`lang-option ${lang === locale.code ? 'active' : ''}`}
            onClick={() => setLang(locale.code)}
            aria-pressed={lang === locale.code}
            title={locale.name}
          >
            {locale.code.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      className={`lang-select ${className}`.trim()}
      value={lang}
      onChange={(event) => setLang(event.target.value)}
      aria-label={t('lang.label')}
      title={t('lang.label')}
    >
      {locales.map((locale) => (
        <option key={locale.code} value={locale.code}>
          {locale.name}
        </option>
      ))}
    </select>
  );
}
