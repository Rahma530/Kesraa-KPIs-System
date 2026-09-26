import { Evaluation, EvaluationStatus, KPICategory } from '../types';

const STATUS_LABELS: Record<EvaluationStatus, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Head Of Technical Review',
  APPROVED: 'Approved',
};

const CATEGORY_LABELS: Record<KPICategory, string> = {
  COMMON: 'Common Skills',
  DEPARTMENT: 'Department KPIs',
  LEADERSHIP: 'Leadership',
  MANAGEMENT: 'Management',
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDate = (value?: string): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString('en-GB');
};

const textBlock = (value: string): string =>
  `<div class="text-block">${escapeHtml(value).replace(/\n/g, '<br />')}</div>`;

const listItems = (items: string[]): string =>
  items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

export const printEvaluationReport = (evaluation: Evaluation): boolean => {
  const reportWindow = window.open('', '_blank', 'width=980,height=760');
  if (!reportWindow) return false;
  reportWindow.opener = null;

  const groupedScores = evaluation.scores.reduce<Record<string, typeof evaluation.scores>>(
    (groups, score) => {
      (groups[score.category] ||= []).push(score);
      return groups;
    },
    {}
  );

  const kpiSections = Object.entries(groupedScores)
    .map(([category, scores]) => `
      <section class="section avoid-break">
        <h3>${CATEGORY_LABELS[category as KPICategory] || escapeHtml(category)}</h3>
        <table>
          <thead><tr><th>KPI</th><th>Score</th><th>Contribution</th><th>Notes</th></tr></thead>
          <tbody>
            ${scores.map((score) => `
              <tr>
                <td>${escapeHtml(score.kpiName)}</td>
                <td>${score.score}/10</td>
                <td>${score.weightedContribution.toFixed(2)}</td>
                <td>${score.notes ? escapeHtml(score.notes) : '-'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>`)
    .join('');

  const hasEvaluatorNotes = Boolean(
    evaluation.strengths || evaluation.improvements || evaluation.developmentActions ||
    evaluation.scores.some((score) => score.notes)
  );
  const ai = evaluation.aiRecommendations;

  reportWindow.document.write(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8" />
    <title>${escapeHtml(evaluation.employeeName)} - Evaluation Report</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #172033; font: 12px/1.5 Arial, "Segoe UI", sans-serif; background: #fff; }
      .page { max-width: 900px; margin: 0 auto; }
      .header { border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 20px; }
      .brand { font-size: 24px; font-weight: 800; color: #0f766e; }
      .subtitle { color: #64748b; margin-top: 3px; }
      .meta { text-align: right; color: #475569; }
      .section { margin: 0 0 18px; }
      h2 { margin: 0 0 10px; color: #0f766e; font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
      h3 { margin: 0 0 8px; color: #334155; font-size: 13px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; }
      .field { padding: 7px 9px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
      .label { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      .value { font-weight: 700; color: #1e293b; }
      .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .score { text-align: center; padding: 12px 8px; border-radius: 8px; background: #f0fdfa; border: 1px solid #99f6e4; }
      .score strong { display: block; color: #0f766e; font-size: 20px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; }
      th:nth-child(1) { width: 32%; } th:nth-child(2) { width: 12%; } th:nth-child(3) { width: 15%; }
      .notes-grid { display: grid; grid-template-columns: 1fr; gap: 9px; }
      .note-card { border: 1px solid #e2e8f0; border-radius: 7px; padding: 10px; }
      .note-card h3 { color: #0f766e; }
      .text-block { white-space: normal; overflow-wrap: anywhere; }
      ul { margin: 4px 0 0; padding-left: 20px; }
      .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body><main class="page">
      <header class="header">
        <div><div class="brand">Kesraa KPIs System</div><div class="subtitle">Employee Performance Evaluation Report</div></div>
        <div class="meta"><strong>${escapeHtml(evaluation.quarter)} ${evaluation.year}</strong><br />Generated ${formatDate(new Date().toISOString())}</div>
      </header>

      <section class="section avoid-break"><h2>Employee Information</h2><div class="grid">
        <div class="field"><span class="label">Name</span><span class="value">${escapeHtml(evaluation.employeeName)}</span></div>
        <div class="field"><span class="label">Department</span><span class="value">${escapeHtml(evaluation.departmentName)}</span></div>
        <div class="field"><span class="label">Role</span><span class="value">${escapeHtml(evaluation.role)} (${escapeHtml(evaluation.level)})</span></div>
        <div class="field"><span class="label">Evaluation Period</span><span class="value">${escapeHtml(evaluation.quarter)} ${evaluation.year}</span></div>
        <div class="field"><span class="label">Evaluator</span><span class="value">${escapeHtml(evaluation.evaluatorName)} - ${escapeHtml(evaluation.evaluatorRole)}</span></div>
        <div class="field"><span class="label">Evaluation Date</span><span class="value">${formatDate(evaluation.updatedAt || evaluation.createdAt)}</span></div>
        <div class="field"><span class="label">Status</span><span class="value">${STATUS_LABELS[evaluation.status]}</span></div>
        <div class="field"><span class="label">Classification</span><span class="value">${escapeHtml(evaluation.classification)}</span></div>
      </div></section>

      <section class="section avoid-break"><h2>Evaluation Results</h2><div class="score-grid">
        <div class="score"><span>Common Skills</span><strong>${evaluation.commonScore}</strong></div>
        <div class="score"><span>Department KPIs</span><strong>${evaluation.departmentScore}</strong></div>
        <div class="score"><span>Leadership</span><strong>${evaluation.leadershipScore || 0}</strong></div>
        <div class="score"><span>Overall Score</span><strong>${evaluation.finalScore}/100</strong></div>
      </div></section>

      <section class="section"><h2>KPI Breakdown</h2>${kpiSections || '<p>No KPI scores are available.</p>'}</section>

      ${hasEvaluatorNotes ? `<section class="section avoid-break"><h2>Evaluator Notes</h2><div class="notes-grid">
        ${evaluation.strengths ? `<div class="note-card"><h3>Strengths and Achievements</h3>${textBlock(evaluation.strengths)}</div>` : ''}
        ${evaluation.improvements ? `<div class="note-card"><h3>Areas for Improvement</h3>${textBlock(evaluation.improvements)}</div>` : ''}
        ${evaluation.developmentActions ? `<div class="note-card"><h3>Development Actions</h3>${textBlock(evaluation.developmentActions)}</div>` : ''}
      </div></section>` : ''}

      ${ai ? `<section class="section avoid-break"><h2>AI Recommendations</h2>
        <div class="note-card"><h3>Summary</h3>${textBlock(ai.summary)}</div>
        ${ai.strengths.length ? `<div class="note-card"><h3>Strengths</h3><ul>${listItems(ai.strengths)}</ul></div>` : ''}
        ${ai.weaknesses.length ? `<div class="note-card"><h3>Development Gaps</h3><ul>${listItems(ai.weaknesses)}</ul></div>` : ''}
        ${ai.actionPlan.length ? `<div class="note-card"><h3>Recommended Action Plan</h3><ol>${listItems(ai.actionPlan)}</ol></div>` : ''}
      </section>` : ''}

      <footer class="footer"><span>Kesraa KPIs System</span><span>Evaluation ID: ${escapeHtml(evaluation.id)}</span></footer>
    </main></body></html>`);
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => reportWindow.print(), 300);
  return true;
};
