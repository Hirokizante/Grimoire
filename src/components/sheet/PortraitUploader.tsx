/**
 * PortraitUploader — a minimal file-input component that converts an uploaded
 * image to a compressed base64 data URL and hands it to the parent via
 * `onUpdate`.
 *
 * Per DESIGN.md, portraits are stored locally as base64 data URLs (offline-
 * first, no server uploads). We validate the selected file is an image type
 * before processing; non-image selections are ignored.
 *
 * Images are resized and compressed via {@link processImage} before storage:
 * max 512px on the longest edge, JPEG quality 0.85. This keeps the resulting
 * data URL to ~30–60 KB instead of multi-megabyte raw files.
 */

import { useRef, useState } from 'react'
import { processImage } from '@/lib/imageProcessing'

export interface PortraitUploaderProps {
  /** Called with a base64 data URL string when a valid image is selected. */
  onUpdate: (dataUrl: string) => void
  /** Optional label for the upload button. */
  label?: string
}

export default function PortraitUploader({
  onUpdate,
  label = 'Upload Portrait',
}: PortraitUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)

  const handleChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    // Reset so selecting the same file twice still fires change.
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    setProcessing(true)
    try {
      const dataUrl = await processImage(file, {
        maxDim: 512,
        quality: 0.85,
      })
      onUpdate(dataUrl)
    } catch {
      // Silently ignore decode errors — non-image files are already filtered.
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="portrait-uploader">
      <button
        type="button"
        className="btn btn--ghost portrait-uploader__btn"
        onClick={() => inputRef.current?.click()}
        disabled={processing}
      >
        {processing ? 'Processing…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="portrait-uploader__input"
        onChange={handleChange}
      />
    </div>
  )
}
