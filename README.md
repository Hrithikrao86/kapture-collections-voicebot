# Kapture Finance — Maya Voice AI Collections Agent

A complete reference implementation for the Kapture Finance outbound collections assignment.

## What is included

- `docs/HLD_Document.md` — engineer-ready high-level design
- `docs/architecture.mmd` — Mermaid architecture diagram
- `vapi/system_prompt.txt` — state-enforced Vapi system prompt
- `vapi/tool_definitions.json` — Vapi custom function definitions
- `mock-server/server.js` — Express mock tool backend
- `mock-server/package.json` — Node.js dependencies/scripts
- `mock-server/.env.example` — configuration template
- `tests/test_cases.json` — evaluation matrix
- `tests/run_tests.js` — local webhook/tool contract tests
- `DEMO_SCRIPT.md` — 2–4 minute demo plan

## Architecture

Customer → Telephony/Vapi → Deepgram STT → GPT-4o orchestrator → Custom tools → Mock backend → ElevenLabs/Cartesia TTS → Customer.

The most important safety invariant is: **no debt information is disclosed until `verify_customer` returns `verified: true`.** The reference assignment explicitly requires this authentication gate. See the source assignment for the original requirement. fileciteturn0file0L41-L50

## Prerequisites

- Node.js 18+
- A Vapi account
- A Vapi assistant
- Deepgram transcriber configured in Vapi
- OpenAI model configured in Vapi
- ElevenLabs or Cartesia voice configured in Vapi
- Optional: ngrok for exposing the local webhook

## 1. Start the mock server

```bash
cd mock-server
npm install
cp .env.example .env
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## 2. Test the tools locally

From the repository root:

```bash
node tests/run_tests.js
```

The tests exercise authentication, PTP logging, payment-link dispatch, dispositions, DNC, and edge-case handling.

## 3. Expose the webhook

For local Vapi testing, expose the server with ngrok:

```bash
ngrok http 3000
```

Use the resulting HTTPS URL plus `/webhook` as the custom-tool server URL. Current Vapi documentation confirms that custom function tools send `tool-calls` requests to the configured server URL and expect a `results` array containing `toolCallId` and `result`. urlVapi Custom Tools documentationturn0search0

Vapi also documents a CLI forwarding workflow, but the CLI itself does not create the public tunnel; a separate tunnel such as ngrok is still required. urlVapi local webhook testing documentationturn0search3

## 4. Configure Vapi

Create a blank assistant and configure:

- Transcriber: Deepgram Nova-2
- LLM: OpenAI GPT-4o or another evaluator-approved model
- Temperature: 0.1
- Voice: ElevenLabs/Cartesia professional voice
- First message: `Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?`
- Add the five functions from `vapi/tool_definitions.json`
- Set their server URL to the public webhook URL
- Paste `vapi/system_prompt.txt` into the assistant's system prompt

Vapi currently recommends creating reusable custom tools from the Tools section and attaching them to the assistant. urlVapi Custom Tools documentationturn0search0

## 5. Required demo flows

### Happy path

1. Customer confirms they are Rahul.
2. Maya asks for the verification code.
3. Customer says `1234`.
4. `verify_customer` returns success.
5. Only now does Maya disclose the overdue amount.
6. Customer promises to pay Friday.
7. Maya calls `log_promise_to_pay`.
8. Maya calls `send_payment_link`.
9. Maya calls `mark_disposition(PTP_AGREED)` and closes.

### Edge path

Demonstrate one of:

- Already paid → `ALREADY_PAID`
- Dispute → `DISPUTED` + escalation
- Hardship → `HARDSHIP_ESCALATED`
- DNC → `DO_NOT_CALL` and immediate termination
- Wrong person → `WRONG_PERSON`

## Important implementation note

The assignment's sample backend omitted `escalate_to_agent` even though the business flow requires it. This implementation adds it so the documented dispute/hardship flows are actually executable. The assignment itself lists escalation as a required resolution path. fileciteturn0file0L45-L50

## Production hardening

This repository is intentionally a mock/demo backend. Before production, add:

- authenticated webhook requests/signature verification
- a real customer/account data service
- encrypted secrets and PII-safe structured logging
- persistent call/disposition storage
- idempotency for tool calls
- real DNC suppression enforcement before dialing
- authorization around payment-link creation
- human escalation/transfer integration
- rate limiting and abuse controls
- monitoring/tracing and alerting
- legal/compliance review for the actual calling jurisdiction and policy version
