import React, { useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Database,
  Layers,
  Award,
  BookOpen,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  SystemSettings,
  KPIDefinition,
  PerformanceClassificationConfig,
  EvaluationQuarter
} from '../types';
import { CalculationEngine } from '../services/calculationEngine';

export const SettingsView: React.FC = () => {
  const { settings, saveSettings, departments } = useData();
  const { canManageSettings, currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'formula' | 'common' | 'dept' | 'leadership' | 'classifications' | 'levels'>('formula');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || 'dept-am');
  const [localSettings, setLocalSettings] = useState<SystemSettings>({ ...settings });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Validate weights live
  const validation = CalculationEngine.validateWeights(localSettings);

  const handleSave = () => {
    if (!canManageSettings()) {
      alert('You do not have permission to modify KPI settings.');
      return;
    }

    if (!validation.isValid) {
      alert(`Settings cannot be saved because of KPI weight errors:\n${validation.errors.join('\n')}`);
      return;
    }

    saveSettings(localSettings);
    setSaveSuccessMsg('Settings were updated successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleUpdateKPI = (id: string, updates: Partial<KPIDefinition>) => {
    setLocalSettings((prev) => {
      const updateList = (list: KPIDefinition[]) =>
        list.map((k) => (k.id === id ? { ...k, ...updates } : k));

      return {
        ...prev,
        commonKPIs: updateList(prev.commonKPIs),
        departmentKPIs: updateList(prev.departmentKPIs),
        leadershipKPIs: updateList(prev.leadershipKPIs),
        headTechManagementKPIs: updateList(prev.headTechManagementKPIs),
      };
    });
  };

  const handleAddKPI = (category: KPIDefinition['category'], deptId?: string) => {
    const newKpi: KPIDefinition = {
      id: `kpi-custom-${Date.now()}`,
      name: 'New Custom KPI',
      category,
      departmentId: deptId,
      weight: 5,
      description: 'Define the detailed measurement criteria...',
      isActive: true,
      scoringGuide: {
        excellent: '9-10: يتجاوز جميع المخرجات المستهدفة بجودة استثنائية.',
        good: '7-8: يحقق متطلبات المخرجات القياسية بشكل موثوق.',
        needsImprovement: '5-6: مخرجات متذبذبة تحتاج متابعة منتظمة.',
        poor: '3-4: مخرجات دون المستوى مع عدم الالتزام بالمواعيد.',
        critical: '1-2: فشل كامل في تحقيق المطلوب.',
      },
    };

    setLocalSettings((prev) => {
      if (category === 'COMMON') {
        return { ...prev, commonKPIs: [...prev.commonKPIs, newKpi] };
      }
      if (category === 'DEPARTMENT') {
        return { ...prev, departmentKPIs: [...prev.departmentKPIs, newKpi] };
      }
      if (category === 'LEADERSHIP') {
        return { ...prev, leadershipKPIs: [...prev.leadershipKPIs, newKpi] };
      }
      return { ...prev, headTechManagementKPIs: [...prev.headTechManagementKPIs, newKpi] };
    });
  };

  const handleDeleteKPI = (id: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      commonKPIs: prev.commonKPIs.filter((k) => k.id !== id),
      departmentKPIs: prev.departmentKPIs.filter((k) => k.id !== id),
      leadershipKPIs: prev.leadershipKPIs.filter((k) => k.id !== id),
      headTechManagementKPIs: prev.headTechManagementKPIs.filter((k) => k.id !== id),
    }));
  };

  const handleUpdateClassification = (id: string, updates: Partial<PerformanceClassificationConfig>) => {
    setLocalSettings((prev) => ({
      ...prev,
      classifications: prev.classifications.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  return (
    <div className="view-shell">
      
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-white tracking-tight mt-1">
            KPIs & Settings
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccessMsg && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              ✓ {saveSuccessMsg}
            </span>
          )}

          <button
            id="btn-save-settings"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 transition-all "
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>

      {/* Live Formula Weight Sum Status Banner */}
      <div
        className={`rounded-2xl border p-4 transition-colors ${
          validation.isValid
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {validation.isValid ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="text-xs font-bold">
              {validation.isValid
                ? 'All KPI weights match the required totals'
                : 'KPI weight conflicts were detected'}
            </h4>
            <div className="mt-1 flex flex-wrap gap-4 text-[11px]">
              <span>
                Common skills total: <strong>{validation.commonSum}%</strong> (target: {localSettings.commonSkillsPercent}%)
              </span>
              <span>
                Leadership total: <strong>{validation.leadershipSum}%</strong> (target: {localSettings.tlLeadershipPercent}%)
              </span>
            </div>
            {!validation.isValid && (
              <ul className="mt-2 list-disc list-inside text-xs space-y-0.5 font-medium">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Settings Navigation Tabs (Frosted Pills) */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 p-2"
        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
      >
        <button
          onClick={() => setActiveTab('formula')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'formula'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Sliders className="h-3.5 w-3.5 text-teal-400" />
          General Settings
        </button>

        <button
          onClick={() => setActiveTab('common')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'common'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-teal-400" />
          Common Skills ({localSettings.commonSkillsPercent}%)
        </button>

        <button
          onClick={() => setActiveTab('dept')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'dept'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Database className="h-3.5 w-3.5 text-teal-400" />
          Department KPIs ({localSettings.deptKpiPercent}%)
        </button>

        <button
          onClick={() => setActiveTab('leadership')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'leadership'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Award className="h-3.5 w-3.5 text-teal-400" />
          Leadership KPIs ({localSettings.tlLeadershipPercent}%)
        </button>

        <button
          onClick={() => setActiveTab('classifications')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'classifications'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Award className="h-3.5 w-3.5 text-teal-400" />
          Classifications
        </button>

        <button
          onClick={() => setActiveTab('levels')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'levels'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-teal-400" />
          Rating Methodology
        </button>
      </div>

      {/* Tab 1: Global & Formula Weights */}
      {activeTab === 'formula' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          
          {/* Global Cycle Settings */}
          <div
            className="rounded-3xl border border-white/10 p-6 space-y-4"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <h3 className="text-sm font-semibold text-white">
              Evaluation Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Active Settings Version
                </label>
                <input
                  type="text"
                  value={localSettings.activeVersion}
                  onChange={(e) => setLocalSettings({ ...localSettings, activeVersion: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-teal-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Minimum Tenure for Evaluation (months)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={localSettings.minEmploymentMonths}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, minEmploymentMonths: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-teal-500/60 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Employees below this tenure are not eligible for evaluation.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Allowed Score Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled
                    value={localSettings.scoreMin}
                    className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    disabled
                    value={localSettings.scoreMax}
                    className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                  />
                  <span className="text-xs text-slate-400 font-medium">(whole numbers from 1 to 10)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Formula Ratio Sliders & Percentages */}
          <div
            className="rounded-3xl border border-white/10 p-6 space-y-4"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <h3 className="text-sm font-semibold text-white">
              Evaluation Component Weights
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">Common Skills (Employee / Agent)</span>
                  <span className="font-mono font-bold text-teal-400">{localSettings.commonSkillsPercent}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={70}
                  step={5}
                  value={localSettings.commonSkillsPercent}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      commonSkillsPercent: Number(e.target.value),
                      deptKpiPercent: 100 - Number(e.target.value),
                    })
                  }
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">Department KPIs (Employee / Agent)</span>
                  <span className="font-mono font-bold text-emerald-400">{localSettings.deptKpiPercent}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={5}
                  value={localSettings.deptKpiPercent}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      deptKpiPercent: Number(e.target.value),
                      commonSkillsPercent: 100 - Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-white/10">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">Team Leader: Leadership Competencies</span>
                  <span className="font-mono font-bold text-purple-400">{localSettings.tlLeadershipPercent}%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Team Leaders: 40% common skills + 40% department KPIs + 20% leadership = 100%
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Common Skills Matrix */}
      {activeTab === 'common' && (
        <div
          className="rounded-3xl border border-white/10 p-6 space-y-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Common Skills (all employees)
              </h3>
              <p className="text-xs text-slate-400">
                Assigned weight: <strong className="text-teal-400">{validation.commonSum}%</strong> of {localSettings.commonSkillsPercent}%
              </p>
            </div>

            <button
              onClick={() => handleAddKPI('COMMON')}
              className="inline-flex items-center gap-1 rounded-xl border border-teal-500/30 bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Common KPI
            </button>
          </div>

          <div className="space-y-3">
            {localSettings.commonKPIs.map((kpi) => (
              <div
                key={kpi.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={kpi.name}
                      onChange={(e) => handleUpdateKPI(kpi.id, { name: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white focus:border-teal-500/60 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-medium">Weight:</span>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={kpi.weight}
                        onChange={(e) => handleUpdateKPI(kpi.id, { weight: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-teal-400 text-center"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>

                    <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kpi.isActive}
                        onChange={(e) => handleUpdateKPI(kpi.id, { isActive: e.target.checked })}
                        className="rounded accent-teal-500"
                      />
                      Active
                    </label>

                    <button
                      onClick={() => handleDeleteKPI(kpi.id)}
                      className="text-slate-400 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={2}
                    value={kpi.description}
                    onChange={(e) => handleUpdateKPI(kpi.id, { description: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Department Specific KPIs */}
      {activeTab === 'dept' && (
        <div
          className="rounded-3xl border border-white/10 p-6 space-y-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          {/* Department Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Department KPIs
              </h3>
              <p className="text-xs text-slate-400">
                Select a department to configure its KPIs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleAddKPI('DEPARTMENT', selectedDeptId)}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
              >
                <Plus className="h-3.5 w-3.5" />
                Add KPI
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {localSettings.departmentKPIs
              .filter((k) => k.departmentId === selectedDeptId)
              .map((kpi) => (
                <div
                  key={kpi.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={kpi.name}
                        onChange={(e) => handleUpdateKPI(kpi.id, { name: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white focus:border-emerald-500/60 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400 font-medium">Weight:</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={kpi.weight}
                          onChange={(e) => handleUpdateKPI(kpi.id, { weight: Number(e.target.value) })}
                          className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-emerald-400 text-center"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>

                      <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={kpi.isActive}
                          onChange={(e) => handleUpdateKPI(kpi.id, { isActive: e.target.checked })}
                          className="rounded accent-emerald-500"
                        />
                        Active
                      </label>

                      <button
                        onClick={() => handleDeleteKPI(kpi.id)}
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      value={kpi.description}
                      onChange={(e) => handleUpdateKPI(kpi.id, { description: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tab 4: Leadership KPIs */}
      {activeTab === 'leadership' && (
        <div
          className="rounded-3xl border border-white/10 p-6 space-y-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Leadership and People Management
              </h3>
              <p className="text-xs text-slate-400">
                Assigned weight: <strong className="text-purple-400">{validation.leadershipSum}%</strong> of {localSettings.tlLeadershipPercent}%
              </p>
            </div>

            <button
              onClick={() => handleAddKPI('LEADERSHIP')}
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Leadership KPI
            </button>
          </div>

          <div className="space-y-3">
            {localSettings.leadershipKPIs.map((kpi) => (
              <div
                key={kpi.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={kpi.name}
                      onChange={(e) => handleUpdateKPI(kpi.id, { name: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white focus:border-purple-500/60 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-medium">Weight:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={kpi.weight}
                        onChange={(e) => handleUpdateKPI(kpi.id, { weight: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-purple-400 text-center"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>

                    <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kpi.isActive}
                        onChange={(e) => handleUpdateKPI(kpi.id, { isActive: e.target.checked })}
                        className="rounded accent-purple-500"
                      />
                      Active
                    </label>

                    <button
                      onClick={() => handleDeleteKPI(kpi.id)}
                      className="text-slate-400 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={2}
                    value={kpi.description}
                    onChange={(e) => handleUpdateKPI(kpi.id, { description: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Classifications */}
      {activeTab === 'classifications' && (
        <div
          className="rounded-3xl border border-white/10 p-6 space-y-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div>
            <h3 className="text-sm font-semibold text-white">
              Performance Classifications
            </h3>
            <p className="text-xs text-slate-400">
              Configure score ranges and labels for the final result.
            </p>
          </div>

          <div className="space-y-3">
            {localSettings.classifications.map((band) => (
              <div
                key={band.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={band.label}
                    onChange={(e) => handleUpdateClassification(band.id, { label: e.target.value })}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={band.description}
                    onChange={(e) => handleUpdateClassification(band.id, { description: e.target.value })}
                    className="w-full mt-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">Score range:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={band.minScore}
                    onChange={(e) =>
                      handleUpdateClassification(band.id, { minScore: Number(e.target.value) })
                    }
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-center text-white"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={band.maxScore}
                    onChange={(e) =>
                      handleUpdateClassification(band.id, { maxScore: Number(e.target.value) })
                    }
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-center text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Levels Guide */}
      {activeTab === 'levels' && (
        <div
          className="rounded-3xl border border-white/10 p-6 space-y-4"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <div>
            <h3 className="text-sm font-semibold text-white">
              توقعات المستويات الوظيفية
            </h3>
            <p className="text-xs text-slate-400">
              دليل مرجعي للمقيّمين عند تقييم مستويات مبتدئ، متوسط، سينيور، وقائد فريق.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="rounded-md bg-slate-500/15 text-slate-300 border border-slate-500/30 px-2 py-0.5 text-xs font-bold">
                مستوى مبتدئ (Junior)
              </span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                يركز على تنفيذ المهام، تعلم العمليات الأساسية للقسم، التواصل السريع، والالتزام بمعايير العمل تحت الإشراف.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-xs font-bold">
                مستوى متوسط (Mid)
              </span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                تنفيذ مستقل للمؤشرات الوظيفية الأساسية، حل إبداعي للمشكلات، تعاون مع أصحاب المصلحة، والالتزام الموثوق بالمواعيد.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="rounded-md bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 text-xs font-bold">
                مستوى سينيور (Senior)
              </span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                إتقان تام للمجال، قيادة المبادرات الاستراتيجية، حل المشكلات المعقدة، وضع معايير الجودة، وتوجيه الزملاء المبتدئين.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold">
                قائد فريق / رئيس تقني
              </span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                إدارة الأفراد، تطوير قدرات الفريق، تخطيط سير العمل، حوكمة مستويات الخدمة بين الأقسام، والتقارير التنفيذية.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
