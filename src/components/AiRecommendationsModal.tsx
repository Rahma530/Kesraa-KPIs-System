import React, { useState, useEffect } from 'react';
import { X, Brain, Target, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { Employee, Evaluation, EvaluationAIRecommendations } from '../types';
import { AiService, AiAnalysisResult } from '../services/aiService';

interface AiRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  evaluation: Evaluation;
  onAnalysisReady?: (analysis: EvaluationAIRecommendations) => void;
}

export const AiRecommendationsModal: React.FC<AiRecommendationsModalProps> = ({
  isOpen,
  onClose,
  employee,
  evaluation,
  onAnalysisReady,
}) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      AiService.analyzeEmployeePerformance(employee, evaluation)
        .then((result) => {
          if (result) {
            setAnalysis(result);
            onAnalysisReady?.({
              ...result,
              generatedAt: new Date().toISOString(),
            });
          } else {
            setError('Unable to generate the analysis. Please check the AI configuration.');
          }
        })
        .catch((err) => {
          console.error(err);
          setError('An error occurred while contacting the AI service.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, employee, evaluation, onAnalysisReady]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Brain className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Performance Analysis</h2>
              <p className="text-sm text-slate-400">Performance analysis for {employee.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
              <p className="text-indigo-300 font-medium animate-pulse">Analyzing performance data and preparing recommendations...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex flex-col items-center text-center">
              <AlertTriangle className="h-10 w-10 mb-2" />
              <p>{error}</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-lg text-slate-200 leading-relaxed font-medium">
                  {analysis.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 space-x-reverse text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                    <h3 className="font-bold text-lg">Key Strengths</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.strengths.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 space-x-reverse text-slate-300 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                        <span className="text-emerald-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 space-x-reverse text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="font-bold text-lg">Development Gaps</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.weaknesses.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 space-x-reverse text-slate-300 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                        <span className="text-amber-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Plan */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center space-x-2 space-x-reverse text-indigo-400 border-b border-indigo-500/20 pb-2">
                  <Target className="h-5 w-5" />
                  <h3 className="font-bold text-xl">Recommended Action Plan</h3>
                </div>
                <div className="grid gap-3 mt-4">
                  {analysis.actionPlan.map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-4 space-x-reverse bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-slate-200">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
