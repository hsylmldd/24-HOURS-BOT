import { dbOperations } from './supabase'
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

  // Registration state management
  private registrationStates = new Map<number, {
    step: 'role_selection' | 'name_input' | 'confirmation';
    role?: 'HD' | 'TEKNISI';
    name?: string;
    username?: string;
  }>();

  async processMessage(userId: string, message: string, telegramId: number, username?: string): Promise<{ text: string; keyboard?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }> {
    const normalizedMessage = message.toLowerCase().trim()
    
    try {
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
        return await this.handleRegistrationFlow(telegramId, message, username);
      }

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
      console.error('Error processing message:', error)
      return { text: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.' }
    }
  }

  private async handleRegistrationFlow(telegramId: number, message: string, username?: string): Promise<{ text: string; keyboard?: any }> {
    const normalizedMessage = message.toLowerCase().trim();
    const currentState = this.registrationStates.get(telegramId);

    // Start registration flow
    if (!currentState) {
      this.registrationStates.set(telegramId, { step: 'role_selection', username });
      return {
        text: this.responses.registration.welcome,
        keyboard: {
          inline_keyboard: [
            [
              { text: '👨‍💻 Teknisi', callback_data: 'register_teknisi' },
              { text: '🎧 Help Desk (HD)', callback_data: 'register_hd' }
            ]
          ]
        }
      };
    }

    // Handle role selection
    if (currentState.step === 'role_selection') {
      let selectedRole: 'HD' | 'TEKNISI' | null = null;
      
      if (message === 'register_teknisi' || normalizedMessage.includes('teknisi') || normalizedMessage === '1') {
        selectedRole = 'TEKNISI';
      } else if (message === 'register_hd' || normalizedMessage.includes('hd') || normalizedMessage.includes('help desk') || normalizedMessage === '2') {
        selectedRole = 'HD';
      }

      if (selectedRole) {
        this.registrationStates.set(telegramId, {
          ...currentState,
          step: 'name_input',
          role: selectedRole
        });
        
        return {
          text: this.responses.registration.roleSelected(selectedRole),
          keyboard: {
            inline_keyboard: [
              [{ text: '🤖 Gunakan Username Telegram', callback_data: 'use_telegram_username' }]
            ]
          }
        };
      }
      
      return {
        text: 'Silakan pilih role Anda dengan mengklik tombol di atas.',
        keyboard: {
          inline_keyboard: [
            [
              { text: '👨‍💻 Teknisi', callback_data: 'register_teknisi' },
              { text: '🎧 Help Desk (HD)', callback_data: 'register_hd' }
            ]
          ]
        }
      };
    }

    // Handle name input
    if (currentState.step === 'name_input' && currentState.role) {
      let finalName = '';
      
      if (message === 'use_telegram_username' || normalizedMessage === 'auto') {
        finalName = username || 'User';
      } else {
        finalName = message.trim();
      }

      this.registrationStates.set(telegramId, {
        ...currentState,
        step: 'confirmation',
        name: finalName
      });

      return {
        text: this.responses.registration.nameConfirm(finalName, currentState.role),
        keyboard: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Daftar', callback_data: 'confirm_registration' },
              { text: '❌ Tidak, Ulangi', callback_data: 'restart_registration' }
            ]
          ]
        }
      };
    }

    // Handle confirmation
    if (currentState.step === 'confirmation' && currentState.role && currentState.name) {
      if (message === 'confirm_registration' || normalizedMessage === 'ya') {
        // Register user
        const newUser = await AuthService.registerUser({
          telegram_id: telegramId,
          username: currentState.username,
          full_name: currentState.name,
          role: currentState.role
        });

        if (newUser) {
          this.registrationStates.delete(telegramId);
          return {
            text: this.responses.registration.success(currentState.name, currentState.role)
          };
        } else {
          return {
            text: 'Maaf, terjadi kesalahan saat mendaftarkan akun Anda. Silakan coba lagi.',
            keyboard: {
              inline_keyboard: [
                [{ text: '🔄 Coba Lagi', callback_data: 'restart_registration' }]
              ]
            }
          };
        }
      } else if (message === 'restart_registration' || normalizedMessage === 'tidak') {
        this.registrationStates.delete(telegramId);
        return await this.handleRegistrationFlow(telegramId, '/start', username);
      }
      
      return {
        text: 'Silakan konfirmasi pendaftaran dengan mengklik tombol di atas.',
        keyboard: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Daftar', callback_data: 'confirm_registration' },
              { text: '❌ Tidak, Ulangi', callback_data: 'restart_registration' }
            ]
          ]
        }
      };
    }

    // Fallback
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