/**
 * ProfileSection — the character's identity panel: portrait, name, physical
 * description, and backstory (DESIGN.md "Character Portrait", "Physical
 * Description", "Backstory").
 *
 * Portraits are stored as base64 data URLs (offline-first, see DESIGN.md). If
 * no portrait is set, a placeholder block is shown so the layout stays stable.
 */

export interface ProfileSectionProps {
  name: string
  portrait: string | null
  physicalDescription: string
  backstory: string
}

export default function ProfileSection({
  name,
  portrait,
  physicalDescription,
  backstory,
}: ProfileSectionProps) {
  return (
    <section className="sheet-section sheet-section--profile">
      <div className="profile">
        <div className="profile__portrait-wrap">
          {portrait ? (
            <img
              className="profile__portrait"
              src={portrait}
              alt={name}
            />
          ) : (
            <div
              className="profile__portrait profile__portrait--empty"
              aria-hidden
            />
          )}
        </div>

        <div className="profile__body">
          <h2 className="profile__name">{name}</h2>

          {physicalDescription && (
            <div className="profile__block">
              <span className="profile__block-label">Physical Description</span>
              <p className="profile__text">{physicalDescription}</p>
            </div>
          )}

          {backstory && (
            <div className="profile__block">
              <span className="profile__block-label">Backstory</span>
              <p className="profile__text">{backstory}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}