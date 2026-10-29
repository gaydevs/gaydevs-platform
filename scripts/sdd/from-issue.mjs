import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config, root, readIssue, identity, assertUnblocked, git, project, setStatus, api, fastTrackRisk, main } from './core.mjs';

main(() => {
  const args = process.argv.slice(2);
  const number = args.shift();
  const flags = new Set();
  let riskValue;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--risk') {
      if (riskValue !== undefined || index + 1 >= args.length) throw new Error('--risk exige exatamente um valor: low, medium ou high.');
      riskValue = args[++index];
      continue;
    }
    if (!['--start', '--trivial', '--fast-track', '--human-approved', '--without-project'].includes(value)) throw new Error(`Opção desconhecida: ${value}`);
    flags.add(value);
  }

  const legacyTrivial = flags.has('--trivial');
  const fastTrack = flags.has('--fast-track') || legacyTrivial;
  const humanApproved = flags.has('--human-approved');
  if (legacyTrivial && riskValue !== undefined) throw new Error('--trivial já representa Low Risk e não aceita --risk.');
  if (humanApproved && !fastTrack) throw new Error('--human-approved em from-issue só é válido com --fast-track/--trivial.');
  if (riskValue !== undefined && !fastTrack) throw new Error('--risk em from-issue só é válido com --fast-track.');
  if (fastTrack && !legacyTrivial && riskValue === undefined) throw new Error('Fast-track exige classificação explícita: use --risk low ou --risk medium. High Risk deve seguir o SDD normal.');
  const risk = fastTrack ? fastTrackRisk(legacyTrivial ? 'low' : riskValue) : null;
  if (fastTrack && risk === 'high') throw new Error('High Risk não usa fast-track. Inicie a Issue pelo SDD normal sem --fast-track.');

  const context = readIssue(number);
  const work = identity(context.issue, fastTrack);
  if (!flags.has('--start')) return console.log(JSON.stringify({ ...work, fastTrack, risk, context }, null, 2));
  if (fastTrack && !humanApproved) throw new Error('Fast-track exige aprovação humana explícita: use --human-approved somente após recebê-la.');
  assertUnblocked(context);
  const withoutProject = flags.has('--without-project');
  const board = withoutProject ? null : project();
  if (withoutProject) console.error('ATENÇÃO: sincronização com Project explicitamente pendente.');
  if (git('status', '--porcelain')) throw new Error('Faça commit ou guarde alterações antes de iniciar.');
  const actualRepo = api('repos/' + config.repository);
  const remote = git('remote', 'get-url', 'origin');
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match || api('repos/' + match[1]).id !== actualRepo.id) throw new Error('origin não corresponde ao repositório configurado.');
  git('fetch', 'origin', config.baseBranch);
  try {
    git('cat-file', '-e', `origin/${config.baseBranch}:.github/sdd.json`);
    git('cat-file', '-e', `origin/${config.baseBranch}:.specify/templates/overrides/spec-template.md`);
  } catch {
    throw new Error(`A base origin/${config.baseBranch} ainda não contém a infraestrutura SDD. Integre o checkpoint antes de iniciar novas Issues.`);
  }
  const specs = path.join(root, 'specs');
  const existing = readdirSync(specs).filter(name => name.startsWith(`${work.id}-`));
  if (existing.length) throw new Error(`Spec já existe: ${existing.join(', ')}. Retome-a sem gerar novo ID.`);
  const local = git('branch', '--list', `*/${work.id}-*`);
  const remoteBranches = git('ls-remote', '--heads', 'origin', `*/${work.id}-*`);
  if (local || remoteBranches) throw new Error('Já existe branch para esta Issue. Retome o trabalho existente.');
  git('switch', '--no-track', '-c', work.branch, `origin/${config.baseBranch}`);
  if (work.needsSpec || fastTrack) {
    const directory = path.join(root, work.directory);
    mkdirSync(directory, { recursive: true });
    if (fastTrack) {
      const issue = context.issue;
      const riskLabel = risk[0].toUpperCase() + risk.slice(1);
      const medium = risk === 'medium';
      const approval = 'Fast-track aprovado por um gdev antes da implementação.';
      writeFileSync(path.join(directory, 'spec.md'), `# ${work.id} — ${issue.title}\n\nIssue: ${issue.html_url}\nEstado: ${medium ? 'fast-track Medium Risk aguardando checkpoint humano.' : 'fast-track Low Risk aprovado para implementação.'}\nFast-track risk: ${riskLabel}\n\n## Objetivo\n\n${issue.title}.\n\n## Escopo\n\nSeguir estritamente a Issue, sem ampliar o escopo.\n\n## Critérios de aceite\n\n- O resultado pedido na Issue é atendido.\n- O risco permanece no nível registrado ou é escalado antes de continuar.\n\n## Aprovação\n\n${approval}${medium ? ' Um checkpoint humano adicional é obrigatório antes da implementação.' : ''}\n`);
      writeFileSync(path.join(directory, 'plan.md'), `# Plano técnico\n\nIssue: ${issue.html_url} · Spec: [spec.md](spec.md)\nFast-track risk: ${riskLabel}\n\n## Abordagem\n\nAplicar a menor alteração necessária para atender a Issue, preservando os contratos existentes.\n\n## Validação\n\nExecutar os testes diretamente relacionados e verificações de integridade do diff.\n\n## Aprovação\n\n${approval} ${medium ? 'Implementação pendente do checkpoint Medium Risk.' : 'Esta aprovação cobre spec, plan e início da implementação enquanto o risco permanecer Low.'}\n`);
      writeFileSync(path.join(directory, 'tasks.md'), `# Tasks\n\nIssue: ${issue.html_url} · Plano: [plan.md](plan.md)\n\n- [ ] T001 Implementar: ${issue.title}.\n- [ ] T002 Validar a mudança com os testes/verificações relevantes.\n\nTasks permanecem neste arquivo; não gerar Issues automaticamente.\n`);
    } else {
      const template = readFileSync(path.join(root, '.specify/templates/overrides/spec-template.md'), 'utf8');
      const values = { TITLE: context.issue.title, ISSUE: context.issue.html_url, ID: work.id };
      writeFileSync(path.join(directory, 'spec.md'), template.replace(/\{\{(TITLE|ISSUE|ID)\}\}/g, (_, key) => values[key]));
    }
  }
  const targetStatus = fastTrack ? (risk === 'medium' ? 'Specifying' : 'In Progress') : 'Specifying';
  if (board) setStatus(context.issue, targetStatus, board);
  let detail;
  if (!fastTrack) {
    detail = `Spec: \`${work.directory}/spec.md\` (rascunho; aprovação humana pendente).`;
  } else if (risk === 'medium') {
    detail = `Fast-track Medium Risk iniciado com aprovação humana inicial; \`spec.md\`, \`plan.md\` e \`tasks.md\` sucintos foram gerados em \`${work.directory}/\`. A implementação está bloqueada até um checkpoint humano explícito. Após aprovação, execute \`node scripts/sdd/fast-track.mjs ${context.issue.number} checkpoint --human-approved\`.`;
  } else {
    detail = `Fast-track Low Risk iniciado com aprovação humana explícita; \`spec.md\`, \`plan.md\` e \`tasks.md\` sucintos foram gerados em \`${work.directory}/\`. A implementação está autorizada enquanto o risco permanecer Low.`;
  }
  const projectDetail = withoutProject ? 'Project: sincronização pendente por limitação de acesso/configuração.' : (fastTrack ? `Project sincronizado em ${targetStatus}.` : 'Project sincronizado.');
  const publicationDetail = fastTrack ? 'A branch/artefatos ainda precisam ser publicados.' : 'A branch/spec ainda precisa ser publicada.';
  api(`repos/${config.repository}/issues/${context.issue.number}/comments`, { method: 'POST', body: { body: `Trabalho iniciado localmente em \`${work.branch}\`.\n\n${detail}\n\n${projectDetail}\n${publicationDetail} No primeiro push, use \`git push -u origin HEAD\` para criar e rastrear a branch remota de mesmo nome.` } });
  console.error('Branch criada sem upstream. No primeiro push, use: git push -u origin HEAD');
  console.log(JSON.stringify({ ...work, risk }, null, 2));
});
