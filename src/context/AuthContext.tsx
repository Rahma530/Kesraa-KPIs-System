import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee, SystemRole, Evaluation } from '../types';
import { StorageService } from '../services/storageService';
import { isEvaluableEmployee } from '../utils/departmentNames';

export interface AuthContextType {
  currentUser: Employee | null;
  allUsers: Employee[];
  isAuthenticated: boolean;
  login: (email: string, password?: string) => void;
  logout: () => void;
  canManageSettings: () => boolean;
  canManageEmployees: () => boolean;
  canApproveEvaluations: () => boolean;
  canPublishEvaluations: () => boolean;
  canEvaluateEmployee: (target: Employee) => boolean;
  canViewEvaluation: (evaluation: Evaluation) => boolean;
  canViewKPIWeights: () => boolean;
  isExecutiveOrAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = 'pes_active_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<Employee[]>([]);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    StorageService.initialize();
    const employees = StorageService.getEmployees();
    setAllUsers(employees);

    const savedUserId = localStorage.getItem(CURRENT_USER_KEY);
    const matched = employees.find((e) => e.id === savedUserId);

    if (matched) {
      setCurrentUser(matched);
      setIsAuthenticated(true);
    }
  }, []);

  const login = (email: string, password?: string) => {
    const fresh = StorageService.getEmployees();
    setAllUsers(fresh);
    // Find user by email (case insensitive)
    const cleanEmail = email.trim().toLowerCase();
    const selected = fresh.find((e) => e.email.toLowerCase() === cleanEmail);
    
    // Check if user exists and password matches
    const expectedPassword = selected?.password || '123456';
    const cleanPassword = password?.trim();
    if (selected && cleanPassword === expectedPassword) {
      setCurrentUser(selected);
      setIsAuthenticated(true);
      localStorage.setItem(CURRENT_USER_KEY, selected.id);
    } else {
      throw new Error('Incorrect email address or password.');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  // RBAC Permission Gates:

  // 1. Settings & KPI Weight Configuration: ADMIN only (or HR with explicit view)
  const canManageSettings = (): boolean => {
    if (!currentUser) return false;
    return ['ADMIN', 'HR'].includes(currentUser.systemRole);
  };

  // 2. Manage Employees: ADMIN, HR, HEAD_TECHNICAL
  const canManageEmployees = (): boolean => {
    if (!currentUser) return false;
    return ['ADMIN', 'HR', 'HEAD_TECHNICAL'].includes(currentUser.systemRole);
  };

  // 3. Approve Evaluations: HR, CEO, ADMIN
  const canApproveEvaluations = (): boolean => {
    if (!currentUser) return false;
    return ['ADMIN', 'HR', 'CEO'].includes(currentUser.systemRole);
  };

  // 4. Publish Evaluations to Employees: HR, ADMIN
  const canPublishEvaluations = (): boolean => {
    if (!currentUser) return false;
    return currentUser.systemRole === 'ADMIN' || currentUser.systemRole === 'HR';
  };

  // 5. Check if user can evaluate a target employee:
  // - Admin can evaluate any employee.
  // - Team Leader can evaluate ONLY employees in their own department (and cannot evaluate themselves).
  // - HR/CEO can evaluate if assigned.
  // - Employees cannot evaluate anyone.
  const canEvaluateEmployee = (target: Employee): boolean => {
    if (!currentUser || !currentUser.isActive) return false;
    if (!isEvaluableEmployee(target)) return false;
    if (currentUser.id === target.id) return false; // Cannot evaluate self

    if (currentUser.systemRole === 'ADMIN') return true;
    if (currentUser.systemRole === 'CEO') return true;
    if (currentUser.systemRole === 'HR') return true;
    if (currentUser.systemRole === 'HEAD_TECHNICAL') return true; // Can evaluate all departments

    if (currentUser.systemRole === 'TEAM_LEADER') {
      return currentUser.departmentId === target.departmentId;
    }

    return false;
  };

  // 6. View Evaluation:
  // - Admin, HR, CEO: can view all.
  // - Team Leader: can view all in their department.
  // - Employee: can view ONLY their own evaluation once status is PUBLISHED, EMPLOYEE_VIEWED, or ACKNOWLEDGED.
  const canViewEvaluation = (evalItem: Evaluation): boolean => {
    if (!currentUser) return false;

    if (['ADMIN', 'HR', 'CEO', 'HEAD_TECHNICAL'].includes(currentUser.systemRole)) return true;

    if (currentUser.systemRole === 'TEAM_LEADER') {
      return currentUser.departmentId === evalItem.departmentId;
    }

    if (currentUser.systemRole === 'EMPLOYEE') {
      if (evalItem.employeeId !== currentUser.id) return false;
      return ['PUBLISHED', 'EMPLOYEE_VIEWED', 'ACKNOWLEDGED'].includes(evalItem.status);
    }

    return false;
  };

  // 7. View KPI Weights:
  // CRITICAL REQUIREMENT: "Do not expose KPI weights to Team Leaders or Employees in their normal evaluation screens."
  // Only ADMIN, HR, CEO can view weights.
  const canViewKPIWeights = (): boolean => {
    if (!currentUser) return false;
    return ['ADMIN', 'HR', 'CEO'].includes(currentUser.systemRole);
  };

  const isExecutiveOrAdmin = (): boolean => {
    if (!currentUser) return false;
    return ['ADMIN', 'HR', 'CEO'].includes(currentUser.systemRole);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated,
        login,
        logout,
        canManageSettings,
        canManageEmployees,
        canApproveEvaluations,
        canPublishEvaluations,
        canEvaluateEmployee,
        canViewEvaluation,
        canViewKPIWeights,
        isExecutiveOrAdmin,
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
