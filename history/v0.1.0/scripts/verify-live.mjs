// Independent read-only final readbacks; includes failed/non-qualifying probes.
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
const address=process.env.SCOPEMUTEX_CONTRACT;
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw Error('Set contract');
const check=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const canonical=x=>JSON.stringify(sorted(x)).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const client=()=>createClient({chain:studionet});
const read=async(functionName,args=[])=>JSON.parse(String(await client().readContract({address,functionName,args,transactionHashVariant:'latest-final'})));
const source=readFileSync('contracts/scope_mutex.py');
check(source.equals(Buffer.from(await client().getContractCode(address),'utf8')),'Source mismatch');
const version=await read('get_version');check(version.version==='0.1.0'&&version.policy==='scopemutex/atomic-work-exclusion-v1','Version mismatch');
const folder='docs/live-evidence';
const files=readdirSync(folder).filter(n=>n.startsWith(`run-${address.toLowerCase()}-`)&&n.endsWith('.jsonl'));
const all=files.flatMap(file=>readFileSync(`${folder}/${file}`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(e=>({...e,evidence_file:file})));
for(const file of files){const c=all.find(e=>e.evidence_file===file).context;check(c.source_sha256===sha(source)&&c.chain_id===studionet.id,'Mixed source or network context');}
const primary=all.filter(e=>e.evidence_file===`run-${address.toLowerCase()}-review-v1.jsonl`);
check(primary.length,'Primary evidence missing');
const actor=primary[0].context.actors.map(a=>a.toLowerCase());
check(same(actor,['0xeb57bc7125fa60d7482ce12058397369ab3581f8','0x2da5393d7bbb9a037dc3abb56dbbc5c150fc843f']),'Actor mismatch');
const artifact=sha(readFileSync('samples/hand-in.txt'));
const sample=JSON.parse(readFileSync('samples/workboard.json'));
const expectedWork={'core-hold-a':'quickstart','core-overlap':'overlap','core-outside':'outside','core-disjoint':'disjoint',
 'audit-hold':'quickstart','audit-injection':'injection','expiry-hold':'quickstart','expiry-reacquire':'overlap'};
const result={checked_at:new Date().toISOString(),address,chain_id:studionet.id,source_sha256:sha(source),version,requests:{},boards:{},probes:[],transactions:[]};
async function expect(label,states,hasArtifact=false){
 const event=primary.find(e=>e.event==='business-verified'&&(e.label===label||e.label===label+'-retry'));
 check(event,`${label}: no business verification`);
 const p=await read('get_request',[event.request_id]);
 check(states.includes(p.stored_state),`${label}: state ${p.stored_state}`);
 check(p.work===sample[expectedWork[label]]&&p.snapshot.brief===sample.brief&&p.snapshot.candidate.work===p.work
  &&p.snapshot.candidate.id===p.id&&p.snapshot.candidate.claimant===p.claimant,'Candidate/source mismatch');
 const snapshotDigest=sha(canonical(p.snapshot));
 check(p.assessment.snapshot_digest===snapshotDigest&&p.request_digest===sha(canonical({board_digest:p.snapshot.board_digest,
  request_id:p.id,claimant:p.claimant,work:p.work,snapshot_digest:snapshotDigest})),'Request commitment mismatch');
 check(p.artifact_digest===(hasArtifact?artifact:''),`${label}: artifact mismatch`);
 result.requests[label]=p;return p;
}
await expect('core-hold-a',['RELEASED']);
await expect('core-overlap',['CONFLICT']);
await expect('core-outside',['OUT_OF_SCOPE']);
await expect('core-disjoint',['HANDED_IN'],true);
await expect('audit-hold',['HANDED_IN'],true);
await expect('audit-injection',['CONFLICT','UNRESOLVED']);
await expect('expiry-hold',['EXPIRED']);
await expect('expiry-reacquire',['RELEASED']);
const race=primary.find(e=>e.event==='race-outcome');check(race,'Race result missing');
for(const p of race.requests){
 const current=await read('get_request',[p.id]);
 check(current.stored_state===(p.stored_state==='HELD'?'HANDED_IN':p.stored_state),'Race state mismatch');
 check(current.artifact_digest===(p.stored_state==='HELD'?artifact:''),'Race artifact mismatch');
 result.requests['race-'+p.claimant]=current;
}
for(const name of ['core','audit','expiry','race']){
 check(primary.some(e=>e.event==='phase-completed'&&e.phase===name),`${name}: incomplete phase`);
 const id=`${actor[0]}:${name}-review-v1`,b=await read('get_board',[id]);
 check(b.creator===actor[0]&&same(b.roster,[...actor].sort())&&b.registered_ids.length===0,`${name}: board readback mismatch`);
 check(b.brief===sample.brief&&b.board_digest===sha(canonical({policy:version.policy,chain_id:studionet.id,
  contract:address.toLowerCase(),board_id:b.id,creator:b.creator,brief:b.brief,roster:b.roster,hold_seconds:b.hold_seconds})),'Board commitment mismatch');
 if(name==='core')check(b.intake_open===false,'Core intake not closed');
 result.boards[name]=b;
}
for(const e of all.filter(e=>e.event==='boundary-outcome')){
 const setup=all.find(x=>x.evidence_file===e.evidence_file&&x.event==='boundary-setup');
 const p=await read('get_request',[setup.request_id]);
 result.probes.push({...e,independent_request:p});
}
for(const s of all.filter(e=>e.event==='submitted')){
 const inFile=all.filter(e=>e.evidence_file===s.evidence_file);
 const intent=inFile.find(e=>e.event==='intent'&&e.label===s.label);
 const receipt=inFile.filter(e=>e.event==='receipt'&&e.label===s.label).at(-1);
 const tx=receipt?.transaction;check(tx,'Missing receipt');
 check(tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','Receipt not finalized accepted');
 check(tx.hash===s.hash&&tx.to_address.toLowerCase()===address.toLowerCase()&&tx.from_address.toLowerCase()===intent.input.actor.toLowerCase(),'Receipt binding mismatch');
 const raw=tx.consensus_data.leader_receipt,list=Array.isArray(raw)?raw:Object.values(raw||{}),leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName;
 const expected=intent.input.expectedError;
 if(expected&&expected!=='probe-specific assertions')check(execution==='ERROR'&&leader.result.payload===expected,'Wrong expected error');
 else if(!expected)check(execution==='SUCCESS','Wrong expected success');
 check(inFile.some(e=>e.event==='verified'&&e.label===s.label),'Unverified transaction');
 result.transactions.push({file:s.evidence_file,label:s.label,hash:s.hash,execution,expected:expected||'successful execution; inspect business state'});
}
const failed=result.probes.filter(e=>e.qualifies&&e.execution!=='ERROR');
const passed=result.probes.filter(e=>e.qualifies&&e.execution==='ERROR'&&e.independent_request.artifact_digest==='');
result.processing_time_expiry=failed.length?'FAILED':passed.length?'OBSERVED_PASS':'NOT_EXERCISED';
const output=`${folder}/independent-${address.toLowerCase()}-${Date.now()}.json`;
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const rows=result.transactions.map(t=>`| ${t.file.includes('review-v2')?'review-v2':'review-v1'} / ${t.label} | [tx](https://explorer-studio.genlayer.com/transactions/${t.hash}) | ${t.execution} | ${t.expected} |`).join('\n');
const probes=result.probes.map(e=>`| ${e.evidence_file} | ${e.expires_at} | ${e.created_timestamp} | ${JSON.stringify(e.leader_exec_starts)} | ${e.timestamp_units_validated} | ${e.qualifies} | ${e.execution} |`).join('\n');
writeFileSync('docs/LIVE_E2E_EVIDENCE.md',`# ScopeMutex v0.1.0 actual live evidence\n\nChecked: ${result.checked_at}\n\nContract: [${address}](https://explorer-studio.genlayer.com/address/${address})\n\nExact deployed/local source SHA-256: \`${sha(source)}\`. Tests signed by the two authorized secondary accounts, not the main deployment account. No frontend exists.\n\n## Observed functional matrix\n\n| Case | Independent state/effect |\n|---|---|\n| In-scope/disjoint work | Held rights acquired; canonical holder hand-in recorded |\n| Paraphrase duplicate | CONFLICT, no held right |\n| Outside brief | OUT_OF_SCOPE, no held right |\n| Wrong actor/digest, replay, invalid artifact | Expected errors, stored-projection comparisons unchanged in sequential controls |\n| Intake closure | New claims denied; pre-existing holder still handed in |\n| Expiry | Late hand-in denied, different member swept, positive reacquire and release |\n| Instruction-like declaration | ${result.requests['audit-injection'].stored_state}; no artifact/right granted for this sample |\n| Near-concurrent duplicate submissions | Exactly one held request observed; nonholder denied; winner handed in |\n| Queued-before/processed-after expiry | **${result.processing_time_expiry}**; see probe timing below |\n\nA concurrency sample is not a proof of all schedules. One injection control is not universal robustness. The locally authored artifact's digest is an authenticated hand-in declaration, not verification of real work quality or external DAO authority. Local controlled tests are a separate evidence layer.\n\n## Timing probe, including non-qualifying attempts\n\nCreated/leader-start values are RPC-observed Unix seconds, checked for plausible units. Finality time alone does not qualify the probe.\n\n| Evidence file | Expiry | Created | Leader execution starts | Units checked | Qualifies | Consumer execution |\n|---|---|---|---|---|---|---|\n${probes}\n\nStrict processing-time expiry is not proven unless an actual qualifying consumer was rejected. A qualifying successful consumer is a FAILED gate and must not be called submission-ready.\n\n[Independent final readbacks](${output.replace('docs/','')}). Raw append-only events: ${files.map(f=>`[${f}](live-evidence/${f})`).join(', ')}. All attempted test transactions are retained below, including failures and non-qualifying probes.\n\n## All ${result.transactions.length} actual test transactions\n\nEvery listed transaction finalized with MAJORITY_AGREE. This is not equivalent to successful business execution: expected errors and semantic denials are labeled separately.\n\n| Run / step | Explorer | Actual execution | Expectation |\n|---|---|---|---|\n${rows}\n`);
console.log(JSON.stringify({transaction_count:result.transactions.length,processing_time_expiry:result.processing_time_expiry,readback:output}));
