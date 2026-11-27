import type { EventFormat } from '../types/content'

export const events: EventFormat[] = [
  {
    id: 'jogaydev', title: '🎮 jogaydev',
    paragraphs: ['partidas online para jogar, conversar e integrar os gdevs.'],
    items: [
      { title: '#1 MECCHA CHAMELEON' },
      { title: '#2 Gartic Phone + Smash Karts' },
      { title: '#3 MECCHA CHAMELEON' },
      { title: '#4 Gartic Phone + Smash Karts' },
      { title: '#5 MECCHA CHAMELEON' },
    ],
  },
  {
    id: 'meetups', title: '🍻 gdevs meetups',
    paragraphs: ['encontros presenciais organizados pelo gaydevs.'],
    items: [
      { title: 'gdevs meetup #1 — Bário · 27/06', photoId: 'bario' },
      { title: 'gdevs meetup #2 — Cool Doce · 12/07', photoId: 'cool-doce' },
    ],
  },
  {
    id: 'roles', title: '🌈 rolês dos gdevs',
    paragraphs: ['encontros mais espontâneos entre gdevs.'],
    items: [
      { title: '⚽ jogo do Brasil — Vieira / Bento · 29/06' },
      { title: '🍻 happy hour na Bento — para niver de gdev · 31/07' },
      { title: '📺 Black Mirror Experience — 05/09' },
    ],
  },
  {
    id: 'comitivas', title: '🚀 gdevs comitivas',
    paragraphs: ['participação conjunta em eventos de tecnologia organizados por terceiros, para aprender, trocar experiências e fazer networking.'],
    items: [
      { title: 'gdevs comitiva #1 — AI Tinkerers SP na Claro · 21/10' },
      { title: 'gdevs comitiva #2 — AI Camp na Oracle · 29/10' },
      { title: 'gdevs comitiva #3 — AI Tinkerers SP na Tractian · 26/11' },
    ],
  },
  {
    id: 'talks', title: '💬 gdevs talks',
    paragraphs: [
      'um encontro agendado em torno de um assunto específico, com conversa mais aberta e menos estruturada que o summit.',
      'o formato inclui jogaydev no começo para quebrar o gelo e depois a conversa temática.',
    ],
    flow: ['jogaydev', 'quebra-gelo', 'conversa temática'],
    label: 'Único tema definido até agora',
    items: [{ title: 'gdevs talks', description: 'internacionalização de carreira' }],
  },
  {
    id: 'summit', title: '🎤 gdevs summit',
    paragraphs: ['apresentações mais estruturadas feitas pelos próprios gdevs para compartilhar conhecimento com a comunidade.'],
    label: 'Propostas existentes',
    items: [
      { title: '/review-pr', description: 'IA aplicada a code review com agentes' },
      { title: 'Event Sourcing', description: 'aplicação do pattern em arquitetura de microsserviços' },
    ],
  },
]

export const formatGuide = {
  title: 'Diferença entre os formatos',
  items: [
    { name: 'jogaydev', description: 'jogar e integrar' },
    { name: 'meetup', description: 'encontro presencial organizado' },
    { name: 'rolê', description: 'encontro mais espontâneo' },
    { name: 'comitiva', description: 'participação conjunta em eventos de terceiros' },
    { name: 'talks', description: 'jogaydev + conversa temática agendada' },
    { name: 'summit', description: 'apresentações estruturadas' },
  ],
}
