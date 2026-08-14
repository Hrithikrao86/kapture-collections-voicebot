const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'mock-server');
const server = spawn(process.execPath, ['server.js'], {
  cwd: serverDir,
  env: { ...process.env, PORT: '3100', DEMO_ACCOUNT_ID: 'ACC-88392', DEMO_VERIFICATION_CODES: '1234,1995' },
  stdio: ['ignore', 'pipe', 'pipe']
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function request(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: 3100, path: '/webhook', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  await wait(700);

  let r = await request({ message: { type: 'tool-calls', toolCallList: [
    { id: '1', name: 'verify_customer', arguments: { account_id: 'ACC-88392', verification_code: '0000' } }
  ] } });
  let result = JSON.parse(r.results[0].result);
  assert.strictEqual(result.verified, false);

  r = await request({ message: { type: 'tool-calls', toolCallList: [
    { id: '2', name: 'verify_customer', arguments: { account_id: 'ACC-88392', verification_code: '1234' } }
  ] } });
  result = JSON.parse(r.results[0].result);
  assert.strictEqual(result.verified, true);

  r = await request({ message: { type: 'tool-calls', toolCallList: [
    { id: '3', name: 'log_promise_to_pay', arguments: { account_id: 'ACC-88392', ptp_date: '2026-08-14', amount: 8499 } },
    { id: '4', name: 'send_payment_link', arguments: { account_id: 'ACC-88392', channel: 'SMS' } }
  ] } });
  const results = r.results.map(x => JSON.parse(x.result));
  assert.strictEqual(results[0].success, true);
  assert.strictEqual(results[1].success, true);

  r = await request({ message: { type: 'tool-calls', toolCallList: [
    { id: '5', name: 'escalate_to_agent', arguments: { account_id: 'ACC-88392', reason: 'DISPUTE', notes: 'Customer disputes amount.' } },
    { id: '6', name: 'mark_disposition', arguments: { account_id: 'ACC-88392', status: 'DISPUTED', notes: 'Escalated.' } },
    { id: '7', name: 'mark_disposition', arguments: { account_id: 'ACC-88392', status: 'DO_NOT_CALL', notes: 'Customer requested DNC.' } }
  ] } });
  for (const item of r.results) assert.strictEqual(JSON.parse(item.result).success, true);

  console.log('PASS: authentication, PTP, payment link, escalation and disposition tool contracts.');
}

main()
  .catch(err => { console.error('FAIL:', err); process.exitCode = 1; })
  .finally(() => { server.kill('SIGTERM'); });
