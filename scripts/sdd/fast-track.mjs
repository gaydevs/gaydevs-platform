import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { api, assertUnblocked, config, currentSddBranch, currentStatus, fastTrackRisk, localSpecDirectory, main, project, readIssue, setStatus } from './core.mjs';

const riskRank = { low: 0, medium: 1, high: 2 };
const label = risk => risk[0].toUpperCase() + risk.slice(1);
const mediumCheckpointMarker = '<!-- gaydevs-sdd:fast-track-checkpoint:medium -->';

function readRisk(number) {
  const directory = localSpecDirectory(number);
  if (!directory) throw new Error('Spec local da Issue não encontrada neste checkout.');
  const specPath = path.join(directory, 'spec.md');
  const content = readFileSync(specPath, 'utf8');
  const match = /^Fast-track risk:\s*(Low|Medium|High)\s*$/mi.exec(content);
  if (!match) throw new Error('A spec não contém marcador Fast-track risk rastreável.');
  return { directory, specPath, content, risk: match[1].toLowerCase() };
}

function replaceRisk(file, to) {
  if (!readFileSync(file, 'utf8').match(/^Fast-track risk:/mi)) return;
  const content = readFileSync(file, 'utf8').replace(/^Fast-track risk:\s*(Low|Medium|High)\s*$/mi, `Fast-track risk: ${label(to)}`);
  writeFileSync(file, content);
}

main(() => {
  const [number, action, value, ...rest] = process.argv.slice(2);
  if (!number || !action) throw new Error('Uso: fast-track.mjs ISSUE checkpoint --human-approved | fast-track.mjs ISSUE escalate medium|high');
  const branch = currentSddBranch();
  if (branch.issueNumber !== Number(number)) throw new Error(`A branch atual pertence à Issue #${branch.issueNumber}, não à #${number}.`);
  const context = readIssue(number);
  const state = readRisk(number);
  const board = project();

  if (action === 'checkpoint') {
    const flags = [value, ...rest].filter(Boolean);
    if (flags.some(flag => flag !== '--human-approved')) throw new Error('Checkpoint aceita apenas --human-approved.');
    if (!flags.includes('--human-approved')) throw new Error('Checkpoint Medium Risk exige aprovação humana explícita com --human-approved.');
    if (state.risk !== 'medium') throw new Error('Checkpoint só é válido para fast-track Medium Risk.');
    assertUnblocked(context);
    const current = currentStatus(context.issue, board);
    if (!['Specifying', 'In Progress'].includes(current)) throw new Error(`Checkpoint Medium Risk exige Status Specifying ou In Progress para retomada; atual: ${current}.`);
    if (current === 'Specifying') setStatus(context.issue, 'In Progress', board);

    const approvedState = 'Estado: fast-track Medium Risk com checkpoint humano aprovado.';
    const spec = readFileSync(state.specPath, 'utf8');
    if (!spec.includes(approvedState)) writeFileSync(state.specPath, spec.replace(/^Estado:.*$/mi, approvedState));
    const plan = path.join(state.directory, 'plan.md');
    const planContent = readFileSync(plan, 'utf8');
    if (planContent.includes('Implementação pendente do checkpoint Medium Risk.')) {
      writeFileSync(plan, planContent.replace('Implementação pendente do checkpoint Medium Risk.', 'Checkpoint Medium Risk aprovado; implementação autorizada.'));
    }

    const approvalRecorded = context.comments.some(comment => comment.body?.includes(mediumCheckpointMarker));
    if (!approvalRecorded) {
      api(`repos/${config.repository}/issues/${context.issue.number}/comments`, { method: 'POST', body: { body: `${mediumCheckpointMarker}\nCheckpoint Medium Risk aprovado explicitamente por um gdev. Implementação autorizada; Project em In Progress.` } });
    }
    console.log(`Issue #${number}: checkpoint Medium Risk aprovado e registrado; In Progress`);
    return;
  }

  if (action === 'escalate') {
    if (rest.length) throw new Error('Escalada aceita apenas o novo nível de risco.');
    const target = fastTrackRisk(value);
    if (target === 'low' || riskRank[target] <= riskRank[state.risk]) throw new Error(`Risco só pode escalar acima de ${label(state.risk)} durante o fast-track.`);
    setStatus(context.issue, 'Specifying', board);
    replaceRisk(state.specPath, target);
    replaceRisk(path.join(state.directory, 'plan.md'), target);
    const updated = readFileSync(state.specPath, 'utf8').replace(/^Estado:.*$/mi, target === 'medium'
      ? 'Estado: fast-track Medium Risk aguardando checkpoint humano.'
      : 'Estado: High Risk; fast-track interrompido e SDD normal obrigatório.');
    writeFileSync(state.specPath, updated);
    const next = target === 'medium'
      ? `Checkpoint humano obrigatório antes de retomar: node scripts/sdd/fast-track.mjs ${number} checkpoint --human-approved.`
      : 'Fast-track encerrado. Expanda os artefatos existentes e retome o SDD normal com os gates de spec/plan na mesma branch/spec.';
    api(`repos/${config.repository}/issues/${context.issue.number}/comments`, { method: 'POST', body: { body: `Risco escalado de ${label(state.risk)} para ${label(target)}. Implementação pausada e Project movido para Specifying. ${next}` } });
    console.log(`Issue #${number}: Risk ${label(state.risk)} -> ${label(target)}; Specifying`);
    return;
  }

  throw new Error('Ação inválida. Use checkpoint ou escalate.');
});
