# ScopeMutex actual live transaction index

Contract: [0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2](https://explorer-studio.genlayer.com/address/0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2)

Source SHA-256: 7f82afdca03a2d8dc011543c0a6caea2ada4afcc970b0567b243293bed240ad4

Raw append-only events: [JSONL](run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v2.jsonl).

Recorded phase completions: none. These are scoped observations, not proof of universal semantic reliability.

| Step | Explorer | Finality | Execution expectation | Verification |
|---|---|---|---|---|
| boundary-create | [tx](https://explorer-studio.genlayer.com/transactions/0x5f5a441bade52c15c88837d82a9cf7dcac16513496afa031acfe67de2b1cafd4) | FINALIZED | success expected; inspect business result | verified |
| boundary-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x5cb7e7a5e6def2bf6189d2cd6b4e2d7eaad9747c9f960e1744a500303d3cea49) | FINALIZED | success expected; inspect business result | verified |
| boundary-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0x23fd36119caeba43921bb482b633aac83f212252f96bfff7a482a4b195f8312c) | FINALIZED | probe-specific assertions | verified |
| boundary-consumer | [tx](https://explorer-studio.genlayer.com/transactions/0x49af64ef433a123020ba93b5efba412643fea81b4f7344cc398b2c4db99cfccc) | FINALIZED | probe-specific assertions | verified |
| boundary-release-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0x281e44936d5ee3e3f810604c5b371cd95faad7e0a461cf1811bbfee54bcb9980) | FINALIZED | success expected; inspect business result | verified |

A finalized accepted consensus can contain an execution error or a business denial. Inspect receipt and authoritative readback. No fixture verdict is injected into a live call.
