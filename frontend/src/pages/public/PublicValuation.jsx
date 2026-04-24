import { useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

const BENEFITS = [
  { icon: '📊', title: 'Accurate market appraisal', desc: 'Based on current market data and comparable local lets.' },
  { icon: '⚡', title: 'Fast response', desc: "We'll be in touch within one business day to arrange a visit." },
  { icon: '🤝', title: 'No obligation', desc: 'A free service with no pressure to instruct us.' },
  { icon: '🏘️', title: 'Local expertise', desc: 'Deep knowledge of the local rental market built over many years.' },
]

export default function PublicValuation() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', address: '',
    property_type: '', bedrooms: '', message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await axios.post(`${API_BASE}/api/public/${slug}/valuation-request`, {
        ...form,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      })
      setSent(true)
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Failed to submit — please try again.')
    }
    setSending(false)
  }

  const inp = (key, label, type='text', placeholder='', required=false, opts=null) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required?' *':''}</label>
      {opts
        ? <select value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        : <input type={type} required={required} value={form[key]} placeholder={placeholder}
            onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
      }
    </div>
  )

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Free rental valuation" subtitle="Find out exactly how much your property could earn in today's market — with no obligation." page="valuation" brand={brand} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-start">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={bb(brand)}>
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Request received!</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  We'll be in touch within one business day to arrange your free property valuation.
                </p>
                <button onClick={() => { setSent(false); setForm({full_name:'',email:'',phone:'',address:'',property_type:'',bedrooms:'',message:''}) }}
                  className="mt-6 text-sm font-semibold hover:underline" style={bt(brand)}>
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Your details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {inp('full_name','Full name','text','Jane Smith',true)}
                  {inp('email','Email address','email','jane@example.com',true)}
                </div>
                {inp('phone','Phone','tel','07700 900000')}
                {inp('address','Property address','text','123 High Street, Newcastle NE1 1AA',true)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {inp('property_type','Property type','text','',false,[
                    ['','Select type…'],
                    ['flat','Flat / Apartment'],
                    ['terraced','Terraced house'],
                    ['semi-detached','Semi-detached house'],
                    ['detached','Detached house'],
                    ['studio','Studio'],
                    ['hmo','HMO / House share'],
                    ['other','Other'],
                  ])}
                  {inp('bedrooms','Bedrooms','text','',false,[
                    ['','Select…'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5+'],
                  ])}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Additional information (optional)</label>
                  <textarea rows={3} value={form.message} placeholder="Any other details about the property…"
                    onChange={e => setForm(f => ({...f,message:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"/>
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>}
                <button type="submit" disabled={sending}
                  className="w-full text-white font-bold py-4 rounded-xl text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={bb(brand)}>
                  {sending ? 'Submitting…' : 'Request free valuation →'}
                </button>
                <p className="text-xs text-center text-gray-400">No obligation. We'll respond within one business day.</p>
              </form>
            )}
          </div>

          {/* Benefits */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Why get a valuation?</h2>
            {BENEFITS.map(b => (
              <div key={b.title} className="flex items-start gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <span className="text-2xl shrink-0">{b.icon}</span>
                <div>
                  <p className="font-bold text-gray-900 mb-1">{b.title}</p>
                  <p className="text-sm text-gray-500">{b.desc}</p>
                </div>
              </div>
            ))}
            <a href={`/site/${slug}/landlords`}
              className="flex items-center gap-2 text-sm font-semibold hover:underline mt-2"
              style={bt(brand)}>
              Learn about our landlord services →
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
