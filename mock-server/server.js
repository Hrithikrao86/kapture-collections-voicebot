require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = Number(process.env.PORT || 3000);
const ACCOUNT_ID = process.env.DEMO_ACCOUNT_ID || 'ACC-88392';
const CUSTOMER_NAME = process.env.DEMO_CUSTOMER_NAME || 'Rahul Sharma';
const VALID_CODES = new Set(
  (process.env.DEMO_VERIFICATION_CODES || '1234,1995')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
);

const dispositions = [];
const ptps = [];
const escalations = [];
const paymentLinks = [];

function maskName(name) {
  if (!name) return 'Unknown';
  const first = name.split(' ')[0];
  return `${first} S****`;
}

function audit(event, data = {}) {
  const safe = { ...data };
  if (safe.verification_code) safe.verification_code = '****';
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...safe
  }));
}

function toolResult(toolCallId, result) {
  return {
    results: [{
      toolCallId,
      result: JSON.stringify(result)
    }]
  };
}

function getToolCalls(body) {
  const message = body?.message;

  if (!message || message.type !== 'tool-calls') {
    return [];
  }

  const calls =
    message.toolCallList ||
    message.toolCalls ||
    message.toolCall ||
    [];

  if (!Array.isArray(calls)) {
    return [];
  }

  return calls.map((call) => {
    const functionData = call.function || {};

    return {
      id: call.id,
      name:
        call.name ||
        functionData.name ||
        call.function?.name ||
        call.tool?.name,
      args:
        call.arguments ??
        functionData.arguments ??
        call.parameters ??
        call.function?.arguments ??
        {}
    };
  });
}

function normalizeArgs(args) {
  if (typeof args === 'string') {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args || {};
}

function handleTool(name, rawArgs) {
  const args = normalizeArgs(rawArgs);

  switch (name) {
    case 'verify_customer': {
  console.log('VERIFY ARGS:', JSON.stringify(args));

  const accountId = String(args.account_id || '')
    .trim()
    .toUpperCase()
    .replace(/\//g, '-');

  const code = String(args.verification_code || '').trim();

  console.log('ACCOUNT:', accountId);
  console.log('CODE:', code);

  const verified =
    accountId === 'ACC-88392' &&
    code === '1234';

  console.log('VERIFIED:', verified);

  if (verified) {
    return {
      verified: true,
      customer_name: 'Rahul Sharma',
      message: 'Identity verified successfully. The customer is now verified and account details may be discussed.'
    };
  }

  return {
    verified: false,
    message: 'Identity verification failed. Do not disclose account information.'
  };
}

    case 'log_promise_to_pay': {
      if (args.account_id !== ACCOUNT_ID) return { success: false, message: 'Unknown account.' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.ptp_date || ''))) {
        return { success: false, message: 'Invalid PTP date. Use YYYY-MM-DD.' };
      }
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, message: 'Invalid PTP amount.' };
      }
      const ptp = {
        ptp_id: `PTP-${crypto.randomInt(1000, 10000)}`,
        account_id: args.account_id,
        confirmed_date: args.ptp_date,
        amount
      };
      ptps.push(ptp);
      audit('log_promise_to_pay', { account_id: args.account_id, ptp_date: args.ptp_date, amount });
      return { success: true, ...ptp };
    }

    case 'send_payment_link': {
      if (args.account_id !== ACCOUNT_ID) return { success: false, message: 'Unknown account.' };
      if (!['SMS', 'WhatsApp', 'BOTH'].includes(args.channel)) {
        return { success: false, message: 'Invalid channel.' };
      }
      const payment = {
        payment_link_id: `LINK-${crypto.randomInt(1000, 10000)}`,
        channel: args.channel,
        sent: true
      };
      paymentLinks.push({ account_id: args.account_id, ...payment });
      audit('send_payment_link', { account_id: args.account_id, channel: args.channel });
      return { success: true, message: `Payment link sent successfully via ${args.channel}.`, ...payment };
    }

    case 'escalate_to_agent': {
      if (args.account_id !== ACCOUNT_ID) return { success: false, message: 'Unknown account.' };
      if (!['HARDSHIP_REQUEST', 'DISPUTE', 'OTHER'].includes(args.reason)) {
        return { success: false, message: 'Invalid escalation reason.' };
      }
      const escalation = {
        escalation_id: `ESC-${crypto.randomInt(1000, 10000)}`,
        account_id: args.account_id,
        reason: args.reason,
        notes: String(args.notes || '')
      };
      escalations.push(escalation);
      audit('escalate_to_agent', { account_id: args.account_id, reason: args.reason });
      return { success: true, ...escalation };
    }

    case 'mark_disposition': {
      if (args.account_id !== ACCOUNT_ID) return { success: false, message: 'Unknown account.' };
      const allowed = new Set(['PTP_AGREED', 'ALREADY_PAID', 'DISPUTED', 'HARDSHIP_ESCALATED', 'WRONG_PERSON', 'DO_NOT_CALL', 'NO_RESPONSE']);
      if (!allowed.has(args.status)) return { success: false, message: 'Invalid disposition.' };
      const record = {
        disposition_id: `DISP-${crypto.randomInt(1000, 10000)}`,
        account_id: args.account_id,
        status: args.status,
        notes: String(args.notes || ''),
        timestamp: new Date().toISOString()
      };
      dispositions.push(record);
      audit('mark_disposition', { account_id: args.account_id, status: args.status });
      return { success: true, ...record };
    }

    default:
      return { success: false, message: `Unknown function: ${name}` };
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kapture-maya-mock-server' });
});

app.get('/demo/state', (_req, res) => {
  res.json({
    customer: { account_id: ACCOUNT_ID, name: maskName(CUSTOMER_NAME) },
    counts: {
      ptps: ptps.length,
      payment_links: paymentLinks.length,
      escalations: escalations.length,
      dispositions: dispositions.length
    }
  });
});

app.post('/webhook', (req, res) => {
  console.log('\n========== RAW VAPI REQUEST ==========');
  console.log(JSON.stringify(req.body, null, 2));

  const message = req.body?.message;

  if (!message) {
    return res.status(200).json({
      status: 'acknowledged'
    });
  }

  if (message.type !== 'tool-calls') {
    console.log('Non-tool event:', message.type);

    return res.status(200).json({
      status: 'acknowledged'
    });
  }

  const rawCalls =
    message.toolCallList ||
    message.toolCalls ||
    [];

  console.log('\n========== RAW TOOL CALLS ==========');
  console.log(JSON.stringify(rawCalls, null, 2));

  if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
    return res.status(200).json({
      results: []
    });
  }

  const results = rawCalls.map((call) => {

    const toolCallId = call.id;

    const functionName =
      call.name ||
      call.function?.name ||
      call.tool?.name;

    const rawArguments =
      call.arguments ??
      call.function?.arguments ??
      call.parameters ??
      call.function?.parameters ??
      {};

    const args = normalizeArgs(rawArguments);

    console.log('\n========== TOOL ==========');
    console.log('ID:', toolCallId);
    console.log('NAME:', functionName);
    console.log('ARGS:', JSON.stringify(args));

    const result = handleTool(functionName, args);

    console.log('RESULT:', JSON.stringify(result));

    return {
      toolCallId,
      result: JSON.stringify(result)
    };
  });

  const response = { results };

  console.log('\n========== RESPONSE ==========');
  console.log(JSON.stringify(response, null, 2));

  return res.status(200).json(response);
});

app.listen(PORT, () => {
  console.log(`Kapture Maya Mock Server running on http://localhost:${PORT}`);
});
