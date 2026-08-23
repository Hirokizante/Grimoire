/**
 * PortraitCropModal — shown automatically after the user picks a portrait
 * file, so they can crop it (square, 1:1) before it's stored.
 *
 * The crop is a fixed square viewport; the image is scaled to cover it (so a
 * non-square photo fills the frame) and the user pans (drag) and zooms
 * (slider) to choose which region is kept. The final crop is drawn to a
 * canvas at up to 512px and compressed to JPEG, then handed back as a base64
 * data URL via `onUpdate`.
 *
 * Actions:
 *   - "Crop & Upload"  → crop + compress, then `onUpdate`
 *   - "Use Original"   → skip cropping: resize + compress the full image
 *   - "Cancel" / ✕ / Esc / overlay → discard, no upload
 *
 * Follows the project's modal convention: overlay click or ✕ closes, Esc
 * closes via useEscapeKey, contextual footer buttons.
 */

import { useEffect, useRef, useState } from 'react'

import { useModalDialog } from '@/hooks/useModalDialog'
import { processImage, processImageCrop } from '@/lib/imageProcessing'

export interface PortraitCropModalProps {
  /** The selected file to crop. When null the modal is not rendered. */
  file: File | null
  /** Called with the final (cropped or original) compressed data URL. */
  onUpdate: (dataUrl: string) => void
  /** Called when the user dismisses the modal without uploading. */
  onClose: () => void
}

/** Target size for the stored portrait (matches PortraitUploader's max dim). */
const OUT_MAX = 512
/** JPEG quality for the stored portrait. */
const QUALITY = 0.85
/** Zoom slider bounds. */
const MIN_ZOOM = 1
const MAX_ZOOM = 4

interface LoadedImage {
  url: string
  width: number
  height: number
}

/** Compute the crop viewport's pixel size from the current window width. */
function computeSize() {
  return Math.max(200, Math.min(360, window.innerWidth - 96))
}

export default function PortraitCropModal({
  file,
  onUpdate,
  onClose,
}: PortraitCropModalProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState(computeSize)
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const dragRef = useRef<null | {
    pointerId: number
    startClientX: number
    startClientY: number
    startPanX: number
    startPanY: number
  }>(null)

  // Keep the latest callbacks reachable from the load effect without
  // re-running it on every render (onClose/onUpdate are inline arrows in the
  // parent, so their identities change each render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const dialogRef = useModalDialog(onClose, !!file)

  // Track the viewport size on window resize.
  useEffect(() => {
    const onResize = () => setSize(computeSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load (and keep alive) the selected file as an object URL; capture its
  // natural dimensions. Resets crop state for each new file.
  useEffect(() => {
    if (!file) {
      setImage(null)
      setFailed(false)
      return
    }
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setFailed(false)
    const url = URL.createObjectURL(file)
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (!cancelled) {
        setImage({ url, width: img.naturalWidth, height: img.naturalHeight })
      }
    }
    img.onerror = () => {
      if (!cancelled) setFailed(true)
      URL.revokeObjectURL(url)
    }
    img.src = url
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  if (!file) return null

  const { width: nw, height: nh } = image ?? { width: 0, height: 0 }

  // Cover scale at zoom 1: the image fills the square viewport on its short
  // side, overflowing on the long side.
  const scale = nw && nh ? size / Math.min(nw, nh) : 0
  const dispW = nw * scale * zoom
  const dispH = nh * scale * zoom

  const clampPan = (x: number, y: number, z: number) => {
    const maxX = Math.max(0, (nw * scale * z - size) / 2)
    const maxY = Math.max(0, (nh * scale * z - size) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    setPan(clampPan(drag.startPanX + dx, drag.startPanY + dy, zoom))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const onZoomChange = (next: number) => {
    setZoom(next)
    setPan((p) => clampPan(p.x, p.y, next))
  }

  const computeCrop = () => {
    const k = scale * zoom // natural px per displayed px
    const left = size / 2 - dispW / 2 + pan.x
    const top = size / 2 - dispH / 2 + pan.y
    const srcW = size / k
    const srcH = size / k
    const x = Math.max(0, Math.min(nw - srcW, -left / k))
    const y = Math.max(0, Math.min(nh - srcH, -top / k))
    return { x, y, width: srcW, height: srcH }
  }

  const handleUseOriginal = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      const dataUrl = await processImage(file, {
        maxDim: OUT_MAX,
        quality: QUALITY,
      })
      onUpdateRef.current(dataUrl)
      onCloseRef.current()
    } catch {
      onCloseRef.current()
    } finally {
      setBusy(false)
    }
  }

  const handleCrop = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      const crop = computeCrop()
      // Never upscale a tiny source — cap output to the crop's natural width.
      const outSize = Math.max(1, Math.min(OUT_MAX, Math.round(crop.width)))
      const dataUrl = await processImageCrop(
        file,
        crop,
        outSize,
        QUALITY,
      )
      onUpdateRef.current(dataUrl)
      onCloseRef.current()
    } catch {
      onCloseRef.current()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content portrait-crop-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Crop portrait"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Crop Portrait</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="portrait-crop-modal__body">
          {failed ? (
            <p className="portrait-crop-modal__error muted">
              That image couldn't be loaded. Please choose another file.
            </p>
          ) : !image ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              <div
                className="portrait-crop-modal__viewport"
                style={{ width: size, height: size }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {/* Rule-of-thirds grid — helps the user center the subject. */}
                <div className="portrait-crop-modal__grid" aria-hidden />
                <img
                  className="portrait-crop-modal__img"
                  src={image.url}
                  alt=""
                  draggable={false}
                  style={{
                    width: dispW,
                    height: dispH,
                    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                  }}
                />
              </div>

              <div className="portrait-crop-modal__zoom">
                <span className="portrait-crop-modal__zoom-label">Zoom</span>
                <input
                  type="range"
                  className="portrait-crop-modal__slider"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => onZoomChange(Number(e.target.value))}
                  aria-label="Zoom"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer portrait-crop-modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <div className="portrait-crop-modal__footer-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleUseOriginal}
              disabled={busy || !image}
            >
              Use Original
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCrop}
              disabled={busy || !image}
            >
              {busy ? 'Processing…' : 'Crop & Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
