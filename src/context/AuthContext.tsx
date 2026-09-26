import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { AdditionalSystemPermission, Employee, EmployeeLevel, Evaluation, SystemRole } from '../types';
import { StorageService } from '../services/storageService';
import { supabase } from '../lib/supabase';
import { isEvaluableEmployee } from '../utils/departmentNames';
import {
  AuthorizationCapability,
  hasAuthorizationCapability,
  isTechnicalReviewer as isTechnicalReviewerEmployee,
  VALID_ADDITIONAL_PERMISSIONS,
} from '../auth/authorization';

export interface AuthContextType {
  currentUser: Employee | null;
  allUsers: Employee[];
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
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
  auth_user_id: string | null;
  account_enabled: boolean;
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
  const authUserId = authUser.id;
  const { data: profileData, error: profileError } = await supabase
    .from('employees')
    .select('id,name,email,phone,department_id,level,system_role,start_date,created_at,updated_at,auth_user_id,account_enabled')
    .eq('auth_user_id', authUserId)
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
  if (!SYSTEM_ROLES.includes(profile.system_role as SystemRole)) {
    throw new EmployeeProfileError('Your employee profile has an unsupported system role.');
  }
  if (!EMPLOYEE_LEVELS.includes(profile.level as EmployeeLevel)) {
    throw new EmployeeProfileError('Your employee profile has an unsupported employee level.');
  }

  const [{ data: departmentData, error: departmentError }, cachedEmployees] = await Promise.all([
    supabase.from('departments').select('id,name').eq('id', profile.department_id).maybeSingle(),
    Promise.resolve(StorageService.getEmployees()),
  ]);
  if (departmentError) {
    throw new EmployeeProfileError(`Could not load your department profile: ${departmentError.message}`);
  }

  const cached = cachedEmployees.find((employee) => employee.id === profile.id);
  const now = new Date().toISOString();
  const systemRole = profile.system_role as SystemRole;

  return {
    id: profile.id,
    authUserId: profile.auth_user_id || authUserId,
    accountEnabled: true,
    additionalPermissions: getAdditionalPermissions(authUser),
    name: profile.name,
    email: profile.email,
    phone: profile.phone || cached?.phone,
    departmentId: profile.department_id,
    departmentName: departmentData?.name || cached?.departmentName || profile.department_id,
    role: cached?.role || systemRole.replaceAll('_', ' '),
    level: profile.level as EmployeeLevel,
    teamLeaderId: cached?.teamLeaderId,
    teamLeaderName: cached?.teamLeaderName,
    startDate: profile.start_date,
    isActive: true,
    isHeadTechnical: systemRole === 'HEAD_TECHNICAL',
    systemRole,
    salary: cached?.salary,
    avatarUrl: cached?.avatarUrl,
    createdAt: profile.created_at || cached?.createdAt || now,
    updatedAt: profile.updated_at || cached?.updatedAt || now,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<Employee[]>([]);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

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
    StorageService.initialize();
    localStorage.removeItem(LEGACY_CURRENT_USER_KEY);
    setAllUsers(StorageService.getEmployees());

    const rejectUnusableSession = async (error: unknown) => {
      if (!mounted) return;
      clearAuthenticatedProfile();
      setAuthError(error instanceof Error ? error.message : 'Could not verify your employee account.');
      await supabase.auth.signOut();
    };

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (mounted) setAuthError(`Could not restore your session: ${error.message}`);
        clearAuthenticatedProfile();
        return;
      }
      if (!data.session) {
        clearAuthenticatedProfile();
        return;
      }
      try {
        await loadAuthenticatedProfile(data.session.user);
        if (mounted) setAuthError('');
      } catch (profileError) {
        await rejectUnusableSession(profileError);
      }
    };

    void restoreSession().finally(() => {
      if (mounted) setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        clearAuthenticatedProfile();
        setIsLoading(false);
        return;
      }

      window.setTimeout(() => {
        if (!mounted) return;
        void loadAuthenticatedProfile(session.user)
          .then(() => {
            if (mounted) setAuthError('');
          })
          .catch(rejectUnusableSession)
          .finally(() => {
            if (mounted) setIsLoading(false);
          });
      }, 0);
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
        allUsers,
        isAuthenticated,
        isLoading,
        authError,
        login,
        logout,
        clearAuthError: () => setAuthError(''),
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
