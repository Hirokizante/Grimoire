/**
 * PortraitUploader — a file-input component for portrait uploads (character
 * and NPC portraits). Selecting a file opens a crop modal so the user can
 * frame the image before it's stored; the final result (cropped, or the
 * original if the user opts out) is compressed and handed to the parent via
 * `onUpdate`.
 *
 * Per DESIGN.md, portraits are stored locally as base64 data URLs (offline-
 * first, no server uploads). We validate the selected file is an image type
 * before processing; non-image selections are ignored.
 */

import { useRef, useState } from 'react'

import PortraitCropModal from '@/components/sheet/PortraitCropModal'

export interface PortraitUploaderProps {
  /** Called with a base64 data URL string when a valid image is confirmed. */
  onUpdate: (dataUrl: string) => void
  /** Optional label for the upload button. */
  label?: string
}

export default function PortraitUploader({
  onUpdate,
  label = 'Upload Portrait',
}: PortraitUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so selecting the same file twice still fires change.
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    // Open the crop modal; the actual upload happens on confirm.
    setPendingFile(file)
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
      <PortraitCropModal
        file={pendingFile}
        onUpdate={(dataUrl) => {
          setPendingFile(null)
          onUpdate(dataUrl)
        }}
        onClose={() => setPendingFile(null)}
      />
    </div>
  )
}
