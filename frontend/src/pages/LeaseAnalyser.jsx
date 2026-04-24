import { PageHeader } from '../components/Illustration'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

// Estimate property value from postcode area + monthly rent using typical regional yields
function estimateValue(postcode, monthlyRent) {
  if (!monthlyRent) return ''
  const area = (postcode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
  const londonAreas = ['E','W','N','EC','WC','SW','SE','NW']
  const midNorthAreas = ['M','LS','B','S','L','MK','BS','CF','NG','LE','OX','CB']
  const northEastAreas = ['NE','SR','TS','DH']
  let yield_ = 0.055 // default
  if (londonAreas.some(a => area === a || area.startsWith(a))) yield_ = 0.04
  else if (midNorthAreas.some(a => area === a || area.startsWith(a))) yield_ = 0.05
  else if (northEastAreas.some(a => area === a || area.startsWith(a))) yield_ = 0.065
  const annual = monthlyRent * 12
  return Math.round(annual / yield_ / 5000) * 5000 // round to nearest £5k
}

function parseAddress(full) {
  if (!full) return { address_line1: '', address_line2: '', city: '', postcode: '' }
  const parts = full.split(',').map(s => s.trim()).filter(Boolean)
  const ukPostcode = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i
  let postcode = '', city = ''
  if (parts.length >= 1 && ukPostcode.test(parts[parts.length - 1])) {
    postcode = parts.pop().toUpperCase()
  }
  if (parts.length >= 1) city = parts.pop()
  const address_line1 = parts[0] || full
  const address_line2 = parts.slice(1).join(', ')
  return { address_line1, address_line2, city, postcode }
}

// Convert DD/MM/YYYY → YYYY-MM-DD for API
function toISODate(ddmmyyyy) {
  if (!ddmmyyyy) return ''
  const [d, m, y] = ddmmyyyy.split('/')
  if (!d || !m || !y) return ''
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function guessUnitName(ex) {
  const src = [ex.permitted_use || '', ...(ex.special_conditions || [])].join(' ')
  const m = src.match(/room\s+\w+/i)
  if (m) return m[0].charAt(0).toUpperCase() + m[0].slice(1)
  return 'Unit 1'
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  )
}

function StepHeader({ number, title, status, subtitle }) {
  const colours = {
    done:    'bg-green-100 text-green-700 border-green-200',
    active:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    pending: 'bg-gray-50 text-gray-400 border-gray-200',
  }
  const badges = { done: '✓', active: number, pending: number }
  return (
    <div className={`flex items-center gap-3 px-5 py-3 border-b ${colours[status]}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${colours[status]}`}>
        {badges[status]}
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
      </div>
    </div>
  )
}

export default function LeaseAnalyser() {
  const [tab, setTab] = useState('upload') // 'upload' | 'paste'
  const [file, setFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [importStep, setImportStep] = useState(0)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [created, setCreated] = useState({ property: null, unit: null, landlord: null, tenant: null })

  const [propForm, setPropForm] = useState({})
  const [unitForm, setUnitForm] = useState({})
  const [landlordForm, setLandlordForm] = useState({})
  const [tenantForm, setTenantForm] = useState({})
  const [leaseForm, setLeaseForm] = useState({})
  const [rtrForm, setRtrForm] = useState({ rtr_document_type: 'British Passport', rtr_check_date: new Date().toISOString().slice(0,10), rtr_expiry_date: '', no_expiry: true })
  const [valuationForm, setValuationForm] = useState({ estimated_value: '', valuation_date: new Date().toISOString().slice(0,10), notes: '' })

  const analyse = async () => {
    if (tab === 'upload' && !file) return
    if (tab === 'paste' && !pasteText.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setImportStep(0)
    setCreated({ property: null, unit: null, landlord: null, tenant: null })
    try {
      let res
      if (tab === 'paste') {
        res = await api.post('/intelligence/lease-analyse-text', { text: pasteText })
      } else {
        const fd = new FormData()
        fd.append('file', file)
        res = await api.post('/intelligence/lease-analyse', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      const ex = res.data?.extracted || {}
      setResult(res.data)
      const addr = parseAddress(ex.property_address)
      setPropForm({
        name: addr.address_line1 || ex.property_address || '',
        address_line1: addr.address_line1 || '',
        address_line2: addr.address_line2 || '',
        city: addr.city || '',
        postcode: addr.postcode || '',
        property_type: 'residential',
        description: '',
        epc_rating: '',
      })
      setUnitForm({
        name: guessUnitName(ex),
        bedrooms: 1,
        bathrooms: 1,
        monthly_rent: ex.monthly_rent || '',
      })
      setLandlordForm({ full_name: ex.landlord_name || '', email: ex.landlord_email || '', phone: ex.landlord_phone || '' })
      setTenantForm({ full_name: ex.tenant_name || '', email: ex.tenant_email || '', phone: ex.tenant_phone || '' })
      setLeaseForm({
        start_date: toISODate(ex.start_date),
        end_date: toISODate(ex.end_date),
        monthly_rent: ex.monthly_rent || '',
        deposit: ex.deposit || '',
        rent_day: 1,
        is_periodic: false,
      })
      const est = estimateValue(addr.postcode, ex.monthly_rent)
      setValuationForm(f => ({ ...f, estimated_value: est }))
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyResults = () => {
    const ex = result?.extracted || {}
    const lines = [
      `LEASE ANALYSIS — ${result?.filename}`,
      '',
      `Tenancy Type: ${ex.tenancy_type || 'N/A'}`,
      `Tenant: ${ex.tenant_name || 'N/A'}`,
      `Landlord: ${ex.landlord_name || 'N/A'}`,
      `Property: ${ex.property_address || 'N/A'}`,
      `Monthly Rent: £${ex.monthly_rent || 'N/A'}`,
      `Start: ${ex.start_date || 'N/A'}   End: ${ex.end_date || 'N/A'}`,
      `Term: ${ex.term_months ? ex.term_months + ' months' : 'N/A'}`,
      `Deposit: £${ex.deposit || 'N/A'} (${ex.deposit_scheme || 'N/A'})`,
      `Break Clause: ${ex.break_clause || 'None'}`,
      `Notice (Tenant): ${ex.notice_period_tenant || 'N/A'}`,
      `Notice (Landlord): ${ex.notice_period_landlord || 'N/A'}`,
      '',
      ...(ex.unusual_clauses?.length ? ['UNUSUAL CLAUSES:', ...ex.unusual_clauses.map(c => `• ${c}`), ''] : []),
      ...(ex.risk_flags?.length ? ['AGENT RISK FLAGS:', ...ex.risk_flags.map(c => `• ${c}`)] : []),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const createProperty = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      const propRes = await api.post('/properties', { ...propForm, landlord_id: null })
      const prop = propRes.data
      const unitRes = await api.post(`/properties/${prop.id}/units`, {
        ...unitForm,
        monthly_rent: Number(unitForm.monthly_rent),
        bedrooms: Number(unitForm.bedrooms),
        bathrooms: Number(unitForm.bathrooms),
      })

      // Upload the original document against the property
      const docFd = new FormData()
      docFd.append('entity_type', 'property')
      docFd.append('entity_id', prop.id)
      docFd.append('category', 'agreement')
      docFd.append('description', 'Tenancy Agreement')
      if (tab === 'paste') {
        const blob = new Blob([pasteText], { type: 'text/plain' })
        docFd.append('file', new File([blob], 'tenancy-agreement.txt', { type: 'text/plain' }))
      } else {
        docFd.append('file', file)
      }
      await api.post('/uploads', docFd, { headers: { 'Content-Type': 'multipart/form-data' } })

      setCreated(c => ({ ...c, property: prop, unit: unitRes.data }))
      setImportStep(2)
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const createLandlord = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      const res = await api.post('/landlord/landlords', landlordForm)
      await api.put(`/properties/${created.property.id}`, { ...propForm, landlord_id: res.data.id })
      setCreated(c => ({ ...c, landlord: res.data }))
      setImportStep(3)
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const createTenant = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      const res = await api.post('/tenants', tenantForm)
      setCreated(c => ({ ...c, tenant: res.data }))
      setImportStep(4)
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const createLease = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      const res = await api.post('/leases', {
        unit_id: created.unit.id,
        tenant_id: created.tenant.id,
        start_date: leaseForm.start_date,
        end_date: leaseForm.end_date || null,
        monthly_rent: Number(leaseForm.monthly_rent),
        deposit: leaseForm.deposit ? Number(leaseForm.deposit) : null,
        rent_day: Number(leaseForm.rent_day) || 1,
        is_periodic: leaseForm.is_periodic,
        status: 'active',
      })

      // Also link the document to the lease record
      const docFd = new FormData()
      docFd.append('entity_type', 'lease')
      docFd.append('entity_id', res.data.id)
      docFd.append('category', 'agreement')
      docFd.append('description', 'Tenancy Agreement')
      if (tab === 'paste') {
        const blob = new Blob([pasteText], { type: 'text/plain' })
        docFd.append('file', new File([blob], 'tenancy-agreement.txt', { type: 'text/plain' }))
      } else {
        docFd.append('file', file)
      }
      await api.post('/uploads', docFd, { headers: { 'Content-Type': 'multipart/form-data' } })

      // Create deposit record
      if (leaseForm.deposit) {
        await api.post('/deposits', {
          lease_id: res.data.id,
          amount: Number(leaseForm.deposit),
          scheme: ex.deposit_scheme || null,
          received_date: leaseForm.start_date,
          status: 'unprotected',
        }).catch(() => {})
      }

      // Seed compliance records for this property
      await api.post('/compliance/seed', {
        property_id: created.property.id,
        start_date: leaseForm.start_date,
      }).catch(() => {}) // non-fatal

      setCreated(c => ({ ...c, lease: res.data }))
      setImportStep(5) // → Right to Rent
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const saveValuation = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      await api.post(`/valuation/${created.property.id}`, {
        estimated_value: Number(valuationForm.estimated_value),
        valuation_date: valuationForm.valuation_date,
        source: 'AI estimate (lease import)',
        notes: valuationForm.notes || 'Auto-estimated at lease import based on postcode area and rental yield.',
      })
      setImportStep(7)
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const saveRtr = async () => {
    setImportLoading(true)
    setImportError('')
    try {
      await api.put(`/rtr/${created.tenant.id}`, {
        rtr_document_type: rtrForm.rtr_document_type,
        rtr_check_date: rtrForm.rtr_check_date,
        rtr_expiry_date: rtrForm.no_expiry ? null : (rtrForm.rtr_expiry_date || null),
      })
      setImportStep(6) // → Valuation
    } catch (e) {
      setImportError(e.response?.data?.detail || e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const ex = result?.extracted || {}

  const fields = result ? [
    { label: 'Tenancy Type',      value: ex.tenancy_type },
    { label: 'Tenant',            value: ex.tenant_name },
    { label: 'Landlord',          value: ex.landlord_name },
    { label: 'Monthly Rent',      value: ex.monthly_rent ? `£${Number(ex.monthly_rent).toLocaleString()}` : null },
    { label: 'Tenancy Start',     value: ex.start_date },
    { label: 'Tenancy End',       value: ex.end_date },
    { label: 'Term',              value: ex.term_months ? `${ex.term_months} months` : null },
    { label: 'Deposit',           value: ex.deposit ? `£${Number(ex.deposit).toLocaleString()}` : null },
    { label: 'Deposit Scheme',    value: ex.deposit_scheme },
    { label: 'Rent Review',       value: ex.rent_review_clause },
    { label: 'Break Clause',      value: ex.break_clause },
    { label: 'Notice (Tenant)',   value: ex.notice_period_tenant },
    { label: 'Notice (Landlord)', value: ex.notice_period_landlord },
    { label: 'Pets Allowed',      value: ex.pets_allowed === true ? 'Yes' : ex.pets_allowed === false ? 'No' : null },
    { label: 'Smoking',           value: ex.smoking_allowed === true ? 'Permitted' : ex.smoking_allowed === false ? 'Not permitted' : null },
    { label: 'Subletting',        value: ex.subletting_allowed === true ? 'Permitted' : ex.subletting_allowed === false ? 'Not permitted' : null },
  ] : []

  const stepStatus = (n) => {
    if (importStep === 7 || importStep > n) return 'done'
    if (importStep === n) return 'active'
    return 'pending'
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="AI Lease Analyser" subtitle="Upload a lease PDF — AI extracts key terms and flags unusual clauses" />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === 'upload' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Upload PDF
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === 'paste' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Paste text
          </button>
        </div>

        <div className="p-6">
          {tab === 'upload' ? (
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              onClick={() => document.getElementById('lease-input').click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
            >
              <div className="text-4xl mb-3">📄</div>
              {file ? (
                <div>
                  <p className="font-medium text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 font-medium">Drop lease PDF here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">PDF files only · Max 20 pages analysed</p>
                </div>
              )}
              <input id="lease-input" type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </div>
          ) : (
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste the full lease text here…"
              rows={12}
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          )}

          <button
            onClick={analyse}
            disabled={loading || (tab === 'upload' ? !file : !pasteText.trim())}
            className="mt-4 w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Analysing lease…' : 'Analyse Lease'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {/* Key terms */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Extracted Key Terms</h2>
              <button
                onClick={copyResults}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {copied ? '✓ Copied' : 'Copy to clipboard'}
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
              {fields.map(({ label, value }) => (
                <div key={label} className="px-5 py-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
                  <div className="text-sm font-medium text-gray-900 mt-0.5">{value || <span className="text-gray-400">Not found</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {ex.special_conditions?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Special Conditions</h2>
              <ul className="space-y-1">
                {ex.special_conditions.map((c, i) => (
                  <li key={i} className="text-sm text-gray-600">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {ex.unusual_clauses?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-amber-900 mb-1">⚠️ Unusual or Notable Clauses</h2>
              <p className="text-xs text-amber-700 mb-2">Terms the tenant should be aware of before signing.</p>
              <ul className="space-y-1">
                {ex.unusual_clauses.map((c, i) => (
                  <li key={i} className="text-sm text-amber-800">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {ex.risk_flags?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-red-900 mb-1">🚩 Agent Risk Flags</h2>
              <p className="text-xs text-red-700 mb-2">Compliance, liability or legal issues requiring agent attention.</p>
              <ul className="space-y-1">
                {ex.risk_flags.map((c, i) => (
                  <li key={i} className="text-sm text-red-800">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import wizard */}
          {importStep === 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Import to system</p>
                <p className="text-xs text-indigo-700 mt-0.5">Create the property, landlord and tenant records pre-filled from this lease.</p>
              </div>
              <button
                onClick={() => setImportStep(1)}
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
              >
                Start import
              </button>
            </div>
          )}

          {importStep >= 1 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden space-y-0 divide-y divide-gray-100">

              {/* Step 1: Property + Unit */}
              <div>
                <StepHeader
                  number={1}
                  title="Property & Unit"
                  status={stepStatus(1)}
                  subtitle={created.property ? `Created: ${created.property.name}` : 'Address and letting details'}
                />
                {importStep === 1 && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Property name" value={propForm.name} onChange={v => setPropForm(f => ({ ...f, name: v }))} required />
                      </div>
                      <div className="col-span-2">
                        <Field label="Address line 1" value={propForm.address_line1} onChange={v => setPropForm(f => ({ ...f, address_line1: v }))} required />
                      </div>
                      <Field label="Address line 2" value={propForm.address_line2} onChange={v => setPropForm(f => ({ ...f, address_line2: v }))} />
                      <Field label="City" value={propForm.city} onChange={v => setPropForm(f => ({ ...f, city: v }))} required />
                      <Field label="Postcode" value={propForm.postcode} onChange={v => setPropForm(f => ({ ...f, postcode: v }))} required />
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Property type</label>
                        <select
                          value={propForm.property_type}
                          onChange={e => setPropForm(f => ({ ...f, property_type: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="residential">Residential</option>
                          <option value="hmo">HMO</option>
                          <option value="commercial">Commercial</option>
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Unit / Room</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <Field label="Unit name" value={unitForm.name} onChange={v => setUnitForm(f => ({ ...f, name: v }))} required />
                        </div>
                        <Field label="Monthly rent (£)" value={unitForm.monthly_rent} onChange={v => setUnitForm(f => ({ ...f, monthly_rent: v }))} type="number" required />
                        <Field label="Bedrooms" value={unitForm.bedrooms} onChange={v => setUnitForm(f => ({ ...f, bedrooms: v }))} type="number" />
                      </div>
                    </div>
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={createProperty}
                      disabled={importLoading || !propForm.address_line1 || !propForm.city || !propForm.postcode}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Creating…' : 'Create property & unit'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Landlord */}
              <div>
                <StepHeader
                  number={2}
                  title="Landlord"
                  status={stepStatus(2)}
                  subtitle={created.landlord ? `Created: ${created.landlord.full_name}` : 'Will be linked to the property'}
                />
                {importStep === 2 && (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Full name" value={landlordForm.full_name} onChange={v => setLandlordForm(f => ({ ...f, full_name: v }))} required />
                      </div>
                      <Field label="Email address" value={landlordForm.email} onChange={v => setLandlordForm(f => ({ ...f, email: v }))} type="email" required />
                      <Field label="Phone" value={landlordForm.phone} onChange={v => setLandlordForm(f => ({ ...f, phone: v }))} />
                    </div>
                    <p className="text-xs text-gray-400">A portal login can be set up for the landlord later from their profile.</p>
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={createLandlord}
                      disabled={importLoading || !landlordForm.full_name || !landlordForm.email}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Creating…' : 'Create landlord'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3: Tenant */}
              <div>
                <StepHeader
                  number={3}
                  title="Tenant"
                  status={stepStatus(3)}
                  subtitle={created.tenant ? `Created: ${created.tenant.full_name}` : 'Tenant details from the lease'}
                />
                {importStep === 3 && (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Full name" value={tenantForm.full_name} onChange={v => setTenantForm(f => ({ ...f, full_name: v }))} required />
                      </div>
                      <Field label="Email address" value={tenantForm.email} onChange={v => setTenantForm(f => ({ ...f, email: v }))} type="email" />
                      <Field label="Phone" value={tenantForm.phone} onChange={v => setTenantForm(f => ({ ...f, phone: v }))} />
                    </div>
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={createTenant}
                      disabled={importLoading || !tenantForm.full_name}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Creating…' : 'Create tenant'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 4: Lease */}
              <div>
                <StepHeader
                  number={4}
                  title="Lease"
                  status={stepStatus(4)}
                  subtitle={created.lease ? 'Tenant linked to unit — tenancy is live' : 'Links tenant to the unit with correct dates'}
                />
                {importStep === 4 && (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start date" value={leaseForm.start_date} onChange={v => setLeaseForm(f => ({ ...f, start_date: v }))} type="date" required />
                      <Field label="End date" value={leaseForm.end_date} onChange={v => setLeaseForm(f => ({ ...f, end_date: v }))} type="date" />
                      <Field label="Monthly rent (£)" value={leaseForm.monthly_rent} onChange={v => setLeaseForm(f => ({ ...f, monthly_rent: v }))} type="number" required />
                      <Field label="Deposit (£)" value={leaseForm.deposit} onChange={v => setLeaseForm(f => ({ ...f, deposit: v }))} type="number" />
                      <Field label="Rent due day" value={leaseForm.rent_day} onChange={v => setLeaseForm(f => ({ ...f, rent_day: v }))} type="number" />
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          id="is_periodic"
                          type="checkbox"
                          checked={leaseForm.is_periodic}
                          onChange={e => setLeaseForm(f => ({ ...f, is_periodic: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="is_periodic" className="text-sm text-gray-600">Periodic tenancy</label>
                      </div>
                    </div>
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={createLease}
                      disabled={importLoading || !leaseForm.start_date || !leaseForm.monthly_rent}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Creating…' : 'Create lease & activate tenancy'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 5: Right to Rent */}
              <div>
                <StepHeader
                  number={5}
                  title="Right to Rent"
                  status={stepStatus(5)}
                  subtitle={importStep > 5 ? `Checked — ${rtrForm.rtr_document_type}` : `UK immigration check · £20,000 penalty for non-compliance`}
                />
                {importStep === 5 && (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Document type<span className="text-red-500 ml-0.5">*</span></label>
                        <select
                          value={rtrForm.rtr_document_type}
                          onChange={e => setRtrForm(f => ({ ...f, rtr_document_type: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                          <option>British Passport</option>
                          <option>EU/EEA Passport</option>
                          <option>Biometric Residence Permit</option>
                          <option>EUSS Settled Status</option>
                          <option>EUSS Pre-Settled Status</option>
                          <option>Visa</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <Field label="Check date" value={rtrForm.rtr_check_date} onChange={v => setRtrForm(f => ({ ...f, rtr_check_date: v }))} type="date" required />
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          id="no_expiry"
                          type="checkbox"
                          checked={rtrForm.no_expiry}
                          onChange={e => setRtrForm(f => ({ ...f, no_expiry: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="no_expiry" className="text-sm text-gray-600">No expiry (British / ILR / Settled)</label>
                      </div>
                      {!rtrForm.no_expiry && (
                        <div className="col-span-2">
                          <Field label="Document expiry date" value={rtrForm.rtr_expiry_date} onChange={v => setRtrForm(f => ({ ...f, rtr_expiry_date: v }))} type="date" required />
                        </div>
                      )}
                    </div>
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={saveRtr}
                      disabled={importLoading || !rtrForm.rtr_document_type || !rtrForm.rtr_check_date}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Saving…' : 'Save Right to Rent check'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 6: Valuation */}
              <div>
                <StepHeader
                  number={6}
                  title="Property Valuation"
                  status={stepStatus(6)}
                  subtitle={importStep > 6 ? `Estimated £${Number(valuationForm.estimated_value).toLocaleString()}` : 'AI estimate based on postcode and rental yield'}
                />
                {importStep === 6 && (
                  <div className="p-5 space-y-3">
                    <p className="text-xs text-gray-500">
                      Estimated using typical gross yield for the <strong>{propForm.postcode?.split(' ')[0] || 'local'}</strong> area.
                      Adjust to reflect actual market conditions before saving.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Estimated value (£)"
                        value={valuationForm.estimated_value}
                        onChange={v => setValuationForm(f => ({ ...f, estimated_value: v }))}
                        type="number"
                        required
                      />
                      <Field
                        label="Valuation date"
                        value={valuationForm.valuation_date}
                        onChange={v => setValuationForm(f => ({ ...f, valuation_date: v }))}
                        type="date"
                        required
                      />
                      <div className="col-span-2">
                        <Field
                          label="Notes (optional)"
                          value={valuationForm.notes}
                          onChange={v => setValuationForm(f => ({ ...f, notes: v }))}
                        />
                      </div>
                    </div>
                    {valuationForm.estimated_value && (
                      <p className="text-xs text-indigo-600">
                        Gross yield: <strong>{((Number(leaseForm.monthly_rent) * 12) / Number(valuationForm.estimated_value) * 100).toFixed(2)}%</strong> at £{Number(valuationForm.estimated_value).toLocaleString()}
                      </p>
                    )}
                    {importError && <p className="text-red-600 text-sm">{importError}</p>}
                    <button
                      onClick={saveValuation}
                      disabled={importLoading || !valuationForm.estimated_value}
                      className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {importLoading ? 'Saving…' : 'Save valuation'}
                    </button>
                  </div>
                )}
              </div>

              {/* Done */}
              {importStep === 7 && (
                <div className="p-5 bg-green-50">
                  <p className="text-sm font-semibold text-green-800 mb-1">Tenancy fully set up</p>
                  <p className="text-xs text-green-700 mb-3">Property, landlord, tenant and lease all created and linked.</p>
                  <div className="flex flex-wrap gap-2">
                    {created.property && (
                      <Link
                        to={`/properties/${created.property.id}`}
                        className="text-sm text-indigo-600 hover:underline bg-white border border-indigo-200 rounded-lg px-3 py-1.5"
                      >
                        View property →
                      </Link>
                    )}
                    {created.tenant && (
                      <Link
                        to={`/tenants/${created.tenant.id}`}
                        className="text-sm text-indigo-600 hover:underline bg-white border border-indigo-200 rounded-lg px-3 py-1.5"
                      >
                        View tenant →
                      </Link>
                    )}
                    {created.landlord && (
                      <Link
                        to={`/landlords/${created.landlord.id}`}
                        className="text-sm text-indigo-600 hover:underline bg-white border border-indigo-200 rounded-lg px-3 py-1.5"
                      >
                        View landlord →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
