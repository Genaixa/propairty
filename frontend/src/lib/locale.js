/**
 * Locale-aware formatting helpers using the Intl API.
 * Always read the current language from i18n so formatters stay in sync.
 */
import i18n from '../i18n'

function lang() {
  return i18n.language || 'en-GB'
}

export function formatCurrency(amount, currency = 'GBP') {
  return new Intl.NumberFormat(lang(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date, options = {}) {
  if (!date) return ''
  return new Intl.DateTimeFormat(lang(), {
    day: 'numeric', month: 'short', year: 'numeric',
    ...options,
  }).format(new Date(date))
}

export function formatNumber(n, options = {}) {
  return new Intl.NumberFormat(lang(), options).format(n)
}
