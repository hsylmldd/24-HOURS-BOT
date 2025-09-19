import { dbOperations } from './supabase'

export class BotLogic {
  private responses = {
    greeting: [
      'Halo! Saya bot yang berjalan 24/7. Ada yang bisa saya bantu?',
      'Hi! Selamat datang! Saya siap membantu Anda kapan saja.',
      'Halo! Saya bot otomatis yang selalu online. Bagaimana kabar Anda?'
    ],
    help: [
      'Berikut adalah perintah yang tersedia:\n/help - Menampilkan bantuan\n/status - Status bot\n/stats - Statistik bot\n/time - Waktu saat ini',
      'Saya bisa membantu dengan berbagai perintah. Ketik /help untuk melihat daftar lengkap.',
    ],
    status: [
      '✅ Bot sedang online dan berjalan dengan baik!',
      '🟢 Status: Online | Database: Terhubung | Uptime: Aktif',
    ],
    time: () => `🕐 Waktu saat ini: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
    default: [
      'Maaf, saya tidak mengerti pesan Anda. Ketik /help untuk melihat perintah yang tersedia.',
      'Saya belum bisa memahami pesan tersebut. Coba ketik /help untuk bantuan.',
      'Hmm, saya tidak yakin bagaimana merespons itu. Ketik /help untuk melihat apa yang bisa saya lakukan.'
    ]
  }

  async processMessage(userId: string, message: string): Promise<string> {
    const normalizedMessage = message.toLowerCase().trim()

    try {
      // Ambil riwayat pesan user untuk konteks
      const userHistory = await dbOperations.getUserMessages(userId, 5)
      
      // Proses pesan berdasarkan konten
      if (this.isGreeting(normalizedMessage)) {
        return this.getRandomResponse(this.responses.greeting)
      }

      if (normalizedMessage.includes('/help') || normalizedMessage.includes('bantuan')) {
        return this.getRandomResponse(this.responses.help)
      }

      if (normalizedMessage.includes('/status')) {
        return this.getRandomResponse(this.responses.status)
      }

      if (normalizedMessage.includes('/time') || normalizedMessage.includes('waktu')) {
        return this.responses.time()
      }

      if (normalizedMessage.includes('/stats')) {
        return await this.getStatsResponse()
      }

      // Respons berdasarkan konteks atau pola tertentu
      if (normalizedMessage.includes('terima kasih') || normalizedMessage.includes('thanks')) {
        return 'Sama-sama! Senang bisa membantu Anda. 😊'
      }

      if (normalizedMessage.includes('selamat pagi')) {
        return 'Selamat pagi! Semoga hari Anda menyenangkan! ☀️'
      }

      if (normalizedMessage.includes('selamat siang')) {
        return 'Selamat siang! Bagaimana kabar Anda hari ini? 🌞'
      }

      if (normalizedMessage.includes('selamat malam')) {
        return 'Selamat malam! Semoga istirahat Anda nyenyak! 🌙'
      }

      if (normalizedMessage.includes('bot') && normalizedMessage.includes('bagaimana')) {
        return 'Saya baik-baik saja! Saya bot yang berjalan 24/7 menggunakan Next.js dan Supabase. Terima kasih sudah bertanya! 🤖'
      }

      // Respons default
      return this.getRandomResponse(this.responses.default)

    } catch (error) {
      console.error('Error processing message:', error)
      return 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.'
    }
  }

  private isGreeting(message: string): boolean {
    const greetings = ['halo', 'hai', 'hello', 'hi', 'selamat', 'assalamualaikum', 'hei']
    return greetings.some(greeting => message.includes(greeting))
  }

  private getRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private async getStatsResponse(): Promise<string> {
    try {
      const stats = await dbOperations.getBotStats()
      return `📊 Statistik Bot:
• Total Pesan: ${stats.total_messages}
• Total User: ${stats.total_users}
• Status: ${stats.status === 'online' ? '🟢 Online' : '🔴 Offline'}
• Aktivitas Terakhir: ${new Date(stats.last_activity).toLocaleString('id-ID')}
• Uptime: ${Math.floor(process.uptime() / 3600)} jam`
    } catch (error) {
      return 'Maaf, tidak bisa mengambil statistik saat ini.'
    }
  }

  // Method untuk menambah respons kustom
  addCustomResponse(trigger: string, response: string) {
    // Implementasi untuk menambah respons kustom
    // Bisa disimpan di database untuk persistensi
  }

  // Method untuk AI/ML integration (opsional)
  async processWithAI(message: string): Promise<string> {
    // Placeholder untuk integrasi AI seperti OpenAI, Gemini, dll
    // return await openai.chat.completions.create(...)
    return 'AI processing not implemented yet'
  }
}