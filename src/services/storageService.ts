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

interface SupabaseEvaluationRow {
  id: string | number;
  created_at?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  evaluator_role?: string | null;
  evaluator_email?: string | null;
  department?: string | null;
  status?: EvaluationStatus | null;
  classification?: string | null;
  performance_score?: number | null;
  communication_score?: number | null;
  notes?: string | null;
  details?: string | Partial<Evaluation> | null;
}

const removeLegacyEmployeePasswords = (employees: Employee[]): Employee[] => employees.map((employee) => {
  const { password: _discardedPassword, ...safeEmployee } = employee as Employee & { password?: unknown };
  return safeEmployee as Employee;
});

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
      const parsedEmployees: Employee[] = data ? JSON.parse(data) : INITIAL_EMPLOYEES;
      const containedLegacyPasswords = parsedEmployees.some((employee) => 'password' in employee);
      const employees = removeLegacyEmployeePasswords(parsedEmployees);
      if (data && containedLegacyPasswords) {
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
      }
      return employees.map(normalizeEmployeeDepartment).map(normalizeEmployeeRole);
    } catch {
      return removeLegacyEmployeePasswords(INITIAL_EMPLOYEES)
        .map(normalizeEmployeeDepartment)
        .map(normalizeEmployeeRole);
    }
  }

  public static saveEmployee(employee: Employee, actorId: string, actorName: string, actorRole: any): void {
    const employees = this.getEmployees();
    const safeEmployee = removeLegacyEmployeePasswords([employee])[0];
    const index = employees.findIndex((e) => e.id === safeEmployee.id);
    let prev: Employee | undefined;

    if (index >= 0) {
      prev = employees[index];
      employees[index] = { ...safeEmployee, updatedAt: new Date().toISOString() };
      AuditService.logAction(
        actorId,
        actorName,
        actorRole,
        'EMPLOYEE_UPDATED',
        'EMPLOYEE',
        safeEmployee.id,
        `Updated profile for employee: ${safeEmployee.name}`,
        JSON.stringify(prev),
        JSON.stringify(employees[index])
      );
    } else {
      employees.push({
        ...safeEmployee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      AuditService.logAction(
        actorId,
        actorName,
        actorRole,
        'EMPLOYEE_CREATED',
        'EMPLOYEE',
        safeEmployee.id,
        `Created new employee record: ${safeEmployee.name} (${safeEmployee.role})`
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
  private static mapSupabaseRowToEvaluation(row: SupabaseEvaluationRow): Evaluation | null {
    try {
      let rawDetails: unknown = row.details;
      for (let attempt = 0; attempt < 2 && typeof rawDetails === 'string'; attempt++) {
        rawDetails = JSON.parse(rawDetails);
      }

      const detailsContainer = rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails)
        ? rawDetails as Record<string, unknown>
        : null;
      const candidateDetails = [
        detailsContainer,
        detailsContainer?.evaluation,
        detailsContainer?.data,
        detailsContainer?.payload,
      ].find((candidate) => (
        candidate !== null &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        typeof (candidate as Partial<Evaluation>).id === 'string'
      )) as Partial<Evaluation> | undefined;

      if (!candidateDetails) {
        return this.mapLegacySupabaseRow(row, rawDetails);
      }

      return normalizeEvaluationRole(normalizeEvaluationDepartment({
        ...(candidateDetails as Evaluation),
        databaseId: row.id,
        employeeId: row.employee_id || candidateDetails.employeeId,
        employeeName: row.employee_name || candidateDetails.employeeName,
        evaluatorRole: row.evaluator_role || candidateDetails.evaluatorRole,
        departmentName: row.department || candidateDetails.departmentName,
        status: row.status || candidateDetails.status,
        classification: row.classification || candidateDetails.classification,
        finalScore: row.performance_score ?? candidateDetails.finalScore,
        commonScore: row.communication_score ?? candidateDetails.commonScore,
        strengths: row.notes ?? candidateDetails.strengths,
      } as Evaluation));
    } catch (error) {
      console.warn(`Could not parse details for Supabase evaluation row ${row.id}; using core columns instead.`, error);
      return this.mapLegacySupabaseRow(row, row.details);
    }
  }

  private static mapLegacySupabaseRow(row: SupabaseEvaluationRow, rawDetails: unknown): Evaluation | null {
    if (!row.employee_id && !row.employee_name) {
      console.warn(`Supabase evaluation row ${row.id} has neither an employee identifier nor a name.`);
      return null;
    }

    const employee = this.getEmployees().find((item) => item.id === row.employee_id);
    const createdDate = row.created_at ? new Date(row.created_at) : new Date(0);
    const hasValidCreatedDate = !Number.isNaN(createdDate.getTime());
    const quarterNumber = hasValidCreatedDate ? Math.floor(createdDate.getUTCMonth() / 3) + 1 : 1;
    const quarter = `Q${quarterNumber}` as Evaluation['quarter'];
    const year = hasValidCreatedDate ? createdDate.getUTCFullYear() : 1970;
    const createdAt = hasValidCreatedDate ? createdDate.toISOString() : new Date(0).toISOString();
    const settings = INITIAL_SYSTEM_SETTINGS;
    const departmentId = row.department?.startsWith('dept-')
      ? row.department
      : employee?.departmentId || row.department || 'legacy-department';
    const department = this.getDepartments().find((item) => item.id === departmentId);
    const commonScore = row.communication_score ?? 0;
    const departmentScore = row.performance_score ?? 0;
    const finalScore = Math.min(100, Math.max(0, commonScore + departmentScore));
    const classification = row.classification || settings.classifications.find(
      (item) => finalScore >= item.minScore && finalScore <= item.maxScore
    )?.label || 'Unclassified';
    const status = row.status || 'DRAFT';
    const eligibility = employee
      ? CalculationEngine.checkEligibility(employee.startDate, createdAt, settings.minEmploymentMonths)
      : { isEligible: true, tenureMonths: 0, reason: 'Historical Supabase evaluation' };

    return normalizeEvaluationRole(normalizeEvaluationDepartment({
      id: `legacy-${row.id}`,
      databaseId: row.id,
      legacyDetails: rawDetails,
      employeeId: row.employee_id || employee?.id || `legacy-employee-${row.id}`,
      employeeName: row.employee_name || employee?.name || row.employee_id || 'Historical employee',
      evaluatorId: row.evaluator_email || `legacy-evaluator-${row.id}`,
      evaluatorName: row.evaluator_email || 'Historical evaluator',
      evaluatorRole: row.evaluator_role || 'Evaluator',
      departmentId,
      departmentName: department?.name || employee?.departmentName || row.department || 'Historical department',
      role: employee?.role || 'Historical employee',
      level: employee?.level || 'Junior',
      quarter,
      year,
      cycleId: `cycle-${quarter}-${year}`,
      version: settings.activeVersion,
      status,
      isEligible: eligibility.isEligible,
      eligibilityReason: eligibility.reason,
      tenureMonths: eligibility.tenureMonths,
      commonScore,
      departmentScore,
      leadershipScore: 0,
      finalScore,
      classification,
      departmentRank: 1,
      totalInDepartment: 1,
      strengths: row.notes || '',
      improvements: '',
      developmentActions: '',
      locked: ['HR_MANAGEMENT_APPROVED', 'PUBLISHED', 'EMPLOYEE_VIEWED', 'ACKNOWLEDGED'].includes(status),
      snapshotConfig: {
        version: settings.activeVersion,
        minEmploymentMonths: settings.minEmploymentMonths,
        commonSkillsPercent: settings.commonSkillsPercent,
        departmentKpiPercent: settings.deptKpiPercent,
        tlLeadershipPercent: settings.tlLeadershipPercent,
        headTechManagementPercent: settings.headTechManagementPercent,
        kpis: [],
        classifications: settings.classifications,
      },
      scores: [],
      createdAt,
      updatedAt: createdAt,
    }));
  }

  private static buildSupabasePayload(evaluation: Evaluation, actorEmail?: string) {
    return {
      employee_id: evaluation.employeeId,
      employee_name: evaluation.employeeName,
      evaluator_role: evaluation.evaluatorRole,
      evaluator_email: actorEmail || evaluation.evaluatorName,
      department: evaluation.departmentName,
      status: evaluation.status,
      classification: evaluation.classification,
      performance_score: evaluation.finalScore,
      communication_score: evaluation.commonScore,
      notes: evaluation.strengths || '',
      details: JSON.stringify(evaluation),
    };
  }

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

  public static async getEvaluationsFromSupabase(): Promise<Evaluation[]> {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*');

    if (error) {
      throw new Error(`Could not load evaluations from Supabase: ${error.message}`);
    }

    const evaluationsById = new Map<string, Evaluation>();
    for (const row of (data || []) as SupabaseEvaluationRow[]) {
      const evaluation = this.mapSupabaseRowToEvaluation(row);
      if (!evaluation) continue;

      const existing = evaluationsById.get(evaluation.id);
      const existingTime = existing
        ? new Date(existing.updatedAt || existing.createdAt).getTime()
        : Number.NEGATIVE_INFINITY;
      const candidateTime = new Date(evaluation.updatedAt || evaluation.createdAt).getTime();

      if (!existing || candidateTime >= existingTime) {
        evaluationsById.set(evaluation.id, evaluation);
      }
    }

    const evaluations = Array.from(evaluationsById.values())
      .filter((evaluation) => evaluation.departmentId !== MANAGERIAL_DEPARTMENT_ID)
      .map(normalizeEvaluationDepartment)
      .map(normalizeEvaluationRole);

    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
    return evaluations;
  }

  public static async saveEvaluation(
    evaluation: Evaluation,
    actorId: string,
    actorName: string,
    actorRole: any,
    actorEmail?: string
  ): Promise<Evaluation> {
    let evaluations = await this.getEvaluationsFromSupabase();
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
      databaseId: evaluation.databaseId ?? (index >= 0 ? evaluations[index].databaseId : undefined),
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

    const rankedRecord = evaluations.find((item) => item.id === recordToSave.id) || recordToSave;
    const payload = this.buildSupabasePayload(rankedRecord, actorEmail);
    let persistedRow: SupabaseEvaluationRow;

    if (rankedRecord.databaseId !== undefined) {
      const { data, error } = await supabase
        .from('evaluations')
        .update(payload)
        .eq('id', rankedRecord.databaseId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Could not update evaluation in Supabase: ${error.message}`);
      }
      persistedRow = data as SupabaseEvaluationRow;
    } else {
      const { data, error } = await supabase
        .from('evaluations')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Could not create evaluation in Supabase: ${error.message}`);
      }
      persistedRow = data as SupabaseEvaluationRow;
    }

    const saved = this.mapSupabaseRowToEvaluation(persistedRow);
    if (!saved) {
      throw new Error('Supabase saved the evaluation but returned an invalid evaluation record.');
    }

    const savedIndex = evaluations.findIndex((item) => item.id === saved.id);
    if (savedIndex >= 0) {
      evaluations[savedIndex] = saved;
    } else {
      evaluations.push(saved);
    }
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

    return saved;
  }

  public static async acknowledgeEvaluation(
    evaluationId: string,
    employeeId: string,
    employeeName: string,
    employeeRole: any,
    employeeEmail: string,
    notes?: string
  ): Promise<Evaluation | null> {
    const evaluations = await this.getEvaluationsFromSupabase();
    const target = evaluations.find((e) => e.id === evaluationId);
    if (!target) return null;

    const acknowledged = await this.saveEvaluation(
      {
        ...target,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: employeeName,
        acknowledgementNotes: notes || '',
        locked: true,
      },
      employeeId,
      employeeName,
      employeeRole,
      employeeEmail
    );

    AuditService.logAction(
      employeeId,
      employeeName,
      'EMPLOYEE',
      'EVALUATION_ACKNOWLEDGED',
      'ACKNOWLEDGEMENT',
      evaluationId,
      `Employee ${employeeName} acknowledged evaluation for ${acknowledged.quarter} ${acknowledged.year} (Final score: ${acknowledged.finalScore})`
    );

    return acknowledged;
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
      localStorage.setItem(
        STORAGE_KEYS.EMPLOYEES,
        JSON.stringify(removeLegacyEmployeePasswords(data.employees))
      );
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
