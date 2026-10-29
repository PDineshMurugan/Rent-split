import { Member, Expense, PaymentRecord, MonthRecord, AuditLog, CustomPreset } from './expense.model';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface CloudUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface HouseholdCloudData {
  householdId: string;
  householdName: string;
  updatedAt: string;
  deviceSource?: string;
  ownerUid?: string | null;
  ownerEmail?: string | null;
  currentMonthKey: string;
  members: Member[];
  months: MonthRecord[];
  expenses: Expense[];
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  customPresets: CustomPreset[];
}

export type CloudSyncStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
