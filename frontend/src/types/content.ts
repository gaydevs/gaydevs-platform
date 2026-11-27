export interface TextPart { text: string; strong?: boolean }
export type Paragraph = TextPart[]
export interface SectionCopy { title: string; intro?: string }
export interface Link { label: string; href: string }
export interface ImageSource { src: string; width: number }
export interface ImageAsset {
  src: string
  width: number
  height: number
  sources: ImageSource[]
}
export interface Photo { id: string; image: ImageAsset; alt: string; caption: string }
export interface HeroContent {
  eyebrow: string; title: string; subtitle: string; description: string; tagline: string; cta: Link
}
export interface EventItem { title: string; description?: string; photoId?: string }
export interface EventFormat {
  id: 'jogaydev' | 'meetups' | 'roles' | 'comitivas' | 'talks' | 'summit'
  title: string
  paragraphs: string[]
  label?: string
  flow?: string[]
  items: EventItem[]
}
export type CommitType = 'init' | 'feat' | 'play' | 'meet' | 'role' | 'comitiva' | 'lore' | 'refactor' | 'build' | 'launch'
export interface TimelineItem { date: string; type: CommitType; title: string; description?: string }
export interface CommunitySpace { path: string; commands: string[]; label: string; description: string }
export interface LoreProfile { name: string; filename: string; attributes: Record<string, string>; paragraphs: Paragraph[] }
