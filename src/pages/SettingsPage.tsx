/**
 * SettingsPage — app-level preferences.
 *
 * Hosts the app color theme picker (themes the app chrome around the sheets —
 * header, list pages, modals, dice UI), the home page animation picker
 * (on/off + which ambient effect plays behind the title), and the full-app
 * Backup & Restore section. Per-sheet color themes live in each sheet's
 * Customization panel and are stored on the character.
 *
 * Backup & Restore: downloads EVERYTHING (characters, NPCs, statuses, version
 * history, roll log) as a single JSON file; restoring replaces all current
 * data after an explicit confirmation. See lib/backup.ts.
 */

import { useCallback, useRef, useState } from 'react'
import { ArchiveRestore, Check, DatabaseBackup } from 'lucide-react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import { useNotification } from '@/context/NotificationContext'
import {
  backupFilename,
  buildFullBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackup,
} from '@/lib/backup'
import { downloadJson } from '@/lib/exportImport'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { AppTheme } from '@/store/appThemeStore'
import { useCharacterStore } from '@/store/characterStore'
import { useHomeAnimationStore } from '@/store/homeAnimationStore'
import type { HomeAnimation } from '@/store/homeAnimationStore'
import { useRollLogStore } from '@/store/rollLogStore'
import { useStatusStore } from '@/store/statusStore'

interface ThemeOption {
  id: AppTheme
  name: string
  description: string
  /** Representative palette swatches, in paint order. */
  swatches: string[]
}

interface AnimationOption {
  id: HomeAnimation
  name: string
  description: string
  /** Tiny inline preview of the effect. */
  preview: React.ReactNode
}

const ANIMATION_OPTIONS: AnimationOption[] = [
  {
    id: 'arcane',
    name: 'Arcane Glow',
    description: 'Drifting light and floating dust particles (the default).',
    preview: (
      <>
        <span
          className="animation-preview__orb"
          style={{
            background:
              'radial-gradient(circle, var(--accent-violet), transparent 70%)',
          }}
        />
        <span
          className="animation-preview__orb animation-preview__orb--small"
          style={{
            background:
              'radial-gradient(circle, var(--accent-blush), transparent 70%)',
          }}
        />
      </>
    ),
  },
  {
    id: 'terminal',
    name: 'Terminal Boot',
    description: 'A startup log types itself out, as if launched from a shell.',
    preview: (
      <span className="animation-preview__term" aria-hidden="true">
        <span>$ grimoire launch</span>
        <span>[ ok ] ready.</span>
      </span>
    ),
  },
]

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'The default violet-dark palette.',
    swatches: ['#1a1a2e', '#9b7ed6', '#e8a0bf'],
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'For those who deal in the occult.',
    swatches: ['#262626', '#c5b8a0', '#c98f74'],
  },
  {
    id: 'mikami',
    name: 'Mikami',
    description: 'Professional detachment.',
    swatches: ['#141414', '#81a1c1', '#88c0d0'],
  },
  {
    id: 'pitch-black',
    name: 'Pitch Black',
    description: 'A glimpse into the shadow realm.',
    swatches: ['#000000', '#f3ecd4', '#eecc6c'],
  },
]

/** "3 characters, 2 NPCs" style summary of a backup's sheet counts. */
function backupSheetSummary(counts: FullBackup['counts']): string {
  const parts: string[] = []
  if (counts.characters > 0) {
    parts.push(`${counts.characters} character${counts.characters === 1 ? '' : 's'}`)
  }
  if (counts.npcs > 0) {
    parts.push(`${counts.npcs} NPC${counts.npcs === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return 'no sheets'
  return parts.join(' and ')
}

export default function SettingsPage() {
  const theme = useAppThemeStore((s) => s.theme)
  const setTheme = useAppThemeStore((s) => s.setTheme)
  const homeAnimation = useHomeAnimationStore((s) => s.animation)
  const setHomeAnimation = useHomeAnimationStore((s) => s.setAnimation)
  const homeAnimationEnabled = useHomeAnimationStore((s) => s.enabled)
  const setHomeAnimationEnabled = useHomeAnimationStore((s) => s.setEnabled)
  const { notify } = useNotification()

  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Parsed backup awaiting the user's confirmation before restoring. */
  const [pendingRestore, setPendingRestore] = useState<FullBackup | null>(null)
  /** True while a backup download is being assembled. */
  const [isBackingUp, setIsBackingUp] = useState(false)
  /** True while a confirmed restore is being written to IndexedDB. */
  const [isRestoring, setIsRestoring] = useState(false)

  /** Assemble a full backup of every store and download it as one file. */
  const handleBackup = useCallback(async () => {
    setIsBackingUp(true)
    try {
      const backup = await buildFullBackup()
      downloadJson(backup, backupFilename())
      notify(
        `✓ Backup downloaded — ${backupSheetSummary(backup.counts)}, ${backup.counts.statuses} statuses.`,
        'success',
      )
    } catch {
      notify('Failed to create backup.', 'error')
    } finally {
      setIsBackingUp(false)
    }
  }, [notify])

  /** Read the picked file, validate it, and stage it for confirmation. */
  const handleFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset so re-selecting the same file still fires change.
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        try {
          setPendingRestore(parseFullBackup(reader.result))
        } catch (err) {
          notify(
            err instanceof Error ? err.message : 'Could not read backup file.',
            'error',
            5000,
          )
        }
      }
      reader.onerror = () => notify('Could not read backup file.', 'error')
      reader.readAsText(file)
    },
    [notify],
  )

  /**
   * Restore the confirmed backup: atomically replace all four IndexedDB
   * stores, then reload every in-memory store from the fresh data.
   */
  const handleRestoreConfirmed = useCallback(async () => {
    if (!pendingRestore) return
    setIsRestoring(true)
    try {
      await restoreFullBackup(pendingRestore)
      // Reload all stores so lists, compendium, and roll log reflect the
      // restored data. Any sheet is closed defensively (settings is only
      // reachable with no sheet open, but this guards future changes).
      useCharacterStore.setState({ currentCharacter: null })
      await useCharacterStore.getState().loadCharacters()
      await useStatusStore.getState().loadStatuses()
      await useRollLogStore.getState().loadRollLog()
      notify(
        `✓ Restored ${backupSheetSummary(pendingRestore.counts)} and ${pendingRestore.counts.statuses} statuses.`,
        'success',
      )
      setPendingRestore(null)
    } catch {
      notify('Restore failed — your current data was left unchanged.', 'error')
    } finally {
      setIsRestoring(false)
    }
  }, [pendingRestore, notify])

  const busy = isBackingUp || isRestoring

  return (
    <div className="page">
      <section
        className="settings-section"
        aria-labelledby="settings-appearance-heading"
      >
        <h2 className="settings-section__title" id="settings-appearance-heading">
          Appearance
        </h2>
        <p className="muted settings-section__hint">
          Colors for the app around your sheets. Character sheet themes are
          set per sheet in the Customization panel.
        </p>

        <div className="theme-picker" role="radiogroup" aria-label="App theme">
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={
                  'theme-option' + (isActive ? ' theme-option--active' : '')
                }
                onClick={() => setTheme(option.id)}
              >
                <span className="theme-option__swatches" aria-hidden="true">
                  {option.swatches.map((color) => (
                    <span
                      key={color}
                      className="theme-option__swatch"
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className="theme-option__label">
                  <span className="theme-option__name">{option.name}</span>
                  {isActive && (
                    <span className="theme-option__check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  )}
                </span>
                <span className="theme-option__desc">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section
        className="settings-section"
        aria-labelledby="settings-home-animation-heading"
      >
        <h2
          className="settings-section__title"
          id="settings-home-animation-heading"
        >
          Home Page Animation
        </h2>
        <p className="muted settings-section__hint">
          The ambient effect behind the title on the home page. Turning it off
          leaves a plain, static page.
        </p>

        <div className="settings-toggle-row">
          <span
            className="settings-toggle-row__label"
            id="home-animation-toggle-label"
          >
            Animations
          </span>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={homeAnimationEnabled}
              onChange={(e) => setHomeAnimationEnabled(e.target.checked)}
              aria-labelledby="home-animation-toggle-label"
            />
            <span className="settings-toggle__track" aria-hidden="true" />
          </label>
        </div>

        <div
          className={
            'theme-picker' +
            (homeAnimationEnabled ? '' : ' animation-picker--disabled')
          }
          role="radiogroup"
          aria-label="Home page animation"
        >
          {ANIMATION_OPTIONS.map((option) => {
            const isActive = homeAnimation === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={!homeAnimationEnabled}
                className={
                  'theme-option' + (isActive ? ' theme-option--active' : '')
                }
                onClick={() => setHomeAnimation(option.id)}
              >
                <span className="animation-preview" aria-hidden="true">
                  {option.preview}
                </span>
                <span className="theme-option__label">
                  <span className="theme-option__name">{option.name}</span>
                  {isActive && (
                    <span className="theme-option__check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  )}
                </span>
                <span className="theme-option__desc">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section
        className="settings-section"
        aria-labelledby="settings-backup-heading"
      >
        <h2 className="settings-section__title" id="settings-backup-heading">
          Backup &amp; Restore
        </h2>
        <p className="muted settings-section__hint">
          Download everything — characters, NPCs, statuses, version history,
          and the roll log — as a single JSON file. Restoring from a backup
          replaces all current data in this browser.
        </p>

        <div className="backup-actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => void handleBackup()}
            disabled={busy}
          >
            <DatabaseBackup size={14} />
            {isBackingUp ? 'Backing up…' : 'Download Backup'}
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <ArchiveRestore size={14} />
            Restore from Backup…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleFilePicked}
          />
        </div>
      </section>

      {pendingRestore && (
        <ConfirmModal
          title="Restore backup?"
          message={
            <>
              <p>
                Restore the backup from{' '}
                <strong>
                  {new Date(pendingRestore.createdAt).toLocaleString()}
                </strong>
                ? It contains{' '}
                <strong>{backupSheetSummary(pendingRestore.counts)}</strong>,{' '}
                {pendingRestore.counts.statuses} statuse
                {pendingRestore.counts.statuses === 1 ? '' : 's'},{' '}
                {pendingRestore.counts.versions} version snapshot
                {pendingRestore.counts.versions === 1 ? '' : 's'}, and{' '}
                {pendingRestore.counts.rollLogEntries} roll
                {pendingRestore.counts.rollLogEntries === 1 ? '' : 's'}.
              </p>
              <p>
                This will <strong>replace all current data</strong> in this
                browser. This cannot be undone.
              </p>
            </>
          }
          confirmLabel={isRestoring ? 'Restoring…' : 'Restore Backup'}
          variant="danger"
          onConfirm={() => void handleRestoreConfirmed()}
          onClose={() => {
            if (!isRestoring) setPendingRestore(null)
          }}
        />
      )}
    </div>
  )
}
