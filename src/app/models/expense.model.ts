export interface Member {
  id: string;
  name: string;
  phone?: string;
  joinedDate?: string;
  leaveDate?: string;
  isActive: boolean;
  avatarColor: string;
}

export interface PayerShare {
  memberId: string;
  amount: number;
}

export type SplitType = 'equal' | 'selected' | 'custom_amount' | 'custom_percent';

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  monthKey: string;
  notes?: string;
  isRecurring: boolean;
  isInstalment?: boolean;
  instalmentCurrent?: number;
  instalmentTotal?: number;
  splitType: SplitType;
  participants: string[]; // memberIds included
  customShares?: { [memberId: string]: number };
  payers: PayerShare[];
}

export type PaymentMethod = 'UPI / GPay' | 'PhonePe' | 'Paytm' | 'Bank Transfer' | 'Cash';

export interface PaymentRecord {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface MonthRecord {
  key: string; // e.g. '2026-10'
  name: string; // e.g. 'October 2026'
  dueDate: string;
  isFinalized: boolean;
  finalizedDate?: string;
  reopenedReason?: string;
  previousBalanceCarryOver: { [memberId: string]: number };
}

export interface LineItemExplanation {
  title: string;
  category: string;
  formula: string;
  shareAmount: number;
  isExcluded?: boolean;
}

export interface MemberStatement {
  member: Member;
  commonShare: number;
  selectedShare: number;
  grossShare: number;
  paidDirectly: number;
  directPaymentDetails: { title: string; amount: number }[];
  previousBalance: number;
  netUnrounded: number;
  roundingAdjustment: number;
  finalPayable: number;
  totalCollectedFromMember: number;
  remainingBalance: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  lineItems: LineItemExplanation[];
}

export interface TallyResult {
  totalExpenses: number;
  totalDirectPaid: number;
  netToCollect: number;
  sumCalculatedDues: number;
  totalCollectedSoFar: number;
  remainingToCollect: number;
  discrepancy: number;
  status: 'MATCHED' | 'SHORT' | 'EXTRA';
}

export interface SettlementTransfer {
  fromMember: Member;
  toMember: Member;
  amount: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  count: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface CustomPreset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  householdName: string;
  roommateCount: number;
  expenseCount: number;
  totalExpenseAmount: number;
  members: Member[];
  expenses: Expense[];
}
