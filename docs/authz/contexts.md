# Building `ctx` (policy evaluation context)

The server must construct `ctx` per request:

- purpose: "care"|"billing"|"QA"|"oversight"|"research"
- legal_basis: boolean
- dataset: { deidentified: boolean }
- identified_ok: boolean
- same_org: boolean
- same_location: boolean
- in_network: boolean
- delegated_fields: string[]
- field: string
- service: { claimed: boolean }
- assigned_to_user: boolean
- shares_program: boolean
- program_access_level: "view"|"write"|"full"|null
- consent_ok: boolean           # derive from client consent rows
- contains_phi: boolean         # endpoint-specific
- self_scope: boolean
- affiliated: boolean
- temp_grant: boolean
- two_person_rule: boolean
- bg: boolean                   # break-glass active
- bg_expires_at: timestamp|null

All allow/deny decisions should include the `ctx` snapshot in `app.audit_logs`.
