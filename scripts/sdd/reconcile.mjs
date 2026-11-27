import { api, config, currentStatus, graphql, issueNumber, listPullRequests, main, parsePrContract, project, projectItem, readIssue, setStatus, sddIdentity, closeCompleted } from './core.mjs';
import { decide } from './reconcile-policy.mjs';
import { collectEvidence, clearEvidenceCache } from './reconcile-evidence.mjs';

const repo = 'repos/' + config.repository;
function args(values) {
  let apply = false, number = null, advanced = false, closeDelivered = false; const numbers = [];
  for (let i=0;i<values.length;i++) {
    if (values[i] === '--apply') apply = true;
    else if (values[i] === '--dry-run') apply = false;
    else if (values[i] === '--advanced') advanced = true;
    else if (values[i] === '--close-delivered') closeDelivered = true;
    else if (values[i] === '--issue') { number = issueNumber(values[++i]); numbers.push(number); }
    else throw new Error('Argumento inválido: ' + values[i]);
  }
  if (advanced && (!apply || numbers.length!==1)) throw new Error('--advanced exige --apply --issue N para validação controlada.');
  if (closeDelivered && (!apply || !numbers.length || advanced)) throw new Error('--close-delivered exige --apply e IDs explícitos; não combinar com --advanced.');
  return { apply, numbers, advanced, closeDelivered };
}
function allItems(board) {
  let cursor = null;
  const map = new Map();
  do {
    const data = graphql('query($project:ID!,$cursor:String){node(id:$project){... on ProjectV2{items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id isArchived content{... on Issue{number repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}', {project:board.id,cursor});
    const page = data.node?.items;
    if (!page || !Array.isArray(page.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw new Error('Project: leitura incompleta');
    for (const item of page.nodes) {
      if (item.content?.repository?.nameWithOwner !== config.repository) continue;
      const n = item.content.number;
      if (map.has(n)) throw new Error('Card duplicado para #' + n);
      map.set(n, {id:item.id,status:item.fieldValueByName?.name ?? null,archived:item.isArchived});
    }
    if (!page.pageInfo.hasNextPage) break;
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === cursor) throw new Error('Cursor inválido');
    cursor = page.pageInfo.endCursor;
  } while (true);
  return map;
}
const priorityOf = issue => (issue.issue_field_values || []).find(f=>f.issue_field_id === config.priorityFieldId || f.issue_field_name === 'Priority')?.single_select_option?.name;
function relatedPrs(prs, n) {
  return prs.filter(pr=>{
    try { return parsePrContract(pr.body || '').issueNumber === n; }
    catch { return new RegExp('/0*'+n+'(?:-|$)').test(pr.head?.ref || ''); }
  });
}
function branchesFor(branches,n) { return branches.filter(b=>new RegExp('^(feat|fix|refactor|techdebt)/0*'+n+'-').test(b.name)); }
function snapshot(issue,item,prs,branches) {
  const eligible = Boolean(config.types[issue.type?.name]);
  const related = relatedPrs(prs, issue.number);
  const refs = branchesFor(branches,issue.number);
  const priority = priorityOf(issue);
  const evidence = {activity: Boolean(related.length || refs.length), prs: related.map(p=>({number:p.number,state:p.state,merged:!!p.merged_at})), branches:refs.map(b=>b.name)};
  if (item?.archived && issue.state === 'open') evidence.conflict = 'Card arquivado com issue aberta';
  // A PR or branch is evidence of activity, never sufficient proof of gate approval,
  // final delivery, or current stage. Historical attestations require independent validation.
  if (related.length || refs.length || item?.status === 'Done') evidence.incomplete = true;
  return {issue,item,eligible,priority,evidence,teamAccess: /^\[team\]/i.test(issue.title || '')};
}
function applyDecision(s, d, board, advanced) {
  if (d.target !== 'Backlog' && !advanced) return 'pending-validation';
  const fresh = readIssue(s.issue.number);
  const freshItem = projectItem(fresh.issue,board);
  if (fresh.issue.state !== s.issue.state || fresh.issue.updated_at !== s.issue.updated_at || fresh.issue.type?.name !== s.issue.type?.name ||
      (freshItem?.id ?? null) !== (s.item?.id ?? null) || (freshItem?.status ?? null) !== (s.item?.status ?? null) ||
      freshItem?.archived) throw new Error('Conflito de estado; nenhuma alteração efetuada');
  sddIdentity(fresh.issue,{requireOpen:false});
  const pr = relatedPrs(listPullRequests({base:config.baseBranch,state:'all'}),fresh.issue.number);
  const refs = branchesFor(api(repo+'/branches?per_page=100',{paginate:true}),fresh.issue.number);
  const releases = listPullRequests({base:'main',state:'closed'}).filter(p=>p.merged_at&&p.head?.ref===config.baseBranch);
  clearEvidenceCache();
  const evidence=collectEvidence(fresh.issue,freshItem,pr,refs,releases,fresh,board);
  const priority=fresh.fields.find(f=>f.issue_field_name==='Priority')?.single_select_option?.name;
  const verified=decide({issue:fresh.issue,item:freshItem,eligible:true,priority,evidence});
  if (verified.action!==d.action || verified.target!==d.target) throw new Error('Evidência mudou durante revalidação; nenhuma alteração efetuada.');
  if (d.action!=='close') setStatus(fresh.issue,d.target,board,{expected:s.item?.status ?? null});
  if (currentStatus(fresh.issue,board)!==d.target) throw new Error('Status não confirmado');
  if (['finish','close'].includes(d.action) && fresh.issue.state==='open') {
    const latest=readIssue(fresh.issue.number);
    if(latest.issue.state!=='open'||latest.issue.updated_at!==fresh.issue.updated_at||latest.blockedBy.some(b=>b.state==='open')||currentStatus(latest.issue,board)!=='Done') throw new Error('Status corrigido, fechamento suspenso por alteração concorrente.');
    closeCompleted(latest.issue);
  }
  return 'verified';
}
main(()=>{
  const {apply,numbers,advanced,closeDelivered} = args(process.argv.slice(2));
  const board = project();
  const cards = allItems(board);
  const issues = api(repo+'/issues?state=all&per_page=100',{paginate:true}).filter(i=>!i.pull_request && (!numbers.length || numbers.includes(i.number)));
  const prs = listPullRequests({base:config.baseBranch,state:'all'});
  const branches = api(repo+'/branches?per_page=100',{paginate:true});
  const releases=listPullRequests({base:'main',state:'closed'}).filter(p=>p.merged_at&&p.head?.ref===config.baseBranch);
  let failures=0;
  const results=[];
  for (const issue of issues) {
    const s=snapshot(issue,cards.get(issue.number),prs,branches);
    if (s.eligible && (issue.state==='open' || (s.item?.status!=='Done' && issue.state_reason==='completed'))) {
      try {
        const context=readIssue(issue.number);
        s.issue=context.issue;
        s.priority=context.fields.find(f=>f.issue_field_name==='Priority')?.single_select_option?.name;
        s.evidence=collectEvidence(s.issue,s.item,relatedPrs(prs,issue.number),branchesFor(branches,issue.number),releases,context,board);
      } catch(error) { s.evidence.conflict='Falha na coleta de evidências: '+error.message; failures++; }
    } else if (s.item?.status==='Done' && issue.state==='closed' && issue.state_reason==='completed') {
      s.evidence={};
    }
    const decision=decide(s);
    if (decision.action==='ignore') continue;
    if (s.eligible && !s.priority && issue.state==='open') decision.priorityMissing=true;
    decision.evidence=s.evidence;
    if (apply && ['status','finish','close'].includes(decision.action)) {
      try { decision.result=closeDelivered && decision.action!=='close'?'skipped-close-only':applyDecision(s,decision,board,advanced||closeDelivered); }
      catch (error) { decision.result='failed'; decision.error=error.message; failures++; }
    }
    results.push(decision);
    if (apply) console.error(JSON.stringify({number:decision.number,action:decision.action,result:decision.result ?? "no-write",reason:decision.reason,error:decision.error}));
  }
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',issues:issues.length,results,failures},null,2));
  if (failures) process.exitCode=1;
});
