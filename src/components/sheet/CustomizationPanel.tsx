/**
 * CustomizationPanel — a modal dialog for sheet aesthetics.
 *
 * Exposes every configurable color in `SheetColors` as a simple grid of
 * swatches + optional hex input, organized into named groups. No custom CSS
 * required for theme changes. Custom CSS textarea remains available for
 * advanced users at the bottom.
 *
 * All changes are applied live via CSS variables (CharacterSheet already wires
 * them in) and persisted per-character through the store's updateConfig action.
 */

import { useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { processImage } from '@/lib/imageProcessing'
import { useCharacterStore } from '@/store/characterStore'
import type { SheetColors, SheetConfig } from '@/types'

/** A label+key used for each color picker. */
interface ColorField {
  key: keyof SheetColors
  label: string
}

/** A color picker bound directly to a top-level SheetConfig field. */
interface ConfigColorField {
  key: 'backgroundColor'
  label: string
}

/** Grouped list of every configurable color. */
const COLOR_GROUPS: {
  title: string
  blurb?: string
  fields?: ColorField[]
  configFields?: ConfigColorField[]
}[] = [
  {
    title: 'Sheet',
    blurb: 'Page background — the canvas behind the character sheet.',
    configFields: [{ key: 'backgroundColor', label: 'Page' }],
  },
  {
    title: 'Surfaces',
    blurb: 'Card, and hover backgrounds.',
    fields: [
      { key: 'bgSurface', label: 'Card' },
      { key: 'bgSurfaceRaised', label: 'Raised' },
      { key: 'bgSurfaceHover', label: 'Hover' },
    ],
  },
  {
    title: 'Text',
    blurb: 'Body, labels, and muted copy.',
    fields: [
      { key: 'textPrimary', label: 'Primary' },
      { key: 'textSecondary', label: 'Secondary' },
      { key: 'textMuted', label: 'Muted' },
    ],
  },
  {
    title: 'Borders',
    blurb: 'Lines and separators.',
    fields: [
      { key: 'border', label: 'Hard' },
      { key: 'borderSoft', label: 'Soft' },
    ],
  },
  {
    title: 'Accents',
    blurb: 'The brand colors used across headings, buttons, and highlights.',
    fields: [
      { key: 'accent', label: 'Main' },
      { key: 'accentSoft', label: 'Soft' },
      { key: 'danger', label: 'Danger' },
      { key: 'success', label: 'Success' },
      { key: 'minorAbility', label: 'Minor' },
    ],
  },
  {
    title: 'Resource Bars',
    blurb: 'HP, FP, AP, END bar colors.',
    fields: [
      { key: 'hpBar', label: 'HP' },
      { key: 'fpBar', label: 'FP' },
      { key: 'apBar', label: 'AP' },
      { key: 'endBar', label: 'END' },
    ],
  },
  {
    title: 'Stat Tokens',
    blurb: 'Combat stat token accents.',
    fields: [
      { key: 'tokenMilestone', label: 'Milestones' },
      { key: 'tokenMovement', label: 'Movement' },
      { key: 'tokenEvasion', label: 'Evasion' },
      { key: 'tokenSaveDC', label: 'Save DC' },
      { key: 'tokenArmor', label: 'Armor' },
      { key: 'tokenEndRecovery', label: 'END Recovery' },
    ],
  },
]

/** Preset themes for one-click color replacement. */
const PRESETS: { name: string; colors: Partial<SheetColors> }[] = [
  {
    name: 'Midnight',
    colors: {
      bgBase: '#0f0d1a',
      bgSurface: '#18152b',
      bgSurfaceRaised: '#211e3a',
      bgSurfaceHover: '#2c2850',
      textPrimary: '#e0dcf2',
      textSecondary: '#a59fc8',
      textMuted: '#6f6a8e',
      border: '#2e2a52',
      borderSoft: '#211e3a',
      accent: '#7c5fd6',
      accentSoft: '#b09af0',
      danger: '#e8736b',
      success: '#8ce09a',
      minorAbility: '#7c5fd6',
      hpBar: '#e8a0bf',
      fpBar: '#b09af0',
      apBar: '#7c5fd6',
      endBar: '#7c5fd6',
      tokenMilestone: '#7c5fd6',
      tokenEvasion: '#e8a0bf',
      tokenMovement: '#e8a0bf',
      tokenSaveDC: '#7c5fd6',
      tokenArmor: '#7bc4d6',
      tokenEndRecovery: '#7bc4d6',
    },
  },
  {
    name: 'Solar',
    colors: {
      bgBase: '#2a1f1a',
      bgSurface: '#382a23',
      bgSurfaceRaised: '#4a3830',
      bgSurfaceHover: '#5c4637',
      textPrimary: '#f2ead9',
      textSecondary: '#cfc0a8',
      textMuted: '#9a8c72',
      border: '#5c4131',
      borderSoft: '#4a3830',
      accent: '#e89253',
      accentSoft: '#f5c48a',
      danger: '#e05a4a',
      success: '#a0d878',
      minorAbility: '#e89253',
      hpBar: '#e89253',
      fpBar: '#f5c48a',
      apBar: '#e89253',
      endBar: '#e89253',
      tokenMilestone: '#e89253',
      tokenEvasion: '#f5c48a',
      tokenMovement: '#e89253',
      tokenSaveDC: '#e05a4a',
      tokenArmor: '#a0d878',
      tokenEndRecovery: '#f5c48a',
    },
  },
  {
    name: 'Ocean',
    colors: {
      bgBase: '#0d1a22',
      bgSurface: '#162a35',
      bgSurfaceRaised: '#1f3d4d',
      bgSurfaceHover: '#2a5166',
      textPrimary: '#dff0f7',
      textSecondary: '#9ec2d1',
      textMuted: '#5f8a9c',
      border: '#2a5166',
      borderSoft: '#1f3d4d',
      accent: '#4fb0e8',
      accentSoft: '#a5d8f0',
      danger: '#e57373',
      success: '#8ce09a',
      minorAbility: '#7bc4d6',
      hpBar: '#7bc4d6',
      fpBar: '#a5d8f0',
      apBar: '#4fb0e8',
      endBar: '#4fb0e8',
      tokenMilestone: '#4fb0e8',
      tokenEvasion: '#7bc4d6',
      tokenMovement: '#a5d8f0',
      tokenSaveDC: '#4fb0e8',
      tokenArmor: '#8ce09a',
      tokenEndRecovery: '#7bc4d6',
    },
  },
  {
    name: 'Sakura',
    colors: {
      bgBase: '#2a1a26',
      bgSurface: '#3a2435',
      bgSurfaceRaised: '#4d2f46',
      bgSurfaceHover: '#603a58',
      textPrimary: '#f7e6f2',
      textSecondary: '#d8b5cf',
      textMuted: '#a07d96',
      border: '#5d3a52',
      borderSoft: '#4d2f46',
      accent: '#e88bbb',
      accentSoft: '#f5c4dd',
      danger: '#e57373',
      success: '#8ce09a',
      minorAbility: '#e88bbb',
      hpBar: '#e88bbb',
      fpBar: '#f5c4dd',
      apBar: '#e88bbb',
      endBar: '#e88bbb',
      tokenMilestone: '#e88bbb',
      tokenEvasion: '#f5c4dd',
      tokenMovement: '#e88bbb',
      tokenSaveDC: '#e57373',
      tokenArmor: '#a0d878',
      tokenEndRecovery: '#f5c4dd',
    },
  },
]

/** Small reusable section within the panel. */
function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb?: string
  children: React.ReactNode
}) {
  return (
    <div className="customize__section">
      <div className="customize__section-head">
        <h4 className="customize__section-title">{title}</h4>
        {blurb && <p className="customize__section-blurb">{blurb}</p>}
      </div>
      <div className="customize__grid">{children}</div>
    </div>
  )
}

/** A single color picker: swatch + label + popover hex picker. */
function ColorSwatch({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="customize__swatch-wrap">
      <button
        type="button"
        className="customize__swatch"
        style={{ backgroundColor: value }}
        onClick={() => setOpen((p) => !p)}
        title={`${label}: ${value}`}
        aria-label={`${label}: ${value}`}
      >
        <span className="customize__swatch-label">{label}</span>
      </button>
      <input
        type="text"
        className="customize__hex-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      {open && (
        <div className="customize__popover">
          <HexColorPicker
            color={value}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}

/** Generic font-picker: label + dropdown + font-quick-picks. */
function FontPicker({
  field,
  label,
}: {
  field: keyof SheetConfig
  label: string
}) {
  const currentValue = useCharacterStore(
    (s) => (s.currentCharacter?.config[field] ?? '') as string,
  )
  const updateConfig = useCharacterStore((s) => s.updateConfig)

  return (
    <label className="customize__field">
      <span className="customize__label-text">{label}</span>
      <select
        className="sheet-input"
        value={currentValue}
        onChange={(e) =>
          updateConfig((c) => ({ ...c, [field]: e.target.value }))
        }
      >
        <option value="">— Custom —</option>
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="customize__font-picks">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={
              'customize__font-pick' +
              (currentValue === f.value ? ' customize__font-pick--active' : '')
            }
            style={{ fontFamily: f.value }}
            onClick={() =>
              updateConfig((c) => ({ ...c, [field]: f.value }))
            }
          >
            Aa
          </button>
        ))}
      </div>
    </label>
  )
}

const FONT_OPTIONS = [
  { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Georgia', value: '"Georgia", "Times New Roman", serif' },
  { label: 'Garamond', value: '"Garamond", "Hoefler Text", serif' },
  { label: 'Verdana', value: '"Verdana", "Geneva", sans-serif' },
  { label: 'Courier', value: '"Courier New", "Courier", monospace' },
  { label: 'Trebuchet', value: '"Trebuchet MS", "Lucida Sans", sans-serif' },
]

/**
 * BackgroundImageSection — upload, preview, remove, and adjust the darken /
 * blur overlays for the sheet's background image.
 *
 * Images are compressed via {@link processImage} (max 1920px, JPEG 0.82)
 * before being stored as base64 data URLs in the character config. This keeps
 * export files small while providing full-resolution background imagery.
 */
function BackgroundImageSection() {
  const config = useCharacterStore((s) => s.currentCharacter?.config)
  const updateConfig = useCharacterStore((s) => s.updateConfig)
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)

  if (!config) return null

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    setProcessing(true)
    try {
      const dataUrl = await processImage(file, {
        maxDim: 1920,
        quality: 0.82,
      })
      updateConfig((c) => ({ ...c, backgroundImage: dataUrl }))
    } catch {
      // Ignore decode errors silently.
    } finally {
      setProcessing(false)
    }
  }

  const removeImage = () => {
    updateConfig((c) => ({ ...c, backgroundImage: null }))
  }

  return (
    <Section
      title="Background Image"
      blurb="An image displayed behind the character sheet, with optional darken and blur overlays for readability."
    >
      <div className="customize__bg-image">
        {config.backgroundImage ? (
          <>
            <div className="customize__bg-preview">
              <img src={config.backgroundImage} alt="Background preview" />
            </div>
            <div className="customize__bg-controls">
              <button
                type="button"
                className="btn btn--ghost customize__bg-btn"
                onClick={() => inputRef.current?.click()}
                disabled={processing}
              >
                {processing ? 'Processing…' : 'Replace'}
              </button>
              <button
                type="button"
                className="btn btn--ghost customize__bg-btn"
                onClick={removeImage}
                disabled={processing}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--ghost customize__bg-upload"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
          >
            {processing ? 'Processing…' : 'Upload Background Image'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="portrait-uploader__input"
          onChange={handleFile}
        />

        {config.backgroundImage && (
          <>
            <label className="customize__field customize__bg-slider">
              <span className="customize__label-text">
                Darken — {Math.round(config.backgroundImageDarken * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.backgroundImageDarken}
                onChange={(e) =>
                  updateConfig((c) => ({
                    ...c,
                    backgroundImageDarken: parseFloat(e.target.value),
                  }))
                }
              />
            </label>
            <label className="customize__field customize__bg-slider">
              <span className="customize__label-text">
                Blur — {config.backgroundImageBlur}px
              </span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={config.backgroundImageBlur}
                onChange={(e) =>
                  updateConfig((c) => ({
                    ...c,
                    backgroundImageBlur: parseInt(e.target.value, 10),
                  }))
                }
              />
            </label>
          </>
        )}
      </div>
    </Section>
  )
}

export interface CustomizationPanelProps {
  open: boolean
  onClose: () => void
}

export default function CustomizationPanel({
  open,
  onClose,
}: CustomizationPanelProps) {
  const config = useCharacterStore((s) => s.currentCharacter?.config)
  const updateConfig = useCharacterStore((s) => s.updateConfig)

  if (!config || !open) return null

  return (
    <div className="customize-modal-overlay" onClick={onClose}>
      <div className="customize-modal" onClick={(e) => e.stopPropagation()}>
        <div className="customize-panel__header">
          <h3 className="customize-panel__title">Customize Sheet</h3>
          <button
            type="button"
            className="btn btn--ghost modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="customize-panel__body">
          {/* Presets row */}
          <div className="customize__presets">
            <span className="customize__label-text">Presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="btn btn--ghost customize__preset-btn"
                onClick={() =>
                  updateConfig((c) => ({ ...c, colors: { ...c.colors, ...p.colors } }))
                }
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Color groups */}
          {COLOR_GROUPS.map((group) => (
            <Section key={group.title} title={group.title} blurb={group.blurb}>
              {group.configFields?.map((f) => (
                <ColorSwatch
                  key={f.key}
                  label={f.label}
                  value={config[f.key]}
                  onChange={(v) =>
                    updateConfig((c) => ({ ...c, [f.key]: v }))
                  }
                />
              ))}
              {group.fields?.map((f) => (
                <ColorSwatch
                  key={f.key}
                  label={f.label}
                  value={config.colors[f.key]}
                  onChange={(v) =>
                    updateConfig((c) => ({
                      ...c,
                      colors: { ...c.colors, [f.key]: v },
                    }))
                  }
                />
              ))}
            </Section>
          ))}

          {/* Font section */}
          <Section title="Fonts">
            <FontPicker field="sectionHeadingFontFamily" label="Headings" />
            <FontPicker field="labelFontFamily" label="Labels" />
            <FontPicker field="textFontFamily" label="Body" />
            <FontPicker field="helperTextFontFamily" label="Helpers" />
          </Section>

          {/* Heading weight + hide bg */}
          <Section title="Layout">
            <label className="customize__field">
              <span className="customize__label-text">Heading Weight</span>
              <select
                className="sheet-input"
                value={config.sectionHeadingFontWeight}
                onChange={(e) =>
                  updateConfig((c) => ({
                    ...c,
                    sectionHeadingFontWeight: e.target.value,
                  }))
                }
              >
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="700">700</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <label className="customize__field">
              <span className="customize__label-text">Background</span>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={config.hideSectionBackground}
                  onChange={(e) =>
                    updateConfig((c) => ({
                      ...c,
                      hideSectionBackground: e.target.checked,
                    }))
                  }
                />
                Hide section backgrounds
              </label>
            </label>
          </Section>

          {/* Background Image */}
          <BackgroundImageSection />

          {/* Custom CSS */}
          <Section title="Custom CSS (advanced)">
            <textarea
              className="sheet-textarea customize__css"
              value={config.customCss}
              onChange={(e) =>
                updateConfig((c) => ({ ...c, customCss: e.target.value }))
              }
              placeholder={':root {\n  --accent-violet: #9b7ed6;\n  --accent-blush: #e8a0bf;\n}'}
              rows={8}
              spellCheck={false}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
