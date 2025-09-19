import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/supabase'
import { BotLogic } from '@/lib/bot-logic'

// Function to send message back to Telegram
async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    console.error('BOT_TOKEN not found')
    return false
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('Error sending Telegram message:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Handle Telegram webhook format
    if (body.message) {
      const message = body.message
      const chatId = message.chat.id.toString()
      const userId = message.from.id.toString()
      const text = message.text || ''

      if (!text) {
        return NextResponse.json({ ok: true })
      }

      // Proses pesan dengan bot logic
      const botLogic = new BotLogic()
      const response = await botLogic.processMessage(userId, text)

      // Kirim respons kembali ke Telegram
      const sent = await sendTelegramMessage(chatId, response)
      
      if (sent) {
        // Simpan ke database jika berhasil dikirim
        await dbOperations.saveMessage(userId, text, response)
        await dbOperations.updateBotStats()
      }

      return NextResponse.json({ ok: true })
    }

    // Handle custom webhook format (fallback)
    const { user_id, message, platform = 'telegram' } = body

    if (user_id && message) {
      const botLogic = new BotLogic()
      const response = await botLogic.processMessage(user_id, message)

      await dbOperations.saveMessage(user_id, message, response)
      await dbOperations.updateBotStats()

      return NextResponse.json({
        success: true,
        response,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ok: true }) // Always return ok to Telegram
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Bot is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}