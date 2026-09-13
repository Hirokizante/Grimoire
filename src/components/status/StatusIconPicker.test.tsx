/**
 * Component tests for the status icon picker and the icon renderer.
 *
 * These pin the two things the picker promises: you can *search* the emoji set
 * and the RPG-Awesome pack instead of scrolling them, and whatever you pick
 * comes back as the `{ icon, iconType }` pair the status record stores — with
 * `StatusIcon` drawing a saved RPG-Awesome key as a font glyph, and still
 * drawing the Lucide keys older records carry.
 */

import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import StatusIconPicker from '@/components/status/StatusIconPicker'
import StatusIcon from '@/components/status/StatusIcon'
import { RPG_AWESOME_ICON_KEYS } from '@/constants/rpgAwesomeIcons'

/** Render the picker and hand back the onChange spy. */
function renderPicker(icon = '', iconType: 'emoji' | 'pack' | 'image' = 'emoji') {
  const onChange = vi.fn()
  render(
    <StatusIconPicker icon={icon} iconType={iconType} onChange={onChange} />,
  )
  return onChange
}

const emojiSearch = () => screen.getByLabelText('Search emoji')
const packSearch = () => screen.getByLabelText('Search icon pack')

test('the emoji tab searches the whole Unicode set and selects a hit', async () => {
  const onChange = renderPicker()

  // The full catalog arrives asynchronously; a search waits for it.
  fireEvent.change(emojiSearch(), { target: { value: 'crossed swords' } })
  const swords = await screen.findByRole('button', { name: 'crossed swords' })
  expect(screen.getByText(/1 match/)).toBeInTheDocument()

  fireEvent.click(swords)
  expect(onChange).toHaveBeenCalledWith({ icon: '⚔️', iconType: 'emoji' })
})

test('the emoji tab ranks a game term like "poisoned" onto its glyph', async () => {
  renderPicker()
  fireEvent.change(emojiSearch(), { target: { value: 'poisoned' } })

  const poison = await screen.findByRole('button', {
    name: 'skull and crossbones',
  })
  expect(poison).toHaveTextContent('☠️')
})

test('a query with no emoji says so instead of showing an empty grid', async () => {
  renderPicker()
  fireEvent.change(emojiSearch(), { target: { value: 'zzzznope' } })

  expect(await screen.findByText(/No emoji match/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'fire' })).toBeNull()
})

test('the search field can be cleared back to the browse view', async () => {
  renderPicker()
  fireEvent.change(emojiSearch(), { target: { value: 'zzzznope' } })
  expect(await screen.findByText(/No emoji match/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(emojiSearch()).toHaveValue('')
  // Back to the unfiltered panel: quick picks and the group headings.
  expect(screen.getByText('Common')).toBeInTheDocument()
  expect(await screen.findByText('All emoji')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
})

test('a pasted emoji is usable even though the box is a search field', async () => {
  const onChange = renderPicker()
  fireEvent.change(emojiSearch(), { target: { value: '🦴' } })

  const use = await screen.findByRole('button', {
    name: /Use “🦴” as the icon/,
  })
  fireEvent.click(use)
  expect(onChange).toHaveBeenCalledWith({ icon: '🦴', iconType: 'emoji' })
})

test('the emoji tab opens on quick picks and marks the current selection', async () => {
  renderPicker('🔥', 'emoji')
  expect(screen.getByText('Common')).toBeInTheDocument()
  // 🔥 appears twice once the catalog lands (quick pick + "Travel & Places");
  // the quick-pick row is the one rendered first.
  const fires = await screen.findAllByRole('button', { name: 'fire' })
  expect(fires[0]).toHaveAttribute('aria-pressed', 'true')
})

test('the icon pack is RPG-Awesome, searchable, and selects its key', () => {
  const onChange = renderPicker('', 'pack')

  // 496 icons are on offer, not the old 61-icon Lucide list.
  expect(RPG_AWESOME_ICON_KEYS).toHaveLength(496)
  expect(screen.getByRole('button', { name: 'Crossed swords' })).toBeInTheDocument()

  fireEvent.change(packSearch(), { target: { value: 'potion' } })
  expect(screen.getByRole('button', { name: 'Bubbling potion' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Crossed swords' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Bubbling potion' }))
  expect(onChange).toHaveBeenCalledWith({
    icon: 'ra-bubbling-potion',
    iconType: 'pack',
  })
})

test('icon pack search matches every word and can come up empty', () => {
  renderPicker('', 'pack')

  fireEvent.change(packSearch(), { target: { value: 'lightning sword' } })
  expect(screen.getByRole('button', { name: 'Lightning sword' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lightning bolt' })).toBeNull()

  fireEvent.change(packSearch(), { target: { value: 'zzzznope' } })
  expect(screen.getByText(/No icons match/)).toBeInTheDocument()
  expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0)
})

test('the pack tab marks the stored key as the current selection', () => {
  renderPicker('ra-skull', 'pack')
  expect(screen.getByRole('button', { name: 'Skull' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByText('Icon pack · Skull')).toBeInTheDocument()
})

test('switching tabs keeps the emoji and pack panels independent', async () => {
  renderPicker('', 'pack')
  fireEvent.change(packSearch(), { target: { value: 'potion' } })

  fireEvent.click(screen.getByRole('tab', { name: 'Emoji' }))
  expect(await screen.findByLabelText('Search emoji')).toHaveValue('')

  fireEvent.change(emojiSearch(), { target: { value: 'fire' } })
  fireEvent.click(screen.getByRole('tab', { name: 'Icon Pack' }))
  // The pack query is its own state — unmounting the panel resets it.
  expect(packSearch()).toHaveValue('')
})

test('StatusIcon draws an RPG-Awesome key with the icon font', () => {
  const { container } = render(<StatusIcon icon="ra-crossed-swords" iconType="pack" size={18} />)
  const glyph = container.querySelector('i.ra.ra-crossed-swords')
  expect(glyph).not.toBeNull()
  expect(glyph).toHaveStyle({ fontSize: '18px' })
})

test('StatusIcon still draws the Lucide keys older statuses saved', () => {
  const { container } = render(<StatusIcon icon="skull" iconType="pack" />)
  expect(container.querySelector('svg.lucide-skull')).not.toBeNull()
  expect(container.querySelector('i.ra')).toBeNull()
})

test('StatusIcon falls back to the placeholder for an unknown pack key', () => {
  render(<StatusIcon icon="ra-not-a-real-icon" iconType="pack" />)
  expect(screen.getByText('§')).toBeInTheDocument()
})

test('StatusIcon draws emoji and uploaded images unchanged', () => {
  const { container } = render(<StatusIcon icon="🔥" iconType="emoji" />)
  expect(container.querySelector('span')).toHaveTextContent('🔥')

  render(
    <StatusIcon icon="data:image/png;base64,AAA" iconType="image" size={24} />,
  )
  const img = container.ownerDocument.querySelector('img')
  expect(img).toHaveAttribute('src', 'data:image/png;base64,AAA')
})

test('an uploaded image still wins over a new pick, and can be removed', async () => {
  const onChange = renderPicker('data:image/png;base64,AAA', 'image')
  expect(screen.getByText('Uploaded image')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
  expect(onChange).toHaveBeenCalledWith({ icon: '', iconType: 'emoji' })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Choose SVG or PNG' })).toBeInTheDocument(),
  )
})
