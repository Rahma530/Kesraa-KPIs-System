import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  Link2,
  Copy,
  Loader2,
  X
} from 'lucide-react';
import { Employee, EmployeeLevel, SystemRole } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CalculationEngine } from '../services/calculationEngine';
import { ARABIC_ROLES, ARABIC_LEVELS } from '../locales/ar';
import { supabase } from '../lib/supabase';
import { hasAdditionalPermission } from '../auth/authorization';
import {
  getRoleOptions,
  getStandardRole,
  isEvaluableEmployee,
} from '../utils/departmentNames';

interface EmployeesManagementViewProps {
  onOpenGoogleSheets: () => void;
}

interface EmployeeInvitationResult {
  employeeId: string;
  authUserId: string;
  alreadyLinked: boolean;
  invitationLink: string | null;
  delivery: 'manual';
}

interface AccountFeedback {
  type: 'success' | 'error';
  message: string;
}

export const EmployeesManagementView: React.FC<EmployeesManagementViewProps> = ({
  onOpenGoogleSheets,
}) => {
  const { employees, departments, saveEmployee, deleteEmployee, settings } = useData();
  const { canManageEmployees, currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invitationEmployee, setInvitationEmployee] = useState<Employee | null>(null);
  const [invitationResult, setInvitationResult] = useState<EmployeeInvitationResult | null>(null);
  const [invitationError, setInvitationError] = useState('');
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [accountEnabledByEmployeeId, setAccountEnabledByEmployeeId] = useState<Record<string, boolean>>({});
  const [updatingAccountEmployeeId, setUpdatingAccountEmployeeId] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<AccountFeedback | null>(null);

  const canAdministerAccounts = hasAdditionalPermission(currentUser, 'ADMIN');

  useEffect(() => {
    if (!canAdministerAccounts) {
      setAccountEnabledByEmployeeId({});
      return;
    }

    let isActive = true;
    const loadAccountStatuses = async () => {
      const employeeIds = employees.map((employee) => employee.id);
      if (employeeIds.length === 0) {
        if (isActive) setAccountEnabledByEmployeeId({});
        return;
      }

      const { data, error } = await supabase
        .from('employees')
        .select('id,account_enabled')
        .in('id', employeeIds);

      if (!isActive) return;
      if (error) {
        setAccountFeedback({
          type: 'error',
          message: `Could not load employee account statuses: ${error.message}`,
        });
        return;
      }

      setAccountEnabledByEmployeeId(
        Object.fromEntries(
          (data || []).map((employee) => [employee.id, employee.account_enabled === true])
        )
      );
    };

    void loadAccountStatuses();
    return () => {
      isActive = false;
    };
  }, [canAdministerAccounts, employees]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDeptId, setFormDeptId] = useState(departments[0]?.id || 'dept-am');
  const [formRole, setFormRole] = useState('');
  const [formLevel, setFormLevel] = useState<EmployeeLevel>('Mid');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSystemRole, setFormSystemRole] = useState<SystemRole>('EMPLOYEE');
  const [formTeamLeadName, setFormTeamLeadName] = useState('');

  const openCreateModal = () => {
    setEditingEmp(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    const defaultDeptId = currentUser?.systemRole === 'TEAM_LEADER' ? currentUser.departmentId : (departments[0]?.id || 'dept-am');
    setFormDeptId(defaultDeptId);
    setFormRole(getStandardRole(defaultDeptId, '', 'Mid', 'EMPLOYEE'));
    setFormLevel('Mid');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormSystemRole('EMPLOYEE');
    const defaultDept = departments.find(d => d.id === defaultDeptId);
    setFormTeamLeadName(defaultDept?.teamLeaderName || '');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormPhone(emp.phone || '');
    setFormDeptId(emp.departmentId);
    setFormRole(emp.role);
    setFormLevel(emp.level);
    setFormStartDate(emp.startDate);
    setFormSystemRole(emp.systemRole);
    setFormTeamLeadName(emp.teamLeaderName || '');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    const dept = departments.find((d) => d.id === formDeptId) || departments[0];

    const isAiDepartment = dept.id === 'dept-ai';
    const isTeamLeader = !isAiDepartment && (formSystemRole === 'TEAM_LEADER' || formLevel === 'Team Leader');
    const normalizedSystemRole = isAiDepartment && formSystemRole !== 'AI_ENGINEER'
      ? 'EMPLOYEE'
      : formSystemRole;
    const normalizedLevel = isAiDepartment && formLevel === 'Team Leader' ? 'Senior' : formLevel;
    const payload: Employee = {
      id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
      name: formName,
      email: formEmail,
      phone: formPhone,
      departmentId: dept.id,
      departmentName: dept.name,
      role: getStandardRole(dept.id, formRole || 'Team Member', normalizedLevel, normalizedSystemRole),
      level: isTeamLeader ? 'Team Leader' : normalizedLevel,
      startDate: formStartDate,
      teamLeaderName: formTeamLeadName || dept.teamLeaderName,
      systemRole: isTeamLeader ? 'TEAM_LEADER' : normalizedSystemRole,
      isActive: true,
      createdAt: editingEmp?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveEmployee(payload);
    setIsModalOpen(false);
  };

  const closeInvitationResult = () => {
    if (isGeneratingInvitation) return;
    setInvitationEmployee(null);
    setInvitationResult(null);
    setInvitationError('');
    setInvitationCopied(false);
  };

  const generateInvitationLink = async (employee: Employee) => {
    if (
      !canAdministerAccounts ||
      accountEnabledByEmployeeId[employee.id] !== true ||
      isGeneratingInvitation
    ) return;

    setInvitationEmployee(employee);
    setInvitationResult(null);
    setInvitationError('');
    setInvitationCopied(false);
    setIsGeneratingInvitation(true);

    try {
      const { data, error } = await supabase.functions.invoke<EmployeeInvitationResult>('invite-employee', {
        body: { employeeId: employee.id },
      });

      if (error) {
        let message = error.message || 'Could not generate the employee setup link.';
        const errorResponse = (error as { context?: Response }).context;
        if (errorResponse) {
          try {
            const errorBody = await errorResponse.clone().json() as { error?: unknown };
            if (typeof errorBody.error === 'string') message = errorBody.error;
          } catch {
            // Keep the safe client error when the function response is not JSON.
          }
        }
        throw new Error(message);
      }

      if (!data) {
        throw new Error('The invitation service returned no result.');
      }
      if (!data.alreadyLinked && !data.invitationLink) {
        throw new Error('The invitation service did not return a setup link.');
      }

      setInvitationResult(data);
    } catch (error) {
      setInvitationError(
        error instanceof Error ? error.message : 'Could not generate the employee setup link.'
      );
    } finally {
      setIsGeneratingInvitation(false);
    }
  };

  const copyInvitationLink = async () => {
    if (!invitationResult?.invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationResult.invitationLink);
      setInvitationCopied(true);
      setInvitationError('');
    } catch {
      setInvitationCopied(false);
      setInvitationError('Could not copy automatically. Select and copy the link manually.');
    }
  };

  const updateEmployeeAccountStatus = async (employee: Employee, accountEnabled: boolean) => {
    if (!canAdministerAccounts || updatingAccountEmployeeId) return;
    if (
      !accountEnabled &&
      !window.confirm(
        `Disable the account for ${employee.name}? Their Auth user will remain linked, but they will not be able to use the system.`
      )
    ) return;

    setUpdatingAccountEmployeeId(employee.id);
    setAccountFeedback(null);
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({ account_enabled: accountEnabled })
        .eq('id', employee.id)
        .select('id,account_enabled')
        .single();

      if (error) throw error;

      setAccountEnabledByEmployeeId((current) => ({
        ...current,
        [data.id]: data.account_enabled === true,
      }));
      setAccountFeedback({
        type: 'success',
        message: `${employee.name}'s account was ${accountEnabled ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error) {
      setAccountFeedback({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : `Could not ${accountEnabled ? 'enable' : 'disable'} the employee account.`,
      });
    } finally {
      setUpdatingAccountEmployeeId(null);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!isEvaluableEmployee(emp)) return false;
    if (currentUser?.systemRole === 'TEAM_LEADER' && emp.departmentId !== currentUser.departmentId) return false;

    if (deptFilter !== 'ALL' && emp.departmentId !== deptFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchEmail = emp.email.toLowerCase().includes(q);
      const matchPhone = emp.phone?.toLowerCase().includes(q);
      const matchRole = emp.role.toLowerCase().includes(q);
      const matchDept = emp.departmentName.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchRole && !matchDept) return false;
    }
    return true;
  });

  const roleOptions = formSystemRole === 'HEAD_TECHNICAL'
    ? ['Head Of Technical']
    : getRoleOptions(formDeptId);

  return (
    <div className="view-shell">
      
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-white tracking-tight mt-1">
            Employees
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-import-export-sheets"
            onClick={onOpenGoogleSheets}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all "
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            CSV Import / Export
          </button>

          {canManageEmployees() && (
            <button
              id="btn-add-employee"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 transition-all "
            >
              <UserPlus className="h-4 w-4" />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {accountFeedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
            accountFeedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
          role="status"
        >
          {accountFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {accountFeedback.message}
        </div>
      )}

      {/* Filter and Search Bar (Frosted Capsule) */}
      <div
        className="flex flex-col gap-3 rounded-2xl border border-white/10 p-4 md:flex-row md:items-center md:justify-between"
        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="input-search-employees"
            type="text"
            placeholder="Search by name, role, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-xs text-white placeholder-slate-400 focus:border-teal-500/60 focus:outline-none "
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser?.systemRole !== 'TEAM_LEADER' && (
            <select
              id="select-dept-filter-employees"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Employees Table in Frosted Container */}
      <div
        className="rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs data-table">
            <thead className="border-b border-white/5 bg-white/2 text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Phone</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Department</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Level</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">System Role</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Start Date / Tenure</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Eligibility</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-400">No employees match your search.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const eligibility = CalculationEngine.checkEligibility(
                    emp.startDate,
                    new Date().toISOString(),
                    settings.minEmploymentMonths
                  );

                  const isSenior = emp.level === 'Senior';
                  const isTL = emp.level === 'Team Leader';
                  const isMid = emp.level === 'Mid';
                  const accountEnabled = accountEnabledByEmployeeId[emp.id];
                  const isUpdatingAccount = updatingAccountEmployeeId === emp.id;

                  return (
                    <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </td>

                      <td className="px-5 py-4 font-mono">
                        {emp.phone ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 border border-white/10">
                            {emp.phone}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-300">{emp.departmentName}</div>
                        <div className="text-[10px] text-slate-500">{emp.role}</div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] border ${
                            isSenior
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : isTL
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isMid
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}
                        >
                          {ARABIC_LEVELS[emp.level] || emp.level}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                          {ARABIC_ROLES[emp.systemRole]?.label || emp.systemRole}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-300">
                        <div>{emp.startDate}</div>
                        <div className="text-[10px] text-slate-500">{eligibility.tenureMonths} months</div>
                      </td>

                      <td className="px-5 py-4">
                        {eligibility.isEligible ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                            <AlertCircle className="h-3 w-3" /> Not Eligible
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {canManageEmployees() && (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canAdministerAccounts && typeof accountEnabled === 'boolean' && (
                              <button
                                type="button"
                                onClick={() => updateEmployeeAccountStatus(emp, !accountEnabled)}
                                disabled={updatingAccountEmployeeId !== null}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${
                                  accountEnabled
                                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                                    : 'border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20'
                                }`}
                              >
                                {isUpdatingAccount && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {isUpdatingAccount
                                  ? accountEnabled ? 'Disabling...' : 'Enabling...'
                                  : accountEnabled ? 'Disable Account' : 'Enable Account'}
                              </button>
                            )}
                            {canAdministerAccounts && accountEnabled === true && (
                              <button
                                id={`btn-invite-emp-${emp.id}`}
                                onClick={() => generateInvitationLink(emp)}
                                disabled={isGeneratingInvitation}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-50"
                                title="Generate setup link"
                              >
                                {isGeneratingInvitation && invitationEmployee?.id === emp.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}
                                {isGeneratingInvitation && invitationEmployee?.id === emp.id
                                  ? 'Generating...'
                                  : 'Generate Setup Link'}
                              </button>
                            )}
                            <button
                              id={`btn-edit-emp-${emp.id}`}
                              onClick={() => openEditModal(emp)}
                              className="text-slate-400 hover:text-teal-300 transition-colors p-1"
                              title="Edit employee"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              id={`btn-del-emp-${emp.id}`}
                              onClick={() => {
                                if (confirm(`Remove ${emp.name} from the active employee list?`)) {
                                  deleteEmployee(emp.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                              title="Delete employee"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invitationEmployee && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(10, 13, 17, 0.88)' }}>
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Employee setup link</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {invitationEmployee.name} · {invitationEmployee.email}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInvitationResult}
                disabled={isGeneratingInvitation}
                className="rounded-xl p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Close setup link dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5">
              {isGeneratingInvitation && (
                <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 p-4 text-xs text-teal-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Securely generating the one-time setup link...
                </div>
              )}

              {invitationError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                  {invitationError}
                </div>
              )}

              {invitationResult?.alreadyLinked && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                  This employee is already linked to an Auth account. No new invitation or setup link was created.
                </div>
              )}

              {invitationResult?.invitationLink && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
                    Copy this one-time link and send it manually to the employee by WhatsApp, email, or another secure channel. No email was sent automatically.
                  </div>
                  <div className="flex items-stretch gap-2">
                    <input
                      type="text"
                      readOnly
                      value={invitationResult.invitationLink}
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label="Employee setup link"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyInvitationLink}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {invitationCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={closeInvitationResult}
                disabled={isGeneratingInvitation}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10, 13, 17, 0.85)' }}>
          <div
            className="relative w-full max-w-lg rounded-3xl border border-white/10 p-6 shadow-2xl space-y-4"
            style={{ background: 'rgba(10, 13, 17, 0.95)' }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingEmp ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Example: Alex Morgan"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@kesraa.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Example: 01012345678"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Department</label>
                  <select
                    value={formDeptId}
                    onChange={(e) => {
                      const departmentId = e.target.value;
                      const nextRoles = getRoleOptions(departmentId);
                      setFormDeptId(departmentId);
                      setFormRole(getStandardRole(departmentId, nextRoles[0] || '', 'Mid', 'EMPLOYEE'));
                      if (departmentId === 'dept-ai') {
                        setFormLevel('Mid');
                        setFormSystemRole('EMPLOYEE');
                      }
                    }}
                    disabled={currentUser?.systemRole === 'TEAM_LEADER'}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Job Title</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Employee Level</label>
                  <select
                    value={formLevel}
                    onChange={(e) => {
                      const nextLevel = e.target.value as EmployeeLevel;
                      setFormLevel(nextLevel);
                      setFormRole(getStandardRole(formDeptId, formRole, nextLevel, nextLevel === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'));
                      if (nextLevel === 'Team Leader') setFormSystemRole('TEAM_LEADER');
                      if (nextLevel !== 'Team Leader' && formSystemRole === 'TEAM_LEADER') {
                        setFormSystemRole('EMPLOYEE');
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    {formDeptId !== 'dept-ai' && <option value="Team Leader">Team Leader</option>}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Evaluation Role</label>
                  <select
                    value={formSystemRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as SystemRole;
                      setFormSystemRole(nextRole);
                      if (nextRole === 'HEAD_TECHNICAL') setFormRole('Head Of Technical');
                      if (nextRole === 'AI_ENGINEER') setFormRole('AI Engineer');
                      if (nextRole === 'TEAM_LEADER') setFormLevel('Team Leader');
                      if (nextRole === 'EMPLOYEE' && formLevel === 'Team Leader') setFormLevel('Mid');
                    }}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="EMPLOYEE">Employee / Agent</option>
                    {formDeptId === 'dept-ai' && <option value="AI_ENGINEER">AI Engineer</option>}
                    {formDeptId !== 'dept-ai' && <option value="TEAM_LEADER">Team Leader</option>}
                    <option value="HEAD_TECHNICAL">Head Of Technical</option>
                    <option value="HR">HR</option>
                    <option value="CEO">CEO</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500"
                >
                  {editingEmp ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
