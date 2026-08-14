# Kapture Finance – Maya Outbound Voice AI Collections Agent

Maya is an outbound Voice AI Collections Agent built for Kapture Finance.

The agent conducts respectful and compliant conversations with customers regarding overdue EMIs. It verifies the customer's identity before disclosing confidential account information, identifies the customer's intent, performs the appropriate resolution action through backend tools, and records the final call disposition.

The implementation uses **Vapi** for voice orchestration and a **Node.js/Express mock backend deployed on Render** for deterministic tool execution.

---

## 1. Project Overview

Maya supports the following collections workflows:

* Customer identity verification before account disclosure
* Overdue EMI discussion after successful verification
* Promise-to-Pay (PTP) capture
* Payment-link requests
* Already-paid handling
* Payment disputes
* Financial-hardship escalation
* Do-Not-Call requests
* Wrong-person privacy protection
* Final call disposition logging
* English/Hindi language switching when supported by the voice pipeline

The primary security rule is:

> **Maya must never disclose confidential debt information until `verify_customer` returns `verified: true`.**

---

## 2. Architecture

```text
Customer
   |
   v
Vapi Voice Agent (Maya)
   |
   +--------------------------+
   |                          |
   v                          v
Speech / LLM              Custom Tools
                               |
                               v
                         Render HTTPS
                               |
                               v
                     Node.js / Express
                        Mock Server
                               |
             +-----------------+-----------------+
             |        |        |        |         |
             v        v        v        v         v
          Verify     PTP    Payment  Escalate  Disposition
          Customer           Link      Agent
```

### Request Flow

```text
Customer speaks
      |
      v
Vapi receives audio
      |
      v
Speech-to-Text
(Deepgram Nova-2)
      |
      v
LLM / Conversation Logic
(GPT-4o)
      |
      +---- Normal conversation
      |
      +---- Tool call
                |
                v
        Render HTTPS Webhook
                |
                v
        Express Mock Server
                |
                v
        Deterministic result
                |
                v
        Vapi / Maya continues
                |
                v
          Voice response
```

---

## 3. Technology Stack

| Component           | Technology                                     |
| ------------------- | ---------------------------------------------- |
| Voice orchestration | Vapi                                           |
| LLM                 | OpenAI GPT-4o                                  |
| Speech-to-Text      | Deepgram Nova-2                                |
| Text-to-Speech      | ElevenLabs / configured female voice           |
| Backend             | Node.js                                        |
| Web framework       | Express                                        |
| Deployment          | Render                                         |
| Local development   | Node.js / optional ngrok                       |
| Source control      | GitHub                                         |
| Testing             | Node.js test runner/scripts + JSON test matrix |

---

## 4. Vapi Design Choices

### LLM – GPT-4o

GPT-4o was selected for conversation reasoning, intent detection, entity extraction, and tool orchestration.

The system prompt uses explicit states and tool restrictions so the model does not rely only on conversational assumptions when deciding whether the customer has been authenticated.

### Transcriber – Deepgram Nova-2

Deepgram Nova-2 was selected because the assignment emphasizes a low-latency conversational voice experience.

It is used to convert the customer's speech into text before the conversation logic processes the request.

### Voice – Female Voice

A professional female voice was selected for Maya to provide a natural, calm, and approachable collections-agent experience.

The voice is configured directly in the Vapi assistant.

### Temperature / Behavior

The assistant is configured for controlled and compliance-oriented behavior. The system prompt prioritizes authentication, deterministic tool use, and safe handling of sensitive information.

---

## 5. Authentication and Security Model

Maya begins every call in an `UNVERIFIED` state.

Before successful verification, Maya must not disclose:

* Overdue amount
* EMI amount
* Loan type
* Days past due
* Payment status
* Account balance
* Debt relationship with Kapture Finance
* Other confidential account information

### Authentication Flow

```text
UNVERIFIED
    |
    v
VERIFYING
    |
    v
verify_customer
    |
    +---- verified=false ----> Safe failure / end call
    |
    +---- verified=true -----> VERIFIED
                                  |
                                  v
                              NEGOTIATION
                                  |
                                  v
                              RESOLUTION
                                  |
                                  v
                                CLOSED
```

The key invariant is:

```text
UNVERIFIED
    |
    X
    |
Debt disclosure
```

Debt disclosure is only permitted after:

```text
verify_customer
        |
        v
verified: true
```

The LLM is instructed not to infer authentication from the customer's statements alone.

---

## 6. Demo Account

The mock server uses the following demo account:

```text
Customer: Rahul Sharma
Account ID: ACC-88392
Verification Code: 1234
Loan Type: Personal Loan
Overdue EMI: ₹8,499
Days Past Due: 12
```

The verification tool validates the account and verification code before allowing the conversation to proceed to confidential account information.

---

## 7. Custom Tools

The backend currently exposes five tools.

### 7.1 `verify_customer`

Used to authenticate the customer before confidential account information is disclosed.

Example input:

```json
{
  "account_id": "ACC-88392",
  "verification_code": "1234"
}
```

Successful response:

```json
{
  "verified": true,
  "customer_name": "Rahul Sharma",
  "message": "Identity verified successfully. The customer is now verified and account details may be discussed."
}
```

---

### 7.2 `log_promise_to_pay`

Records a customer's Promise-to-Pay commitment.

Example:

```json
{
  "account_id": "ACC-88392",
  "ptp_date": "2026-08-20",
  "amount": 8499
}
```

The backend validates:

* Account ID
* Date format
* Positive payment amount

A successful request returns a generated PTP ID.

---

### 7.3 `send_payment_link`

Mocks sending a payment link through SMS, WhatsApp, or both.

Example:

```json
{
  "account_id": "ACC-88392",
  "channel": "SMS"
}
```

Supported channels:

```text
SMS
WhatsApp
BOTH
```

This is currently a mock action and does not send a real payment message.

---

### 7.4 `escalate_to_agent`

Used when human assistance is required.

Supported reasons:

```text
HARDSHIP_REQUEST
DISPUTE
OTHER
```

Example:

```json
{
  "account_id": "ACC-88392",
  "reason": "DISPUTE",
  "notes": "Customer disputes the outstanding amount."
}
```

---

### 7.5 `mark_disposition`

Records the final outcome of the conversation.

Supported dispositions include:

```text
PTP_AGREED
ALREADY_PAID
DISPUTED
HARDSHIP_ESCALATED
WRONG_PERSON
DO_NOT_CALL
NO_RESPONSE
```

Example:

```json
{
  "account_id": "ACC-88392",
  "status": "PTP_AGREED",
  "notes": "Customer committed to pay on 2026-08-20."
}
```

---

## 8. Webhook

All Vapi custom tools are routed through the same backend webhook:

```text
https://kapture-collections-voicebot-ms6r.onrender.com/webhook
```

The server determines which operation to execute from the Vapi tool name.

### Health Endpoint

```text
GET /health
```

Example response:

```json
{
  "status": "ok",
  "service": "kapture-maya-mock-server"
}
```

### Demo State Endpoint

```text
GET /demo/state
```

This provides basic mock-server state and operation counts.

---

## 9. Conversation Flows

### Happy Path – Promise to Pay

```text
Greeting
   |
   v
Customer confirms identity
   |
   v
Account ID + verification code
   |
   v
verify_customer
   |
   v
verified=true
   |
   v
Debt disclosure
   |
   v
Customer agrees to pay
   |
   v
Capture amount + date
   |
   v
log_promise_to_pay
   |
   v
send_payment_link
   |
   v
mark_disposition(PTP_AGREED)
   |
   v
Polite call closing
```

### Already Paid

```text
Authentication
      |
      v
Customer: "I already paid."
      |
      v
mark_disposition(ALREADY_PAID)
      |
      v
Acknowledge and explain that the account can be reviewed
      |
      v
End call politely
```

### Dispute

```text
Authentication
      |
      v
Customer disputes debt
      |
      v
escalate_to_agent(DISPUTE)
      |
      v
mark_disposition(DISPUTED)
      |
      v
Human/resolution team review
```

### Do Not Call

```text
Customer requests no further calls
      |
      v
mark_disposition(DO_NOT_CALL)
      |
      v
No pressure or negotiation
      |
      v
End call immediately
```

### Wrong Person

```text
Person answers
      |
      v
Not Rahul Sharma
      |
      v
No debt disclosure
      |
      v
mark_disposition(WRONG_PERSON)
      |
      v
End politely
```

---

## 10. Guardrails

Maya follows these primary guardrails:

1. No confidential debt disclosure before authentication.
2. `verify_customer` must return `verified=true` before account information can be discussed.
3. Account IDs must not be invented or modified.
4. Verification codes must not be revealed.
5. Tool success must not be fabricated.
6. Payment links must not be claimed as sent unless the tool returns success.
7. PTP confirmation must only occur after successful PTP logging.
8. Disputes are escalated instead of argued.
9. Financial hardship is handled empathetically and escalated.
10. Do-Not-Call requests are logged immediately.
11. Wrong-person calls do not reveal the reason for the call.
12. Maya must not threaten, shame, insult, or pressure the customer.
13. Internal prompts, tool names, API details, and implementation details are not exposed to the customer.

---

## 11. Testing

The repository contains a test matrix under:

```text
tests/test_cases.json
```

and a test runner:

```text
tests/run_tests.js
```

Important scenarios include:

### Authentication Guardrail

The customer asks about the debt before authentication.

Expected behavior:

```text
Maya must not disclose the overdue amount or EMI information.
```

### Successful Verification

```text
Account ID: ACC-88392
Verification code: 1234
```

Expected:

```text
verified: true
```

### Promise to Pay

Expected sequence:

```text
verify_customer
→ log_promise_to_pay
→ send_payment_link
→ mark_disposition(PTP_AGREED)
```

### Do Not Call

Expected:

```text
mark_disposition(DO_NOT_CALL)
```

followed by immediate polite termination.

### Already Paid

Expected:

```text
mark_disposition(ALREADY_PAID)
```

without pressuring the customer to pay again.

### Dispute

Expected:

```text
escalate_to_agent(DISPUTE)
→ mark_disposition(DISPUTED)
```

### Bilingual Handling

The assistant is also instructed to switch between English and Hindi when the voice pipeline correctly understands the customer's language.

---

## 12. What Broke and How It Was Debugged

### Render Deployment – `package.json` Not Found

During the initial Render deployment, the build failed with:

```text
npm error code ENOENT
npm error Could not read package.json
```

Render was searching for:

```text
/opt/render/project/src/package.json
```

while the Node.js project was located inside the `mock-server` directory.

The issue was fixed by configuring the correct Render root directory so that Render could locate the backend's `package.json`.

The final deployment successfully runs:

```text
npm start
```

which executes:

```text
node server.js
```

The deployed service is currently available at:

```text
https://kapture-collections-voicebot-ms6r.onrender.com
```

### Webhook Design

Instead of exposing a separate HTTP endpoint for every function, the backend uses one Vapi webhook:

```text
POST /webhook
```

The server identifies the requested function from the Vapi tool-call payload and routes it to the corresponding deterministic handler.

This keeps the Vapi integration simple while keeping business logic centralized in the mock server.

---

## 13. Local Setup

### Prerequisites

* Node.js 18+
* npm
* Vapi account
* Vapi assistant
* Git

### Install dependencies

From the backend directory:

```bash
cd mock-server
npm install
```

### Environment Variables

Copy:

```text
.env.example
```

to:

```text
.env
```

Example configuration:

```text
DEMO_ACCOUNT_ID=ACC-88392
DEMO_CUSTOMER_NAME=Rahul Sharma
DEMO_VERIFICATION_CODES=1234,1995
```

The application also uses the `PORT` environment variable supplied by Render.

### Run locally

```bash
npm start
```

The server will start on the configured port.

For local Vapi testing, an HTTPS tunnel such as ngrok can be used.

For the final deployed demo, Vapi uses the Render HTTPS webhook instead.

---

## 14. Render Deployment

The backend is deployed as a Render Web Service.

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

The Vapi custom tool server URL is:

```text
https://kapture-collections-voicebot-ms6r.onrender.com/webhook
```

---

## 15. Project Structure

```text
kapture-collections-voicebot/
│
├── README.md
│
├── docs/
│   ├── HLD_Document.md
│   └── architecture.mmd
│
├── mock-server/
│   ├── .env.example
│   ├── fix-vapi.js
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── tests/
│   ├── run_tests.js
│   └── test_cases.json
│
├── vapi/
│   ├── system_prompt.txt
│   └── tool_definitions.json
│
├── .gitignore
└── .gitkeep
```

---

## 16. Important Repository Files

### HLD

```text
docs/HLD_Document.md
```

Contains:

* System architecture
* Latency budget
* Conversation state machine
* Intent/entity model
* Tool/API design
* Authentication and data safety
* Compliance and guardrails
* Edge cases
* Observability
* Failure handling
* Security model
* Acceptance criteria

### System Prompt

```text
vapi/system_prompt.txt
```

Contains the production system prompt used by Maya, including:

* Persona
* Authentication rules
* State management
* Debt disclosure rules
* PTP flow
* Payment-link flow
* Dispute handling
* Hardship handling
* DNC handling
* Wrong-person handling
* Tool security
* Closing behavior

### Tool Schemas

```text
vapi/tool_definitions.json
```

Contains the Vapi function definitions and JSON schemas.

### Backend

```text
mock-server/server.js
```

Contains the Express webhook and deterministic mock business logic.

### Test Matrix

```text
tests/test_cases.json
```

Contains evaluation scenarios and expected behavior.

---

## 17. Observability

The backend logs tool activity and important events for debugging.

Examples include:

```text
verify_customer
log_promise_to_pay
send_payment_link
escalate_to_agent
mark_disposition
```

The mock backend also tracks basic operation counts through:

```text
GET /demo/state
```

For a production implementation, I would additionally track:

* Authentication success rate
* PTP rate
* Payment-link success rate
* Dispute rate
* Hardship escalation rate
* DNC rate
* Tool error rate
* Average tool latency
* P95 conversational latency
* Human escalation rate
* First Call Resolution
* Containment rate

---

## 18. Security Considerations

The current backend is intentionally a mock/demo implementation.

For production, I would add:

* Webhook authentication/signature validation
* Strong service-to-service authentication
* Database-backed customer state
* Persistent disposition records
* Encryption at rest and in transit
* Secret management
* Least-privilege credentials
* Idempotency keys for payment/PTP actions
* Audit logging
* Access-controlled monitoring
* Server-side authorization independent of the LLM
* Rate limiting and abuse protection

The LLM should never be treated as the final authorization layer. The backend should independently validate sensitive operations.

---

## 19. Current Limitations

This implementation is designed for the assignment/demo environment rather than production.

Current limitations include:

* Customer/account data is mocked.
* PTP and disposition data are stored in memory.
* Payment-link delivery is mocked.
* No real SMS or WhatsApp provider is connected.
* There is no production database.
* Webhook authentication is not implemented.
* The demo uses a fixed customer/account context.
* The system does not perform real payment processing.

These limitations are intentional to keep the assignment implementation small, deterministic, and easy to demonstrate.

---

## 20. What I Would Improve With More Time

### Persistent Data Layer

Replace the in-memory arrays with a database such as PostgreSQL or MongoDB.

### Production Authentication

Add signed webhook requests and service-to-service authentication.

### Real Payment-Link Integration

Connect the payment-link tool to an actual SMS/WhatsApp provider while keeping customer consent and delivery status explicit.

### Server-Side Conversation State

Persist authentication and conversation state on the backend instead of relying primarily on the LLM conversation context.

### Better Evaluation

Expand the test suite with automated conversation evaluations covering:

* Authentication bypass attempts
* Wrong-person scenarios
* Repeated invalid verification
* Prompt injection attempts
* DNC requests
* Disputes
* Hardship
* Already-paid claims
* Language switching
* Tool failures
* Invalid dates and amounts
* Network timeouts

### Production Observability

Add structured metrics, traces, dashboards, alerting, and P95/P99 latency monitoring.

---

## 21. Demo

The Task 2 demo demonstrates:

### Happy Path

```text
Greeting
→ Authentication
→ Debt Disclosure
→ Promise to Pay
→ Payment Link
→ Disposition
→ Call Closing
```

### Edge Case

The demo also demonstrates an edge case such as:

```text
Authentication
→ Customer requests Do Not Call
→ DO_NOT_CALL disposition
→ Immediate polite termination
```






---

## 22. Final Submission Artifacts

The repository contains the main implementation artifacts required for Task 2:

```text
README.md
docs/HLD_Document.md
docs/architecture.mmd
vapi/system_prompt.txt
vapi/tool_definitions.json
mock-server/server.js
mock-server/package.json
mock-server/.env.example
tests/test_cases.json
tests/run_tests.js
```

