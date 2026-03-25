import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import api from '../lib/api'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

function StatCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-600', green: 'text-green-600', amber: 'text-amber-600',
    red: 'text-red-600', blue: 'text-blue-600', gray: 'text-gray-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color] || colors.indigo}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, prefix = '£' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && prefix ? `${prefix}${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [overview, setOverview] = useState(null)
  const [rentData, setRentData] = useState([])
  const [occupancyData, setOccupancyData] = useState([])
  const [maintenanceData, setMaintenanceData] = useState(null)
  const [yieldData, setYieldData] = useState([])
  const [months, setMonths] = useState(6)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [months])

  async function loadAll() {
    setLoading(true)
    try {
      const [ov, rent, occ, maint, yld] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/rent-collection', { params: { months } }),
        api.get('/analytics/occupancy', { params: { months } }),
        api.get('/analytics/maintenance-costs', { params: { months } }),
        api.get('/analytics/yield'),
      ])
      setOverview(ov.data)
      setRentData(rent.data)
      setOccupancyData(occ.data)
      setMaintenanceData(maint.data)
      setYieldData(yld.data)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !overview) {
    return <div className="text-center py-20 text-gray-400">Loading analytics...</div>
  }

  const totalMaintCost = maintenanceData?.by_month?.reduce((s, m) => s + m.cost, 0) || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Portfolio performance overview</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[3, 6, 12].map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                months === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Monthly Rent Roll"
            value={`£${overview.monthly_rent_roll.toLocaleString()}`}
            sub={`£${overview.annual_rent_roll.toLocaleString()} / year`}
            color="green"
          />
          <StatCard
            label="Collection Rate"
            value={`${overview.collection_rate}%`}
            sub={`£${overview.this_month_collected.toLocaleString()} of £${overview.this_month_expected.toLocaleString()} this month`}
            color={overview.collection_rate >= 95 ? 'green' : overview.collection_rate >= 80 ? 'amber' : 'red'}
          />
          <StatCard
            label="Occupancy Rate"
            value={`${overview.occupancy_rate}%`}
            sub={`${overview.occupied} occupied, ${overview.vacant} vacant`}
            color={overview.occupancy_rate >= 90 ? 'green' : overview.occupancy_rate >= 75 ? 'amber' : 'red'}
          />
          <StatCard
            label="Current Arrears"
            value={`£${overview.this_month_arrears.toLocaleString()}`}
            sub={`${overview.open_maintenance} open maintenance issues`}
            color={overview.this_month_arrears > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      {/* Rent collection chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-5">Rent Collection</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rentData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `£${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="expected" name="Expected" fill="#e0e7ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#4f46e5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="arrears" name="Arrears" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-5">Occupancy Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={occupancyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip prefix="" />} formatter={(v, n) => [n === 'rate' ? `${v}%` : v, n]} />
              <Area type="monotone" dataKey="rate" name="Occupancy %" stroke="#10b981" fill="url(#occGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maintenance costs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-900">Maintenance Costs</h3>
            <span className="text-sm font-semibold text-gray-500">
              Total: £{totalMaintCost.toLocaleString()}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={maintenanceData?.by_month || []} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `£${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Cost by Trade</h3>
          {maintenanceData?.by_trade?.length ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={maintenanceData.by_trade}
                    dataKey="cost"
                    nameKey="trade"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                  >
                    {maintenanceData.by_trade.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => [`£${v.toLocaleString()}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {maintenanceData.by_trade.slice(0, 5).map((t, i) => (
                  <div key={t.trade} className="flex justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 truncate max-w-[100px]">{t.trade}</span>
                    </div>
                    <span className="font-semibold text-gray-800">£{t.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No cost data yet</p>
          )}
        </div>
      </div>

      {/* Per-property yield table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Property Performance</h3>
          <p className="text-xs text-gray-400">* Net = Annual rent − maintenance costs recorded in system</p>
        </div>
        {yieldData.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No properties found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Units</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Rent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Annual Rent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Maint. Costs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Annual*</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Exp. ≤90d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {yieldData.map(p => (
                <tr key={p.property} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.property}</p>
                    <p className="text-xs text-gray-400">{p.address}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.units}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${p.occupancy_rate >= 90 ? 'text-green-600' : p.occupancy_rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {p.occupancy_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">£{p.monthly_rent_roll.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">£{p.annual_rent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {p.total_maintenance_cost > 0 ? `£${p.total_maintenance_cost.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">£{p.net_annual.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {p.expiring_leases_90d > 0 ? (
                      <span className="text-orange-600 font-semibold">{p.expiring_leases_90d}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-gray-700">Totals</td>
                <td className="px-4 py-3 text-right text-gray-700">{yieldData.reduce((s, p) => s + p.units, 0)}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {yieldData.length ? Math.round(yieldData.reduce((s, p) => s + p.occupancy_rate, 0) / yieldData.length) : 0}% avg
                </td>
                <td className="px-4 py-3 text-right text-gray-700">£{yieldData.reduce((s, p) => s + p.monthly_rent_roll, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-900">£{yieldData.reduce((s, p) => s + p.annual_rent, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-orange-600">£{yieldData.reduce((s, p) => s + p.total_maintenance_cost, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-700">£{yieldData.reduce((s, p) => s + p.net_annual, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-orange-600">{yieldData.reduce((s, p) => s + p.expiring_leases_90d, 0) || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
