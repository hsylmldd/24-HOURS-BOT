'use client'

import { useState, useEffect } from 'react'

interface BotStatusData {
  status: string
  database: string
  bot_status: string
  uptime: number
  memory: {
    used: number
    total: number
  }
}

export function BotStatus() {
  const [status, setStatus] = useState<BotStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Update setiap 30 detik
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/health')
      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}j ${minutes}m`
  }

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Status Bot</h2>
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
        <h2 className="text-xl font-semibold mb-4">Status Bot</h2>
        <div className="text-red-600">
          <span className="status-indicator status-offline"></span>
          Error: {error}
        </div>
        <button 
          onClick={fetchStatus}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Status Bot</h2>
      <div className="space-y-3">
        <div className="flex items-center">
          <span className={`status-indicator ${status?.status === 'healthy' ? 'status-online' : 'status-offline'}`}></span>
          <span className="font-medium">
            Status: {status?.status === 'healthy' ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex items-center">
          <span className={`status-indicator ${status?.database === 'connected' ? 'status-online' : 'status-offline'}`}></span>
          <span>Database: {status?.database}</span>
        </div>
        
        <div>
          <span className="font-medium">Uptime: </span>
          {status?.uptime ? formatUptime(status.uptime) : 'N/A'}
        </div>
        
        <div>
          <span className="font-medium">Memory: </span>
          {status?.memory ? `${status.memory.used}MB / ${status.memory.total}MB` : 'N/A'}
        </div>
        
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString('id-ID')}
        </div>
      </div>
    </div>
  )
}