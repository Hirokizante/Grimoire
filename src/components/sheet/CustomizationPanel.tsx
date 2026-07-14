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
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCharacterStore } from '@/store/characterStore'
import type { SheetColors, SheetConfig } from '@/types'

/** A label+key used for each color picker. */
interface ColorField {
  key: keyof SheetColors
  label: string
}

/** A color picker bound directly to a top-level SheetConfig field. */
interface ConfigColorField {
  key: 'backgroundColor' | 'pageBackgroundColor'
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
    blurb: 'Sheet card background — the surface behind the character sheet content.',
    configFields: [{ key: 'backgroundColor', label: 'Card' }],
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
interface PresetTheme {
  name: string
  pageBackgroundColor?: string
  backgroundColor?: string
  colors: Partial<SheetColors>
}

const PRESETS: PresetTheme[] = [
  {
    name: 'Midnight',
    pageBackgroundColor: '#08060f',
    backgroundColor: '#12101f',
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
      minorAbility: '#9b8ad6',
      hpBar: '#e8736b',
      fpBar: '#b09af0',
      apBar: '#5eb3d6',
      endBar: '#8ce09a',
      tokenMilestone: '#d4a854',
      tokenEvasion: '#5eb3d6',
      tokenMovement: '#b09af0',
      tokenSaveDC: '#e8736b',
      tokenArmor: '#d4a854',
      tokenEndRecovery: '#8ce09a',
    },
  },
  {
    name: 'Solar',
    pageBackgroundColor: '#1e140c',
    backgroundColor: '#2e1f16',
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
      minorAbility: '#f0b870',
      hpBar: '#e05a4a',
      fpBar: '#f5c48a',
      apBar: '#e8b04e',
      endBar: '#a0d878',
      tokenMilestone: '#e8b04e',
      tokenEvasion: '#f5c48a',
      tokenMovement: '#e89253',
      tokenSaveDC: '#e05a4a',
      tokenArmor: '#c87850',
      tokenEndRecovery: '#a0d878',
    },
  },
  {
    name: 'Ocean',
    pageBackgroundColor: '#081420',
    backgroundColor: '#102530',
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
      success: '#6dd8a8',
      minorAbility: '#7bc4d6',
      hpBar: '#e57373',
      fpBar: '#a5d8f0',
      apBar: '#4fb0e8',
      endBar: '#6dd8a8',
      tokenMilestone: '#5ed4b8',
      tokenEvasion: '#7bc4d6',
      tokenMovement: '#a5d8f0',
      tokenSaveDC: '#4fb0e8',
      tokenArmor: '#c8a878',
      tokenEndRecovery: '#6dd8a8',
    },
  },
  {
    name: 'Sakura',
    pageBackgroundColor: '#1f1018',
    backgroundColor: '#2e1925',
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
      success: '#9ed88a',
      minorAbility: '#e88bbb',
      hpBar: '#e57373',
      fpBar: '#f5c4dd',
      apBar: '#e88bbb',
      endBar: '#9ed88a',
      tokenMilestone: '#d4a5c8',
      tokenEvasion: '#f5c4dd',
      tokenMovement: '#e88bbb',
      tokenSaveDC: '#e57373',
      tokenArmor: '#c8a878',
      tokenEndRecovery: '#9ed88a',
    },
  },
  {
    name: 'Dracula',
    pageBackgroundColor: '#1e1f29',
    backgroundColor: '#282a36',
    colors: {
      bgBase: '#282a36',
      bgSurface: '#343746',
      bgSurfaceRaised: '#44475a',
      bgSurfaceHover: '#565b78',
      textPrimary: '#f8f8f2',
      textSecondary: '#bdc0d8',
      textMuted: '#6272a4',
      border: '#44475a',
      borderSoft: '#383a47',
      accent: '#bd93f9',
      accentSoft: '#ff79c6',
      danger: '#ff5555',
      success: '#50fa7b',
      minorAbility: '#ff79c6',
      hpBar: '#ff5555',
      fpBar: '#bd93f9',
      apBar: '#8be9fd',
      endBar: '#50fa7b',
      tokenMilestone: '#bd93f9',
      tokenEvasion: '#8be9fd',
      tokenMovement: '#f1fa8c',
      tokenSaveDC: '#ff79c6',
      tokenArmor: '#ffb86c',
      tokenEndRecovery: '#50fa7b',
    },
  },
  {
    name: 'Nord',
    pageBackgroundColor: '#222631',
    backgroundColor: '#2e3440',
    colors: {
      bgBase: '#2e3440',
      bgSurface: '#3b4252',
      bgSurfaceRaised: '#434c5e',
      bgSurfaceHover: '#4c566a',
      textPrimary: '#eceff4',
      textSecondary: '#d8dee9',
      textMuted: '#7b8599',
      border: '#4c566a',
      borderSoft: '#434c5e',
      accent: '#88c0d0',
      accentSoft: '#8fbcbb',
      danger: '#bf616a',
      success: '#a3be8c',
      minorAbility: '#b48ead',
      hpBar: '#bf616a',
      fpBar: '#b48ead',
      apBar: '#5e81ac',
      endBar: '#a3be8c',
      tokenMilestone: '#5e81ac',
      tokenEvasion: '#8fbcbb',
      tokenMovement: '#ebcb8b',
      tokenSaveDC: '#81a1c1',
      tokenArmor: '#d08770',
      tokenEndRecovery: '#a3be8c',
    },
  },
  {
    name: 'Gruvbox',
    pageBackgroundColor: '#1d1d1d',
    backgroundColor: '#282828',
    colors: {
      bgBase: '#282828',
      bgSurface: '#32302f',
      bgSurfaceRaised: '#3c3836',
      bgSurfaceHover: '#504945',
      textPrimary: '#ebdbb2',
      textSecondary: '#d5c4a1',
      textMuted: '#928374',
      border: '#504945',
      borderSoft: '#3c3836',
      accent: '#fabd2f',
      accentSoft: '#fe8019',
      danger: '#fb4934',
      success: '#b8bb26',
      minorAbility: '#d3869b',
      hpBar: '#fb4934',
      fpBar: '#d3869b',
      apBar: '#83a598',
      endBar: '#b8bb26',
      tokenMilestone: '#fabd2f',
      tokenEvasion: '#8ec07c',
      tokenMovement: '#fe8019',
      tokenSaveDC: '#fb4934',
      tokenArmor: '#83a598',
      tokenEndRecovery: '#b8bb26',
    },
  },
  {
    name: 'Solarized Dark',
    pageBackgroundColor: '#001a20',
    backgroundColor: '#002b36',
    colors: {
      bgBase: '#002b36',
      bgSurface: '#073642',
      bgSurfaceRaised: '#0d4350',
      bgSurfaceHover: '#13525f',
      textPrimary: '#93a1a1',
      textSecondary: '#839496',
      textMuted: '#586e75',
      border: '#0d4350',
      borderSoft: '#073642',
      accent: '#268bd2',
      accentSoft: '#2aa198',
      danger: '#dc322f',
      success: '#859900',
      minorAbility: '#6c71c4',
      hpBar: '#dc322f',
      fpBar: '#6c71c4',
      apBar: '#268bd2',
      endBar: '#859900',
      tokenMilestone: '#268bd2',
      tokenEvasion: '#2aa198',
      tokenMovement: '#b58900',
      tokenSaveDC: '#d33682',
      tokenArmor: '#cb4b16',
      tokenEndRecovery: '#859900',
    },
  },
  {
    name: 'Tokyo Night',
    pageBackgroundColor: '#0e0e16',
    backgroundColor: '#16161e',
    colors: {
      bgBase: '#16161e',
      bgSurface: '#1a1b26',
      bgSurfaceRaised: '#1f2335',
      bgSurfaceHover: '#292e42',
      textPrimary: '#c0caf5',
      textSecondary: '#a9b1d6',
      textMuted: '#737aa2',
      border: '#292e42',
      borderSoft: '#1f2335',
      accent: '#7aa2f7',
      accentSoft: '#bb9af7',
      danger: '#f7768e',
      success: '#9ece6a',
      minorAbility: '#bb9af7',
      hpBar: '#f7768e',
      fpBar: '#bb9af7',
      apBar: '#7aa2f7',
      endBar: '#9ece6a',
      tokenMilestone: '#7aa2f7',
      tokenEvasion: '#7dcfff',
      tokenMovement: '#e0af68',
      tokenSaveDC: '#9d7cd8',
      tokenArmor: '#ff9e64',
      tokenEndRecovery: '#73daca',
    },
  },
  {
    name: 'Catppuccin',
    pageBackgroundColor: '#08080f',
    backgroundColor: '#11111b',
    colors: {
      bgBase: '#11111b',
      bgSurface: '#181825',
      bgSurfaceRaised: '#1e1e2e',
      bgSurfaceHover: '#313244',
      textPrimary: '#cdd6f4',
      textSecondary: '#a6adc8',
      textMuted: '#7f849c',
      border: '#45475a',
      borderSoft: '#313244',
      accent: '#cba6f7',
      accentSoft: '#f5c2e7',
      danger: '#f38ba8',
      success: '#a6e3a1',
      minorAbility: '#cba6f7',
      hpBar: '#f38ba8',
      fpBar: '#cba6f7',
      apBar: '#89b4fa',
      endBar: '#a6e3a1',
      tokenMilestone: '#cba6f7',
      tokenEvasion: '#94e2d5',
      tokenMovement: '#f9e2af',
      tokenSaveDC: '#fab387',
      tokenArmor: '#74c7ec',
      tokenEndRecovery: '#a6e3a1',
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
      title="Background"
      blurb="Choose a background color or image for the page behind the character sheet. If a background image is set, it takes priority and covers the color."
    >
      <ColorSwatch
        label="Page Color"
        value={config.pageBackgroundColor}
        onChange={(v) =>
          updateConfig((c) => ({ ...c, pageBackgroundColor: v }))
        }
      />
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

  useEscapeKey(onClose, open)

  if (!config || !open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content customize-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header customize-panel__header">
          <h3>Customize Sheet</h3>
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
                  updateConfig((c) => ({
                    ...c,
                    ...(p.pageBackgroundColor
                      ? { pageBackgroundColor: p.pageBackgroundColor }
                      : {}),
                    ...(p.backgroundColor
                      ? { backgroundColor: p.backgroundColor }
                      : {}),
                    colors: { ...c.colors, ...p.colors },
                  }))
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
