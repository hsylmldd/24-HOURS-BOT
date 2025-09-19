import { supabase } from './supabase';
import { Order, OrderService } from './order-service';
import { AuthService } from './auth';

export interface NotificationTemplate {
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class NotificationService {
  // Send notification to user via Telegram
  static async sendNotification(
    userId: number,
    template: NotificationTemplate,
    orderId?: number,
    additionalData?: any
  ): Promise<boolean> {
    try {
      // Get user info
      const user = await AuthService.getUserById(userId);
      if (!user || !user.telegram_id) {
        console.error('User not found or no telegram_id:', userId);
        return false;
      }

      // Format message with additional data
      let message = template.message;
      if (orderId) {
        message = message.replace('{order_id}', orderId.toString());
      }
      if (additionalData) {
        Object.keys(additionalData).forEach(key => {
          message = message.replace(`{${key}}`, additionalData[key]);
        });
      }

      // Log notification to database
      await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          order_id: orderId,
          type: template.type,
          title: template.title,
          message: message,
          priority: template.priority,
          sent_at: new Date().toISOString()
        }]);

      // Here you would integrate with Telegram Bot API
      // For now, we'll just log it
      console.log(`Notification sent to user ${userId} (${user.telegram_id}):`, {
        title: template.title,
        message: message,
        priority: template.priority
      });

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  // Send order assignment notification to technician
  static async notifyOrderAssignment(orderId: number, technicianId: number): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order) return false;

    const template: NotificationTemplate = {
      type: 'ORDER_ASSIGNED',
      title: '📋 Order Baru Ditugaskan',
      message: `Anda mendapat order baru #{order_id}\n\nPelanggan: {customer_name}\nAlamat: {customer_address}\nLayanan: {service_type}\n\nSilakan gunakan /myorders untuk melihat detail lengkap.`,
      priority: 'high'
    };

    return await this.sendNotification(technicianId, template, orderId, {
      customer_name: order.customer_name,
      customer_address: order.customer_address,
      service_type: order.service_type
    });
  }

  // Send progress reminder to technician
  static async sendProgressReminder(orderId: number): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order || !order.assigned_technician_id) return false;

    const template: NotificationTemplate = {
      type: 'PROGRESS_REMINDER',
      title: '⏰ Reminder Update Progress',
      message: `Order #{order_id} belum ada update progress dalam 2 jam terakhir.\n\nPelanggan: {customer_name}\nStatus: {status}\n\nSilakan update progress menggunakan /update_progress`,
      priority: 'medium'
    };

    return await this.sendNotification(order.assigned_technician_id, template, orderId, {
      customer_name: order.customer_name,
      status: order.status
    });
  }

  // Send SLA warning notification
  static async sendSLAWarning(orderId: number): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order) return false;

    const template: NotificationTemplate = {
      type: 'SLA_WARNING',
      title: '🚨 Peringatan SLA',
      message: `Order #{order_id} mendekati batas SLA (3x24 jam)!\n\nPelanggan: {customer_name}\nSisa waktu: {remaining_time}\nStatus: {status}\n\nSegera selesaikan order ini!`,
      priority: 'urgent'
    };

    // Calculate remaining time
    const slaDeadline = new Date(order.sla_deadline || '');
    const now = new Date();
    const remainingHours = Math.ceil((slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    const remainingTime = remainingHours > 0 ? `${remainingHours} jam` : 'EXPIRED';

    // Send to technician
    if (order.assigned_technician_id) {
      await this.sendNotification(order.assigned_technician_id, template, orderId, {
        customer_name: order.customer_name,
        remaining_time: remainingTime,
        status: order.status
      });
    }

    // Send to HD (creator)
    if (order.created_by_hd_id) {
      await this.sendNotification(order.created_by_hd_id, template, orderId, {
        customer_name: order.customer_name,
        remaining_time: remainingTime,
        status: order.status
      });
    }

    return true;
  }

  // Send network not ready notification to HD
  static async notifyNetworkNotReady(orderId: number): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order || !order.created_by_hd_id) return false;

    const template: NotificationTemplate = {
      type: 'NETWORK_NOT_READY',
      title: '🔧 Jaringan Tidak Ready',
      message: `Order #{order_id} - Jaringan tidak ready!\n\nPelanggan: {customer_name}\nTeknisi: {technician_name}\n\nOrder otomatis On Hold. Silakan input waktu LME PT2 menggunakan /update_status`,
      priority: 'high'
    };

    // Get technician name
    const technician = order.assigned_technician_id ? 
      await AuthService.getUserById(order.assigned_technician_id) : null;

    return await this.sendNotification(order.created_by_hd_id, template, orderId, {
      customer_name: order.customer_name,
      technician_name: technician?.full_name || 'Unknown'
    });
  }

  // Send evidence incomplete notification
  static async notifyEvidenceIncomplete(orderId: number, missingEvidence: string[]): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order || !order.assigned_technician_id) return false;

    const template: NotificationTemplate = {
      type: 'EVIDENCE_INCOMPLETE',
      title: '📸 Evidence Belum Lengkap',
      message: `Order #{order_id} tidak bisa ditutup!\n\nEvidence yang masih kurang:\n{missing_list}\n\nSilakan lengkapi evidence menggunakan /evidence`,
      priority: 'medium'
    };

    const missingList = missingEvidence.map(e => `• ${this.getEvidenceDisplayName(e)}`).join('\n');

    return await this.sendNotification(order.assigned_technician_id, template, orderId, {
      missing_list: missingList
    });
  }

  // Send order completed notification
  static async notifyOrderCompleted(orderId: number): Promise<boolean> {
    const order = await OrderService.getOrderById(orderId);
    if (!order) return false;

    const template: NotificationTemplate = {
      type: 'ORDER_COMPLETED',
      title: '✅ Order Selesai',
      message: `Order #{order_id} telah selesai!\n\nPelanggan: {customer_name}\nTeknisi: {technician_name}\nWaktu selesai: {completion_time}\n\nTerima kasih atas kerja kerasnya!`,
      priority: 'low'
    };

    // Get technician name
    const technician = order.assigned_technician_id ? 
      await AuthService.getUserById(order.assigned_technician_id) : null;

    const completionTime = new Date().toLocaleString('id-ID');

    // Send to technician
    if (order.assigned_technician_id) {
      await this.sendNotification(order.assigned_technician_id, template, orderId, {
        customer_name: order.customer_name,
        technician_name: technician?.full_name || 'Unknown',
        completion_time: completionTime
      });
    }

    // Send to HD (creator)
    if (order.created_by_hd_id) {
      await this.sendNotification(order.created_by_hd_id, template, orderId, {
        customer_name: order.customer_name,
        technician_name: technician?.full_name || 'Unknown',
        completion_time: completionTime
      });
    }

    return true;
  }

  // Check for orders that need progress reminders
  static async checkProgressReminders(): Promise<void> {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      // Get orders that haven't been updated in 2 hours and are not completed
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['PENDING', 'IN_PROGRESS', 'ON_HOLD'])
        .lt('updated_at', twoHoursAgo.toISOString())
        .not('assigned_technician_id', 'is', null);

      if (error) throw error;

      for (const order of orders || []) {
        // Check if reminder was already sent in last 2 hours
        const { data: recentReminder } = await supabase
          .from('notifications')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'PROGRESS_REMINDER')
          .gte('sent_at', twoHoursAgo.toISOString())
          .single();

        if (!recentReminder) {
          await this.sendProgressReminder(order.id);
        }
      }
    } catch (error) {
      console.error('Error checking progress reminders:', error);
    }
  }

  // Check for orders approaching SLA deadline
  static async checkSLAWarnings(): Promise<void> {
    try {
      const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
      
      // Get orders approaching SLA deadline (within 6 hours)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['PENDING', 'IN_PROGRESS', 'ON_HOLD'])
        .lt('sla_deadline', sixHoursFromNow.toISOString())
        .gt('sla_deadline', new Date().toISOString());

      if (error) throw error;

      for (const order of orders || []) {
        // Check if SLA warning was already sent in last 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const { data: recentWarning } = await supabase
          .from('notifications')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'SLA_WARNING')
          .gte('sent_at', sixHoursAgo.toISOString())
          .single();

        if (!recentWarning) {
          await this.sendSLAWarning(order.id);
        }
      }
    } catch (error) {
      console.error('Error checking SLA warnings:', error);
    }
  }

  // Get user notifications
  static async getUserNotifications(
    userId: number, 
    limit: number = 10, 
    unreadOnly: boolean = false
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('read_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      return !error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
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

  // Schedule periodic checks (to be called by cron job or scheduler)
  static async runPeriodicChecks(): Promise<void> {
    console.log('Running periodic notification checks...');
    
    await Promise.all([
      this.checkProgressReminders(),
      this.checkSLAWarnings()
    ]);
    
    console.log('Periodic notification checks completed');
  }
}