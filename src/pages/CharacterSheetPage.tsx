import { useCharacterStore } from '@/store/characterStore'

/**
 * Placeholder character sheet view.
 *
 * The full sheet (attributes, skills, abilities, combat trackers, etc.) will
 * be built in Phase 4. For now we just confirm the selected character is
 * reachable and offer a way back to the list.
 */
export default function CharacterSheetPage() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)

  if (!currentCharacter) return null

  const { name, portrait, milestones } = currentCharacter

  return (
    <div className="sheet-placeholder">
      {portrait ? (
        <img className="sheet-portrait" src={portrait} alt={name} />
      ) : (
        <div className="sheet-portrait sheet-portrait--empty" aria-hidden />
      )}

      <h2 className="sheet-name">{name}</h2>
      <p className="sheet-meta">Milestones: {milestones}</p>
      <p className="sheet-note">Phase 4 will build this out.</p>

      <button className="btn btn--ghost" type="button" onClick={closeCharacter}>
        Back to characters
      </button>
    </div>
  )
}