## Step 12 – Registry & Availability (when to prompt)
**Prompt:**
"Implement `/lab/registry` search with FTS and filters. Add availability predicate builder that maps to `app.find_available()` JSON predicate."

**Acceptance checks:**
- Predicates like `{ "female": true, "pregnant": true, "max_age": 17 }` return expected locations.
