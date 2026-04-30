import { PageHeader } from '../components/Illustration'
import { useState, useEffect, Fragment } from 'react'
import api from '../lib/api'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function useSortable(defaultCol, defaultDir = 'asc') {
  const [sortCol, setSortCol] = useState(defaultCol)
  const [sortDir, setSortDir] = useState(defaultDir)
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  function SortTh({ col, label, right }) {
    return (
      <th onClick={() => toggleSort(col)}
        className={`px-3 py-2 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
        {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
      </th>
    )
  }
  function sortRows(rows, getters) {
    return [...rows].sort((a, b) => {
      const getter = getters[sortCol]
      if (!getter) return 0
      const av = getter(a), bv = getter(b)
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      const as = String(av ?? ''), bs = String(bv ?? '')
      if (as < bs) return sortDir === 'asc' ? -1 : 1
      if (as > bs) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }
  return { SortTh, sortRows }
}

const BASE = import.meta.env.VITE_API_URL || '/api'

function ukTaxYears() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const years = []
  // Generate last 5 tax years
  for (let y = currentYear; y >= currentYear - 4; y--) {
    const startYear = now >= new Date(y, 3, 6) ? y : y - 1
    years.push({
      label: `${startYear}/${String(startYear + 1).slice(-2)} Tax Year`,
      from: `${startYear}-04-06`,
      to: `${startYear + 1}-04-05`,
    })
  }
  // Deduplicate
  const seen = new Set()
  return years.filter(y => { if (seen.has(y.from)) return false; seen.add(y.from); return true })
}

export default function Accounting() {
  const [pageTab, setPageTab] = useState('report') // report | mtd
  const [landlords, setLandlords] = useState([])
  const [landlordId, setLandlordId] = useState('')
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [mode, setMode] = useState('taxyear') // taxyear | custom
  const [taxYear, setTaxYear] = useState(ukTaxYears()[0])
  const [fromDate, setFromDate] = useState(ukTaxYears()[0].from)
  const [toDate, setToDate] = useState(ukTaxYears()[0].to)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    api.get('/accounting/landlords').then(r => setLandlords(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const params = landlordId ? `?landlord_id=${landlordId}` : ''
    api.get(`/accounting/properties${params}`).then(r => setProperties(r.data)).catch(() => {})
    setPropertyId('')
  }, [landlordId])

  const effectiveFrom = mode === 'taxyear' ? taxYear.from : fromDate
  const effectiveTo = mode === 'taxyear' ? taxYear.to : toDate

  async function loadReport() {
    setLoading(true)
    setReport(null)
    try {
      const params = new URLSearchParams({ from_date: effectiveFrom, to_date: effectiveTo })
      if (landlordId) params.set('landlord_id', landlordId)
      if (propertyId) params.set('property_id', propertyId)
      const r = await api.get(`/accounting/report?${params}`)
      setReport(r.data)
    } catch {}
    setLoading(false)
  }

  async function downloadFile(type) {
    setExporting(type)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ from_date: effectiveFrom, to_date: effectiveTo })
      if (landlordId) params.set('landlord_id', landlordId)
      if (propertyId) params.set('property_id', propertyId)
      const res = await fetch(`${BASE}/accounting/export/${type}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `income_expenditure_${effectiveFrom}_${effectiveTo}.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting('')
  }

  const taxYears = ukTaxYears()

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Income & expense reporting for tax and landlord statements">
        <div className="flex items-center gap-3">
          {/* Page tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setPageTab('report')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pageTab === 'report' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Report
            </button>
            <button onClick={() => setPageTab('mtd')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${pageTab === 'mtd' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Making Tax Digital
              <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">PREMIUM</span>
            </button>
          </div>
          {pageTab === 'report' && report && (
            <div className="flex gap-2">
              <button onClick={() => downloadFile('csv')} disabled={exporting === 'csv'}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors">
                {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
              </button>
              <button onClick={() => downloadFile('pdf')} disabled={exporting === 'pdf'}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors">
                {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {pageTab === 'mtd' && <MtdShell />}

      {pageTab === 'report' && <>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setMode('taxyear')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'taxyear' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            UK Tax Year
          </button>
          <button onClick={() => setMode('custom')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Custom Range
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {mode === 'taxyear' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year</label>
              <select
                value={taxYear.from}
                onChange={e => {
                  const ty = taxYears.find(y => y.from === e.target.value)
                  if (ty) setTaxYear(ty)
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              >
                {taxYears.map(y => (
                  <option key={y.from} value={y.from}>{y.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </>
          )}

          {landlords.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Landlord</label>
              <select value={landlordId} onChange={e => setLandlordId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48">
                <option value="">All landlords</option>
                {landlords.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48">
              <option value="">{landlordId ? 'All their properties' : 'All properties'}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <button onClick={loadReport} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors">
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report preview */}
      {report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-600 font-medium">Total Income</p>
              <p className="text-3xl font-bold text-green-700 mt-1">£{report.total_income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-green-500 mt-1">{report.income_count} rent payments</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm text-red-600 font-medium">Total Expenditure</p>
              <p className="text-3xl font-bold text-red-700 mt-1">£{report.total_expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-red-500 mt-1">{report.expenditure_count} maintenance jobs</p>
            </div>
            <div className={`border rounded-xl p-5 ${report.net_profit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-sm font-medium ${report.net_profit >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Net Profit</p>
              <p className={`text-3xl font-bold mt-1 ${report.net_profit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                £{report.net_profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">before tax &amp; allowances</p>
            </div>
          </div>

          {/* Per-property summary table */}
          <SummaryTable properties={report.properties} totals={{ income: report.total_income, expenditure: report.total_expenditure, net: report.net_profit }} />

          {/* Expanded per-property detail */}
          {report.properties.map(p => (
            <PropertyDetail key={p.name} prop={p} />
          ))}

          <p className="text-xs text-gray-400 text-center pb-4">
            For self-assessment reference only — verify with a qualified accountant.
          </p>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-gray-500 text-sm">Select a period and click Generate Report to preview your income &amp; expenditure statement.</p>
          <p className="text-xs text-gray-400 mt-2">Export as CSV for your accountant or PDF for your records.</p>
        </div>
      )}
      </>}
    </div>
  )
}


// ── MTD Shell ─────────────────────────────────────────────────────────────────
function MtdShell() {
  const [status, setStatus] = useState(null)
  const [quarters, setQuarters] = useState([])
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [submitting, setSubmitting] = useState(null)
  const [showNoCredentials, setShowNoCredentials] = useState(false)
  const [nino, setNino] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [ninoSaved, setNinoSaved] = useState(false)
  const [fetchingBiz, setFetchingBiz] = useState(false)
  const [bizError, setBizError] = useState('')
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState(null)

  useEffect(() => {
    api.get('/mtd/status').then(r => {
      setStatus(r.data)
      if (r.data.nino) setNino(r.data.nino)
      if (r.data.business_id) setBusinessId(r.data.business_id)
    }).catch(() => {})
    api.get('/mtd/quarters').then(r => setQuarters(r.data)).catch(() => {})
  }, [])

  async function handleConnect() {
    if (!status?.configured) { setShowNoCredentials(true); return }
    const r = await api.get('/mtd/connect')
    window.location.href = r.data.auth_url
  }

  async function handleDisconnect() {
    await api.post('/mtd/disconnect')
    setStatus(s => ({ ...s, connected: false }))
  }

  async function handlePreview(qId) {
    setPreviewing(qId)
    try {
      const r = await api.get(`/mtd/quarters/${qId}/preview`)
      setPreview({ id: qId, ...r.data })
    } catch {}
    setPreviewing(null)
  }

  async function handleSaveNino() {
    if (!nino.trim()) return
    const params = new URLSearchParams({ nino: nino.trim() })
    if (businessId.trim()) params.set('business_id', businessId.trim())
    await api.post(`/mtd/profile?${params}`)
    setNinoSaved(true)
    setStatus(s => ({ ...s, nino: nino.trim().toUpperCase(), business_id: businessId.trim() || s.business_id }))
    setTimeout(() => setNinoSaved(false), 2500)
  }

  async function handleProbe() {
    setProbing(true)
    setProbeResult(null)
    try {
      const r = await api.get('/mtd/probe-years')
      setProbeResult(r.data)
    } catch (e) {
      setProbeResult({ error: e?.response?.data?.detail || 'Probe failed' })
    }
    setProbing(false)
  }

  async function handleFetchBusinesses() {
    setFetchingBiz(true)
    setBizError('')
    try {
      const r = await api.get('/mtd/businesses')
      if (r.data.stored) {
        setBusinessId(r.data.stored)
        setStatus(s => ({ ...s, business_id: r.data.stored }))
      } else {
        setBizError(r.data.hint || 'No UK property businesses found. Enter the business ID manually.')
      }
    } catch (e) {
      setBizError(e?.response?.data?.detail || 'Could not fetch businesses from HMRC.')
    }
    setFetchingBiz(false)
  }

  async function handleSubmit(qId) {
    if (!status?.connected) { handleConnect(); return }
    setSubmitting(qId)
    try {
      await api.post(`/mtd/quarters/${qId}/submit`)
      setQuarters(qs => qs.map(q => q.id === qId ? { ...q, submitted: true } : q))
    } catch (e) {
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object'
        ? `HMRC error ${detail.status}:\n${JSON.stringify(detail.hmrc_error, null, 2)}`
        : (detail || 'Submission failed')
      alert(msg)
    }
    setSubmitting(null)
  }

  const statusStyle = {
    upcoming: 'bg-gray-100 text-gray-500',
    due: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
    submitted: 'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-6">
      {/* Connection banner */}
      <div className={`bg-white rounded-xl border p-6 flex flex-col md:flex-row items-start md:items-center gap-4 ${status?.connected ? 'border-green-200' : 'border-indigo-200'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏛️</span>
            <h2 className="text-base font-semibold text-gray-900">Making Tax Digital for Income Tax</h2>
            <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">PREMIUM</span>
            {status?.sandbox && <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">SANDBOX</span>}
          </div>
          {status?.connected ? (
            <>
              <p className="text-sm text-green-700 font-medium">✓ Connected to HMRC {status.sandbox ? 'Sandbox' : 'Production'}</p>
              {status.sandbox && <p className="text-xs text-amber-600 mt-0.5">Sandbox mode: submissions are mapped to tax year 2024-25 for testing (HMRC sandbox supports 2021-22 – 2024-25 only).</p>}
            </>
          ) : (
            <p className="text-sm text-gray-500 leading-relaxed">
              As of April 2026, landlords with income over £50,000 must submit quarterly updates to HMRC digitally.
              Connect your HMRC Government Gateway account to submit directly — all income and expenditure data is already captured.
            </p>
          )}
        </div>
        {status?.connected ? (
          <button onClick={handleDisconnect}
            className="shrink-0 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Disconnect
          </button>
        ) : (
          <button onClick={handleConnect}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Connect HMRC Account
          </button>
        )}
      </div>

      {/* NINO + Business ID — shown once connected */}
      {status?.connected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* NINO row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 mb-0.5">National Insurance Number (NINO)</p>
              <p className="text-xs text-gray-400">Your personal NINO — found on your payslip or HMRC correspondence.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={nino}
                onChange={e => { setNino(e.target.value.toUpperCase()); setNinoSaved(false) }}
                placeholder="e.g. AB123456C"
                maxLength={9}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono w-36 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button onClick={handleSaveNino}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${ninoSaved ? 'bg-green-100 text-green-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                {ninoSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>
          {/* Business ID row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-gray-100">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 mb-0.5">Property Business ID</p>
              <p className="text-xs text-gray-400">Your HMRC property business source ID — click Fetch to retrieve automatically, or enter manually.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={businessId}
                onChange={e => { setBusinessId(e.target.value); setNinoSaved(false) }}
                placeholder="e.g. XAIS12345678901"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button onClick={handleFetchBusinesses} disabled={fetchingBiz || !nino}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40">
                {fetchingBiz ? '…' : 'Fetch'}
              </button>
            </div>
          </div>
          {bizError && <p className="text-xs text-red-600 pt-1">{bizError}</p>}
          {/* Tax year probe */}
          <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
            <button onClick={handleProbe} disabled={probing}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40">
              {probing ? 'Probing HMRC…' : 'Diagnose supported tax years'}
            </button>
            {probeResult && (
              <button onClick={() => setProbeResult(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          {probeResult && (
            <pre className="text-[10px] bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-auto max-h-48 text-gray-600 mt-1">
              {JSON.stringify(probeResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Quarterly periods */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Quarterly Update Periods</h3>
          <p className="text-xs text-gray-400">Submissions replace your annual Self Assessment for property income</p>
        </div>
        {quarters.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading periods…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Period</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Dates</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Due by</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quarters.map(q => {
                const s = q.submitted ? 'submitted' : q.status
                return (
                  <Fragment key={q.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{q.label}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(q.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} → {new Date(q.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(q.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[s] || 'bg-gray-100 text-gray-500'}`}>
                          {s === 'submitted' ? '✓ Submitted' : s === 'upcoming' ? 'Upcoming' : s === 'due' ? 'Due' : 'Overdue'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handlePreview(q.id)} disabled={previewing === q.id}
                            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                            {previewing === q.id ? '…' : 'Preview'}
                          </button>
                          {!q.submitted && (
                            q.pre_mtd ? (
                              <span className="text-xs text-gray-400 border border-gray-100 px-3 py-1 rounded-lg" title="MTD ITSA applies from 2026-27 onwards">
                                Pre-MTD
                              </span>
                            ) : (
                              <button onClick={() => handleSubmit(q.id)} disabled={submitting === q.id}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                {submitting === q.id ? 'Submitting…' : 'Submit to HMRC'}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {preview?.id === q.id && (
                      <tr>
                        <td colSpan="5" className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-6 text-sm">
                            <span className="text-gray-500">Income: <strong className="text-gray-800">£{preview.summary?.income?.toFixed(2)}</strong></span>
                            <span className="text-gray-500">Expenses: <strong className="text-gray-800">£{preview.summary?.expenditure?.toFixed(2)}</strong></span>
                            <span className="text-gray-500">Net: <strong className="text-gray-800">£{preview.summary?.net?.toFixed(2)}</strong></span>
                            <button onClick={() => setPreview(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
                          </div>
                          <pre className="mt-3 text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-40 text-gray-600">
                            {JSON.stringify(preview.payload, null, 2)}
                          </pre>
                          <p className="mt-2 text-[10px] text-gray-400">↑ HMRC MTD Property Business API — periodic summary payload</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '📋', title: 'Income already tracked', body: 'All rent payments are mapped to HMRC property income categories automatically.' },
          { icon: '🔧', title: 'Expenses already tracked', body: 'Maintenance costs and contractor invoices are categorised to HMRC allowable expense codes.' },
          { icon: '🔒', title: 'Digital link compliant', body: 'PropAIrty maintains a full digital audit trail satisfying HMRC\'s digital link requirement.' },
        ].map(c => (
          <div key={c.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-2xl mb-2">{c.icon}</p>
            <p className="font-semibold text-gray-800 text-sm mb-1">{c.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {/* No-credentials modal */}
      {showNoCredentials && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7">
            <p className="text-2xl mb-3">🏛️</p>
            <h3 className="text-lg font-bold text-gray-900 mb-2">HMRC Credentials Needed</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              To enable live submissions, register a free application at{' '}
              <a href="https://developer.service.hmrc.gov.uk" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">developer.service.hmrc.gov.uk</a>{' '}
              and add the following to your server's <code className="bg-gray-100 px-1 rounded">.env.production</code>:
            </p>
            <pre className="bg-gray-100 rounded-lg p-3 text-xs text-gray-700 mb-5">
{`HMRC_CLIENT_ID=your_client_id
HMRC_CLIENT_SECRET=your_client_secret
HMRC_SANDBOX=true`}
            </pre>
            <p className="text-xs text-gray-400 mb-5">The sandbox at <code>test-api.service.hmrc.gov.uk</code> is free and uses HMRC test users — no real tax data is submitted.</p>
            <button onClick={() => setShowNoCredentials(false)}
              className="w-full border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTable({ properties, totals }) {
  const { SortTh, sortRows } = useSortable('name')
  const getters = {
    name:              p => p.name,
    total_income:      p => p.total_income,
    total_expenditure: p => p.total_expenditure,
    net:               p => p.net,
  }
  const sorted = sortRows(properties, getters)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700 text-sm">Per-Property Summary</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <SortTh col="name" label="Property" />
            <SortTh col="total_income" label="Income" right />
            <SortTh col="total_expenditure" label="Expenditure" right />
            <SortTh col="net" label="Net" right />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(p => (
            <Fragment key={p.name}>
              <tr className={`hover:bg-gray-50 ${p.units && p.units.length > 1 ? 'border-b-0' : ''}`}>
                <td className="px-5 py-3 font-semibold text-gray-900">
                  {p.name}
                  <span className="text-xs text-gray-400 font-normal ml-2">{p.income_rows.length} payments · {p.expenditure_rows.length} jobs</span>
                </td>
                <td className="px-5 py-3 text-right text-green-600 font-semibold">£{p.total_income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 text-right text-red-500 font-semibold">£{p.total_expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className={`px-5 py-3 text-right font-bold ${p.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>£{p.net.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
              </tr>
              {p.units && p.units.length > 1 && p.units.map(u => (
                <tr key={u.unit_name} className="bg-gray-50/60 hover:bg-gray-100/60 border-t border-gray-50">
                  <td className="px-5 py-2 pl-10 text-sm text-gray-500">
                    <span className="text-gray-300 mr-1.5">└</span>{u.unit_name}
                    <span className="text-xs text-gray-400 ml-2">{u.income_count} payments · {u.expenditure_count} jobs</span>
                  </td>
                  <td className="px-5 py-2 text-right text-sm text-green-500">£{u.income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-2 text-right text-sm text-red-400">£{u.expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className={`px-5 py-2 text-right text-sm ${u.net >= 0 ? 'text-blue-500' : 'text-amber-500'}`}>£{u.net.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
            <td className="px-5 py-3 text-gray-700">Total</td>
            <td className="px-5 py-3 text-right text-green-700">£{totals.income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
            <td className="px-5 py-3 text-right text-red-600">£{totals.expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
            <td className={`px-5 py-3 text-right ${totals.net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>£{totals.net.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}


function PropertyDetail({ prop }) {
  const [open, setOpen] = useState(false)
  const { SortTh: ISortTh, sortRows: iSortRows } = useSortable('paid_date')
  const { SortTh: ESortTh, sortRows: eSortRows } = useSortable('date')

  const sortedIncome = iSortRows(prop.income_rows, {
    paid_date:   r => r.paid_date,
    tenant_name: r => r.tenant_name,
    unit_name:   r => r.unit_name,
    period:      r => r.period,
    amount:      r => r.amount,
  })
  const sortedExpenditure = eSortRows(prop.expenditure_rows, {
    date:        r => r.date,
    title:       r => r.title,
    contractor:  r => r.contractor || '',
    invoice_ref: r => r.invoice_ref || '',
    amount:      r => r.amount,
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{prop.name}</span>
          <span className="text-xs text-gray-400">{prop.income_rows.length} income · {prop.expenditure_rows.length} expenditure</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-600 font-semibold">+£{prop.total_income.toFixed(2)}</span>
          <span className="text-sm text-red-500 font-semibold">-£{prop.total_expenditure.toFixed(2)}</span>
          <span className={`text-sm font-bold ${prop.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>= £{prop.net.toFixed(2)}</span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {prop.income_rows.length > 0 && (
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-green-600 uppercase mb-3">Income — Rent Received</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs bg-green-50">
                    <ISortTh col="paid_date" label="Date Paid" />
                    <ISortTh col="tenant_name" label="Tenant" />
                    <ISortTh col="unit_name" label="Unit" />
                    <ISortTh col="period" label="Period" />
                    <ISortTh col="amount" label="Amount" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedIncome.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{fmt(r.paid_date)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.tenant_name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.unit_name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.period}</td>
                      <td className="px-3 py-2 text-right text-green-600 font-semibold">£{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prop.expenditure_rows.length > 0 && (
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-red-500 uppercase mb-3">Expenditure — Maintenance &amp; Repairs</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs bg-red-50">
                    <ESortTh col="date" label="Date" />
                    <ESortTh col="title" label="Description" />
                    <ESortTh col="contractor" label="Contractor" />
                    <ESortTh col="invoice_ref" label="Invoice Ref" />
                    <ESortTh col="amount" label="Amount" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedExpenditure.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{fmt(r.date)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.title}</td>
                      <td className="px-3 py-2 text-gray-500">{r.contractor || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{r.invoice_ref || '—'}</td>
                      <td className="px-3 py-2 text-right text-red-500 font-semibold">£{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prop.income_rows.length === 0 && prop.expenditure_rows.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-400">No transactions recorded for this property in the selected period.</p>
          )}
        </div>
      )}
    </div>
  )
}
