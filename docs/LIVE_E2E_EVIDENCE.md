# ScopeMutex v0.2.0 epoch live evidence

Checked: 2026-10-29T01:19:13.152Z

Contract: [0x573ae069446a57b8127f5BC43c2953ac8e4C77D8](https://explorer-studio.genlayer.com/address/0x573ae069446a57b8127f5BC43c2953ac8e4C77D8)

Source parity SHA-256: `80ee84c70af2889727ab940425886b63e1ca550d4c5a3191b2cab68ad93027b0`. Two secondary accounts signed. No frontend.

Observed scope/overlap/disjoint admission, authenticated hand-in, intake closure, explicit end-round cancellation, stale epoch/digest/replay denial, new-round recovery, one injection control, near-concurrent mutex and old-payload rejection after end-round. These are bounded observations, not all possible schedules or universal injection resistance. Coordinator revocation authority is explicit; no wall-clock expiry is claimed.

[Independent readbacks](live-evidence/independent-0x573ae069446a57b8127f5bc43c2953ac8e4c77d8-1793236773393.json) · [Append-only events](live-evidence/run-0x573ae069446a57b8127f5bc43c2953ac8e4c77d8-epoch-v2.jsonl)

## All 41 actual test transactions

All finalized with MAJORITY_AGREE; execution errors and business denials remain distinct.

| Step | Explorer | Execution | Expectation |
|---|---|---|---|
| core-create | [tx](https://explorer-studio.genlayer.com/transactions/0x33b8e43c87d7497d9520a8f7c9c87ca5f1f6d63547e175eb7d448e8ff8d958c9) | SUCCESS | success; inspect business state |
| core-hold-a | [tx](https://explorer-studio.genlayer.com/transactions/0xa42ae0b09c31bfcbe943bdda29a0d48ef6078ac6b342a3f44c1427cc20a41976) | SUCCESS | success; inspect business state |
| core-overlap | [tx](https://explorer-studio.genlayer.com/transactions/0x31b01f9fd372365f98bfd1651380cd5e677b5a337c7cd180badd72573a569cd3) | SUCCESS | success; inspect business state |
| core-conflict-hand-in-denied | [tx](https://explorer-studio.genlayer.com/transactions/0xea01b3c0928414dc0b949b98249c3956cbb135ef65dddfd38a8b00d8641116a8) | ERROR | NOT_HELD |
| core-other-release-denied | [tx](https://explorer-studio.genlayer.com/transactions/0x6e49e4ae1368192389120bf26ce3550b46ffb112be8dde5e24e0aca071fd0827) | ERROR | HOLDER_ONLY |
| core-noncreator-close | [tx](https://explorer-studio.genlayer.com/transactions/0x777c116212f139e7af5ace83c9a6ca85bc227b9daaae412c8db8f68ff2a647b7) | ERROR | CREATOR_ONLY |
| core-wrong-round-digest | [tx](https://explorer-studio.genlayer.com/transactions/0x129a7e9bdbdcb826ef10d7cb7da4a587b57b883823df263ea53f0f29f84a34c1) | ERROR | ROUND_DIGEST_MISMATCH |
| core-double-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x3d54da3eed2214afb3d0c1965ecf3d8aa29d73f30b956059e5770c4711751763) | ERROR | ALREADY_HOLDING |
| core-outside | [tx](https://explorer-studio.genlayer.com/transactions/0xba49a06db24cb9e107775390e3c0dd7057d0c2d1973841389464b73bf2cf9e70) | SUCCESS | success; inspect business state |
| core-disjoint | [tx](https://explorer-studio.genlayer.com/transactions/0x1c131cfe92f56d210b3a413f1988af0d0b412810655f7b0daeb01db425b1e059) | SUCCESS | success; inspect business state |
| core-replay | [tx](https://explorer-studio.genlayer.com/transactions/0x534aa40a800903c68ad2f893986a91782163e5b4c99c89f6b80b600ad37b633d) | ERROR | REQUEST_REPLAY |
| core-bad-artifact | [tx](https://explorer-studio.genlayer.com/transactions/0x76061a52234ffaf72b2abc0d2322512fcdb03899347e1798e4ede9dfc03ca01b) | ERROR | INVALID_ARTIFACT_DIGEST |
| core-close-intake | [tx](https://explorer-studio.genlayer.com/transactions/0x6c233a75dd08bcd8f33924c07cf0ca8582ca4f3faf31dc840074abaa232d3505) | SUCCESS | success; inspect business state |
| core-hand-in-after-intake-close | [tx](https://explorer-studio.genlayer.com/transactions/0xa7787f12c399740449c41866ce810c13edb90dfbb5f194cfb916605069507b0d) | SUCCESS | success; inspect business state |
| core-closed-intake-denial | [tx](https://explorer-studio.genlayer.com/transactions/0xc44e78e4183c5f1294db0dd86adab93a99b3d01d264acfeac50ef52dc1b719af) | ERROR | INTAKE_CLOSED |
| core-end-round | [tx](https://explorer-studio.genlayer.com/transactions/0xbeb37c89326a322a65cc2bc20e36ac5d832d5e6c1ef56f26edf4d4990bc9af59) | SUCCESS | success; inspect business state |
| core-old-hand-in-after-end | [tx](https://explorer-studio.genlayer.com/transactions/0x72f1bc7122978dd5a7d6c86807d8fa6669e8f0cdafa59f730d89591d2b1b278c) | ERROR | ROUND_NOT_ACTIVE |
| core-start-round | [tx](https://explorer-studio.genlayer.com/transactions/0xca4caf8f88744ed431f6bbac2273db9fce47f1e9924885f3929fed5074735867) | SUCCESS | success; inspect business state |
| core-stale-close | [tx](https://explorer-studio.genlayer.com/transactions/0xf08cc8d4c4470a2746f966c6058cdcb416fe784aa275c9fbe076e4f61cb5aac8) | ERROR | STALE_ROUND |
| core-stale-end | [tx](https://explorer-studio.genlayer.com/transactions/0x9b62876f0e0ee566efd701df0c6001f59d25049dbcfec0dc3df55c644c85a275) | ERROR | STALE_ROUND |
| core-old-claim-epoch | [tx](https://explorer-studio.genlayer.com/transactions/0x2038462749f59fc9016d19e27b0eef7eff449436cd9bfb1ee195bd6a96558501) | ERROR | STALE_ROUND |
| core-round2-acquire | [tx](https://explorer-studio.genlayer.com/transactions/0x4c57d4600f07f7633a41a0ca92da3491e10c26487fd90f74fba834b4bf67d39a) | SUCCESS | success; inspect business state |
| core-round2-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0x7079c15ba9d195adb26c2cc217b2010818af40c910910aaf327121df011a5c3b) | SUCCESS | success; inspect business state |
| audit-create | [tx](https://explorer-studio.genlayer.com/transactions/0x98fa5071c3cdc85a66be7ade021cd8593582b0e2dc80683dc9722383df0fc933) | SUCCESS | success; inspect business state |
| audit-hold | [tx](https://explorer-studio.genlayer.com/transactions/0x4cc4168089b8ed674f670aa89d720a6b07dc6cddbe1a214046920fd822b0a4cf) | SUCCESS | success; inspect business state |
| audit-injection | [tx](https://explorer-studio.genlayer.com/transactions/0xea2758b6d72425290eb2963e213b074e4ffdcbe014371e196bb7f78f2fcc1a23) | SUCCESS | success; inspect business state |
| audit-denied-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0xe76a06e0bb74f09c522ae9331d7d367b674977bac7ad8cab8769b43a4f0fc025) | ERROR | NOT_HELD |
| audit-holder-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0x49e71acde823abaacc4886c2573118f3f0d7a8b6134ad4495da23528972c3d3f) | SUCCESS | success; inspect business state |
| race-create | [tx](https://explorer-studio.genlayer.com/transactions/0x58da9711e6504bdffddf1b77b8df7eae856f46674be014a5486c920ed92173a7) | SUCCESS | success; inspect business state |
| race-submit-a | [tx](https://explorer-studio.genlayer.com/transactions/0xd12da09685fb643913ac14e4d09ba96eb97c117201dd9c3c3ab055449299e77f) | SUCCESS | probe-specific assertions |
| race-submit-b | [tx](https://explorer-studio.genlayer.com/transactions/0x615146e6831d1904b044582575c21d90ca8e6dbf6999cea2dd12d064c26552f0) | SUCCESS | probe-specific assertions |
| race-nonholder-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0x83300eab5baccae47d373dd683ea4e7df42074fcd40e7f2050c8284aaca8e912) | ERROR | HOLDER_ONLY |
| race-winner-hand-in | [tx](https://explorer-studio.genlayer.com/transactions/0x30afb07e34e2723e50ef9e20da51c6b8a28bd834d24238f29bb51d9d58b2746d) | SUCCESS | success; inspect business state |
| queued-create | [tx](https://explorer-studio.genlayer.com/transactions/0xf106642d4df2d9c0c5210c9d36ccb974983928ad9a15d2d5eb7a5896099d7d92) | SUCCESS | success; inspect business state |
| queued-old-right | [tx](https://explorer-studio.genlayer.com/transactions/0xdf4bb205c181a8a920d6bdd56c05f616933fe7243dce651852172566c255e942) | SUCCESS | success; inspect business state |
| queued-end | [tx](https://explorer-studio.genlayer.com/transactions/0xb76efea6800d9f7cd22c9f0670d5e7acf69430aa644f942e80718d5bb3969971) | SUCCESS | probe-specific assertions |
| queued-old-consumer | [tx](https://explorer-studio.genlayer.com/transactions/0x47a919bbbb580ad2993a9f275e3b394e107edaee07d3105f2c6f34534de34f6d) | ERROR | probe-specific assertions |
| queued-start-round2 | [tx](https://explorer-studio.genlayer.com/transactions/0x9d00c6d28e8c36e0b8ff943b98b7d42f883ad92f37e659cc28e7e68fa9a53a5d) | SUCCESS | success; inspect business state |
| queued-round2-acquire | [tx](https://explorer-studio.genlayer.com/transactions/0xc0d06e2cb395399e1a554ba4217a72fdb66ab53520560aa533386bb1a046ff98) | SUCCESS | success; inspect business state |
| queued-old-replay | [tx](https://explorer-studio.genlayer.com/transactions/0x89f1d54bd0f9d598df431393877a3395f0972c9df1881a8ccc65f0671cce665e) | ERROR | ROUND_NOT_ACTIVE |
| queued-round2-release | [tx](https://explorer-studio.genlayer.com/transactions/0x1ead8d886213f27702cd6a82f2e63cd9e1f00412d93ec1ad31e558c7a82e92bf) | SUCCESS | success; inspect business state |
