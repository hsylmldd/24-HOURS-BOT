import { supabase } from './supabase';
import { EvidenceFile, EVIDENCE_TYPES } from './order-service';

export class EvidenceService {
  // Upload evidence file to Supabase Storage
  static async uploadFile(
    orderId: number,
    evidenceType: string,
    file: Buffer,
    fileName: string,
    userId: number
  ): Promise<EvidenceFile | null> {
    try {
      // Generate unique file name
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `order_${orderId}/${evidenceType}_${timestamp}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(uniqueFileName, file, {
          contentType: this.getContentType(fileExtension || ''),
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('evidence-files')
        .getPublicUrl(uniqueFileName);

      // Save evidence record to database
      const { data, error } = await supabase
        .from('evidence_files')
        .insert([{
          order_id: orderId,
          evidence_type: evidenceType,
          file_url: urlData.publicUrl,
          file_name: fileName,
          uploaded_by_user_id: userId
        }])
        .select()
        .single();

      if (error) throw error;

      // Check if all evidence is complete
      await this.checkEvidenceComplete(orderId);

      return data;
    } catch (error) {
      console.error('Error uploading evidence file:', error);
      return null;
    }
  }

  // Save text-based evidence (like NAMA_ODP, SN_ONT)
  static async saveTextEvidence(
    orderId: number,
    evidenceType: string,
    textValue: string,
    userId: number
  ): Promise<EvidenceFile | null> {
    try {
      const { data, error } = await supabase
        .from('evidence_files')
        .insert([{
          order_id: orderId,
          evidence_type: evidenceType,
          text_value: textValue,
          uploaded_by_user_id: userId
        }])
        .select()
        .single();

      if (error) throw error;

      // Check if all evidence is complete
      await this.checkEvidenceComplete(orderId);

      return data;
    } catch (error) {
      console.error('Error saving text evidence:', error);
      return null;
    }
  }

  // Get all evidence for an order
  static async getOrderEvidence(orderId: number): Promise<EvidenceFile[]> {
    try {
      const { data, error } = await supabase
        .from('evidence_files')
        .select('*')
        .eq('order_id', orderId)
        .order('uploaded_at', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting order evidence:', error);
      return [];
    }
  }

  // Check if specific evidence type exists for order
  static async hasEvidence(orderId: number, evidenceType: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('evidence_files')
        .select('id')
        .eq('order_id', orderId)
        .eq('evidence_type', evidenceType)
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  // Get missing evidence types for an order
  static async getMissingEvidence(orderId: number): Promise<string[]> {
    try {
      const existingEvidence = await this.getOrderEvidence(orderId);
      const existingTypes = existingEvidence.map(e => e.evidence_type);
      
      return EVIDENCE_TYPES.filter(type => !existingTypes.includes(type));
    } catch (error) {
      console.error('Error getting missing evidence:', error);
      return EVIDENCE_TYPES;
    }
  }

  // Check if all required evidence is complete
  static async checkEvidenceComplete(orderId: number): Promise<boolean> {
    try {
      const missingEvidence = await this.getMissingEvidence(orderId);
      const isComplete = missingEvidence.length === 0;

      // Update order evidence_complete status
      await supabase
        .from('orders')
        .update({ evidence_complete: isComplete })
        .eq('id', orderId);

      return isComplete;
    } catch (error) {
      console.error('Error checking evidence complete:', error);
      return false;
    }
  }

  // Delete evidence file
  static async deleteEvidence(evidenceId: number): Promise<boolean> {
    try {
      // Get evidence record first
      const { data: evidence, error: getError } = await supabase
        .from('evidence_files')
        .select('*')
        .eq('id', evidenceId)
        .single();

      if (getError) throw getError;

      // Delete from storage if it's a file
      if (evidence.file_url) {
        const fileName = evidence.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('evidence-files')
            .remove([`order_${evidence.order_id}/${fileName}`]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('evidence_files')
        .delete()
        .eq('id', evidenceId);

      if (error) throw error;

      // Recheck evidence complete status
      await this.checkEvidenceComplete(evidence.order_id);

      return true;
    } catch (error) {
      console.error('Error deleting evidence:', error);
      return false;
    }
  }

  // Get content type for file extension
  static getContentType(extension: string): string {
    const contentTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain'
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Validate evidence file
  static validateEvidenceFile(fileName: string, fileSize: number): { valid: boolean; error?: string } {
    // Check file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: 'Format file tidak didukung. Gunakan: JPG, PNG, GIF, atau PDF'
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (fileSize > maxSize) {
      return {
        valid: false,
        error: 'Ukuran file terlalu besar. Maksimal 10MB'
      };
    }

    return { valid: true };
  }

  // Get evidence type display name
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

  // Check if evidence type requires file upload or text input
  static isTextEvidence(evidenceType: string): boolean {
    return ['NAMA_ODP', 'SN_ONT'].includes(evidenceType);
  }

  // Generate evidence summary for order
  static async getEvidenceSummary(orderId: number): Promise<{
    total: number;
    completed: number;
    missing: string[];
    completionPercentage: number;
  }> {
    try {
      const missingEvidence = await this.getMissingEvidence(orderId);
      const total = EVIDENCE_TYPES.length;
      const completed = total - missingEvidence.length;
      const completionPercentage = Math.round((completed / total) * 100);

      return {
        total,
        completed,
        missing: missingEvidence,
        completionPercentage
      };
    } catch (error) {
      console.error('Error getting evidence summary:', error);
      return {
        total: EVIDENCE_TYPES.length,
        completed: 0,
        missing: EVIDENCE_TYPES,
        completionPercentage: 0
      };
    }
  }
}