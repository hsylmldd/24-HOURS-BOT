import { supabase } from './supabase';
import { SLAService } from './sla-service';

export interface OrderReport {
  date: string;
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  onHoldOrders: number;
  overdueOrders: number;
  complianceRate: number;
  averageTTI: number;
}

export interface TechnicianReport {
  technicianId: number;
  technicianName: string;
  assignedOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageCompletionTime: number;
  complianceRate: number;
}

export interface DetailedOrderInfo {
  id: number;
  customer_name: string;
  sto: string;
  transaction_type: string;
  service_type: string;
  status: string;
  created_at: string;
  assigned_technician_name?: string;
  sla_status: string;
  tti_hours?: number;
}

export class ReportService {
  // Generate daily report
  static async generateDailyReport(date: Date): Promise<OrderReport> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return await this.generateReportForPeriod(startOfDay, endOfDay, date.toISOString().split('T')[0]);

    } catch (error) {
      console.error('Error generating daily report:', error);
      return this.getEmptyReport(date.toISOString().split('T')[0]);
    }
  }

  // Generate weekly report
  static async generateWeeklyReport(startDate: Date): Promise<OrderReport> {
    try {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const weekLabel = `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`;
      
      return await this.generateReportForPeriod(startDate, endDate, weekLabel);

    } catch (error) {
      console.error('Error generating weekly report:', error);
      return this.getEmptyReport('Weekly Report');
    }
  }

  // Generate report for specific period
  private static async generateReportForPeriod(startDate: Date, endDate: Date, label: string): Promise<OrderReport> {
    try {
      // Get orders in the period
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          assigned_technician_id,
          sod_time,
          e2e_time,
          lme_pt2_start,
          lme_pt2_end
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        console.error('Error fetching orders for report:', error);
        return this.getEmptyReport(label);
      }

      const totalOrders = orders?.length || 0;
      let pendingOrders = 0;
      let inProgressOrders = 0;
      let completedOrders = 0;
      let onHoldOrders = 0;
      let overdueOrders = 0;
      let totalTTI = 0;
      let compliantOrders = 0;

      // Analyze each order
      for (const order of orders || []) {
        // Count by status
        switch (order.status) {
          case 'PENDING':
            pendingOrders++;
            break;
          case 'IN_PROGRESS':
            inProgressOrders++;
            break;
          case 'COMPLETED':
            completedOrders++;
            break;
          case 'ON_HOLD':
            onHoldOrders++;
            break;
        }

        // Calculate SLA metrics
        const sla = await SLAService.calculateTTI(order.id);
        if (sla) {
          totalTTI += sla.ttiHours;
          if (sla.isCompliant) {
            compliantOrders++;
          }
          if (sla.status === 'OVERDUE') {
            overdueOrders++;
          }
        }
      }

      const averageTTI = totalOrders > 0 ? totalTTI / totalOrders : 0;
      const complianceRate = totalOrders > 0 ? (compliantOrders / totalOrders) * 100 : 0;

      return {
        date: label,
        totalOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        onHoldOrders,
        overdueOrders,
        complianceRate,
        averageTTI
      };

    } catch (error) {
      console.error('Error in generateReportForPeriod:', error);
      return this.getEmptyReport(label);
    }
  }

  // Generate technician performance report
  static async generateTechnicianReport(startDate: Date, endDate: Date): Promise<TechnicianReport[]> {
    try {
      // Get all technicians
      const { data: technicians, error: techError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'TEKNISI')
        .eq('is_active', true);

      if (techError) {
        console.error('Error fetching technicians:', techError);
        return [];
      }

      const reports: TechnicianReport[] = [];

      for (const technician of technicians || []) {
        // Get orders assigned to this technician in the period
        const { data: orders, error: orderError } = await supabase
          .from('orders')
          .select('id, status, created_at')
          .eq('assigned_technician_id', technician.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (orderError) {
          console.error('Error fetching orders for technician:', orderError);
          continue;
        }

        const assignedOrders = orders?.length || 0;
        const completedOrders = orders?.filter(o => o.status === 'COMPLETED').length || 0;
        const pendingOrders = orders?.filter(o => o.status === 'PENDING').length || 0;

        // Calculate average completion time and compliance rate
        let totalCompletionTime = 0;
        let compliantCount = 0;

        for (const order of orders || []) {
          if (order.status === 'COMPLETED') {
            const sla = await SLAService.calculateTTI(order.id);
            if (sla) {
              totalCompletionTime += sla.ttiHours;
              if (sla.isCompliant) {
                compliantCount++;
              }
            }
          }
        }

        const averageCompletionTime = completedOrders > 0 ? totalCompletionTime / completedOrders : 0;
        const complianceRate = completedOrders > 0 ? (compliantCount / completedOrders) * 100 : 0;

        reports.push({
          technicianId: technician.id,
          technicianName: technician.full_name,
          assignedOrders,
          completedOrders,
          pendingOrders,
          averageCompletionTime,
          complianceRate
        });
      }

      return reports.sort((a, b) => b.completedOrders - a.completedOrders);

    } catch (error) {
      console.error('Error generating technician report:', error);
      return [];
    }
  }

  // Get detailed order list for report
  static async getDetailedOrderList(startDate: Date, endDate: Date, status?: string): Promise<DetailedOrderInfo[]> {
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          sto,
          transaction_type,
          service_type,
          status,
          created_at,
          assigned_technician:users!assigned_technician_id(full_name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error('Error fetching detailed order list:', error);
        return [];
      }

      const detailedOrders: DetailedOrderInfo[] = [];

      for (const order of orders || []) {
        const sla = await SLAService.calculateTTI(order.id);
        
        detailedOrders.push({
          id: order.id,
          customer_name: order.customer_name,
          sto: order.sto,
          transaction_type: order.transaction_type,
          service_type: order.service_type,
          status: order.status,
          created_at: order.created_at,
          assigned_technician_name: order.assigned_technician?.[0]?.full_name,
          sla_status: sla ? SLAService.formatSLAStatus(sla) : 'N/A',
          tti_hours: sla?.ttiHours
        });
      }

      return detailedOrders;

    } catch (error) {
      console.error('Error getting detailed order list:', error);
      return [];
    }
  }

  // Format report as text for Telegram
  static formatReportText(report: OrderReport): string {
    return `📊 *Laporan Order - ${report.date}*\n\n` +
           `📋 *Total Order:* ${report.totalOrders}\n` +
           `⏳ *Pending:* ${report.pendingOrders}\n` +
           `🔄 *In Progress:* ${report.inProgressOrders}\n` +
           `✅ *Completed:* ${report.completedOrders}\n` +
           `⏸️ *On Hold:* ${report.onHoldOrders}\n` +
           `🚨 *Overdue:* ${report.overdueOrders}\n\n` +
           `📈 *Metrics:*\n` +
           `• TTI Compliance: ${report.complianceRate.toFixed(1)}%\n` +
           `• Rata-rata TTI: ${report.averageTTI.toFixed(1)} jam\n\n` +
           `_Generated at ${new Date().toLocaleString('id-ID')}_`;
  }

  // Format technician report as text
  static formatTechnicianReportText(reports: TechnicianReport[], period: string): string {
    let text = `👨‍🔧 *Laporan Performa Teknisi - ${period}*\n\n`;

    if (reports.length === 0) {
      text += 'Tidak ada data teknisi untuk periode ini.';
      return text;
    }

    reports.forEach((report, index) => {
      text += `${index + 1}. *${report.technicianName}*\n`;
      text += `   📋 Assigned: ${report.assignedOrders}\n`;
      text += `   ✅ Completed: ${report.completedOrders}\n`;
      text += `   ⏳ Pending: ${report.pendingOrders}\n`;
      text += `   ⏱️ Avg TTI: ${report.averageCompletionTime.toFixed(1)}h\n`;
      text += `   📊 Compliance: ${report.complianceRate.toFixed(1)}%\n\n`;
    });

    text += `_Generated at ${new Date().toLocaleString('id-ID')}_`;
    return text;
  }

  // Get empty report template
  private static getEmptyReport(date: string): OrderReport {
    return {
      date,
      totalOrders: 0,
      pendingOrders: 0,
      inProgressOrders: 0,
      completedOrders: 0,
      onHoldOrders: 0,
      overdueOrders: 0,
      complianceRate: 0,
      averageTTI: 0
    };
  }

  // Get current week start date (Monday)
  static getCurrentWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Get previous week start date
  static getPreviousWeekStart(): Date {
    const currentWeekStart = this.getCurrentWeekStart();
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    return previousWeekStart;
  }

  // Get today's date
  static getToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Get yesterday's date
  static getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }
}