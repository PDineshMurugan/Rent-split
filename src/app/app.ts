import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RentSplitService } from './services/rent-split.service';
import {
  Expense,
  Member,
  MemberStatement,
  PayerShare,
  PaymentMethod,
  SplitType,
  CustomPreset,
} from './models/expense.model';

type ActiveTab = 'dashboard' | 'expenses' | 'slips' | 'payments' | 'roommates';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly splitService = inject(RentSplitService);

  // Active navigation tab
  readonly activeTab = signal<ActiveTab>('dashboard');

  // Search & Filters
  readonly expenseCategoryFilter = signal<string>('ALL');
  readonly memberSlipFilter = signal<string>('ALL');
  readonly expenseSearchQuery = signal<string>('');

  // Modals state
  readonly showExpenseModal = signal<boolean>(false);
  readonly editingExpenseId = signal<string | null>(null);

  readonly showPaymentModal = signal<boolean>(false);
  readonly preselectedPaymentMemberId = signal<string>('');

  // Share Modal & Image Export State
  readonly showShareModal = signal<boolean>(false);
  readonly shareModalTitle = signal<string>('');
  readonly shareModalContent = signal<string>('');
  readonly shareViewMode = signal<'picture' | 'text'>('picture');
  readonly shareCardImageDataUrl = signal<string>('');
  private shareCardBlob: Blob | null = null;
  readonly copyFeedbackText = signal<string>('');

  readonly showReopenModal = signal<boolean>(false);
  readonly reopenReasonInput = signal<string>('');

  readonly showHouseholdModal = signal<boolean>(false);
  readonly householdNameInput = signal<string>('');
  readonly dueDateInput = signal<string>('');

  readonly showMemberModal = signal<boolean>(false);
  readonly memberNameInput = signal<string>('');
  readonly memberPhoneInput = signal<string>('');
  readonly memberJoinDateInput = signal<string>('');

  readonly showPresetModal = signal<boolean>(false);
  readonly presetModalTab = signal<'list' | 'create'>('list');
  readonly presetFilterType = signal<'all' | 'local' | 'cloud'>('all');
  readonly newPresetName = signal<string>('');
  readonly newPresetDescription = signal<string>('');
  readonly newPresetIncludeMembers = signal<boolean>(true);
  readonly newPresetIncludeExpenses = signal<boolean>(true);
  readonly newPresetStorageType = signal<'local' | 'cloud'>('local');
  readonly presetSuccessNotification = signal<string>('');

  // Minimal 1-time Firebase Setup Modal (only if environment is not set)
  readonly showFirebaseSetupModal = signal<boolean>(false);
  readonly firebaseApiKeyInput = signal<string>('');
  readonly firebaseProjectIdInput = signal<string>('');
  readonly firebaseSetupError = signal<string>('');

  // Mini Calculator State
  readonly showMiniCalc = signal<'expense' | 'payment' | null>(null);
  readonly calcExpression = signal<string>('');
  readonly calcResult = computed<number | null>(() => {
    const expr = this.calcExpression().trim();
    if (!expr) return null;
    return this.evaluateMathExpression(expr);
  });

  // Expense Form State
  expenseFormTitle = '';
  expenseFormCategory = 'Rent';
  expenseFormAmount: number | null = null;
  expenseFormDate = new Date().toISOString().substring(0, 10);
  expenseFormNotes = '';
  expenseFormIsRecurring = false;
  expenseFormIsInstalment = false;
  expenseFormInstalmentCurrent = 1;
  expenseFormInstalmentTotal = 6;
  expenseFormSplitType: SplitType = 'equal';
  expenseFormParticipants: { [memberId: string]: boolean } = {};
  expenseFormPayers: { memberId: string; amount: number }[] = [];

  // Payment Form State
  paymentFormMemberId = '';
  paymentFormAmount: number | null = null;
  paymentFormDate = new Date().toISOString().substring(0, 10);
  paymentFormMethod: PaymentMethod = 'UPI / GPay';
  paymentFormReference = '';
  paymentFormNotes = '';

  // Expense categories list
  readonly categories = [
    'Rent',
    'Electricity',
    'Water Cans',
    'Internet',
    'Washing Machine',
    'Groceries',
    'Gas',
    'Maintenance',
    'Cleaning',
    'Other',
  ];

  readonly paymentMethods: PaymentMethod[] = [
    'UPI / GPay',
    'PhonePe',
    'Paytm',
    'Bank Transfer',
    'Cash',
  ];

  // Filtered Expenses
  readonly filteredExpenses = computed(() => {
    const list = this.splitService.currentMonthExpenses();
    const cat = this.expenseCategoryFilter();
    const q = this.expenseSearchQuery().toLowerCase().trim();

    return list.filter((e) => {
      const matchCat = cat === 'ALL' || e.category === cat;
      const matchQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  // Filtered Member Statements
  readonly filteredStatements = computed(() => {
    const list = this.splitService.memberStatements();
    const filter = this.memberSlipFilter();
    if (filter === 'ALL') return list;
    if (filter === 'UNPAID') return list.filter((s) => s.status === 'UNPAID');
    if (filter === 'PARTIAL') return list.filter((s) => s.status === 'PARTIALLY_PAID');
    if (filter === 'PAID') return list.filter((s) => s.status === 'FULLY_PAID');
    return list;
  });

  // Filtered Presets (All / Local / Cloud)
  readonly filteredPresets = computed(() => {
    const list = this.splitService.customPresets();
    const filter = this.presetFilterType();
    if (filter === 'local') return list.filter((p) => !p.storageType || p.storageType === 'local');
    if (filter === 'cloud') return list.filter((p) => p.storageType === 'cloud');
    return list;
  });

  getPayerName(memberId: string): string {
    const m = this.splitService.members().find((mem) => mem.id === memberId);
    return m ? m.name : 'Unknown';
  }

  getMember(memberId: string): Member | undefined {
    return this.splitService.members().find((mem) => mem.id === memberId);
  }

  // MODAL LAUNCHERS
  openAddExpenseModal() {
    this.editingExpenseId.set(null);
    this.expenseFormTitle = '';
    this.expenseFormCategory = 'Groceries';
    this.expenseFormAmount = null;
    this.expenseFormDate = new Date().toISOString().substring(0, 10);
    this.expenseFormNotes = '';
    this.expenseFormIsRecurring = false;
    this.expenseFormIsInstalment = false;
    this.expenseFormInstalmentCurrent = 1;
    this.expenseFormInstalmentTotal = 6;
    this.expenseFormSplitType = 'equal';

    const parts: { [id: string]: boolean } = {};
    this.splitService.members().forEach((m) => {
      parts[m.id] = m.isActive;
    });
    this.expenseFormParticipants = parts;
    this.expenseFormPayers = [];
    this.showExpenseModal.set(true);
  }

  openEditExpenseModal(expense: Expense) {
    this.editingExpenseId.set(expense.id);
    this.expenseFormTitle = expense.title;
    this.expenseFormCategory = expense.category;
    this.expenseFormAmount = expense.amount;
    this.expenseFormDate = expense.date;
    this.expenseFormNotes = expense.notes || '';
    this.expenseFormIsRecurring = expense.isRecurring;
    this.expenseFormIsInstalment = !!expense.isInstalment;
    this.expenseFormInstalmentCurrent = expense.instalmentCurrent || 1;
    this.expenseFormInstalmentTotal = expense.instalmentTotal || 6;
    this.expenseFormSplitType = expense.splitType;

    const parts: { [id: string]: boolean } = {};
    this.splitService.members().forEach((m) => {
      parts[m.id] = expense.participants.includes(m.id);
    });
    this.expenseFormParticipants = parts;
    this.expenseFormPayers = expense.payers.map((p) => ({ ...p }));
    this.showExpenseModal.set(true);
  }

  closeExpenseModal() {
    this.showExpenseModal.set(false);
    this.editingExpenseId.set(null);
  }

  addPayerRow() {
    const firstActive = this.splitService.members().find((m) => m.isActive);
    if (firstActive) {
      this.expenseFormPayers.push({
        memberId: firstActive.id,
        amount: 0,
      });
    }
  }

  removePayerRow(index: number) {
    this.expenseFormPayers.splice(index, 1);
  }

  selectAllParticipants(include: boolean) {
    const parts: { [id: string]: boolean } = {};
    this.splitService.members().forEach((m) => {
      if (m.isActive) parts[m.id] = include;
    });
    this.expenseFormParticipants = parts;
  }

  // MINI CALCULATOR ACTIONS
  toggleMiniCalc(target: 'expense' | 'payment') {
    if (this.showMiniCalc() === target) {
      this.showMiniCalc.set(null);
    } else {
      this.showMiniCalc.set(target);
      const currentVal = target === 'expense' ? this.expenseFormAmount : this.paymentFormAmount;
      this.calcExpression.set(currentVal && currentVal > 0 ? String(currentVal) : '');
    }
  }

  closeMiniCalc() {
    this.showMiniCalc.set(null);
  }

  calcAppend(val: string) {
    this.calcExpression.update((prev) => prev + val);
  }

  calcClear() {
    this.calcExpression.set('');
  }

  calcBackspace() {
    this.calcExpression.update((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
  }

  calcEvaluate() {
    const res = this.calcResult();
    if (res !== null && !isNaN(res)) {
      this.calcExpression.set(String(res));
    }
  }

  applyCalcToAmount() {
    const res = this.calcResult();
    if (res !== null && !isNaN(res) && res >= 0) {
      if (this.showMiniCalc() === 'expense') {
        this.expenseFormAmount = res;
      } else if (this.showMiniCalc() === 'payment') {
        this.paymentFormAmount = res;
      }
      this.closeMiniCalc();
    }
  }

  private evaluateMathExpression(expr: string): number | null {
    const sanitized = expr.replace(/\s+/g, '');
    if (!sanitized) return null;
    if (!/^[\d+\-*/().]+$/.test(sanitized)) return null;

    try {
      const res = Function(`"use strict"; return (${sanitized})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return Math.round(res * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveExpense() {
    if (!this.expenseFormTitle.trim()) {
      alert('Please enter an expense title.');
      return;
    }
    if (!this.expenseFormAmount || this.expenseFormAmount <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    const selectedParticipants = Object.keys(this.expenseFormParticipants).filter(
      (id) => this.expenseFormParticipants[id]
    );

    if (selectedParticipants.length === 0) {
      alert('At least one roommate must be included in this expense.');
      return;
    }

    const validPayers: PayerShare[] = this.expenseFormPayers
      .filter((p) => p.memberId && p.amount > 0)
      .map((p) => ({ memberId: p.memberId, amount: Number(p.amount) }));

    const totalPaidDirect = validPayers.reduce((s, p) => s + p.amount, 0);
    if (totalPaidDirect > this.expenseFormAmount) {
      alert(
        `Direct payments (₹${totalPaidDirect}) exceed the total expense amount (₹${this.expenseFormAmount}). Please correct the payer amounts.`
      );
      return;
    }

    const payload: Omit<Expense, 'id' | 'monthKey'> = {
      title: this.expenseFormTitle.trim(),
      category: this.expenseFormCategory,
      amount: Number(this.expenseFormAmount),
      date: this.expenseFormDate,
      notes: this.expenseFormNotes.trim(),
      isRecurring: this.expenseFormIsRecurring,
      isInstalment: this.expenseFormIsInstalment,
      instalmentCurrent: this.expenseFormIsInstalment ? this.expenseFormInstalmentCurrent : undefined,
      instalmentTotal: this.expenseFormIsInstalment ? this.expenseFormInstalmentTotal : undefined,
      splitType: selectedParticipants.length === this.splitService.members().length ? 'equal' : 'selected',
      participants: selectedParticipants,
      payers: validPayers,
    };

    const editId = this.editingExpenseId();
    if (editId) {
      this.splitService.updateExpense(editId, payload);
    } else {
      this.splitService.addExpense(payload);
    }

    this.closeExpenseModal();
  }

  deleteExpenseConfirm(expense: Expense) {
    if (confirm(`Are you sure you want to delete "${expense.title}" (₹${expense.amount})?`)) {
      this.splitService.deleteExpense(expense.id);
    }
  }

  // PAYMENT COLLECTION MODAL
  openPaymentModal(memberId?: string) {
    const targetMemberId = memberId || this.splitService.members().find((m) => m.isActive)?.id || '';
    this.preselectedPaymentMemberId.set(targetMemberId);
    this.paymentFormMemberId = targetMemberId;

    const statement = this.splitService.memberStatements().find((s) => s.member.id === targetMemberId);
    this.paymentFormAmount = statement && statement.remainingBalance > 0 ? statement.remainingBalance : null;
    this.paymentFormDate = new Date().toISOString().substring(0, 10);
    this.paymentFormMethod = 'UPI / GPay';
    this.paymentFormReference = '';
    this.paymentFormNotes = '';
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
  }

  savePayment() {
    if (!this.paymentFormMemberId) {
      alert('Please select a member.');
      return;
    }
    if (!this.paymentFormAmount || this.paymentFormAmount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    this.splitService.logPayment({
      memberId: this.paymentFormMemberId,
      amount: Number(this.paymentFormAmount),
      date: this.paymentFormDate,
      method: this.paymentFormMethod,
      reference: this.paymentFormReference.trim() || undefined,
      notes: this.paymentFormNotes.trim() || undefined,
    });

    this.closePaymentModal();
  }

  deletePaymentConfirm(id: string) {
    if (confirm('Are you sure you want to delete this payment record?')) {
      this.splitService.deletePayment(id);
    }
  }

  // SHARE MODAL & PICTURE RECEIPT GENERATOR
  openGroupWhatsAppModal() {
    const text = this.splitService.generateWhatsAppHouseholdSummary();
    this.shareModalTitle.set('Household Monthly Summary');
    this.shareModalContent.set(text);
    this.copyFeedbackText.set('');
    this.shareViewMode.set('picture');
    this.generateHouseholdReceiptImage();
    this.showShareModal.set(true);
  }

  openMemberWhatsAppModal(st: MemberStatement) {
    const text = this.splitService.generateWhatsAppMemberSlip(st);
    this.shareModalTitle.set(`Payment Slip - ${st.member.name}`);
    this.shareModalContent.set(text);
    this.copyFeedbackText.set('');
    this.shareViewMode.set('picture');
    this.generateMemberReceiptImage(st);
    this.showShareModal.set(true);
  }

  openReminderWhatsAppModal(st: MemberStatement) {
    const text = this.splitService.generateReminderMessage(st);
    this.shareModalTitle.set(`Payment Reminder - ${st.member.name}`);
    this.shareModalContent.set(text);
    this.copyFeedbackText.set('');
    this.shareViewMode.set('text');
    this.showShareModal.set(true);
  }

  closeShareModal() {
    this.showShareModal.set(false);
  }

  // CANVAS DRAWING HELPERS FOR PICTURE EXPORT
  private generateHouseholdReceiptImage() {
    const canvas = document.createElement('canvas');
    const width = 760;
    const statements = this.splitService.memberStatements();
    const expenses = this.splitService.currentMonthExpenses();
    const tally = this.splitService.tallyResult();
    const month = this.splitService.activeMonth();

    // Calculate height dynamically
    const height = 480 + expenses.length * 32 + statements.length * 36;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Outer Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Gradient Header
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#4f46e5');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 100);

    // Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SplitMate — Household Expense Summary', 32, 45);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${this.splitService.householdName()}  •  ${month.name}`, 32, 75);

    // KPI Summary Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(32, 120, width - 64, 80);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 120, width - 64, 80);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('TOTAL EXPENSES', 52, 146);
    ctx.fillText('MEMBER CREDITS', 290, 146);
    ctx.fillText('NET TO COLLECT', 530, 146);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`₹${tally.totalExpenses.toLocaleString('en-IN')}`, 52, 178);

    ctx.fillStyle = '#059669';
    ctx.fillText(`₹${tally.totalDirectPaid.toLocaleString('en-IN')}`, 290, 178);

    ctx.fillStyle = '#2563eb';
    ctx.fillText(`₹${tally.netToCollect.toLocaleString('en-IN')}`, 530, 178);

    // Section 1: Monthly Expenses Table
    let curY = 230;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('MONTHLY EXPENSES', 32, curY);

    curY += 15;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(32, curY, width - 64, 1);
    curY += 20;

    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    expenses.forEach((e) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`${e.title} (${e.participants.length} roommates)`, 32, curY);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px monospace';
      const amtStr = `₹${e.amount.toLocaleString('en-IN')}`;
      const textW = ctx.measureText(amtStr).width;
      ctx.fillText(amtStr, width - 32 - textW, curY);
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      curY += 28;
    });

    // Section 2: Roommate Dues Table
    curY += 15;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('FINAL PAYABLE PER ROOMMATE', 32, curY);

    curY += 15;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(32, curY, width - 64, 1);
    curY += 20;

    statements.forEach((st, idx) => {
      ctx.fillStyle = '#334155';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${idx + 1}. ${st.member.name}`, 32, curY);

      if (st.paidDirectly > 0) {
        ctx.fillStyle = '#059669';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`(Credits: -₹${st.paidDirectly.toLocaleString('en-IN')})`, 180, curY);
      }

      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 15px monospace';
      const dueStr = `₹${st.finalPayable.toLocaleString('en-IN')}`;
      const dueW = ctx.measureText(dueStr).width;
      ctx.fillText(dueStr, width - 32 - dueW, curY);

      curY += 32;
    });

    // Footer
    curY += 15;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(32, curY, width - 64, 50);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Tally Status: ${tally.status === 'MATCHED' ? 'Matched (100% Exact)' : tally.status}`, 50, curY + 30);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    const dueInfo = `Due Date: ${month.dueDate}`;
    const dueInfoW = ctx.measureText(dueInfo).width;
    ctx.fillText(dueInfo, width - 50 - dueInfoW, curY + 30);

    this.finalizeCanvasImage(canvas);
  }

  private generateMemberReceiptImage(st: MemberStatement) {
    const canvas = document.createElement('canvas');
    const width = 680;
    const height = 620;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Top Brand Gradient Bar
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#4f46e5');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Payment Slip: ${st.member.name}`, 32, 44);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${this.splitService.householdName()}  •  ${this.splitService.activeMonth().name}`, 32, 72);

    // Final Payable Box (Hero)
    ctx.fillStyle = '#eef2ff';
    ctx.fillRect(32, 115, width - 64, 85);
    ctx.strokeStyle = '#c7d2fe';
    ctx.strokeRect(32, 115, width - 64, 85);

    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('NET PAYABLE AMOUNT (WHOLE RUPEES)', 52, 142);

    ctx.fillStyle = '#312e81';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(`₹${st.finalPayable.toLocaleString('en-IN')}`, 52, 182);

    // Breakdown Line Items
    let curY = 230;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ITEMIZED SHARES', 32, curY);

    curY += 12;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(32, curY, width - 64, 1);
    curY += 22;

    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    st.lineItems.forEach((li) => {
      ctx.fillStyle = li.isExcluded ? '#94a3b8' : '#1e293b';
      ctx.fillText(li.title, 32, curY);

      const valStr = li.isExcluded ? 'Excluded (₹0)' : `₹${li.shareAmount.toFixed(2)}`;
      ctx.font = '13px monospace';
      const valW = ctx.measureText(valStr).width;
      ctx.fillText(valStr, width - 32 - valW, curY);
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      curY += 26;
    });

    // Accounting Summary
    curY += 12;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(32, curY, width - 64, 1);
    curY += 24;

    ctx.fillStyle = '#475569';
    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Gross Share Subtotal:', 32, curY);
    ctx.font = 'bold 13px monospace';
    let gStr = `₹${st.grossShare.toFixed(2)}`;
    ctx.fillText(gStr, width - 32 - ctx.measureText(gStr).width, curY);
    curY += 24;

    if (st.paidDirectly > 0) {
      ctx.fillStyle = '#059669';
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Less Direct Advance Paid:', 32, curY);
      ctx.font = 'bold 13px monospace';
      let cStr = `- ₹${st.paidDirectly.toFixed(2)}`;
      ctx.fillText(cStr, width - 32 - ctx.measureText(cStr).width, curY);
      curY += 24;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Fair Rounding Adjustment:', 32, curY);
    ctx.font = '13px monospace';
    let rStr = `${st.roundingAdjustment >= 0 ? '+' : ''}₹${st.roundingAdjustment.toFixed(2)}`;
    ctx.fillText(rStr, width - 32 - ctx.measureText(rStr).width, curY);

    // Footer info
    curY += 35;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(32, curY, width - 64, 45);
    ctx.fillStyle = '#475569';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Payment due by ${this.splitService.activeMonth().dueDate}. Please send receipt after transfer.`, 50, curY + 28);

    this.finalizeCanvasImage(canvas);
  }

  private finalizeCanvasImage(canvas: HTMLCanvasElement) {
    this.shareCardImageDataUrl.set(canvas.toDataURL('image/png'));
    canvas.toBlob((blob) => {
      this.shareCardBlob = blob;
    }, 'image/png');
  }

  copyImageToClipboard() {
    if (this.shareCardBlob && navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': this.shareCardBlob })])
        .then(() => {
          this.copyFeedbackText.set('Image copied to clipboard! Paste it directly into WhatsApp with Ctrl+V');
          setTimeout(() => this.copyFeedbackText.set(''), 4000);
        })
        .catch(() => {
          this.downloadImage();
        });
    } else {
      this.downloadImage();
    }
  }

  downloadImage() {
    const dataUrl = this.shareCardImageDataUrl();
    if (!dataUrl) return;

    const link = document.createElement('a');
    const filename = `${this.shareModalTitle().replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = dataUrl;
    link.download = filename;
    link.click();
    this.copyFeedbackText.set('Image downloaded as PNG file!');
    setTimeout(() => this.copyFeedbackText.set(''), 3000);
  }

  copyShareText() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.shareModalContent()).then(() => {
        this.copyFeedbackText.set('Text copied to clipboard');
        setTimeout(() => this.copyFeedbackText.set(''), 3000);
      });
    }
  }

  openWhatsAppWebDirect() {
    const text = encodeURIComponent(this.shareModalContent());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  // REOPEN & FINALIZE MONTH
  finalizeMonthCheck() {
    const tally = this.splitService.tallyResult();
    if (tally.status !== 'MATCHED') {
      alert(
        `Cannot finalize month: Tally status is ${tally.status}. Ensure collections balance total expenses first.`
      );
      return;
    }
    if (
      confirm(
        `Are you sure you want to finalize ${this.splitService.activeMonth().name}? This will lock the month from further edits.`
      )
    ) {
      this.splitService.finalizeMonth();
    }
  }

  openReopenModal() {
    this.reopenReasonInput.set('');
    this.showReopenModal.set(true);
  }

  closeReopenModal() {
    this.showReopenModal.set(false);
  }

  confirmReopenMonth() {
    const reason = this.reopenReasonInput().trim();
    if (!reason) {
      alert('Please enter a brief reason for reopening this finalized month.');
      return;
    }
    this.splitService.reopenMonth(reason);
    this.closeReopenModal();
  }

  // HOUSEHOLD SETTINGS MODAL
  openHouseholdModal() {
    this.householdNameInput.set(this.splitService.householdName());
    this.dueDateInput.set(this.splitService.activeMonth().dueDate);
    this.showHouseholdModal.set(true);
  }

  closeHouseholdModal() {
    this.showHouseholdModal.set(false);
  }

  saveHouseholdSettings() {
    const name = this.householdNameInput().trim();
    if (name) {
      this.splitService.householdName.set(name);
    }
    this.closeHouseholdModal();
  }

  // ROOMMATE MANAGEMENT MODAL
  openAddMemberModal() {
    this.memberNameInput.set('');
    this.memberPhoneInput.set('');
    this.memberJoinDateInput.set(''); // Empty by default so it does NOT mistakenly take today's date
    this.showMemberModal.set(true);
  }

  closeMemberModal() {
    this.showMemberModal.set(false);
  }

  saveNewMember() {
    const name = this.memberNameInput().trim();
    if (!name) {
      alert('Please enter roommate name.');
      return;
    }
    const phone = this.memberPhoneInput().trim();
    const joinedDate = this.memberJoinDateInput().trim();
    this.splitService.addMember({
      name,
      phone: phone || undefined,
      joinedDate: joinedDate || undefined,
      avatarColor: this.getRandomAvatarColor(),
    });
    this.closeMemberModal();
  }

  toggleMemberActiveAction(m: Member) {
    this.splitService.toggleMemberActive(m.id);
  }

  deleteMemberAction(m: Member) {
    this.splitService.deleteMember(m.id);
  }

  deactivateMemberConfirm(m: Member) {
    this.toggleMemberActiveAction(m);
  }

  private getRandomAvatarColor(): string {
    const colors = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#2563eb', '#db2777', '#0891b2', '#0d9488'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // PRESETS MANAGEMENT - BROWSE, CREATE, LOAD, DELETE
  openPresetModal(tab: 'list' | 'create' = 'list') {
    this.presetModalTab.set(tab);
    if (tab === 'create') {
      const hName = this.splitService.householdName();
      this.newPresetName.set(hName && hName !== 'My Household' ? `${hName} Template` : 'My Custom Flat Setup');
      this.newPresetDescription.set('');
      this.newPresetIncludeMembers.set(true);
      this.newPresetIncludeExpenses.set(true);
      // Default to cloud if signed in with Google, otherwise local
      this.newPresetStorageType.set(this.splitService.cloudSync.currentUser() ? 'cloud' : 'local');
    }
    this.presetSuccessNotification.set('');
    this.showPresetModal.set(true);
  }

  closePresetModal() {
    this.showPresetModal.set(false);
  }

  setPresetModalTab(tab: 'list' | 'create') {
    this.presetModalTab.set(tab);
    if (tab === 'create' && !this.newPresetName()) {
      const hName = this.splitService.householdName();
      this.newPresetName.set(hName && hName !== 'My Household' ? `${hName} Template` : 'My Custom Flat Setup');
    }
  }

  setPresetStorageChoice(choice: 'local' | 'cloud') {
    this.newPresetStorageType.set(choice);
  }

  async saveNewPresetAction() {
    const name = this.newPresetName().trim();
    if (!name) {
      alert('Please enter a name for your preset.');
      return;
    }

    const storageType = this.newPresetStorageType();
    if (storageType === 'cloud' && !this.splitService.cloudSync.currentUser()) {
      alert('Please sign in with Google first to save this preset to Cloud, or select "Save on this Device".');
      return;
    }

    await this.splitService.createPreset(
      name,
      this.newPresetDescription(),
      this.newPresetIncludeMembers(),
      this.newPresetIncludeExpenses(),
      storageType
    );

    this.newPresetName.set('');
    this.newPresetDescription.set('');
    this.presetSuccessNotification.set(
      `Preset "${name}" saved to ${storageType === 'cloud' ? 'Cloud (Google Account)' : 'Local Storage'}!`
    );
    this.presetModalTab.set('list');
    setTimeout(() => {
      this.presetSuccessNotification.set('');
    }, 4000);
  }

  loadCustomPresetAction(preset: CustomPreset) {
    this.splitService.loadCustomPreset(preset.id);
    this.closePresetModal();
  }

  async deleteCustomPresetAction(preset: CustomPreset, event?: Event) {
    if (event) event.stopPropagation();
    await this.splitService.deleteCustomPreset(preset.id);
  }

  // GOOGLE SIGN-IN ACTIONS
  async signInWithGoogleAction() {
    this.firebaseSetupError.set('');
    if (!this.splitService.cloudSync.isConfigured()) {
      const cfg = this.splitService.cloudSync.firebaseConfig();
      if (cfg) {
        this.firebaseApiKeyInput.set(cfg.apiKey || '');
        this.firebaseProjectIdInput.set(cfg.projectId || '');
      }
      this.showFirebaseSetupModal.set(true);
      return;
    }

    const success = await this.splitService.cloudSync.signInWithGoogle();
    if (success) {
      await this.splitService.syncCloudPresetsOnLogin();
    } else {
      const err = this.splitService.cloudSync.syncError();
      if (err && err !== 'Sign-in was cancelled.') {
        alert(err);
      }
    }
  }

  async saveFirebaseSetupAction() {
    const apiKey = this.firebaseApiKeyInput().trim();
    const projectId = this.firebaseProjectIdInput().trim();

    if (!apiKey || !projectId) {
      this.firebaseSetupError.set('Please enter both Firebase API Key and Project ID.');
      return;
    }

    const ok = this.splitService.cloudSync.saveConfig({ apiKey, projectId });
    if (ok) {
      this.showFirebaseSetupModal.set(false);
      this.firebaseSetupError.set('');
      const success = await this.splitService.cloudSync.signInWithGoogle();
      if (success) {
        await this.splitService.syncCloudPresetsOnLogin();
      }
    } else {
      this.firebaseSetupError.set(
        this.splitService.cloudSync.syncError() || 'Invalid Firebase configuration.'
      );
    }
  }

  closeFirebaseSetupModal() {
    this.showFirebaseSetupModal.set(false);
    this.firebaseSetupError.set('');
  }

  async signOutAccountAction() {
    await this.splitService.cloudSync.signOutAccount();
  }

  clearAllDataAction() {
    this.splitService.clearAllData();
    this.closePresetModal();
  }
}
