import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import StatCard from '../components/StatCard'

const RISK_CFG = {
  1: { text: 'text-green-700', bg: 'bg-green-100', label: 'Low' },
  2: { text: 'text-blue-700', bg: 'bg-blue-100', label: 'Low-Med' },
  3: { text: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Medium' },
  4: { text: 'text-orange-700', bg: 'bg-orange-100', label: 'High' },
  5: { text: 'text-red-700', bg: 'bg-red-100', label: 'Critical' },
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [riskData, setRiskData] = useState(null)

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data))
    api.get('/risk').then(r => setRiskData(r.data)).catch(() => {})
  }, [])

  if (!data) return <div className="text-gray-400 text-sm">Loading…</div>

  const occupancyData = [
    { name: 'Occupied', value: data.occupied_units },
    { name: 'Vacant', value: data.vacant_units },
  ]
  const COLORS = ['#4f46e5', '#e5e7eb']

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Properties" value={data.properties} color="indigo" />
        <StatCard label="Units" value={data.units} sub={`${data.occupancy_rate}% occupied`} color="blue" />
        <StatCard label="Active Leases" value={data.active_leases} color="green" />
        <StatCard label="Monthly Rent Roll" value={`£${data.monthly_rent_roll.toLocaleString()}`} color="green" />
        <StatCard label="Tenants" value={data.tenants} color="indigo" />
        <StatCard label="Vacant Units" value={data.vacant_units} color="amber" />
        <StatCard label="Open Maintenance" value={data.open_maintenance} color="red" />
        <StatCard label="Arrears" value={data.arrears_count > 0 ? `£${data.arrears_total.toLocaleString()}` : '£0'} sub={data.arrears_count > 0 ? `${data.arrears_count} overdue` : 'All paid'} color={data.arrears_count > 0 ? 'red' : 'green'} />
        <StatCard label="Leases Expiring (60d)" value={data.leases_expiring_soon} color={data.leases_expiring_soon > 0 ? 'amber' : 'green'} />
        <StatCard label="Compliance Expired" value={data.compliance_expired ?? 0} color={data.compliance_expired > 0 ? 'red' : 'green'} sub={data.compliance_expiring_soon > 0 ? `${data.compliance_expiring_soon} expiring soon` : undefined} />
        <StatCard label="Occupancy Rate" value={`${data.occupancy_rate}%`} color="green" />
      </div>

      {/* Risk widget */}
      {riskData && (riskData.counts.critical > 0 || riskData.counts.high > 0 || riskData.counts.medium > 0) && (
        <div className="bg-white border border-red-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h3 className="text-sm font-bold text-gray-900">Rent Risk Alerts</h3>
            </div>
            <Link to="/risk" className="text-xs text-indigo-600 font-medium hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {riskData.tenants.filter(t => t.risk_score >= 3).slice(0, 4).map(t => {
              const cfg = RISK_CFG[t.risk_score]
              return (
                <div key={t.tenant_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{t.tenant_name}</span>
                    <span className="text-xs text-gray-500 ml-2">{t.property} · {t.unit}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.stats.current_arrears > 0 && (
                      <span className="text-xs font-semibold text-red-600">£{t.stats.current_arrears.toLocaleString()} arrears</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Unit Occupancy</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                {occupancyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {occupancyData.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-gray-600">{d.name}: <strong>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Total portfolio value (est.)', value: `£${(data.monthly_rent_roll * 12 * 16.7).toLocaleString(undefined, {maximumFractionDigits:0})}` },
              { label: 'Annual rent roll', value: `£${(data.monthly_rent_roll * 12).toLocaleString()}` },
              { label: 'Avg rent per occupied unit', value: data.occupied_units ? `£${Math.round(data.monthly_rent_roll / data.occupied_units)}` : '—' },
              { label: 'Maintenance issues open', value: data.open_maintenance },
              { label: 'Arrears outstanding', value: data.arrears_count > 0 ? `£${data.arrears_total.toLocaleString()}` : '£0 — all clear' },
              { label: 'Leases expiring (60 days)', value: data.leases_expiring_soon || 'None' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
