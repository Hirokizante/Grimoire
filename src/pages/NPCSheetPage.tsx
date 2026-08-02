/**
 * NPCSheetPage — wraps the NPCSheet component with a mode toggle and
 * background image layers, mirroring CharacterSheetPage's structure.
 *
 * A CharacterSelector panel slides out from the left, open by default, listing
 * all NPCs with portrait + name. When open, the page content shifts right so
 * the sheet stays fully visible.
 */

import { useState } from 'react'
import { useCharacterStore } from '@/store/characterStore'
import NPCSheet from '@/components/sheet/npc/NPCSheet'
import CharacterSelector from '@/components/sheet/CharacterSelector'
import RollLogDrawer from '@/components/dice/RollLogDrawer'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export default function NPCSheetPage() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const [mode, setMode] = useState<SheetMode>('view')
  const [selectorOpen, setSelectorOpen] = useState(false)

  if (!currentCharacter) return null

  const { config } = currentCharacter
  const hasBg = !!config.backgroundImage

  return (
    <div
      className={
        'sheet-page' +
        (hasBg ? ' sheet-page--has-bg' : '') +
        (selectorOpen ? ' sheet-page--selector-open' : '')
      }
    >
      {/* Page background color — fixed full-viewport layer. */}
      <div
        className="sheet-page__bg-color"
        style={{ backgroundColor: config.pageBackgroundColor }}
      />
      {hasBg && (
        <>
          <div
            className="sheet-page__bg-image"
            style={{
              backgroundImage: `url(${config.backgroundImage})`,
              filter:
                config.backgroundImageBlur > 0
                  ? `blur(${config.backgroundImageBlur}px)`
                  : undefined,
            }}
          />
          <div
            className="sheet-page__bg-overlay"
            style={{
              opacity: config.backgroundImageDarken,
            }}
          />
        </>
      )}

      <CharacterSelector
        kind="npc"
        open={selectorOpen}
        onToggle={() => setSelectorOpen((v) => !v)}
      />

      <div className="sheet-page__content">
        <NPCSheet
          npc={currentCharacter}
          mode={mode}
          onModeChange={setMode}
        />
      </div>

      <RollLogDrawer />
    </div>
  )
}
