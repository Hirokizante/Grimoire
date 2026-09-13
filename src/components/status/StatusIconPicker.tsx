/**
 * StatusIconPicker — three-way icon chooser for status conditions.
 *
 * Lets the user pick an icon from three sources:
 *   1. Emoji       — all 1,900+ Unicode emoji, searchable by name (plus a
 *                    quick-pick row and a search-term table for game words the
 *                    Unicode names don't use, e.g. "poisoned")
 *   2. Icon pack   — the bundled RPG-Awesome fantasy pack (496 icons), searchable
 *   3. Upload      — an SVG or PNG file (SVG kept as-is; PNG compressed)
 *
 * Reports each selection back via `onChange({ icon, iconType })`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Upload, X } from 'lucide-react'

import { processImage } from '@/lib/imageProcessing'
import {
  EMOJI_QUICK_PICKS,
  EMOJI_SEARCH_LIMIT,
  loadEmojiCatalog,
  pastedEmojiCandidate,
  searchEmojis,
} from '@/lib/emojiCatalog'
import {
  RPG_AWESOME_ICON_KEYS,
  isRpgAwesomeIconKey,
  rpgAwesomeIconLabel,
} from '@/constants/statusIcons'
import type { EmojiEntry, EmojiGroup } from '@/lib/emojiCatalog'
import StatusIcon from '@/components/status/StatusIcon'
import type { StatusIconType } from '@/types'

export interface StatusIconPickerProps {
  /** Current icon payload. */
  icon: string
  /** Current icon type. */
  iconType: StatusIconType
  /** Called with the newly-chosen icon payload. */
  onChange: (next: { icon: string; iconType: StatusIconType }) => void
}

/** Shared shape for the two searchable panels. */
interface PanelProps {
  icon: string
  iconType: StatusIconType
  onChange: StatusIconPickerProps['onChange']
}

/**
 * The search field both panels share: the app's standard text input
 * (`.sheet-input`, full panel width) with a magnifier sitting inside it, so it
 * lines up with every other field in the modal instead of reading as a
 * smaller control.
 */
function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="status-icon-picker__search">
      <div className="status-icon-picker__search-field">
        <Search
          size={14}
          aria-hidden
          className="status-icon-picker__search-icon"
        />
        <input
          type="text"
          className="sheet-input status-icon-picker__search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          spellCheck={false}
          autoComplete="off"
        />
        {value !== '' && (
          <button
            type="button"
            className="status-icon-picker__search-clear"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/** One icon cell in either grid. */
function IconCell({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={
        'status-icon-picker__cell' +
        (selected ? ' status-icon-picker__cell--active' : '')
      }
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
    >
      {children}
    </button>
  )
}

/** The emoji tab: search the Unicode catalog, or take the quick picks. */
function EmojiPanel({ icon, iconType, onChange }: PanelProps) {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null)
  const [failed, setFailed] = useState(false)
  const selected = iconType === 'emoji' ? icon : ''

  useEffect(() => {
    let alive = true
    loadEmojiCatalog()
      .then((loaded) => {
        if (alive) setGroups(loaded)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const trimmed = query.trim()
  const results = useMemo(
    () => (groups ? searchEmojis(groups, query) : []),
    [groups, query],
  )
  /** Quick picks with their real names, once the catalog is in. */
  const quickPicks = useMemo(() => {
    const byEmoji = new Map<string, EmojiEntry>()
    for (const group of groups ?? []) {
      for (const entry of group.emojis) byEmoji.set(entry.emoji, entry)
    }
    return EMOJI_QUICK_PICKS.map((emoji) => ({
      emoji,
      name: byEmoji.get(emoji)?.name ?? emoji,
    }))
  }, [groups])
  const pasted = pastedEmojiCandidate(query)
  const matchCount = results.length
  const capped = matchCount >= EMOJI_SEARCH_LIMIT

  const renderCell = (emoji: string, label: string) => (
    <IconCell
      key={emoji}
      selected={selected === emoji}
      label={label}
      onClick={() => onChange({ icon: emoji, iconType: 'emoji' })}
    >
      <span className="status-icon-picker__glyph">{emoji}</span>
    </IconCell>
  )

  return (
    <div className="status-icon-picker__panel status-icon-picker__panel--scroll">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search emoji…"
        label="Search emoji"
      />

      {trimmed === '' ? (
        <>
          <p className="status-icon-picker__section">Common</p>
          <div className="status-icon-picker__grid">
            {quickPicks.map(({ emoji, name }) => renderCell(emoji, name))}
          </div>
          {groups ? (
            <>
              <p className="status-icon-picker__section">All emoji</p>
              {groups.map((group) => (
                <div key={group.name}>
                  <p className="status-icon-picker__subgroup">{group.name}</p>
                  <div className="status-icon-picker__grid">
                    {group.emojis.map((entry) =>
                      renderCell(entry.emoji, entry.name),
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="muted status-icon-picker__note">
              {failed ? 'Could not load the emoji list.' : 'Loading emoji…'}
            </p>
          )}
        </>
      ) : (
        <>
          {pasted && (
            <button
              type="button"
              className="status-icon-picker__pasted"
              onClick={() => onChange({ icon: pasted, iconType: 'emoji' })}
            >
              Use “{pasted}” as the icon
            </button>
          )}

          {matchCount > 0 ? (
            <>
              <p className="status-icon-picker__section">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                {capped ? ` (first ${EMOJI_SEARCH_LIMIT})` : ''}
              </p>
              <div className="status-icon-picker__grid">
                {results.map((entry: EmojiEntry) =>
                  renderCell(entry.emoji, entry.name),
                )}
              </div>
            </>
          ) : (
            !pasted && (
              <p className="muted status-icon-picker__note">
                {groups
                  ? `No emoji match “${trimmed}”.`
                  : failed
                    ? 'Could not load the emoji list.'
                    : 'Loading emoji…'}
              </p>
            )
          )}
        </>
      )}
    </div>
  )
}

/** The icon-pack tab: search the bundled RPG-Awesome fantasy icons. */
function IconPackPanel({ icon, iconType, onChange }: PanelProps) {
  const [query, setQuery] = useState('')
  const selected = iconType === 'pack' ? icon : ''

  const matches = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return RPG_AWESOME_ICON_KEYS
    return RPG_AWESOME_ICON_KEYS.filter((key) => {
      const words = rpgAwesomeIconLabel(key).toLowerCase()
      return tokens.every((token) => words.includes(token))
    })
  }, [query])

  return (
    <div className="status-icon-picker__panel status-icon-picker__panel--scroll">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search icons…"
        label="Search icon pack"
      />

      {matches.length > 0 ? (
        <div className="status-icon-picker__grid status-icon-picker__grid--pack">
          {matches.map((key) => (
            <IconCell
              key={key}
              selected={selected === key}
              label={rpgAwesomeIconLabel(key)}
              onClick={() => onChange({ icon: key, iconType: 'pack' })}
            >
              <i className={`ra ${key} status-icon-picker__pack-glyph`} aria-hidden />
            </IconCell>
          ))}
        </div>
      ) : (
        <p className="muted status-icon-picker__note">
          No icons match “{query.trim()}”.
        </p>
      )}
    </div>
  )
}

export default function StatusIconPicker({
  icon,
  iconType,
  onChange,
}: StatusIconPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<StatusIconType>(iconType)
  const [processing, setProcessing] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    // SVG is already compact text — store it as a data URL directly.
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChange({ icon: reader.result, iconType: 'image' })
        }
      }
      reader.readAsDataURL(file)
      return
    }

    if (!file.type.startsWith('image/')) return

    setProcessing(true)
    void processImage(file, {
      maxDim: 128,
      quality: 0.9,
      mimeType: 'image/png',
    })
      .then((dataUrl) => onChange({ icon: dataUrl, iconType: 'image' }))
      .catch(() => {
        /* ignore undecodable files */
      })
      .finally(() => setProcessing(false))
  }

  const tabs: { key: StatusIconType; label: string }[] = [
    { key: 'emoji', label: 'Emoji' },
    { key: 'pack', label: 'Icon Pack' },
    { key: 'image', label: 'Upload' },
  ]

  /** What the current selection is, spelled out under the preview. */
  const previewLabel = () => {
    if (iconType === 'image') return icon ? 'Uploaded image' : 'No icon selected'
    if (iconType === 'pack') {
      if (!icon) return 'No icon selected'
      return isRpgAwesomeIconKey(icon)
        ? `Icon pack · ${rpgAwesomeIconLabel(icon)}`
        : 'Icon pack'
    }
    return icon ? 'Emoji' : 'No icon selected'
  }

  return (
    <div className="status-icon-picker">
      {/* Live preview of the current selection. */}
      <div className="status-icon-picker__preview">
        <StatusIcon icon={icon} iconType={iconType} size={28} />
        <span className="status-icon-picker__preview-label">{previewLabel()}</span>
      </div>

      <div className="status-icon-picker__tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={
              'status-icon-picker__tab' +
              (tab === t.key ? ' status-icon-picker__tab--active' : '')
            }
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'emoji' && (
        <EmojiPanel icon={icon} iconType={iconType} onChange={onChange} />
      )}

      {tab === 'pack' && (
        <IconPackPanel icon={icon} iconType={iconType} onChange={onChange} />
      )}

      {tab === 'image' && (
        <div className="status-icon-picker__panel">
          <div className="status-icon-picker__upload">
            <button
              type="button"
              className="btn btn--ghost status-icon-picker__file-btn"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
            >
              <Upload size={14} />
              {processing ? 'Processing…' : 'Choose SVG or PNG'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/svg+xml,image/png"
              className="visually-hidden"
              onChange={handleFile}
            />
            {iconType === 'image' && icon && (
              <button
                type="button"
                className="btn btn--ghost status-icon-picker__clear"
                onClick={() => onChange({ icon: '', iconType: 'emoji' })}
              >
                Remove image
              </button>
            )}
          </div>
          {iconType === 'image' && icon && (
            <div className="status-icon-picker__upload-preview">
              <StatusIcon icon={icon} iconType="image" size={48} />
              <span className="muted">Current uploaded icon</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
