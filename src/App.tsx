import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { EvaluationsListView } from './components/EvaluationsListView';
import { EmployeesManagementView } from './components/EmployeesManagementView';
import { SettingsView } from './components/SettingsView';
import { AuditLogsView } from './components/AuditLogsView';
import { EvaluationFormModal } from './components/EvaluationFormModal';
import { AIInsightsModal } from './components/AIInsightsModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { LoginView } from './components/LoginView';
import { SetPasswordView } from './components/SetPasswordView';
import { TeamLeaderDashboard } from './components/TeamLeaderDashboard';
import { HeadTechnicalDashboard } from './components/HeadTechnicalDashboard';
import { Evaluation, Employee, EvaluationQuarter } from './types';
import { AuthorizationCapability } from './auth/authorization';

// Layout component containing Navbar, Footer, and Modals
const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [selectedEmployeeForEval, setSelectedEmployeeForEval] = useState<Employee | null>(null);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiEvalTarget, setAiEvalTarget] = useState<Evaluation | null>(null);

  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);

  const { employees, selectedQuarter } = useData();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const handleOpenEvaluationModal = (evalItem?: Evaluation, employeeId?: string, requestedQuarter?: EvaluationQuarter) => {
    if (evalItem) {
      setSelectedEvaluation(evalItem);
      setSelectedEmployeeForEval(null);
    } else if (employeeId) {
      if (!(requestedQuarter || selectedQuarter)) {
        window.alert('Please select an evaluation quarter first.');
        return;
      }
      const emp = employees.find((e) => e.id === employeeId) || null;
      setSelectedEmployeeForEval(emp);
      setSelectedEvaluation(null);
    } else {
      return;
    }
    setIsEvalModalOpen(true);
  };

  const handleOpenAIWithEvaluation = (evalItem: Evaluation) => {
    setAiEvalTarget(evalItem);
    setIsAIModalOpen(true);
  };

  const handleOpenAIInsights = () => {
    setAiEvalTarget(null);
    setIsAIModalOpen(true);
  };

  // Pass handlers via context or cloneElement? 
  // It's easier to use a Context or just render Outlet context
  return (
    <div className="min-h-screen text-slate-100 flex flex-col selection:bg-teal-500/30">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet context={{
          handleOpenEvaluationModal,
          handleOpenAIInsights,
          handleOpenAIWithEvaluation,
          handleOpenSheetsModal: () => setIsSheetsModalOpen(true)
        }} />
      </main>

      {/* Footer */}
      <footer
        className="border-t border-white/5 py-5 text-center text-xs text-slate-400"
        style={{ background: 'rgba(10, 13, 17, 0.7)' }}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium text-slate-300">
            Kesraa KPIs System
          </span>
          <span className="text-[11px] text-slate-500">
            Performance management across seven departments
          </span>
        </div>
      </footer>

      {/* Modals */}
      {isEvalModalOpen && (
        <EvaluationFormModal
          evaluation={selectedEvaluation}
          employee={selectedEmployeeForEval}
          onClose={() => {
            setIsEvalModalOpen(false);
            setSelectedEvaluation(null);
            setSelectedEmployeeForEval(null);
          }}
          onSaved={() => {
            setIsEvalModalOpen(false);
            setSelectedEvaluation(null);
            setSelectedEmployeeForEval(null);
          }}
        />
      )}

      {isAIModalOpen && (
        <AIInsightsModal
          initialEvaluation={aiEvalTarget}
          onClose={() => {
            setIsAIModalOpen(false);
            setAiEvalTarget(null);
          }}
        />
      )}

      {isSheetsModalOpen && (
        <GoogleSheetsModal onClose={() => setIsSheetsModalOpen(false)} />
      )}
    </div>
  );
};

// A helper wrapper for route components to access layout handlers
const RouteWrapper: React.FC<{ component: React.FC<any> }> = ({ component: Component }) => {
  const context: any = useOutletContext();
  return <Component 
    onSelectEvaluation={(e: any) => context.handleOpenEvaluationModal(e)}
    onNewEvaluation={(id: string, quarter: EvaluationQuarter) => context.handleOpenEvaluationModal(undefined, id, quarter)}
    onOpenAIInsights={context.handleOpenAIInsights}
    onAnalyzeWithAI={(e: any) => context.handleOpenAIWithEvaluation(e)}
    onOpenGoogleSheets={context.handleOpenSheetsModal}
    onStartEvaluation={(id: any) => context.handleOpenEvaluationModal(undefined, id)}
    onViewEvaluation={(e: any) => context.handleOpenEvaluationModal(e)} // For TeamLeaderDashboard
  />;
};

const CapabilityRoute: React.FC<{
  capability: AuthorizationCapability;
  children: React.ReactNode;
}> = ({ capability, children }) => {
  const { hasCapability } = useAuth();
  return hasCapability(capability) ? <>{children}</> : <Navigate to="/" replace />;
};

// Smart Redirector for the root path
const RootRedirector: React.FC = () => {
  const { isAuthenticated, currentUser } = useAuth();
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (['ADMIN', 'HR'].includes(currentUser.systemRole)) return <Navigate to="/admin/dashboard" replace />;
  if (currentUser.systemRole === 'CEO') return <Navigate to="/ceo/dashboard" replace />;
  if (currentUser.systemRole === 'HEAD_TECHNICAL') return <Navigate to="/head-technical/dashboard" replace />;
  if (currentUser.systemRole === 'AI_ENGINEER') return <Navigate to="/ai-engineer/dashboard" replace />;
  if (currentUser.systemRole === 'TEAM_LEADER') return <Navigate to="/team-leader/my-team" replace />;
  return <Navigate to="/employee/evaluations" replace />;
};

// Login Route wrapper to redirect if already logged in
const LoginRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <RootRedirector />;
  }
  return <LoginView />;
};

const AppRoutes: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-semibold text-slate-300">
        Verifying session...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/auth/setup-password" element={<SetPasswordView />} />
      <Route path="/" element={<RootRedirector />} />
      
      <Route element={<AppLayout />}>
        {/* Admin / HR Routes */}
        <Route path="/admin">
          <Route path="dashboard" element={<RouteWrapper component={DashboardView} />} />
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
          <Route path="employees" element={<RouteWrapper component={EmployeesManagementView} />} />
          <Route path="settings" element={<RouteWrapper component={SettingsView} />} />
          <Route path="audit" element={<RouteWrapper component={AuditLogsView} />} />
        </Route>

        {/* CEO Routes */}
        <Route path="/ceo">
          <Route path="dashboard" element={<RouteWrapper component={DashboardView} />} />
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
          <Route path="audit" element={<RouteWrapper component={AuditLogsView} />} />
        </Route>

        {/* Head Technical Routes */}
        <Route path="/head-technical">
          <Route path="dashboard" element={<RouteWrapper component={HeadTechnicalDashboard} />} />
          <Route path="analytics" element={<RouteWrapper component={DashboardView} />} />
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
          <Route path="employees" element={<RouteWrapper component={EmployeesManagementView} />} />
          <Route
            path="settings"
            element={(
              <CapabilityRoute capability="MANAGE_SETTINGS">
                <RouteWrapper component={SettingsView} />
              </CapabilityRoute>
            )}
          />
          <Route
            path="audit"
            element={(
              <CapabilityRoute capability="VIEW_AUDIT_LOGS">
                <RouteWrapper component={AuditLogsView} />
              </CapabilityRoute>
            )}
          />
        </Route>

        {/* AI Engineer uses the technical-review workspace without receiving ADMIN. */}
        <Route path="/ai-engineer">
          <Route path="dashboard" element={<RouteWrapper component={HeadTechnicalDashboard} />} />
          <Route path="analytics" element={<RouteWrapper component={DashboardView} />} />
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
          <Route path="employees" element={<RouteWrapper component={EmployeesManagementView} />} />
        </Route>

        {/* Team Leader Routes */}
        <Route path="/team-leader">
          <Route path="my-team" element={<RouteWrapper component={TeamLeaderDashboard} />} />
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
        </Route>

        {/* Employee Routes */}
        <Route path="/employee">
          <Route path="evaluations" element={<RouteWrapper component={EvaluationsListView} />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
