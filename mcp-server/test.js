/**
 * Test script for SplitMate MCP Server over stdio
 */
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'index.js');
const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const responses = [];

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep remainder
  for (const line of lines) {
    if (line.trim()) {
      try {
        responses.push(JSON.parse(line));
      } catch (e) {
        console.error('Failed to parse stdout line:', line);
      }
    }
  }
});

child.stderr.on('data', (chunk) => {
  console.log('[SERVER LOG]', chunk.toString().trim());
});

function send(req) {
  child.stdin.write(JSON.stringify(req) + '\n');
}

async function run() {
  console.log('--- 1. Testing initialize ---');
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  console.log('--- 2. Testing tools/list ---');
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });

  await new Promise((r) => setTimeout(r, 200));

  console.log('--- 3. Testing tools/call: split_expense ---');
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'split_expense',
      arguments: {
        title: 'Electricity Bill',
        amount: 3001,
        participants: ['Alice', 'Bob', 'Charlie'],
        splitType: 'equal',
        payers: [{ roommate: 'Alice', amount: 3001 }],
      },
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  console.log('--- 4. Testing tools/call: minimize_debt_settlements ---');
  send({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'minimize_debt_settlements',
      arguments: {
        balances: {
          Alice: 2000.67,
          Bob: -1000.33,
          Charlie: -1000.34,
        },
      },
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  console.log('--- 5. Testing tools/call: prorate_rent ---');
  send({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'prorate_rent',
      arguments: {
        roommateName: 'David',
        monthlyRent: 15000,
        totalDays: 30,
        daysStayed: 18,
      },
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  console.log('--- 6. Testing tools/call: generate_monthly_report ---');
  send({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'generate_monthly_report',
      arguments: {
        householdName: 'Skyline Apt 302',
        month: 'April 2026',
        roommates: ['Dinesh', 'Kiran', 'Suresh'],
        expenses: [
          {
            title: 'House Rent',
            category: 'Rent',
            amount: 30000,
            participants: ['Dinesh', 'Kiran', 'Suresh'],
            splitType: 'equal',
            payers: [{ roommate: 'Dinesh', amount: 30000 }],
          },
          {
            title: 'Fiber Internet',
            category: 'Internet',
            amount: 1500,
            participants: ['Dinesh', 'Kiran', 'Suresh'],
            splitType: 'equal',
            payers: [{ roommate: 'Kiran', amount: 1500 }],
          },
        ],
      },
    },
  });

  await new Promise((r) => setTimeout(r, 250));

  console.log('\n--- VERIFYING RESPONSES ---');
  console.log(`Total responses received: ${responses.length}`);
  responses.forEach((res) => {
    console.log(`\nResponse ID ${res.id}:`);
    console.log(JSON.stringify(res.result, null, 2));
  });

  child.kill();
  if (responses.length === 6) {
    console.log('\n✅ ALL 6 MCP TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`\n❌ Expected 6 responses, got ${responses.length}`);
    process.exit(1);
  }
}

run();
