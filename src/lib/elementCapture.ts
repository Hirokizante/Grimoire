/**
 * elementCapture — rasterize a live element to a PNG and hand it to the
 * clipboard, for the capture buttons on Ability Blocks and roll results.
 *
 * The element is captured from a **clone parked off-screen** rather than in
 * place, for three reasons:
 *
 *   - **It is never darkened.** A clone is rendered on its own, so an ancestor
 *     `opacity` — the GM panel's 0.55 at 0 AP, its 0.75 when dead, a card mid
 *     drag — cannot tint the shot. The element's own colors are captured at
 *     full strength no matter what the live surface is doing.
 *   - **It is never clipped by a scroller.** Every scrolling box inside the
 *     clone is un-clamped before capture, so an activation modal taller than
 *     its 78vh body is captured whole, not just the visible slice of it.
 *   - **The capture controls remove themselves.** Anything marked with
 *     {@link CAPTURE_HIDE_ATTRIBUTE} is hidden inside the clone, so the button
 *     itself (and any future capture chrome) never appears in the image.
 *
 * The clone stays in the original's parent, so every selector keyed on that
 * context (`.gm-panel__sheet .ability-card`, inherited custom properties) still
 * matches; it is only taken out of flow. `html-to-image` then inlines the
 * computed styles of the clone's subtree, renders it through an SVG
 * `foreignObject`, and the result is composited over the nearest opaque
 * ancestor background so rounded corners and translucent blocks (a Minor
 * card's 6% tint) read exactly as they do on the sheet.
 *
 * Clipboard first, download second: `navigator.clipboard.write` is handed the
 * PNG as a **promise** so the write starts inside the click's user gesture
 * (Safari refuses a `ClipboardItem` created any later). Where the API is
 * missing or blocked, the PNG is saved to the device instead — the caller is
 * told which happened so it can say so.
 */

import { toBlob } from 'html-to-image'

/** Marks a control that must not appear in a capture. */
export const CAPTURE_HIDE_ATTRIBUTE = 'data-capture-hide'

/** How the finished image reached the user. */
export type CaptureMethod = 'clipboard' | 'download'

export interface CaptureImageResult {
  method: CaptureMethod
}

/** Rendered at this multiple of CSS pixels so text stays crisp when zoomed. */
const PIXEL_RATIO = 2

/** The off-screen parking spot; fixed positioning keeps it out of the layout. */
const OFFSCREEN_LEFT = '-100000px'

/** Scratch canvas used to read the alpha out of any computed color syntax. */
let alphaProbe: HTMLCanvasElement | null = null

/**
 * A filesystem-safe name for a capture, e.g. `grimoire-ability-fireball.png`.
 * Non-ASCII names slug away entirely, which is fine — the prefix still says
 * what the image is.
 */
export function captureFileName(kind: string, name?: string | null): string {
  const slug = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `grimoire-${kind}${slug ? `-${slug}` : ''}.png`
}

/**
 * Snapshot `element` and copy it to the clipboard, falling back to a download.
 *
 * Must be called synchronously from the click handler (the clipboard write is
 * part of the user gesture; only the image itself may resolve later).
 */
export async function copyElementImage(
  element: HTMLElement,
  fileName: string,
): Promise<CaptureImageResult> {
  const clone = buildCaptureClone(element)
  const backdrop = resolveBackdropColor(element)
  const imagePromise = rasterizeClone(clone, backdrop).finally(() => clone.remove())

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await Promise.all([
        navigator.clipboard.write([new ClipboardItem({ 'image/png': imagePromise })]),
        imagePromise,
      ])
      return { method: 'clipboard' }
    } catch {
      // Either the clipboard refused (permissions, unsupported type) or the
      // rasterizer failed. Both are settled below: a capture failure rethrows
      // from the same promise, a refusal falls through to the download.
    }
  }

  const blob = await imagePromise
  downloadBlob(blob, fileName)
  return { method: 'download' }
}

/**
 * Clone `element` into an off-screen, out-of-flow stand-in: full height, no
 * scroll clamps, and the capture controls hidden.
 */
function buildCaptureClone(element: HTMLElement): HTMLElement {
  const rect = element.getBoundingClientRect()
  const clone = element.cloneNode(true) as HTMLElement
  const style = clone.style

  style.position = 'fixed'
  style.left = OFFSCREEN_LEFT
  style.top = '0'
  style.width = `${rect.width}px`
  style.height = 'auto'
  style.maxHeight = 'none'
  style.maxWidth = 'none'
  style.overflow = 'visible'
  style.margin = '0'
  style.transform = 'none'
  style.animation = 'none'
  style.transition = 'none'
  style.pointerEvents = 'none'

  clone.querySelectorAll<HTMLElement>(`[${CAPTURE_HIDE_ATTRIBUTE}]`).forEach((node) => {
    // `visibility`, not `display`: the hidden control keeps its place, so the
    // rest of the row lays out exactly as it does live.
    node.style.visibility = 'hidden'
  })

  // Attach BEFORE reading computed styles — a detached clone has none — and
  // before the library's own clone so its style copy sees the un-clamped box.
  element.parentElement?.insertBefore(clone, element.nextSibling)

  // Live form state is a DOM property, not an attribute, so a deep clone
  // starts from the mounted values. The roll modal's Advantage inputs are the
  // ones this matters for: their typed numbers belong in the shot.
  syncFormState(element, clone)

  for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
    const nodeStyle = getComputedStyle(node)
    const scrolls = nodeStyle.overflowY === 'auto' || nodeStyle.overflowY === 'scroll'
    if (scrolls && nodeStyle.maxHeight !== 'none') {
      node.style.maxHeight = 'none'
      node.style.overflowY = 'visible'
    }
  }

  return clone
}

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/** Copy the live value/checked state of every form control onto the clone. */
function syncFormState(source: HTMLElement, clone: HTMLElement): void {
  const sourceFields = source.querySelectorAll<FormField>('input, textarea, select')
  const cloneFields = clone.querySelectorAll<FormField>('input, textarea, select')
  sourceFields.forEach((field, index) => {
    const copy = cloneFields[index]
    if (!copy) return
    if (field instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      copy.checked = field.checked
      if (field.type !== 'checkbox' && field.type !== 'radio') copy.value = field.value
    } else if (
      field instanceof HTMLTextAreaElement &&
      copy instanceof HTMLTextAreaElement
    ) {
      copy.value = field.value
    } else if (field instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) {
      copy.value = field.value
    }
  })
}

/** Rasterize the clone and flatten it over the element's backdrop. */
async function rasterizeClone(clone: HTMLElement, backdrop: string | null): Promise<Blob> {
  const svgBlob = await toBlob(clone, {
    pixelRatio: PIXEL_RATIO,
    cacheBust: true,
    // Undo the parking spot for the render itself: the library copies the
    // clone's computed styles, which include `position: fixed` and the offset.
    style: { position: 'static', left: 'auto', top: 'auto' },
  })
  if (!svgBlob) throw new Error('The element could not be rasterized')

  const image = await blobToImage(svgBlob)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The capture could not be drawn')

  if (backdrop) {
    context.fillStyle = backdrop
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0)

  const png = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!png) throw new Error('The capture could not be encoded')
  return png
}

/**
 * The first fully opaque background at or above `element` — what the element
 * visibly sits on. It fills the canvas so rounded corners and translucent
 * backgrounds composite against the same surface the sheet shows. Deliberately
 * read from the live element, never the clone (which is out of flow).
 */
function resolveBackdropColor(element: HTMLElement): string | null {
  let node: HTMLElement | null = element
  while (node) {
    const background = getComputedStyle(node).backgroundColor
    if (colorAlpha(background) === 255) return background
    node = node.parentElement
  }
  return null
}

/** Read a computed color's alpha channel (0–255) through the browser's parser. */
function colorAlpha(color: string): number {
  if (!color || color === 'transparent') return 0
  alphaProbe ??= document.createElement('canvas')
  alphaProbe.width = 1
  alphaProbe.height = 1
  const context = alphaProbe.getContext('2d')
  if (!context) return 0
  // A cleared probe means an unparseable color reads as transparent instead of
  // leaving the previous color's alpha behind.
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  return context.getImageData(0, 0, 1, 1).data[3]
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The captured image could not be loaded'))
    }
    image.src = url
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick: revoking synchronously can cancel the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
