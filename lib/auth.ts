import { supabase } from './supabase';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  full_name: string;
  role: 'HD' | 'TEKNISI';
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class AuthService {
  // Get user by Telegram ID
  static async getUserByTelegramId(telegramId: number): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by telegram ID:', error);
      return null;
    }
  }

  // Register new user
  static async registerUser(userData: {
    telegram_id: number;
    username?: string;
    full_name: string;
    role: 'HD' | 'TEKNISI';
    phone?: string;
  }): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error registering user:', error);
      return null;
    }
  }

  // Update user information
  static async updateUser(telegramId: number, updates: Partial<User>): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user by ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserById:', error);
      return null;
    }
  }

  // Get users by role
  static async getUsersByRole(role: 'HD' | 'TEKNISI'): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', role)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  // Get all technicians for assignment
  static async getTechnicians(): Promise<User[]> {
    return this.getUsersByRole('TEKNISI');
  }

  // Get all HD users
  static async getHDUsers(): Promise<User[]> {
    return this.getUsersByRole('HD');
  }

  // Deactivate user
  static async deactivateUser(telegramId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('telegram_id', telegramId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }

  // Check if user has permission for action
  static hasPermission(user: User, action: string): boolean {
    const permissions = {
      HD: [
        'create_order',
        'assign_technician',
        'update_sod_e2e',
        'update_lme_pt2',
        'view_all_orders',
        'generate_reports',
        'reassign_order'
      ],
      TEKNISI: [
        'view_assigned_orders',
        'update_progress',
        'upload_evidence',
        'view_order_details'
      ]
    };

    return permissions[user.role]?.includes(action) || false;
  }

  // Get user role display name
  static getRoleDisplayName(role: 'HD' | 'TEKNISI'): string {
    const roleNames = {
      HD: 'Helpdesk',
      TEKNISI: 'Teknisi'
    };

    return roleNames[role];
  }

  // Validate user registration data
  static validateUserData(userData: {
    telegram_id: number;
    full_name: string;
    role: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!userData.telegram_id || userData.telegram_id <= 0) {
      errors.push('Telegram ID tidak valid');
    }

    if (!userData.full_name || userData.full_name.trim().length < 2) {
      errors.push('Nama lengkap minimal 2 karakter');
    }

    if (!['HD', 'TEKNISI'].includes(userData.role)) {
      errors.push('Role harus HD atau TEKNISI');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// User session management for bot context
export class UserSession {
  private static sessions = new Map<number, any>();

  // Set user session data
  static setSession(telegramId: number, data: any): void {
    this.sessions.set(telegramId, {
      ...data,
      lastActivity: new Date()
    });
  }

  // Get user session data
  static getSession(telegramId: number): any {
    return this.sessions.get(telegramId);
  }

  // Clear user session
  static clearSession(telegramId: number): void {
    this.sessions.delete(telegramId);
  }

  // Set user state for multi-step operations
  static setState(telegramId: number, state: string, data?: any): void {
    const session = this.getSession(telegramId) || {};
    session.state = state;
    session.stateData = data;
    this.setSession(telegramId, session);
  }

  // Get user state
  static getState(telegramId: number): { state?: string; data?: any } {
    const session = this.getSession(telegramId);
    return {
      state: session?.state,
      data: session?.stateData
    };
  }

  // Clear user state
  static clearState(telegramId: number): void {
    const session = this.getSession(telegramId);
    if (session) {
      delete session.state;
      delete session.stateData;
      this.setSession(telegramId, session);
    }
  }

  // Clean up old sessions (call periodically)
  static cleanupSessions(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [telegramId, session] of Array.from(this.sessions.entries())) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(telegramId);
      }
    }
  }
}