## Step 13 – Referrals & Notes (when to prompt)
**Prompt:**
"Add helper vs provider views. Helper creates record-keeping referrals and journal notes (no PHI). Provider creates client/case/notes. Reading PHI must check consent and purpose-of-use; denials show clear reasons."

**Acceptance checks:**
- HelperBasic cannot read provider case notes.
- With consent_ok=true and purpose=care, provider can read PHI.
