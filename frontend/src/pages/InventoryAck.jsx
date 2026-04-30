/**
 * Public inventory acknowledgement page — no login required.
 * Reached via /inventory/ack/:token
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const BASE = 'https://propairty.co.uk'
const COND_COLORS = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-yellow-100 text-yellow-700',
  poor: 'bg-red-100 text-red-700',
  missing: 'bg-purple-100 text-purple-700',
  'n/a': 'bg-gray-100 text-gray-500',
}

export default function InventoryAck() {
  const { token } = useParams()
  const [inv, setInv] = useState(null)
  const [step, setStep] = useState('loading') // loading | review | done | error | already
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    axios.get(`${BASE}/api/inventory/ack/${token}`)
      .then(r => {
        setInv(r.data)
        setStep(r.data.tenant_acknowledged_at ? 'already' : 'review')
      })
      .catch(e => {
        setError(e.response?.data?.detail || 'Link not found or invalid.')
        setStep('error')
      })
  }, [token])

  async function confirm() {
    setConfirming(true)
    try {
      const r = await axios.post(`${BASE}/api/inventory/ack/${token}`)
      if (r.data.already_acknowledged) setStep('already')
      else setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Loading…</p>
    </div>
  )

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link not found</h1>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  )

  if (step === 'already') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Already acknowledged</h1>
        <p className="text-gray-500 text-sm">You have already confirmed this inventory. No further action needed.</p>
        {inv?.tenant_acknowledged_at && (
          <p className="text-xs text-gray-400 mt-3">Confirmed on {fmt(inv.tenant_acknowledged_at)}</p>
        )}
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Inventory acknowledged</h1>
        <p className="text-gray-500 text-sm">Thank you for confirming. Your acknowledgement has been recorded.</p>
        <p className="text-xs text-gray-400 mt-3">You can close this page.</p>
      </div>
    </div>
  )

  const invLabel = inv.inv_type === 'check_in' ? 'Check-In' : 'Check-Out'

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{invLabel} Inventory</span>
            <span className="text-xs text-gray-400">Ref: INV-{String(inv.id).padStart(4, '0')}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{inv.unit}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{inv.tenant_name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            {[
              ['Date', fmt(inv.inv_date)],
              ['Conducted By', inv.conducted_by || '—'],
              ['Tenant Present', inv.tenant_present ? 'Yes' : 'No'],
              ['Keys Handed', inv.keys_handed || '—'],
            ].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{l}</p>
                <p className="font-medium text-gray-800 text-xs mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {(inv.meter_electric || inv.meter_gas || inv.meter_water) && (
            <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
              {[['Electric', inv.meter_electric], ['Gas', inv.meter_gas], ['Water', inv.meter_water]].map(([l, v]) => v ? (
                <div key={l} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{l}</p>
                  <p className="font-medium text-gray-800 text-xs mt-0.5">{v}</p>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        {/* Rooms */}
        {inv.rooms?.filter(r => r.items?.some(i => i.item_name?.trim())).map(room => (
          <div key={room.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{room.room_name}</h3>
              {room.notes && <p className="text-xs text-gray-400 mt-0.5">{room.notes}</p>}
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {room.items.filter(i => i.item_name?.trim()).map(item => (
                  <tr key={item.id}>
                    <td className="px-5 py-2.5 text-gray-700 w-1/2">{item.item_name}</td>
                    <td className="px-5 py-2.5">
                      {item.condition ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COND_COLORS[item.condition] || 'bg-gray-100 text-gray-500'}`}>
                          {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-400">{item.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Confirm */}
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Confirm this inventory</h2>
          <p className="text-sm text-gray-500 mb-5">
            By clicking below, you confirm that the inventory above is an accurate record of the condition of the property at the time of {invLabel.toLowerCase()}.
          </p>
          <button
            onClick={confirm}
            disabled={confirming}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Confirming…' : 'I confirm this inventory is accurate'}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            If you disagree with any items, please contact your agent before confirming.
          </p>
        </div>
      </div>
    </div>
  )
}
