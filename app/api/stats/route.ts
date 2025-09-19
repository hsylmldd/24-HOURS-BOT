import { NextResponse } from 'next/server'
import { dbOperations } from '@/lib/supabase'

export async function GET() {
  try {
    const stats = await dbOperations.getBotStats()
    
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform
      }
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const stats = await dbOperations.updateBotStats()
    
    return NextResponse.json({
      success: true,
      message: 'Stats updated successfully',
      data: stats
    })
  } catch (error) {
    console.error('Stats update error:', error)
    return NextResponse.json(
      { error: 'Failed to update stats' },
      { status: 500 }
    )
  }
}