import { supabase } from './supabase';
import { User } from './auth';

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  customer_contact: string;
  sto: string;
  transaction_type: string;
  service_type: string;
  created_by_hd_id: number;
  assigned_technician_id?: number;
  sod_time?: string;
  e2e_time?: string;
  lme_pt2_start?: string;
  lme_pt2_end?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'CLOSED' | 'CANCELLED';
  current_stage: 'SURVEY' | 'PENARIKAN_KABEL' | 'INSTALASI_ONT' | 'EVIDENCE_UPLOAD' | 'COMPLETED';
  tti_comply?: boolean;
  sla_deadline?: string;
  evidence_complete: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface OrderProgressLog {
  id: number;
  order_id: number;
  stage: string;
  status: string;
  notes?: string;
  updated_by_user_id: number;
  timestamp: string;
  duration_minutes?: number;
}

export interface EvidenceFile {
  id: number;
  order_id: number;
  evidence_type: string;
  file_url?: string;
  file_name?: string;
  text_value?: string;
  uploaded_by_user_id: number;
  uploaded_at: string;
}

export const STO_OPTIONS = ['CBB', 'CWA', 'GAN', 'JTN', 'KLD', 'KRG', 'PDK', 'PGB', 'PGG', 'PSR', 'RMG', 'BIN', 'CPE', 'JAG', 'KAL', 'KBY', 'KMG', 'PSM', 'TBE', 'NAS'];

export const TRANSACTION_TYPES = ['Disconnect', 'Modify', 'New Install Existing', 'New Install JT', 'New Install', 'PDA'];

export const SERVICE_TYPES = ['Astinet', 'Metro', 'VPN IP', 'IP Transit', 'SIP Trunk'];

export const EVIDENCE_TYPES = [
  'NAMA_ODP', 'SN_ONT', 'FOTO_SN_ONT', 'FOTO_TEKNISI_PELANGGAN',
  'FOTO_RUMAH_PELANGGAN', 'FOTO_DEPAN_ODP', 'FOTO_DALAM_ODP',
  'FOTO_LABEL_DC', 'FOTO_TEST_REDAMAN'
];

export const STAGES = ['SURVEY', 'PENARIKAN_KABEL', 'INSTALASI_ONT', 'EVIDENCE_UPLOAD', 'COMPLETED'];

export class OrderService {
  // Create new order
  static async createOrder(orderData: {
    customer_name: string;
    customer_address: string;
    customer_contact: string;
    sto: string;
    transaction_type: string;
    service_type: string;
    created_by_hd_id: number;
    assigned_technician_id?: number;
  }): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...orderData,
          sla_deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 hours from now
        }])
        .select()
        .single();

      if (error) throw error;

      // Log order creation
      await this.logProgress(data.id, 'SURVEY', 'STARTED', 'Order created', orderData.created_by_hd_id);

      // Update bot stats
      await this.updateBotStats();

      return data;
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  // Get order by ID
  static async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }

  // Get order by order number
  static async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting order by number:', error);
      return null;
    }
  }

  // Get orders for HD (all orders)
  static async getOrdersForHD(hdUserId: number, status?: string): Promise<Order[]> {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting orders for HD:', error);
      return [];
    }
  }

  // Get orders for technician (assigned orders only)
  static async getOrdersForTechnician(technicianId: number, status?: string): Promise<Order[]> {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('assigned_technician_id', technicianId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting orders for technician:', error);
      return [];
    }
  }

  // Assign technician to order
  static async assignTechnician(orderId: number, technicianId: number, assignedBy: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          assigned_technician_id: technicianId,
          status: 'IN_PROGRESS'
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log assignment
      await this.logProgress(orderId, 'SURVEY', 'STARTED', `Assigned to technician ID: ${technicianId}`, assignedBy);

      return true;
    } catch (error) {
      console.error('Error assigning technician:', error);
      return false;
    }
  }

  // Update order progress
  static async updateProgress(
    orderId: number, 
    stage: string, 
    status: string, 
    notes: string, 
    userId: number
  ): Promise<boolean> {
    try {
      // Log progress
      await this.logProgress(orderId, stage, status, notes, userId);

      // Update order current stage and status
      const updateData: any = { current_stage: stage };
      
      if (status === 'COMPLETED') {
        const nextStage = this.getNextStage(stage);
        if (nextStage) {
          updateData.current_stage = nextStage;
        } else {
          updateData.current_stage = 'COMPLETED';
          updateData.status = 'CLOSED';
          updateData.closed_at = new Date().toISOString();
        }
      } else if (status === 'ON_HOLD') {
        updateData.status = 'ON_HOLD';
      } else if (status === 'STARTED') {
        updateData.status = 'IN_PROGRESS';
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating progress:', error);
      return false;
    }
  }

  // Log progress with timestamp
  static async logProgress(
    orderId: number, 
    stage: string, 
    status: string, 
    notes: string, 
    userId: number
  ): Promise<boolean> {
    try {
      // This method is deprecated - use ProgressService instead
      console.warn('OrderService.logProgress is deprecated. Use ProgressService.updateProgress instead.');
      return true;
    } catch (error) {
      console.error('Error logging progress:', error);
      return false;
    }
  }

  // Get progress logs for order
  static async getProgressLogs(orderId: number): Promise<OrderProgressLog[]> {
    try {
      // This method is deprecated - use ProgressService instead
      console.warn('OrderService.getProgressLogs is deprecated. Use ProgressService.getOrderProgress instead.');
      return [];
    } catch (error) {
      console.error('Error getting progress logs:', error);
      return [];
    }
  }

  // Update SOD and E2E times
  static async updateSODAndE2E(orderId: number, sodTime?: string, e2eTime?: string): Promise<boolean> {
    try {
      const updateData: any = {};
      if (sodTime) updateData.sod_time = sodTime;
      if (e2eTime) updateData.e2e_time = e2eTime;

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating SOD/E2E:', error);
      return false;
    }
  }

  // Update LME PT2 times
  static async updateLMEPT2(orderId: number, startTime?: string, endTime?: string): Promise<boolean> {
    try {
      const updateData: any = {};
      if (startTime) updateData.lme_pt2_start = startTime;
      if (endTime) {
        updateData.lme_pt2_end = endTime;
        updateData.status = 'IN_PROGRESS'; // Resume from ON_HOLD
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating LME PT2:', error);
      return false;
    }
  }

  // Get next stage in the workflow
  static getNextStage(currentStage: string): string | null {
    const stageOrder = ['SURVEY', 'PENARIKAN_KABEL', 'INSTALASI_ONT', 'EVIDENCE_UPLOAD', 'COMPLETED'];
    const currentIndex = stageOrder.indexOf(currentStage);
    
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      return stageOrder[currentIndex + 1];
    }
    
    return null;
  }

  // Check if order is overdue
  static isOrderOverdue(order: Order): boolean {
    if (!order.sla_deadline || order.status === 'CLOSED') return false;
    return new Date(order.sla_deadline) < new Date();
  }

  // Get overdue orders
  static async getOverdueOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .lt('sla_deadline', new Date().toISOString())
        .neq('status', 'CLOSED')
        .order('sla_deadline', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting overdue orders:', error);
      return [];
    }
  }

  // Update bot statistics
  static async updateBotStats(): Promise<void> {
    try {
      // Get counts
      const { data: totalOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' });

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .in('status', ['PENDING', 'IN_PROGRESS', 'ON_HOLD']);

      const { data: completedOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('status', 'CLOSED');

      // Update stats
      await supabase
        .from('bot_stats')
        .update({
          total_orders: totalOrders?.length || 0,
          active_orders: activeOrders?.length || 0,
          completed_orders: completedOrders?.length || 0,
          last_updated: new Date().toISOString()
        })
        .eq('id', 1);

    } catch (error) {
      console.error('Error updating bot stats:', error);
    }
  }

  // Generate daily report
  static async getDailyReport(date: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('daily_report')
        .select('*')
        .eq('report_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data;
    } catch (error) {
      console.error('Error getting daily report:', error);
      return null;
    }
  }

  // Generate weekly report
  static async getWeeklyReport(startDate: string, endDate: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('daily_report')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting weekly report:', error);
      return [];
    }
  }
}