/**
 * StatusIconPicker — three-way icon chooser for status conditions.
 *
 * Lets the user pick an icon from three sources:
 *   1. Emoji       — free-text emoji + a quick-pick palette
 *   2. Icon pack   — a grid of curated Lucide icons (see statusIcons.tsx)
 *   3. Upload      — an SVG or PNG file (SVG kept as-is; PNG compressed)
 *
 * Reports each selection back via `onChange({ icon, iconType })`.
 */

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import { processImage } from '@/lib/imageProcessing'
import { STATUS_ICON_CHOICES } from '@/constants/statusIcons'
import StatusIcon from '@/components/status/StatusIcon'
import type { StatusIconType } from '@/types'

/** A small curated emoji palette for quick selection. */
const EMOJI_QUICK_PICKS = [
  '💀', '☠️', '🔥', '❄️', '⚡', '💧', '🌪️', '🌙', '☀️', '✨',
  '💫', '😵', '🧎', '🙈', '👻', '🌫️', '🔮', '♻️', '⛓️', '🩸',
  '💚', '🧠', '🗡️', '🛡️', '💥', '🐍', '🕸️', '🩹', '⏳', '🔒',
]

export interface StatusIconPickerProps {
  /** Current icon payload. */
  icon: string
  /** Current icon type. */
  iconType: StatusIconType
  /** Called with the newly-chosen icon payload. */
  onChange: (next: { icon: string; iconType: StatusIconType }) => void
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
    { key: 'pack', label: 'Icon' },
    { key: 'image', label: 'Upload' },
  ]

  return (
    <div className="status-icon-picker">
      {/* Live preview of the current selection. */}
      <div className="status-icon-picker__preview">
        <StatusIcon icon={icon} iconType={iconType} size={28} />
        <span className="status-icon-picker__preview-label">
          {iconType === 'image' && icon
            ? 'Uploaded image'
            : iconType === 'pack' && icon
              ? 'Icon-pack icon'
              : icon
                ? 'Emoji'
                : 'No icon selected'}
        </span>
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
        <div className="status-icon-picker__panel">
          <input
            type="text"
            className="sheet-input"
            value={iconType === 'emoji' ? icon : ''}
            onChange={(e) => onChange({ icon: e.target.value, iconType: 'emoji' })}
            placeholder="Paste an emoji…"
            maxLength={8}
          />
          <div className="status-icon-picker__emoji-grid">
            {EMOJI_QUICK_PICKS.map((e) => (
              <button
                key={e}
                type="button"
                className="status-icon-picker__emoji"
                onClick={() => onChange({ icon: e, iconType: 'emoji' })}
                aria-label={`Use ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'pack' && (
        <div className="status-icon-picker__panel status-icon-picker__panel--pack">
          <div className="status-icon-picker__pack-grid">
            {STATUS_ICON_CHOICES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={
                  'status-icon-picker__pack-btn' +
                  (iconType === 'pack' && icon === key
                    ? ' status-icon-picker__pack-btn--active'
                    : '')
                }
                onClick={() => onChange({ icon: key, iconType: 'pack' })}
                title={label}
                aria-label={label}
              >
                <Icon size={18} aria-hidden />
              </button>
            ))}
          </div>
        </div>
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
