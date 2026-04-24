import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function DepositDispute() {
  const [deposits, setDeposits] = useState([])
  const [selected, setSelected] = useState(null)  // full deposit object
  const [disputeDescription, setDisputeDescription] = useState('')
  const [deductions, setDeductions] = useState([{ item: '', amount: '' }])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/deposits').then(r => {
      const d = r.data
      setDeposits(Array.isArray(d) ? d : d.deposits || [])
    })
  }, [])

  const addDeduction = () => setDeductions(prev => [...prev, { item: '', amount: '' }])
  const removeDeduction = i => setDeductions(prev => prev.filter((_, idx) => idx !== i))
  const updateDeduction = (i, field, val) => setDeductions(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const generate = async () => {
    if (!selected) return
    setLoading(true)
    setResult(null)
    try {
      const validDeductions = deductions.filter(d => d.item && d.amount).map(d => ({ item: d.item, amount: parseFloat(d.amount) }))
      const r = await api.post('/intelligence/deposit-dispute', {
        lease_id: selected.lease_id,
        tenancy_deposit_id: selected.id,
        dispute_description: disputeDescription,
        deductions_claimed: validDeductions,
      })
      setResult(r.data)
    } catch (e) {
      setResult({ error: e.response?.data?.detail || e.message })
    } finally {
      setLoading(false)
    }
  }

  const totalClaimed = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)

  return (
    <div>
      <PageHeader title="Deposit Dispute" subtitle="Generate TDS/DPS compliant dispute evidence documents" />

      <div className="max-w-3xl space-y-5">
        {/* Deposit picker */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Deposit</label>
          <select
            value={selected?.id || ''}
            onChange={e => setSelected(deposits.find(d => d.id === Number(e.target.value)) || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— Choose a deposit —</option>
            {deposits.map(d => (
              <option key={d.id} value={d.id}>
                {d.tenant_name || `Deposit #${d.id}`} · {d.unit || ''} — £{(d.amount || 0).toFixed(2)} ({d.scheme || '—'})
              </option>
            ))}
          </select>
          {selected && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-500">
              <div><span className="block text-gray-400">Deposit held</span><strong className="text-gray-800">£{selected.amount?.toFixed(2)}</strong></div>
              <div><span className="block text-gray-400">Scheme</span><strong className="text-gray-800">{selected.scheme} · {selected.scheme_reference}</strong></div>
              <div><span className="block text-gray-400">Status</span><strong className="text-gray-800 capitalize">{selected.status?.replace('_', ' ')}</strong></div>
            </div>
          )}
        </div>

        {/* Dispute description */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Dispute Description</label>
          <textarea
            rows={4}
            value={disputeDescription}
            onChange={e => setDisputeDescription(e.target.value)}
            placeholder="Describe the dispute — damage found, unpaid rent, cleaning required, tenant's counter-position, evidence available..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Deductions */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Deductions Claimed</label>
            <button onClick={addDeduction} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add item</button>
          </div>
          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={d.item}
                  onChange={e => updateDeduction(i, 'item', e.target.value)}
                  placeholder="e.g. Carpet replacement — living room"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-sm">£</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={d.amount}
                    onChange={e => updateDeduction(i, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {deductions.length > 1 && (
                  <button onClick={() => removeDeduction(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          {totalClaimed > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Total claimed</span>
              <span className="font-semibold text-gray-900">£{totalClaimed.toFixed(2)}</span>
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading || !selected || !disputeDescription.trim()}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating dispute document…' : 'Generate Dispute Document'}
        </button>
      </div>

      {result?.error && (
        <div className="mt-5 max-w-3xl bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{result.error}</div>
      )}

      {result && !result.error && (
        <div className="mt-6 max-w-3xl space-y-5">
          {/* Header */}
          <div className="bg-indigo-600 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-base">Dispute Document Ready</h2>
              <p className="text-indigo-200 text-xs mt-0.5">Ref: {result.reference} · Total recommended: £{result.total_recommended?.toFixed(2)}</p>
            </div>
            <button
              onClick={async () => {
                const path = (result.pdf_url || '').replace(/^\/api/, '')
                const r = await api.get(path, { responseType: 'blob' })
                const url = URL.createObjectURL(r.data)
                const a = document.createElement('a'); a.href = url; a.download = `DepositDispute_${result.reference || 'document'}.pdf`; a.click()
                URL.revokeObjectURL(url)
              }}
              className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50"
            >
              Download PDF
            </button>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">Executive Summary</h3>
            <p className="text-sm text-gray-600">{result.summary}</p>
          </div>

          {/* Deductions table */}
          {result.deductions?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">Schedule of Deductions</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.deductions.map((d, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3 font-medium text-gray-900">{d.item}</td>
                      <td className="px-5 py-3 text-gray-700">£{Number(d.amount).toFixed(2)}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{d.justification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Evidence & counter-arguments */}
          <div className="grid grid-cols-2 gap-5">
            {result.evidence_list?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Evidence List</h3>
                <ul className="space-y-1.5">
                  {result.evidence_list.map((e, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-2"><span className="text-green-500 font-bold shrink-0">✓</span>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.likely_counter_arguments?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Likely Counter-Arguments</h3>
                <div className="space-y-3">
                  {result.likely_counter_arguments.map((c, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-red-600">{c.argument}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{c.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommended outcome */}
          {result.recommended_outcome && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 text-sm mb-1">Recommended Outcome</h3>
              <p className="text-sm text-green-700">{result.recommended_outcome}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
