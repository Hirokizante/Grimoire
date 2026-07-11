/**
 * PortraitUploader — a minimal file-input component that converts an uploaded
 * image to a base64 data URL and hands it to the parent via `onUpdate`.
 *
 * Per DESIGN.md, portraits are stored locally as base64 data URLs (offline-
 * first, no server uploads). We validate the selected file is an image type
 * before reading it; non-image selections are ignored.
 */

import { useRef } from 'react'

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so selecting the same file twice still fires change.
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdate(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="portrait-uploader">
      <button
        type="button"
        className="btn btn--ghost portrait-uploader__btn"
        onClick={() => inputRef.current?.click()}
      >
        {label}
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
