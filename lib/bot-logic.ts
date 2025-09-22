import { dbOperations, supabaseAdmin } from './supabase'
import { AuthService } from './auth'

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
    ],
    registration: {
      welcome: 'Selamat datang! Anda belum terdaftar dalam sistem. Silakan pilih role Anda:',
      roleSelected: (role: string) => `Anda memilih role sebagai ${role}. Sekarang masukkan nama lengkap Anda atau ketik "auto" untuk menggunakan username Telegram Anda.`,
      nameConfirm: (name: string, role: string) => `Konfirmasi pendaftaran:\nNama: ${name}\nRole: ${role}\n\nKetik "ya" untuk konfirmasi atau "tidak" untuk mengulang.`,
      success: (name: string, role: string) => {
        const welcomeMessages = {
          'HD': `🎉 Selamat datang, ${name}!\n\nAnda telah terdaftar sebagai Help Desk (HD).\n\nSebagai HD, Anda dapat:\n• Membuat order baru\n• Melihat semua order\n• Assign teknisi ke order\n• Memantau progress order\n• Melihat laporan\n\nKetik /help untuk melihat perintah yang tersedia.`,
          'TEKNISI': `🎉 Selamat datang, ${name}!\n\nAnda telah terdaftar sebagai Teknisi.\n\nSebagai Teknisi, Anda dapat:\n• Melihat order yang ditugaskan\n• Update progress order\n• Upload evidence\n• Melihat detail order\n• Update status order\n\nKetik /help untuk melihat perintah yang tersedia.`
        };
        return welcomeMessages[role as keyof typeof welcomeMessages] || `Selamat datang, ${name}!`;
      }
    }
  }

  // Registration state management - using in-memory fallback until database table is created
  private registrationStates = new Map<number, {
    step: 'role_selection' | 'name_input' | 'confirmation';
    role?: 'HD' | 'TEKNISI';
    name?: string;
    username?: string;
  }>();

  private async getRegistrationState(telegramId: number): Promise<{
    step: 'role_selection' | 'name_input' | 'confirmation';
    role?: 'HD' | 'TEKNISI';
    name?: string;
    username?: string;
  } | null> {
    // Use in-memory storage as fallback
    return this.registrationStates.get(telegramId) || null;
  }

  private async setRegistrationState(telegramId: number, state: {
    step: 'role_selection' | 'name_input' | 'confirmation';
    role?: 'HD' | 'TEKNISI';
    name?: string;
    username?: string;
  }): Promise<void> {
    // Use in-memory storage as fallback
    this.registrationStates.set(telegramId, state);
  }

  private async clearRegistrationState(telegramId: number): Promise<void> {
    // Use in-memory storage as fallback
    this.registrationStates.delete(telegramId);
  }

  async processMessage(userId: string, message: string, telegramId: number, username?: string): Promise<{ text: string; keyboard?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }> {
    try {
      console.log(`Processing message from user ${telegramId}: "${message}"`);
      
      // Check if this is a registration callback - handle it regardless of user status
      if (message.startsWith('register_') || 
          message === 'use_telegram_username' || 
          message === 'confirm_registration' || 
          message === 'restart_registration') {
        return await this.handleRegistrationFlow(telegramId, message, username);
      }
      
      // Check if user is registered
      const user = await AuthService.getUserByTelegramId(telegramId);
      
      // Handle registration flow for unregistered users (only for non-callback messages)
      if (!user) {
        console.log(`User ${telegramId} not registered, starting registration flow`);
        return await this.handleRegistrationFlow(telegramId, message, username);
      }

      console.log(`User ${telegramId} is registered as ${user.role}, processing command`);
      
      const normalizedMessage = message.toLowerCase().trim();
      
      // Ambil riwayat pesan user untuk konteks
      const userHistory = await dbOperations.getUserMessages(userId, 5)
      
      // Proses pesan berdasarkan konten
      if (normalizedMessage.includes('/start') || this.isGreeting(normalizedMessage)) {
        return { text: this.getRandomResponse(this.responses.greeting) }
      }

      if (normalizedMessage.includes('/help') || normalizedMessage.includes('bantuan')) {
        return { text: this.getRandomResponse(this.responses.help) }
      }

      if (normalizedMessage.includes('/status')) {
        return { text: this.getRandomResponse(this.responses.status) }
      }

      if (normalizedMessage.includes('/time') || normalizedMessage.includes('waktu')) {
        return { text: this.responses.time() }
      }

      if (normalizedMessage.includes('/stats')) {
        return { text: await this.getStatsResponse() }
      }

      // Respons berdasarkan konteks atau pola tertentu
      if (normalizedMessage.includes('terima kasih') || normalizedMessage.includes('thanks')) {
        return { text: 'Sama-sama! Senang bisa membantu Anda. 😊' }
      }

      if (normalizedMessage.includes('selamat pagi')) {
        return { text: 'Selamat pagi! Semoga hari Anda menyenangkan! ☀️' }
      }

      if (normalizedMessage.includes('selamat siang')) {
        return { text: 'Selamat siang! Bagaimana kabar Anda hari ini? 🌞' }
      }

      if (normalizedMessage.includes('selamat malam')) {
        return { text: 'Selamat malam! Semoga istirahat Anda nyenyak! 🌙' }
      }

      if (normalizedMessage.includes('bot') && normalizedMessage.includes('bagaimana')) {
        return { text: 'Saya baik-baik saja! Saya bot yang berjalan 24/7 menggunakan Next.js dan Supabase. Terima kasih sudah bertanya! 🤖' }
      }

      // Respons default
      return { text: this.getRandomResponse(this.responses.default) }

    } catch (error) {
      console.error('Error in processMessage:', error);
      return { 
        text: '❌ Terjadi kesalahan saat memproses pesan Anda.\n\nSilakan coba lagi atau ketik /help untuk bantuan.',
        keyboard: {
          inline_keyboard: [[
            { text: '🔄 Coba Lagi', callback_data: 'retry_message' },
            { text: '❓ Bantuan', callback_data: 'help' }
          ]]
        }
      };
    }
  }

  // Make handleRegistrationFlow public so it can be called from webhook
  public async handleRegistrationFlow(telegramId: number, message: string, username?: string): Promise<{ text: string; keyboard?: any }> {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // Check if user is already registered (like bot.js checkUserRegistration)
      const existingUser = await AuthService.getUserByTelegramId(telegramId);
      if (existingUser) {
        // Log successful user check
        console.log(`User ${telegramId} already registered as ${existingUser.role}`);
        return {
          text: `Halo ${existingUser.full_name}! 👋\n\nSelamat datang kembali di Order Management Bot!\n\nAnda sudah terdaftar sebagai ${existingUser.role}.\n\nKetik /help untuk melihat perintah yang tersedia.`
        };
      }

      // User not registered, show registration options (like bot.js)
      if (message === '/start' || !message || message === 'restart_registration') {
        console.log(`Showing registration options to user ${telegramId}`);
        return {
          text: `Halo! 👋\n\nSelamat datang di Order Management Bot!\n\nAnda belum terdaftar dalam sistem.\nSilakan pilih role Anda:`,
          keyboard: {
            inline_keyboard: [
              [{ text: '📋 Daftar sebagai HD (Helpdesk)', callback_data: 'register_hd' }],
              [{ text: '🔧 Daftar sebagai Teknisi', callback_data: 'register_teknis' }]
            ]
          }
        };
      }
    } catch (error) {
      console.error('Error in handleRegistrationFlow user check:', error);
      return {
        text: '❌ Terjadi kesalahan saat memeriksa status registrasi. Silakan coba lagi.',
        keyboard: {
          inline_keyboard: [
            [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
          ]
        }
      };
    }

    // Handle registration callback (like bot.js callback handling)
    if (message === 'register_hd') {
      const firstName = username || 'User';
      
      try {
        console.log(`Attempting to register user ${telegramId} as HD with name: ${firstName}`);
        
        // Validate input
        if (!firstName || firstName.trim().length < 2) {
          return {
            text: '❌ Nama tidak valid. Silakan coba lagi.',
            keyboard: {
              inline_keyboard: [
                [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
              ]
            }
          };
        }
        
        // Register user directly (like bot.js registerUser function)
        const newUser = await AuthService.registerUser({
          telegram_id: telegramId,
          username: username,
          full_name: firstName,
          role: 'HD'
        });

        if (newUser) {
          console.log(`Successfully registered user ${telegramId} as HD`);
          return {
            text: '✅ Registrasi Berhasil!\n\nAnda telah terdaftar sebagai HD (Helpdesk).\n\nSelamat datang di Order Management Bot!\n\nKetik /help untuk melihat perintah yang tersedia.'
          };
        } else {
          throw new Error('Failed to register user - no user returned');
        }
      } catch (error) {
        console.error('Registration error for HD:', error);
        return {
          text: '❌ Terjadi kesalahan saat registrasi. Silakan coba lagi.\n\nDetail error: ' + (error instanceof Error ? error.message : 'Unknown error'),
          keyboard: {
            inline_keyboard: [
              [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
            ]
          }
        };
      }
    }

    if (message === 'register_teknis') {
      const firstName = username || 'User';
      
      try {
        console.log(`Attempting to register user ${telegramId} as TEKNISI with name: ${firstName}`);
        
        // Validate input
        if (!firstName || firstName.trim().length < 2) {
          return {
            text: '❌ Nama tidak valid. Silakan coba lagi.',
            keyboard: {
              inline_keyboard: [
                [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
              ]
            }
          };
        }
        
        // Register user directly (like bot.js registerUser function)
        const newUser = await AuthService.registerUser({
          telegram_id: telegramId,
          username: username,
          full_name: firstName,
          role: 'TEKNISI'
        });

        if (newUser) {
          console.log(`Successfully registered user ${telegramId} as TEKNISI`);
          return {
            text: '✅ Registrasi Berhasil!\n\nAnda telah terdaftar sebagai Teknisi.\n\nSelamat datang di Order Management Bot!\n\nKetik /help untuk melihat perintah yang tersedia.'
          };
        } else {
          throw new Error('Failed to register user - no user returned');
        }
      } catch (error) {
        console.error('Registration error for TEKNISI:', error);
        return {
          text: '❌ Terjadi kesalahan saat registrasi. Silakan coba lagi.\n\nDetail error: ' + (error instanceof Error ? error.message : 'Unknown error'),
          keyboard: {
            inline_keyboard: [
              [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
            ]
          }
        };
      }
    }

    // Fallback - show registration options again
    return await this.handleRegistrationFlow(telegramId, '/start', username);
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
      console.log('Fetching bot statistics...');
      const stats = await dbOperations.getBotStats();
      
      if (!stats) {
        console.warn('No stats returned from database');
        return '📊 Statistik Bot:\n\n❌ Data statistik tidak tersedia saat ini.\nSilakan coba lagi nanti.';
      }

      console.log('Stats retrieved successfully:', stats);
      
      return `📊 Statistik Bot:
• Total Pesan: ${stats.total_messages || 0}
• Total User: ${stats.total_users || 0}
• Status: ${stats.status === 'online' ? '🟢 Online' : '🔴 Offline'}
• Aktivitas Terakhir: ${stats.last_activity ? new Date(stats.last_activity).toLocaleString('id-ID') : 'Tidak diketahui'}
• Uptime: ${Math.floor(process.uptime() / 3600)} jam`;
      
    } catch (error) {
      console.error('Error fetching bot statistics:', error);
      return '📊 Statistik Bot:\n\n❌ Maaf, tidak bisa mengambil statistik saat ini.\n\nDetail error: ' + (error instanceof Error ? error.message : 'Unknown error');
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