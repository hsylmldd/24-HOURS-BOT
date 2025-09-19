import { AuthService, UserSession } from './auth';
import { OrderService, Order } from './order-service';
import { EvidenceService } from './evidence-service';
import { NotificationService } from './notification-service';
import { TelegramUI, InlineKeyboardMarkup } from './telegram-ui';

export interface BotResponse {
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export class OrderManagementBot {
  // Process text messages
  async processMessage(userId: string, message: string): Promise<BotResponse> {
    const telegramId = parseInt(userId);
    const normalizedMessage = message.toLowerCase().trim();

    try {
      // Get user info
      const user = await AuthService.getUserByTelegramId(telegramId);

      // Handle /start command
      if (normalizedMessage.includes('/start')) {
        return await this.handleStart(user, telegramId);
      }

      // If user not registered, show registration message
      if (!user) {
        return {
          text: '👋 Selamat datang di Order Management Bot!\n\n' +
                'Anda belum terdaftar dalam sistem. Silakan hubungi administrator untuk mendaftarkan akun Anda dengan role yang sesuai (HD atau Teknisi).\n\n' +
                'Setelah terdaftar, gunakan /start untuk memulai.'
        };
      }

      // Handle commands based on user role
      if (normalizedMessage.includes('/help')) {
        return this.getHelpMessage(user.role);
      }

      if (normalizedMessage.includes('/myorders')) {
        return await this.handleMyOrders(user);
      }

      if (normalizedMessage.includes('/status')) {
        return await this.handleStatusCommand(normalizedMessage, user);
      }

      // HD specific commands
      if (user.role === 'HD') {
        if (normalizedMessage.includes('/order')) {
          return this.startOrderCreation(telegramId);
        }

        if (normalizedMessage.includes('/update_status')) {
          return this.startStatusUpdate(telegramId);
        }

        if (normalizedMessage.includes('/report')) {
          return this.showReportOptions();
        }
      }

      // Teknisi specific commands
      if (user.role === 'TEKNISI') {
        if (normalizedMessage.includes('/update_progress')) {
          return this.startProgressUpdate(telegramId);
        }

        if (normalizedMessage.includes('/evidence')) {
          return this.startEvidenceUpload(telegramId);
        }
      }

      // Handle session-based input
      const session = UserSession.getSession(telegramId);
      if (session && session.state) {
        return await this.handleSessionInput(telegramId, message, session);
      }

      // Default response with role-specific menu
      return this.getMainMenu(user.role);

    } catch (error) {
      console.error('Error processing message:', error);
      return {
        text: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.'
      };
    }
  }

  // Process callback queries (button presses)
  async processCallback(userId: string, callbackData: string, messageId: number): Promise<BotResponse | null> {
    const telegramId = parseInt(userId);

    try {
      const user = await AuthService.getUserByTelegramId(telegramId);
      if (!user) {
        return {
          text: 'Anda belum terdaftar dalam sistem. Silakan hubungi administrator.'
        };
      }

      // Handle main menu callbacks
      if (callbackData === 'main_menu') {
        return this.getMainMenu(user.role);
      }

      if (callbackData === 'help') {
        return this.getHelpMessage(user.role);
      }

      if (callbackData === 'my_orders') {
        return await this.handleMyOrders(user);
      }

      // HD specific callbacks
      if (user.role === 'HD') {
        if (callbackData === 'create_order') {
          return this.startOrderCreation(telegramId);
        }

        if (callbackData === 'update_status') {
          return this.startStatusUpdate(telegramId);
        }

        if (callbackData === 'reports') {
          return this.showReportOptions();
        }

        // Handle order creation flow
        if (callbackData.startsWith('sto_')) {
          return await this.handleSTOSelection(telegramId, callbackData);
        }

        if (callbackData.startsWith('trans_type_')) {
          return await this.handleTransactionTypeSelection(telegramId, callbackData);
        }

        if (callbackData.startsWith('service_')) {
          return await this.handleServiceTypeSelection(telegramId, callbackData);
        }

        if (callbackData.startsWith('assign_tech_')) {
          return await this.handleTechnicianAssignment(telegramId, callbackData);
        }

        // Handle report callbacks
        if (callbackData.startsWith('report_')) {
          return await this.handleReportGeneration(callbackData, user);
        }
      }

      // Teknisi specific callbacks
      if (user.role === 'TEKNISI') {
        if (callbackData === 'update_progress') {
          return this.startProgressUpdate(telegramId);
        }

        if (callbackData === 'upload_evidence') {
          return this.startEvidenceUpload(telegramId);
        }

        if (callbackData.startsWith('progress_')) {
          return await this.handleProgressUpdate(telegramId, callbackData);
        }

        if (callbackData.startsWith('evidence_')) {
          return await this.handleEvidenceTypeSelection(telegramId, callbackData);
        }
      }

      // Common callbacks
      if (callbackData.startsWith('order_detail_')) {
        const orderId = parseInt(callbackData.replace('order_detail_', ''));
        return await this.showOrderDetail(orderId, user);
      }

      if (callbackData.startsWith('order_progress_')) {
        const orderId = parseInt(callbackData.replace('order_progress_', ''));
        return await this.showOrderProgress(orderId);
      }

      if (callbackData.startsWith('order_evidence_')) {
        const orderId = parseInt(callbackData.replace('order_evidence_', ''));
        return await this.showOrderEvidence(orderId);
      }

      if (callbackData === 'cancel') {
        UserSession.clearSession(telegramId);
        return this.getMainMenu(user.role);
      }

      return null;

    } catch (error) {
      console.error('Error processing callback:', error);
      return {
        text: 'Terjadi kesalahan saat memproses permintaan Anda.'
      };
    }
  }

  // Process file uploads
  async processFileUpload(userId: string, file: any, caption: string): Promise<BotResponse> {
    const telegramId = parseInt(userId);

    try {
      const user = await AuthService.getUserByTelegramId(telegramId);
      if (!user) {
        return {
          text: 'Anda belum terdaftar dalam sistem.'
        };
      }

      const session = UserSession.getSession(telegramId);
      if (!session || !session.state || session.state !== 'uploading_evidence') {
        return {
          text: 'Silakan gunakan /evidence untuk memulai upload evidence.'
        };
      }

      // Handle evidence file upload
      return await this.handleEvidenceFileUpload(telegramId, file, caption, session);

    } catch (error) {
      console.error('Error processing file upload:', error);
      return {
        text: 'Terjadi kesalahan saat mengupload file.'
      };
    }
  }

  // Handle /start command
  private async handleStart(user: any, telegramId: number): Promise<BotResponse> {
    if (!user) {
      return {
        text: '👋 Selamat datang di Order Management Bot!\n\n' +
              'Anda belum terdaftar dalam sistem. Silakan hubungi administrator untuk mendaftarkan akun Anda dengan role yang sesuai (HD atau Teknisi).\n\n' +
              'Setelah terdaftar, gunakan /start untuk memulai.'
      };
    }

    const welcomeMessage = user.role === 'HD' 
      ? '👋 Selamat datang, *Helpdesk*!\n\nAnda dapat:\n• Membuat order baru\n• Assign teknisi\n• Update status order\n• Generate laporan\n\nPilih menu di bawah untuk memulai:'
      : '👋 Selamat datang, *Teknisi*!\n\nAnda dapat:\n• Melihat order yang ditugaskan\n• Update progress pekerjaan\n• Upload evidence\n• Cek status order\n\nPilih menu di bawah untuk memulai:';

    return {
      text: welcomeMessage,
      replyMarkup: this.getMainMenu(user.role).replyMarkup
    };
  }

  // Get main menu based on role
  private getMainMenu(role: string): BotResponse {
    if (role === 'HD') {
      return {
        text: '📋 *Menu Helpdesk*\n\nPilih aksi yang ingin dilakukan:',
        replyMarkup: TelegramUI.getHDMainMenu()
      };
    } else {
      return {
        text: '🔧 *Menu Teknisi*\n\nPilih aksi yang ingin dilakukan:',
        replyMarkup: TelegramUI.getTechniciansMainMenu()
      };
    }
  }

  // Get help message based on role
  private getHelpMessage(role: string): BotResponse {
    if (role === 'HD') {
      return {
        text: '❓ *Bantuan Helpdesk*\n\n' +
              '*Perintah yang tersedia:*\n' +
              '/order - Buat order baru\n' +
              '/myorders - Lihat semua order\n' +
              '/update_status - Update status order\n' +
              '/status <order_id> - Cek detail order\n' +
              '/report daily - Laporan harian\n' +
              '/report weekly - Laporan mingguan\n' +
              '/help - Tampilkan bantuan ini\n\n' +
              '*Cara kerja:*\n' +
              '1. Buat order baru dengan data pelanggan\n' +
              '2. Assign teknisi ke order\n' +
              '3. Monitor progress melalui notifikasi\n' +
              '4. Update status jika ada kendala\n' +
              '5. Generate laporan berkala'
      };
    } else {
      return {
        text: '❓ *Bantuan Teknisi*\n\n' +
              '*Perintah yang tersedia:*\n' +
              '/myorders - Lihat order yang ditugaskan\n' +
              '/update_progress - Update progress pekerjaan\n' +
              '/evidence - Upload evidence\n' +
              '/status <order_id> - Cek status order\n' +
              '/help - Tampilkan bantuan ini\n\n' +
              '*Tahapan pekerjaan:*\n' +
              '1. 🔍 Survey lokasi (Ready/Not Ready)\n' +
              '2. 🔌 Penarikan kabel\n' +
              '3. 📡 Instalasi ONT\n' +
              '4. 📸 Upload evidence lengkap\n' +
              '5. Tutup order'
      };
    }
  }

  // Handle my orders command
  private async handleMyOrders(user: any): Promise<BotResponse> {
    try {
      let orders: Order[];

      if (user.role === 'HD') {
        orders = await OrderService.getOrdersForHD(user.id);
      } else {
        orders = await OrderService.getOrdersForTechnician(user.id);
      }

      if (orders.length === 0) {
        return {
          text: user.role === 'HD' 
            ? '📋 Anda belum membuat order apapun.\n\nGunakan tombol "Buat Order Baru" untuk memulai.'
            : '📋 Tidak ada order yang ditugaskan kepada Anda saat ini.'
        };
      }

      return {
        text: `📋 *${user.role === 'HD' ? 'Order yang Anda buat' : 'Order yang ditugaskan'}:*\n\nTotal: ${orders.length} order`,
        replyMarkup: TelegramUI.getOrderListKeyboard(orders)
      };

    } catch (error) {
      console.error('Error getting orders:', error);
      return {
        text: 'Terjadi kesalahan saat mengambil data order.'
      };
    }
  }

  // Start order creation flow
  private startOrderCreation(telegramId: number): BotResponse {
    UserSession.setSession(telegramId, {
      state: 'creating_order',
      step: 'customer_name',
      orderData: {}
    });

    return {
      text: '📋 *Buat Order Baru*\n\nMasukkan nama pelanggan:'
    };
  }

  // Handle session-based input
  private async handleSessionInput(telegramId: number, message: string, session: any): Promise<BotResponse> {
    if (session.state === 'creating_order') {
      return await this.handleOrderCreationInput(telegramId, message, session);
    }

    if (session.state === 'updating_status') {
      return await this.handleStatusUpdateInput(telegramId, message, session);
    }

    if (session.state === 'uploading_evidence') {
      return await this.handleEvidenceTextInput(telegramId, message, session);
    }

    return {
      text: 'Sesi tidak valid. Silakan mulai ulang.'
    };
  }

  // Handle order creation input
  private async handleOrderCreationInput(telegramId: number, message: string, session: any): Promise<BotResponse> {
    const { step, orderData } = session;

    switch (step) {
      case 'customer_name':
        orderData.customer_name = message;
        UserSession.setSession(telegramId, {
          ...session,
          step: 'customer_address',
          orderData
        });
        return {
          text: '📍 Masukkan alamat pelanggan:'
        };

      case 'customer_address':
        orderData.customer_address = message;
        UserSession.setSession(telegramId, {
          ...session,
          step: 'customer_phone',
          orderData
        });
        return {
          text: '📞 Masukkan nomor telepon pelanggan:'
        };

      case 'customer_phone':
        orderData.customer_phone = message;
        UserSession.setSession(telegramId, {
          ...session,
          step: 'sto_selection',
          orderData
        });
        return {
          text: '🏢 Pilih STO:',
          replyMarkup: TelegramUI.getSTOSelectionKeyboard()
        };

      default:
        return {
          text: 'Langkah tidak valid. Silakan mulai ulang dengan /order'
        };
    }
  }

  // Handle STO selection
  private async handleSTOSelection(telegramId: number, callbackData: string): Promise<BotResponse> {
    const session = UserSession.getSession(telegramId);
    if (!session || session.state !== 'creating_order') {
      return { text: 'Sesi tidak valid. Silakan mulai ulang dengan /order' };
    }

    const sto = callbackData.replace('sto_', '');
    session.orderData.sto = sto;

    UserSession.setSession(telegramId, {
      ...session,
      step: 'transaction_type',
      orderData: session.orderData
    });

    return {
      text: `✅ STO: ${sto}\n\n🔄 Pilih tipe transaksi:`,
      replyMarkup: TelegramUI.getTransactionTypeKeyboard()
    };
  }

  // Handle transaction type selection
  private async handleTransactionTypeSelection(telegramId: number, callbackData: string): Promise<BotResponse> {
    const session = UserSession.getSession(telegramId);
    if (!session || session.state !== 'creating_order') {
      return { text: 'Sesi tidak valid. Silakan mulai ulang dengan /order' };
    }

    const transType = callbackData.replace('trans_type_', '').replace(/_/g, ' ');
    session.orderData.transaction_type = transType;

    UserSession.setSession(telegramId, {
      ...session,
      step: 'service_type',
      orderData: session.orderData
    });

    return {
      text: `✅ Tipe Transaksi: ${transType}\n\n🛠️ Pilih jenis layanan:`,
      replyMarkup: TelegramUI.getServiceTypeKeyboard()
    };
  }

  // Handle service type selection
  private async handleServiceTypeSelection(telegramId: number, callbackData: string): Promise<BotResponse> {
    const session = UserSession.getSession(telegramId);
    if (!session || session.state !== 'creating_order') {
      return { text: 'Sesi tidak valid. Silakan mulai ulang dengan /order' };
    }

    const serviceType = callbackData.replace('service_', '').replace(/_/g, ' ');
    session.orderData.service_type = serviceType;

    UserSession.setSession(telegramId, {
      ...session,
      step: 'technician_selection',
      orderData: session.orderData
    });

    // Get available technicians
    const technicians = await AuthService.getUsersByRole('TEKNISI');

    return {
      text: `✅ Jenis Layanan: ${serviceType}\n\n👨‍🔧 Pilih teknisi:`,
      replyMarkup: TelegramUI.getTechnicianSelectionKeyboard(technicians)
    };
  }

  // Handle technician assignment
  private async handleTechnicianAssignment(telegramId: number, callbackData: string): Promise<BotResponse> {
    const session = UserSession.getSession(telegramId);
    if (!session || session.state !== 'creating_order') {
      return { text: 'Sesi tidak valid. Silakan mulai ulang dengan /order' };
    }

    const technicianId = parseInt(callbackData.replace('assign_tech_', ''));
    const user = await AuthService.getUserByTelegramId(telegramId);
    
    if (!user) {
      return { text: 'User tidak ditemukan.' };
    }

    // Create the order
    const orderData = {
      ...session.orderData,
      created_by_hd_id: user.id,
      assigned_technician_id: technicianId
    };

    try {
      const order = await OrderService.createOrder(orderData);
      
      if (order) {
        // Clear session
        UserSession.clearSession(telegramId);

        // Send notification to technician
        await NotificationService.notifyOrderAssignment(order.id, technicianId);

        const technician = await AuthService.getUserById(technicianId);

        return {
          text: `✅ *Order berhasil dibuat!*\n\n` +
                `📋 Order ID: #${order.id}\n` +
                `👤 Pelanggan: ${order.customer_name}\n` +
                `📍 Alamat: ${order.customer_address}\n` +
                `📞 Telepon: ${order.customer_name}\n` +
                `🏢 STO: ${order.sto}\n` +
                `🔄 Transaksi: ${order.transaction_type}\n` +
                `🛠️ Layanan: ${order.service_type}\n` +
                `👨‍🔧 Teknisi: ${technician?.full_name}\n\n` +
                `Teknisi telah mendapat notifikasi dan dapat mulai bekerja.`,
          replyMarkup: TelegramUI.getHDMainMenu()
        };
      } else {
        return {
          text: 'Gagal membuat order. Silakan coba lagi.'
        };
      }

    } catch (error) {
      console.error('Error creating order:', error);
      return {
        text: 'Terjadi kesalahan saat membuat order.'
      };
    }
  }

  // Show order detail
  private async showOrderDetail(orderId: number, user: any): Promise<BotResponse> {
    try {
      const order = await OrderService.getOrderById(orderId);
      
      if (!order) {
        return { text: 'Order tidak ditemukan.' };
      }

      // Check permission
      if (user.role === 'TEKNISI' && order.assigned_technician_id !== user.id) {
        return { text: 'Anda tidak memiliki akses ke order ini.' };
      }

      if (user.role === 'HD' && order.created_by_hd_id !== user.id) {
        return { text: 'Anda tidak memiliki akses ke order ini.' };
      }

      const orderText = TelegramUI.formatOrderSummary(order);

      return {
        text: orderText,
        replyMarkup: TelegramUI.getOrderStatusKeyboard(orderId)
      };

    } catch (error) {
      console.error('Error showing order detail:', error);
      return {
        text: 'Terjadi kesalahan saat mengambil detail order.'
      };
    }
  }

  // Show order progress
  private async showOrderProgress(orderId: number): Promise<BotResponse> {
    try {
      const logs = await OrderService.getProgressLogs(orderId);
      const progressText = TelegramUI.formatProgressLog(logs);

      return {
        text: progressText,
        replyMarkup: {
          inline_keyboard: [[
            { text: '🔙 Kembali', callback_data: `order_detail_${orderId}` }
          ]]
        }
      };

    } catch (error) {
      console.error('Error showing order progress:', error);
      return {
        text: 'Terjadi kesalahan saat mengambil log progress.'
      };
    }
  }

  // Show order evidence
  private async showOrderEvidence(orderId: number): Promise<BotResponse> {
    try {
      const evidenceSummary = await EvidenceService.getEvidenceSummary(orderId);
      const evidenceText = TelegramUI.formatEvidenceSummary(evidenceSummary);

      return {
        text: evidenceText,
        replyMarkup: {
          inline_keyboard: [[
            { text: '🔙 Kembali', callback_data: `order_detail_${orderId}` }
          ]]
        }
      };

    } catch (error) {
      console.error('Error showing order evidence:', error);
      return {
        text: 'Terjadi kesalahan saat mengambil data evidence.'
      };
    }
  }

  // Start status update
  private startStatusUpdate(telegramId: number): BotResponse {
    return {
      text: '🔄 *Update Status Order*\n\nMasukkan Order ID yang ingin diupdate:'
    };
  }

  // Start progress update
  private startProgressUpdate(telegramId: number): BotResponse {
    return {
      text: '📊 *Update Progress*\n\nMasukkan Order ID yang ingin diupdate progressnya:'
    };
  }

  // Start evidence upload
  private startEvidenceUpload(telegramId: number): BotResponse {
    return {
      text: '📸 *Upload Evidence*\n\nMasukkan Order ID untuk upload evidence:'
    };
  }

  // Show report options
  private showReportOptions(): BotResponse {
    return {
      text: '📈 *Generate Laporan*\n\nPilih jenis laporan:',
      replyMarkup: TelegramUI.getReportTypeKeyboard()
    };
  }

  // Handle status command
  private async handleStatusCommand(message: string, user: any): Promise<BotResponse> {
    const parts = message.split(' ');
    if (parts.length < 2) {
      return {
        text: 'Format: /status <order_id>\nContoh: /status 123'
      };
    }

    const orderId = parseInt(parts[1]);
    if (isNaN(orderId)) {
      return {
        text: 'Order ID harus berupa angka.'
      };
    }

    return await this.showOrderDetail(orderId, user);
  }

  // Handle progress update
  private async handleProgressUpdate(telegramId: number, callbackData: string): Promise<BotResponse> {
    // Implementation for progress updates
    return {
      text: 'Progress update akan diimplementasikan.'
    };
  }

  // Handle evidence type selection
  private async handleEvidenceTypeSelection(telegramId: number, callbackData: string): Promise<BotResponse> {
    // Implementation for evidence type selection
    return {
      text: 'Evidence type selection akan diimplementasikan.'
    };
  }

  // Handle evidence file upload
  private async handleEvidenceFileUpload(telegramId: number, file: any, caption: string, session: any): Promise<BotResponse> {
    // Implementation for evidence file upload
    return {
      text: 'Evidence file upload akan diimplementasikan.'
    };
  }

  // Handle evidence text input
  private async handleEvidenceTextInput(telegramId: number, message: string, session: any): Promise<BotResponse> {
    // Implementation for evidence text input
    return {
      text: 'Evidence text input akan diimplementasikan.'
    };
  }

  // Handle status update input
  private async handleStatusUpdateInput(telegramId: number, message: string, session: any): Promise<BotResponse> {
    // Implementation for status update input
    return {
      text: 'Status update input akan diimplementasikan.'
    };
  }

  // Handle report generation
  private async handleReportGeneration(callbackData: string, user: any): Promise<BotResponse> {
    // Implementation for report generation
    return {
      text: 'Report generation akan diimplementasikan.'
    };
  }
}