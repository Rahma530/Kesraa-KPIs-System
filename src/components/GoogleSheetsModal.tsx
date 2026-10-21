import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Code,
  Loader2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { isAccountAdministrator } from '../auth/authorization';
import {
  EmployeeManagementService,
  generateEmployeesCsv,
  ManagedEmployee,
  parseEmployeeImportCsv,
} from '../services/employeeManagementService';

interface GoogleSheetsModalProps {
  onClose: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ onClose }) => {
  const { evaluations, selectedQuarter, selectedYear, refreshEmployees } = useData();
  const { currentUser, hasCapability } = useAuth();
  const canManageEmployees = hasCapability('MANAGE_EMPLOYEES');
  const canImportEmployees = isAccountAdministrator(currentUser);

  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [csvInput, setCsvInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [authoritativeEmployees, setAuthoritativeEmployees] = useState<ManagedEmployee[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rosterError, setRosterError] = useState('');

  const loadAuthoritativeRoster = useCallback(async () => {
    if (!canManageEmployees) return [];
    setIsRosterLoading(true);
    setRosterError('');
    try {
      const roster = await EmployeeManagementService.list();
      setAuthoritativeEmployees(roster.employees);
      return roster.employees;
    } catch (error) {
      setAuthoritativeEmployees([]);
      const message = error instanceof Error ? error.message : 'Could not load the Supabase employee roster.';
      setRosterError(message);
      throw error;
    } finally {
      setIsRosterLoading(false);
    }
  }, [canManageEmployees]);

  useEffect(() => {
    if (canManageEmployees) void loadAuthoritativeRoster().catch(() => undefined);
  }, [canManageEmployees, loadAuthoritativeRoster]);

  // Helper to convert evaluations to CSV
  const generateEvaluationsCSV = () => {
    const headers = [
      'Evaluation ID', 'Employee Name', 'Department', 'Role', 'Level', 'Quarter', 'Year',
      'Common Skills (40)', 'Department Score (60/40)', 'Leadership Score (20)',
      'Final Score (100)', 'Classification', 'Department Rank', 'Status', 'Evaluator', 'Version',
    ];

    const rows = evaluations.map((e) => [
      e.id,
      `"${e.employeeName}"`,
      `"${e.departmentName}"`,
      `"${e.role}"`,
      `"${e.level}"`,
      e.quarter,
      e.year,
      e.commonScore,
      e.departmentScore,
      e.leadershipScore || 0,
      e.finalScore,
      `"${e.classification}"`,
      e.departmentRank || '',
      e.status,
      `"${e.evaluatorName}"`,
      e.version,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const handleDownloadEvaluations = () => {
    const csv = generateEvaluationsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Performance_Evaluations_${selectedQuarter}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEmployees = async () => {
    try {
      const latestEmployees = await loadAuthoritativeRoster();
      const csv = generateEmployeesCsv(latestEmployees);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Company_Employees_Roster_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // The authoritative loading error is displayed in the modal.
    }
  };

  const handleImportCSV = async () => {
    if (!csvInput.trim() || !canImportEmployees || isImporting) return;
    const parsed = parseEmployeeImportCsv(csvInput);
    if (parsed.errors.length > 0) {
      setImportStatus({
        success: false,
        message: parsed.errors.slice(0, 8).join(' '),
      });
      return;
    }

    setIsImporting(true);
    try {
      const result = await EmployeeManagementService.import(parsed.rows);
      const issueDetails = [...result.skipped, ...result.failed]
        .slice(0, 6)
        .map((item) => `Row ${item.rowNumber}: ${item.reason}`)
        .join(' ');
      setImportStatus({
        success: result.failed.length === 0,
        message: `${result.successful.length} saved, ${result.skipped.length} skipped, ${result.failed.length} failed.${issueDetails ? ` ${issueDetails}` : ''}`,
      });
      if (result.successful.length > 0) {
        setCsvInput('');
        await Promise.all([loadAuthoritativeRoster(), refreshEmployees()]);
      }
    } catch (error) {
      setImportStatus({
        success: false,
        message: error instanceof Error ? error.message : 'CSV import failed.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const syncAppScriptExample = `// Google Apps Script for 2-way Performance Evaluation Sync
function syncEvaluationsToSheet() {
  var url = "${window.location.origin}/api/evaluations?quarter=${selectedQuarter}&year=${selectedYear}";
  var response = UrlFetchApp.fetch(url);
  var json = JSON.parse(response.getContentText());
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Format columns and append live scorecard snapshot
  sheet.clear();
  sheet.appendRow(["ID", "Name", "Department", "Role", "Level", "Final Score", "Classification", "Status"]);
  
  json.evaluations.forEach(function(item) {
    sheet.appendRow([item.id, item.employeeName, item.departmentName, item.role, item.level, item.finalScore, item.classification, item.status]);
  });
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(10, 13, 17, 0.85)' }}>
      <div
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 my-8 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden"
        style={{ background: 'rgba(10, 13, 17, 0.95)' }}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-white text-base">
                CSV Import / Export
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation (Frosted Pills) */}
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-3" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'EXPORT'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          {canImportEmployees && (
            <button
              onClick={() => setActiveTab('IMPORT')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'IMPORT'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          
          {importStatus && (
            <div
              className={`rounded-2xl border p-4 font-semibold flex items-center gap-2 ${
                importStatus.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              {importStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
              {importStatus.message}
            </div>
          )}

          {activeTab === 'EXPORT' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-3"
                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
              >
                <h3 className="font-bold text-white text-sm">
                  Evaluation Results
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Export evaluation results for <strong className="text-emerald-400">{selectedQuarter} {selectedYear}</strong>.
                </p>
                <button
                  id="btn-export-evals-csv"
                  onClick={handleDownloadEvaluations}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-2 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
                >
                  <Download className="h-4 w-4" />
                  Download Evaluations CSV ({evaluations.length})
                </button>
              </div>

              {canManageEmployees && (
                <div
                  className="rounded-2xl border border-white/10 p-5 space-y-3"
                  style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <h3 className="font-bold text-white text-sm">
                    Employee Directory
                  </h3>
                  <p className="text-slate-300 leading-relaxed">
                    Export the latest authorized employee roster directly from Supabase.
                  </p>
                  {rosterError && <p className="text-rose-300">{rosterError}</p>}
                  <button
                    id="btn-export-employees-csv"
                    onClick={() => void handleDownloadEmployees()}
                    disabled={isRosterLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
                  >
                    {isRosterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isRosterLoading ? 'Loading Supabase roster...' : `Download Employees CSV (${authoritativeEmployees.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'IMPORT' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-3"
                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
              >
                <h3 className="font-bold text-white text-sm">
                  Paste Employee CSV Data
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Include a header row with: <code>Name, Email, Department ID, Job Title, Level, Start Date</code>.
                  Optional columns are <code>Employee ID, Phone, System Role</code>.
                </p>

                <textarea
                  rows={6}
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder={`Name,Email,Department ID,Job Title,Level,Start Date,System Role\nJordan Pierce,jordan.p@company.com,dept-cr,Senior Designer,Senior,2023-05-12,EMPLOYEE`}
                  className="w-full font-mono rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none"
                />

                <div className="flex justify-end">
                  <button
                    id="btn-submit-csv-import"
                    onClick={() => void handleImportCSV()}
                    disabled={!csvInput.trim() || isImporting}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-2 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-white/10 px-6 py-4" style={{ background: 'rgba(10, 13, 17, 0.95)' }}>
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
