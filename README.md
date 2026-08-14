## Kapture Finance – Maya Outbound Voice Agent

Maya is an outbound collections voice agent built for Kapture Finance. The agent conducts respectful, compliant conversations with customers regarding overdue EMIs and helps them reach an appropriate next step.

## Overview

The agent supports:

- Customer identity verification before account disclosure
- Overdue EMI discussions after successful verification
- Promise-to-pay (PTP) capture
- Payment-link requests
- Already-paid handling
- Payment disputes
- Financial-hardship escalation
- Do-not-call requests
- Wrong-person privacy protection
- Final call disposition logging

The voice agent is implemented using Vapi, while a Node.js/Express mock backend provides the custom tool APIs used during the demo.

## Architecture

```text
Customer
   |
   v
Vapi Voice Agent (Maya)
   |
   +----------------------+
   |                      |
   v                      v
Speech / LLM          Custom Tools
                          |
                          v
                    ngrok HTTPS
                          |
                          v
                  Node.js Mock Server
                    (Express)
                          |
          +---------------+---------------+
          |       |       |       |       |
          v       v       v       v       v
       Verify    PTP    Payment  Escalate Disposition
       Customer        Link     Agent
