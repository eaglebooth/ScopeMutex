# Current v0.2.0 requirement matrix

Current live run: 2026-10-29, 41 actual test transactions; core/audit/race/queued
completed and independent state readbacks passed. See LIVE_E2E_EVIDENCE.md for each
transaction and raw evidence. Injection returned CONFLICT. Quota exhaustion,
malformed model outputs and provider/disagreement faults are controlled-harness
coverage, not claims of induced live faults. Historical 45tx belong to v0.1.0.
Local controlled tests remain a separate layer.

| Requirement | Direct regression | Required current live evidence |
|---|---|---|
| In-scope/disjoint admission | complete comparison vector, independent assessment | actual HELD and canonical hand-in |
| Paraphrase/outside denial | CONFLICT/OUT_OF_SCOPE, no right | real semantic branches and denied consumer |
| No stale semantic grant | changed epoch/revision/source/set rejects | race and round state readbacks |
| Holder-only consumption | wrong actor/request digest, replay | actual error/no-mutation and success |
| Intake close preserves right | close then holder hand-in | same lifecycle on deployment |
| Explicit round revocation | all unhanded CANCELLED, old artifact empty | end then queued old payload denial |
| Old authority cannot hit new round | stale epoch/digest/controls rejected | restart, stale calls, fresh acquisition |
| No transaction-clock bypass | old/missing/future datetime cannot revive cancelled request | state-order probe; no expiry claim |
| Quota isolation | other member/creator unaffected, quota not reset | bounds disclosed, harness exhaustion separate |
| Model/source failures | malformed shape, quote, omission, provider/disagreement | actual observed errors retained, no invented failures |
| Injection boundary | independent unsafe-fixture refusal | one real injected source, result scoped |
| Full source/identity binding | chain/contract/policy/epoch commitments | exact source parity, sender/target, hashes and final readbacks |
