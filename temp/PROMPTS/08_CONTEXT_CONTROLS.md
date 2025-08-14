## Step 8 – Context controls (when to prompt)
**Prompt:**
"Implement a dev ctx-session store to persist purpose-of-use, consent override, and break-glass TTL. `/lab/context` should allow toggling and show the exact ctx JSON that will be sent to the server."

**Acceptance checks:**
- Purpose-of-use header appears on requests.
- Break-glass shows countdown banner in the Lab header.
