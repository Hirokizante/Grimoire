/**
 * PlaceholderPage — a temporary "coming soon" screen for sections that
 * haven't been built yet (NPCs, Settings).
 */

import { ArrowLeft } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'

export default function PlaceholderPage({ title }: { title: string }) {
  const setView = useCharacterStore((s) => s.setView)

  return (
    <div className="page page--empty">
      <div className="empty-state">
        <h2 className="empty-title">{title}</h2>
        <p className="muted">This section is coming soon.</p>
        <button
          className="btn btn--ghost page-head__btn"
          type="button"
          onClick={() => setView('home')}
        >
          <ArrowLeft size={14} />
          Back to Home
        </button>
      </div>
    </div>
  )
}
