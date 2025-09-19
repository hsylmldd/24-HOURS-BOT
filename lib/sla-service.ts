import { supabase } from './supabase';
import { OrderService } from './order-service';
import { ProgressService } from './progress-service';

export interface SLACalculation {
  orderId: number;
  startTime: Date;
  endTime: Date | null;
  totalDuration: number;
  lmeDuration: number;
  effectiveDuration: number;
  isCompliant: boolean;
  slaDeadline: Date;
  ttiHours: number;
  remainingHours: number;
  status: 'ON_TIME' | 'WARNING' | 'OVERDUE';
}

export class SLAService {
  private static readonly TTI_LIMIT_HOURS = 72; // 3x24 hours
  private static readonly WARNING_THRESHOLD_HOURS = 12; // Warning 12 hours before deadline

  // Calculate TTI (Time to Install) compliance
  static async calculateTTI(orderId: number): Promise<SLACalculation | null> {
    try {
      // Get order details
      const order = await OrderService.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get progress data from new structure
      const progressService = new ProgressService(supabase);
      const progress = await progressService.getOrderProgress(orderId);
      
      const startTime = this.getEffectiveStartTime(order);
      const slaDeadline = new Date(order.sla_deadline || order.created_at);
      
      if (!progress) {
        return {
          orderId,
          startTime,
          endTime: null,
          totalDuration: 0,
          lmeDuration: 0,
          effectiveDuration: 0,
          isCompliant: false,
          slaDeadline,
          ttiHours: 0,
          remainingHours: this.calculateRemainingHours(startTime, slaDeadline),
          status: 'ON_TIME'
        };
      }

      // Calculate based on evidence upload completion
      const endTime = progress.evidence_upload.completed_at ? new Date(progress.evidence_upload.completed_at) : null;
      
      if (!endTime) {
        const remainingHours = this.calculateRemainingHours(startTime, slaDeadline);
        return {
          orderId,
          startTime,
          endTime: null,
          totalDuration: 0,
          lmeDuration: 0,
          effectiveDuration: 0,
          isCompliant: false,
          slaDeadline,
          ttiHours: 0,
          remainingHours,
          status: this.getStatus(remainingHours)
        };
      }

      const totalDuration = endTime.getTime() - startTime.getTime();
      const lmeDuration = this.calculateLMEDuration(order);
      const effectiveDuration = totalDuration - lmeDuration;
      
      // Convert to hours
      const ttiHours = effectiveDuration / (1000 * 60 * 60);
      const isCompliant = ttiHours <= this.TTI_LIMIT_HOURS;
      const remainingHours = this.calculateRemainingHours(startTime, slaDeadline);

      return {
        orderId,
        startTime,
        endTime,
        totalDuration,
        lmeDuration,
        effectiveDuration,
        isCompliant,
        slaDeadline,
        ttiHours,
        remainingHours,
        status: this.getStatus(remainingHours)
      };

    } catch (error) {
      console.error('Error calculating TTI:', error);
      return null;
    }
  }

  // Helper methods
  private static getEffectiveStartTime(order: any): Date {
    // Use order creation time as start time
    return new Date(order.created_at);
  }

  private static calculateLMEDuration(order: any): number {
    // For now, return 0 as LME duration calculation is not implemented
    // This can be enhanced later based on business requirements
    return 0;
  }

  private static calculateRemainingHours(startTime: Date, deadline: Date): number {
    const now = new Date();
    const remainingMs = deadline.getTime() - now.getTime();
    return Math.max(0, remainingMs / (1000 * 60 * 60));
  }

  private static getStatus(remainingHours: number): 'ON_TIME' | 'WARNING' | 'OVERDUE' {
    if (remainingHours <= 0) {
      return 'OVERDUE';
    } else if (remainingHours <= this.WARNING_THRESHOLD_HOURS) {
      return 'WARNING';
    } else {
      return 'ON_TIME';
    }
  }

  // Update SOD time
  static async updateSODTime(orderId: number, sodTime: Date): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          sod_time: sodTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating SOD time:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateSODTime:', error);
      return false;
    }
  }

  // Update E2E time
  static async updateE2ETime(orderId: number, e2eTime: Date): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          e2e_time: e2eTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating E2E time:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateE2ETime:', error);
      return false;
    }
  }

  // Update LME PT2 start time
  static async updateLMEPT2Start(orderId: number, lmeStart: Date): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          lme_pt2_start: lmeStart.toISOString(),
          status: 'ON_HOLD',
          notes: 'Jaringan tidak ready - LME PT2 dimulai',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating LME PT2 start:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateLMEPT2Start:', error);
      return false;
    }
  }

  // Update LME PT2 end time
  static async updateLMEPT2End(orderId: number, lmeEnd: Date): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          lme_pt2_end: lmeEnd.toISOString(),
          status: 'IN_PROGRESS',
          notes: 'LME PT2 selesai - pekerjaan dapat dilanjutkan',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating LME PT2 end:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateLMEPT2End:', error);
      return false;
    }
  }

  // Get orders approaching SLA deadline
  static async getOrdersApproachingDeadline(): Promise<number[]> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .in('status', ['PENDING', 'IN_PROGRESS']);

      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }

      const approachingOrders: number[] = [];

      for (const order of orders || []) {
        const sla = await this.calculateTTI(order.id);
        if (sla && (sla.status === 'WARNING' || sla.status === 'OVERDUE')) {
          approachingOrders.push(order.id);
        }
      }

      return approachingOrders;

    } catch (error) {
      console.error('Error in getOrdersApproachingDeadline:', error);
      return [];
    }
  }

  // Get overdue orders
  static async getOverdueOrders(): Promise<number[]> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .in('status', ['PENDING', 'IN_PROGRESS']);

      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }

      const overdueOrders: number[] = [];

      for (const order of orders || []) {
        const sla = await this.calculateTTI(order.id);
        if (sla && sla.status === 'OVERDUE') {
          overdueOrders.push(order.id);
        }
      }

      return overdueOrders;

    } catch (error) {
      console.error('Error in getOverdueOrders:', error);
      return [];
    }
  }

  // Format SLA status for display
  static formatSLAStatus(sla: SLACalculation): string {
    const hoursText = sla.endTime
      ? `${sla.ttiHours.toFixed(1)} jam`
      : 'Belum selesai';

    let statusText: string;
    if (sla.status === 'OVERDUE') {
      statusText = sla.endTime ? 'TTI Tidak Comply' : 'Melewati Deadline';
    } else if (sla.status === 'WARNING') {
      statusText = 'Mendekati Deadline';
    } else {
      statusText = sla.endTime ? 'TTI Comply' : 'Dalam Batas Waktu';
    }

    return `${hoursText} - ${statusText}`;
  }

  // Get SLA summary for reporting
  static async getSLASummary(startDate: Date, endDate: Date): Promise<{
    totalOrders: number;
    compliantOrders: number;
    nonCompliantOrders: number;
    averageTTI: number;
    complianceRate: number;
  }> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'COMPLETED');

      if (error) {
        console.error('Error fetching orders for SLA summary:', error);
        return {
          totalOrders: 0,
          compliantOrders: 0,
          nonCompliantOrders: 0,
          averageTTI: 0,
          complianceRate: 0
        };
      }

      let compliantCount = 0;
      let totalTTI = 0;
      const totalOrders = orders?.length || 0;

      for (const order of orders || []) {
        const sla = await this.calculateTTI(order.id);
        if (sla) {
          totalTTI += sla.ttiHours;
          if (sla.isCompliant) {
            compliantCount++;
          }
        }
      }

      const averageTTI = totalOrders > 0 ? totalTTI / totalOrders : 0;
      const complianceRate = totalOrders > 0 ? (compliantCount / totalOrders) * 100 : 0;

      return {
        totalOrders,
        compliantOrders: compliantCount,
        nonCompliantOrders: totalOrders - compliantCount,
        averageTTI,
        complianceRate
      };

    } catch (error) {
      console.error('Error in getSLASummary:', error);
      return {
        totalOrders: 0,
        compliantOrders: 0,
        nonCompliantOrders: 0,
        averageTTI: 0,
        complianceRate: 0
      };
    }
  }

  // Check if order needs SLA warning notification
  static async needsSLAWarning(orderId: number): Promise<boolean> {
    try {
      const sla = await this.calculateTTI(orderId);
      return sla ? sla.status === 'WARNING' : false;
    } catch (error) {
      console.error('Error checking SLA warning:', error);
      return false;
    }
  }

  // Check if order is overdue
  static async isOverdue(orderId: number): Promise<boolean> {
    try {
      const sla = await this.calculateTTI(orderId);
      return sla ? sla.status === 'OVERDUE' : false;
    } catch (error) {
      console.error('Error checking overdue status:', error);
      return false;
    }
  }
}