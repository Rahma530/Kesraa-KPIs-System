import React, { useState } from 'react';
import { Users, Award, Clock, ChevronLeft, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ARABIC_LEVELS, ARABIC_STATUSES } from '../locales/ar';
import { Employee, EmployeeLevel } from '../types';
import { getRoleOptions, getStandardRole } from '../utils/departmentNames';

interface TeamLeaderDashboardProps {
  onStartEvaluation: (employeeId: string) => void;
  onViewEvaluation: (evaluationId: string) => void;
}

export const TeamLeaderDashboard: React.FC<TeamLeaderDashboardProps> = ({
  onStartEvaluation,
  onViewEvaluation,
}) => {
  const { currentUser } = useAuth();
  const { employees, evaluations, selectedQuarter, selectedYear, saveEmployee } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Employee Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '',
    email: '',
    role: '',
    level: 'Junior' as EmployeeLevel,
  });

  if (!currentUser || currentUser.systemRole !== 'TEAM_LEADER') {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        This page is available to Team Leaders only.
      </div>
    );
  }

  // Get team members for this leader's department
  const teamMembers = employees.filter(
    (emp) => emp.departmentId === currentUser.departmentId && emp.id !== currentUser.id && emp.isActive
  );

  const filteredMembers = teamMembers.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name || !newEmp.email || !newEmp.role) return;

    const employeeToSave: Employee = {
      id: 'emp-' + Date.now().toString(),
      name: newEmp.name,
      email: newEmp.email,
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      role: getStandardRole(currentUser.departmentId, newEmp.role, newEmp.level, newEmp.level === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'),
      level: newEmp.level,
      teamLeaderId: currentUser.id,
      teamLeaderName: currentUser.name,
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
      systemRole: newEmp.level === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveEmployee(employeeToSave);
    setShowAddModal(false);
    setNewEmp({ name: '', email: '', role: '', level: 'Junior' });
  };

  return (
    <div className="view-shell animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-white tracking-tight mt-1">
          My Team
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {currentUser.departmentName} • {selectedQuarter} {selectedYear}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 ">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-teal-500/20 p-2 text-teal-400">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Team Members</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">{teamMembers.length}</div>
        </div>
        
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 ">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Pending Evaluation</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">
            {teamMembers.filter(emp => !evaluations.some(e => e.employeeId === emp.id && e.quarter === selectedQuarter && e.year === selectedYear)).length}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 ">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Evaluated</h3>
          </div>
          <div className="text-3xl font-display font-bold text-white">
            {teamMembers.filter(emp => evaluations.some(e => e.employeeId === emp.id && e.quarter === selectedQuarter && e.year === selectedYear)).length}
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/5 ">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-white/10 bg-black/40 py-2 px-4 text-xs text-white focus:border-teal-500/50 focus:outline-none"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
        
        <div className="divide-y divide-white/5">
          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No employees to display.</div>
          ) : (
            filteredMembers.map((emp) => {
              const currentEval = evaluations.find(
                (e) => e.employeeId === emp.id && e.quarter === selectedQuarter && e.year === selectedYear
              );
              
              return (
                <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/5 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-teal-900/40 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold uppercase shrink-0">
                      {emp.name.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{emp.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">{emp.role}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 rounded">{ARABIC_LEVELS[emp.level] || emp.level}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-1/3">
                    {currentEval ? (
                      <div className="flex flex-col sm:items-end shrink-0">
                        <span className="text-[10px] text-slate-400 mb-1">Status</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${currentEval.status === 'PUBLISHED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30'}`}>
                          {ARABIC_STATUSES[currentEval.status]?.label || currentEval.status}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:items-end shrink-0">
                        <span className="text-[10px] text-slate-400 mb-1">Status</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30">
                          Pending Evaluation
                        </span>
                      </div>
                    )}
                    
                    <button
                      onClick={() => currentEval ? onViewEvaluation(currentEval.id) : onStartEvaluation(emp.id)}
                      className="shrink-0 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors flex items-center gap-1"
                    >
                      {currentEval ? 'View Evaluation' : 'Evaluate Now'}
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 ">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-6">Add Employee</h3>
            
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={newEmp.name}
                  onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-teal-500/50 focus:outline-none"
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
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-teal-500/50 focus:outline-none text-left"
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
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-teal-500/50 focus:outline-none"
                >
                  <option value="">Select a job title...</option>
                  {getRoleOptions(currentUser.departmentId).map((role) => (
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
                      role: getStandardRole(currentUser.departmentId, newEmp.role, level, level === 'Team Leader' ? 'TEAM_LEADER' : 'EMPLOYEE'),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-white focus:border-teal-500/50 focus:outline-none"
                >
                  <option value="Junior">Employee / Agent - Junior</option>
                  <option value="Mid">Employee / Agent - Mid</option>
                  <option value="Senior">Employee / Agent - Senior</option>
                  <option value="Team Leader">Team Leader</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2.5 transition-colors"
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
