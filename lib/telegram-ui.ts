export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export class TelegramUI {
  // Create main menu for HD
  static getHDMainMenu(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📋 Buat Order Baru', callback_data: 'create_order' },
          { text: '📊 Lihat Semua Order', callback_data: 'my_orders' }
        ],
        [
          { text: '🔄 Update Status', callback_data: 'update_status' },
          { text: '📈 Laporan', callback_data: 'reports' }
        ],
        [
          { text: '❓ Bantuan', callback_data: 'help' }
        ]
      ]
    };
  }

  // Create main menu for Teknisi
  static getTechniciansMainMenu(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📋 Order Saya', callback_data: 'my_orders' },
          { text: '🔄 Update Progress', callback_data: 'update_progress' }
        ],
        [
          { text: '📸 Upload Evidence', callback_data: 'upload_evidence' },
          { text: '🔍 Cek Status Order', callback_data: 'check_status' }
        ],
        [
          { text: '❓ Bantuan', callback_data: 'help' }
        ]
      ]
    };
  }

  // Create STO selection keyboard
  static getSTOSelectionKeyboard(): InlineKeyboardMarkup {
    const stos = [
      'CBB', 'CWA', 'GAN', 'JTN', 'KLD', 'KRG', 'PDK', 'PGB', 
      'PGG', 'PSR', 'RMG', 'BIN', 'CPE', 'JAG', 'KAL', 'KBY', 
      'KMG', 'PSM', 'TBE', 'NAS'
    ];

    const keyboard: InlineKeyboardButton[][] = [];
    
    // Create rows of 3 buttons each
    for (let i = 0; i < stos.length; i += 3) {
      const row = stos.slice(i, i + 3).map(sto => ({
        text: sto,
        callback_data: `sto_${sto}`
      }));
      keyboard.push(row);
    }

    // Add cancel button
    keyboard.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

    return { inline_keyboard: keyboard };
  }

  // Create transaction type selection keyboard
  static getTransactionTypeKeyboard(): InlineKeyboardMarkup {
    const types = [
      'Disconnect', 'Modify', 'New Install Existing', 
      'New Install JT', 'New Install', 'PDA'
    ];

    const keyboard = types.map(type => [{
      text: type,
      callback_data: `trans_type_${type.toLowerCase().replace(/\s+/g, '_')}`
    }]);

    keyboard.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

    return { inline_keyboard: keyboard };
  }

  // Create service type selection keyboard
  static getServiceTypeKeyboard(): InlineKeyboardMarkup {
    const services = ['Astinet', 'Metro', 'VPN IP', 'IP Transit', 'SIP Trunk'];

    const keyboard = services.map(service => [{
      text: service,
      callback_data: `service_${service.toLowerCase().replace(/\s+/g, '_')}`
    }]);

    keyboard.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

    return { inline_keyboard: keyboard };
  }

  // Create technician selection keyboard
  static getTechnicianSelectionKeyboard(technicians: any[]): InlineKeyboardMarkup {
    const keyboard = technicians.map(tech => [{
      text: `${tech.full_name} (${tech.username})`,
      callback_data: `assign_tech_${tech.id}`
    }]);

    keyboard.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

    return { inline_keyboard: keyboard };
  }

  // Progress update keyboard for technicians
  static getProgressUpdateKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🔍 Survey Selesai', callback_data: 'progress_survey' },
          { text: '🔌 Kabel Selesai', callback_data: 'progress_penarikan_kabel' }
        ],
        [
          { text: '📡 ONT Selesai', callback_data: 'progress_instalasi_ont' },
          { text: '📸 Upload Evidence', callback_data: 'upload_evidence' }
        ],
        [
          { text: '🔙 Kembali', callback_data: 'main_menu' }
        ]
      ]
    };
  }

  // Create evidence type selection keyboard
  static getEvidenceTypeKeyboard(missingEvidence: string[]): InlineKeyboardMarkup {
    const evidenceNames: { [key: string]: string } = {
      'NAMA_ODP': '📝 Nama ODP',
      'SN_ONT': '🔢 Serial Number ONT',
      'FOTO_SN_ONT': '📸 Foto SN ONT',
      'FOTO_TEKNISI_PELANGGAN': '👥 Foto Teknisi + Pelanggan',
      'FOTO_RUMAH_PELANGGAN': '🏠 Foto Rumah Pelanggan',
      'FOTO_DEPAN_ODP': '📸 Foto Depan ODP',
      'FOTO_DALAM_ODP': '📸 Foto Dalam ODP',
      'FOTO_LABEL_DC': '🏷️ Foto Label DC',
      'FOTO_TEST_REDAMAN': '📊 Foto Test Redaman'
    };

    const keyboard = missingEvidence.map(evidence => [{
      text: evidenceNames[evidence] || evidence,
      callback_data: `evidence_${evidence}`
    }]);

    keyboard.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

    return { inline_keyboard: keyboard };
  }

  // Create order status keyboard
  static getOrderStatusKeyboard(orderId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📋 Detail Order', callback_data: `order_detail_${orderId}` },
          { text: '📊 Progress Log', callback_data: `order_progress_${orderId}` }
        ],
        [
          { text: '📸 Evidence', callback_data: `order_evidence_${orderId}` },
          { text: '🔄 Update Progress', callback_data: `update_progress_${orderId}` }
        ],
        [
          { text: '🔙 Kembali', callback_data: 'my_orders' }
        ]
      ]
    };
  }

  // Create report type keyboard
  static getReportTypeKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📅 Laporan Harian', callback_data: 'report_daily' },
          { text: '📊 Laporan Mingguan', callback_data: 'report_weekly' }
        ],
        [
          { text: '📈 Statistik SLA', callback_data: 'report_sla' },
          { text: '👥 Laporan Teknisi', callback_data: 'report_technician' }
        ],
        [
          { text: '❌ Batal', callback_data: 'cancel' }
        ]
      ]
    };
  }

  // Create confirmation keyboard
  static getConfirmationKeyboard(action: string, data?: string): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '✅ Ya', callback_data: `confirm_${action}${data ? '_' + data : ''}` },
          { text: '❌ Tidak', callback_data: `cancel_${action}` }
        ]
      ]
    };
  }

  // Create error keyboard for retry actions
  static getErrorKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🔄 Coba Lagi', callback_data: 'retry_action' },
          { text: '❓ Bantuan', callback_data: 'help' }
        ]
      ]
    };
  }

  // Create pagination keyboard
  static getPaginationKeyboard(
    currentPage: number, 
    totalPages: number, 
    baseCallback: string
  ): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [];
    const row: InlineKeyboardButton[] = [];

    // Previous button
    if (currentPage > 1) {
      row.push({
        text: '⬅️ Sebelumnya',
        callback_data: `${baseCallback}_page_${currentPage - 1}`
      });
    }

    // Page info
    row.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'page_info'
    });

    // Next button
    if (currentPage < totalPages) {
      row.push({
        text: 'Selanjutnya ➡️',
        callback_data: `${baseCallback}_page_${currentPage + 1}`
      });
    }

    if (row.length > 0) {
      keyboard.push(row);
    }

    return { inline_keyboard: keyboard };
  }

  // Create order list keyboard
  static getOrderListKeyboard(orders: any[], page: number = 1): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [];
    const itemsPerPage = 5;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageOrders = orders.slice(startIndex, endIndex);

    // Add order buttons
    pageOrders.forEach(order => {
      const statusEmoji = this.getStatusEmoji(order.status);
      keyboard.push([{
        text: `${statusEmoji} #${order.id} - ${order.customer_name}`,
        callback_data: `order_detail_${order.id}`
      }]);
    });

    // Add pagination if needed
    const totalPages = Math.ceil(orders.length / itemsPerPage);
    if (totalPages > 1) {
      const paginationRow: InlineKeyboardButton[] = [];
      
      if (page > 1) {
        paginationRow.push({
          text: '⬅️',
          callback_data: `orders_page_${page - 1}`
        });
      }
      
      paginationRow.push({
        text: `${page}/${totalPages}`,
        callback_data: 'page_info'
      });
      
      if (page < totalPages) {
        paginationRow.push({
          text: '➡️',
          callback_data: `orders_page_${page + 1}`
        });
      }
      
      keyboard.push(paginationRow);
    }

    // Add back button
    keyboard.push([{ text: '🔙 Menu Utama', callback_data: 'main_menu' }]);

    return { inline_keyboard: keyboard };
  }

  // Get status emoji
  static getStatusEmoji(status: string): string {
    const statusEmojis: { [key: string]: string } = {
      'PENDING': '⏳',
      'IN_PROGRESS': '🔄',
      'ON_HOLD': '⏸️',
      'INSTALLATION': '🔧',
      'COMPLETED': '✅',
      'CANCELLED': '❌'
    };

    return statusEmojis[status] || '❓';
  }

  // Get priority emoji
  static getPriorityEmoji(priority: string): string {
    const priorityEmojis: { [key: string]: string } = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🟠',
      'urgent': '🔴'
    };

    return priorityEmojis[priority] || '⚪';
  }

  // Format order summary for display
  static formatOrderSummary(order: any): string {
    const statusEmoji = this.getStatusEmoji(order.status);
    const createdDate = new Date(order.created_at).toLocaleDateString('id-ID');
    
    return `${statusEmoji} *Order #${order.id}*\n\n` +
           `👤 *Pelanggan:* ${order.customer_name}\n` +
           `📍 *Alamat:* ${order.customer_address}\n` +
           `📞 *Kontak:* ${order.customer_phone}\n` +
           `🏢 *STO:* ${order.sto}\n` +
           `🔄 *Transaksi:* ${order.transaction_type}\n` +
           `🛠️ *Layanan:* ${order.service_type}\n` +
           `📅 *Dibuat:* ${createdDate}\n` +
           `📊 *Status:* ${order.status}`;
  }

  // Format progress log for display
  static formatProgressLog(logs: any[]): string {
    if (logs.length === 0) {
      return '📝 *Log Progress:*\n\nBelum ada progress yang dicatat.';
    }

    let logText = '📝 *Log Progress:*\n\n';
    
    logs.forEach((log, index) => {
      const timestamp = new Date(log.created_at).toLocaleString('id-ID');
      const emoji = this.getStatusEmoji(log.status);
      
      logText += `${emoji} *${log.status}*\n`;
      logText += `⏰ ${timestamp}\n`;
      if (log.notes) {
        logText += `📝 ${log.notes}\n`;
      }
      if (index < logs.length - 1) {
        logText += '\n';
      }
    });

    return logText;
  }

  // Format evidence summary for display
  static formatEvidenceSummary(evidenceSummary: any): string {
    const { total, completed, missing, completionPercentage } = evidenceSummary;
    
    let text = `📸 *Evidence Progress:* ${completed}/${total} (${completionPercentage}%)\n\n`;
    
    if (missing.length > 0) {
      text += '❌ *Masih kurang:*\n';
      missing.forEach((evidence: string) => {
        text += `• ${this.getEvidenceDisplayName(evidence)}\n`;
      });
    } else {
      text += '✅ *Semua evidence sudah lengkap!*';
    }
    
    return text;
  }

  // Get evidence display name
  static getEvidenceDisplayName(evidenceType: string): string {
    const displayNames: { [key: string]: string } = {
      'NAMA_ODP': 'Nama ODP',
      'SN_ONT': 'Serial Number ONT',
      'FOTO_SN_ONT': 'Foto Serial Number ONT',
      'FOTO_TEKNISI_PELANGGAN': 'Foto Teknisi + Pelanggan',
      'FOTO_RUMAH_PELANGGAN': 'Foto Rumah Pelanggan',
      'FOTO_DEPAN_ODP': 'Foto Depan ODP',
      'FOTO_DALAM_ODP': 'Foto Dalam ODP',
      'FOTO_LABEL_DC': 'Foto Label DC',
      'FOTO_TEST_REDAMAN': 'Foto Hasil Test Redaman di ODP'
    };

    return displayNames[evidenceType] || evidenceType;
  }
}