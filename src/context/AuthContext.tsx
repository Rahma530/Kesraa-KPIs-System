import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthChangeEvent, User } from '@supabase/supabase-js';
import { AdditionalSystemPermission, Employee, EmployeeLevel, Evaluation, SystemRole } from '../types';
import { initialPasswordSetupCallback, supabase } from '../lib/supabase';
import { isEvaluableEmployee } from '../utils/departmentNames';
import {
  AuthorizationCapability,
  hasAuthorizationCapability,
  isTechnicalReviewer as isTechnicalReviewerEmployee,
  VALID_ADDITIONAL_PERMISSIONS,
} from '../auth/authorization';

export interface AuthContextType {
  currentUser: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordSetupFlow: boolean;
  hasPasswordSetupSession: boolean;
  passwordSetupError: string;
  authError: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  finishPasswordSetup: () => void;
  canManageSettings: () => boolean;
  canManageEmployees: () => boolean;
  canApproveEvaluations: () => boolean;
  canPublishEvaluations: () => boolean;
  canEvaluateEmployee: (target: Employee) => boolean;
  canViewEvaluation: (evaluation: Evaluation) => boolean;
  canViewKPIWeights: () => boolean;
  isExecutiveOrAdmin: () => boolean;
  hasCapability: (capability: AuthorizationCapability) => boolean;
  isTechnicalReviewer: () => boolean;
}

interface EmployeeProfileRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  department_id: string;
  level: string;
  system_role: string;
  start_date: string;
  created_at?: string | null;
  updated_at?: string | null;
  account_enabled: boolean;
  job_title?: string | null;
  employment_active?: boolean | null;
}

const SYSTEM_ROLES: SystemRole[] = [
  'ADMIN',
  'HR',
  'CEO',
  'TEAM_LEADER',
  'HEAD_TECHNICAL',
  'AI_ENGINEER',
  'EMPLOYEE',
];
const EMPLOYEE_LEVELS: EmployeeLevel[] = ['Junior', 'Mid', 'Senior', 'Team Leader'];
const LEGACY_CURRENT_USER_KEY = 'pes_active_user_id';

class EmployeeProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmployeeProfileError';
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAdditionalPermissions = (user: User): AdditionalSystemPermission[] => {
  const metadataPermissions = user.app_metadata?.additional_permissions;
  if (!Array.isArray(metadataPermissions)) return [];
  return metadataPermissions.filter(
    (permission): permission is AdditionalSystemPermission =>
      typeof permission === 'string' &&
      VALID_ADDITIONAL_PERMISSIONS.includes(permission as AdditionalSystemPermission)
  );
};

const resolveEmployeeProfile = async (authUser: User): Promise<Employee> => {
  const { data: profileData, error: profileError } = await supabase
    .from('employees')
    .select('id,name,email,phone,department_id,level,system_role,start_date,created_at,updated_at,account_enabled,job_title,employment_active')
    .maybeSingle();

  if (profileError) {
    throw new EmployeeProfileError(`Could not load your employee profile: ${profileError.message}`);
  }
  if (!profileData) {
    throw new EmployeeProfileError(
      'Your signed-in account is not linked to an employee profile. Contact an administrator.'
    );
  }

  const profile = profileData as EmployeeProfileRow;
  if (profile.account_enabled !== true) {
    throw new EmployeeProfileError('Your employee account is disabled. Contact an administrator.');
  }
  if (profile.employment_active === false) {
    throw new EmployeeProfileError('Your employment profile is inactive. Contact an administrator.');
  }
  if (!SYSTEM_ROLES.includes(profile.system_role as SystemRole)) {
    throw new EmployeeProfileError('Your employee profile has an unsupported system role.');
  }
  if (!EMPLOYEE_LEVELS.includes(profile.level as EmployeeLevel)) {
    throw new EmployeeProfileError('Your employee profile has an unsupported employee level.');
  }

  const { data: departmentData, error: departmentError } = await supabase
    .from('departments')
    .select('id,name')
    .eq('id', profile.department_id)
    .maybeSingle();
  if (departmentError) {
    throw new EmployeeProfileError(`Could not load your department profile: ${departmentError.message}`);
  }

  const now = new Date().toISOString();
  const systemRole = profile.system_role as SystemRole;

  return {
    id: profile.id,
    accountEnabled: true,
    additionalPermissions: getAdditionalPermissions(authUser),
    name: profile.name,
    email: profile.email,
    phone: profile.phone || undefined,
    departmentId: profile.department_id,
    departmentName: departmentData?.name || profile.department_id,
    role: profile.job_title || systemRole.replaceAll('_', ' '),
    level: profile.level as EmployeeLevel,
    startDate: profile.start_date,
    isActive: true,
    isHeadTechnical: systemRole === 'HEAD_TECHNICAL',
    systemRole,
    createdAt: profile.created_at || now,
    updatedAt: profile.updated_at || now,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordSetupFlow, setIsPasswordSetupFlow] = useState(
    initialPasswordSetupCallback.isDetected
  );
  const [hasPasswordSetupSession, setHasPasswordSetupSession] = useState(false);
  const [passwordSetupError, setPasswordSetupError] = useState(
    initialPasswordSetupCallback.error
  );
  const [authError, setAuthError] = useState('');
  const passwordSetupFlowRef = useRef(isPasswordSetupFlow);

  const updatePasswordSetupFlow = (active: boolean) => {
    passwordSetupFlowRef.current = active;
    setIsPasswordSetupFlow(active);
    if (!active) {
      setHasPasswordSetupSession(false);
      setPasswordSetupError('');
    }
  };

  const clearAuthenticatedProfile = () => {
    setCurrentUser(null);
  };

  const loadAuthenticatedProfile = async (authUser: User) => {
    const employee = await resolveEmployeeProfile(authUser);
    setCurrentUser(employee);
    return employee;
  };

  useEffect(() => {
    let mounted = true;
    localStorage.removeItem(LEGACY_CURRENT_USER_KEY);

    const rejectUnusableSession = async (error: unknown) => {
      if (!mounted) return;
      clearAuthenticatedProfile();
      setAuthError(error instanceof Error ? error.message : 'Could not verify your employee account.');
      await supabase.auth.signOut();
    };

    const handleAuthSession = async (event: AuthChangeEvent, session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      const isSetupEvent = event === 'PASSWORD_RECOVERY' || passwordSetupFlowRef.current;
      if (isSetupEvent) {
        const callbackFailed = Boolean(initialPasswordSetupCallback.error);
        updatePasswordSetupFlow(true);
        setHasPasswordSetupSession(Boolean(session) && !callbackFailed);
        if (session && !callbackFailed) setPasswordSetupError('');
        clearAuthenticatedProfile();
        if (mounted) setIsLoading(false);
        return;
      }

      if (!session) {
        clearAuthenticatedProfile();
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        await loadAuthenticatedProfile(session.user);
        if (mounted) setAuthError('');
      } catch (profileError) {
        await rejectUnusableSession(profileError);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      window.setTimeout(() => {
        if (!mounted) return;
        void handleAuthSession(event, session);
      }, 0);
    });

    const restoreSession = async () => {
      const { error: initializationError } = await supabase.auth.initialize();
      if (initializationError) {
        if (mounted && passwordSetupFlowRef.current) {
          setPasswordSetupError(
            initialPasswordSetupCallback.error ||
              `Could not process this authentication link: ${initializationError.message}`
          );
          setHasPasswordSetupSession(false);
          clearAuthenticatedProfile();
        } else if (mounted) {
          setAuthError(`Could not initialize authentication: ${initializationError.message}`);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (mounted && passwordSetupFlowRef.current) {
          setPasswordSetupError(`Could not process this authentication link: ${error.message}`);
        } else if (mounted) {
          setAuthError(`Could not restore your session: ${error.message}`);
        }
        clearAuthenticatedProfile();
        if (passwordSetupFlowRef.current) setHasPasswordSetupSession(false);
        return;
      }
      await handleAuthSession('INITIAL_SESSION', data.session);
    };

    void restoreSession().finally(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Incorrect email address or password.');
    }

    try {
      await loadAuthenticatedProfile(data.user);
    } catch (profileError) {
      await supabase.auth.signOut();
      const message = profileError instanceof Error
        ? profileError.message
        : 'Could not verify your employee account.';
      setAuthError(message);
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    clearAuthenticatedProfile();
    if (error) {
      setAuthError(`Could not complete sign out: ${error.message}`);
      throw new Error(`Could not complete sign out: ${error.message}`);
    }
    setAuthError('');
  };

  const isAuthenticated = currentUser !== null;

  const hasCapability = (capability: AuthorizationCapability): boolean =>
    hasAuthorizationCapability(currentUser, capability);

  const isTechnicalReviewer = (): boolean => isTechnicalReviewerEmployee(currentUser);

  const canManageSettings = (): boolean => {
    return hasCapability('MANAGE_SETTINGS');
  };

  const canManageEmployees = (): boolean => {
    return hasCapability('MANAGE_EMPLOYEES');
  };

  const canApproveEvaluations = (): boolean => {
    return hasCapability('APPROVE_EVALUATIONS');
  };

  const canPublishEvaluations = (): boolean => {
    return hasCapability('PUBLISH_EVALUATIONS');
  };

  const canEvaluateEmployee = (target: Employee): boolean => {
    if (!currentUser || !currentUser.isActive) return false;
    if (!isEvaluableEmployee(target)) return false;
    if (currentUser.id === target.id) return false;
    if (hasCapability('EVALUATE_ALL_EMPLOYEES')) return true;
    if (currentUser.systemRole === 'TEAM_LEADER') {
      return currentUser.departmentId === target.departmentId;
    }
    return false;
  };

  const canViewEvaluation = (evalItem: Evaluation): boolean => {
    if (!currentUser) return false;
    if (hasCapability('VIEW_ALL_EVALUATIONS')) return true;
    if (currentUser.systemRole === 'TEAM_LEADER') {
      return currentUser.departmentId === evalItem.departmentId;
    }
    return false;
  };

  const canViewKPIWeights = (): boolean => {
    return hasCapability('VIEW_KPI_WEIGHTS');
  };

  const isExecutiveOrAdmin = (): boolean => {
    return hasCapability('VIEW_EXECUTIVE_DASHBOARD');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        isPasswordSetupFlow,
        hasPasswordSetupSession,
        passwordSetupError,
        authError,
        login,
        logout,
        clearAuthError: () => setAuthError(''),
        finishPasswordSetup: () => updatePasswordSetupFlow(false),
        canManageSettings,
        canManageEmployees,
        canApproveEvaluations,
        canPublishEvaluations,
        canEvaluateEmployee,
        canViewEvaluation,
        canViewKPIWeights,
        isExecutiveOrAdmin,
        hasCapability,
        isTechnicalReviewer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
