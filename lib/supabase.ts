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
  id: number
  total_messages: number
  total_orders: number
  active_orders: number
  completed_orders: number
  last_updated: string
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

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('status')

    const totalMessages = messages?.length || 0
    const totalOrders = orders?.length || 0
    const activeOrders = orders?.filter(o => o.status === 'IN_PROGRESS' || o.status === 'PENDING').length || 0
    const completedOrders = orders?.filter(o => o.status === 'CLOSED').length || 0

    // Get the first record or create if none exists
    const { data: existingStats } = await supabaseAdmin
      .from('bot_stats')
      .select('id')
      .limit(1)
      .single()

    let result
    if (existingStats) {
      // Update existing record
      const { data, error } = await supabaseAdmin
        .from('bot_stats')
        .update({
          total_messages: totalMessages,
          total_orders: totalOrders,
          active_orders: activeOrders,
          completed_orders: completedOrders,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingStats.id)
        .select()
        .single()
      
      if (error) throw error
      result = data
    } else {
      // Insert new record
      const { data, error } = await supabaseAdmin
        .from('bot_stats')
        .insert({
          total_messages: totalMessages,
          total_orders: totalOrders,
          active_orders: activeOrders,
          completed_orders: completedOrders,
          last_updated: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      result = data
    }

    return result
  },

  // Mengambil statistik bot
  async getBotStats() {
    const { data, error } = await supabaseAdmin
      .from('bot_stats')
      .select('*')
      .limit(1)
      .single()

    if (error) throw error
    return data
  }
}