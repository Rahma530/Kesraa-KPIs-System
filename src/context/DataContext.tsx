import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Department,
  Employee,
  Evaluation,
  SystemSettings,
  AuditLog,
  EvaluationQuarter,
} from '../types';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';
import { useAuth } from './AuthContext';
import { logActivity } from '../utils/auditLogger';
import { EmployeeManagementService } from '../services/employeeManagementService';

export type SettingsSource = 'database' | 'cache' | 'defaults';
export type SaveSettingsResult = { status: 'saved' } | { status: 'conflict' };

export interface DataContextType {
  departments: Department[];
  employees: Employee[];
  settings: SystemSettings;
  settingsSource: SettingsSource;
  evaluations: Evaluation[];
  auditLogs: AuditLog[];
  selectedQuarter: EvaluationQuarter | '';
  selectedYear: number;
  setSelectedQuarter: (q: EvaluationQuarter | '') => void;
  setSelectedYear: (y: number) => void;
  saveEvaluation: (evaluation: Evaluation) => Promise<Evaluation>;
  saveSettings: (settings: SystemSettings) => Promise<SaveSettingsResult>;
  saveEmployee: (emp: Employee) => Promise<Employee>;
  saveDepartments: (depts: Department[]) => void;
  refreshEmployees: () => Promise<Employee[]>;
  refreshData: () => Promise<Evaluation[]>;
  exportBackup: () => string;
  restoreBackup: (jsonStr: string) => { success: boolean; message: string };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [initialSettings] = useState(() => StorageService.getCachedSettings());
  const [settings, setSettings] = useState<SystemSettings>(initialSettings.settings);
  const [settingsSource, setSettingsSource] = useState<SettingsSource>(initialSettings.source);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [selectedQuarter, setSelectedQuarter] = useState<EvaluationQuarter | ''>('');
  const [selectedYear, setSelectedYear] = useState<number>(settings.activeYear || 2026);

  const refreshLocalAuxiliaryData = useCallback(() => {
    setAuditLogs(AuditService.getLogs());
  }, []);

  const refreshEmployees = useCallback(async (): Promise<Employee[]> => {
    if (!currentUser?.id) {
      setEmployees([]);
      setDepartments([]);
      return [];
    }

    const roster = await EmployeeManagementService.listEvaluationRoster();
    const authoritativeDepartments: Department[] = roster.departments.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.id,
      description: '',
      isActive: true,
    }));
    const authoritativeEmployees: Employee[] = roster.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      // Evaluation consumers do not need employee contact or account-link data. The
      // server deliberately omits those fields from this role-filtered roster.
      email: '',
      departmentId: employee.departmentId,
      departmentName: employee.departmentName,
      role: employee.jobTitle,
      level: employee.level,
      startDate: employee.startDate,
      isActive: true,
      isHeadTechnical: employee.systemRole === 'HEAD_TECHNICAL',
      systemRole: employee.systemRole,
      createdAt: employee.startDate,
      updatedAt: employee.startDate,
    }));
    setDepartments(authoritativeDepartments);
    setEmployees(authoritativeEmployees);
    return authoritativeEmployees;
  }, [currentUser?.id]);

  const refreshData = useCallback(async () => {
    if (!currentUser?.id) {
      setEmployees([]);
      setDepartments([]);
      setEvaluations([]);
      refreshLocalAuxiliaryData();
      return [];
    }
    const [, remoteEvaluations] = await Promise.all([
      refreshEmployees(),
      StorageService.getEvaluationsFromSupabase(),
    ]);
    setEvaluations(remoteEvaluations);
    refreshLocalAuxiliaryData();
    return remoteEvaluations;
  }, [currentUser?.id, refreshEmployees, refreshLocalAuxiliaryData]);

  // Shared settings come from public.settings; keep the cached/default copy if that fails.
  const loadSettings = useCallback(async () => {
    const remoteSettings = await StorageService.fetchSettingsFromSupabase();
    if (remoteSettings) {
      setSettings(remoteSettings);
      setSettingsSource('database');
    }
    return remoteSettings;
  }, []);

  useEffect(() => {
    if (currentUser?.id) void loadSettings();
  }, [currentUser?.id, loadSettings]);

  useEffect(() => {
    StorageService.initialize();
    refreshLocalAuxiliaryData();
  }, [refreshLocalAuxiliaryData]);

  useEffect(() => {
    if (!currentUser?.id) {
      setEmployees([]);
      setDepartments([]);
      setEvaluations([]);
      return;
    }
    refreshData().catch((error) => {
      console.error('Failed to load authoritative Supabase data:', error);
      setEmployees([]);
      setDepartments([]);
      setEvaluations([]);
    });
  }, [currentUser?.id, refreshData]);

  const saveEvaluation = async (evaluation: Evaluation): Promise<Evaluation> => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';
    const actorEmail = currentUser?.email || '';

    // Pass email so Supabase gets correct evaluator_email
    const saved = await StorageService.saveEvaluation(evaluation, actorId, actorName, actorRole, actorEmail);
    
    // Log activity to audit_logs table
    logActivity({
      userRole: actorRole,
      userEmail: actorEmail || actorName,
      actionType: 'EVALUATE_EMPLOYEE',
      details: `Evaluated employee ${evaluation.employeeId} in ${evaluation.quarter} ${evaluation.year}`
    });

    await refreshData();
    return saved;
  };

  const saveSettings = async (newSettings: SystemSettings): Promise<SaveSettingsResult> => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    const result = await StorageService.saveSettingsToSupabase(newSettings, {
      id: actorId,
      name: actorName,
      email: currentUser?.email || '',
      role: actorRole,
    });
    if (result.status === 'conflict') {
      await loadSettings();
      return { status: 'conflict' };
    }

    setSettings(result.settings);
    setSettingsSource('database');
    logActivity({
      userRole: actorRole,
      userEmail: currentUser?.email || actorName,
      actionType: 'UPDATE_SETTINGS',
      details: `Updated system settings`
    });

    await loadSettings();
    refreshLocalAuxiliaryData();
    return { status: 'saved' };
  };

  const saveEmployee = async (emp: Employee): Promise<Employee> => {
    const result = await EmployeeManagementService.save({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      departmentId: emp.departmentId,
      jobTitle: emp.role,
      level: emp.level,
      systemRole: emp.systemRole,
      startDate: emp.startDate,
    });
    const saved = result.employee;
    const mapped: Employee = {
      id: saved.id,
      accountEnabled: saved.accountEnabled,
      name: saved.name,
      email: saved.email,
      phone: saved.phone || undefined,
      departmentId: saved.departmentId,
      departmentName: saved.departmentName,
      role: saved.jobTitle,
      level: saved.level,
      startDate: saved.startDate,
      isActive: saved.employmentActive !== false,
      isHeadTechnical: saved.systemRole === 'HEAD_TECHNICAL',
      systemRole: saved.systemRole,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
    const refreshedEmployees = await refreshEmployees();
    return refreshedEmployees.find((employee) => employee.id === mapped.id) || mapped;
  };

  const saveDepartments = (depts: Department[]) => {
    StorageService.saveDepartments(depts);
    setDepartments(depts);
    refreshLocalAuxiliaryData();
  };

  const exportBackup = () => {
    return StorageService.exportFullBackup(employees);
  };

  const restoreBackup = (jsonStr: string) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    const res = StorageService.restoreBackup(jsonStr, actorId, actorName, actorRole);
    refreshLocalAuxiliaryData();
    if (res.success) void refreshData();
    return res;
  };

  return (
    <DataContext.Provider
      value={{
        departments,
        employees,
        settings,
        settingsSource,
        evaluations,
        auditLogs,
        selectedQuarter,
        selectedYear,
        setSelectedQuarter,
        setSelectedYear,
        saveEvaluation,
        saveSettings,
        saveEmployee,
        saveDepartments,
        refreshEmployees,
        refreshData,
        exportBackup,
        restoreBackup,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
