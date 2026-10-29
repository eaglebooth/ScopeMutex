// No deploy/upgrade capability. Real SDK calls only after exact source parity.
import {createClient,createAccount} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {isDeepStrictEqual as same} from 'node:util';

const address=process.env.SCOPEMUTEX_CONTRACT;
const mode=process.argv[2]||'preflight';
const run=process.env.SCOPEMUTEX_RUN||'epoch-v2';
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw Error('Set SCOPEMUTEX_CONTRACT to the user-deployed address');
if(!['preflight','core','audit','race','queued'].includes(mode)||!/^[a-z][a-z0-9_-]{0,15}$/.test(run))throw Error('Invalid mode/run');
const check=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const client=()=>createClient({chain:studionet});
const read=async(functionName,args=[])=>JSON.parse(String(await client().readContract({address,functionName,args,transactionHashVariant:'latest-final'})));
const source=readFileSync('contracts/scope_mutex.py');
const remote=Buffer.from(await client().getContractCode(address),'utf8');
const version=await read('get_version');
mkdirSync('docs/live-evidence',{recursive:true});
const preflight={checked_at:new Date().toISOString(),address,chain_id:studionet.id,
 source_sha256:sha(source),deployed_sha256:sha(remote),byte_for_byte:source.equals(remote),version};
const preflightPath=`docs/live-evidence/preflight-${address.toLowerCase()}-${Date.now()}.json`;
writeFileSync(preflightPath,JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
check(preflight.byte_for_byte&&version.name==='ScopeMutex'&&version.version==='0.2.0'&&version.policy==='scopemutex/epoch-work-exclusion-v2','Preflight mismatch; no signing');
console.log(`Source parity: ${preflight.source_sha256}`);
if(mode==='preflight')process.exit(0);
const entry=process.env.GENLAYER_CLI_ENTRY;check(entry,'Set GENLAYER_CLI_ENTRY for authorized secondary OS-keychain accounts');
const keytar=createRequire(entry)('keytar');
const keys=await Promise.all(['dbl-owner','dbl-adapter'].map(n=>keytar.getPassword('genlayer-cli',`account:${n}`)));
check(keys.every(Boolean),'Missing authorized test accounts');
const actors=keys.map(k=>createAccount(k.startsWith('0x')?k:`0x${k}`));
check(same(actors.map(a=>a.address.toLowerCase()),['0xeb57bc7125fa60d7482ce12058397369ab3581f8','0x2da5393d7bbb9a037dc3abb56dbbc5c150fc843f']),'Wrong signers; never use main deployer');
const sampleBytes=readFileSync('samples/workboard.json'),sample=JSON.parse(sampleBytes);
const artifactBytes=readFileSync('samples/hand-in.txt'),artifact=sha(artifactBytes);
const context={address,chain_id:studionet.id,source_sha256:sha(source),sample_sha256:sha(sampleBytes),artifact_sha256:artifact,
 actors:actors.map(a=>a.address),run};
const path=`docs/live-evidence/run-${address.toLowerCase()}-${run}.jsonl`;
const events=existsSync(path)?readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const log=(event,data)=>{const item={at:new Date().toISOString(),event,...data};appendFileSync(path,JSON.stringify(item,(_,v)=>typeof v==='bigint'?String(v):v)+'\n');events.push(item)};
if(events.length)check(same(events[0].context,context),'Resume context mismatch');else log('context',{context});
log('session',{mode,preflight,runner_sha256:sha(readFileSync('scripts/live.mjs'))});
const bid=name=>actors[0].address.toLowerCase()+':'+name+'-'+run;
const rid=(board,actor,nonce,epoch=1)=>board+':e'+epoch+':'+actors[actor].address.toLowerCase()+':'+nonce;
const state=id=>read('get_request',[id]);
const board=id=>read('get_board',[id]);
async function observed(boardId,watch=[]){
 if(!boardId)return null;
 const b=await board(boardId),requests={};
 for(const id of [...new Set([...b.registered_ids,...watch])])requests[id]=await state(id);
 return {board:b,requests};
}
function stored(snapshot){return structuredClone(snapshot);}
function index(){
 const submitted=events.filter(e=>e.event==='submitted');
 const rows=submitted.map(s=>{
  const receipt=events.filter(e=>e.event==='receipt'&&e.label===s.label).at(-1);
  const intent=events.find(e=>e.event==='intent'&&e.label===s.label);
  const verified=events.some(e=>e.event==='verified'&&e.label===s.label);
  return `| ${s.label} | [tx](https://explorer-studio.genlayer.com/transactions/${s.hash}) | ${receipt?.transaction?.statusName||'pending'} | ${intent.input.expectedError||'success expected; inspect business result'} | ${verified?'verified':'incomplete'} |`;
 }).join('\n');
 writeFileSync(path.replace(/\.jsonl$/,'.md'),`# ScopeMutex actual live transaction index\n\nContract: [${address}](https://explorer-studio.genlayer.com/address/${address})\n\nSource SHA-256: ${context.source_sha256}\n\nRaw append-only events: [JSONL](${path.split('/').pop()}).\n\nRecorded phase completions: ${events.filter(e=>e.event==='phase-completed').map(e=>e.phase).join(', ')||'none'}. These are scoped observations, not proof of universal semantic reliability.\n\n| Step | Explorer | Finality | Execution expectation | Verification |\n|---|---|---|---|---|\n${rows}\n\nA finalized accepted consensus can contain an execution error or a business denial. Inspect receipt and authoritative readback. No fixture verdict is injected into a live call.\n`);
}
async function send(label,actor,method,args,boardId=null,expectedError=null,watch=[]){
 const input={actor:actors[actor].address,method,args,boardId,expectedError,watch};
 let intent=events.find(e=>e.event==='intent'&&e.label===label);
 const done=events.find(e=>e.event==='verified'&&e.label===label);
 if(intent)check(same(intent.input,input),'Resume input mismatch');
 if(done)return done.returned;
 let submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 if(intent&&!submitted){
  const reviewed=events.filter(e=>e.event==='prebroadcast-failure-reviewed'&&e.label===label).length;
  const resumed=events.filter(e=>e.event==='reviewed-intent-resumed'&&e.label===label).length;
  check(reviewed>resumed,'Ambiguous prior signing intent: investigate before resending');
  log('reviewed-intent-resumed',{label});
 }
 if(!submitted){
  if(!intent){intent={label,input,before:await observed(boardId,watch)};log('intent',intent);}
  const sent=await createClient({chain:studionet,account:actors[actor]}).writeContract({address,functionName:method,args,value:0n});
  const hash=typeof sent==='string'?sent:sent.txId;log('submitted',{label,hash});index();
  check(/^0x[0-9a-fA-F]{64}$/.test(hash),'Invalid hash');submitted={hash};
 }
 console.log(`${label}: ${submitted.hash}`);
 let tx;
 for(let i=0;i<180;i++){
  tx=await client().getTransaction({hash:submitted.hash});
  if(tx.statusName==='FINALIZED')break;
  await new Promise(r=>setTimeout(r,2500));
 }
 log('receipt',{label,transaction:tx});index();
 check(tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','No finalized accepted consensus; inspect existing hash, do not resend');
 check(tx.from_address?.toLowerCase()===actors[actor].address.toLowerCase()&&tx.to_address?.toLowerCase()===address.toLowerCase(),'Receipt binding mismatch');
 const receipts=tx.consensus_data?.leader_receipt;
 const list=Array.isArray(receipts)?receipts:Object.values(receipts||{});
 const leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName;
 check(execution===(expectedError?'ERROR':'SUCCESS'),'Unexpected execution result');
 const payload=leader?.result?.payload;
 const returned=payload&&typeof payload==='object'&&typeof payload.readable==='string'?JSON.parse(payload.readable):payload;
 let after=events.find(e=>e.event==='readback'&&e.label===label)?.after;
 if(after===undefined){after=await observed(boardId,watch);log('readback',{label,after});}
 if(expectedError){
  check(payload===expectedError,'Wrong rejection reason');
  check(same(stored(intent.before),stored(after)),'Rejected operation changed stored state');
 }
 log('verified',{label,returned});index();return returned;
}
async function create(name){
 const id=bid(name),digestArgs=[`${name}-${run}`,sample.brief,JSON.stringify(actors.map(a=>a.address))];
 const returned=await send(`${name}-create`,0,'create_board',digestArgs);
 check(returned===id,'Wrong board identity');return id;
}
async function acquire(label,boardId,actor,nonce,work,allowed,retry=0){
 const input={boardId,actor,nonce,work,allowed};
 const verified=events.find(e=>e.event==='business-verified'&&e.label===label);
 if(verified){check(same(verified.input,input),'Business resume mismatch');return verified.request_id;}
 const b=await board(boardId);
 const returned=await send(label,actor,'claim_work',[boardId,b.round_digest,b.epoch,nonce,work],boardId);
 check(returned===rid(boardId,actor,nonce,b.epoch),'Wrong request identity');
 const request=await state(returned),current=await board(boardId);
 log('business-readback',{label,request,board:current});
 if(request.stored_state==='UNRESOLVED'&&!allowed.includes('UNRESOLVED')&&retry===0){
  log('retry-intent',{label,previous_request:returned,diagnostic:request.assessment.diagnostic,
   scope:'One fresh nonce, same declaration, current snapshot; prior denial preserved'});
  return acquire(label+'-retry',boardId,actor,nonce+'-r1',work,allowed,1);
 }
 check(allowed.includes(request.stored_state),`${label}: unexpected semantic result ${request.stored_state}; inspect diagnostic`);
 if(request.stored_state==='HELD')check(current.registered_ids.includes(returned)&&request.stored_state==='HELD'&&request.epoch===current.epoch,'Acquired right not currently registered');
 else check(!current.registered_ids.includes(returned),'Denied request acquired a right');
 log('business-verified',{label,input,request_id:returned});
 return returned;
}
// Probe-only submissions intentionally overlap. Each uses a different secondary
// account. They do not assert whole-board no-mutation while another tx changes it.
async function begin(label,actor,method,args,boardId){
 const input={actor:actors[actor].address,method,args,boardId,expectedError:'probe-specific assertions',watch:[]};
 const intent=events.find(e=>e.event==='intent'&&e.label===label);
 const submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 if(intent)check(same(intent.input,input),'Probe resume mismatch');
 if(submitted)return submitted.hash;
 check(!intent,'Ambiguous probe intent; inspect before resending');
 log('intent',{label,input,before:await observed(boardId)});
 const raw=await createClient({chain:studionet,account:actors[actor]}).writeContract({address,functionName:method,args,value:0n});
 const hash=typeof raw==='string'?raw:raw.txId;log('submitted',{label,hash});index();
 check(/^0x[0-9a-fA-F]{64}$/.test(hash),'Invalid probe hash');console.log(`${label}: ${hash}`);return hash;
}
async function collect(label,allowedErrors=[]){
 const submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 const intent=events.find(e=>e.event==='intent'&&e.label===label);
 check(submitted&&intent,'Probe not submitted');
 const done=events.find(e=>e.event==='verified'&&e.label===label);
 if(done)return {...done,transaction:events.filter(e=>e.event==='receipt'&&e.label===label).at(-1).transaction};
 let tx;
 for(let i=0;i<180;i++){tx=await client().getTransaction({hash:submitted.hash});if(tx.statusName==='FINALIZED')break;await new Promise(r=>setTimeout(r,2500));}
 log('receipt',{label,transaction:tx});index();
 check(tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','Probe consensus/finality not accepted');
 check(tx.from_address.toLowerCase()===intent.input.actor.toLowerCase()&&tx.to_address.toLowerCase()===address.toLowerCase(),'Probe binding mismatch');
 const raw=tx.consensus_data?.leader_receipt;const list=Array.isArray(raw)?raw:Object.values(raw||{});
 const leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName;
 const payload=leader?.result?.payload;
 check(execution==='SUCCESS'||(execution==='ERROR'&&allowedErrors.includes(payload)),'Unexpected probe execution');
 const returned=payload&&typeof payload==='object'&&typeof payload.readable==='string'?JSON.parse(payload.readable):payload;
 log('readback',{label,after:await observed(intent.input.boardId)});
 log('verified',{label,returned,execution,payload});index();return {returned,execution,payload,transaction:tx};
}
const handArgs=async id=>[id,(await state(id)).request_digest,artifact];
const releaseArgs=async id=>[id,(await state(id)).request_digest];
try{
 if(events.some(e=>e.event==='phase-completed'&&e.phase===mode)){console.log(`${mode} already complete; no signing`);process.exit(0)}
 if(mode==='core'){
  const id=await create('core'),initial=await board(id);
  const a=await acquire('core-hold-a',id,0,'first',sample.quickstart,['HELD']);
  const denied=await acquire('core-overlap',id,1,'overlap',sample.overlap,['CONFLICT']);
  await send('core-conflict-hand-in-denied',1,'hand_in',await handArgs(denied),id,'NOT_HELD',[denied]);
  await send('core-other-release-denied',1,'release',await releaseArgs(a),id,'HOLDER_ONLY');
  await send('core-noncreator-close',1,'close_intake',[id,1],id,'CREATOR_ONLY');
  await send('core-wrong-round-digest',1,'claim_work',[id,'0'.repeat(64),1,'wrong',sample.disjoint],id,'ROUND_DIGEST_MISMATCH');
  await send('core-double-hold',0,'claim_work',[id,initial.round_digest,1,'double',sample.disjoint],id,'ALREADY_HOLDING');
  await acquire('core-outside',id,1,'outside',sample.outside,['OUT_OF_SCOPE']);
  const b=await acquire('core-disjoint',id,1,'translation',sample.disjoint,['HELD']);
  await send('core-replay',1,'claim_work',[id,initial.round_digest,1,'translation',sample.disjoint],id,'REQUEST_REPLAY');
  await send('core-bad-artifact',1,'hand_in',[b,(await state(b)).request_digest,'bad'],id,'INVALID_ARTIFACT_DIGEST');
  await send('core-close-intake',0,'close_intake',[id,1],id);
  await send('core-hand-in-after-intake-close',1,'hand_in',await handArgs(b),id);
  check((await state(b)).artifact_digest===artifact,'Artifact mismatch');
  await send('core-closed-intake-denial',1,'claim_work',[id,initial.round_digest,1,'late',sample.disjoint],id,'INTAKE_CLOSED',[b]);
  const cancelled=await send('core-end-round',0,'end_round',[id,1],id);
  check(cancelled===1&&(await state(a)).stored_state==='CANCELLED','End-round cancellation mismatch');
  await send('core-old-hand-in-after-end',0,'hand_in',await handArgs(a),id,'ROUND_NOT_ACTIVE',[a]);
  check(await send('core-start-round',0,'start_round',[id,1],id)===2,'Epoch did not advance');
  await send('core-stale-close',0,'close_intake',[id,1],id,'STALE_ROUND');
  await send('core-stale-end',0,'end_round',[id,1],id,'STALE_ROUND');
  await send('core-old-claim-epoch',1,'claim_work',[id,initial.round_digest,1,'old',sample.disjoint],id,'STALE_ROUND');
  const renewed=await acquire('core-round2-acquire',id,0,'first',sample.quickstart,['HELD']);
  check((await state(renewed)).epoch===2&&renewed!==a,'Fresh round claim not isolated');
  await send('core-round2-hand-in',0,'hand_in',await handArgs(renewed),id);
  check((await board(id)).registered_ids.length===0,'Core register not empty');
 }else if(mode==='audit'){
  const id=await create('audit');
  const a=await acquire('audit-hold',id,0,'hold',sample.quickstart,['HELD']);
  const denied=await acquire('audit-injection',id,1,'injection',sample.injection,['CONFLICT','UNRESOLVED']);
  await send('audit-denied-hand-in',1,'hand_in',await handArgs(denied),id,'NOT_HELD',[denied]);
  await send('audit-holder-hand-in',0,'hand_in',await handArgs(a),id);
 }else if(mode==='race'){
  const id=await create('race'),b=await board(id);
  await Promise.all([
   begin('race-submit-a',0,'claim_work',[id,b.round_digest,1,'race-a',sample.quickstart],id),
   begin('race-submit-b',1,'claim_work',[id,b.round_digest,1,'race-b',sample.overlap],id)]);
  const results=await Promise.all([collect('race-submit-a',['STALE_SNAPSHOT']),collect('race-submit-b',['STALE_SNAPSHOT'])]);
  const requests=[];
  for(let i=0;i<2;i++)if(results[i].execution==='SUCCESS'){
   check(results[i].returned===rid(id,i,i===0?'race-a':'race-b',1),'Race request binding mismatch');
   requests.push(await state(results[i].returned));
  }
  const current=await board(id),held=requests.filter(p=>p.stored_state==='HELD');
  check(held.length===1&&current.registered_ids.length===1,'Race did not yield one right');
  const winner=held[0],actor=winner.claimant.toLowerCase()===actors[0].address.toLowerCase()?0:1;
  log('race-outcome',{requests,board:current,winner_actor:actor});
  await send('race-nonholder-hand-in',1-actor,'hand_in',await handArgs(winner.id),id,'HOLDER_ONLY');
  await send('race-winner-hand-in',actor,'hand_in',await handArgs(winner.id),id);
 }else if(mode==='queued'){
  const id=await create('queued');
  const old=await acquire('queued-old-right',id,1,'same-nonce',sample.quickstart,['HELD']);
  const oldArgs=await handArgs(old);
  await begin('queued-end',0,'end_round',[id,1],id);
  // Deliberately submit the old payload before waiting for end-round finality.
  await begin('queued-old-consumer',1,'hand_in',oldArgs,id);
  const ending=await collect('queued-end'),consumer=await collect('queued-old-consumer',['ROUND_NOT_ACTIVE']);
  check(ending.execution==='SUCCESS'&&consumer.execution==='ERROR','Queued old consumer not rejected');
  check((await state(old)).stored_state==='CANCELLED'&&(await state(old)).artifact_digest==='','Old right activated after round end');
  log('queued-outcome',{end_hash:ending.transaction.hash,consumer_hash:consumer.transaction.hash,
   scope:'Old request payload submitted without awaiting end finality, then denied; state ordering, not a wall-clock claim'});
  await send('queued-start-round2',0,'start_round',[id,1],id);
  const renewed=await acquire('queued-round2-acquire',id,1,'same-nonce',sample.quickstart,['HELD']);
  await send('queued-old-replay',1,'hand_in',oldArgs,id,'ROUND_NOT_ACTIVE',[old]);
  await send('queued-round2-release',1,'release',await releaseArgs(renewed),id);
 }
 log('phase-completed',{phase:mode});index();console.log(`${mode} complete; scoped live results recorded`);
}catch(error){log('error',{phase:mode,error:String(error.stack||error)});index();console.error(String(error));process.exitCode=1}
