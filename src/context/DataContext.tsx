import React, { createContext, useContext, useState, useEffect } from 'react';
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

export interface DataContextType {
  departments: Department[];
  employees: Employee[];
  settings: SystemSettings;
  evaluations: Evaluation[];
  auditLogs: AuditLog[];
  selectedQuarter: EvaluationQuarter | '';
  selectedYear: number;
  setSelectedQuarter: (q: EvaluationQuarter | '') => void;
  setSelectedYear: (y: number) => void;
  saveEvaluation: (evaluation: Evaluation) => Promise<Evaluation>;
  saveSettings: (settings: SystemSettings) => void;
  saveEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;
  saveDepartments: (depts: Department[]) => void;
  refreshData: () => Promise<Evaluation[]>;
  exportBackup: () => string;
  restoreBackup: (jsonStr: string) => { success: boolean; message: string };
  importEmployeesCSV: (csv: string) => { importedCount: number; errors: string[] };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [selectedQuarter, setSelectedQuarter] = useState<EvaluationQuarter | ''>('');
  const [selectedYear, setSelectedYear] = useState<number>(settings.activeYear || 2026);

  const refreshLocalData = () => {
    setDepartments(StorageService.getDepartments());
    setEmployees(StorageService.getEmployees());
    const s = StorageService.getSettings();
    setSettings(s);
    setAuditLogs(AuditService.getLogs());
  };

  const refreshData = async () => {
    refreshLocalData();
    const remoteEvaluations = await StorageService.getEvaluationsFromSupabase();
    setEvaluations(remoteEvaluations);
    return remoteEvaluations;
  };

  useEffect(() => {
    StorageService.initialize();
    refreshData().catch((error) => {
      console.error('Failed to load evaluations from Supabase:', error);
      setEvaluations([]);
    });
  }, []);

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

  const saveSettings = (newSettings: SystemSettings) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    StorageService.saveSettings(newSettings, actorId, actorName, actorRole);
    
    logActivity({
      userRole: actorRole,
      userEmail: currentUser?.email || actorName,
      actionType: 'UPDATE_SETTINGS',
      details: `Updated system settings`
    });

    refreshLocalData();
  };

  const saveEmployee = (emp: Employee) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    StorageService.saveEmployee(emp, actorId, actorName, actorRole);
    
    // Log to Supabase
    logActivity({
      userRole: actorRole,
      userEmail: currentUser?.email || actorName,
      actionType: 'SAVE_EMPLOYEE',
      details: `Saved/Updated employee: ${emp.name} (${emp.email})`
    });

    refreshLocalData();
  };

  const deleteEmployee = (id: string) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    const empName = employees.find(e => e.id === id)?.name || id;

    StorageService.deleteEmployee(id, actorId, actorName, actorRole);
    
    // Log to Supabase
    logActivity({
      userRole: actorRole,
      userEmail: currentUser?.email || actorName,
      actionType: 'DELETE_EMPLOYEE',
      details: `Deleted employee: ${empName}`
    });

    refreshLocalData();
  };

  const saveDepartments = (depts: Department[]) => {
    StorageService.saveDepartments(depts);
    refreshLocalData();
  };

  const exportBackup = () => {
    return StorageService.exportFullBackup();
  };

  const restoreBackup = (jsonStr: string) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    const res = StorageService.restoreBackup(jsonStr, actorId, actorName, actorRole);
    refreshLocalData();
    return res;
  };

  const importEmployeesCSV = (csv: string) => {
    const actorId = currentUser?.id || 'system';
    const actorName = currentUser?.name || 'System User';
    const actorRole = currentUser?.systemRole || 'ADMIN';

    const res = StorageService.importEmployeesFromCSV(csv, actorId, actorName, actorRole);
    refreshLocalData();
    return res;
  };

  return (
    <DataContext.Provider
      value={{
        departments,
        employees,
        settings,
        evaluations,
        auditLogs,
        selectedQuarter,
        selectedYear,
        setSelectedQuarter,
        setSelectedYear,
        saveEvaluation,
        saveSettings,
        saveEmployee,
        deleteEmployee,
        saveDepartments,
        refreshData,
        exportBackup,
        restoreBackup,
        importEmployeesCSV,
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
