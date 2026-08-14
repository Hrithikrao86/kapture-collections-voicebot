# Kapture Finance — Maya Voice AI Collections Agent
## High-Level Design Document

---

## 1. Overview

Maya is an outbound Voice AI collections agent designed for Kapture Finance.

The agent contacts customers regarding overdue EMI payments and conducts a respectful, verification-first conversation. Before discussing any confidential account information, Maya verifies the customer's identity using a custom backend tool.

After successful verification, Maya can:

- Discuss the approved overdue account information
- Capture a Promise to Pay (PTP)
- Send a payment link
- Handle an already-paid response
- Escalate disputes
- Escalate financial-hardship cases
- Respect Do-Not-Call requests
- Record the final disposition
- End the call when the conversation is complete

The demo implementation uses Vapi for voice-agent orchestration and a Node.js/Express mock server for deterministic business-tool execution.

---

# 2. Goals

The primary goals of the system are:

1. Verify the intended customer before confidential information is disclosed.
2. Provide a natural and respectful voice conversation.
3. Understand the customer's intent.
4. Execute deterministic backend actions through tools.
5. Record the outcome of each call.
6. Prevent unauthorized disclosure of account information.
7. Handle disputes and hardship cases through human escalation.
8. Provide safe behavior when tools or backend services fail.

---

# 3. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      Customer        │
                         │    Phone / Voice     │
                         └──────────┬───────────┘
                                    │
                                    │ Voice
                                    ▼
                         ┌──────────────────────┐
                         │        Vapi          │
                         │  Voice Agent: Maya   │
                         │                      │
                         │  STT → LLM → TTS     │
                         └──────────┬───────────┘
                                    │
                                    │ Tool Call
                                    ▼
                         ┌──────────────────────┐
                         │       ngrok          │
                         │   HTTPS Tunnel       │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS
                                    ▼
                 ┌──────────────────────────────────┐
                 │       Node.js / Express           │
                 │        Mock Tool Server           │
                 │                                  │
                 │  POST /webhook                   │
                 │  GET  /health                    │
                 │  GET  /demo/state                │
                 └───────────────┬──────────────────┘
                                 │
                ┌────────────────┼─────────────────┐
                │                │                 │
                ▼                ▼                 ▼
        verify_customer     PTP / Payment     Escalation /
                            Operations         Disposition
