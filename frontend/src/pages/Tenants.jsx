import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', whatsapp_number: '', notes: '' })
  const [portalModal, setPortalModal] = useState(null) // tenant object
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')

  useEffect(() => { api.get('/tenants').then(r => setTenants(r.data)) }, [])

  const save = async e => {
    e.preventDefault()
    await api.post('/tenants', form)
    const r = await api.get('/tenants')
    setTenants(r.data)
    setShowForm(false)
    setForm({ full_name: '', email: '', phone: '', whatsapp_number: '', notes: '' })
  }

  const enablePortal = async e => {
    e.preventDefault()
    try {
      await api.post(`/tenant/enable/${portalModal.id}`, { password: portalPw })
      setPortalMsg(`Portal enabled. ${portalModal.email} can log in at /tenant/login`)
      const r = await api.get('/tenants')
      setTenants(r.data)
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tenants</h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Tenant
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">New Tenant</h3>
            <form onSubmit={save} className="space-y-4">
              {[['full_name','Full Name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
                <input key={k} placeholder={l} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required={k === 'full_name'}
                />
              ))}
              <div>
                <input placeholder="WhatsApp number for reminders (e.g. +447700900000)" value={form.whatsapp_number}
                  onChange={e => setForm({...form, whatsapp_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-gray-400 mt-1 pl-1">Include country code. Used for WhatsApp rent reminders if configured.</p>
              </div>
              <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Tenant Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a password for <span className="font-medium text-gray-800">{portalModal.full_name}</span>.
              They will log in at <span className="font-mono text-xs">/tenant/login</span> using {portalModal.email}.
            </p>
            <form onSubmit={enablePortal} className="space-y-4">
              <input type="password" placeholder="Password (min 8 characters)" value={portalPw}
                onChange={e => setPortalPw(e.target.value)} required minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {portalMsg && <p className={`text-sm ${portalMsg.includes('enabled') ? 'text-green-600' : 'text-red-500'}`}>{portalMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700">Enable</button>
                <button type="button" onClick={() => setPortalModal(null)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name','Email','Phone','Notes','Portal'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{t.full_name}</td>
                <td className="px-5 py-3.5 text-gray-500">{t.email || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500">{t.phone || '—'}</td>
                <td className="px-5 py-3.5 text-gray-400 max-w-xs truncate">{t.notes || '—'}</td>
                <td className="px-5 py-3.5">
                  {t.portal_enabled ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Enabled</span>
                  ) : (
                    <button onClick={() => { setPortalModal(t); setPortalPw(''); setPortalMsg('') }}
                      className="text-xs text-violet-600 hover:underline font-medium">
                      Enable portal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
