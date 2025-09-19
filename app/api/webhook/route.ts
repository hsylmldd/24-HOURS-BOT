import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/supabase'
import { BotLogic } from '@/lib/bot-logic'

export async function POST(request: NextRequest) {
  try {
    // Verifikasi webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhookSecret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, message, platform = 'telegram' } = body

    if (!user_id || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Proses pesan dengan bot logic
    const botLogic = new BotLogic()
    const response = await botLogic.processMessage(user_id, message)

    // Simpan ke database
    await dbOperations.saveMessage(user_id, message, response)
    
    // Update statistik
    await dbOperations.updateBotStats()

    return NextResponse.json({
      success: true,
      response,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Bot is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}