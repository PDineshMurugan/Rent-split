#!/usr/bin/env node
/**
 * SplitMate Model Context Protocol (MCP) Server
 *
 * Exposes SplitMate's core financial calculation algorithms, debt minimization,
 * roommate statement slips, and rent proration tools to AI assistants via JSON-RPC 2.0 stdio.
 */

const readline = require('readline');
const {
  splitExpense,
  minimizeSettlements,
  generateMonthlyReport,
  prorateRent,
} = require('./split-engine');

const SERVER_NAME = 'splitmate-mcp';
const SERVER_VERSION = '1.0.0';
const PROTOCOL_VERSION = '2024-11-05';

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendError(id, code, message, data) {
  send({
    jsonrpc: '2.0',
    id: id !== undefined ? id : null,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  });
}

function sendResult(id, result) {
  send({
    jsonrpc: '2.0',
    id,
    result,
  });
}

const TOOLS = [
  {
    name: 'split_expense',
    description:
      'Splits a single bill or expense among roommates with exact-cent balancing and multi-payer direct credits. Supports equal split, custom exact amounts, or percentage distributions.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: "Description of the bill or expense (e.g. 'April Rent', 'WiFi Broadband', 'Groceries')",
        },
        amount: {
          type: 'number',
          description: 'Total amount in rupees/currency',
        },
        participants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of roommate names sharing this expense',
        },
        splitType: {
          type: 'string',
          enum: ['equal', 'custom_amounts', 'custom_percentages'],
          description: "Split methodology: 'equal' (default), 'custom_amounts', or 'custom_percentages'",
        },
        customAmounts: {
          type: 'object',
          description: "Map of roommate name to exact amount (required if splitType is 'custom_amounts')",
          additionalProperties: { type: 'number' },
        },
        customPercentages: {
          type: 'object',
          description: "Map of roommate name to percentage (must sum to 100, required if splitType is 'custom_percentages')",
          additionalProperties: { type: 'number' },
        },
        payers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              roommate: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['roommate', 'amount'],
          },
          description: 'List of roommates who paid portions of this bill directly',
        },
      },
      required: ['amount', 'participants'],
    },
  },
  {
    name: 'minimize_debt_settlements',
    description:
      'Computes the minimal number of debt settlement transactions between roommates using greedy cash-flow simplification. Accepts either net balances or a list of raw expenses.',
    inputSchema: {
      type: 'object',
      properties: {
        balances: {
          type: 'object',
          description:
            'Map of roommate name to net balance (+ positive means they receive money, - negative means they owe money)',
          additionalProperties: { type: 'number' },
        },
        expenses: {
          type: 'array',
          description: 'Alternative to balances: an array of expense objects with { amount, participants, payers }',
          items: { type: 'object' },
        },
      },
    },
  },
  {
    name: 'generate_monthly_report',
    description:
      'Generates a comprehensive household expense report, roommate statement slips, net balances, WhatsApp copyable summary, and minimum settlement plan for a given month.',
    inputSchema: {
      type: 'object',
      properties: {
        householdName: {
          type: 'string',
          description: "Name of the flat/household (e.g. 'Flat 402 - Green Glen')",
        },
        month: {
          type: 'string',
          description: "Billing month (e.g. 'April 2026' or '2026-04')",
        },
        roommates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of all roommate names in the household',
        },
        expenses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              category: { type: 'string' },
              amount: { type: 'number' },
              participants: { type: 'array', items: { type: 'string' } },
              payers: { type: 'array', items: { type: 'object' } },
              splitType: { type: 'string' },
              customAmounts: { type: 'object' },
              customPercentages: { type: 'object' },
            },
            required: ['title', 'amount'],
          },
          description: 'All expenses recorded for the month',
        },
        payments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['from', 'to', 'amount'],
          },
          description: 'Recorded direct settlement payments already transferred between roommates',
        },
      },
      required: ['roommates', 'expenses'],
    },
  },
  {
    name: 'prorate_rent',
    description:
      'Calculates daily rate, prorated rent, and savings for a roommate who moved in or out partway through the month.',
    inputSchema: {
      type: 'object',
      properties: {
        monthlyRent: {
          type: 'number',
          description: 'Full monthly rent for the room/tenant',
        },
        totalDays: {
          type: 'number',
          description: 'Total days in the month (28, 29, 30, or 31). Default is 30',
        },
        daysStayed: {
          type: 'number',
          description: 'Number of days the tenant actually stayed/occupied',
        },
        roommateName: {
          type: 'string',
          description: "Roommate name (e.g. 'Rahul')",
        },
      },
      required: ['monthlyRent', 'daysStayed'],
    },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'split_expense': {
      const res = splitExpense(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      };
    }

    case 'minimize_debt_settlements': {
      const res = minimizeSettlements(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      };
    }

    case 'generate_monthly_report': {
      const res = generateMonthlyReport(args || {});
      return {
        content: [
          { type: 'text', text: JSON.stringify(res, null, 2) },
          { type: 'text', text: `\n### WhatsApp / Markdown Summary:\n\n${res.formattedReport}` },
        ],
      };
    }

    case 'prorate_rent': {
      const res = prorateRent(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

function processMessage(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    sendError(null, -32700, 'Parse error: invalid JSON', err.message);
    return;
  }

  const { id, method, params } = request;

  // Notifications (no id)
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      process.stderr.write(`[${SERVER_NAME}] Client completed initialization handshake.\n`);
    }
    return;
  }

  try {
    switch (method) {
      case 'initialize': {
        sendResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        });
        break;
      }

      case 'ping': {
        sendResult(id, {});
        break;
      }

      case 'tools/list': {
        sendResult(id, { tools: TOOLS });
        break;
      }

      case 'tools/call': {
        const toolName = params && params.name;
        const toolArgs = (params && params.arguments) || {};

        if (!toolName) {
          sendError(id, -32602, 'Invalid params: name is required');
          return;
        }

        handleToolCall(toolName, toolArgs)
          .then((output) => {
            sendResult(id, output);
          })
          .catch((err) => {
            sendResult(id, {
              content: [{ type: 'text', text: `Error executing ${toolName}: ${err.message}` }],
              isError: true,
            });
          });
        break;
      }

      default:
        sendError(id, -32601, `Method not found: ${method}`);
        break;
    }
  } catch (err) {
    sendError(id, -32603, 'Internal error', err.message);
  }
}

function main() {
  process.stderr.write(`[${SERVER_NAME}] SplitMate MCP Server starting on stdio...\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', processMessage);

  rl.on('close', () => {
    process.stderr.write(`[${SERVER_NAME}] Stdio stream closed, exiting.\n`);
    process.exit(0);
  });
}

main();
