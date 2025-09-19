'use client'

import { useState, useEffect } from 'react'

interface StatsData {
  total_messages: number
  total_users: number
  last_activity: string
  status: string
  uptime: number
}

export function BotStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000) // Update setiap 1 menit
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const result = await response.json()
      setStats(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Statistik Bot</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Statistik Bot</h2>
        <div className="text-red-600">
          Error: {error}
        </div>
        <button 
          onClick={fetchStats}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Statistik Bot</h2>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span>Total Pesan:</span>
          <span className="font-semibold">{stats?.total_messages || 0}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Total User:</span>
          <span className="font-semibold">{stats?.total_users || 0}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={`font-semibold ${stats?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
            {stats?.status === 'online' ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        
        <div className="border-t pt-3">
          <div className="text-sm text-gray-600">
            <div>Aktivitas Terakhir:</div>
            <div className="font-medium">
              {stats?.last_activity 
                ? new Date(stats.last_activity).toLocaleString('id-ID')
                : 'Belum ada aktivitas'
              }
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString('id-ID')}
        </div>
      </div>
      
      <button 
        onClick={fetchStats}
        className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        Refresh Stats
      </button>
    </div>
  )
}