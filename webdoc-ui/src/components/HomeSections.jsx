import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import journalsFallback from '../data/journals.json'
import {
  EvolutionArrow,
  EvolutionIcon,
  ProcessIcon,
} from './Illustrations'
import { useI18n } from '../i18n/I18nContext'

/* ---------------------------------- Hero ---------------------------------- */

function PreviewCard({ data }) {
  const items = Array.isArray(data.previewItems) ? data.previewItems : []
  return (
    <div className="relative z-10 w-full max-w-2xl bg-white/70 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200">
      <div className="h-11 flex items-center px-4 border-b border-gray-200" style={{ gap: 6 }}>
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-red-400 rounded-full" />
          <div className="w-3 h-3 bg-yellow-400 rounded-full" />
          <div className="w-3 h-3 bg-green-400 rounded-full" />
        </div>
        <span className="text-xs text-gray-500" style={{ marginLeft: 8 }}>
          example.com/demo
        </span>
      </div>
      <div className="p-5">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <span className="font-bold text-lg">{data.previewTitle || 'Demo preview'}</span>
          <span className="text-xs text-gray-500">Preview</span>
        </div>
        {items.length > 0 && (
          <ul style={{ display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
            {items.map((item) => (
              <li
                key={item}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--vp-c-text-2)' }}
              >
                <i className="fas fa-check" style={{ color: 'var(--vp-c-brand-1)' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
        {data.previewNote && (
          <p className="font-medium text-xs" style={{ marginTop: 12 }}>
            {data.previewNote}
          </p>
        )}
      </div>
    </div>
  )
}

export function Hero({ data }) {
  return (
    <div className="content">
      <div className="container mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="flex flex-col gap-6 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
              {data.title}
            </h1>
            <p className="text-lg text-gray-600">{data.subtitle}</p>
            <div className="mt-1 flex flex-wrap justify-center lg:justify-start text-white gap-2">
              <Link
                to={data.primaryHref}
                className="bg-fuchsia-900 hover:bg-gradient-to-r from-fuchsia-950 to-fuchsia-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm sm:text-base px-4 sm:px-5 py-2.5 text-center"
              >
                <i className="fas fa-phone-volume" />{'\u00A0'} {data.primaryLabel}
              </Link>
              <a
                href={data.secondaryHref}
                target="_blank"
                rel="noreferrer"
                className="bg-fuchsia-900 hover:bg-gradient-to-r from-fuchsia-950 to-fuchsia-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm sm:text-base px-4 sm:px-5 py-2.5 text-center"
              >
                <i className="fab fa-wpforms" />{'\u00A0'} {data.secondaryLabel}
              </a>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute -top-20 -right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob" />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-4000" />
            <PreviewCard data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- Benefits -------------------------------- */

const TONES = {
  fuchsia:
    'from-fuchsia-500 to-fuchsia-900 text-fuchsia-700',
  violet: 'from-violet-500 to-violet-900 text-violet-700',
  indigo: 'from-indigo-500 to-indigo-900 text-indigo-700',
}

export function Benefits({ data }) {
  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {(data.items || []).map((item, i) => {
            const tone = TONES[item.tone] || TONES.fuchsia
            return (
              <div className="benefit-card group" key={i}>
                <div
                  className={`benefit-icon bg-gradient-to-br ${
                    tone.split(' text-')[0]
                  }`}
                >
                  <i className={`fas ${item.icon} text-white`} />
                </div>
                <h3 className="benefit-title">{item.title}</h3>
                <ul className="benefit-list">
                  {(item.bullets || []).map((bullet, j) => (
                    <li key={j}>
                      <i
                        className={`fas fa-check-circle ${
                          tone.split(' text-')[1]
                            ? `text-${tone.split(' text-')[1]}`
                            : 'text-fuchsia-700'
                        }`}
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- Evolution -------------------------------- */

const BADGE = {
  gray: 'bg-gray-400',
  amber: 'bg-amber-500',
  fuchsia: 'bg-fuchsia-700',
}

const ICON_TONE = {
  basic: 'text-gray-400',
  standard: 'text-amber-500',
  premium: 'text-fuchsia-700',
}

export function Evolution({ data }) {
  const items = data.items || []
  return (
    <section className="home-section">
      <h2 className="section-header text-center">{data.title}</h2>
      <div className="flex justify-center w-full mb-6">
        <p className="text-center text-gray-500 max-w-2xl mb-12 px-4">
          {data.subtitle}
        </p>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative">
          {items.map((item, idx) => (
            <div
              className="flex flex-col items-center relative h-full w-full"
              key={item.title}
            >
              <div
                className={`evo-card evo-card--${item.variant} h-full`}
              >
                {item.variant === 'premium' && (
                  <div className="evo-premium-glow" />
                )}
                <div
                  className={`evo-step-badge ${BADGE[item.badge] || BADGE.gray}`}
                >
                  {item.phase}
                </div>
                <div className={`evo-card-icon ${ICON_TONE[item.variant]}`}>
                  <EvolutionIcon kind={item.icon} />
                </div>
                <h3 className={`evo-card-title ${item.titleColor}`}>
                  {item.title}
                </h3>
                <p className="evo-card-desc">
                  <b>{item.strong}</b>
                  <br />
                  {item.desc}
                </p>
                <ul className="mt-4 text-sm text-left space-y-2 text-gray-700 mx-auto w-fit">
                  {(item.points || []).map((point, j) => (
                    <li className="flex items-start gap-2" key={j}>
                      <i
                        className={`fas ${
                          point.ok ? 'fa-check text-fuchsia-600' : 'fa-times text-orange-500'
                        } mt-1`}
                      />
                      <span>{point.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {idx < items.length - 1 && (
                <>
                  <div className="hidden md:flex evo-arrow text-fuchsia-400">
                    <EvolutionArrow />
                  </div>
                  <div className="flex md:hidden evo-arrow-vertical text-fuchsia-400">
                    <EvolutionArrow vertical />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Upgrade --------------------------------- */

const HEADER_TONE = {
  gray: 'bg-gradient-to-r from-gray-600 to-fuchsia-800',
  amber: 'bg-gradient-to-r from-amber-600 to-fuchsia-800',
}

export function Upgrade({ data }) {
  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
          {(data.cards || []).map((card, i) => (
            <div className="upgrade-card" key={i}>
              <div className={`upgrade-card-header ${HEADER_TONE[card.headerTone]}`}>
                <div className="flex items-center justify-center gap-3 text-white mb-2">
                  <EvolutionIcon kind={card.icon} className="upg-ico" />
                  <EvolutionArrow className="upg-arrow" />
                  <EvolutionIcon kind="rocket" className="upg-ico" />
                </div>
                <h3 className="text-white text-xl font-bold mt-3">
                  {card.heading}
                </h3>
              </div>
              <div className="upgrade-card-body">
                <ul className="upgrade-value-list">
                  {(card.bullets || []).map((bullet, j) => (
                    <li key={j}>
                      <i className="fas fa-star text-fuchsia-600" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="upgrade-stat">
                  <span className="upgrade-stat-number">{card.statNumber}</span>
                  <span className="upgrade-stat-label">{card.statLabel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Journals -------------------------------- */

export function Journals({ data }) {
  const [journals, setJournals] = useState(journalsFallback)
  useEffect(() => {
    api
      .get('/partners')
      .then((list) => {
        if (Array.isArray(list)) setJournals(list)
      })
      .catch(() => {})
  }, [])

  return (
    <section id="journal-list" className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {journals.map((journal) => (
              <a
                className="flex flex-col items-center bg-white rounded-xl shadow-md p-1 hover:shadow-lg transition"
                href={journal.url}
                target="_blank"
                rel="noreferrer"
                key={journal.name + journal.url}
              >
                <img
                  src={journal.logo}
                  alt={journal.name}
                  className="journal-image mb-2"
                  loading="lazy"
                />
                <div className="font-semibold text-sm text-center mb-2">
                  {journal.name}
                </div>
                <div className="text-gray-700 text-center text-sm mb-2">
                  {journal.org}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Features -------------------------------- */

export function Features({ data }) {
  return (
    <div className="bg-white py-4">
      <div className="container mx-auto px-6">
        <h2 className="section-header">{data.title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 my-16">
          {(data.items || []).map((item, i) => (
            <div className="feature-container" key={i}>
              <h3 className="feature-header">
                <i className="fas fa-dice-d20" />
                <span> {item.title}</span>
              </h3>
              <p className="feature-description">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------- Demo ---------------------------------- */

export function Demo({ data }) {
  const { t } = useI18n()
  const slides = data.slides || []
  const [active, setActive] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    if (slides.length < 2) return
    timer.current = setInterval(
      () => setActive((v) => (v + 1) % slides.length),
      5500,
    )
    return () => clearInterval(timer.current)
  }, [slides.length])

  const go = (dir) => {
    clearInterval(timer.current)
    setActive((v) => (v + dir + slides.length) % slides.length)
  }

  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="flex justify-center w-full">
        <p className="text-center text-gray-500 max-w-2xl mb-8 px-4">
          {data.subtitle}
        </p>
      </div>
      <div className="container mx-auto px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="vue-carousel">
            <div className="vue-carousel__track">
              {slides.map((slide, i) => (
                <div
                  className={`vue-carousel__slide${
                    i === active ? ' is-active' : ''
                  }`}
                  key={slide.src}
                >
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="vue-carousel__img"
                  />
                </div>
              ))}
            </div>
            <div className="vue-carousel__indicators">
              {slides.map((slide, i) => (
                <button
                  key={slide.src}
                  className={`vue-carousel__dot${
                    i === active ? ' is-active' : ''
                  }`}
                  aria-label={t('home.goToSlide', { n: i + 1 })}
                  onClick={() => {
                    clearInterval(timer.current)
                    setActive(i)
                  }}
                />
              ))}
            </div>
            <button
              className="vue-carousel__btn vue-carousel__btn--prev"
              aria-label={t('home.previousSlide')}
              onClick={() => go(-1)}
            >
              <i className="fas fa-angle-left" />
            </button>
            <button
              className="vue-carousel__btn vue-carousel__btn--next"
              aria-label={t('home.nextSlide')}
              onClick={() => go(1)}
            >
              <i className="fas fa-angle-right" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- Process -------------------------------- */

export function Process({ data }) {
  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="max-w-5xl mx-auto my-8 md:my-16 px-4">
        <div className="process-timeline">
          <div className="process-track" aria-hidden="true" />
          <div className="process-steps">
            {(data.steps || []).map((step) => (
              <div className="process-step" key={step.title}>
                <div className="process-node">
                  <span className="process-num">{step.icon}</span>
                  <ProcessIcon step={step.icon} />
                </div>
                <div className="process-label">
                  <span className="process-step-title">{step.title}</span>
                  <p className="process-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- Deploy --------------------------------- */

export function Deploy({ data }) {
  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {(data.plans || []).map((plan) => (
            <div className="deploy-card" key={plan.title}>
              <div className="deploy-card-icon">
                <i className={`fas ${plan.icon} fa-2x text-fuchsia-700`} />
              </div>
              <h3 className="deploy-card-title">{plan.title}</h3>
              <ul className="deploy-card-list">
                {(plan.bullets || []).map((bullet, i) => (
                  <li key={i}>
                    <i className="fas fa-check text-fuchsia-600 text-sm" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- Contact -------------------------------- */

export function Contact({ data }) {
  return (
    <section className="home-section">
      <h2 className="section-header">{data.title}</h2>
      <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3 text-white px-4">
        <Link
          to="/contact"
          className="bg-fuchsia-900 hover:bg-gradient-to-r from-fuchsia-950 to-fuchsia-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm sm:text-base px-5 py-2.5 text-center w-full sm:w-auto"
        >
          <i className="fas fa-phone-volume" /> {data.hotlineLabel}
        </Link>
        <a
          href={data.formHref}
          target="_blank"
          rel="noreferrer"
          className="bg-fuchsia-900 hover:bg-gradient-to-r from-fuchsia-950 to-fuchsia-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm sm:text-base px-5 py-2.5 text-center w-full sm:w-auto"
        >
          <i className="fab fa-wpforms" /> {data.formLabel}
        </a>
      </div>
    </section>
  )
}
