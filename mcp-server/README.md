# SplitMate Model Context Protocol (MCP) Server

[![MCP Standard](https://img.shields.io/badge/MCP-2024--11--05-blue.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

A high-performance, zero-dependency Model Context Protocol (MCP) server for **SplitMate**. It exposes roommate rent splitting, bill sharing, debt minimization graphs, roommate statement slips, and rent proration algorithms directly to LLMs and AI coding assistants (such as Antigravity, Claude Desktop, Cursor, and VS Code).

---

## 🚀 Capabilities & Tools

### 1. `split_expense`
Splits any bill or expense across roommates with exact-cent balancing (ensuring remainder cents are distributed evenly) and multi-payer direct credits.
- **Split Modes**:
  - `equal` (default): Divides total among all selected roommates, preserving exact cents.
  - `custom_amounts`: Validates and allocates specific custom amounts per roommate.
  - `custom_percentages`: Allocates shares by custom percentages (must sum to 100%).
- **Multi-payer Support**: Supports bills split or paid by multiple roommates simultaneously.
- **Returns**: Breakdown per roommate with individual gross share, amount paid, and net balance.

### 2. `minimize_debt_settlements`
Simplifies complex multi-roommate debt webs into the minimal possible number of cash transfers using a greedy cash-flow simplification algorithm.
- Reduces $O(N^2)$ peer-to-peer debts into minimal $O(N)$ transfers.
- Accepts either net balances (e.g., `{ "Alice": 2000, "Bob": -1000, "Charlie": -1000 }`) or a list of raw expense objects.
- **Returns**: Minimal transfer plan with debtor, creditor, amount, and human-readable payment instruction.

### 3. `generate_monthly_report`
Generates a complete flat/household financial summary for an entire billing period.
- **Aggregates**: Category totals (Rent, WiFi, Electricity, Groceries, Maid, etc.).
- **Individual Roommate Slips**: Itemized list of bills each roommate participated in, their gross share, and direct credits.
- **WhatsApp / Chat Ready Text**: Generates a pre-formatted, emoji-friendly statement ready to copy-paste into household WhatsApp groups.
- **Integrated Settlement Plan**: Computes minimal settlement transfers to settle all flat accounts.

### 4. `prorate_rent`
Calculates daily rate and prorated rent for roommates moving in or out mid-month.
- Computes exact daily rate based on total days in the month (28, 29, 30, or 31).
- Calculates exact prorated rent and savings.

---

## 📦 Installation & Setup

### Requirements
- Node.js >= 18.0.0 (Zero external dependencies needed!)

### Quick Verification
Run the built-in test suite:
```bash
cd mcp-server
npm test
```

---

## 🔌 AI Assistant Configuration

### 1. Antigravity / Gemini CLI
Add to `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "splitmate": {
      "command": "node",
      "args": ["d:\\Web Development\\Rent-split\\mcp-server\\index.js"]
    }
  }
}
```

### 2. Claude Desktop
Add to your Claude Desktop configuration (`%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "splitmate": {
      "command": "node",
      "args": ["d:/Web Development/Rent-split/mcp-server/index.js"]
    }
  }
}
```

### 3. Cursor
Add to `.cursor/mcp.json` in your project root:
```json
{
  "mcpServers": {
    "splitmate": {
      "command": "node",
      "args": ["./mcp-server/index.js"]
    }
  }
}
```

### 4. VS Code (Cline / Roo Code)
Add to your Extension MCP Settings:
```json
{
  "mcpServers": {
    "splitmate": {
      "command": "node",
      "args": ["d:/Web Development/Rent-split/mcp-server/index.js"]
    }
  }
}
```

---

## 🛠️ Example Tool Usage Prompts

Once connected, your AI assistant can answer queries like:
- *"Split a ₹4,500 broadband bill equally between Alice, Bob, and Charlie where Alice paid ₹3,000 and Bob paid ₹1,500."*
- *"Here are our net balances: Alice +3000, Bob -1200, Charlie -1800. What is the minimum way to settle up?"*
- *"Rahul moved in on April 12th. Monthly rent is ₹18,000 for a 30-day month. What is his prorated rent?"*
- *"Generate the April 2026 household report for Flat 402 with rent ₹32,000, internet ₹1,200, and maid ₹3,000."*

---

## 📄 License
MIT © Dinesh Murugan

