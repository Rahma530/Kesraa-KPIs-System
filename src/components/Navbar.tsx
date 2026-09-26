import React from 'react';
import {
  Calendar,
  Layers,
  Database,
  History,
  Users,
  Award,
  LogOut,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { EvaluationQuarter } from '../types';
import { ADDITIONAL_PERMISSION_LABELS, ARABIC_ROLES, ARABIC_QUARTERS, t } from '../locales/ar';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    logout,
    canManageSettings,
    canManageEmployees,
    hasCapability,
    isTechnicalReviewer,
  } = useAuth();
  const { selectedQuarter, selectedYear, setSelectedQuarter, setSelectedYear } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const quarters: EvaluationQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const years = [2026, 2027, 2028];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'CEO':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'HR':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'HEAD_TECHNICAL':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'AI_ENGINEER':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'TEAM_LEADER':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getBaseRoute = () => {
    if (!currentUser) return '';
    if (['ADMIN', 'HR'].includes(currentUser.systemRole)) return '/admin';
    if (currentUser.systemRole === 'CEO') return '/ceo';
    if (currentUser.systemRole === 'HEAD_TECHNICAL') return '/head-technical';
    if (currentUser.systemRole === 'AI_ENGINEER') return '/ai-engineer';
    if (currentUser.systemRole === 'TEAM_LEADER') return '/team-leader';
    return '/employee';
  };

  const base = getBaseRoute();
  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10" style={{ background: 'rgba(10, 13, 17, 0.86)' }}>
      <div className="mx-auto flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand and Logo */}
        <div className="flex items-center gap-3.5">
          <div className="brand-seal w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[#241a05] text-lg">
            K
          </div>
          <div className="flex items-center">
            <div className="flex items-center gap-2 justify-end">
              <h1 className="font-display text-white tracking-tight text-base leading-tight">
                {t.appName}
              </h1>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Kesraa KPIs System
              </span>
            </div>
          </div>
        </div>

        {/* Global Evaluation Cycle Selector */}
        <div className="hidden md:flex items-center gap-3 rounded-full px-4 py-2 border border-white/10 bg-white/5 ">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Calendar className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-bold text-slate-400">{t.cycle}</span>
          </div>
          <select
            value={selectedQuarter}
            onChange={(event) => setSelectedQuarter(event.target.value as EvaluationQuarter | '')}
            className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-1.5 text-sm font-bold text-slate-200 focus:border-teal-500/50 focus:outline-none"
            aria-label="Select evaluation quarter"
          >
            <option value="">Select quarter</option>
            {quarters.map((quarter) => (
              <option key={quarter} value={quarter} title={ARABIC_QUARTERS[quarter]}>
                {quarter}
              </option>
            ))}
          </select>
          <div className="h-5 w-px bg-white/15 mx-1" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded bg-transparent px-2 py-1 text-sm font-bold text-slate-200 focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-neutral-950 text-white">
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Right Controls: User Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 py-2 px-5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-default">
            
            <div className="flex flex-col text-right">
              <span className="text-sm font-bold text-white leading-tight whitespace-nowrap">
                {currentUser?.name}
              </span>
              <div className="flex items-center justify-end gap-2 mt-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap ${getRoleBadge(
                    currentUser?.systemRole || 'EMPLOYEE'
                  )}`}
                >
                  {currentUser ? ARABIC_ROLES[currentUser.systemRole]?.label : 'Employee'}
                </span>
                {currentUser?.additionalPermissions?.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-purple-300 whitespace-nowrap"
                  >
                    {ADDITIONAL_PERMISSION_LABELS[permission].label}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-10 w-10 rounded-full bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-display font-bold shrink-0">
              {currentUser?.name.substring(0, 2).toUpperCase()}
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-2 px-5 h-11 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-all font-semibold text-xs flex-shrink-0"
          >
            <span className="whitespace-nowrap block min-w-max">Sign Out</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compact cycle selector for phones and small tablets */}
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 md:hidden">
        <Calendar className="h-4 w-4 shrink-0 text-teal-400" />
        <select
          value={selectedQuarter}
          onChange={(event) => setSelectedQuarter(event.target.value as EvaluationQuarter | '')}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs font-bold text-slate-200 focus:border-teal-500/50 focus:outline-none"
          aria-label="Select evaluation quarter"
        >
          <option value="">Select quarter</option>
          {quarters.map((quarter) => (
            <option key={quarter} value={quarter}>{quarter}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs font-bold text-slate-200 focus:border-teal-500/50 focus:outline-none"
          aria-label="Select evaluation year"
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="border-t border-white/5 px-4 sm:px-6 lg:px-8" style={{ background: 'rgba(255, 255, 255, 0.02)' }} role="tablist">
        <div className="mx-auto flex w-full gap-2 overflow-x-auto py-2.5 scrollbar-none">
          {/* Dashboard - Visible to ADMIN, HR, CEO, HEAD_TECHNICAL */}
          {hasCapability('VIEW_EXECUTIVE_DASHBOARD') && !isTechnicalReviewer() && (
             <Link
              to={`${base}/dashboard`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                currentPath === `${base}/dashboard`
                  ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Layers className="h-4 w-4 text-teal-400" />
              {t.dashboard}
            </Link>
          )}

          {/* Head Technical: Analytics Dashboard + Comprehensive Team View */}
          {isTechnicalReviewer() && (
            <>
              <Link
                to={`${base}/analytics`}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                  currentPath === `${base}/analytics`
                    ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Layers className="h-4 w-4 text-teal-400" />
                Dashboard
              </Link>
              <Link
                to={`${base}/dashboard`}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                  currentPath === `${base}/dashboard`
                    ? 'bg-rose-500/12 text-white border border-rose-500/30 shadow-sm shadow-rose-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Users className="h-4 w-4 text-rose-400" />
                Department Evaluations
              </Link>
            </>
          )}

          {/* My Team - Specific to Team Leader */}
          {currentUser?.systemRole === 'TEAM_LEADER' && (
            <Link
              to={`${base}/my-team`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                currentPath === `${base}/my-team`
                  ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Users className="h-4 w-4 text-teal-400" />
              My Team
            </Link>
          )}

          <Link
            to={`${base}/evaluations`}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              currentPath === `${base}/evaluations`
                ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Award className="h-4 w-4 text-teal-400" />
            {t.evaluations}
          </Link>

          {canManageEmployees() && (
            <Link
              to={`${base}/employees`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                currentPath === `${base}/employees`
                  ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Users className="h-4 w-4 text-teal-400" />
              {t.employees}
            </Link>
          )}

          {canManageSettings() && (
            <Link
              to={`${base}/settings`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                currentPath === `${base}/settings`
                  ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Database className="h-4 w-4 text-teal-400" />
              {t.settings}
            </Link>
          )}

          {hasCapability('VIEW_AUDIT_LOGS') && (
            <Link
              to={`${base}/audit`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                currentPath === `${base}/audit`
                  ? 'bg-teal-500/12 text-white border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <History className="h-4 w-4 text-teal-400" />
              {t.audit}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
