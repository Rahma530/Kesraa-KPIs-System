import { EmployeeLevel, SystemRole } from '../types';
import { supabase } from '../lib/supabase';

export interface ManagedDepartment {
  id: string;
  name: string;
}

export interface ManagedEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  jobTitle: string;
  level: EmployeeLevel;
  systemRole: SystemRole;
  startDate: string;
  employmentActive: boolean | null;
  accountEnabled: boolean;
  authLinked: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRoster {
  employees: ManagedEmployee[];
  departments: ManagedDepartment[];
}

export interface EvaluationRosterEmployee {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  jobTitle: string;
  level: EmployeeLevel;
  systemRole: SystemRole;
  startDate: string;
}

export interface EvaluationRoster {
  employees: EvaluationRosterEmployee[];
  departments: ManagedDepartment[];
}

export interface EmployeeMutationInput {
  id?: string;
  expectedVersion?: number;
  name: string;
  email: string;
  phone?: string;
  departmentId: string;
  jobTitle: string;
  level: EmployeeLevel;
  systemRole: SystemRole;
  startDate: string;
}

export interface EmployeeImportRow extends EmployeeMutationInput {
  rowNumber: number;
}

export interface EmployeeImportResult {
  successful: Array<{ rowNumber: number; employeeId: string }>;
  skipped: Array<{ rowNumber: number; reason: string }>;
  failed: Array<{ rowNumber: number; reason: string }>;
}

export interface EmployeeMutationResult {
  employee: ManagedEmployee;
}

interface EmployeeManagementResponse {
  employee?: ManagedEmployee;
  employees?: Array<ManagedEmployee | EvaluationRosterEmployee>;
  departments?: ManagedDepartment[];
  successful?: EmployeeImportResult['successful'];
  skipped?: EmployeeImportResult['skipped'];
  failed?: EmployeeImportResult['failed'];
  error?: string;
}

const readFunctionError = async (error: { message?: string; context?: Response }): Promise<string> => {
  if (error.context) {
    try {
      const body = await error.context.clone().json() as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // Fall back to the safe SDK error below.
    }
  }
  return error.message || 'The employee-management service could not complete the request.';
};

const invoke = async (body: Record<string, unknown>): Promise<EmployeeManagementResponse> => {
  const { data, error } = await supabase.functions.invoke<EmployeeManagementResponse>(
    'employee-management',
    { body },
  );
  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('The employee-management service returned no result.');
  if (data.error) throw new Error(data.error);
  return data;
};

export const EmployeeManagementService = {
  async list(): Promise<EmployeeRoster> {
    const data = await invoke({ action: 'list' });
    return {
      employees: (data.employees || []) as ManagedEmployee[],
      departments: data.departments || [],
    };
  },

  async listEvaluationRoster(): Promise<EvaluationRoster> {
    const data = await invoke({ action: 'evaluation-roster' });
    return {
      employees: (data.employees || []) as EvaluationRosterEmployee[],
      departments: data.departments || [],
    };
  },

  async save(input: EmployeeMutationInput): Promise<EmployeeMutationResult> {
    const data = await invoke({ action: input.id ? 'update' : 'create', employee: input });
    if (!data.employee) throw new Error('The saved employee was not returned by the database.');
    return { employee: data.employee };
  },

  async setEmploymentActive(
    employeeId: string,
    employmentActive: boolean,
    expectedVersion: number,
  ): Promise<EmployeeMutationResult> {
    const data = await invoke({
      action: 'set-employment-active',
      employeeId,
      employmentActive,
      expectedVersion,
    });
    if (!data.employee) throw new Error('The updated employee was not returned by the database.');
    return { employee: data.employee };
  },

  async setAccountEnabled(
    employeeId: string,
    accountEnabled: boolean,
    expectedVersion: number,
  ): Promise<EmployeeMutationResult> {
    const data = await invoke({
      action: 'set-account-enabled',
      employeeId,
      accountEnabled,
      expectedVersion,
    });
    if (!data.employee) throw new Error('The updated account state was not returned by the database.');
    return { employee: data.employee };
  },

  async import(rows: EmployeeImportRow[]): Promise<EmployeeImportResult> {
    const data = await invoke({ action: 'import', rows });
    return {
      successful: data.successful || [],
      skipped: data.skipped || [],
      failed: data.failed || [],
    };
  },
};

const parseCsvRecords = (csv: string): string[][] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (quoted && character === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      record.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      record.push(field.trim());
      field = '';
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
  record.push(field.trim());
  if (record.some((value) => value !== '')) records.push(record);
  return records;
};

const normalizeHeader = (value: string): string => value.trim().toLowerCase().replace(/[ _-]+/g, '');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS: readonly EmployeeLevel[] = ['Junior', 'Mid', 'Senior', 'Team Leader'];
const ROLES: readonly SystemRole[] = [
  'ADMIN', 'HR', 'CEO', 'TEAM_LEADER', 'HEAD_TECHNICAL', 'EMPLOYEE',
];
const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseEmployeeImportCsv = (
  csv: string,
): { rows: EmployeeImportRow[]; errors: string[] } => {
  const records = parseCsvRecords(csv.trim());
  if (records.length < 2) {
    return { rows: [], errors: ['The CSV must contain a header and at least one employee row.'] };
  }

  const headerIndexes = new Map(records[0].map((header, index) => [normalizeHeader(header), index]));
  const getIndex = (...names: string[]) => names.map(normalizeHeader)
    .map((name) => headerIndexes.get(name))
    .find((index) => index !== undefined);
  const indexes = {
    id: getIndex('employee id', 'id'),
    name: getIndex('name', 'full name'),
    email: getIndex('email', 'email address'),
    phone: getIndex('phone', 'phone number'),
    department: getIndex('department id', 'department'),
    jobTitle: getIndex('job title', 'role'),
    level: getIndex('level'),
    startDate: getIndex('start date'),
    systemRole: getIndex('system role', 'evaluation role'),
  };

  const missing = [
    ['Name', indexes.name],
    ['Email', indexes.email],
    ['Department', indexes.department],
    ['Job Title', indexes.jobTitle],
    ['Level', indexes.level],
    ['Start Date', indexes.startDate],
  ].filter(([, index]) => index === undefined).map(([label]) => label);
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required CSV columns: ${missing.join(', ')}.`] };
  }

  const rows: EmployeeImportRow[] = [];
  const errors: string[] = [];
  const batchEmails = new Set<string>();
  const batchIds = new Set<string>();
  records.slice(1).forEach((record, offset) => {
    const rowNumber = offset + 2;
    const value = (index: number | undefined) => index === undefined ? '' : (record[index] || '').trim();
    const name = value(indexes.name);
    const email = value(indexes.email).toLowerCase();
    const departmentId = value(indexes.department);
    const jobTitle = value(indexes.jobTitle);
    const level = value(indexes.level) as EmployeeLevel;
    const startDate = value(indexes.startDate);
    const systemRoleValue = value(indexes.systemRole).toUpperCase().replaceAll(' ', '_');
    const systemRole = (systemRoleValue || 'EMPLOYEE') as SystemRole;
    const id = value(indexes.id) || undefined;

    const rowErrors: string[] = [];
    if (name.length < 2) rowErrors.push('name is required');
    if (!EMAIL_PATTERN.test(email)) rowErrors.push('email is invalid');
    if (!departmentId) rowErrors.push('department is required');
    if (!jobTitle) rowErrors.push('job title is required');
    if (!LEVELS.includes(level)) rowErrors.push('level is invalid');
    if (!isValidDate(startDate)) rowErrors.push('start date must be a valid YYYY-MM-DD date');
    if (!ROLES.includes(systemRole)) rowErrors.push('system role is invalid');
    if (batchEmails.has(email)) rowErrors.push('email is duplicated in this file');
    if (id && batchIds.has(id)) rowErrors.push('employee ID is duplicated in this file');

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}.`);
      return;
    }
    batchEmails.add(email);
    if (id) batchIds.add(id);
    rows.push({
      rowNumber,
      id,
      name,
      email,
      phone: value(indexes.phone),
      departmentId,
      jobTitle,
      level,
      systemRole,
      startDate,
    });
  });

  return { rows, errors };
};

const escapeCsv = (value: string | number | boolean | null): string => {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const generateEmployeesCsv = (employees: ManagedEmployee[]): string => {
  const headers = [
    'Employee ID', 'Name', 'Email', 'Phone', 'Department ID', 'Department Name',
    'Job Title', 'Level', 'Start Date', 'System Role', 'Employment Active',
    'Account Enabled', 'Auth Linked', 'Version',
  ];
  const rows = employees.map((employee) => [
    employee.id,
    employee.name,
    employee.email,
    employee.phone,
    employee.departmentId,
    employee.departmentName,
    employee.jobTitle,
    employee.level,
    employee.startDate,
    employee.systemRole,
    employee.employmentActive === null ? 'UNKNOWN' : employee.employmentActive,
    employee.accountEnabled,
    employee.authLinked,
    employee.version,
  ].map(escapeCsv).join(','));
  return [headers.map(escapeCsv).join(','), ...rows].join('\n');
};
