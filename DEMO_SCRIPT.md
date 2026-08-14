# Maya Demo Script — 2–4 Minutes

## 0:00–0:20 — Introduce

"This is Maya, an outbound Voice AI collections agent for Kapture Finance. The key safety control is that Maya cannot disclose debt information until customer authentication succeeds through a backend verification tool."

## 0:20–1:50 — Happy Path

1. Start the Vapi web call.
2. Maya: "Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?"
3. Customer: "Yes."
4. Maya asks for the last four PAN digits/year of birth.
5. Customer: "1234."
6. Show the terminal log proving `verify_customer` was called and returned `verified: true`.
7. Maya now discloses the overdue amount.
8. Customer: "I can pay this Friday."
9. Maya captures the date.
10. Show `log_promise_to_pay` in the terminal.
11. Show `send_payment_link` in the terminal.
12. Maya confirms the link was sent.
13. Show `mark_disposition(PTP_AGREED)`.

## 1:50–2:50 — Edge Case

Use the DNC or dispute flow.

### DNC
Customer: "Please stop calling me and put me on the do-not-call list."

Maya immediately calls `mark_disposition(DO_NOT_CALL)` and ends the call.

### OR Dispute
Customer: "I dispute this amount."

Maya calls `escalate_to_agent(reason=DISPUTE)` and logs `DISPUTED`.

## 2:50–3:20 — Architecture

Show the HLD architecture diagram and explain:

"The flow is Telephony/Vapi to Deepgram for STT, GPT-4o for orchestration, our custom webhook for deterministic business actions, and ElevenLabs or Cartesia for TTS. The authentication state is locked until the verification tool succeeds."

## 3:20–3:40 — Close

Show the repository structure and test command:

```bash
node tests/run_tests.js
```

State that the implementation includes tool contracts, compliance guardrails, edge cases, observability definitions and a mock backend.
