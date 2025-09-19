import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabaseAdmin
      .from('bot_stats')
      .select('status')
      .eq('id', 'main')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      bot_status: data?.status || 'unknown',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}