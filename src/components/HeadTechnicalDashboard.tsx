import React, { useState } from 'react';
import {
  Users,
  Award,
  Clock,
  ChevronDown,
  ChevronRight,
  Building2,
  Crown,
  Star,
  Search,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ARABIC_LEVELS, ARABIC_STATUSES } from '../locales/ar';
import { Employee, EmployeeLevel } from '../types';
import { getRoleOptions, getStandardRole } from '../utils/departmentNames';

interface HeadTechnicalDashboardProps {
  onStartEvaluation: (employeeId: string) => void;
  onViewEvaluation: (evaluation: any) => void;
}

export const HeadTechnicalDashboard: React.FC<HeadTechnicalDashboardProps> = ({
  onStartEvaluation,
  onViewEvaluation,
}) => {
  const { currentUser, canEvaluateEmployee, isTechnicalReviewer } = useAuth();
  const { employees, evaluations, departments, selectedQuarter, selectedYear, saveEmployee } = useData();

  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '',
    email: '',
    role: '',
    level: 'Junior' as EmployeeLevel,
    departmentId: '',
  });

  if (!currentUser || !isTechnicalReviewer()) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        This page is available to technical reviewers only.
      </div>
    );
  }

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name || !newEmp.email || !newEmp.role || !newEmp.departmentId) return;

    const dept = departments.find(d => d.id === newEmp.departmentId);
    const isAiDepartment = newEmp.departmentId === 'dept-ai';
    const normalizedLevel = isAiDepartment && newEmp.level === 'Team Leader' ? 'Senior' : newEmp.level;
    const employeeToSave: Employee = {
      id: 'emp-' + Date.now().toString(),
      name: newEmp.name,
      email: newEmp.email,
      departmentId: newEmp.departmentId,
      departmentName: dept?.name || '',
      role: getStandardRole(newEmp.departmentId, newEmp.role, normalizedLevel, normalizedLevel === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'),
      level: normalizedLevel,
      teamLeaderId: dept?.teamLeaderId,
      teamLeaderName: dept?.teamLeaderName,
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
      systemRole: normalizedLevel === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveEmployee(employeeToSave);
    setShowAddModal(false);
    setNewEmp({ name: '', email: '', role: '', level: 'Junior', departmentId: '' });
  };

  // Only employees who participate in the evaluation process are shown here.
  const activeEmps = employees.filter(
    (e) => e.isActive && e.id !== currentUser.id && canEvaluateEmployee(e)
  );

  // Filter by search
  const filteredEmps = activeEmps.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get departments that have employees
  const deptsWithEmps = departments.filter((d) =>
    filteredEmps.some((e) => e.departmentId === d.id)
  );

  // Stats
  const totalEmps = activeEmps.length;
  const evaluatedEmps = activeEmps.filter((emp) =>
    evaluations.some(
      (e) => e.employeeId === emp.id && e.quarter === selectedQuarter && e.year === selectedYear
    )
  ).length;
  const pendingEmps = totalEmps - evaluatedEmps;

  const getEval = (empId: string) =>
    evaluations.find(
      (e) => e.employeeId === empId && e.quarter === selectedQuarter && e.year === selectedYear
    );

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-teal-400';
    if (score >= 55) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="view-shell animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-white tracking-tight mt-1 flex items-center gap-2">
            <Crown className="h-6 w-6 text-purple-400" />
            Technical Team Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedQuarter} {selectedYear}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Total Employees</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">{totalEmps}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across {deptsWithEmps.length} departments</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Pending Evaluation</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">{pendingEmps}</div>
          <p className="text-[11px] text-slate-400 mt-1">Not evaluated yet</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Evaluated</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">{evaluatedEmps}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {totalEmps > 0 ? Math.round((evaluatedEmps / totalEmps) * 100) : 0}% complete
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by employee or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pr-10 pl-4 text-xs text-white placeholder-slate-400 focus:border-purple-500/50 focus:outline-none"
        />
      </div>

      {/* Departments */}
      <div className="space-y-4">
        {deptsWithEmps.map((dept) => {
          const deptEmps = filteredEmps.filter((e) => e.departmentId === dept.id);
          const teamLeaders = deptEmps.filter((e) => e.systemRole === 'TEAM_LEADER' || e.level === 'Team Leader');
          const regularEmps = deptEmps.filter((e) => e.systemRole !== 'TEAM_LEADER' && e.level !== 'Team Leader');
          const deptEvaluated = deptEmps.filter((e) => getEval(e.id)).length;
          const isExpanded = expandedDepts[dept.id] !== false; // default expanded

          return (
            <div
              key={dept.id}
              className="rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {/* Department Header */}
              <button
                onClick={() => toggleDept(dept.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white text-sm">{dept.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {deptEmps.length} employees •{' '}
                      <span className="text-emerald-400">{deptEvaluated} evaluated</span>
                      {deptEmps.length - deptEvaluated > 0 && (
                        <span className="text-amber-400"> • {deptEmps.length - deptEvaluated} remaining</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Completion</div>
                    <div className="text-sm font-bold text-white">
                      {deptEmps.length > 0 ? Math.round((deptEvaluated / deptEmps.length) * 100) : 0}%
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5">

                  {/* Team Leaders Section */}
                  {teamLeaders.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-purple-500/10 border-b border-white/5 flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                          Team Leaders
                        </span>
                      </div>
                      {teamLeaders.map((emp) => {
                        const ev = getEval(emp.id);
                        return (
                          <div
                            key={emp.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs uppercase shrink-0">
                                {emp.name.substring(0, 2)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-white">{emp.name}</h4>
                                  <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold">TL</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{emp.role}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {ev ? (
                                <>
                                  <div className="text-right">
                                    <div className={`text-lg font-bold ${getScoreColor(ev.finalScore)}`}>
                                      {ev.finalScore}
                                      <span className="text-xs font-normal text-slate-400">/100</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400">{ev.classification}</div>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                                    {ARABIC_STATUSES[ev.status]?.label || ev.status}
                                  </span>
                                  <button
                                    onClick={() => onViewEvaluation(ev)}
                                    className="shrink-0 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                  >
                                    View
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                    Pending Evaluation
                                  </span>
                                  <button
                                    onClick={() => onStartEvaluation(emp.id)}
                                    className="shrink-0 rounded-xl bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                  >
                                    Evaluate Now
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Regular Employees Section */}
                  {regularEmps.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-white/2 border-b border-white/5 flex items-center gap-2">
                        <Star className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Employees
                        </span>
                      </div>
                      {regularEmps.map((emp) => {
                        const ev = getEval(emp.id);
                        return (
                          <div
                            key={emp.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-teal-900/40 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs uppercase shrink-0">
                                {emp.name.substring(0, 2)}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-white">{emp.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] text-slate-400">{emp.role}</p>
                                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 rounded">
                                    {ARABIC_LEVELS[emp.level] || emp.level}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {ev ? (
                                <>
                                  <div className="text-right">
                                    <div className={`text-lg font-bold ${getScoreColor(ev.finalScore)}`}>
                                      {ev.finalScore}
                                      <span className="text-xs font-normal text-slate-400">/100</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400">{ev.classification}</div>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                                    {ARABIC_STATUSES[ev.status]?.label || ev.status}
                                  </span>
                                  <button
                                    onClick={() => onViewEvaluation(ev)}
                                    className="shrink-0 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                  >
                                    View
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                    Pending Evaluation
                                  </span>
                                  <button
                                    onClick={() => onStartEvaluation(emp.id)}
                                    className="shrink-0 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                  >
                                    Evaluate Now
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Add Employee</h3>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Department</label>
                <select
                  required
                  value={newEmp.departmentId}
                  onChange={e => {
                    const departmentId = e.target.value;
                    const nextLevel = departmentId === 'dept-ai' && newEmp.level === 'Team Leader' ? 'Senior' : newEmp.level;
                    setNewEmp({
                      ...newEmp,
                      departmentId,
                      level: nextLevel,
                      role: getStandardRole(departmentId, '', nextLevel, nextLevel === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                >
                  <option value="">Select a department...</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={newEmp.name}
                  onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                  placeholder="Full name..."
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmp.email}
                  onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none text-left"
                  placeholder="employee@kesraa.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Job Title</label>
                <select
                  required
                  value={newEmp.role}
                  onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                >
                  <option value="">Select a job title...</option>
                  {getRoleOptions(newEmp.departmentId).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Evaluation Role / Level</label>
                <select
                  value={newEmp.level}
                  onChange={e => {
                    const level = e.target.value as EmployeeLevel;
                    setNewEmp({
                      ...newEmp,
                      level,
                      role: getStandardRole(newEmp.departmentId, newEmp.role, level, level === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                >
                  <option value="Junior">Employee / Agent - Junior</option>
                  <option value="Mid">Employee / Agent - Mid</option>
                  <option value="Senior">Employee / Agent - Senior</option>
                  {newEmp.departmentId !== 'dept-ai' && <option value="Team Leader">Team Leader</option>}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 transition-colors"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
