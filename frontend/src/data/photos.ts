import { images } from './images'
import type { Photo } from '../types/content'

export const photos: Photo[] = [
  { id: 'bario', image: images.bario, alt: 'Foto do grupo ao redor de uma mesa, com máquinas de pinball ao fundo, no Bário.', caption: 'Bário — 27.06.2026' },
  { id: 'brasil', image: images.brasil, alt: 'Selfie de três participantes em meio ao público e a bandeiras do Brasil.', caption: 'jogo do Brasil — 29.06.2026' },
  { id: 'cool-doce', image: images.coolDoce, alt: 'Foto do grupo reunido ao redor das mesas no Cool Doce, sob iluminação rosa.', caption: 'Cool Doce — 12.07.2026' },
  { id: 'jogaydev', image: images.jogaydev, alt: 'Captura da partida de MECCHA CHAMELEON, com cenário de balões coloridos e interface do jogo.', caption: 'jogaydev — 21.07.2026' },
  { id: 'bento', image: images.bento, alt: 'Selfie do grupo no happy hour na Bento, com decoração colorida ao fundo.', caption: 'happy hour na Bento — 31.07.2026' },
  { id: 'black-mirror', image: images.blackMirror, alt: 'Selfie de três participantes em frente ao letreiro da Black Mirror Experience.', caption: 'Black Mirror Experience — 05.09.2026' },
  { id: 'comitiva-claro', image: images.comitivaClaro, alt: 'Selfie de quatro participantes no AI Tinkerers SP, com o letreiro da Claro ao fundo.', caption: 'comitiva gaydevs #1 — AI Tinkerers SP na Claro · 21.10.2026' },
  { id: 'comitiva-oracle', image: images.comitivaOracle, alt: 'Selfie de três participantes em frente ao letreiro da Oracle.', caption: 'comitiva gaydevs #2 — AI Camp na Oracle · 29.10.2026' },
  { id: 'comitiva-tractian', image: images.comitivaTractian, alt: 'Selfie de três participantes com o letreiro da Tractian ao fundo.', caption: 'comitiva gaydevs #3 — AI Tinkerers SP na Tractian · 26.11.2026' },
]
