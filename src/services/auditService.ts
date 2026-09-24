import { AuditLog, SystemRole } from '../types';
import { supabase } from '../lib/supabase';

const AUDIT_STORAGE_KEY = 'pes_audit_logs';

export class AuditService {
  public static getLogs(): AuditLog[] {
    try {
      const data = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as AuditLog[];
    } catch {
      return [];
    }
  }

  public static logAction(
    userId: string,
    userName: string,
    userRole: SystemRole,
    action: string,
    targetType: AuditLog['targetType'],
    targetId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ): AuditLog {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      userName,
      userRole,
      action,
      targetType,
      targetId,
      details,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
    };

    try {
      const current = this.getLogs();
      const updated = [newLog, ...current].slice(0, 1000);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));

      // Push to Supabase silently
      supabase.from('audit_logs').insert([{
        user_role: userRole,
        user_email: userName,
        action_type: action,
        details: details
      }]).then(({ error }) => {
        if (error) {
          console.warn('Supabase audit_logs sync warning:', error.message);
        }
      });
    } catch (e: any) {
      console.warn('Failed to persist audit log locally:', e);
    }

    return newLog;
  }
}
