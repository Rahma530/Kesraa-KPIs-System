import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  ArrowUpRight,
  Filter,
  BarChart3,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Evaluation } from '../types';
import { ARABIC_CLASSIFICATIONS, ARABIC_STATUSES } from '../locales/ar';
import { AuditService } from '../services/auditService';

interface DashboardViewProps {
  onSelectEvaluation: (evaluation: Evaluation) => void;
  onNewEvaluation: (employeeId?: string) => void;
  onOpenAIInsights: () => void;
  onOpenGoogleSheets: () => void;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  Excellent: '#10b981', // emerald
  'Very Good': '#6366f1', // indigo — matches the "Very Good" classification badge in config
  Good: '#f59e0b', // amber
  'Needs Improvement': '#f97316', // orange
  'Needs Attention': '#ef4444', // rose
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectEvaluation,
  onNewEvaluation,
  onOpenAIInsights,
  onOpenGoogleSheets,
}) => {
  const { departments, employees, evaluations, selectedQuarter, selectedYear } = useData();
  const { currentUser, isExecutiveOrAdmin } = useAuth();

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Filter evaluations for active cycle
  const currentCycleEvals = evaluations.filter(
    (e) => e.quarter === selectedQuarter && e.year === selectedYear
  );

  // Department-filtered evaluations
  const displayedEvals =
    selectedDeptFilter === 'ALL'
      ? currentCycleEvals
      : currentCycleEvals.filter((e) => e.departmentId === selectedDeptFilter);

  // Key metrics calculation
  const totalEmployees = employees.filter((e) => e.isActive).length;
  const eligibleEmployees = employees.filter((e) => e.isActive && e.startDate <= '2026-06-01').length;
  const completedEvals = displayedEvals.filter((e) =>
    ['PUBLISHED', 'EMPLOYEE_VIEWED', 'ACKNOWLEDGED'].includes(e.status)
  );
  const pendingApprovals = displayedEvals.filter((e) =>
    ['SUBMITTED_BY_TEAM_LEADER', 'UNDER_REVIEW', 'REVIEWED'].includes(e.status)
  );

  const averageScore =
    completedEvals.length > 0
      ? Number(
          (
            completedEvals.reduce((acc, curr) => acc + curr.finalScore, 0) / completedEvals.length
          ).toFixed(1)
        )
      : 0;

  const completionPercent = eligibleEmployees > 0
    ? Math.round((completedEvals.length / eligibleEmployees) * 100)
    : 0;

  // Department comparison dataset
  const deptPerformanceData = departments.map((dept) => {
    const deptEvals = currentCycleEvals.filter(
      (e) =>
        e.departmentId === dept.id &&
        ['PUBLISHED', 'EMPLOYEE_VIEWED', 'ACKNOWLEDGED', 'HR_MANAGEMENT_APPROVED'].includes(e.status)
    );
    const avg =
      deptEvals.length > 0
        ? Number(
            (deptEvals.reduce((sum, e) => sum + e.finalScore, 0) / deptEvals.length).toFixed(1)
          )
        : 0;

    return {
      department: dept.name,
      code: dept.code,
      averageScore: avg,
      completedCount: deptEvals.length,
    };
  });

  // Top department
  const topDept = [...deptPerformanceData]
    .filter((d) => d.completedCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore)[0];

  // Classification breakdown dataset
  const classificationCounts: Record<string, number> = {
    Excellent: 0,
    'Very Good': 0,
    Good: 0,
    'Needs Improvement': 0,
    'Needs Attention': 0,
  };

  displayedEvals.forEach((e) => {
    if (classificationCounts[e.classification] !== undefined) {
      classificationCounts[e.classification]++;
    }
  });

  const classificationPieData = Object.entries(classificationCounts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  // Top 3 Leaderboard
  const topPerformers = [...completedEvals]
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3);

  // Historical Trends (Q1, Q2, Q3 2026)
  const historicalTrendData = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
    const qEvals = evaluations.filter((e) => e.quarter === q && e.year === selectedYear && e.isEligible);
    const avg =
      qEvals.length > 0
        ? Number((qEvals.reduce((s, e) => s + e.finalScore, 0) / qEvals.length).toFixed(1))
        : null;
    return {
      quarter: `${q} ${selectedYear}`,
      average: avg,
      count: qEvals.length,
    };
  });

  return (
    <div className="view-shell">
      
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-white tracking-tight mt-1">
            Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Period: <span className="text-teal-400 font-semibold">{selectedQuarter} {selectedYear}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-sheets-sync"
            onClick={onOpenGoogleSheets}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all "
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            CSV Import / Export
          </button>

          <button
            id="btn-open-ai-insights"
            onClick={onOpenAIInsights}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600/80 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-600 transition-all shadow-lg shadow-teal-500/20 "
          >
            <Sparkles className="h-4 w-4 text-teal-200" />
            AI Insights
          </button>
        </div>
      </div>

      {/* 4 Frosted Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: Completion Rate */}
        <div className="stat-card flex flex-col justify-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Evaluation Completion
          </p>
          <div className="flex items-end gap-2 mt-1">
            <p className="font-display font-tabular text-white text-3xl">{completionPercent}%</p>
            <p className="text-emerald-400 text-xs pb-1 mb-0.5 font-semibold">
              {completedEvals.length} / {eligibleEmployees}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Eligible employees in {selectedQuarter}
          </p>
        </div>

        {/* Metric 2: Average Score */}
        <div className="stat-card flex flex-col justify-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Company Average Score
          </p>
          <div className="flex items-end gap-2 mt-1">
            <p className="font-display font-tabular text-white text-3xl">
              {averageScore > 0 ? averageScore : '—'}
            </p>
            <p className="text-teal-400 text-xs pb-1 mb-0.5 font-semibold underline">
              {averageScore >= 90 ? 'Excellent' : averageScore >= 80 ? 'Very Good' : 'Standard'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Weighted score out of 100
          </p>
        </div>

        {/* Metric 3: Pending Reviews */}
        <div className="stat-card flex flex-col justify-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Pending Review
          </p>
          <div className="flex items-end gap-2 mt-1">
            <p className="font-display font-tabular text-white text-3xl">
              {pendingApprovals.length}
            </p>
            <span className="text-amber-400 text-xs pb-1 mb-0.5 font-semibold">
              Awaiting approval
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Evaluations awaiting review
          </p>
        </div>

        {/* Metric 4: AI Insights Glow Card */}
        <div
          className="stat-card flex flex-col justify-center border-teal-500/30"
          style={{ background: 'rgba(20, 184, 166, 0.09)' }}
        >
          <div className="absolute top-2 right-2 text-teal-300/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-teal-200 text-xs font-bold uppercase tracking-wider mb-1">
            AI Insights
          </p>
          <p className="text-white text-xs leading-relaxed mt-0.5">
            {topDept
              ? `${topDept.department} leads the current period with an average score of ${topDept.averageScore}.`
              : `${departments.length} departments are active for evaluation.`}
          </p>
        </div>

      </div>

      {/* Department Filter Tabs (Frosted Pills) */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto rounded-2xl p-2 border border-white/10"
        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
      >
        <button
          id="filter-dept-all"
          onClick={() => setSelectedDeptFilter('ALL')}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
            selectedDeptFilter === 'ALL'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          All Departments ({departments.length})
        </button>
        {departments.map((dept) => (
          <button
            key={dept.id}
            id={`filter-dept-${dept.code.toLowerCase()}`}
            onClick={() => setSelectedDeptFilter(dept.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              selectedDeptFilter === dept.id
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {dept.name}
          </button>
        ))}
      </div>

      {/* Visualizations Section (2 Columns Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Chart 1: Department Benchmarks */}
        <div
          className="rounded-3xl border border-white/10 p-6 flex flex-col justify-between"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-white text-sm">
                Department Performance
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Weighted average score by department
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval={0}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} / 100`, 'Average Score']}
                  labelFormatter={(label: any) => {
                    const matched = deptPerformanceData.find((d) => d.code === label);
                    return matched ? matched.department : label;
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(10, 13, 17, 0.95)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
                <Bar dataKey="averageScore" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Classification Donut & Leaderboard */}
        <div
          className="rounded-3xl border border-white/10 p-6 flex flex-col justify-between"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-white text-sm">
                Performance Distribution
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Employees by performance classification
              </p>
            </div>
            <Award className="h-4 w-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center h-64">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classificationPieData.length > 0 ? classificationPieData : [{ name: 'No Data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {classificationPieData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={CLASSIFICATION_COLORS[entry.name] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10, 13, 17, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-xs">
              {Object.keys(classificationCounts).map((label) => (
                <div key={label} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CLASSIFICATION_COLORS[label] }}
                    />
                    <span className="font-medium text-slate-300">
                      {ARABIC_CLASSIFICATIONS[label]?.label || label}
                    </span>
                  </div>
                  <span className="font-bold text-white font-mono">
                    {classificationCounts[label]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Active Evaluations Table + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 cols: Active Evaluations Table */}
        <div
          className="lg:col-span-8 rounded-3xl border border-white/10 p-6 flex flex-col"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-white text-base">Current Evaluations</h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[10px] font-semibold">
                {displayedEvals.length} records
              </span>
              <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-semibold">
                Period: {selectedQuarter}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="text-slate-500 text-left border-b border-white/5">
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest">Employee</th>
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest">Department</th>
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest">Level</th>
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest">Score</th>
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest">Status</th>
                  <th className="pb-3 font-medium uppercase text-[10px] tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-white divide-y divide-white/5">
                {displayedEvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No evaluations are available for this filter.
                    </td>
                  </tr>
                ) : (
                  displayedEvals.map((evaluation) => {
                    const isSenior = evaluation.level === 'Senior';
                    const isTL = evaluation.level === 'Team Leader';
                    const isMid = evaluation.level === 'Mid';

                    return (
                      <tr
                        key={evaluation.id}
                        className="group hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3.5 font-medium text-xs">
                          {evaluation.employeeName}
                        </td>
                        <td className="py-3.5 text-slate-400 text-xs">
                          {evaluation.departmentName}
                        </td>
                        <td className="py-3.5">
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
                            {evaluation.level}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono font-bold text-xs text-white">
                          {evaluation.finalScore > 0 ? (
                            <span>
                              {evaluation.finalScore}{' '}
                              <span className="text-[10px] text-slate-500">/ 100</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`text-xs flex items-center gap-1.5 font-medium ${
                              evaluation.status === 'PUBLISHED' || evaluation.status === 'ACKNOWLEDGED'
                                ? 'text-emerald-400'
                                : evaluation.status === 'HR_MANAGEMENT_APPROVED'
                                ? 'text-purple-400'
                                : evaluation.status === 'SUBMITTED_BY_TEAM_LEADER'
                                ? 'text-amber-400'
                                : 'text-teal-400'
                            }`}
                          >
                            ● {ARABIC_STATUSES[evaluation.status]?.label || evaluation.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            id={`view-eval-${evaluation.id}`}
                            onClick={() => onSelectEvaluation(evaluation)}
                            className="text-teal-400 hover:text-white font-medium text-xs transition-colors"
                          >
                            Review Details
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

        {/* Right 4 cols: Leaderboard & Audit Box */}
        <div
          className="lg:col-span-4 rounded-3xl border border-white/10 p-6 flex flex-col justify-between"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div>
            <div className="border-b border-white/5 pb-4 mb-4">
              <h3 className="font-display text-white text-base">Department Rankings</h3>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-1">
                Leaders for {selectedQuarter} {selectedYear}
              </p>
            </div>

            <div className="space-y-3">
              {topPerformers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Evaluations are still being completed for this period.
                </p>
              ) : (
                topPerformers.map((perf, i) => (
                  <div
                    key={perf.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-display text-sm ${
                          i === 0
                            ? 'text-[#e8c874]'
                            : i === 1
                            ? 'text-slate-300'
                            : 'text-orange-400'
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-white text-xs font-semibold">
                          {perf.employeeName}
                        </p>
                        <p className="text-slate-500 text-[10px]">
                          {perf.departmentName}
                        </p>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold text-sm">
                      {perf.finalScore}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Frosted Audit Trail Snapshot Capsule */}
          <div className="mt-6 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20">
            <p className="text-teal-200 text-[10px] font-bold uppercase tracking-wider mb-2">
              Recent Activity
            </p>
            <div className="space-y-2 text-[10px]">
              {AuditService.getLogs().slice(0, 3).map((log) => (
                <p key={log.id} className="text-white flex justify-between gap-4">
                  <span className="truncate" title={log.details || log.action}>{log.details || log.action}</span>
                  <span className="text-slate-400 font-mono flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              ))}
              {AuditService.getLogs().length === 0 && (
                <p className="text-slate-500 text-center py-2">No activity recorded</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
