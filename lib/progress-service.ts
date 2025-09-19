import { supabase } from './supabase';

export interface ProgressStage {
  survey: {
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
    started_at?: Date;
    completed_at?: Date;
    notes?: string;
    updated_by_user_id?: number;
  };
  penarikan_kabel: {
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
    started_at?: Date;
    completed_at?: Date;
    notes?: string;
    updated_by_user_id?: number;
  };
  instalasi_ont: {
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
    started_at?: Date;
    completed_at?: Date;
    notes?: string;
    updated_by_user_id?: number;
  };
  evidence_upload: {
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
    started_at?: Date;
    completed_at?: Date;
    notes?: string;
    updated_by_user_id?: number;
  };
}

export interface ProgressUpdate {
  orderId: number;
  stage: 'survey' | 'penarikan_kabel' | 'instalasi_ont' | 'evidence_upload';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  notes?: string;
  updatedByUserId: number;
}

export class ProgressService {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  // Get current progress for an order
  async getOrderProgress(orderId: number): Promise<ProgressStage | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM order_progress WHERE order_id = $1',
        [orderId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        survey: {
          status: row.survey_status || 'PENDING',
          started_at: row.survey_started_at,
          completed_at: row.survey_completed_at,
          notes: row.survey_notes,
          updated_by_user_id: row.survey_updated_by_user_id
        },
        penarikan_kabel: {
          status: row.penarikan_kabel_status || 'PENDING',
          started_at: row.penarikan_kabel_started_at,
          completed_at: row.penarikan_kabel_completed_at,
          notes: row.penarikan_kabel_notes,
          updated_by_user_id: row.penarikan_kabel_updated_by_user_id
        },
        instalasi_ont: {
          status: row.instalasi_ont_status || 'PENDING',
          started_at: row.instalasi_ont_started_at,
          completed_at: row.instalasi_ont_completed_at,
          notes: row.instalasi_ont_notes,
          updated_by_user_id: row.instalasi_ont_updated_by_user_id
        },
        evidence_upload: {
          status: row.evidence_upload_status || 'PENDING',
          started_at: row.evidence_upload_started_at,
          completed_at: row.evidence_upload_completed_at,
          notes: row.evidence_upload_notes,
          updated_by_user_id: row.evidence_upload_updated_by_user_id
        }
      };
    } catch (error) {
      console.error('Error getting order progress:', error);
      throw error;
    }
  }

  // Update progress for a specific stage
  async updateProgress(update: ProgressUpdate): Promise<boolean> {
    try {
      const { orderId, stage, status, notes, updatedByUserId } = update;
      const now = new Date();

      // Build dynamic query based on stage
      let setClause = '';
      let values: any[] = [];
      let paramIndex = 1;

      // Status update
      setClause += `${stage}_status = $${paramIndex++}`;
      values.push(status);

      // Timestamp updates
      if (status === 'IN_PROGRESS') {
        setClause += `, ${stage}_started_at = $${paramIndex++}`;
        values.push(now);
      } else if (status === 'COMPLETED') {
        setClause += `, ${stage}_completed_at = $${paramIndex++}`;
        values.push(now);
      }

      // Notes update
      if (notes) {
        setClause += `, ${stage}_notes = $${paramIndex++}`;
        values.push(notes);
      }

      // Updated by user
      setClause += `, ${stage}_updated_by_user_id = $${paramIndex++}`;
      values.push(updatedByUserId);

      // Updated at timestamp
      setClause += `, updated_at = $${paramIndex++}`;
      values.push(now);

      // Order ID for WHERE clause
      values.push(orderId);

      const query = `
        UPDATE order_progress 
        SET ${setClause}
        WHERE order_id = $${paramIndex}
      `;

      const result = await this.db.query(query, values);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  // Get progress summary for display
  async getProgressSummary(orderId: number): Promise<string> {
    try {
      const progress = await this.getOrderProgress(orderId);
      if (!progress) {
        return 'Progress tidak ditemukan';
      }

      const stages = [
        { name: '🔍 Survey Lokasi', data: progress.survey },
        { name: '🔌 Penarikan Kabel', data: progress.penarikan_kabel },
        { name: '📡 Instalasi ONT', data: progress.instalasi_ont },
        { name: '📸 Upload Evidence', data: progress.evidence_upload }
      ];

      let summary = '*Progress Order:*\n\n';
      
      stages.forEach(stage => {
        const statusIcon = this.getStatusIcon(stage.data.status);
        summary += `${statusIcon} ${stage.name}: ${stage.data.status}\n`;
        
        if (stage.data.started_at) {
          summary += `   ⏰ Dimulai: ${this.formatDate(stage.data.started_at)}\n`;
        }
        
        if (stage.data.completed_at) {
          summary += `   ✅ Selesai: ${this.formatDate(stage.data.completed_at)}\n`;
        }
        
        if (stage.data.notes) {
          summary += `   📝 Catatan: ${stage.data.notes}\n`;
        }
        
        summary += '\n';
      });

      return summary;
    } catch (error) {
      console.error('Error getting progress summary:', error);
      return 'Error mengambil progress';
    }
  }

  // Get next available stage for progression
  async getNextStage(orderId: number): Promise<string | null> {
    try {
      const progress = await this.getOrderProgress(orderId);
      if (!progress) return 'survey';

      const stages = ['survey', 'penarikan_kabel', 'instalasi_ont', 'evidence_upload'];
      
      for (const stage of stages) {
        const stageData = progress[stage as keyof ProgressStage] as any;
        if (stageData.status === 'PENDING' || stageData.status === 'IN_PROGRESS') {
          return stage;
        }
      }

      return null; // All stages completed
    } catch (error) {
      console.error('Error getting next stage:', error);
      return null;
    }
  }

  // Check if order is completed
  async isOrderCompleted(orderId: number): Promise<boolean> {
    try {
      const progress = await this.getOrderProgress(orderId);
      if (!progress) return false;

      return progress.evidence_upload.status === 'COMPLETED';
    } catch (error) {
      console.error('Error checking order completion:', error);
      return false;
    }
  }

  // Helper methods
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'COMPLETED': return '✅';
      case 'IN_PROGRESS': return '🔄';
      case 'ON_HOLD': return '⏸️';
      default: return '⏳';
    }
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Initialize progress for new order
  async initializeProgress(orderId: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        'INSERT INTO order_progress (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING',
        [orderId]
      );
      return true;
    } catch (error) {
      console.error('Error initializing progress:', error);
      throw error;
    }
  }

  // Get progress statistics
  async getProgressStats(orderId: number): Promise<{
    totalStages: number;
    completedStages: number;
    currentStage: string | null;
    completionPercentage: number;
  }> {
    try {
      const progress = await this.getOrderProgress(orderId);
      if (!progress) {
        return {
          totalStages: 4,
          completedStages: 0,
          currentStage: 'survey',
          completionPercentage: 0
        };
      }

      const stages = ['survey', 'penarikan_kabel', 'instalasi_ont', 'evidence_upload'];
      let completedStages = 0;
      let currentStage: string | null = null;

      for (const stage of stages) {
        const stageData = progress[stage as keyof ProgressStage] as any;
        if (stageData.status === 'COMPLETED') {
          completedStages++;
        } else if (!currentStage && (stageData.status === 'IN_PROGRESS' || stageData.status === 'PENDING')) {
          currentStage = stage;
        }
      }

      return {
        totalStages: 4,
        completedStages,
        currentStage,
        completionPercentage: Math.round((completedStages / 4) * 100)
      };
    } catch (error) {
      console.error('Error getting progress stats:', error);
      throw error;
    }
  }


}