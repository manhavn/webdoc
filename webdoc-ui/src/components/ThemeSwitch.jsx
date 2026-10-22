import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'

const LABEL_KEYS = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
}

const MOVE_KEYS = {
  ArrowDown: 1,
  ArrowUp: -1,
}

export default function ThemeSwitch({ className = '' }) {
  const { t } = useI18n()
  const { mode, setMode, options } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const items = menuRef.current?.querySelectorAll('[role="option"]')
    const active = menuRef.current?.querySelector('[role="option"][aria-selected="true"]')
    ;(active || items?.[0])?.focus()
  }, [open])

  if (options.length <= 1) return null
  const classes = `wd-theme-switch${className ? ` ${className}` : ''}`
  if (options.length === 2) {
    return (
      <div className={classes} role="group" aria-label={t('theme.label')}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`wd-theme-switch__btn${mode === option ? ' is-active' : ''}`}
            aria-pressed={mode === option}
            title={t(LABEL_KEYS[option])}
            onClick={() => setMode(option)}
          >
            {option === 'dark' ? '☾' : option === 'light' ? '☀' : '◐'}
          </button>
        ))}
      </div>
    )
  }

  const onMenuKeyDown = (event) => {
    const items = [...(menuRef.current?.querySelectorAll('[role="option"]') || [])]
    if (!items.length) return
    const current = items.indexOf(document.activeElement)
    let next = null
    if (event.key in MOVE_KEYS) {
      next = (current + MOVE_KEYS[event.key] + items.length) % items.length
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = items.length - 1
    }
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  return (
    <div
      className={`${classes} wd-theme-switch--menu${open ? ' is-open' : ''}`}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className="wd-theme-switch__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('theme.label')}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          setOpen(true)
        }}
      >
        <span className="wd-theme-switch__value">{t(LABEL_KEYS[mode])}</span>
        <span className="wd-theme-switch__caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="wd-theme-switch__menu"
          role="listbox"
          aria-label={t('theme.label')}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={mode === option}
              className={`wd-theme-switch__option${
                mode === option ? ' is-active' : ''
              }`}
              onClick={() => {
                setMode(option)
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              <span>{t(LABEL_KEYS[option])}</span>
              {mode === option && (
                <span className="wd-theme-switch__check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
