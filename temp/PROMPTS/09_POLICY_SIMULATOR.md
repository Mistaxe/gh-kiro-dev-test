## Step 9 – Policy simulator & dev toggles (when to prompt)
**Prompt:**
"Wire `/lab/policies` to `POST /dev/policy/simulate`. Add dev toggles saved in a feature_flags table that the ctx builder reads. Add a button to call `/dev/policy/reload`."

**Acceptance checks:**
- Simulations match real route decisions.
- Toggling 'consent required' flips allow/deny on PHI routes.
