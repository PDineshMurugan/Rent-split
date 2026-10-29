import { Injectable, computed, signal, inject, effect } from '@angular/core';
import {
  Member,
  Expense,
  PaymentRecord,
  MonthRecord,
  MemberStatement,
  TallyResult,
  SettlementTransfer,
  CategorySummary,
  AuditLog,
  LineItemExplanation,
  CustomPreset,
} from '../models/expense.model';
import { CloudSyncService } from './cloud-sync.service';
import { HouseholdCloudData } from '../models/cloud.model';

const STORAGE_KEY = 'splitmate_data_v4';
const PRESETS_STORAGE_KEY = 'splitmate_custom_presets_v1';



function getInitialMonths(): MonthRecord[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const key = `${year}-${month}`;
  return [
    {
      key,
      name: monthName,
      dueDate: `${year}-${month}-05`,
      isFinalized: false,
      previousBalanceCarryOver: {},
    },
  ];
}

@Injectable({
  providedIn: 'root',
})
export class RentSplitService {
  // Completely empty initial state - zero dummy data
  readonly householdName = signal<string>('My Household');
  readonly currentMonthKey = signal<string>(getInitialMonths()[0].key);
  readonly members = signal<Member[]>([]);
  readonly months = signal<MonthRecord[]>(getInitialMonths());
  readonly expenses = signal<Expense[]>([]);
  readonly payments = signal<PaymentRecord[]>([]);
  readonly auditLogs = signal<AuditLog[]>([]);
  readonly customPresets = signal<CustomPreset[]>([]);
  readonly isDarkMode = signal<boolean>(true);
  readonly cloudSync = inject(CloudSyncService);

  private autoSyncTimer: any = null;

  constructor() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
    }
    this.cleanLegacyStorageAndLoad();
    this.initCloudAutoListener();

    // Auto-sync cloud presets when Google account signs in
    effect(() => {
      const user = this.cloudSync.currentUser();
      if (user) {
        this.syncCloudPresetsOnLogin();
      }
    });
  }

  // Sync presets stored in user's Google Cloud account
  async syncCloudPresetsOnLogin() {
    try {
      const cloudPresets = await this.cloudSync.fetchCloudPresets();
      if (cloudPresets && cloudPresets.length > 0) {
        this.customPresets.update((localList) => {
          const cloudIds = new Set(cloudPresets.map((p) => p.id));
          const keptLocals = localList.filter((p) => !cloudIds.has(p.id));
          return [...cloudPresets, ...keptLocals];
        });
        this.savePresetsToStorage(false);
        this.addAudit(
          'Cloud Presets Synced',
          `Synced ${cloudPresets.length} cloud presets from Google Account`
        );
      }
    } catch (e) {
      console.warn('Failed to sync cloud presets on login:', e);
    }
  }

  // Generate full cloud payload preserving all history and presets
  getCloudDataPayload(): HouseholdCloudData {
    const user = this.cloudSync.currentUser();
    return {
      householdId: this.cloudSync.householdSyncCode() || (user?.uid ? `USER-${user.uid.slice(0, 8)}` : 'HOUSEHOLD'),
      householdName: this.householdName(),
      updatedAt: new Date().toISOString(),
      ownerUid: user?.uid || null,
      ownerEmail: user?.email || null,
      currentMonthKey: this.currentMonthKey(),
      members: this.members(),
      months: this.months(),
      expenses: this.expenses(),
      payments: this.payments(),
      auditLogs: this.auditLogs(),
      customPresets: this.customPresets(),
    };
  }

  // Restore entire cloud payload (months, presets, expenses, payments)
  loadCloudDataPayload(payload: HouseholdCloudData) {
    if (payload.householdName) this.householdName.set(payload.householdName);
    if (payload.currentMonthKey) this.currentMonthKey.set(payload.currentMonthKey);
    if (payload.members) this.members.set(payload.members);
    if (payload.months && payload.months.length > 0) this.months.set(payload.months);
    if (payload.expenses) this.expenses.set(payload.expenses);
    if (payload.payments) this.payments.set(payload.payments);
    if (payload.auditLogs) this.auditLogs.set(payload.auditLogs);
    if (payload.customPresets) this.customPresets.set(payload.customPresets);

    this.saveToStorage(false);
    this.savePresetsToStorage(false);
    this.addAudit('Cloud Sync', 'Restored household rent history & presets from Cloud');
  }

  private initCloudAutoListener() {
    if (typeof window !== 'undefined' && this.cloudSync.syncStatus() === 'connected') {
      this.cloudSync.subscribeRealtimeUpdates((cloudData) => {
        if (cloudData) {
          this.loadCloudDataPayload(cloudData);
        }
      });
    }
  }

  private triggerCloudAutoSync() {
    if (this.cloudSync.syncStatus() === 'connected' && this.cloudSync.isAutoSync()) {
      if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = setTimeout(() => {
        this.cloudSync.pushDataToCloud(this.getCloudDataPayload());
      }, 1500);
    }
  }

  // Active Month Record
  readonly activeMonth = computed(() => {
    const key = this.currentMonthKey();
    return (
      this.months().find((m) => m.key === key) || {
        key,
        name: 'Current Month',
        dueDate: `${key}-05`,
        isFinalized: false,
        previousBalanceCarryOver: {},
      }
    );
  });

  // Current Month's Expenses
  readonly currentMonthExpenses = computed(() => {
    const key = this.currentMonthKey();
    return this.expenses().filter((e) => e.monthKey === key);
  });

  // Current Month's Payments
  readonly currentMonthPayments = computed(() => {
    return this.payments();
  });

  // Total Expenses Incurred
  readonly totalExpenses = computed(() => {
    return this.currentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
  });

  // Direct Member Payments (Credits)
  readonly totalDirectCredits = computed(() => {
    return this.currentMonthExpenses().reduce((sum, e) => {
      const expenseDirect = e.payers.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + expenseDirect;
    }, 0);
  });

  // Net Amount to Collect from Flatmates
  readonly netToCollect = computed(() => {
    return this.totalExpenses() - this.totalDirectCredits();
  });

  // Computed Detailed Member Statements with Fair Rounding
  readonly memberStatements = computed<MemberStatement[]>(() => {
    const expList = this.currentMonthExpenses();
    const curMonth = this.activeMonth();
    const payList = this.currentMonthPayments();

    const allMembers = this.members().filter(
      (m) =>
        m.isActive ||
        expList.some(
          (e) => e.participants.includes(m.id) || e.payers.some((p) => p.memberId === m.id)
        )
    );
    if (allMembers.length === 0) return [];

    interface RawShare {
      member: Member;
      commonShare: number;
      selectedShare: number;
      grossShare: number;
      paidDirectly: number;
      directPaymentDetails: { title: string; amount: number }[];
      previousBalance: number;
      netUnrounded: number;
      lineItems: LineItemExplanation[];
    }

    const rawShares: RawShare[] = allMembers.map((member) => {
      let commonShare = 0;
      let selectedShare = 0;
      let grossShare = 0;
      const lineItems: LineItemExplanation[] = [];

      expList.forEach((e) => {
        const isIncluded = e.participants.includes(member.id);
        const participantCount = e.participants.length;

        if (isIncluded && participantCount > 0) {
          let itemShare = 0;
          if (e.splitType === 'custom_amount' && e.customShares?.[member.id] !== undefined) {
            itemShare = e.customShares[member.id];
          } else if (e.splitType === 'custom_percent' && e.customShares?.[member.id] !== undefined) {
            itemShare = (e.amount * e.customShares[member.id]) / 100;
          } else {
            itemShare = e.amount / participantCount;
          }

          grossShare += itemShare;
          if (participantCount === allMembers.length) {
            commonShare += itemShare;
            lineItems.push({
              title: e.title,
              category: e.category,
              formula: `₹${e.amount.toLocaleString('en-IN')} ÷ ${participantCount} members`,
              shareAmount: itemShare,
            });
          } else {
            selectedShare += itemShare;
            lineItems.push({
              title: e.title,
              category: e.category,
              formula: `₹${e.amount.toLocaleString('en-IN')} ÷ ${participantCount} selected members`,
              shareAmount: itemShare,
            });
          }
        } else {
          lineItems.push({
            title: e.title,
            category: e.category,
            formula: 'Excluded from this expense',
            shareAmount: 0,
            isExcluded: true,
          });
        }
      });

      let paidDirectly = 0;
      const directPaymentDetails: { title: string; amount: number }[] = [];
      expList.forEach((e) => {
        const myPayer = e.payers.find((p) => p.memberId === member.id);
        if (myPayer && myPayer.amount > 0) {
          paidDirectly += myPayer.amount;
          directPaymentDetails.push({ title: e.title, amount: myPayer.amount });
        }
      });

      const prevBal = curMonth.previousBalanceCarryOver?.[member.id] || 0;
      const netUnrounded = grossShare - paidDirectly + prevBal;

      return {
        member,
        commonShare,
        selectedShare,
        grossShare,
        paidDirectly,
        directPaymentDetails,
        previousBalance: prevBal,
        netUnrounded,
        lineItems,
      };
    });

    const targetNetSum = Math.round(this.netToCollect());

    const baseRoundings = rawShares.map((r) => {
      const baseInt = Math.floor(r.netUnrounded);
      const frac = r.netUnrounded - baseInt;
      return { baseInt, frac };
    });

    const sumBase = baseRoundings.reduce((sum, b) => sum + b.baseInt, 0);
    const discrepancy = targetNetSum - sumBase;

    const sortedIndices = rawShares
      .map((_, idx) => idx)
      .sort((a, b) => {
        const fracDiff = baseRoundings[b].frac - baseRoundings[a].frac;
        if (Math.abs(fracDiff) > 0.0001) return fracDiff;
        return a - b;
      });

    const allocatedAdjustments = new Array(rawShares.length).fill(0);
    if (discrepancy > 0) {
      for (let i = 0; i < discrepancy && i < sortedIndices.length; i++) {
        allocatedAdjustments[sortedIndices[i]] = 1;
      }
    } else if (discrepancy < 0) {
      const revIndices = [...sortedIndices].reverse();
      for (let i = 0; i < Math.abs(discrepancy) && i < revIndices.length; i++) {
        allocatedAdjustments[revIndices[i]] = -1;
      }
    }

    return rawShares.map((r, idx) => {
      const finalPayable = baseRoundings[idx].baseInt + allocatedAdjustments[idx];
      const roundingAdjustment = finalPayable - r.netUnrounded;

      const memberPayments = payList.filter((p) => p.memberId === r.member.id);
      const totalCollectedFromMember = memberPayments.reduce((s, p) => s + p.amount, 0);
      const remainingBalance = finalPayable - totalCollectedFromMember;

      let status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' = 'UNPAID';
      if (totalCollectedFromMember >= finalPayable && finalPayable > 0) {
        status = 'FULLY_PAID';
      } else if (totalCollectedFromMember > 0) {
        status = 'PARTIALLY_PAID';
      }

      return {
        member: r.member,
        commonShare: r.commonShare,
        selectedShare: r.selectedShare,
        grossShare: r.grossShare,
        paidDirectly: r.paidDirectly,
        directPaymentDetails: r.directPaymentDetails,
        previousBalance: r.previousBalance,
        netUnrounded: r.netUnrounded,
        roundingAdjustment,
        finalPayable,
        totalCollectedFromMember,
        remainingBalance,
        status,
        lineItems: r.lineItems,
      };
    });
  });

  // Tally Verification
  readonly tallyResult = computed<TallyResult>(() => {
    const totalExp = this.totalExpenses();
    const totalDirPaid = this.totalDirectCredits();
    const netCollect = this.netToCollect();

    const statements = this.memberStatements();
    const sumCalculatedDues = statements.reduce((s, st) => s + st.finalPayable, 0);
    const totalCollectedSoFar = statements.reduce((s, st) => s + st.totalCollectedFromMember, 0);
    const remainingToCollect = statements.reduce((s, st) => s + Math.max(0, st.remainingBalance), 0);

    const discrepancy = sumCalculatedDues - netCollect;

    let status: 'MATCHED' | 'SHORT' | 'EXTRA' = 'MATCHED';
    if (discrepancy < 0) status = 'SHORT';
    if (discrepancy > 0) status = 'EXTRA';

    return {
      totalExpenses: totalExp,
      totalDirectPaid: totalDirPaid,
      netToCollect: netCollect,
      sumCalculatedDues,
      totalCollectedSoFar,
      remainingToCollect,
      discrepancy,
      status,
    };
  });

  // Category-wise Breakdown
  readonly categorySummary = computed<CategorySummary[]>(() => {
    const expList = this.currentMonthExpenses();
    const total = this.totalExpenses() || 1;
    const catMap = new Map<string, { amount: number; count: number }>();

    const colors: { [key: string]: string } = {
      Rent: '#4f46e5',
      Electricity: '#eab308',
      'Water Cans': '#06b6d4',
      Internet: '#ec4899',
      'Washing Machine': '#8b5cf6',
      Groceries: '#10b981',
      Gas: '#f97316',
      Maintenance: '#64748b',
      Cleaning: '#14b8a6',
      Other: '#94a3b8',
    };

    expList.forEach((e) => {
      const cur = catMap.get(e.category) || { amount: 0, count: 0 };
      catMap.set(e.category, { amount: cur.amount + e.amount, count: cur.count + 1 });
    });

    return Array.from(catMap.entries()).map(([cat, data]) => ({
      category: cat,
      amount: data.amount,
      percentage: Math.round((data.amount / total) * 100),
      color: colors[cat] || '#6366f1',
      count: data.count,
    }));
  });

  // Debt Simplification Settlement Plan
  readonly settlementTransfers = computed<SettlementTransfer[]>(() => {
    const statements = this.memberStatements();
    const debtors: { member: Member; amount: number }[] = [];
    const creditors: { member: Member; amount: number }[] = [];

    statements.forEach((st) => {
      const netPosition = st.paidDirectly - st.grossShare;
      if (netPosition > 0.5) {
        creditors.push({ member: st.member, amount: netPosition });
      } else if (netPosition < -0.5) {
        debtors.push({ member: st.member, amount: Math.abs(netPosition) });
      }
    });

    const transfers: SettlementTransfer[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const amountToTransfer = Math.min(debtor.amount, creditor.amount);

      if (amountToTransfer > 0.5) {
        transfers.push({
          fromMember: debtor.member,
          toMember: creditor.member,
          amount: Math.round(amountToTransfer),
        });
      }

      debtor.amount -= amountToTransfer;
      creditor.amount -= amountToTransfer;

      if (debtor.amount < 0.5) dIdx++;
      if (creditor.amount < 0.5) cIdx++;
    }

    return transfers;
  });

  // WORKSPACE RESET METHODS

  clearAllData() {
    const initMonths = getInitialMonths();
    this.householdName.set('My Household');
    this.currentMonthKey.set(initMonths[0].key);
    this.months.set(initMonths);
    this.members.set([]);
    this.expenses.set([]);
    this.payments.set([]);
    this.auditLogs.set([]);

    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          // Preserve user-created presets when clearing active flat workspace data
          if (k && k.startsWith('splitmate_') && k !== PRESETS_STORAGE_KEY) {
            localStorage.removeItem(k);
          }
        }
      } catch (e) {
        console.warn('Storage purge error:', e);
      }
    }
    this.saveToStorage();
  }

  async createPreset(
    name: string,
    description: string = '',
    includeMembers: boolean = true,
    includeExpenses: boolean = true,
    storageType: 'local' | 'cloud' = 'local'
  ): Promise<CustomPreset> {
    const membersToSave = includeMembers ? JSON.parse(JSON.stringify(this.members())) : [];
    const expensesToSave = includeExpenses ? JSON.parse(JSON.stringify(this.expenses())) : [];
    const totalExp = expensesToSave.reduce((sum: number, e: Expense) => sum + e.amount, 0);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const newPreset: CustomPreset = {
      id: 'preset_' + Date.now(),
      name: name.trim(),
      description: description.trim(),
      createdAt: formattedDate,
      householdName: this.householdName(),
      roommateCount: membersToSave.length,
      expenseCount: expensesToSave.length,
      totalExpenseAmount: totalExp,
      members: membersToSave,
      expenses: expensesToSave,
      storageType: storageType,
    };

    this.customPresets.update((list) => [newPreset, ...list.filter((p) => p.id !== newPreset.id)]);
    this.savePresetsToStorage(false);

    if (storageType === 'cloud') {
      await this.cloudSync.saveCloudPreset(newPreset);
      this.addAudit(
        'Preset Created (Cloud)',
        `Saved cloud preset "${newPreset.name}" to Google Account`
      );
    } else {
      this.addAudit(
        'Preset Created (Local)',
        `Saved preset "${newPreset.name}" on this device`
      );
    }
    return newPreset;
  }

  loadCustomPreset(presetId: string) {
    const preset = this.customPresets().find((p) => p.id === presetId);
    if (!preset) return;

    if (preset.householdName) {
      this.householdName.set(preset.householdName);
    }
    this.members.set(JSON.parse(JSON.stringify(preset.members)));

    // Clone expenses and assign them to the current active billing month
    const curKey = this.currentMonthKey();
    const clonedExpenses: Expense[] = preset.expenses.map((e) => ({
      ...e,
      id: 'e_' + Math.random().toString(36).substring(2, 9),
      monthKey: curKey,
    }));
    this.expenses.set(clonedExpenses);
    this.payments.set([]);

    this.addAudit(
      'Preset Loaded',
      `Loaded preset "${preset.name}" (${preset.members.length} roommates, ${clonedExpenses.length} expenses)`
    );
    this.saveToStorage();
  }

  async deleteCustomPreset(presetId: string) {
    const preset = this.customPresets().find((p) => p.id === presetId);
    if (!preset) return;
    this.customPresets.update((list) => list.filter((p) => p.id !== presetId));
    this.savePresetsToStorage(false);

    if (preset.storageType === 'cloud') {
      await this.cloudSync.deleteCloudPreset(presetId);
      this.addAudit('Cloud Preset Deleted', `Removed cloud preset "${preset.name}" from Google Account`);
    } else {
      this.addAudit('Preset Deleted', `Removed local preset "${preset.name}"`);
    }
  }

  savePresetsToStorage(syncCloud: boolean = true) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.customPresets()));
      }
      if (syncCloud) {
        this.triggerCloudAutoSync();
      }
    } catch (e) {
      console.warn('Presets save error:', e);
    }
  }

  // MUTATIONS & ACTIONS
  addExpense(expense: Omit<Expense, 'id' | 'monthKey'>) {
    const newExpense: Expense = {
      ...expense,
      id: 'e_' + Date.now(),
      monthKey: this.currentMonthKey(),
    };
    this.expenses.update((list) => [...list, newExpense]);
    this.addAudit('Expense Added', `Added "${newExpense.title}" for ₹${newExpense.amount.toLocaleString('en-IN')}`);
    this.saveToStorage();
  }

  updateExpense(id: string, updated: Partial<Expense>) {
    this.expenses.update((list) =>
      list.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );
    this.addAudit('Expense Updated', `Updated expense details`);
    this.saveToStorage();
  }

  deleteExpense(id: string) {
    const exp = this.expenses().find((e) => e.id === id);
    this.expenses.update((list) => list.filter((e) => e.id !== id));
    if (exp) {
      this.addAudit('Expense Deleted', `Removed "${exp.title}" (₹${exp.amount})`);
    }
    this.saveToStorage();
  }

  logPayment(payment: Omit<PaymentRecord, 'id'>) {
    const newPayment: PaymentRecord = {
      ...payment,
      id: 'p_' + Date.now(),
    };
    this.payments.update((list) => [...list, newPayment]);
    const m = this.members().find((mem) => mem.id === payment.memberId);
    this.addAudit(
      'Payment Received',
      `Logged ₹${payment.amount} from ${m?.name || 'Member'} via ${payment.method}`
    );
    this.saveToStorage();
  }

  deletePayment(id: string) {
    this.payments.update((list) => list.filter((p) => p.id !== id));
    this.addAudit('Payment Deleted', `Removed payment record`);
    this.saveToStorage();
  }

  addMember(member: Omit<Member, 'id' | 'isActive'>) {
    const colors = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#2563eb', '#db2777', '#0891b2'];
    const newMember: Member = {
      ...member,
      id: 'm_' + Date.now(),
      phone: member.phone?.trim() ? member.phone.trim() : undefined,
      joinedDate: member.joinedDate?.trim() ? member.joinedDate.trim() : undefined,
      isActive: true,
      avatarColor: member.avatarColor || colors[Math.floor(Math.random() * colors.length)],
    };
    this.members.update((list) => [...list, newMember]);
    this.addAudit('Member Added', `Added ${newMember.name} to household`);
    this.saveToStorage();
  }

  updateMember(id: string, updated: Partial<Member>) {
    this.members.update((list) =>
      list.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );
    this.saveToStorage();
  }

  toggleMemberActive(id: string) {
    const m = this.members().find((mem) => mem.id === id);
    if (!m) return;
    const nextStatus = !m.isActive;
    this.members.update((list) =>
      list.map((mem) => (mem.id === id ? { ...mem, isActive: nextStatus } : mem))
    );
    this.addAudit(
      nextStatus ? 'Roommate Activated' : 'Roommate Deactivated',
      `Marked ${m.name} as ${nextStatus ? 'active' : 'inactive'}`
    );
    this.saveToStorage();
  }

  deleteMember(id: string) {
    const m = this.members().find((mem) => mem.id === id);
    if (!m) return;
    this.members.update((list) => list.filter((mem) => mem.id !== id));
    this.addAudit('Roommate Removed', `Removed ${m.name} from household`);
    this.saveToStorage();
  }

  removeMember(id: string) {
    this.toggleMemberActive(id);
  }

  switchMonth(key: string) {
    this.currentMonthKey.set(key);
  }

  finalizeMonth() {
    const key = this.currentMonthKey();
    this.months.update((list) =>
      list.map((m) =>
        m.key === key
          ? { ...m, isFinalized: true, finalizedDate: new Date().toISOString() }
          : m
      )
    );
    this.addAudit('Month Finalized', `Locked calculations for ${this.activeMonth().name}`);
    this.saveToStorage();
  }

  reopenMonth(reason: string) {
    const key = this.currentMonthKey();
    this.months.update((list) =>
      list.map((m) =>
        m.key === key
          ? { ...m, isFinalized: false, reopenedReason: reason }
          : m
      )
    );
    this.addAudit('Month Reopened', `Reopened ${this.activeMonth().name} - Reason: ${reason}`);
    this.saveToStorage();
  }

  toggleDarkMode() {
    const nextVal = !this.isDarkMode();
    this.isDarkMode.set(nextVal);
    if (typeof document !== 'undefined') {
      if (nextVal) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  private addAudit(action: string, details: string) {
    const newLog: AuditLog = {
      id: 'a_' + Date.now(),
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      action,
      details,
    };
    this.auditLogs.update((list) => [newLog, ...list.slice(0, 49)]);
  }

  private saveToStorage(syncCloud: boolean = true) {
    try {
      if (typeof localStorage !== 'undefined') {
        const payload = {
          householdName: this.householdName(),
          currentMonthKey: this.currentMonthKey(),
          members: this.members(),
          months: this.months(),
          expenses: this.expenses(),
          payments: this.payments(),
          auditLogs: this.auditLogs(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
      if (syncCloud) {
        this.triggerCloudAutoSync();
      }
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  private cleanLegacyStorageAndLoad() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Clear any old legacy versions
        localStorage.removeItem('splitmate_data_v1');
        localStorage.removeItem('splitmate_data_v2');
        localStorage.removeItem('splitmate_data_v3');
        localStorage.removeItem('splitmate_data_clean_v1');

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.householdName) this.householdName.set(data.householdName);
          if (data.currentMonthKey) this.currentMonthKey.set(data.currentMonthKey);
          if (data.members) this.members.set(data.members);
          if (data.months) this.months.set(data.months);
          if (data.expenses) this.expenses.set(data.expenses);
          if (data.payments) this.payments.set(data.payments);
          if (data.auditLogs) this.auditLogs.set(data.auditLogs);
        }

        const presetsRaw = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (presetsRaw) {
          try {
            this.customPresets.set(JSON.parse(presetsRaw));
          } catch (pe) {
            console.warn('Preset parse error:', pe);
          }
        }
      }
    } catch (e) {
      console.warn('Storage load error:', e);
    }
  }

  // Text Generators for WhatsApp - Clean, 100% Emoji-Free
  generateWhatsAppHouseholdSummary(): string {
    const month = this.activeMonth();
    const exp = this.currentMonthExpenses();
    const statements = this.memberStatements();
    const tally = this.tallyResult();

    let text = `*${this.householdName().toUpperCase()}*\n`;
    text += `*${month.name.toUpperCase()} EXPENSE REPORT*\n`;
    text += `--------------------------------\n\n`;

    text += `*TOTAL EXPENSES: ₹${tally.totalExpenses.toLocaleString('en-IN')}*\n`;
    exp.forEach((e) => {
      text += `- ${e.title} (${e.participants.length} members): ₹${e.amount.toLocaleString('en-IN')}\n`;
    });

    text += `\n*PAID DIRECTLY BY MEMBERS:*\n`;
    let anyPayer = false;
    exp.forEach((e) => {
      e.payers.forEach((p) => {
        const m = this.members().find((mem) => mem.id === p.memberId);
        if (m && p.amount > 0) {
          anyPayer = true;
          text += `- ${m.name}: ₹${p.amount.toLocaleString('en-IN')} (${e.title})\n`;
        }
      });
    });
    if (!anyPayer) text += `- None (all paid from common fund)\n`;
    text += `Total Direct Credits: ₹${tally.totalDirectPaid.toLocaleString('en-IN')}\n\n`;

    text += `*FINAL AMOUNT TO PAY:*\n`;
    statements.forEach((st, idx) => {
      text += `${idx + 1}. *${st.member.name}*: ₹${st.finalPayable.toLocaleString('en-IN')}\n`;
    });

    text += `--------------------------------\n`;
    text += `Total to Collect: ₹${tally.netToCollect.toLocaleString('en-IN')}\n`;
    text += `*Tally Status: ${tally.status === 'MATCHED' ? 'Matched (Exact)' : tally.status}*\n`;
    text += `Payment Due: ${month.dueDate}. Please send screenshot after paying.\n`;

    return text;
  }

  generateWhatsAppMemberSlip(statement: MemberStatement): string {
    const month = this.activeMonth();
    let text = `Hi *${statement.member.name}*, here is your split for *${month.name}*:\n\n`;

    text += `*Your Expense Shares:*\n`;
    statement.lineItems.forEach((li) => {
      if (!li.isExcluded) {
        text += `- ${li.title}: ₹${li.shareAmount.toFixed(2)} (${li.formula})\n`;
      } else {
        text += `- ${li.title}: Excluded (₹0.00)\n`;
      }
    });

    text += `\nGross Share: ₹${statement.grossShare.toFixed(2)}\n`;

    if (statement.paidDirectly > 0) {
      text += `*Your Paid Credits:* - ₹${statement.paidDirectly.toFixed(2)}\n`;
      statement.directPaymentDetails.forEach((dp) => {
        text += `  (${dp.title}: ₹${dp.amount})\n`;
      });
    }

    if (statement.previousBalance !== 0) {
      text += `*Previous Balance:* ₹${statement.previousBalance.toFixed(2)}\n`;
    }

    text += `*Fair Rounding:* ${statement.roundingAdjustment >= 0 ? '+' : ''}₹${statement.roundingAdjustment.toFixed(2)}\n`;
    text += `--------------------------------\n`;
    text += `*FINAL AMOUNT TO PAY: ₹${statement.finalPayable.toLocaleString('en-IN')}*\n`;
    text += `--------------------------------\n`;

    if (statement.totalCollectedFromMember > 0) {
      text += `Paid So Far: ₹${statement.totalCollectedFromMember.toLocaleString('en-IN')}\n`;
      text += `Remaining: ₹${statement.remainingBalance.toLocaleString('en-IN')}\n`;
    }

    text += `Please transfer to flat account/UPI by ${month.dueDate}. Thank you.`;
    return text;
  }

  generateReminderMessage(statement: MemberStatement): string {
    const month = this.activeMonth();
    return `Payment Reminder: Hi ${statement.member.name}, your flat share of ₹${statement.remainingBalance.toLocaleString('en-IN')} for ${month.name} is pending. Please transfer it to the flat fund by ${month.dueDate}. Thank you.`;
  }
}
