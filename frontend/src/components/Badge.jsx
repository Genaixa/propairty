const styles = {
  active: 'bg-green-100 text-green-700',
  occupied: 'bg-green-100 text-green-700',
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  vacant: 'bg-gray-100 text-gray-600',
  completed: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-500',
  terminated: 'bg-red-100 text-red-600',
  high: 'bg-red-100 text-red-700',
  urgent: 'bg-red-200 text-red-800',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
  maintenance: 'bg-amber-100 text-amber-700',
}

export default function Badge({ value }) {
  const cls = styles[value] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {value?.replace('_', ' ')}
    </span>
  )
}
