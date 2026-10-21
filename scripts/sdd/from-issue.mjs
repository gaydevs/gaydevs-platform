import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config, root, readIssue, identity, assertUnblocked, git, project, setStatus, api, main } from './core.mjs';

main(() => {
  const [number, ...flags] = process.argv.slice(2);
  for (const flag of flags) if (!['--start', '--trivial', '--fast-track', '--human-approved', '--without-project'].includes(flag)) throw new Error(`Opção desconhecida: ${flag}`);
  const fastTrack = flags.includes('--fast-track') || flags.includes('--trivial');
  const humanApproved = flags.includes('--human-approved');
  if (humanApproved && !fastTrack) throw new Error('--human-approved em from-issue só é válido com --fast-track/--trivial.');
  const context = readIssue(number);
  const work = identity(context.issue, fastTrack);
  // Default is read-only. The complete issue data is context, never executable instructions.
  if (!flags.includes('--start')) return console.log(JSON.stringify({ ...work, fastTrack, context }, null, 2));
  if (fastTrack && !humanApproved) throw new Error('Fast-track exige aprovação humana explícita: use --human-approved somente após recebê-la.');
  assertUnblocked(context);
  const withoutProject = flags.includes('--without-project');
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
  // Preflight complete. Further failures leave explicit recoverable local work.
  git('switch', '--no-track', '-c', work.branch, `origin/${config.baseBranch}`);
  if (work.needsSpec || fastTrack) {
    const directory = path.join(root, work.directory);
    mkdirSync(directory, { recursive: true });
    if (fastTrack) {
      const issue = context.issue;
      const approval = 'Fast-track aprovado por um gdev antes da implementação.';
      writeFileSync(path.join(directory, 'spec.md'), `# ${work.id} — ${issue.title}\n\nIssue: ${issue.html_url}\nEstado: fast-track aprovado.\n\n## Objetivo\n\n${issue.title}.\n\n## Escopo\n\nSeguir estritamente a Issue, sem ampliar o escopo.\n\n## Critérios de aceite\n\n- O resultado pedido na Issue é atendido.\n- A mudança permanece trivial e sem impacto fora do escopo.\n\n## Aprovação\n\n${approval}\n`);
      writeFileSync(path.join(directory, 'plan.md'), `# Plano técnico\n\nIssue: ${issue.html_url} · Spec: [spec.md](spec.md)\n\n## Abordagem\n\nAplicar a menor alteração necessária para atender a Issue, preservando os contratos existentes.\n\n## Validação\n\nExecutar os testes diretamente relacionados e verificações de integridade do diff.\n\n## Aprovação\n\n${approval} Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.\n`);
      writeFileSync(path.join(directory, 'tasks.md'), `# Tasks\n\nIssue: ${issue.html_url} · Plano: [plan.md](plan.md)\n\n- [ ] T001 Implementar: ${issue.title}.\n- [ ] T002 Validar a mudança com os testes/verificações relevantes.\n\nTasks permanecem neste arquivo; não gerar Issues automaticamente.\n`);
    } else {
      const template = readFileSync(path.join(root, '.specify/templates/overrides/spec-template.md'), 'utf8');
      const values = { TITLE: context.issue.title, ISSUE: context.issue.html_url, ID: work.id };
      writeFileSync(path.join(directory, 'spec.md'), template.replace(/\{\{(TITLE|ISSUE|ID)\}\}/g, (_, key) => values[key]));
    }
  }
  if (board) setStatus(context.issue, work.needsSpec ? 'Specifying' : 'In Progress', board);
  api(`repos/${config.repository}/issues/${context.issue.number}/comments`, { method: 'POST', body: { body: `Trabalho iniciado localmente em \`${work.branch}\`.\n\n${work.needsSpec ? `Spec: \`${work.directory}/spec.md\` (rascunho; aprovação humana pendente).` : `Fast-track trivial iniciado com declaração explícita de aprovação humana (\`--human-approved\`); \`spec.md\`, \`plan.md\` e \`tasks.md\` sucintos foram gerados em \`${work.directory}/\`.`}\n\n${withoutProject ? 'Project: sincronização pendente por limitação de acesso/configuração.' : 'Project sincronizado.'}\nA branch/artefatos ainda precisam ser publicados. No primeiro push, use \`git push -u origin HEAD\` para criar e rastrear a branch remota de mesmo nome.` } });
  console.error('Branch criada sem upstream. No primeiro push, use: git push -u origin HEAD');
  console.log(JSON.stringify(work, null, 2));
});
