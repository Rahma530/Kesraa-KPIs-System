// Firebase has been removed from this project.
// All data is handled via Supabase and localStorage.
// This file is kept for backward compatibility with any imports.

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: Record<string, unknown>;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {},
  };
  console.error('Operation Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Stubs — Firebase is not used
export const app = null;
export const db = null;
export const auth = null;
export const isFirebaseConnected = false;
export const googleProvider = null;

export async function testFirestoreConnection() {
  return false;
}
