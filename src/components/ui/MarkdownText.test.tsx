/**
 * MarkdownText inline-annotation tests.
 *
 * Sheet prose mixes Markdown with raw HTML (older descriptions are stored as
 * HTML). Both the status pills and the clickable dice notation therefore have to
 * be found in *every* text node, not just the tags Markdown wraps around prose.
 *
 * The regression these cover: a raw HTML block — a `<span>` starting a line with
 * no blank line between it and the prose that follows — is handed to the tree as
 * an element plus a bare root-level text node. The prose after it is never
 * wrapped in a `<p>`, so `[Diseased]` there stayed literal while the same text on
 * its own rendered as a pill.
 */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MarkdownText from '@/components/ui/MarkdownText'
import { useStatusStore } from '@/store/statusStore'
import type { Character, StatusCondition } from '@/types'

/**
 * The status and character stores load from IndexedDB when they are imported,
 * and jsdom has no IndexedDB — stub the layer out (the same mock the sheet's
 * other store-touching tests use).
 */
vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
  putCharacter: vi.fn(async () => {}),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  getAllVersionSnapshots: vi.fn(async () => []),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  normalizeCharacter: (char: Character) => char,
  stripLabels: ({ labels: _labels, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (status: unknown) => status,
  replaceAllData: vi.fn(async () => {}),
}))

const DISEASED: StatusCondition = {
  id: 'status-diseased',
  name: 'Diseased',
  icon: '',
  iconType: 'emoji',
  description: 'Inflicts a wasting illness.',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/**
 * The authoring style from the bug report: hand-written HTML with an image and a
 * themed `[On Hit]` tag, immediately followed by the prose on the next line.
 */
const RAW_HTML_BLOCK = `<span style="display:inline-flex; align-items:center; gap:4px; vertical-align:middle;">
  <img src="https://example.com/CoinEffect1.png"
       alt="Hit 1" style="width:25px;height:25px;">
  <span class="theme-adapt" style="color:#94f140">[On Hit]</span> 
</span>
Targets must make a VIT save or be inflicted with [Diseased]`

/** The status pill rendered for a matched `[StatusName]` reference. */
const statusPill = () => document.querySelector('.status-ref')

describe('MarkdownText inline annotations', () => {
  beforeEach(() => {
    useStatusStore.setState({ statuses: [DISEASED] })
  })

  it('renders a status reference in a plain Markdown paragraph as a pill', () => {
    render(<MarkdownText>Inflicts [Diseased] on a failed save.</MarkdownText>)

    expect(statusPill()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diseased' })).toBeInTheDocument()
  })

  it('renders a status reference that follows a raw HTML block as a pill', () => {
    const { container } = render(<MarkdownText>{RAW_HTML_BLOCK}</MarkdownText>)

    expect(statusPill()).toBeInTheDocument()
    // The author's HTML is still rendered as authored.
    expect(container.querySelector('img[alt="Hit 1"]')).toBeInTheDocument()
    expect(container.querySelector('.theme-adapt')?.textContent).toBe('[On Hit]')
  })

  it('renders a status reference inside a raw HTML div as a pill', () => {
    render(<MarkdownText>{'<div>Inflicts [Diseased]</div>'}</MarkdownText>)

    expect(statusPill()).toBeInTheDocument()
  })

  it('renders a status reference inside raw HTML nested in a paragraph', () => {
    render(<MarkdownText>{'Inflicts <b>[Diseased]</b> now.'}</MarkdownText>)

    expect(statusPill()).toBeInTheDocument()
  })

  it('leaves an unmatched bracket reference as literal text', () => {
    render(<MarkdownText>{'Inflicts [NotAStatus] on a failed save.'}</MarkdownText>)

    expect(statusPill()).not.toBeInTheDocument()
    expect(screen.getByText(/\[NotAStatus\]/)).toBeInTheDocument()
  })

  it('makes dice notation after a raw HTML block clickable', () => {
    render(<MarkdownText>{'<div>Deal 2d6+POW damage</div>'}</MarkdownText>)

    const dice = screen.getByRole('button', { name: '2d6+POW' })
    expect(dice).toHaveClass('dice-notation')
  })

  it('does not touch text inside a raw-text element', () => {
    const { container } = render(
      <MarkdownText>{'<style>.x[data-y] { color: red }</style>'}</MarkdownText>,
    )

    expect(statusPill()).not.toBeInTheDocument()
    expect(container.querySelector('style')?.textContent).toBe(
      '.x[data-y] { color: red }',
    )
  })

  it('renders the raw source in edit mode', () => {
    render(<MarkdownText mode="edit">{RAW_HTML_BLOCK}</MarkdownText>)

    expect(statusPill()).not.toBeInTheDocument()
    expect(screen.getByText(/inflicted with \[Diseased\]/)).toBeInTheDocument()
  })
})
