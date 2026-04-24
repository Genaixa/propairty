import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const STATUS_CONFIG = {
  sent: { label: 'Awaiting response', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  accepted: { label: 'Accepted', bg: 'bg-green-100', text: 'text-green-700' },
  declined: { label: 'Declined', bg: 'bg-red-100', text: 'text-red-700' },
  expired: { label: 'Expired', bg: 'bg-gray-100', text: 'text-gray-500' },
}

function urgencyColor(days) {
  if (days == null) return 'text-gray-400'
  if (days <= 0) return 'text-red-600 font-bold'
  if (days <= 30) return 'text-red-600 font-semibold'
  if (days <= 60) return 'text-orange-600 font-semibold'
  return 'text-yellow-600'
}

export default function Renewals() {
  const [leases, setLeases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('action')
  const [showOffer, setShowOffer] = useState(null) // lease data for modal
  const [downloading, setDownloading] = useState(null)
  const [downloadingS13, setDownloadingS13] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/renewals')
      setLeases(res.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(renewalId) {
    if (!confirm('Mark this renewal as accepted and create a new lease?')) return
    await api.put(`/renewals/${renewalId}/respond?status=accepted`)
    load()
  }

  async function handleDecline(renewalId) {
    await api.put(`/renewals/${renewalId}/respond?status=declined`)
    load()
  }

  async function downloadOffer(renewalId) {
    setDownloading(renewalId)
    try {
      const res = await api.get(`/renewals/${renewalId}/report`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `renewal-offer-${renewalId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  async function downloadSection13(leaseId, renewal) {
    setDownloadingS13(renewal.id)
    try {
      const res = await api.post('/documents/generate', {
        lease_id: leaseId,
        doc_type: 'rent_increase',
        new_rent: renewal.proposed_rent,
        effective_date: renewal.proposed_start,
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `section-13-notice-${leaseId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingS13(null)
    }
  }

  // Separate: no offer sent vs offer sent
  const noOffer = leases.filter(l => !l.renewal)
  const offerSent = leases.filter(l => l.renewal && l.renewal.status === 'sent')
  const responded = leases.filter(l => l.renewal && ['accepted', 'declined', 'expired'].includes(l.renewal.status))
  const displayed = tab === 'action' ? noOffer : tab === 'sent' ? offerSent : responded

  const alreadyExpiredNoOffer = noOffer.filter(l => l.days_to_expiry != null && l.days_to_expiry < 0).length

  const [sortCol, setSortCol] = useState('end_date')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  const sortedDisplayed = [...displayed].sort((a, b) => {
    let av, bv
    if      (sortCol === 'tenant_name')  { av = a.tenant_name || '';    bv = b.tenant_name || '' }
    else if (sortCol === 'property')     { av = a.property || '';       bv = b.property || '' }
    else if (sortCol === 'monthly_rent') { av = a.monthly_rent || 0;    bv = b.monthly_rent || 0; return sortDir === 'asc' ? av - bv : bv - av }
    else                                 { av = a.end_date || '';       bv = b.end_date || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      <PageHeader title="Lease Renewals" subtitle="Manage renewal offers for expiring tenancies" />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`border rounded-xl p-4 cursor-pointer transition-all ${tab === 'action' ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200 hover:border-orange-200'}`} onClick={() => setTab('action')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Need action — no offer sent</p>
          <p className={`text-3xl font-bold mt-1 ${noOffer.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{noOffer.length}</p>
          {alreadyExpiredNoOffer > 0 && <p className="text-xs text-red-500 mt-1">{alreadyExpiredNoOffer} already past end date</p>}
        </div>
        <div className={`border rounded-xl p-4 cursor-pointer transition-all ${tab === 'sent' ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200 hover:border-yellow-200'}`} onClick={() => setTab('sent')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Offer sent — awaiting response</p>
          <p className={`text-3xl font-bold mt-1 ${offerSent.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{offerSent.length}</p>
          <p className="text-xs text-gray-400 mt-1">Tenant has been sent a renewal offer</p>
        </div>
        <div className={`border rounded-xl p-4 cursor-pointer transition-all ${tab === 'history' ? 'bg-gray-100 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'}`} onClick={() => setTab('history')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Responded</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{responded.length}</p>
          <p className="text-xs text-gray-400 mt-1">Accepted or declined by tenant</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          ['action', `Action Required (${noOffer.length})`],
          ['sent', `Offer Sent (${offerSent.length})`],
          ['history', `Responded (${responded.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {tab === 'action' ? 'All expiring leases have offers sent.' :
             tab === 'sent' ? 'No pending offers.' : 'No history yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortTh col="tenant_name" label="Tenant" />
                <SortTh col="property" label="Property / Unit" />
                <SortTh col="end_date" label="Expires" />
                <SortTh col="monthly_rent" label="Current Rent" />
                {tab !== 'action' && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proposed Rent</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </>
                )}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedDisplayed.map(l => {
                const renewal = l.renewal
                const statusCfg = renewal ? STATUS_CONFIG[renewal.status] : null
                return (
                  <tr key={l.lease_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {l.tenant_id
                        ? <Link to={`/tenants/${l.tenant_id}`} className="font-medium text-indigo-600 hover:underline">{l.tenant_name}</Link>
                        : <p className="font-medium text-gray-900">{l.tenant_name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {l.property_id
                        ? <Link to={`/properties/${l.property_id}`} className="block text-indigo-600 hover:underline">{l.property}</Link>
                        : <p className="text-gray-800">{l.property}</p>}
                      {l.unit_id
                        ? <Link to={`/properties/${l.property_id}/units/${l.unit_id}`} className="block text-xs text-indigo-500 hover:underline">{l.unit}</Link>
                        : <p className="text-xs text-gray-500">{l.unit}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{l.end_date ? new Date(l.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                      {l.days_to_expiry != null && (
                        <p className={`text-xs mt-0.5 ${urgencyColor(l.days_to_expiry)}`}>
                          {l.days_to_expiry <= 0 ? `Expired ${Math.abs(l.days_to_expiry)}d ago` : `${l.days_to_expiry}d left`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      £{l.monthly_rent?.toLocaleString()}/mo
                    </td>
                    {tab !== 'action' && (
                      <>
                        <td className="px-4 py-3">
                          {renewal ? (
                            <div>
                              <span className="font-semibold text-gray-900">£{renewal.proposed_rent?.toLocaleString()}/mo</span>
                              {renewal.proposed_rent !== l.monthly_rent && (
                                <span className={`text-xs ml-1 ${renewal.proposed_rent > l.monthly_rent ? 'text-orange-600' : 'text-green-600'}`}>
                                  {renewal.proposed_rent > l.monthly_rent ? '+' : ''}
                                  £{(renewal.proposed_rent - l.monthly_rent).toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {statusCfg && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                              {statusCfg.label}
                            </span>
                          )}
                          {renewal?.landlord_viewed_at
                            ? <p className="text-xs text-emerald-600 mt-1" title={new Date(renewal.landlord_viewed_at).toLocaleString('en-GB')}>👁 Landlord viewed {new Date(renewal.landlord_viewed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</p>
                            : renewal && <p className="text-xs text-gray-400 mt-1">Landlord not yet viewed</p>
                          }
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {tab === 'action' && (
                          <button
                            onClick={() => setShowOffer(l)}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700"
                          >
                            Send Offer
                          </button>
                        )}
                        {tab === 'sent' && renewal && (
                          <>
                            <button
                              onClick={() => downloadOffer(renewal.id)}
                              disabled={downloading === renewal.id}
                              className="text-xs text-indigo-600 font-medium hover:underline"
                            >
                              {downloading === renewal.id ? '...' : 'Offer PDF'}
                            </button>
                            {renewal.proposed_rent > l.monthly_rent && (
                              <button
                                onClick={() => downloadSection13(l.lease_id, renewal)}
                                disabled={downloadingS13 === renewal.id}
                                className="text-xs text-purple-600 font-medium hover:underline"
                                title="Section 13 Notice (Housing Act 1988) — formal rent increase notice"
                              >
                                {downloadingS13 === renewal.id ? '...' : 'S.13 Notice'}
                              </button>
                            )}
                            <button
                              onClick={() => handleAccept(renewal.id)}
                              className="text-xs text-green-600 font-medium hover:underline"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDecline(renewal.id)}
                              className="text-xs text-red-500 font-medium hover:underline"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {tab === 'history' && renewal && renewal.status === 'accepted' && (
                          <button
                            onClick={() => downloadOffer(renewal.id)}
                            className="text-xs text-indigo-600 font-medium hover:underline"
                          >
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showOffer && (
        <SendOfferModal
          lease={showOffer}
          onClose={() => setShowOffer(null)}
          onSaved={() => { setShowOffer(null); load(); setTab('sent') }}
        />
      )}
    </div>
  )
}

function SendOfferModal({ lease, onClose, onSaved }) {
  const today = new Date()
  const currentEnd = lease.end_date ? new Date(lease.end_date) : new Date()
  // Default: propose 12 months from current end
  const defaultStart = lease.end_date || new Date().toISOString().split('T')[0]
  const defaultEnd = new Date(currentEnd)
  defaultEnd.setFullYear(defaultEnd.getFullYear() + 1)

  const [form, setForm] = useState({
    lease_id: lease.lease_id,
    proposed_rent: lease.monthly_rent || '',
    proposed_start: defaultStart,
    proposed_end: defaultEnd.toISOString().split('T')[0],
    is_periodic: 'fixed',
    agent_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rentChange = parseFloat(form.proposed_rent) - lease.monthly_rent

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        proposed_rent: parseFloat(form.proposed_rent),
        proposed_end: form.is_periodic === 'periodic' ? null : form.proposed_end,
      }
      await api.post('/renewals', payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send offer')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Send Renewal Offer</h2>
          <p className="text-sm text-gray-500 mt-0.5">{lease.tenant_name} · {lease.property} · {lease.unit}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Proposed Monthly Rent
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">£</span>
              <input
                type="number"
                step="0.01"
                value={form.proposed_rent}
                onChange={e => setForm({ ...form, proposed_rent: e.target.value })}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            {form.proposed_rent && (
              <p className={`text-xs mt-1 ${rentChange > 0 ? 'text-orange-600' : rentChange < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {rentChange > 0 ? `+£${rentChange.toFixed(2)} from current rent` :
                 rentChange < 0 ? `-£${Math.abs(rentChange).toFixed(2)} from current rent` :
                 'Same as current rent'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Tenancy Type</label>
            <select
              value={form.is_periodic}
              onChange={e => setForm({ ...form, is_periodic: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="fixed">Fixed term</option>
              <option value="periodic">Periodic (rolling)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">New Start Date</label>
              <input
                type="date"
                value={form.proposed_start}
                onChange={e => setForm({ ...form, proposed_start: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            {form.is_periodic === 'fixed' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">New End Date</label>
                <input
                  type="date"
                  value={form.proposed_end}
                  onChange={e => setForm({ ...form, proposed_end: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes to Tenant</label>
            <textarea
              value={form.agent_notes}
              onChange={e => setForm({ ...form, agent_notes: e.target.value })}
              rows={2}
              placeholder="Any additional details for the tenant..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700">
            The tenant will receive an email with this offer and can accept or decline via their tenant portal. A renewal offer PDF will be available to download.
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Sending...' : 'Send Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
