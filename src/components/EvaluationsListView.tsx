import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Award,
  Clock,
  Eye,
  FileEdit,
  Sparkles,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
} from 'lucide-react';
import { Evaluation, EvaluationStatus } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { ARABIC_STATUSES, ARABIC_LEVELS, ARABIC_CLASSIFICATIONS } from '../locales/ar';

interface EvaluationsListViewProps {
  onSelectEvaluation: (evaluation: Evaluation) => void;
  onNewEvaluation: (employeeId: string, quarter: Evaluation['quarter'], year: number) => void;
  onAnalyzeWithAI: (evaluation: Evaluation) => void;
}

export const EvaluationsListView: React.FC<EvaluationsListViewProps> = ({
  onSelectEvaluation,
  onNewEvaluation,
  onAnalyzeWithAI,
}) => {
  const {
    departments,
    employees,
    evaluations,
    selectedQuarter,
    selectedYear,
    setSelectedQuarter,
    setSelectedYear,
  } = useData();
  const { currentUser, canEvaluateEmployee, isExecutiveOrAdmin, isTechnicalReviewer } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isNewEvaluationOpen, setIsNewEvaluationOpen] = useState(false);
  const [newEvaluationEmployeeId, setNewEvaluationEmployeeId] = useState('');
  const [newEvaluationQuarter, setNewEvaluationQuarter] = useState(selectedQuarter);
  const [newEvaluationYear, setNewEvaluationYear] = useState(selectedYear);
  const PAGE_SIZE = 10;

  // Filter evaluations (memoized for performance)
  const filteredEvaluations = useMemo(() => evaluations.filter((evaluation) => {
    if (evaluation.quarter !== selectedQuarter || evaluation.year !== selectedYear) return false;
    if (currentUser?.systemRole === 'EMPLOYEE') return false;
    if (currentUser?.systemRole === 'TEAM_LEADER') {
      if (evaluation.departmentId !== currentUser.departmentId && !isExecutiveOrAdmin()) return false;
    }
    if (departmentFilter !== 'ALL' && evaluation.departmentId !== departmentFilter) return false;
    if (statusFilter !== 'ALL' && evaluation.status !== statusFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      if (!evaluation.employeeName.toLowerCase().includes(q) &&
          !evaluation.role.toLowerCase().includes(q) &&
          !evaluation.departmentName.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [evaluations, selectedQuarter, selectedYear, currentUser, departmentFilter, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEvaluations.length / PAGE_SIZE));
  const paginatedEvaluations = filteredEvaluations.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const resetPage = () => setCurrentPage(1);

  const unevaluatedEmployees = employees.filter((emp) => {
    if (!emp.isActive) return false;
    if (currentUser?.systemRole === 'TEAM_LEADER' && emp.departmentId !== currentUser.departmentId) {
      return false;
    }
    const hasEval = evaluations.some(
      (e) => e.employeeId === emp.id && e.quarter === selectedQuarter && e.year === selectedYear
    );
    return !hasEval && canEvaluateEmployee(emp);
  });

  const selectableEmployees = employees.filter(
    (employee) => employee.isActive && canEvaluateEmployee(employee)
  );

  const openNewEvaluation = (employeeId = '') => {
    setNewEvaluationEmployeeId(employeeId);
    setNewEvaluationQuarter(selectedQuarter);
    setNewEvaluationYear(selectedYear);
    setIsNewEvaluationOpen(true);
  };

  const confirmNewEvaluation = () => {
    if (!newEvaluationEmployeeId || !newEvaluationQuarter) return;
    setSelectedQuarter(newEvaluationQuarter);
    setSelectedYear(newEvaluationYear);
    const selectedId = newEvaluationEmployeeId;
    setIsNewEvaluationOpen(false);
    setNewEvaluationEmployeeId('');
    onNewEvaluation(selectedId, newEvaluationQuarter, newEvaluationYear);
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'UNDER_REVIEW':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="view-shell">
      
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-white tracking-tight mt-1">
            {currentUser?.systemRole === 'TEAM_LEADER' ? 'My Team Evaluation History' : 'Evaluation History'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Period: <span className="font-semibold text-teal-400">{selectedQuarter || 'Select quarter'} {selectedYear}</span>
          </p>
        </div>

        {currentUser?.systemRole !== 'EMPLOYEE' && (
          <button
            id="btn-create-new-eval"
            onClick={() => openNewEvaluation()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-500 transition-all "
          >
            <Plus className="h-4 w-4" />
            New Evaluation
          </button>
        )}
      </div>

      {/* Pending Unevaluated Notice in Frosted Amber Box */}
      {unevaluatedEmployees.length > 0 && currentUser?.systemRole !== 'EMPLOYEE' && (
        <div
          className="rounded-2xl border border-amber-500/30 p-4 relative overflow-hidden"
          style={{ background: 'rgba(245, 158, 11, 0.08)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-200">
                  {unevaluatedEmployees.length} eligible employees are awaiting evaluation
                </h4>
                <p className="text-[11px] text-amber-300/80">
                  Select an employee and evaluation period to begin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {unevaluatedEmployees.slice(0, 3).map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => openNewEvaluation(emp.id)}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition-all"
                >
                  + Evaluate {emp.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
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
            id="input-search-evaluations"
            type="text"
            placeholder="Search by employee, role, or department..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPage(); }}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-xs text-white placeholder-slate-400 focus:border-teal-500/60 focus:outline-none "
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isExecutiveOrAdmin() && (
            <select
              id="select-dept-filter"
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); resetPage(); }}
              className="rounded-xl border border-white/10 bg-neutral-950/90 px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          )}

          <select
            id="select-status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
            className="rounded-xl border border-white/10 bg-neutral-950/90 px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none  cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="UNDER_REVIEW">Head Of Technical Review</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>
      </div>

      {/* Evaluations Table in Frosted Container */}
      <div
        className="rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs data-table">
            <thead className="border-b border-white/5 bg-white/2 text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Employee</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Department</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Level</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Status</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Final Score</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Classification</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest">Department Rank</th>
                <th className="px-5 py-3.5 font-medium uppercase text-[10px] tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {filteredEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <Award className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-400">
                      No evaluations match the selected filters.
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Try a different search term or department.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEvaluations.map((evalItem) => {
                  const isLocked = evalItem.locked || evalItem.status === 'APPROVED';
                  const canEdit = !isLocked && (
                    isTechnicalReviewer() ||
                    (currentUser?.systemRole === 'TEAM_LEADER' && evalItem.status === 'DRAFT')
                  );
                  const isSenior = evalItem.level === 'Senior';
                  const isTL = evalItem.level === 'Team Leader';
                  const isMid = evalItem.level === 'Mid';

                  return (
                    <tr
                      key={evalItem.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">
                          {evalItem.employeeName}
                        </div>
                        <div className="text-[11px] text-slate-400">{evalItem.role}</div>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-300">
                        {evalItem.departmentName}
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
                          {ARABIC_LEVELS[evalItem.level] || evalItem.level}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                            evalItem.status
                          )}`}
                        >
                          {isLocked && <Lock className="h-2.5 w-2.5 mr-1" />}
                          {ARABIC_STATUSES[evalItem.status]?.label || evalItem.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-mono font-bold text-sm text-white">
                        {evalItem.finalScore > 0 ? (
                          <span>
                            {evalItem.finalScore}{' '}
                            <span className="text-[10px] text-slate-400">/ 100</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/30">
                          {ARABIC_CLASSIFICATIONS[evalItem.classification]?.label || evalItem.classification}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-300 font-mono">
                        {evalItem.departmentRank
                          ? `#${evalItem.departmentRank} of ${evalItem.totalInDepartment || '—'}`
                          : '—'}
                      </td>

                      <td className="px-5 py-4 text-right space-x-1.5">
                        <button
                          id={`btn-open-eval-${evalItem.id}`}
                          onClick={() => onSelectEvaluation(evalItem)}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-teal-300 hover:bg-white/10 hover:text-white transition-all"
                        >
                          {canEdit ? <FileEdit className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {canEdit ? 'Edit Evaluation' : 'View Evaluation'}
                        </button>

                        <button
                          id={`btn-ai-eval-${evalItem.id}`}
                          onClick={() => onAnalyzeWithAI(evalItem)}
                          title="Generate AI analysis and action plan"
                          className="inline-flex items-center rounded-xl border border-teal-500/30 bg-teal-500/15 p-1 text-teal-300 hover:bg-teal-500/25 transition-all"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 px-5 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredEvaluations.length)}</span> of <span className="text-white font-semibold">{filteredEvaluations.length}</span> evaluations
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc: (number | string)[], p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`e-${idx}`} className="px-1 text-slate-500 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        currentPage === p ? 'bg-teal-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {isNewEvaluationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10, 13, 17, 0.88)' }}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">New Evaluation</h3>
                <p className="mt-1 text-xs text-slate-400">Select the employee and confirm the evaluation period.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewEvaluationOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">Employee</label>
                <select
                  id="select-new-evaluation-employee"
                  value={newEvaluationEmployeeId}
                  onChange={(event) => setNewEvaluationEmployeeId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                >
                  <option value="">Select an employee...</option>
                  {selectableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} - {employee.departmentName} - {employee.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">Quarter</label>
                  <select
                    value={newEvaluationQuarter}
                    onChange={(event) => setNewEvaluationQuarter(event.target.value as typeof selectedQuarter)}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">Select quarter...</option>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => (
                      <option key={quarter} value={quarter}>{quarter}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">Year</label>
                  <select
                    value={newEvaluationYear}
                    onChange={(event) => setNewEvaluationYear(Number(event.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  >
                    {[2026, 2027, 2028].map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
              </div>

              {newEvaluationEmployeeId && (
                <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 p-3 text-xs text-teal-200">
                  <CalendarDays className="h-4 w-4" />
                  The evaluation form will use the selected employee's department, role, level, and applicable KPIs.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setIsNewEvaluationOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmNewEvaluation}
                disabled={!newEvaluationEmployeeId || !newEvaluationQuarter}
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Evaluation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
