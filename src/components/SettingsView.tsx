import React, { useEffect, useState } from 'react';
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
  EvaluationQuarter,
  ScoringRubric
} from '../types';
import { CalculationEngine } from '../services/calculationEngine';
import { getRoleOptions } from '../utils/departmentNames';

const SCORING_BANDS: Array<{ key: keyof ScoringRubric; range: string; label: string }> = [
  { key: 'excellent', range: '9-10', label: 'Excellent' },
  { key: 'good', range: '7-8', label: 'Good' },
  { key: 'needsImprovement', range: '5-6', label: 'Needs improvement' },
  { key: 'poor', range: '3-4', label: 'Poor' },
  { key: 'critical', range: '1-2', label: 'Critical' },
];
const SCORING_BAND_PREFIX = /^\s*\d+\s*-\s*\d+\s*:\s*/;

// Collapsible editor for a KPI's five scoring bands. The "9-10: " style prefix is fixed by the
// band, so only the text after it is editable and the stored format is always preserved.
const ScoringGuideEditor: React.FC<{
  kpi: KPIDefinition;
  onChange: (id: string, updates: Partial<KPIDefinition>) => void;
}> = ({ kpi, onChange }) => (
  <details className="rounded-lg border border-white/10 bg-white/[0.02]">
    <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200">
      Scoring guide (1-10)
    </summary>
    <div className="space-y-2 p-2.5">
      {SCORING_BANDS.map(({ key, range, label }) => (
        <label key={key} className="block">
          <span className="text-[10px] font-bold text-slate-400">{label} ({range})</span>
          <textarea
            dir="auto"
            rows={2}
            value={(kpi.scoringGuide?.[key] ?? '').replace(SCORING_BAND_PREFIX, '')}
            onChange={(e) =>
              onChange(kpi.id, { scoringGuide: { ...kpi.scoringGuide, [key]: `${range}: ${e.target.value}` } })
            }
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300 focus:outline-none"
          />
        </label>
      ))}
    </div>
  </details>
);

export const SettingsView: React.FC = () => {
  const { settings, settingsSource, saveSettings, departments } = useData();
  const { canManageSettings, currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'formula' | 'common' | 'dept' | 'leadership' | 'classifications' | 'levels'>('formula');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || 'dept-am');
  const [localSettings, setLocalSettings] = useState<SystemSettings>({ ...settings });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canSaveToDatabase = settingsSource === 'database';

  // Start from the latest shared copy whenever it is (re)loaded from the database.
  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  // Validate weights live
  const validation = CalculationEngine.validateWeights(localSettings);

  const handleSave = async () => {
    if (!canManageSettings()) {
      alert('You do not have permission to modify KPI settings.');
      return;
    }

    if (!validation.isValid) {
      alert(`Settings cannot be saved because of KPI weight errors:\n${validation.errors.join('\n')}`);
      return;
    }

    if (!canSaveToDatabase || isSaving) return;

    setSaveErrorMsg(null);
    setIsSaving(true);
    try {
      const result = await saveSettings(localSettings);
      if (result.status === 'conflict') {
        setSaveErrorMsg('The settings were changed by someone else. The latest version has been loaded; please review it and make your changes again.');
        return;
      }
      setSaveSuccessMsg('Settings were updated successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (error) {
      setSaveErrorMsg(error instanceof Error ? error.message : 'The settings could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

  const handleAddKPI = (category: KPIDefinition['category'], deptId?: string, roleName?: string) => {
    const newKpi: KPIDefinition = {
      id: `kpi-custom-${Date.now()}`,
      name: 'New Custom KPI',
      category,
      departmentId: deptId,
      ...(roleName ? { roleName } : {}),
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

  // Role-group actions apply to every department KPI with this department and roleName.
  const inRoleGroup = (k: KPIDefinition, deptId: string, roleName: string) =>
    k.departmentId === deptId && k.roleName?.trim() === roleName;

  const handleSetRoleGroupActive = (deptId: string, roleName: string, isActive: boolean) => {
    setLocalSettings((prev) => ({
      ...prev,
      departmentKPIs: prev.departmentKPIs.map((k) => (inRoleGroup(k, deptId, roleName) ? { ...k, isActive } : k)),
    }));
  };

  const handleDeleteRoleGroup = (deptId: string, roleName: string, kpiCount: number) => {
    const confirmed = window.confirm(
      `Delete the "${roleName}" KPI group (${kpiCount} KPI${kpiCount === 1 ? '' : 's'})?\n\n` +
      'The KPIs are removed from the settings when you press Save Settings. ' +
      'Evaluations that are already saved keep their own copy of the KPIs and are not affected.'
    );
    if (!confirmed) return;
    setLocalSettings((prev) => ({
      ...prev,
      departmentKPIs: prev.departmentKPIs.filter((k) => !inRoleGroup(k, deptId, roleName)),
    }));
  };

  // Department KPIs of the selected department, grouped the way CalculationEngine.validateWeights
  // groups them: the KPIs without a roleName first, then one group per roleName.
  const deptKpis = localSettings.departmentKPIs.filter((k) => k.departmentId === selectedDeptId);
  const deptRoleOptions = getRoleOptions(selectedDeptId);
  const deptRoleNames: string[] = Array.from(
    new Set<string>(deptKpis.map((k) => k.roleName?.trim() || '').filter(Boolean))
  );
  const deptGroups: Array<{ roleName: string; key: string; kpis: KPIDefinition[] }> = [
    { roleName: '', key: selectedDeptId, kpis: deptKpis.filter((k) => !k.roleName?.trim()) },
    ...deptRoleNames.map((roleName) => ({
      roleName,
      key: `${selectedDeptId} / ${roleName}`,
      kpis: deptKpis.filter((k) => k.roleName?.trim() === roleName),
    })),
  ];
  const roleChoicesFor = (kpi: KPIDefinition) => {
    const current = kpi.roleName?.trim();
    return current && !deptRoleOptions.includes(current) ? [...deptRoleOptions, current] : deptRoleOptions;
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
            disabled={!canSaveToDatabase || isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {!canSaveToDatabase && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-200" role="status">
          {settingsSource === 'cache' ? 'Showing the last saved copy of the settings' : 'Showing the default settings'} because the shared settings have not loaded from the database yet. Saving is disabled until they load; refresh the page to try again.
        </div>
      )}

      {saveErrorMsg && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-200" role="alert">
          {saveErrorMsg}
        </div>
      )}

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
                <ScoringGuideEditor kpi={kpi} onChange={handleUpdateKPI} />
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
            </div>
          </div>

          <div className="space-y-6">
            {deptGroups.map((group) => {
              const groupSum = group.kpis.length > 0 ? validation.departmentSums[group.key] ?? 0 : null;
              const groupOk = groupSum !== null && Math.abs(groupSum - localSettings.deptKpiPercent) <= 0.01;
              // A role group whose KPIs are all inactive is switched off (it is not weight-validated).
              const groupDisabled = group.roleName !== '' && group.kpis.length > 0 && group.kpis.every((k) => !k.isActive);

              return (
                <div key={group.key} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">
                          {group.roleName ? `Role: ${group.roleName}` : 'All roles (department default)'}
                        </h4>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            groupDisabled
                              ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                              : groupSum === null
                              ? 'border-slate-500/30 bg-slate-500/15 text-slate-300'
                              : groupOk
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {groupDisabled
                            ? 'Disabled'
                            : groupSum === null
                            ? 'No KPIs yet'
                            : `${groupOk ? '✓ ' : ''}${groupSum}% of ${localSettings.deptKpiPercent}%`}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {groupDisabled
                          ? `Disabled: employees whose job title is ${group.roleName} use the department default KPIs.`
                          : group.roleName
                          ? `Replaces the department default KPIs for employees whose job title is ${group.roleName}.`
                          : 'Used for every employee in this department who has no role-specific group.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {group.roleName && group.kpis.length > 0 && (
                        <>
                          <button
                            onClick={() => handleSetRoleGroupActive(selectedDeptId, group.roleName, groupDisabled)}
                            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                              groupDisabled
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            }`}
                          >
                            {groupDisabled ? 'Enable group' : 'Disable group'}
                          </button>
                          <button
                            onClick={() => handleDeleteRoleGroup(selectedDeptId, group.roleName, group.kpis.length)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete group
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleAddKPI('DEPARTMENT', selectedDeptId, group.roleName)}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add KPI
                      </button>
                    </div>
                  </div>

                  {group.kpis.map((kpi) => (
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

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          <select
                            value={kpi.roleName?.trim() || ''}
                            onChange={(e) => handleUpdateKPI(kpi.id, { roleName: e.target.value || undefined })}
                            aria-label="Applies to job title"
                            className="max-w-[16rem] rounded-lg border border-white/10 bg-neutral-950 px-2 py-1 text-xs font-semibold text-white focus:outline-none"
                          >
                            <option value="">All roles (department default)</option>
                            {roleChoicesFor(kpi).map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>

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
                      <ScoringGuideEditor kpi={kpi} onChange={handleUpdateKPI} />
                    </div>
                  ))}

                  {group.kpis.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                      No KPIs in this group yet. Use Add KPI to create one.
                    </p>
                  )}
                </div>
              );
            })}
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
                <ScoringGuideEditor kpi={kpi} onChange={handleUpdateKPI} />
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
