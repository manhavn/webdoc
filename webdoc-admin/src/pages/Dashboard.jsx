import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';

const EMPTY_STATS = {
  docs: 0,
  docGroups: 0,
  docPages: 0,
  docsHidden: 0,
  contacts: 0,
};

const STAT_CARDS = [
  { key: 'docs', labelKey: 'stat.docs', icon: 'docs', tone: 'teal' },
  { key: 'docGroups', labelKey: 'stat.groups', icon: 'categories', tone: 'blue' },
  { key: 'docPages', labelKey: 'stat.pages', icon: 'articles', tone: 'green' },
  { key: 'contacts', labelKey: 'stat.contacts', icon: 'mail', tone: 'amber' },
];

const QUICK_LINKS = [
  { to: '/docs', icon: 'docs', titleKey: 'quick.docs.title', descriptionKey: 'quick.docs.description' },
  {
    to: '/site',
    icon: 'settings',
    titleKey: 'quick.site.title',
    descriptionKey: 'quick.site.description',
  },
  {
    to: '/appearance',
    icon: 'appearance',
    titleKey: 'appearance.title',
    descriptionKey: 'appearance.subtitle',
  },
  {
    to: '/homepage',
    icon: 'layout',
    titleKey: 'pages.homeTitle',
    descriptionKey: 'pages.homeDesc',
  },
  {
    to: '/languages',
    icon: 'globe',
    titleKey: 'languages.title',
    descriptionKey: 'languages.desc',
  },
  {
    to: '/backup',
    icon: 'backup',
    titleKey: 'backup.title',
    descriptionKey: 'backup.subtitle',
  },
];

export default function Dashboard() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .stats()
      .then((data) => {
        if (active) setStats({ ...EMPTY_STATS, ...(data || {}) });
      })
      .catch((err) => {
        if (active) setError(err.message || t('dashboard.error'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('dashboard.title')}</h2>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <Link to="/docs" className="btn btn-primary">
          <Icon name="docs" /> {t('dashboard.manage')}
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className={`stat-card tone-${card.tone}`}>
            <div className="stat-icon">
              <Icon name={card.icon} size={20} />
            </div>
            <div>
              <span className="stat-label">{t(card.labelKey)}</span>
              <strong className="stat-value">
                {loading ? '—' : formatNumber(stats[card.key], locale)}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="stats-note">
        <span>
          {t('dashboard.summary', {
            docs: loading ? '—' : formatNumber(stats.docs, locale),
            groups: formatNumber(stats.docGroups, locale),
            pages: formatNumber(stats.docPages, locale),
          })}
          {stats.docsHidden > 0
            ? ` · ${t('dashboard.hidden', { count: formatNumber(stats.docsHidden, locale) })}`
            : ''}
        </span>
        <Link to="/docs" className="btn btn-ghost btn-sm">
          {t('dashboard.openTree')}
        </Link>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>{t('dashboard.quickTitle')}</h3>
            <p>{t('dashboard.quickSubtitle')}</p>
          </div>
        </div>
        <div className="quick-grid">
          {QUICK_LINKS.map((item) => (
            <Link className="quick-card" to={item.to} key={item.to}>
              <span className="quick-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span>
                <strong>{t(item.titleKey)}</strong>
                <small>{t(item.descriptionKey)}</small>
              </span>
              <Icon name="arrowRight" size={14} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
