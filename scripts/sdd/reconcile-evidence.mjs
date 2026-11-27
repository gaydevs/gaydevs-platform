import { api, compareCommits, config, parsePrContract, readPullRequest, specIdForIssue, statusHistory } from './core.mjs';
const repo='repos/'+config.repository;
const cache=new Map();
export function clearEvidenceCache(){cache.clear();}
const memo=(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key);};
const member=r=>['OWNER','MEMBER','COLLABORATOR'].includes(r.author_association);
function approved(pr) {
  if(!pr?.head?.sha || !pr.merged_at) return false;
  const reviews=api(repo+'/pulls/'+pr.number+'/reviews?per_page=100',{paginate:true});
  const last=new Map();
  for(const r of reviews.sort((a,b)=>String(a.submitted_at).localeCompare(String(b.submitted_at)))) {
    if(!r.submitted_at || r.submitted_at > pr.merged_at || !member(r) || r.user?.type!=='User' || !r.user?.login || r.user.login===pr.user?.login)continue;
    if(['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state)) last.set(r.user.login,r);
  }
  return [...last.values()].some(r=>r.state==='APPROVED' && r.commit_id===pr.head.sha) && ![...last.values()].some(r=>r.state==='CHANGES_REQUESTED');
}
function releaseRange(r) {
  return memo('release:'+r.number,()=>{
    const detail=readPullRequest(r.number);
    if(!detail.merged || !detail.merge_commit_sha)return null;
    const commit=api(repo+'/commits/'+detail.merge_commit_sha);
    const base=commit.parents?.[0]?.sha;
    if(!base || commit.parents?.length!==2)return null;
    const comparison=compareCommits(base,detail.merge_commit_sha);
    return {detail,base,commits:new Set(comparison.commits.map(c=>c.sha))};
  });
}
function ancestral(sha,ref) {
  const c=api(repo+'/compare/'+sha+'...'+ref+'?per_page=1&page=1');
  return ['identical','ahead'].includes(c.status) && c.behind_by===0;
}
function deploys(sha,paths) {
  for(const [prefix,workflow] of [['backend/','backend-deploy.yml'],['frontend/','frontend-deploy.yml']]) {
    if(!paths.some(p=>p.startsWith(prefix)||p==='.github/workflows/'+workflow))continue;
    const r=api(repo+'/actions/workflows/'+workflow+'/runs?head_sha='+sha+'&branch=main&per_page=100');
    if(!Array.isArray(r.workflow_runs)||r.total_count>r.workflow_runs.length)return false;
    const latest=r.workflow_runs.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
    if(latest?.head_sha!==sha || latest.status!=='completed'||latest.conclusion!=='success')return false;
  }
  return true;
}
// Delivery evidence is deliberately stricter than merely finding a merge.
export function collectEvidence(issue,item,related,refs,releases,context,board) {
  const e={activity:Boolean(related.length||refs.length),prs:related.map(p=>p.number),branches:refs.map(b=>b.name)};
  if(item?.archived && issue.state==='open'){e.conflict='Card arquivado com issue aberta';return e;}
  const changes=statusHistory(issue,board);
  if(!item && (changes.length || context.comments.length)) e.activity=true;
  const regressions=changes.filter(x=>x.actor?.login?.replace(/\[bot\]$/,'')==='github-project-automation' && x.status==='Backlog' && x.previousStatus && x.previousStatus!=='Backlog');
  e.regressions=regressions.map(x=>({id:x.id,at:x.createdAt,from:x.previousStatus,to:x.status,actor:x.actor.login}));
  const last=changes.at(-1);
  const nativeReset=last && regressions.some(x=>x.id===last.id) && last.status===item?.status;
  // Prior status is evidence of a regression, not proof of a missing human gate.
  if(nativeReset) e.regressedFrom=last.previousStatus;
  if(context.blockedBy.some(b=>b.state==='open'))e.blocked=true;
  if(issue.state==='closed' && item?.status==='Done' && issue.state_reason==='completed')return e;
  const events=api(repo+'/issues/'+issue.number+'/timeline?per_page=100',{paginate:true});
  if(events.some(x=>x.event==='reopened')){e.reopened=true;return e;}
  if(context.comments.some(c=>/--exclude-issue\s+|exclu[ií]d[ao]s? explicitamente/i.test(c.body||''))){e.excluded=true;return e;}
  const open=related.filter(p=>p.state==='open');
  if(open.length) {
    if(open.length!==1 || open[0].draft || item?.status==='Specifying' || nativeReset) {
      e.conflict='PR aberto: etapa/gates devem ser confirmados; não promover por existência do PR';
      return e;
    }
    const pr=open[0];
    let contract;
    try { contract=parsePrContract(pr.body||''); } catch { e.conflict='Contrato de PR inválido';return e; }
    if(contract.issueNumber!==issue.number || contract.specId!==specIdForIssue(issue.number) || pr.base?.ref!==config.baseBranch || !['In Progress','Review'].includes(item?.status)) {
      e.conflict='PR aberto: contrato ou etapa incompatível';return e;
    }
    e.workPr='open';
    // A later move to In Progress may be deliberate (resumed work after
    // review/escalation). An already-open PR must not undo that decision.
    e.gates=Boolean(last?.status===item.status && last.actor?.login && !last.actor.login.startsWith('github-project-automation') &&
      (item.status==='Review' || (pr.created_at && pr.created_at>=last.createdAt)));
    if(item.status==='In Progress' && !e.gates)e.conflict='PR anterior à última transição In Progress; preservar decisão mais recente';
    return e;
  }
  const merged=related.filter(p=>p.merged_at).sort((a,b)=>String(b.merged_at).localeCompare(String(a.merged_at)));
  if(!merged.length) {
    // A recorded transition to Specifying may be restored only for a
    // published branch that contains exactly its spec. No approval inferred.
    if(nativeReset && last.previousStatus==='Specifying' && refs.length===1 && !related.length) {
      const branch=refs[0];
      const directory='specs/'+branch.name.split('/').at(-1);
      const files=api(repo+'/contents/'+directory+'?ref='+encodeURIComponent(branch.commit.sha));
      e.specifying=Array.isArray(files) && files.filter(f=>f.name==='spec.md'&&f.type==='file').length===1;
    }
    if(related.length===1 && related[0].state==='closed' && item?.status==='Review' && last?.status==='Review' && !nativeReset) {
      try {
        const pr=related[0], contract=parsePrContract(pr.body||'');
        e.gates=contract.issueNumber===issue.number && contract.specId===specIdForIssue(issue.number) && pr.base?.ref===config.baseBranch;
        if(e.gates)e.workPr='closed';
      } catch { e.incomplete=true; }
    }
    if(e.activity && !e.specifying && !e.workPr && !['Specifying','Ready','In Progress','Review'].includes(item?.status))e.incomplete=true;
    return e;
  }
  const latest=readPullRequest(merged[0].number);
  const contract=parsePrContract(latest.body||'');
  if(contract.issueNumber!==issue.number || (contract.specId && contract.specId!==specIdForIssue(issue.number)) || (issue.type?.name==='Feature' && !contract.specId) || !latest.merged || !latest.merge_commit_sha || latest.base?.ref!==config.baseBranch ||
      !new RegExp('^(feat|fix|refactor|techdebt)/0*'+issue.number+'-').test(latest.head?.ref||'')) {e.incomplete=true;return e;}
  if(related.some(p=>!p.merged_at && String(p.updated_at)>String(latest.merged_at)) ||
      refs.some(b=>b.name!==latest.head.ref || b.commit?.sha!==latest.head.sha)) {e.pendingWork=true;return e;}
  if(!approved(latest)){e.conflict='Review humano do PR de trabalho não comprovado';return e;}
  e.workPr='merged';e.workMerge=latest.merge_commit_sha;
  // Do not reconstruct a missing implementation gate from a code review.
  // A verified current Review/Ready for Release is the only automatic
  // intermediate transition supported by this first evidence collector.
  e.gates=['Review','Ready for Release'].includes(item?.status) && last?.status===item.status;
  for(const r of releases.filter(r=>r.merged_at>=latest.merged_at).sort((a,b)=>String(a.merged_at).localeCompare(String(b.merged_at)))) {
    const range=releaseRange(r);
    if(!range?.commits.has(latest.merge_commit_sha))continue;
    const rel=range.detail;
    if(!approved(rel)||!ancestral(rel.merge_commit_sha,'main')) {e.conflict='Release ou review não comprovado';return e;}
    // Later commits may include rollback or new work. Inspect the entire
    // interval and fail closed on revert/rollback evidence.
    const after=compareCommits(rel.merge_commit_sha,'main');
    if(after.commits.some(c=>/\brevert\b|\brollback\b/i.test(c.commit?.message||''))){e.conflict='Possível rollback posterior à release';return e;}
    // Deploy relevance is per work PR, not unrelated changes in the same
    // release. The release commit range already proves delivery to main.
    const files=api(repo+'/pulls/'+latest.number+'/files?per_page=100',{paginate:true});
    if(!Number.isInteger(latest.changed_files)||files.length!==latest.changed_files){e.conflict='Diff do PR de trabalho incompleto';return e;}
    if(!deploys(rel.merge_commit_sha,files.map(f=>f.filename))){e.conflict='Deploy não comprovado';return e;}
    e.delivered=true;e.release=rel.number;e.releaseSha=rel.merge_commit_sha;
    return e;
  }
  return e;
}
