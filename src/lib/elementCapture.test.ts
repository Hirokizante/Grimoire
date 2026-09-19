/**
 * elementCapture tests.
 *
 * The rasterizer itself is mocked (jsdom has no canvas): what is asserted here
 * is the plumbing that makes the shot clean — the off-screen clone, the
 * scroll un-clamping, the capture-control hiding, the live form values, and
 * the clipboard-first / download-second contract.
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { toBlobMock } = vi.hoisted(() => ({ toBlobMock: vi.fn() }))

vi.mock('html-to-image', () => ({ toBlob: toBlobMock }))

import {
  CAPTURE_HIDE_ATTRIBUTE,
  captureFileName,
  copyElementImage,
} from '@/lib/elementCapture'

/** Stands in for `new Image()`: decoding a Blob always succeeds. */
class FakeImage {
  width = 120
  height = 60
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

class FakeClipboardItem {
  items: Record<string, unknown>

  constructor(items: Record<string, unknown>) {
    this.items = items
  }
}

const drawContext = {
  fillStyle: '',
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) })),
}

const writeMock = vi.fn(async (_items: unknown[]) => {})

/** The target every test snapshots, with the bits each rule cares about. */
function buildTarget(): HTMLElement {
  document.body.innerHTML = `
    <div class="ability-card" id="target">
      <h4>Fireball</h4>
      <button ${CAPTURE_HIDE_ATTRIBUTE} class="capture-btn">shot</button>
      <div class="scroller" style="max-height: 100px; overflow-y: auto">
        <p>a result taller than its box</p>
      </div>
      <input class="advantage" value="0" />
    </div>
  `
  const input = document.querySelector<HTMLInputElement>('.advantage')
  if (input) input.value = '7'
  return document.getElementById('target') as HTMLElement
}

/** What the mocked rasterizer saw, captured at call time. */
let observed: {
  clone: HTMLElement
  options: Record<string, unknown>
  connected: boolean
} | null = null

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    drawContext as never,
  )
  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
  ): void {
    callback(new Blob(['png'], { type: 'image/png' }))
  } as never
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  Object.defineProperty(navigator, 'clipboard', {
    value: { write: writeMock },
    configurable: true,
  })
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:capture'),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  toBlobMock.mockReset()
  writeMock.mockReset()
  writeMock.mockResolvedValue(undefined)
  observed = null
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('captureFileName slugs the name and falls back to the kind alone', () => {
  expect(captureFileName('ability', 'Fireball!')).toBe(
    'grimoire-ability-fireball.png',
  )
  expect(captureFileName('sub-ability', '  Iron  Will ')).toBe(
    'grimoire-sub-ability-iron-will.png',
  )
  expect(captureFileName('roll')).toBe('grimoire-roll.png')
  expect(captureFileName('ability', '日本語')).toBe('grimoire-ability.png')
  expect(captureFileName('ability', 'x'.repeat(80)).length).toBeLessThanOrEqual(
    'grimoire-ability-'.length + 40 + '.png'.length,
  )
})

test('copies to the clipboard and hands it a promised PNG', async () => {
  const target = buildTarget()
  toBlobMock.mockImplementation(async (clone: HTMLElement, options: Record<string, unknown>) => {
    observed = { clone, options, connected: clone.isConnected }
    return new Blob(['svg'], { type: 'image/svg+xml' })
  })

  const result = await copyElementImage(target, 'grimoire-ability-fireball.png')

  expect(result).toEqual({ method: 'clipboard' })
  expect(writeMock).toHaveBeenCalledTimes(1)
  const item = writeMock.mock.calls[0][0][0] as FakeClipboardItem
  expect(item).toBeInstanceOf(FakeClipboardItem)
  expect(Object.keys(item.items)).toEqual(['image/png'])
  // The promise form is what keeps Safari inside the click's user gesture.
  expect(item.items['image/png']).toBeInstanceOf(Promise)
  await expect(item.items['image/png']).resolves.toBeInstanceOf(Blob)
})

test('snapshots an off-screen, un-clamped clone that hides the capture controls', async () => {
  const target = buildTarget()
  toBlobMock.mockImplementation(async (clone: HTMLElement, options: Record<string, unknown>) => {
    observed = { clone, options, connected: clone.isConnected }
    return new Blob(['svg'])
  })

  await copyElementImage(target, 'shot.png')

  const { clone, options, connected } = observed as NonNullable<typeof observed>
  expect(connected).toBe(true)
  expect(options.pixelRatio).toBe(2)
  expect(options.style).toEqual({ position: 'static', left: 'auto', top: 'auto' })
  expect(clone.style.position).toBe('fixed')
  expect(clone.style.left).toBe('-100000px')
  expect(clone.style.maxHeight).toBe('none')
  expect(clone.style.animation).toBe('none')

  const scroll = clone.querySelector<HTMLElement>('.scroller')
  expect(scroll?.style.maxHeight).toBe('none')
  expect(scroll?.style.overflowY).toBe('visible')

  const hidden = clone.querySelector<HTMLElement>(`[${CAPTURE_HIDE_ATTRIBUTE}]`)
  expect(hidden?.style.visibility).toBe('hidden')

  // Live form state is a property, not an attribute — it must be copied over.
  expect(clone.querySelector<HTMLInputElement>('.advantage')?.value).toBe('7')

  // The stand-in never outlives the capture, and the original is untouched.
  expect(document.querySelectorAll('.ability-card')).toHaveLength(1)
  expect(document.getElementById('target')).toBe(target)
})

test('downloads the PNG when the clipboard refuses it', async () => {
  buildTarget()
  toBlobMock.mockResolvedValue(new Blob(['svg']))
  writeMock.mockRejectedValue(new Error('clipboard denied'))

  const result = await copyElementImage(
    document.getElementById('target') as HTMLElement,
    'shot.png',
  )

  expect(result).toEqual({ method: 'download' })
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
})

test('downloads when the clipboard API is unavailable', async () => {
  buildTarget()
  toBlobMock.mockResolvedValue(new Blob(['svg']))
  vi.stubGlobal('ClipboardItem', undefined)

  const result = await copyElementImage(
    document.getElementById('target') as HTMLElement,
    'shot.png',
  )

  expect(result).toEqual({ method: 'download' })
  expect(writeMock).not.toHaveBeenCalled()
})

test('a failed rasterization rejects instead of downloading nothing', async () => {
  buildTarget()
  toBlobMock.mockRejectedValue(new Error('rasterizer exploded'))

  await expect(
    copyElementImage(document.getElementById('target') as HTMLElement, 'shot.png'),
  ).rejects.toThrow('rasterizer exploded')
})
