import {
  Department,
  Employee,
  Evaluation,
  SystemSettings,
  AuditLog,
  EvaluationStatus
} from '../types';
import {
  INITIAL_DEPARTMENTS,
  INITIAL_EMPLOYEES,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_EVALUATIONS
} from '../config/initialData';
import { AuditService } from './auditService';
import { CalculationEngine } from './calculationEngine';
import { supabase } from '../lib/supabase';
import {
  MANAGERIAL_DEPARTMENT_ID,
  normalizeDepartment,
  normalizeEmployeeDepartment,
  normalizeEmployeeRole,
  normalizeEvaluationDepartment,
  normalizeEvaluationRole,
} from '../utils/departmentNames';

const STORAGE_KEYS = {
  DEPARTMENTS: 'pes_departments_v7',
  EMPLOYEES: 'pes_employees_v7',
  SETTINGS: 'pes_settings_v7',
  EVALUATIONS: 'pes_evaluations_v7',
  INITIALIZED: 'pes_initialized_v7',
};

export class StorageService {
  public static initialize(): void {
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(INITIAL_DEPARTMENTS));
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SYSTEM_SETTINGS));
      localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(INITIAL_EVALUATIONS));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

      AuditService.logAction(
        'system-bootstrap',
        'System Initializer',
        'ADMIN',
        'SYSTEM_INITIALIZED',
        'SETTINGS',
        'global-settings',
        'Initialized Performance Evaluation System with default departments, employees, and KPI matrices.'
      );
    }
  }

  // --- DEPARTMENTS ---
  public static getDepartments(): Department[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
      const departments: Department[] = data ? JSON.parse(data) : INITIAL_DEPARTMENTS;
      return departments
        .filter((department) => department.id !== MANAGERIAL_DEPARTMENT_ID)
        .map(normalizeDepartment);
    } catch {
      return INITIAL_DEPARTMENTS
        .filter((department) => department.id !== MANAGERIAL_DEPARTMENT_ID)
        .map(normalizeDepartment);
    }
  }

  public static saveDepartments(depts: Department[]): void {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(depts));
  }

  // --- EMPLOYEES ---
  public static getEmployees(): Employee[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      const employees: Employee[] = data ? JSON.parse(data) : INITIAL_EMPLOYEES;
      return employees.map(normalizeEmployeeDepartment).map(normalizeEmployeeRole);
    } catch {
      return INITIAL_EMPLOYEES.map(normalizeEmployeeDepartment).map(normalizeEmployeeRole);
    }
  }

  public static saveEmployee(employee: Employee, actorId: string, actorName: string, actorRole: any): void {
    const employees = this.getEmployees();
    const index = employees.findIndex((e) => e.id === employee.id);
    let prev: Employee | undefined;

    if (index >= 0) {
      prev = employees[index];
      employees[index] = { ...employee, updatedAt: new Date().toISOString() };
      AuditService.logAction(
        actorId,
        actorName,
        actorRole,
        'EMPLOYEE_UPDATED',
        'EMPLOYEE',
        employee.id,
        `Updated profile for employee: ${employee.name}`,
        JSON.stringify(prev),
        JSON.stringify(employees[index])
      );
    } else {
      employees.push({
        ...employee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      AuditService.logAction(
        actorId,
        actorName,
        actorRole,
        'EMPLOYEE_CREATED',
        'EMPLOYEE',
        employee.id,
        `Created new employee record: ${employee.name} (${employee.role})`
      );
    }

    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  }

  public static deleteEmployee(id: string, actorId: string, actorName: string, actorRole: any): void {
    const employees = this.getEmployees();
    const target = employees.find((e) => e.id === id);
    if (!target) return;

    const filtered = employees.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(filtered));

    AuditService.logAction(
      actorId,
      actorName,
      actorRole,
      'EMPLOYEE_DELETED',
      'EMPLOYEE',
      id,
      `Decommissioned employee: ${target.name}`
    );
  }

  // --- SETTINGS ---
  public static getSettings(): SystemSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : INITIAL_SYSTEM_SETTINGS;
    } catch {
      return INITIAL_SYSTEM_SETTINGS;
    }
  }

  public static saveSettings(settings: SystemSettings, actorId: string, actorName: string, actorRole: any): void {
    const prev = this.getSettings();
    const updated = {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: `${actorName} (${actorRole})`,
    };

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    AuditService.logAction(
      actorId,
      actorName,
      actorRole,
      'SETTINGS_UPDATED',
      'SETTINGS',
      settings.id,
      `Modified system KPI configuration version: ${settings.activeVersion}`,
      JSON.stringify(prev),
      JSON.stringify(updated)
    );
  }

  // --- EVALUATIONS ---
  public static getEvaluations(): Evaluation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
      const evaluations: Evaluation[] = data ? JSON.parse(data) : INITIAL_EVALUATIONS;
      return evaluations
        .filter((evaluation) => evaluation.departmentId !== MANAGERIAL_DEPARTMENT_ID)
        .map(normalizeEvaluationDepartment)
        .map(normalizeEvaluationRole);
    } catch {
      return INITIAL_EVALUATIONS
        .filter((evaluation) => evaluation.departmentId !== MANAGERIAL_DEPARTMENT_ID)
        .map(normalizeEvaluationDepartment)
        .map(normalizeEvaluationRole);
    }
  }

  public static saveEvaluation(
    evaluation: Evaluation,
    actorId: string,
    actorName: string,
    actorRole: any,
    actorEmail?: string
  ): Evaluation {
    let evaluations = this.getEvaluations();
    const index = evaluations.findIndex((e) => e.id === evaluation.id);
    let prev: Evaluation | undefined;

    const shouldLock = [
      'HR_MANAGEMENT_APPROVED',
      'PUBLISHED',
      'EMPLOYEE_VIEWED',
      'ACKNOWLEDGED',
    ].includes(evaluation.status);

    const recordToSave: Evaluation = {
      ...evaluation,
      locked: evaluation.locked || shouldLock,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      prev = evaluations[index];
      evaluations[index] = recordToSave;
    } else {
      evaluations.push(recordToSave);
    }

    // Recalculate ranks for the department & quarter
    evaluations = CalculationEngine.recalculateDepartmentRanks(
      evaluations,
      recordToSave.departmentId,
      recordToSave.quarter,
      recordToSave.year
    );

    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));

    AuditService.logAction(
      actorId,
      actorName,
      actorRole,
      index >= 0 ? `EVALUATION_${recordToSave.status}` : 'EVALUATION_CREATED',
      'EVALUATION',
      recordToSave.id,
      `Evaluation status is now ${recordToSave.status} for ${recordToSave.employeeName} (${recordToSave.quarter} ${recordToSave.year}). Final score: ${recordToSave.finalScore}`,
      prev ? JSON.stringify({ status: prev.status, score: prev.finalScore }) : undefined,
      JSON.stringify({ status: recordToSave.status, score: recordToSave.finalScore })
    );

    // Push to Supabase asynchronously (single insert with full data)
    const pushToSupabase = async () => {
      try {
        const { error } = await supabase.from('evaluations').insert([
          {
            employee_id: recordToSave.employeeId,
            employee_name: recordToSave.employeeName,
            evaluator_role: recordToSave.evaluatorRole,
            evaluator_email: actorEmail || actorName,
            department: recordToSave.departmentName,
            status: recordToSave.status,
            classification: recordToSave.classification,
            performance_score: recordToSave.finalScore,
            communication_score: recordToSave.commonScore,
            notes: recordToSave.strengths || '',
            details: JSON.stringify(recordToSave),
          }
        ]);
        if (error) {
          console.warn('Could not sync evaluation to Supabase:', error.message);
        } else {
          console.log('✅ Successfully synced evaluation to Supabase');
        }
      } catch (err: any) {
        console.error('Failed to sync to Supabase', err);
      }
    };
    
    pushToSupabase();

    const saved = evaluations.find((e) => e.id === recordToSave.id) || recordToSave;
    return saved;
  }

  public static acknowledgeEvaluation(
    evaluationId: string,
    employeeId: string,
    employeeName: string,
    notes?: string
  ): Evaluation | null {
    const evaluations = this.getEvaluations();
    const target = evaluations.find((e) => e.id === evaluationId);
    if (!target) return null;

    target.status = 'ACKNOWLEDGED';
    target.acknowledgedAt = new Date().toISOString();
    target.acknowledgedBy = employeeName;
    target.acknowledgementNotes = notes || '';
    target.locked = true;

    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));

    AuditService.logAction(
      employeeId,
      employeeName,
      'EMPLOYEE',
      'EVALUATION_ACKNOWLEDGED',
      'ACKNOWLEDGEMENT',
      evaluationId,
      `Employee ${employeeName} acknowledged evaluation for ${target.quarter} ${target.year} (Final score: ${target.finalScore})`
    );

    return target;
  }

  // --- BACKUP & RESTORE ---
  public static exportFullBackup(): string {
    const payload = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      departments: this.getDepartments(),
      employees: this.getEmployees(),
      settings: this.getSettings(),
      evaluations: this.getEvaluations(),
      auditLogs: AuditService.getLogs(),
    };
    return JSON.stringify(payload, null, 2);
  }

  public static restoreBackup(
    jsonString: string,
    actorId: string,
    actorName: string,
    actorRole: any
  ): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.departments || !data.employees || !data.settings || !data.evaluations) {
        return { success: false, message: 'بنية ملف النسخة الاحتياطية غير صالحة. بيانات أساسية مفقودة.' };
      }

      localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(data.departments));
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(data.employees));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(data.evaluations));

      AuditService.logAction(
        actorId,
        actorName,
        actorRole,
        'SYSTEM_BACKUP_RESTORED',
        'SETTINGS',
        'global-settings',
        `Restored system database backup from ${data.timestamp || 'external file'}.`
      );

      return { success: true, message: 'تم استعادة قاعدة البيانات من النسخة الاحتياطية بنجاح.' };
    } catch (err: any) {
      return { success: false, message: `فشل تحليل ملف النسخة الاحتياطية: ${err.message}` };
    }
  }

  // --- CSV / GOOGLE SHEETS EXPORT & IMPORT ---
  public static exportEvaluationsCSV(quarter?: string, year?: number): string {
    let evals = this.getEvaluations();
    if (quarter) evals = evals.filter((e) => e.quarter === quarter);
    if (year) evals = evals.filter((e) => e.year === year);

    const headers = [
      'Evaluation ID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Level',
      'Quarter',
      'Year',
      'Status',
      'Common Score (40%)',
      'Department Score (60%)',
      'Leadership Score (20%)',
      'Final Score (100%)',
      'Classification',
      'Department Rank',
      'Total in Dept',
      'Evaluator',
      'Approved By',
      'Acknowledged At',
      'Version',
    ];

    const rows = evals.map((e) => [
      e.id,
      e.employeeId,
      `"${e.employeeName.replace(/"/g, '""')}"`,
      `"${e.departmentName.replace(/"/g, '""')}"`,
      `"${e.role.replace(/"/g, '""')}"`,
      e.level,
      e.quarter,
      e.year,
      e.status,
      e.commonScore,
      e.departmentScore,
      e.leadershipScore || 0,
      e.finalScore,
      `"${e.classification}"`,
      e.departmentRank,
      e.totalInDepartment,
      `"${e.evaluatorName}"`,
      `"${e.approvedBy || 'Pending'}"`,
      `"${e.acknowledgedAt || 'Pending'}"`,
      e.version,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public static exportEmployeesCSV(): string {
    const employees = this.getEmployees();
    const headers = [
      'Employee ID',
      'Name',
      'Email',
      'Department ID',
      'Department Name',
      'Role',
      'Level',
      'Team Leader Name',
      'Start Date',
      'System Role',
      'Active',
    ];

    const rows = employees.map((e) => [
      e.id,
      `"${e.name.replace(/"/g, '""')}"`,
      e.email,
      e.departmentId,
      `"${e.departmentName.replace(/"/g, '""')}"`,
      `"${e.role.replace(/"/g, '""')}"`,
      e.level,
      `"${e.teamLeaderName || ''}"`,
      e.startDate,
      e.systemRole,
      e.isActive ? 'YES' : 'NO',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public static importEmployeesFromCSV(
    csvContent: string,
    actorId: string,
    actorName: string,
    actorRole: any
  ): { importedCount: number; errors: string[] } {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { importedCount: 0, errors: ['CSV file is empty or missing data rows.'] };
    }

    const currentEmployees = this.getEmployees();
    const departments = this.getDepartments();
    const errors: string[] = [];
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter handling quoted values
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanCols = cols.map((c) => c.replace(/^"|"$/g, '').trim());

      if (cleanCols.length < 5) {
        errors.push(`Row ${i + 1}: Insufficient columns.`);
        continue;
      }

      const [name, email, deptName, role, level, startDate, teamLeaderName] = cleanCols;

      if (!name || !email) {
        errors.push(`Row ${i + 1}: Name and Email are mandatory.`);
        continue;
      }

      const matchedDept = departments.find(
        (d) => d.name.toLowerCase() === deptName.toLowerCase() || d.id === deptName
      ) || departments[0];

      const validLevel = ['Junior', 'Mid', 'Senior', 'Team Leader'].includes(level)
        ? (level as any)
        : 'Mid';

      const existingIndex = currentEmployees.findIndex((e) => e.email.toLowerCase() === email.toLowerCase());

      const employeeRecord: Employee = {
        id: existingIndex >= 0 ? currentEmployees[existingIndex].id : `emp-imp-${Date.now()}-${i}`,
        name,
        email,
        departmentId: matchedDept.id,
        departmentName: matchedDept.name,
        role: role || 'Team Member',
        level: validLevel,
        startDate: startDate || new Date().toISOString().split('T')[0],
        teamLeaderName: teamLeaderName || matchedDept.teamLeaderName,
        systemRole: validLevel === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        currentEmployees[existingIndex] = employeeRecord;
      } else {
        currentEmployees.push(employeeRecord);
      }
      importedCount++;
    }

    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(currentEmployees));

    AuditService.logAction(
      actorId,
      actorName,
      actorRole,
      'EMPLOYEES_IMPORTED_CSV',
      'EMPLOYEE',
      'batch-import',
      `Imported ${importedCount} employee records via CSV/Sheets sync.`
    );

    return { importedCount, errors };
  }
}
