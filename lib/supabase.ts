import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client untuk frontend (menggunakan anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client untuk backend/API routes (menggunakan service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types
export interface BotMessage {
  id: string
  user_id: string
  message: string
  response: string
  created_at: string
  updated_at: string
}

export interface BotStats {
  id: string
  total_messages: number
  total_users: number
  last_activity: string
  status: 'online' | 'offline'
  created_at: string
  updated_at: string
}

// Database operations
export const dbOperations = {
  // Menyimpan pesan bot
  async saveMessage(userId: string, message: string, response: string) {
    const { data, error } = await supabaseAdmin
      .from('bot_messages')
      .insert({
        user_id: userId,
        message,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mengambil riwayat pesan user
  async getUserMessages(userId: string, limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('bot_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  },

  // Update statistik bot
  async updateBotStats() {
    const { data: messages } = await supabaseAdmin
      .from('bot_messages')
      .select('user_id')

    const totalMessages = messages?.length || 0
    const uniqueUsers = new Set(messages?.map(m => m.user_id)).size

    const { data, error } = await supabaseAdmin
      .from('bot_stats')
      .upsert({
        id: 'main',
        total_messages: totalMessages,
        total_users: uniqueUsers,
        last_activity: new Date().toISOString(),
        status: 'online',
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mengambil statistik bot
  async getBotStats() {
    const { data, error } = await supabaseAdmin
      .from('bot_stats')
      .select('*')
      .eq('id', 'main')
      .single()

    if (error) throw error
    return data
  }
}