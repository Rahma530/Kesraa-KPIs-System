import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Lock,
  Save,
  Send,
  Eye,
  CheckCheck,
  TrendingUp,
  User,
  Building2,
  Calendar,
  Brain,
  FileDown
} from 'lucide-react';
import {
  Evaluation,
  Employee,
  KPIDefinition,
  EvaluationScoreItem,
  EvaluationStatus,
  EvaluationAIRecommendations
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CalculationEngine } from '../services/calculationEngine';
import { ARABIC_STATUSES, ARABIC_CLASSIFICATIONS } from '../locales/ar';
import { AiRecommendationsModal } from './AiRecommendationsModal';
import { printEvaluationReport } from '../services/evaluationReportService';

interface EvaluationFormModalProps {
  evaluation?: Evaluation | null;
  employee?: Employee | null;
  onClose: () => void;
  onSaved: (evaluation: Evaluation) => void;
}

interface EvaluationFormModalContentProps extends EvaluationFormModalProps {
  targetEmployee: Employee;
}

export const EvaluationFormModal: React.FC<EvaluationFormModalProps> = (props) => {
  const { employees } = useData();
  const targetEmployee =
    props.employee ||
    (props.evaluation ? employees.find((employee) => employee.id === props.evaluation?.employeeId) : null);

  if (!targetEmployee) return null;

  return <EvaluationFormModalContent {...props} targetEmployee={targetEmployee} />;
};

const EvaluationFormModalContent: React.FC<EvaluationFormModalContentProps> = ({
  evaluation,
  targetEmployee,
  onClose,
  onSaved,
}) => {
  const { currentUser, canViewKPIWeights, canApproveEvaluations, canPublishEvaluations } = useAuth();
  const { settings, saveEvaluation, acknowledgeEvaluation, selectedQuarter, selectedYear } = useData();

  // Eligibility calculation (minimum 2 months)
  const eligibility = CalculationEngine.checkEligibility(
    targetEmployee?.startDate || '2024-01-01',
    new Date().toISOString(),
    settings.minEmploymentMonths || 2
  );

  const isLocked = evaluation?.locked || ['HR_MANAGEMENT_APPROVED', 'PUBLISHED', 'ACKNOWLEDGED'].includes(evaluation?.status || '');
  const isEmployeeView = currentUser?.systemRole === 'EMPLOYEE' && currentUser.id === targetEmployee?.id;
  const isCurrentUserHeadTechnical = currentUser?.systemRole === 'HEAD_TECHNICAL';
  const isCurrentUserTeamLeader = currentUser?.systemRole === 'TEAM_LEADER';
  const isTeamLeader = targetEmployee.level === 'Team Leader' || targetEmployee.systemRole === 'TEAM_LEADER';
  const isHeadTech = targetEmployee?.isHeadTechnical;

  // Active or Snapshot KPIs
  const activeKpis: KPIDefinition[] = React.useMemo(() => {
    if (evaluation?.snapshotConfig?.kpis) {
      return evaluation.snapshotConfig.kpis;
    }
    const common = settings.commonKPIs.filter((k) => k.isActive);
    const dept = settings.departmentKPIs.filter(
      (k) => k.departmentId === targetEmployee?.departmentId && k.isActive
    );
    const leadership = isTeamLeader ? settings.leadershipKPIs.filter((k) => k.isActive) : [];
    const headTechMgmt = isHeadTech ? settings.headTechManagementKPIs.filter((k) => k.isActive) : [];
    return [...common, ...dept, ...leadership, ...headTechMgmt];
  }, [evaluation, settings, targetEmployee, isTeamLeader, isHeadTech]);

  // Local state for scores
  const [scoresState, setScoresState] = useState<Record<string, { score: number; notes: string }>>({});
  const [strengths, setStrengths] = useState(evaluation?.strengths || '');
  const [improvements, setImprovements] = useState(evaluation?.improvements || '');
  const [developmentActions, setDevelopmentActions] = useState(evaluation?.developmentActions || '');
  const [ackNotes, setAckNotes] = useState(evaluation?.acknowledgementNotes || '');
  const [activeGuideKpiId, setActiveGuideKpiId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<EvaluationAIRecommendations | undefined>(
    evaluation?.aiRecommendations
  );

  // Initialize scores
  useEffect(() => {
    const initial: Record<string, { score: number; notes: string }> = {};
    if (evaluation?.scores && evaluation.scores.length > 0) {
      evaluation.scores.forEach((s) => {
        initial[s.kpiId] = { score: s.score, notes: s.notes || '' };
      });
    } else {
      activeKpis.forEach((k) => {
        initial[k.id] = { score: 8, notes: '' }; // Default whole score 8
      });
    }
    setScoresState(initial);
  }, [evaluation, activeKpis]);

  // Live score calculation
  const calculated = React.useMemo(() => {
    if (evaluation && evaluation.scores.length === 0) {
      return {
        commonScore: evaluation.commonScore,
        departmentScore: evaluation.departmentScore,
        leadershipScore: evaluation.leadershipScore || 0,
        finalScore: evaluation.finalScore,
        classification: evaluation.classification,
        itemScores: [],
      };
    }

    const inputList = Object.entries(scoresState).map(([kpiId, val]) => ({
      kpiId,
      score: (val as { score: number; notes: string }).score,
      notes: (val as { score: number; notes: string }).notes,
    }));

    return CalculationEngine.calculateScores(
      inputList,
      activeKpis,
      isTeamLeader ? 'Team Leader' : targetEmployee.level,
      targetEmployee.isHeadTechnical || false,
      settings.classifications
    );
  }, [scoresState, activeKpis, targetEmployee, settings.classifications, evaluation]);

  const handleScoreChange = (kpiId: string, newScore: number) => {
    if (isLocked) return;
    setScoresState((prev) => ({
      ...prev,
      [kpiId]: { ...prev[kpiId], score: Math.max(1, Math.min(10, Math.round(newScore))) },
    }));
  };

  const handleNotesChange = (kpiId: string, notes: string) => {
    if (isLocked) return;
    setScoresState((prev) => ({
      ...prev,
      [kpiId]: { ...prev[kpiId], notes },
    }));
  };

  // Build Evaluation Payload
  const buildEvaluationPayload = (newStatus: EvaluationStatus): Evaluation => {
    const effectiveQuarter = evaluation?.quarter || selectedQuarter;
    if (!effectiveQuarter) {
      throw new Error('Please select an evaluation quarter first.');
    }
    return {
      id: evaluation?.id || `eval-${targetEmployee.id}-${effectiveQuarter}-${selectedYear}`,
      databaseId: evaluation?.databaseId,
      employeeId: targetEmployee.id,
      employeeName: targetEmployee.name,
      evaluatorId: currentUser?.id || 'emp-admin',
      evaluatorName: currentUser?.name || 'System Administrator',
      evaluatorRole: currentUser?.role || 'Evaluator',
      departmentId: targetEmployee.departmentId,
      departmentName: targetEmployee.departmentName,
      role: targetEmployee.role,
      level: targetEmployee.level,
      quarter: effectiveQuarter,
      year: evaluation?.year || selectedYear,
      cycleId: `cycle-${effectiveQuarter}-${selectedYear}`,
      version: settings.activeVersion || 'v1.0',
      status: newStatus,
      isEligible: eligibility.isEligible,
      eligibilityReason: eligibility.reason,
      tenureMonths: eligibility.tenureMonths,
      commonScore: calculated.commonScore,
      departmentScore: calculated.departmentScore,
      leadershipScore: calculated.leadershipScore,
      finalScore: calculated.finalScore,
      classification: calculated.classification,
      departmentRank: evaluation?.departmentRank || 1,
      totalInDepartment: evaluation?.totalInDepartment || 1,
      strengths,
      improvements,
      developmentActions,
      aiRecommendations,
      locked: ['HR_MANAGEMENT_APPROVED', 'PUBLISHED', 'ACKNOWLEDGED'].includes(newStatus) || evaluation?.locked || false,
      scores: calculated.itemScores,
      snapshotConfig: evaluation?.snapshotConfig || {
        version: settings.activeVersion,
        minEmploymentMonths: settings.minEmploymentMonths,
        commonSkillsPercent: settings.commonSkillsPercent,
        departmentKpiPercent: settings.deptKpiPercent,
        tlLeadershipPercent: settings.tlLeadershipPercent,
        headTechManagementPercent: settings.headTechManagementPercent,
        kpis: activeKpis,
        classifications: settings.classifications,
      },
      submittedAt: ['UNDER_REVIEW', 'SUBMITTED_BY_TEAM_LEADER', 'REVIEWED'].includes(newStatus) ? new Date().toISOString() : evaluation?.submittedAt,
      submittedBy: ['UNDER_REVIEW', 'SUBMITTED_BY_TEAM_LEADER', 'REVIEWED'].includes(newStatus) ? currentUser?.name : evaluation?.submittedBy,
      approvedAt: newStatus === 'HR_MANAGEMENT_APPROVED' ? new Date().toISOString() : evaluation?.approvedAt,
      approvedBy: newStatus === 'HR_MANAGEMENT_APPROVED' ? currentUser?.name : evaluation?.approvedBy,
      publishedAt: newStatus === 'PUBLISHED' ? new Date().toISOString() : evaluation?.publishedAt,
      publishedBy: newStatus === 'PUBLISHED' ? currentUser?.name : evaluation?.publishedBy,
      createdAt: evaluation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleAction = async (newStatus: EvaluationStatus) => {
    if (isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = buildEvaluationPayload(newStatus);
      const saved = await saveEvaluation(payload);
      onSaved(saved);
    } catch (error) {
      console.error('Evaluation persistence failed:', error);
      setSaveError(
        error instanceof Error
          ? `The evaluation was not saved: ${error.message}`
          : 'The evaluation was not saved. Please check your connection and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!evaluation || isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const saved = await acknowledgeEvaluation(evaluation.id, ackNotes);
      if (!saved) {
        throw new Error('The evaluation could not be found in Supabase.');
      }
      onSaved(saved);
    } catch (error) {
      console.error('Evaluation acknowledgement failed:', error);
      setSaveError(
        error instanceof Error
          ? `The acknowledgement was not saved: ${error.message}`
          : 'The acknowledgement was not saved. Please check your connection and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = () => {
    const currentEvaluation = buildEvaluationPayload(evaluation?.status || 'DRAFT');
    if (!printEvaluationReport(currentEvaluation)) {
      alert('Please allow pop-ups to export the evaluation report as PDF.');
    }
  };

  // AI Generation of qualitative narrative using Gemini API
  const handleAIFeedback = async () => {
    try {
      setAiLoading(true);
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key is missing. Add VITE_GEMINI_API_KEY to the local .env file.');
      }
      
      const detailedScores = activeKpis.map(kpi => {
        const val = scoresState[kpi.id]?.score ?? 8;
        return `- ${kpi.name}: ${val}/10`;
      }).join('\n');

      const promptText = `You are an HR and executive performance-evaluation specialist. Analyze the following employee evaluation entered by the team leader and write precise, personalized qualitative notes based on the exact 1-to-10 score for every KPI.

Employee details:
- Name: ${targetEmployee?.name}
- Job title: ${targetEmployee?.role} (${targetEmployee?.level})
- Department: ${targetEmployee?.departmentName}

Detailed scores selected by the team leader:
${detailedScores}

Overall score: ${calculated.finalScore}/100 (${calculated.classification})

Required:
Write an analysis tailored to these scores. Focus on scores from 1 to 5 in improvement areas and the action plan, and scores from 7 to 10 in strengths.

Return valid JSON only, using this structure:
{
  "strengths": "• Strength based on a high-scoring KPI\\n• Second strength",
  "improvements": "• Improvement area based on a low-scoring KPI\\n• Second improvement area",
  "developmentActions": "• 30-day goal to improve weak KPIs: ...\\n• 60-day goal: ...\\n• 90-day goal: ..."
}`;

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
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(jsonStr);

      if (parsed.strengths) setStrengths(parsed.strengths);
      if (parsed.improvements) setImprovements(parsed.improvements);
      if (parsed.developmentActions) setDevelopmentActions(parsed.developmentActions);

    } catch (err) {
      console.warn('AI feedback generation error:', err);
      alert('AI notes could not be generated. Please check the connection and try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Group KPIs for structured section rendering
  const commonKpis = activeKpis.filter((k) => k.category === 'COMMON');
  const deptKpis = activeKpis.filter((k) => k.category === 'DEPARTMENT');
  const leadershipKpis = activeKpis.filter(
    (k) => k.category === 'LEADERSHIP' || k.category === 'MANAGEMENT'
  );

  const showWeights = canViewKPIWeights();

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(10, 13, 17, 0.85)' }}>
      <div
        className="relative w-full max-w-5xl rounded-3xl border border-white/10 my-8 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden"
        style={{ background: 'rgba(10, 13, 17, 0.9)' }}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-white text-base">
                Evaluation Form
              </h2>
              <p className="text-xs text-slate-400">
                Period: <span className="font-semibold text-teal-400">{evaluation?.quarter || selectedQuarter} {evaluation?.year || selectedYear}</span>
                {evaluation?.version && ` • Version ${evaluation.version}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Lock className="h-3.5 w-3.5" />
                Archived and Locked
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          
          {/* Employee Metadata Banner */}
          <div
            className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 p-4 sm:grid-cols-4"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee</span>
              <div className="font-bold text-white text-sm mt-0.5">
                {targetEmployee?.name}
              </div>
              <div className="text-xs text-slate-400">{targetEmployee?.email}</div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
              <div className="font-semibold text-slate-200 text-sm mt-0.5">
                {targetEmployee?.departmentName}
              </div>
              <div className="text-xs text-teal-400 font-medium">
                {targetEmployee?.role} ({targetEmployee?.level})
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenure and Eligibility</span>
              <div className="font-semibold text-slate-200 text-sm mt-0.5">
                {eligibility.tenureMonths} months
              </div>
              <div className="text-xs">
                {eligibility.isEligible ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Eligible
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Minimum tenure not met
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status and Evaluator</span>
              <div className="font-semibold text-slate-200 text-sm mt-0.5">
                {evaluation ? (ARABIC_STATUSES[evaluation.status]?.label || evaluation.status) : 'Not Started'}
              </div>
              <div className="text-xs text-slate-400">
                Team Leader: {targetEmployee?.teamLeaderName || 'Direct Management'}
              </div>
            </div>
          </div>

          {/* Warning Banner if Employee is NOT ELIGIBLE (<2 months tenure) */}
          {!eligibility.isEligible && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">
                    Employee is not eligible for this evaluation
                  </h4>
                  <p className="text-xs text-rose-300/80 mt-1">
                    {eligibility.reason ||
                      `This employee has completed ${eligibility.tenureMonths} months. Company policy requires at least ${settings.minEmploymentMonths} months.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Scorecard Summary Box */}
          <div
            className="rounded-2xl border border-teal-500/30 p-4"
            style={{ background: 'rgba(20, 184, 166, 0.08)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs font-semibold text-slate-400">
                    Common Skills ({settings.commonSkillsPercent}%)
                  </span>
                  <div className="text-lg font-bold text-white">
                    {calculated.commonScore} <span className="text-xs font-normal text-slate-400">/ 40</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">
                    Department KPIs ({isTeamLeader ? 40 : 60}%)
                  </span>
                  <div className="text-lg font-bold text-white">
                    {calculated.departmentScore} <span className="text-xs font-normal text-slate-400">/ {isTeamLeader ? 40 : 60}</span>
                  </div>
                </div>

                {(isTeamLeader || isHeadTech) && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400">
                      Leadership ({settings.tlLeadershipPercent}%)
                    </span>
                    <div className="text-lg font-bold text-white">
                      {calculated.leadershipScore} <span className="text-xs font-normal text-slate-400">/ 20</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-400">
                    Calculated Final Score
                  </span>
                  <div className="font-display font-tabular text-2xl text-teal-400">
                    {calculated.finalScore} <span className="text-xs font-bold text-slate-400">/ 100</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center ">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Classification
                  </span>
                  <span className="text-sm font-extrabold text-teal-300">
                    {ARABIC_CLASSIFICATIONS[calculated.classification]?.label || calculated.classification}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scoring Matrices */}
          <div className="space-y-6">
            
            {/* Section 1: Common Skills (9 KPIs, 40%) */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    1. Common Skills (40% total)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {commonKpis.length} competencies
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {commonKpis.map((kpi) => renderKpiRow(kpi))}
              </div>
            </div>

            {/* Section 2: Department Functional KPIs (60% / 40%) */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    2. {targetEmployee?.departmentName} KPIs ({isTeamLeader ? 40 : 60}% total)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {deptKpis.length} KPIs
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {deptKpis.map((kpi) => renderKpiRow(kpi))}
              </div>
            </div>

            {/* Section 3: Leadership KPIs (20% for Team Leaders / Head Tech) */}
            {(isTeamLeader || isHeadTech) && leadershipKpis.length > 0 && (
              <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Leadership and Team Development (20% total)
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {leadershipKpis.length} leadership competencies
                  </span>
                </div>

                <div className="divide-y divide-white/5">
                  {leadershipKpis.map((kpi) => renderKpiRow(kpi))}
                </div>
              </div>
            )}

          </div>

          {/* Qualitative Performance Feedback & Development Plan */}
          <div
            className="rounded-2xl border border-white/10 p-5 space-y-4"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Evaluator Notes
                </h3>
              </div>

              {!isLocked && (
                <button
                  id="btn-ai-generate-narrative"
                  type="button"
                  onClick={handleAIFeedback}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/20 px-3.5 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/30 transition-all "
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-300" />
                  {aiLoading ? 'Generating...' : 'Generate AI Notes'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Strengths and Achievements
                </label>
                <textarea
                  id="textarea-strengths"
                  rows={4}
                  disabled={isLocked}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="Record notable strengths and achievements..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-slate-500 focus:border-teal-500/60 focus:outline-none  disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Areas for Improvement
                </label>
                <textarea
                  id="textarea-improvements"
                  rows={4}
                  disabled={isLocked}
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="Record specific skills or performance areas to improve..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-slate-500 focus:border-teal-500/60 focus:outline-none  disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Development Actions
                </label>
                <textarea
                  id="textarea-actions"
                  rows={4}
                  disabled={isLocked}
                  value={developmentActions}
                  onChange={(e) => setDevelopmentActions(e.target.value)}
                  placeholder="Add milestones, training, and measurable goals..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-slate-500 focus:border-teal-500/60 focus:outline-none  disabled:opacity-60"
                />
              </div>
            </div>

            {/* Employee Acknowledgement Box (if published) */}
            {evaluation?.status === 'PUBLISHED' && isEmployeeView && (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4">
                <h4 className="text-xs font-bold text-teal-200 mb-1">
                  Employee Review and Acknowledgement
                </h4>
                <p className="text-xs text-teal-300/80 mb-2">
                  Review the evaluation above. Acknowledgement records your response with the date and time.
                </p>
                <textarea
                  id="textarea-ack-notes"
                  rows={2}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="Optional acknowledgement notes..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            )}

            {evaluation?.status === 'ACKNOWLEDGED' && (
              <div className="rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-300 border border-emerald-500/30">
                ✓ Acknowledged by <span className="font-bold">{evaluation.acknowledgedBy}</span> on{' '}
                {new Date(evaluation.acknowledgedAt || '').toLocaleString()}.
                {evaluation.acknowledgementNotes && (
                  <p className="mt-1 italic text-slate-300">"{evaluation.acknowledgementNotes}"</p>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between border-t border-white/10 px-6 py-4" style={{ background: 'rgba(10, 13, 17, 0.95)' }}>
          {saveError && (
            <div className="mb-3 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300" role="alert">
              {saveError}
            </div>
          )}
          <div className="text-xs text-slate-400">
            {isLocked
              ? 'This evaluation is locked and archived.'
              : eligibility.isEligible
              ? 'Review all KPI scores before submitting.'
              : 'Actions are disabled because the minimum tenure requirement has not been met.'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-modal-cancel"
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              Close
            </button>

            {/* Smart Analysis Button (For TL, HR, Admin, Head Tech) AFTER evaluation exists */}
            {evaluation && ['SUBMITTED_BY_TEAM_LEADER', 'HR_MANAGEMENT_APPROVED', 'PUBLISHED', 'ACKNOWLEDGED'].includes(evaluation.status) && (
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:bg-purple-500 transition-all"
              >
                <Brain className="h-3.5 w-3.5" />
                AI Recommendations
              </button>
            )}

            {/* Draft Save */}
            {!isLocked && eligibility.isEligible && (
              <button
                id="btn-save-draft"
                type="button"
                onClick={() => handleAction('DRAFT')}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-all shadow-sm disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Save as Draft'}
              </button>
            )}

            {isCurrentUserHeadTechnical && (
              <button
                id="btn-export-evaluation-pdf"
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 transition-all"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export PDF
              </button>
            )}

            {/* Team Leaders submit to the Head Of Technical; the Head completes the review. */}
            {!isLocked && eligibility.isEligible && (isCurrentUserTeamLeader || isCurrentUserHeadTechnical) && (
              <button
                id="btn-submit-evaluation"
                type="button"
                onClick={() => handleAction(isCurrentUserTeamLeader ? 'UNDER_REVIEW' : 'REVIEWED')}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 transition-all disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {isSaving
                  ? 'Submitting...'
                  : isCurrentUserTeamLeader
                  ? 'Submit To Manager'
                  : 'Submit'}
              </button>
            )}

            {/* Approve Evaluation (HR, CEO, Admin) */}
            {canApproveEvaluations() &&
              ['REVIEWED'].includes(
                evaluation?.status || ''
              ) && (
                <button
                  id="btn-approve-evaluation"
                  type="button"
                  onClick={() => handleAction('HR_MANAGEMENT_APPROVED')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 transition-all disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {isSaving ? 'Approving...' : 'Approve Evaluation'}
                </button>
              )}

            {/* Publish Evaluation (HR, Admin) */}
            {canPublishEvaluations() &&
              ['HR_MANAGEMENT_APPROVED', 'REVIEWED'].includes(
                evaluation?.status || ''
              ) && (
                <button
                  id="btn-publish-evaluation"
                  type="button"
                  onClick={() => handleAction('PUBLISHED')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isSaving ? 'Publishing...' : 'Publish to Employee'}
                </button>
              )}

            {/* Employee Acknowledge Button */}
            {evaluation?.status === 'PUBLISHED' && isEmployeeView && (
              <button
                id="btn-acknowledge-evaluation"
                type="button"
                onClick={handleAcknowledge}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500 transition-all disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {isSaving ? 'Acknowledging...' : 'Acknowledge Evaluation'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>

    {evaluation && targetEmployee && (
      <AiRecommendationsModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        employee={targetEmployee}
        evaluation={evaluation}
        onAnalysisReady={setAiRecommendations}
      />
    )}
    </>
  );

  // Helper row renderer for individual KPIs
  function renderKpiRow(kpi: KPIDefinition) {
    const currentScore = scoresState[kpi.id]?.score || 8;
    const isGuideOpen = activeGuideKpiId === kpi.id;

    return (
      <div key={kpi.id} className="p-4 hover:bg-white/5 transition-colors">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          
          {/* KPI Title & Description */}
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {kpi.name}
              </span>
              {/* Only show weight if user has permission */}
              {showWeights && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {kpi.weight}%
                </span>
              )}
              {kpi.scoringGuide && (
                <button
                  type="button"
                  onClick={() => setActiveGuideKpiId(isGuideOpen ? null : kpi.id)}
                  className="text-slate-400 hover:text-teal-400 transition-colors"
                  title="عرض دليل التقييم من 1 إلى 10"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kpi.description}
            </p>
          </div>

          {/* Score Selector (Integers 1..10) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isLocked}
                onClick={() => handleScoreChange(kpi.id, num)}
                className={`h-8 w-8 rounded-xl text-xs font-bold transition-all ${
                  currentScore === num
                    ? num >= 9
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105 border border-emerald-400'
                      : num >= 7
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30 scale-105 border border-teal-400'
                      : num >= 5
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105 border border-amber-400'
                      : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 border border-rose-400'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
                } disabled:cursor-not-allowed`}
              >
                {num}
              </button>
            ))}
          </div>

        </div>

        {/* Expandable Scoring Guide Rubric */}
        {isGuideOpen && kpi.scoringGuide && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] space-y-1 ">
            <div className="font-bold text-slate-200 mb-1">
              معيار التقييم لـ {kpi.name}:
            </div>
            <div className="text-emerald-300">
              • <span className="font-semibold">ممتاز:</span> {kpi.scoringGuide.excellent}
            </div>
            <div className="text-teal-300">
              • <span className="font-semibold">جيد:</span> {kpi.scoringGuide.good}
            </div>
            <div className="text-amber-300">
              • <span className="font-semibold">يحتاج تحسين:</span> {kpi.scoringGuide.needsImprovement}
            </div>
            <div className="text-rose-300">
              • <span className="font-semibold">ضعيف / حرج:</span> {kpi.scoringGuide.poor}
            </div>
          </div>
        )}
      </div>
    );
  }
};
