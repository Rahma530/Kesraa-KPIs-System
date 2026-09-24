import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Award,
  CheckCircle2,
  Brain,
  Building2,
  User,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Department, Evaluation, Employee } from '../types';
import { isEvaluableEmployee } from '../utils/departmentNames';

interface AIInsightsModalProps {
  initialEvaluation?: Evaluation | null;
  onClose: () => void;
}

export const AIInsightsModal: React.FC<AIInsightsModalProps> = ({
  initialEvaluation,
  onClose,
}) => {
  const { departments, employees, evaluations, selectedQuarter, selectedYear } = useData();
  const evaluableEmployees = employees.filter(isEvaluableEmployee);

  const [mode, setMode] = useState<'DEPARTMENT' | 'EMPLOYEE'>(
    initialEvaluation ? 'EMPLOYEE' : 'DEPARTMENT'
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    initialEvaluation?.departmentId || departments[0]?.id || 'dept-am'
  );
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEvaluation?.employeeId || ''
  );

  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDepartment = departments.find((d) => d.id === selectedDeptId);
  const activeEmployee = evaluableEmployees.find((e) => e.id === selectedEmpId);
  const activeEvaluation = evaluations.find(
    (e) => e.employeeId === selectedEmpId && e.quarter === selectedQuarter && e.year === selectedYear
  );

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      let promptText = '';
      if (mode === 'DEPARTMENT') {
          const deptEvals = evaluations.filter(
            (e) => e.departmentId === selectedDeptId && e.quarter === selectedQuarter && e.year === selectedYear
          );
          promptText = `You are an HR and performance-evaluation specialist. Analyze the following department performance data and provide insights in English.
Department: ${activeDepartment?.name}
Period: ${selectedQuarter} ${selectedYear}
Evaluation data: ${JSON.stringify(deptEvals)}

Return valid JSON only, using this structure:
{
  "executiveSummary": "One-paragraph executive summary of department performance",
  "topDepartmentStrengths": ["Strength 1", "Strength 2"],
  "systemicWeaknesses": ["Weakness 1", "Weakness 2"],
  "leadershipRecommendations": ["Recommendation 1", "Recommendation 2"],
  "attritionRiskAssessment": "One-sentence attrition risk assessment"
}`;
        } else {
          promptText = `You are an HR and performance-evaluation specialist. Analyze the following employee performance data and provide insights in English.
Employee: ${activeEmployee?.name} (${activeEmployee?.role})
Department: ${activeEmployee?.departmentName}
Evaluation data: ${JSON.stringify(activeEvaluation || { finalScore: 0, classification: 'Not evaluated' })}

Return valid JSON only, using this structure:
{
  "executiveSummary": "Executive summary of employee performance",
  "keyStrengths": ["Strength 1", "Strength 2"],
  "criticalImprovementAreas": ["Improvement area 1", "Improvement area 2"],
  "promotionReadinessScore": 85,
  "promotionVerdict": "Preliminary promotion assessment",
  "coachingPlan": [
    { "timeframe": "30 days", "action": "Action description", "metric": "Success metric" }
  ]
}`;
        }

        const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
          throw new Error('Gemini API key is missing. Add VITE_GEMINI_API_KEY to the local .env file.');
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              response_mime_type: "application/json"
            }
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`HTTP Error ${res.status}: ${JSON.stringify(errData)}`);
        }
        
        const data = await res.json();
        const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        setInsights(JSON.parse(jsonStr));
      
    } catch (err: any) {
      console.warn('AI Fetch Error:', err);
      setError(err.message || 'An error occurred while contacting the AI service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'EMPLOYEE' && !selectedEmpId && evaluableEmployees[0]) {
      setSelectedEmpId(evaluableEmployees[0].id);
      return;
    }
    fetchInsights();
  }, [mode, selectedDeptId, selectedEmpId, evaluableEmployees.length]);

  const handleCopy = () => {
    if (!insights) return;
    navigator.clipboard.writeText(JSON.stringify(insights, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(10, 13, 17, 0.85)' }}>
      <div
        className="relative w-full max-w-4xl rounded-3xl border border-white/10 my-8 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden"
        style={{ background: 'rgba(10, 13, 17, 0.95)' }}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-white text-base">
                AI Insights
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!insights}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={fetchInsights}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Regenerate analysis"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector & Filter Bar (Frosted Pills) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-3" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('DEPARTMENT')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                mode === 'DEPARTMENT'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Department Analysis
            </button>

            <button
              onClick={() => setMode('EMPLOYEE')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                mode === 'EMPLOYEE'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Employee Analysis
            </button>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'DEPARTMENT' ? (
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              >
                {evaluableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.departmentName} - {e.level})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-rose-400">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
              <p className="font-semibold">{error}</p>
              <button onClick={fetchInsights} className="mt-2 text-rose-300 underline text-[11px] hover:text-white">Try Again</button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
              <Sparkles className="h-8 w-8 text-purple-400 animate-pulse" />
              <p className="font-semibold text-white">Analyzing performance data...</p>
            </div>
          ) : !insights ? (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p>No analysis is available. Regenerate to try again.</p>
            </div>
          ) : mode === 'DEPARTMENT' ? (
            /* Department Synthesis Display */
            <div className="space-y-5">
              
              {/* Executive Summary Callout */}
              <div
                className="rounded-2xl border border-purple-500/30 p-5 space-y-2"
                style={{ background: 'rgba(168, 85, 247, 0.08)' }}
              >
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Executive Analysis: {activeDepartment?.name} ({selectedQuarter} {selectedYear})
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {insights.executiveSummary}
                </p>
              </div>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Department Strengths
                  </h4>
                  <ul className="space-y-1.5 text-slate-200">
                    {insights.topDepartmentStrengths?.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                  <h4 className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Systemic Gaps
                  </h4>
                  <ul className="space-y-1.5 text-slate-200">
                    {insights.systemicWeaknesses?.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-400 shrink-0">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Leadership Recommendations */}
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-3"
                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
              >
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-teal-400" /> Leadership Recommendations
                </h4>
                <ul className="space-y-2 text-slate-300">
                  {insights.leadershipRecommendations?.map((r: string, i: number) => (
                    <li key={i} className="rounded-xl border border-white/5 bg-white/5 p-3 flex items-start gap-2">
                      <span className="font-bold text-teal-400">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {insights.attritionRiskAssessment && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-200">
                  <strong>Retention Risk:</strong> {insights.attritionRiskAssessment}
                </div>
              )}

            </div>
          ) : (
            /* Employee Deep-Dive Display */
            <div className="space-y-5">
              
              {/* Executive Summary Banner */}
              <div
                className="rounded-2xl border border-purple-500/30 p-5 space-y-2"
                style={{ background: 'rgba(168, 85, 247, 0.08)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Employee Performance: {activeEmployee?.name}
                  </div>
                  {insights.promotionReadinessScore && (
                    <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-3 py-0.5 text-xs font-bold text-purple-200">
                      Promotion Readiness: {insights.promotionReadinessScore}%
                    </span>
                  )}
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {insights.executiveSummary}
                </p>
                {insights.promotionVerdict && (
                  <p className="text-xs font-medium text-purple-300 mt-1">
                    ↳ {insights.promotionVerdict}
                  </p>
                )}
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Key Strengths
                  </h4>
                  <ul className="space-y-1.5 text-slate-200">
                    {insights.keyStrengths?.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Targeted Growth Areas
                  </h4>
                  <ul className="space-y-1.5 text-slate-200">
                    {insights.criticalImprovementAreas?.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 shrink-0">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 30-60-90 Day Coaching Plan */}
              {insights.coachingPlan && insights.coachingPlan.length > 0 && (
                <div
                  className="rounded-2xl border border-white/10 p-5 space-y-3"
                  style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-teal-400" /> 30-60-90 Day Development Plan
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {insights.coachingPlan.map((plan: any, i: number) => (
                      <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1">
                        <span className="font-bold text-teal-400 block text-xs">{plan.timeframe}</span>
                        <p className="text-white font-medium">{plan.action}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Success metric: {plan.metric}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4" style={{ background: 'rgba(10, 13, 17, 0.95)' }}>
          <div className="text-[11px] text-slate-400">
            AI-generated insights support evaluator and management decisions.
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
