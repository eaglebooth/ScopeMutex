# ScopeMutex v0.1.0 actual live evidence

Checked: 2026-10-28T08:53:13.282Z

Contract: [0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2](https://explorer-studio.genlayer.com/address/0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2)

Exact deployed/local source SHA-256: `7f82afdca03a2d8dc011543c0a6caea2ada4afcc970b0567b243293bed240ad4`. Tests signed by the two authorized secondary accounts, not the main deployment account. No frontend exists.

## Observed functional matrix

| Case | Independent state/effect |
|---|---|
| In-scope/disjoint work | Held rights acquired; canonical holder hand-in recorded |
| Paraphrase duplicate | CONFLICT, no held right |
| Outside brief | OUT_OF_SCOPE, no held right |
| Wrong actor/digest, replay, invalid artifact | Expected errors, stored-projection comparisons unchanged in sequential controls |
| Intake closure | New claims denied; pre-existing holder still handed in |
| Expiry | Late hand-in denied, different member swept, positive reacquire and release |
| Instruction-like declaration | CONFLICT; no artifact/right granted for this sample |
| Near-concurrent duplicate submissions | Exactly one held request observed; nonholder denied; winner handed in |
| Queued-before/processed-after expiry | **FAILED**; see probe timing below |

A concurrency sample is not a proof of all schedules. One injection control is not universal robustness. The locally authored artifact's digest is an authenticated hand-in declaration, not verification of real work quality or external DAO authority. Local controlled tests are a separate evidence layer.

## Timing probe, including non-qualifying attempts

Created/leader-start values are RPC-observed Unix seconds, checked for plausible units. Finality time alone does not qualify the probe.

| Evidence file | Expiry | Created | Leader execution starts | Units checked | Qualifies | Consumer execution |
|---|---|---|---|---|---|---|
| run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v1.jsonl | 1793176699 | 1793176707 | [1793176719.3953302] | true | false | ERROR |
| run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v2.jsonl | 1793177249 | 1793177242 | [1793177256.3813863] | true | true | SUCCESS |

Strict processing-time expiry is not proven unless an actual qualifying consumer was rejected. A qualifying successful consumer is a FAILED gate and must not be called submission-ready.

[Independent final readbacks](live-evidence/independent-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-1793177615788.json). Raw append-only events: [run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v1.jsonl](live-evidence/run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v1.jsonl), [run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v2.jsonl](live-evidence/run-0x0ba0510ebcf1d8ded663c45a2c39f4cffc2015b2-review-v2.jsonl). All attempted test transactions are retained below, including failures and non-qualifying probes.

## All 45 actual test transactions

Every listed transaction finalized with MAJORITY_AGREE. This is not equivalent to successful business execution: expected errors and semantic denials are labeled separately.

| Run / step | Explorer | Actual execution | Expectation |
|---|---|---|---|
| review-v1 / core-create | [tx](https://explorer-studio.genlayer.com/transactions/0x5a4fdf5b03f48aad3ee24ba802c57ffcde44e73c8b7159d77bcb71afd297fea6) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-hold-a | [tx](https://explorer-studio.genlayer.com/transactions/0x24db38851d191966385d2316e03d725b773396e71533582698d7b2946ca4b0bb) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-overlap | [tx](https://explorer-studio.genlayer.com/transactions/0xd12586c8df93c80a2485dbc848a2932998c9c777a3cbc43483faefc51dce6785) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-conflict-hand-in-denied | [tx](https://explorer-studio.genlayer.com/transactions/0xd5c11ac943dde53c005b27083200c57b8ba11ddbe3b09009d6a9bd909083d6ad) | ERROR | NOT_HELD |
| review-v1 / core-other-release-denied | [tx](https://explorer-studio.genlayer.com/transactions/0xefcdf5b246a288bed402a6b8283af04f2e85931b34b4af1b0ee22348aee136a5) | ERROR | HOLDER_ONLY |
| review-v1 / core-close-noncreator-denied | [tx](https://explorer-studio.genlayer.com/transactions/0xa6f6782a46a9a67d345b9397680b0f2d3f4422c073e29c732c95b03c4467ec49) | ERROR | CREATOR_ONLY |
| review-v1 / core-wrong-digest | [tx](https://explorer-studio.genlayer.com/transactions/0x1945753a599b81f12290260a8f3824de633d2b8435dda86dd1bd84c3ff82879e) | ERROR | BOARD_DIGEST_MISMATCH |
| review-v1 / core-double-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x2ad319f3cbf6fbf7c4987cab7d59984f80bbe98dd9aeb1686bc89e8f1f5ec84f) | ERROR | ALREADY_HOLDING |
| review-v1 / core-outside | [tx](https://explorer-studio.genlayer.com/transactions/0xadcb5091147a23c9501d636b7f27401b3931a6a25a621a0dd9a5634c9c0d3bfb) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-disjoint | [tx](https://explorer-studio.genlayer.com/transactions/0xdbfe39d8b494875b37483996d54c6f5e4c9a224cae3a092069eb696ca8a7d8e9) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-replay | [tx](https://explorer-studio.genlayer.com/transactions/0x9c11fb8b04d4ec11a14732b9820bd0d3edcacc5dfce447f0bff0c9127e58921a) | ERROR | REQUEST_REPLAY |
| review-v1 / core-wrong-holder | [tx](https://explorer-studio.genlayer.com/transactions/0x1e07dee877e6e388e1c805b13f0edaf01299d940c6c2c687c6913f683fae5e10) | ERROR | HOLDER_ONLY |
| review-v1 / core-bad-artifact | [tx](https://explorer-studio.genlayer.com/transactions/0x98000902bb6bd72bb5b67069c26237519258c96b9e2adc10523f418ab27cb7d2) | ERROR | INVALID_ARTIFACT_DIGEST |
| review-v1 / core-close | [tx](https://explorer-studio.genlayer.com/transactions/0x37d6dd0b04f5906c36b2bd47c9a5cd4b057d3d0b73e183e9e328a20a07ed4051) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-hand-in-after-intake-close | [tx](https://explorer-studio.genlayer.com/transactions/0x8d38909ef3a75bfb31dabee463d428bdec280aee06d802cfe7508b906395cfd9) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-new-claim-after-close | [tx](https://explorer-studio.genlayer.com/transactions/0xd5137eb77aaaacb0238fed1d91c6b473906258e8f3967e4a5d362681629af13d) | ERROR | INTAKE_CLOSED |
| review-v1 / core-release-a | [tx](https://explorer-studio.genlayer.com/transactions/0x5976b9a0ab06c35febe5fb7bfb031e7b8a295d0501b66044cbbbbc888cf04c32) | SUCCESS | successful execution; inspect business state |
| review-v1 / core-hand-in-released-denied | [tx](https://explorer-studio.genlayer.com/transactions/0x30651644bf3bcb78e66bc99791f12b2182f1544637e8bc7a86e613de99b47cc9) | ERROR | NOT_HELD |
| review-v1 / expiry-create | [tx](https://explorer-studio.genlayer.com/transactions/0xd6be4371c8ddac2f0707d7acef5c7f10a5a7aec8274a7526c8d2c880abf31288) | SUCCESS | successful execution; inspect business state |
| review-v1 / expiry-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x24dab7ab68fcd031069917096c61fc1a755825a391306ffaaa0ed6decc8166c1) | SUCCESS | successful execution; inspect business state |
| review-v1 / expiry-early-sweep | [tx](https://explorer-studio.genlayer.com/transactions/0x765f30967463080160d24c8f1f2ec04f545ce2cc348cd63cc6a301cc2121c15b) | ERROR | NOTHING_EXPIRED |
| review-v1 / audit-create | [tx](https://explorer-studio.genlayer.com/transactions/0x857d3effac148fb8c6aa2851fa9d4839b137e2cc14d024c736f7ce5b9ff4d0b2) | SUCCESS | successful execution; inspect business state |
| review-v1 / audit-hold | [tx](https://explorer-studio.genlayer.com/transactions/0xeca04223cd768e74278e75958bdfd21d5c1a17382efca747a3121f1c7807cb73) | SUCCESS | successful execution; inspect business state |
| review-v1 / audit-injection | [tx](https://explorer-studio.genlayer.com/transactions/0x37e6a81a36f51d64a7cd49d6370a615b6eb5e7306d014297e271652df5c2018b) | SUCCESS | successful execution; inspect business state |
| review-v1 / audit-denied-cannot-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0xe38fd982491f02283ade30f4f5a3977ecf2c2b277057db0b1c09261d449867af) | ERROR | NOT_HELD |
| review-v1 / audit-holder-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0xf45a44c790aac6c6d22087ec5d5f6eea913827287b43425bfbdedb0d2bbef1ca) | SUCCESS | successful execution; inspect business state |
| review-v1 / expiry-late-hand-in-denied | [tx](https://explorer-studio.genlayer.com/transactions/0x1bef77a82d88d81e0d82d8dcc155852a29b73cc5aed20c875a158480724efd1c) | ERROR | LEASE_EXPIRED |
| review-v1 / expiry-permissionless-sweep | [tx](https://explorer-studio.genlayer.com/transactions/0xdfa56ae443758418962aceeb1a4e12cd41c6fcd5e7c89845e54a327ccf13d63d) | SUCCESS | successful execution; inspect business state |
| review-v1 / expiry-reacquire | [tx](https://explorer-studio.genlayer.com/transactions/0xbd5d6fba2bc7faffdd97bcdd680f6626e71478b625b40a25d7cd45b67579d2f5) | SUCCESS | successful execution; inspect business state |
| review-v1 / expiry-release-recovered | [tx](https://explorer-studio.genlayer.com/transactions/0x9590301c98c7f43592dad802f12bbfac50b8c720d05bb502291bb10db7eb236c) | SUCCESS | successful execution; inspect business state |
| review-v1 / race-create | [tx](https://explorer-studio.genlayer.com/transactions/0xf3af07c676154ab1f79ddb4d8b65111fba9a5bbc44c817d7c6bffe48a151a2ca) | SUCCESS | successful execution; inspect business state |
| review-v1 / race-submit-a | [tx](https://explorer-studio.genlayer.com/transactions/0x1f674f089b0b360347b697ef3b6f379113fd42f1e503062c3e5e1707fc648f70) | SUCCESS | probe-specific assertions |
| review-v1 / race-submit-b | [tx](https://explorer-studio.genlayer.com/transactions/0x3c9b30357327a857379f5e28799b25d6cf3850a956414e7d0767decd90ad784e) | SUCCESS | probe-specific assertions |
| review-v1 / race-nonholder-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0xfa872f42fb7e6fba453e79c2a8372be76e524b2985b69e21334c9b9e8d4d6d7a) | ERROR | HOLDER_ONLY |
| review-v1 / race-winner-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0x82b5f3149cf04bb8cb069f8c7c0017f198b07884c8ea65bfcd0a3e381d328bd1) | SUCCESS | successful execution; inspect business state |
| review-v1 / boundary-create | [tx](https://explorer-studio.genlayer.com/transactions/0x924576a159673fa41c2a5567167173914f41bad078eb93eb6e6cccd0d1bd19e7) | SUCCESS | successful execution; inspect business state |
| review-v1 / boundary-hold | [tx](https://explorer-studio.genlayer.com/transactions/0xfeed82f8ef45821d0dd8656dad3cf81700052638c5b0864efb52529693d044a8) | SUCCESS | successful execution; inspect business state |
| review-v1 / boundary-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0xf0be08368884babba328707eb0fce1d3259c0f1bbffa3c643d77470e71229c2f) | SUCCESS | probe-specific assertions |
| review-v1 / boundary-consumer | [tx](https://explorer-studio.genlayer.com/transactions/0xfc1513766345a063536c8aedc8b3487065aadba05943a51e6695b133718792bb) | ERROR | probe-specific assertions |
| review-v1 / boundary-release-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0xed159138292672f4f726625aa339c6e16b06dc30466a07e91c4875c258502230) | SUCCESS | successful execution; inspect business state |
| review-v2 / boundary-create | [tx](https://explorer-studio.genlayer.com/transactions/0x5f5a441bade52c15c88837d82a9cf7dcac16513496afa031acfe67de2b1cafd4) | SUCCESS | successful execution; inspect business state |
| review-v2 / boundary-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x5cb7e7a5e6def2bf6189d2cd6b4e2d7eaad9747c9f960e1744a500303d3cea49) | SUCCESS | successful execution; inspect business state |
| review-v2 / boundary-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0x23fd36119caeba43921bb482b633aac83f212252f96bfff7a482a4b195f8312c) | SUCCESS | probe-specific assertions |
| review-v2 / boundary-consumer | [tx](https://explorer-studio.genlayer.com/transactions/0x49af64ef433a123020ba93b5efba412643fea81b4f7344cc398b2c4db99cfccc) | SUCCESS | probe-specific assertions |
| review-v2 / boundary-release-blocker | [tx](https://explorer-studio.genlayer.com/transactions/0x281e44936d5ee3e3f810604c5b371cd95faad7e0a461cf1811bbfee54bcb9980) | SUCCESS | successful execution; inspect business state |
