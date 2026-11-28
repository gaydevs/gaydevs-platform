import type { HeroContent, Link, Paragraph, SectionCopy } from '../types/content'

export const hero: HeroContent = {
  eyebrow: 'elas são programadoras ✨💅',
  title: 'gaydevs',
  subtitle: 'uma comunidade para gays 🌈 e devs 💻',
  description: 'tecnologia, carreira, amizade, eventos\ne os surtos da vida dev.',
  tagline: 'aqui a IA usa harness na festa.',
  cta: { label: 'conhecer o gaydevs ↓', href: '#sobre' },
}

export const about: SectionCopy & { paragraphs: Paragraph[]; highlights: string[] } = {
  title: 'um espaço onde ser gay e ser dev fazem parte da mesma conversa.',
  paragraphs: [
    [{ text: 'o principal objetivo do gaydevs é construir ' }, { text: 'networking de verdade', strong: true }, { text: ' entre gdevs: conhecer pessoas, criar confiança, trocar conhecimento e oportunidades e se ajudar profissionalmente.' }],
    [{ text: 'o gaydevs é um espaço ' }, { text: 'progressista, inclusivo e seguro, alinhado a valores de esquerda, diversidade e respeito', strong: true }, { text: '.' }],
    [{ text: 'buscamos uma comunidade engajada e coesa, não necessariamente grande, sem exigir declaração de preferência partidária.' }],
    [{ text: 'começou com tecnologia, IA e ajuda entre devs — e foi virando também espaço de amizade, apoio, eventos e construção coletiva.' }],
  ],
  highlights: ['🤝 criar conexões de verdade', '🧠 trocar conhecimento', '🚀 compartilhar oportunidades', '💜 construir comunidade'],
}

export const applicationBenefits = [
  '🤝 conexões',
  '🧠 troca de conhecimento',
  '🚀 oportunidades',
  '🎉 encontros e amizades',
]

export const topics: SectionCopy & { items: string[] } = {
  title: 'o que rola por aqui',
  intro: 'conversa técnica, carreira, oportunidades e vida dev — sem precisar separar tanto uma coisa da outra.',
  items: ['🤖 IA', '🧩 código', '🚀 carreira', '📣 vagas', '🤝 indicações', '📊 mercado', '💼 empreendedorismo', '🆘 pedir ajuda', '🗣️ experiências', '🫠 surtos da vida dev'],
}

export const sections = {
  events: {
    title: 'quando a conversa sai do grupo',
    intro: 'o gaydevs também acontece em eventos próprios — online, presencialmente e em formatos diferentes de troca entre os gdevs.',
  },
  timeline: { title: 'git log gaydevs', command: '$ git log gaydevs --oneline' },
  gallery: {
    title: 'gaydevs na prática',
    intro: 'entre jogos, encontros e rolês, algumas coisas ficam melhores fora do código.',
  },
  community: { title: 'como o gaydevs se organiza' },
  lore: { title: 'lore do gaydevs' },
} satisfies Record<string, SectionCopy & { command?: string }>

export const publicLinks: Link[] = [
  { label: '@gay.devs no Instagram', href: 'https://instagram.com/gay.devs/' },
  { label: 'gaydevs no GitHub', href: 'https://github.com/gaydevs' },
]

export const developerLinks: Link[] = [
  { label: 'repo', href: 'https://github.com/gaydevs/gaydevs-platform' },
  { label: 'team', href: 'https://github.com/orgs/gaydevs/teams/gdevs-team' },
  { label: 'org', href: 'https://github.com/gaydevs' },
  { label: 'cleito', href: 'https://github.com/gdev-cleito-bot' },
]

export const finalCta: SectionCopy = {
  title: 'acompanhe o gaydevs',
  intro: 'eventos, projetos, memes, tecnologia e o que os gdevs estão construindo juntos.',
}
export const footer = {
  brand: 'gaydevs 🌈💻',
  location: 'desde 2026',
  authorLinks: [
    { label: 'instagram', href: 'https://instagram.com/luvittor/' },
    { label: 'github', href: 'https://github.com/luvittor' },
  ],
  role: 'scrum master dos gdevs',
}
export const accessibility = { skip: 'pular para o conteúdo', cleito: 'Cleito, mascote do gaydevs: robô com headphones e harness arco-íris, fazendo o sinal da paz.' }
