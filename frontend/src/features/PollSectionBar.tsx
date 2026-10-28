import { PollsBrand } from '../components/PollsBrand'
import { SectionSubmenuBar } from '../components/SectionSubmenuBar'
import { followInternalLink } from './pollRoutes'

export function PollsSectionBar({ visible, path, onNavigate }: { visible: boolean; path: string; onNavigate: (path: string) => void }) {
  return <SectionSubmenuBar visible={visible} className="polls-section-bar"><PollsBrand href={path} onClick={(event) => followInternalLink(event, path, onNavigate)} /></SectionSubmenuBar>
}
