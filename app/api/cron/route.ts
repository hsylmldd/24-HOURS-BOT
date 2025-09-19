import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Verifikasi bahwa ini adalah request dari Vercel Cron atau authorized source
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update bot status untuk menunjukkan bahwa bot masih aktif
    await dbOperations.updateBotStats()

    // Log aktivitas cron
    console.log(`Cron job executed at ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Sama seperti GET, untuk fleksibilitas
  return GET(request)
}