# SplitMate: Personal Roommate Expense & Rent Sharing App
## Complete Product Design & Functional Specification (Non-Technical)

---

## 1. App Vision & Core Philosophy

**SplitMate** is designed specifically for flatmates and roommates who share rent and recurring household bills. Unlike generic group-expense tools that can feel complex, SplitMate is built around the **monthly billing cycle** of a shared house:
- **Zero Accounting Jargon:** Uses familiar roommate terms like *"What was spent"*, *"Who already paid"*, *"Credit given"*, and *"What you owe"*.
- **Absolute Tally Certainty:** Every single rupee is accounted for. There are no mysterious unaccounted paise or "black-box" rounding errors.
- **Fair & Transparent Rounding:** Rounding adjustments are never dumped onto one person; fractional paise are allocated visibly and rotated fairly.
- **WhatsApp-First Communication:** One-tap generated personal slips and complete household breakdowns formatted for instant sharing.

---

## 2. Information Architecture & Navigation

The app is designed with a **mobile-first, card-based interface** with 5 primary sections:

1. **Dashboard (Monthly Home):** High-level snapshot of current month's total bills, paid credits, pending collections, and real-time Tally Status.
2. **Expenses & Bills:** List of all household expenses for the month, payers, inclusion tags, and split rules.
3. **Who Owes What (Individual Statements):** Member cards showing individual shares, personal credits, rounding, and net payable/receivable balances.
4. **Settlements & Payments:** Payment collection tracking (Unpaid / Partial / Paid) and suggested minimal-step settlement plan.
5. **History & Settings:** Archives of past months, persistent roommate management, default split rules, and export options.

---

## 3. Screen-by-Screen Content & User Flow

### Screen 1: Household Setup & Member Roster
* **Purpose:** Establish the shared home and maintain the roommate roster.
* **Header:** Household Name (e.g., *"Flat 402 - Green Valley"*), Current Active Month selector (e.g., *"October 2026"*).
* **Member Cards List:**
  - Member Avatar/Initials, Full Name, Contact Number (for WhatsApp sharing), and Status (*Active*, *Joined mid-month*, *Moved out*).
  - Effective Date selector for members who join or move out mid-cycle.
* **Primary Actions:**
  - `+ Add New Roommate`: Modal to enter name, phone number, and joined date.
  - `Edit Member Details`: Modify details or mark inactive (keeps historical records intact).
  - `Roll Over Roster`: Carries forward the exact roster to the next billing month automatically.

---

### Screen 2: Monthly Expenses Hub
* **Purpose:** Central repository of all costs incurred for the current billing cycle.
* **Top Summary Bar:**
  - Total Monthly Expenses: `₹XX,XXX`
  - Direct Member Payments (Credits): `₹XX,XXX`
  - Net Household Pool: `₹XX,XXX`
* **Expense Categories:**
  - Fixed Bills: Rent, Maintenance, Internet / Wi-Fi.
  - Utilities: Electricity, Water Cans, Cooking Gas Cylinder.
  - Shared Amenities: Washing Machine rental/instalment, Maid/Cook wages, Cleaning supplies.
  - Custom Categories: Roommates can create any tag (e.g., *"Balcony Plants"*, *"Pest Control"*).
* **Expense Entry Card:**
  - Expense Title (e.g., *"Bisleri Water Cans"*).
  - Category Badge & Date Incurred.
  - Amount: `₹595`.
  - Payer Tag: Shows who paid directly (e.g., *"Dinesh: ₹280 | Sadhusan: ₹315"*).
  - Participants Tag: *"All 8 Members"* or *"7 Members (Nasim excluded)"*.
  - Recurring Indicator: *"Repeats Monthly on 1st"*.
* **Actions:**
  - `+ Add Expense` button (floating bottom action bar).
  - Tap card to View Breakdown, Edit, or Delete (with confirmation dialog).

---

### Screen 3: Add / Edit Expense & Split Rule Drawer
* **Purpose:** Clean, guided form to record an expense without confusion.
* **Step-by-step inputs:**
  1. **Basic Info:** Name of bill, Total Amount, Date, Category, Optional receipt note.
  2. **Who Paid? (Payer Credit):**
     - Single Payer (e.g., Delco paid full ₹470).
     - Multiple Payers (e.g., Dinesh paid ₹280, Sadhusan paid ₹315).
     - Household Kitty / Landlord Direct (no individual credit).
  3. **Who Shares This Bill? (Participant Inclusion/Exclusion):**
     - Quick Preset: `Split Equally Among All Members`.
     - Custom Select: Toggle switches next to each roommate's name. A clear banner shows:
       > *"Included: 7 members (Dinesh, Sadhusan, Mahi, Delco, Gangesh, Diswanth, Thiru) | Excluded: 1 member (Nasim)"*
     - Custom Split Mode:
       - By Equal Split (auto-divides total by included member count).
       - By Exact Amounts (e.g., specific meter readings for AC rooms).
       - By Percentages (validates to 100%).
  4. **Recurring & Multi-Month Options:**
     - Toggle: *"Is this an instalment?"* (e.g., Month 2 of 6 for appliance purchase). The app remembers the selected participants for subsequent instalments.
     - Toggle: *"Repeat every month"*.
* **Validation Confirmation:** Shows preview of exact per-head cost before pressing `Save Expense`.

---

### Screen 4: Real-Time Tally Verification Banner
* **Purpose:** Absolute peace of mind that expenses, member credits, and collections balance to the exact rupee.
* **Visual States:**
  - 🟢 **Tally Matched:** *"All expenses match total collections & credits perfectly (₹0.00 difference)."*
  - 🟡 **Amount Short:** *"Collections are ₹X less than total expenses. Check rounding or missing member."*
  - 🔴 **Extra Amount:** *"Collections exceed total expenses by ₹X. Adjust member credits."*
* **Detailed Reconciliation Formula Box:**
  $$\text{Total Expenses Incurred} = \text{Direct Member Payments (Credits)} + \text{Remaining Balances to Collect}$$
* **Safety Lock:** If the tally does not match, the "Finalize Month" button remains disabled with a helpful checklist pointing out the discrepancy.

---

### Screen 5: Individual Member Statement (Roommate Slip)
* **Purpose:** Full transparency for each individual roommate so no one ever asks "Why am I paying this much?".
* **Card Header:** Member Name (e.g., *"Dinesh"*), Status Pill (*Pending / Paid*).
* **Written Step-by-Step Calculation:**
  1. **Common Share:**
     - Rent share (1/8 of ₹26,250): `₹3,281.25`
     - Internet share (1/8 of ₹470): `₹58.75`
     - Water cans share (1/8 of ₹595): `₹74.38`
  2. **Selected / Special Share:**
     - Washing machine (1/7 of ₹664): `₹94.86`
  3. **Gross Subtotal:** `₹3,509.24`
  4. **Less Credits (Already Paid by Dinesh):** `- ₹280.00` *(Water cans payment on 3rd Oct)*
  5. **Previous Balance Carried Forward:** `₹0.00`
  6. **Net Unrounded Amount:** `₹3,229.24`
  7. **Fair Rounding Adjustment:** `+ ₹0.77`
  8. **Final Payable Amount:** **`₹3,230`** (Whole Rupees)
* **Action:** `Share via WhatsApp` (generates formatted text message for that roommate only).

---

### Screen 6: Payments & Settlements Tracker
* **Purpose:** Monitor money coming in and show the easiest settlement route.
* **Status Badges:**
  - ⚪ `Unpaid` (Full balance due).
  - 🟡 `Partially Paid` (e.g., ₹2,000 paid of ₹3,229, ₹1,229 remaining).
  - 🟢 `Fully Paid` (Balance ₹0).
* **Log Payment Dialog:**
  - Member Name, Amount Received, Payment Date, Payment Mode (*Google Pay, PhonePe, Paytm, Bank Transfer, Cash*), Transaction Reference / Note.
  - Option to correct or refund an erroneous entry.
* **Smart Settlement Route (Debt Simplification):**
  - Roommates who paid more than their share (Creditors) vs. Roommates who owe money (Debtors).
  - Calculates the minimum number of transactions needed (e.g., *"Nasim pays ₹3,039 to Delco"* instead of 8 confusing cross-payments).

---

### Screen 7: Monthly Summary & WhatsApp Export
* **Purpose:** Complete high-level executive report for the flat manager.
* **Key Metrics Cards:**
  - Total Monthly Expenses: `₹27,979`
  - Already Paid by Roommates: `₹1,065`
  - Net to Collect from Roommates: `₹26,914`
  - Total Collected So Far: `₹XX,XXX`
  - Outstanding to Collect: `₹XX,XXX`
  - Tally Status: `Matched (100%)`
* **Expense Breakdown by Category:** Progress bars showing percentage spent on Rent, Utilities, Groceries, Appliances.
* **Export Actions:**
  - `Copy Full WhatsApp Summary`: Pre-formatted text message with clean emojis.
  - `Download Clean PDF / Print View`: For apartment notice boards or archival.
  - `Send Reminders to Pending Members`: Pre-composed friendly reminder message.

---

### Screen 8: Month Finalization & Historical Archives
* **Purpose:** Seal the month to prevent accidental edits once all dues are settled.
* **Finalization Safeguards:**
  - Pre-flight verification checklist:
    - [x] All expenses categorized and dated
    - [x] All member credits verified
    - [x] Rounding difference allocated & tally balanced
    - [x] All member payments logged
  - Locking: Once locked, expenses cannot be added, edited, or deleted.
* **Reopening Protocol:**
  - If a forgotten electricity bill arrives later, the owner can tap `Reopen Month`.
  - Prompts for a mandatory reason (e.g., *"Added delayed electricity bill of ₹840"*).
  - Records an activity audit trail and notifies of the adjustment.

---

## 4. Fair Rounding & Tally Rules

Splitting costs like ₹664 among 7 people produces fractional amounts ($₹94.85714...$). Real cash and UPI transfers require whole rupees. SplitMate implements the **Fair Allocation Rounding Rule**:

1. **Calculate Exact Unrounded Share:**
   Every member's exact fractional share is calculated to high precision (paise).
2. **Apply Exact Credits:**
   Deduct amounts already paid directly by members.
3. **Base Whole Rupee Rounding:**
   Round each member's net payable to the nearest integer.
4. **Tally Comparison:**
   $$\text{Rounding Discrepancy} = \text{Target Net Collection} - \sum (\text{Base Rounded Amounts})$$
   Typically, this discrepancy is only $+₹1$ or $+₹2$ (or $-₹1$).
5. **Fair Distribution:**
   - The discrepancy is given to the member(s) whose fractional share was closest to being rounded up (highest remaining fraction).
   - If two members have the identical fractional share, the app rotates the allocation monthly based on alphabetical or join order.
   - **Zero Secret Adjustments:** The individual statement explicitly shows:
     > *"Rounding adjustment: +₹0.77 (Rounded to make total tally exact)"*

---

## 5. Walkthrough of Example Test Scenario

### Household: 8 Members
`Dinesh, Sadhusan, Mahi, Delco, Gangesh, Diswanth, Thiru, Nasim`

### Expenses Incurred:
1. **Rent:** `₹26,250` (Shared by all 8 members)
2. **Internet:** `₹470` (Shared by all 8 members, **paid in advance by Delco**)
3. **Water Cans:** `₹595` (Shared by all 8 members, **paid in advance: Dinesh ₹280, Sadhusan ₹315**)
4. **Washing Machine:** `₹664` (Shared by **7 members**, **Nasim excluded**)

---

### Step 1: Breakdown of Shares Before Credits

* **Common Share per person (8 members):**
  - Rent: $\frac{₹26,250}{8} = ₹3,281.25$
  - Internet: $\frac{₹470}{8} = ₹58.75$
  - Water Cans: $\frac{₹595}{8} = ₹74.375$
  - **Base Common Cost per member:** $3281.25 + 58.75 + 74.375 = \mathbf{₹3,414.375}$

* **Special Share (Washing Machine - 7 members):**
  - Cost per included member: $\frac{₹664}{7} \approx \mathbf{₹94.85714}$
  - Nasim's share: $\mathbf{₹0.00}$ (Excluded)

* **Gross Liability Before Credits:**
  - **Nasim:** $₹3,414.375$
  - **Other 7 Members:** $3,414.375 + 94.85714 = \mathbf{₹3,509.23214}$ each.

* **Total Verification:**
  $$(7 \times 3,509.23214) + (1 \times 3,414.375) = 24,564.625 + 3,414.375 = \mathbf{₹27,979.00} \quad \checkmark$$

---

### Step 2: Applying Payer Credits

| Member | Gross Share | Credits Paid | Net Unrounded Payable |
| :--- | :--- | :--- | :--- |
| **Dinesh** | ₹3,509.232 | ₹280.00 *(Water)* | **₹3,229.232** |
| **Sadhusan** | ₹3,509.232 | ₹315.00 *(Water)* | **₹3,194.232** |
| **Delco** | ₹3,509.232 | ₹470.00 *(Internet)* | **₹3,039.232** |
| **Mahi** | ₹3,509.232 | ₹0.00 | **₹3,509.232** |
| **Gangesh** | ₹3,509.232 | ₹0.00 | **₹3,509.232** |
| **Diswanth** | ₹3,509.232 | ₹0.00 | **₹3,509.232** |
| **Thiru** | ₹3,509.232 | ₹0.00 | **₹3,509.232** |
| **Nasim** | ₹3,414.375 | ₹0.00 | **₹3,414.375** |
| **Total** | **₹27,979.00** | **₹1,065.00** | **₹26,914.00** |

$$\text{Net Amount to Collect from Household} = ₹27,979.00 - ₹1,065.00 = \mathbf{₹26,914.00}$$

---

### Step 3: Fair Rounding Allocation to Whole Rupees

* Sum of integer floors:
  $$3229 + 3194 + 3039 + 3509 + 3509 + 3509 + 3509 + 3414 = \mathbf{₹26,912}$$
* Rounding gap to reach target ₹26,914:
  $$₹26,914 - ₹26,912 = \mathbf{+₹2}$$
* Remaining fractional decimal values:
  - Nasim: `.375` (Highest remainder!) $\rightarrow$ receives $+₹1$ adjustment $\rightarrow$ **₹3,415**
  - The other 7 members all have remainder `.232`.
  - Next $+₹1$ is allocated transparently to the first in roster order (**Dinesh**) $\rightarrow$ **₹3,230** (or rotated monthly).
  - All other members stay at base rounded amount.

### Final Payable Roster:
1. **Dinesh:** **₹3,230** *(₹3,509.23 share − ₹280 paid + ₹0.77 rounding)*
2. **Sadhusan:** **₹3,194** *(₹3,509.23 share − ₹315 paid − ₹0.23 rounding)*
3. **Delco:** **₹3,039** *(₹3,509.23 share − ₹470 paid − ₹0.23 rounding)*
4. **Mahi:** **₹3,509** *(₹3,509.23 share − ₹0.23 rounding)*
5. **Gangesh:** **₹3,509** *(₹3,509.23 share − ₹0.23 rounding)*
6. **Diswanth:** **₹3,509** *(₹3,509.23 share − ₹0.23 rounding)*
7. **Thiru:** **₹3,509** *(₹3,509.23 share − ₹0.23 rounding)*
8. **Nasim:** **₹3,415** *(₹3,414.38 share + ₹0.62 rounding)*

$$\text{Total Collected} = 3230 + 3194 + 3039 + 3509 + 3509 + 3509 + 3509 + 3415 = \mathbf{₹26,914.00} \quad \checkmark$$
$$\text{Total Expenses Accounted For} = ₹26,914 + ₹1,065 = \mathbf{₹27,979.00} \quad \mathbf{[Tally\ Matched\ 100\%]}$$

---

## 6. Pre-Formatted WhatsApp Message Templates

### Template A: Household Monthly Summary (Sent to Group)
```text
🏡 *FLAT 402 EXPENSE REPORT - OCTOBER 2026*
───────────────────────────────
💰 *TOTAL EXPENSES:* ₹27,979
• Rent (8 members): ₹26,250
• Internet (8 members): ₹470
• Water Cans (8 members): ₹595
• Washing Machine (7 members): ₹664

💳 *PAID DIRECTLY BY MEMBERS:*
• Delco: ₹470 (Internet)
• Sadhusan: ₹315 (Water Cans)
• Dinesh: ₹280 (Water Cans)
Total Paid: ₹1,065

📊 *FINAL AMOUNT TO PAY:*
1. Dinesh: ₹3,230
2. Sadhusan: ₹3,194
3. Delco: ₹3,039
4. Mahi: ₹3,509
5. Gangesh: ₹3,509
6. Diswanth: ₹3,509
7. Thiru: ₹3,509
8. Nasim: ₹3,415
───────────────────────────────
Total to Collect: ₹26,914
✅ *Tally Status: Matched (₹27,979 accounted)*
📅 Payment Due: 5th of this month. Please send screenshot after paying!
```

### Template B: Individual Slip (Sent to Dinesh)
```text
👋 Hi Dinesh, here is your breakdown for *October 2026*:

📋 *Your Expense Shares:*
• Rent (1/8): ₹3,281.25
• Internet (1/8): ₹58.75
• Water Cans (1/8): ₹74.38
• Washing Machine (1/7): ₹94.86
Gross Share: ₹3,509.23

💳 *Your Paid Credits:*
• Water Cans payment: - ₹280.00

⚖️ *Rounding Adjustment:* + ₹0.77
───────────────────────────────
👉 *Net Amount to Pay:* *₹3,230*
───────────────────────────────
Please pay to the flat fund / UPI before the due date. Thanks!
```

---

## 7. Error Prevention & Validation Safeguards

1. **Missing Payer Alert:** If an expense has an amount but no payer selected, warn: *"Please choose who paid this bill (Roommate or Common Fund)."*
2. **Empty Sharing Group:** If all roommate checkboxes are untoggled, warn: *"At least one roommate must be included in this expense."*
3. **Credit Over-limit:** If member payments exceed the bill amount (e.g., entered ₹600 for a ₹595 water bill), show: *"Total payments exceed bill amount by ₹5. Please verify."*
4. **Duplicate Expense Alert:** If an expense with the same name, amount, and date is entered twice within 24 hours, warn: *"Possible duplicate bill detected: 'Water Cans - ₹595'. Confirm if this is separate."*
5. **Reopening Safety:** Finalized months can only be edited with an explicit confirmation step, preventing accidental overwrites.
