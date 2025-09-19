import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/supabase'
import { BotLogic } from '@/lib/bot-logic'
import { OrderManagementBot } from '@/lib/order-management-bot'
import { InlineKeyboardMarkup } from '@/lib/telegram-ui'

// Function to send message back to Telegram
async function sendTelegramMessage(
  chatId: string, 
  text: string, 
  replyMarkup?: InlineKeyboardMarkup
) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    console.error('BOT_TOKEN not found')
    return false
  }

  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    }

    if (replyMarkup) {
      body.reply_markup = replyMarkup
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('Error sending Telegram message:', error)
    return false
  }
}

// Function to answer callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) return false

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'OK',
        show_alert: false
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error('Error answering callback query:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Handle Telegram callback query (button presses)
    if (body.callback_query) {
      const callbackQuery = body.callback_query
      const chatId = callbackQuery.message.chat.id.toString()
      const userId = callbackQuery.from.id.toString()
      const callbackData = callbackQuery.data
      const messageId = callbackQuery.message.message_id

      // Answer callback query first
      await answerCallbackQuery(callbackQuery.id)

      // Process callback with order management bot
      const orderBot = new OrderManagementBot()
      const response = await orderBot.processCallback(userId, callbackData, messageId)

      if (response) {
        const sent = await sendTelegramMessage(chatId, response.text, response.replyMarkup)
        
        if (sent && response.text !== 'OK') {
          await dbOperations.saveMessage(userId, `[CALLBACK] ${callbackData}`, response.text)
          await dbOperations.updateBotStats()
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Handle Telegram message
    if (body.message) {
      const message = body.message
      const chatId = message.chat.id.toString()
      const userId = message.from.id.toString()
      const text = message.text || ''
      const photo = message.photo
      const document = message.document

      if (!text && !photo && !document) {
        return NextResponse.json({ ok: true })
      }

      // Process with order management bot
      const orderBot = new OrderManagementBot()
      let response

      if (photo || document) {
        // Handle file upload
        response = await orderBot.processFileUpload(userId, photo || document, message.caption || '')
      } else {
        // Handle text message
        response = await orderBot.processMessage(userId, text)
      }

      // Send response back to Telegram
      const sent = await sendTelegramMessage(chatId, response.text, response.replyMarkup)
      
      if (sent) {
        // Save to database if successfully sent
        await dbOperations.saveMessage(userId, text || '[FILE]', response.text)
        await dbOperations.updateBotStats()
      }

      return NextResponse.json({ ok: true })
    }

    // Handle custom webhook format (fallback)
    const { user_id, message, platform = 'telegram' } = body

    if (user_id && message) {
      const orderBot = new OrderManagementBot()
      const response = await orderBot.processMessage(user_id, message)

      await dbOperations.saveMessage(user_id, message, response.text)
      await dbOperations.updateBotStats()

      return NextResponse.json({
        success: true,
        response: response.text,
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