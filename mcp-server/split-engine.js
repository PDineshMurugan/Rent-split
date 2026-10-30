/**
 * SplitMate Core Expense & Settlement Calculation Engine
 */

/**
 * Split an expense among participants with exact-cent rounding.
 */
function splitExpense({
  title = 'Expense',
  amount,
  participants,
  splitType = 'equal',
  customAmounts = {},
  customPercentages = {},
  payers = [],
}) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Expense amount must be a positive number.');
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('At least one participant is required.');
  }

  const cleanParticipants = participants.map((p) => String(p).trim()).filter(Boolean);
  const n = cleanParticipants.length;
  const shares = {};

  if (splitType === 'equal') {
    // Exact-cent division: base cents + distribute remainder
    const totalCents = Math.round(amount * 100);
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents % n;

    cleanParticipants.forEach((p, idx) => {
      const cents = baseCents + (idx < remainderCents ? 1 : 0);
      shares[p] = cents / 100;
    });
  } else if (splitType === 'custom_amounts') {
    let sum = 0;
    cleanParticipants.forEach((p) => {
      const share = Number(customAmounts[p] || 0);
      shares[p] = Math.round(share * 100) / 100;
      sum += shares[p];
    });
    const diff = Math.round((amount - sum) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      throw new Error(`Custom amounts sum to ₹${sum}, which does not match total ₹${amount} (difference: ₹${diff}).`);
    }
  } else if (splitType === 'custom_percentages') {
    let pctSum = 0;
    cleanParticipants.forEach((p) => {
      pctSum += Number(customPercentages[p] || 0);
    });
    if (Math.abs(pctSum - 100) > 0.01) {
      throw new Error(`Percentages must sum to 100%. Got ${pctSum}%.`);
    }

    let allocatedCents = 0;
    cleanParticipants.forEach((p, idx) => {
      if (idx === n - 1) {
        shares[p] = (Math.round(amount * 100) - allocatedCents) / 100;
      } else {
        const share = Math.round((amount * (customPercentages[p] / 100)) * 100) / 100;
        allocatedCents += Math.round(share * 100);
        shares[p] = share;
      }
    });
  } else {
    throw new Error(`Unknown split type: ${splitType}. Use equal, custom_amounts, or custom_percentages.`);
  }

  // Calculate who paid what
  const paidMap = {};
  cleanParticipants.forEach((p) => (paidMap[p] = 0));

  if (Array.isArray(payers) && payers.length > 0) {
    payers.forEach((item) => {
      const name = String(item.roommate || item.name || '').trim();
      const amt = Number(item.amount || 0);
      if (name) {
        paidMap[name] = (paidMap[name] || 0) + amt;
      }
    });
  }

  // Net position: paid - share (+ means you receive money, - means you owe money)
  const netBalances = {};
  const breakdown = [];

  const allPeople = Array.from(new Set([...cleanParticipants, ...Object.keys(paidMap)]));
  allPeople.forEach((person) => {
    const s = shares[person] || 0;
    const p = paidMap[person] || 0;
    const net = Math.round((p - s) * 100) / 100;
    netBalances[person] = net;
    breakdown.push({
      roommate: person,
      share: s,
      paid: p,
      netBalance: net,
      status: net > 0 ? `Receives ₹${net}` : net < 0 ? `Owes ₹${Math.abs(net)}` : 'Settled',
    });
  });

  return {
    title,
    amount,
    splitType,
    participants: cleanParticipants,
    shares,
    paidMap,
    netBalances,
    breakdown,
  };
}

/**
 * Greedy debt settlement minimization algorithm.
 * Takes roommate net balances and produces the minimum number of direct transfers.
 */
function minimizeSettlements(input) {
  const netBalances = {};

  if (!input) {
    return { netBalances: {}, totalTransactions: 0, totalDebtSettled: 0, transfers: [] };
  }

  // Handle wrapped arguments object { balances: ... } or { expenses: ... }
  let target = input;
  if (typeof input === 'object' && !Array.isArray(input)) {
    if (input.balances && typeof input.balances === 'object') {
      target = input.balances;
    } else if (Array.isArray(input.expenses)) {
      target = input.expenses;
    }
  }

  if (Array.isArray(target)) {
    // Could be list of { name, balance } or list of expense objects
    if (target.length > 0 && typeof target[0].balance === 'number') {
      target.forEach((item) => {
        netBalances[item.name || item.roommate] = Number(item.balance || 0);
      });
    } else {
      // List of expenses
      target.forEach((exp) => {
        const splitRes = splitExpense(exp);
        Object.entries(splitRes.netBalances).forEach(([person, net]) => {
          netBalances[person] = (netBalances[person] || 0) + net;
        });
      });
    }
  } else if (typeof target === 'object' && target !== null) {
    Object.entries(target).forEach(([k, v]) => {
      netBalances[k] = Number(v || 0);
    });
  }

  // Round balances to 2 decimals
  Object.keys(netBalances).forEach((k) => {
    netBalances[k] = Math.round(netBalances[k] * 100) / 100;
  });

  const debtors = [];
  const creditors = [];

  Object.entries(netBalances).forEach(([name, balance]) => {
    if (balance > 0.005) {
      creditors.push({ name, amount: balance });
    } else if (balance < -0.005) {
      debtors.push({ name, amount: Math.abs(balance) });
    }
  });

  // Sort descending by amount to minimize total steps
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let dIdx = 0;
  let cIdx = 0;
  let totalSettled = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount >= 0.01) {
      const roundedAmount = Math.round(amount * 100) / 100;
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: roundedAmount,
        note: `${debtor.name} pays ₹${roundedAmount.toLocaleString('en-IN')} to ${creditor.name}`,
      });
      totalSettled += roundedAmount;
    }

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount <= 0.005) dIdx++;
    if (creditor.amount <= 0.005) cIdx++;
  }

  return {
    netBalances,
    totalTransactions: transfers.length,
    totalDebtSettled: Math.round(totalSettled * 100) / 100,
    transfers,
  };
}

/**
 * Generate full monthly household expense report with category breakdown,
 * individual statements, and debt settlement plan.
 */
function generateMonthlyReport({
  householdName = 'My Flat',
  month = 'Current Month',
  roommates = [],
  expenses = [],
  payments = [],
}) {
  const allMembers = Array.from(new Set(roommates.map((r) => String(r).trim()).filter(Boolean)));
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Category summary
  const categories = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    categories[cat] = (categories[cat] || 0) + Number(e.amount || 0);
  });

  // Calculate shares and credits for each roommate
  const memberTotals = {};
  allMembers.forEach((m) => {
    memberTotals[m] = {
      roommate: m,
      grossShare: 0,
      paidDirectly: 0,
      paymentsSent: 0,
      paymentsReceived: 0,
      lineItems: [],
    };
  });

  expenses.forEach((e) => {
    const split = splitExpense({
      title: e.title,
      amount: e.amount,
      participants: e.participants || allMembers,
      splitType: e.splitType || 'equal',
      customAmounts: e.customAmounts,
      customPercentages: e.customPercentages,
      payers: e.payers || [],
    });

    Object.entries(split.shares).forEach(([person, share]) => {
      if (!memberTotals[person]) {
        memberTotals[person] = {
          roommate: person,
          grossShare: 0,
          paidDirectly: 0,
          paymentsSent: 0,
          paymentsReceived: 0,
          lineItems: [],
        };
      }
      memberTotals[person].grossShare += share;
      memberTotals[person].lineItems.push({
        title: e.title,
        amount: e.amount,
        share,
      });
    });

    Object.entries(split.paidMap).forEach(([person, paid]) => {
      if (memberTotals[person]) {
        memberTotals[person].paidDirectly += paid;
      }
    });
  });

  // Factor in direct recorded payments if any
  payments.forEach((p) => {
    if (memberTotals[p.from]) memberTotals[p.from].paymentsSent += Number(p.amount || 0);
    if (memberTotals[p.to]) memberTotals[p.to].paymentsReceived += Number(p.amount || 0);
  });

  // Calculate net balances and statements
  const statements = Object.values(memberTotals).map((st) => {
    const net = Math.round((st.paidDirectly + st.paymentsSent - st.grossShare - st.paymentsReceived) * 100) / 100;
    return {
      ...st,
      grossShare: Math.round(st.grossShare * 100) / 100,
      paidDirectly: Math.round(st.paidDirectly * 100) / 100,
      netBalance: net,
      status: net > 0 ? `Receives ₹${net}` : net < 0 ? `Owes ₹${Math.abs(net)}` : 'Settled',
    };
  });

  // Settlement plan
  const netBalances = {};
  statements.forEach((s) => (netBalances[s.roommate] = s.netBalance));
  const settlement = minimizeSettlements(netBalances);

  // Formatted WhatsApp text report
  let text = `*${householdName.toUpperCase()}*\n`;
  text += `*${month.toUpperCase()} EXPENSE REPORT*\n`;
  text += `--------------------------------\n\n`;
  text += `*TOTAL BILLS: ₹${totalExpenses.toLocaleString('en-IN')}*\n`;
  expenses.forEach((e) => {
    text += `- ${e.title}: ₹${Number(e.amount).toLocaleString('en-IN')}\n`;
  });

  text += `\n*NET BALANCES:*\n`;
  statements.forEach((st) => {
    text += `- ${st.roommate}: ${st.status} (Share: ₹${st.grossShare}, Paid: ₹${st.paidDirectly})\n`;
  });

  if (settlement.transfers.length > 0) {
    text += `\n*SETTLEMENT TRANSFERS:*\n`;
    settlement.transfers.forEach((tr, i) => {
      text += `${i + 1}. *${tr.from}* -> *${tr.to}*: ₹${tr.amount.toLocaleString('en-IN')}\n`;
    });
  } else {
    text += `\n*All debts are currently balanced & settled! 🎉*\n`;
  }

  return {
    householdName,
    month,
    totalExpenses,
    categoryBreakdown: categories,
    statements,
    settlementPlan: settlement.transfers,
    formattedReport: text,
  };
}

/**
 * Prorate rent based on days stayed in the billing month.
 */
function prorateRent({ monthlyRent, totalDays = 30, daysStayed, roommateName = 'Roommate' }) {
  if (typeof monthlyRent !== 'number' || monthlyRent <= 0) {
    throw new Error('monthlyRent must be a positive number.');
  }
  if (typeof totalDays !== 'number' || totalDays <= 0) {
    throw new Error('totalDays must be a positive number (typically 28, 30, or 31).');
  }
  if (typeof daysStayed !== 'number' || daysStayed < 0 || daysStayed > totalDays) {
    throw new Error(`daysStayed must be between 0 and ${totalDays}.`);
  }

  const dailyRate = monthlyRent / totalDays;
  const proratedAmount = Math.round(dailyRate * daysStayed * 100) / 100;
  const savings = Math.round((monthlyRent - proratedAmount) * 100) / 100;

  return {
    roommateName,
    fullMonthlyRent: monthlyRent,
    totalDaysInMonth: totalDays,
    daysStayed,
    dailyRate: Math.round(dailyRate * 100) / 100,
    proratedAmount,
    savings,
    summary: `${roommateName} stayed ${daysStayed}/${totalDays} days. Prorated rent: ₹${proratedAmount.toLocaleString('en-IN')} (saves ₹${savings.toLocaleString('en-IN')}).`,
  };
}

const INDUS_ANANTYA_PRESET = {
  id: 'preset_indus_anantya',
  name: 'Indus Anantya Apartments',
  description:
    '8 Roommates: Dinesh, Sadhusan, Delco, Mahi, Gangesh, Diswanth, thiru, Nasim • Rent ₹26,250, Internet ₹470 (Delco), Water ₹595 (Dinesh ₹280, Sadhusan ₹315), Washing Machine ₹664 (7 members)',
  householdName: 'Indus Anantya Apartments',
  roommateCount: 8,
  roommates: ['Dinesh', 'Sadhusan', 'Delco', 'Mahi', 'Gangesh', 'Diswanth', 'thiru', 'Nasim'],
  expenses: [
    {
      title: 'Rent',
      category: 'Rent',
      amount: 26250,
      participants: ['Dinesh', 'Sadhusan', 'Delco', 'Mahi', 'Gangesh', 'Diswanth', 'thiru', 'Nasim'],
      splitType: 'equal',
    },
    {
      title: 'Internet',
      category: 'Internet',
      amount: 470,
      participants: ['Dinesh', 'Sadhusan', 'Delco', 'Mahi', 'Gangesh', 'Diswanth', 'thiru', 'Nasim'],
      splitType: 'equal',
      payers: [{ roommate: 'Delco', amount: 470 }],
    },
    {
      title: 'Water (17 Cans)',
      category: 'Water Cans',
      amount: 595,
      participants: ['Dinesh', 'Sadhusan', 'Delco', 'Mahi', 'Gangesh', 'Diswanth', 'thiru', 'Nasim'],
      splitType: 'equal',
      payers: [
        { roommate: 'Dinesh', amount: 280 },
        { roommate: 'Sadhusan', amount: 315 },
      ],
    },
    {
      title: 'Washing Machine',
      category: 'Washing Machine',
      amount: 664,
      participants: ['Dinesh', 'Sadhusan', 'Delco', 'Mahi', 'Gangesh', 'Diswanth', 'thiru'],
      splitType: 'equal',
    },
  ],
};

module.exports = {
  splitExpense,
  minimizeSettlements,
  generateMonthlyReport,
  prorateRent,
  INDUS_ANANTYA_PRESET,
};
