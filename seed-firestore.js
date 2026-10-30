/**
 * Seed Firestore with Indus Anantya Apartments preset and household data
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyD49VMslF8k0BDLmB5i8985PTFnKZDkxmw',
  authDomain: 'rentspliterdm.firebaseapp.com',
  projectId: 'rentspliterdm',
  storageBucket: 'rentspliterdm.firebasestorage.app',
  messagingSenderId: '468208014194',
  appId: '1:468208014194:web:b295c0cc6043a6561883eb',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const members = [
  { id: 'mem_dinesh', name: 'Dinesh', isActive: true, avatarColor: '#10b981' },
  { id: 'mem_sadhusan', name: 'Sadhusan', isActive: true, avatarColor: '#3b82f6' },
  { id: 'mem_delco', name: 'Delco', isActive: true, avatarColor: '#f59e0b' },
  { id: 'mem_mahi', name: 'Mahi', isActive: true, avatarColor: '#8b5cf6' },
  { id: 'mem_gangesh', name: 'Gangesh', isActive: true, avatarColor: '#ec4899' },
  { id: 'mem_diswanth', name: 'Diswanth', isActive: true, avatarColor: '#06b6d4' },
  { id: 'mem_thiru', name: 'thiru', isActive: true, avatarColor: '#84cc16' },
  { id: 'mem_nasim', name: 'Nasim', isActive: true, avatarColor: '#f97316' },
];

const allMemberIds = members.map((m) => m.id);
const washingMachineMemberIds = members.filter((m) => m.id !== 'mem_nasim').map((m) => m.id);

const expenses = [
  {
    id: 'e_indus_rent',
    title: 'Rent',
    category: 'Rent',
    amount: 26250,
    date: '2026-10-01',
    monthKey: '2026-10',
    isRecurring: true,
    splitType: 'equal',
    participants: allMemberIds,
    payers: [],
  },
  {
    id: 'e_indus_internet',
    title: 'Internet',
    category: 'Internet',
    amount: 470,
    date: '2026-10-01',
    monthKey: '2026-10',
    isRecurring: true,
    splitType: 'equal',
    participants: allMemberIds,
    payers: [{ memberId: 'mem_delco', amount: 470 }],
  },
  {
    id: 'e_indus_water',
    title: 'Water (17 Cans)',
    category: 'Water Cans',
    amount: 595,
    date: '2026-10-01',
    monthKey: '2026-10',
    notes: '17 water cans @ ₹35/can. Dinesh paid ₹280, Sadhusan paid ₹315.',
    isRecurring: false,
    splitType: 'equal',
    participants: allMemberIds,
    payers: [
      { memberId: 'mem_dinesh', amount: 280 },
      { memberId: 'mem_sadhusan', amount: 315 },
    ],
  },
  {
    id: 'e_indus_washing_machine',
    title: 'Washing Machine',
    category: 'Washing Machine',
    amount: 664,
    date: '2026-10-01',
    monthKey: '2026-10',
    notes: 'Shared among 7 roommates (664 / 7 = ₹95 each). Nasim excluded.',
    isRecurring: true,
    splitType: 'selected',
    participants: washingMachineMemberIds,
    payers: [],
  },
];

const preset = {
  id: 'preset_indus_anantya',
  name: 'Indus Anantya Apartments',
  description:
    '8 Roommates: Dinesh, Sadhusan, Delco, Mahi, Gangesh, Diswanth, thiru, Nasim • Rent ₹26,250, Internet ₹470 (Delco), Water ₹595 (Dinesh ₹280, Sadhusan ₹315), Washing Machine ₹664 (7 members)',
  createdAt: 'Oct 2026',
  householdName: 'Indus Anantya Apartments',
  roommateCount: 8,
  expenseCount: 4,
  totalExpenseAmount: 27979,
  storageType: 'cloud',
  members,
  expenses,
};

const householdPayload = {
  householdId: 'INDUS-ANANTYA',
  householdName: 'Indus Anantya Apartments',
  updatedAt: new Date().toISOString(),
  ownerEmail: 'dineshmurugan518@gmail.com',
  currentMonthKey: '2026-10',
  members,
  months: [
    {
      key: '2026-10',
      name: 'October 2026',
      dueDate: '2026-10-05',
      isFinalized: false,
      previousBalanceCarryOver: {},
    },
  ],
  expenses,
  payments: [],
  auditLogs: [
    {
      id: 'audit_' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'Preset Seeded',
      details: 'Created Indus Anantya Apartments preset for dineshmurugan518@gmail.com',
    },
  ],
  customPresets: [preset],
};

async function seed() {
  try {
    console.log('Seeding households/INDUS-ANANTYA for dineshmurugan518@gmail.com...');
    await setDoc(doc(db, 'households', 'INDUS-ANANTYA'), householdPayload);
    console.log('✅ Successfully seeded Indus Anantya Apartments into Firestore under private code INDUS-ANANTYA!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed Firestore:', err);
    process.exit(1);
  }
}

seed();

