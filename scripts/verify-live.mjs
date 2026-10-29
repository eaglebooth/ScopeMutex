// Read-only verification; never signs or edits append-only events.
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const address=process.env.SCOPEMUTEX_CONTRACT,run=process.env.SCOPEMUTEX_RUN||'epoch-v2';
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw Error('Set contract');
const check=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const canonical=x=>JSON.stringify(sorted(x)).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const client=()=>createClient({chain:studionet});
const read=async(functionName,args=[])=>JSON.parse(String(await client().readContract({address,functionName,args,transactionHashVariant:'latest-final'})));
const source=readFileSync('contracts/scope_mutex.py');
check(source.equals(Buffer.from(await client().getContractCode(address),'utf8')),'Source mismatch');
const version=await read('get_version');
check(version.version==='0.2.0'&&version.policy==='scopemutex/epoch-work-exclusion-v2'&&!version.automatic_expiry,'Wrong release');
const folder='docs/live-evidence',file=`run-${address.toLowerCase()}-${run}.jsonl`;
const events=readFileSync(`${folder}/${file}`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
check(events[0].context.source_sha256===sha(source)&&events[0].context.chain_id===studionet.id,'Context mismatch');
for(const phase of ['core','audit','race','queued'])check(events.some(e=>e.event==='phase-completed'&&e.phase===phase),`Incomplete ${phase}`);
const result={checked_at:new Date().toISOString(),address,chain_id:studionet.id,source_sha256:sha(source),version,requests:{},boards:{},transactions:[]};
const ids=new Set();
for(const e of events){if(e.event==='business-readback')ids.add(e.request.id);if(e.event==='race-outcome')for(const p of e.requests)ids.add(p.id);}
const artifact=sha(readFileSync('samples/hand-in.txt'));
for(const id of ids){
 const p=await read('get_request',[id]),snapshotDigest=sha(canonical(p.snapshot));
 check(p.assessment.snapshot_digest===snapshotDigest&&p.request_digest===sha(canonical({round_digest:p.snapshot.round_digest,request_id:id,claimant:p.claimant,work:p.work,snapshot_digest:snapshotDigest})),'Request binding mismatch');
 check(p.stored_state!=='HELD'&&p.artifact_digest===(p.stored_state==='HANDED_IN'?artifact:''),'Outstanding right/artifact mismatch');
 result.requests[id]=p;
}
const actors=events[0].context.actors.map(a=>a.toLowerCase());
for(const name of ['core','audit','race','queued']){
 const id=actors[0]+':'+name+'-'+run,b=await read('get_board',[id]);
 check(b.creator===actors[0]&&b.registered_ids.length===0,'Board register mismatch');
 check(b.board_digest===sha(canonical({policy:version.policy,chain_id:studionet.id,contract:address.toLowerCase(),board_id:id,creator:b.creator,brief:b.brief,roster:b.roster,round_authority:version.round_authority})),'Board commitment mismatch');
 check(b.round_digest===sha(canonical({policy:version.policy,board_digest:b.board_digest,epoch:b.epoch})),'Round binding mismatch');
 if(['core','queued'].includes(name))check(b.epoch===2,'Recovery round not advanced');result.boards[name]=b;
}
const labels={};for(const e of events.filter(e=>e.event==='business-verified'))labels[e.label]=result.requests[e.request_id];
const find=n=>labels[n]||labels[n+'-retry'];
check(find('core-hold-a').stored_state==='CANCELLED'&&find('core-disjoint').stored_state==='HANDED_IN','Core consumer state mismatch');
check(find('core-overlap').stored_state==='CONFLICT'&&find('core-outside').stored_state==='OUT_OF_SCOPE','Semantic control mismatch');
check(find('queued-old-right').stored_state==='CANCELLED'&&find('queued-round2-acquire').stored_state==='RELEASED','Queued/recovery mismatch');
for(const s of events.filter(e=>e.event==='submitted')){
 const intent=events.find(e=>e.event==='intent'&&e.label===s.label),tx=events.filter(e=>e.event==='receipt'&&e.label===s.label).at(-1)?.transaction;
 check(tx&&events.some(e=>e.event==='verified'&&e.label===s.label),'Unverified transaction');
 check(tx.hash===s.hash&&tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','Finality/hash mismatch');
 check(tx.from_address.toLowerCase()===intent.input.actor.toLowerCase()&&tx.to_address.toLowerCase()===address.toLowerCase(),'Actor/target mismatch');
 const raw=tx.consensus_data.leader_receipt,list=Array.isArray(raw)?raw:Object.values(raw||{}),leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName,expected=intent.input.expectedError;
 if(expected&&expected!=='probe-specific assertions')check(execution==='ERROR'&&leader.result.payload===expected,'Wrong error');
 else if(!expected)check(execution==='SUCCESS','Unexpected error');
 result.transactions.push({label:s.label,hash:s.hash,execution,expected:expected||'success; inspect business state'});
}
const out=`${folder}/independent-${address.toLowerCase()}-${Date.now()}.json`;
writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const rows=result.transactions.map(t=>`| ${t.label} | [tx](https://explorer-studio.genlayer.com/transactions/${t.hash}) | ${t.execution} | ${t.expected} |`).join('\n');
writeFileSync('docs/LIVE_E2E_EVIDENCE.md',`# ScopeMutex v0.2.0 epoch live evidence\n\nChecked: ${result.checked_at}\n\nContract: [${address}](https://explorer-studio.genlayer.com/address/${address})\n\nSource parity SHA-256: \`${sha(source)}\`. Two secondary accounts signed. No frontend.\n\nObserved scope/overlap/disjoint admission, authenticated hand-in, intake closure, explicit end-round cancellation, stale epoch/digest/replay denial, new-round recovery, one injection control, near-concurrent mutex and old-payload rejection after end-round. These are bounded observations, not all possible schedules or universal injection resistance. Coordinator revocation authority is explicit; no wall-clock expiry is claimed.\n\n[Independent readbacks](${out.replace('docs/','')}) · [Append-only events](live-evidence/${file})\n\n## All ${result.transactions.length} actual test transactions\n\nAll finalized with MAJORITY_AGREE; execution errors and business denials remain distinct.\n\n| Step | Explorer | Execution | Expectation |\n|---|---|---|---|\n${rows}\n`);
console.log(JSON.stringify({verified:true,transaction_count:result.transactions.length,readback:out}));
