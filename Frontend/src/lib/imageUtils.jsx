import { useState, useRef, useCallback, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  )
}

function CropModal({ file, onComplete, onCancel }) {
  const [imgSrc, setImgSrc] = useState('')
  const [orientation, setOrientation] = useState('landscape')
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const imgRef = useRef(null)

  const aspect = orientation === 'landscape' ? 4 / 3 : 3 / 4

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result)
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  function onImageLoad(e) {
    const { naturalWidth, naturalHeight } = e.currentTarget
    setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspect))
  }

  const handleOrientationChange = useCallback((newOrientation) => {
    setOrientation(newOrientation)
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current
      const newAspect = newOrientation === 'landscape' ? 4 / 3 : 3 / 4
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, newAspect))
    }
  }, [])

  async function handleConfirm() {
    if (!completedCrop || !imgRef.current) return
    const image = imgRef.current
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const sourceX = completedCrop.x * scaleX
    const sourceY = completedCrop.y * scaleY
    const sourceW = completedCrop.width * scaleX
    const sourceH = completedCrop.height * scaleY

    const maxLong = 1400
    const longEdge = Math.max(sourceW, sourceH)
    const scale = longEdge > maxLong ? maxLong / longEdge : 1

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sourceW * scale)
    canvas.height = Math.round(sourceH * scale)

    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    onComplete({ blob, orientation })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg text-slate-800">Crop Photo</h2>

        <div className="flex gap-2">
          <button
            onClick={() => handleOrientationChange('landscape')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${orientation === 'landscape' ? 'bg-sky-100 border-sky-400 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            &#9645; Landscape (4:3)
          </button>
          <button
            onClick={() => handleOrientationChange('portrait')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${orientation === 'portrait' ? 'bg-sky-100 border-sky-400 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            &#9646; Portrait (3:4)
          </button>
        </div>

        <div className="flex justify-center overflow-auto" style={{ maxHeight: '320px' }}>
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={aspect}
            >
              <img
                ref={imgRef}
                src={imgSrc}
                onLoad={onImageLoad}
                alt="crop preview"
                style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain' }}
              />
            </ReactCrop>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            disabled={!completedCrop}
            className="flex-1 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            Crop &amp; Use
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function openCropModal(file, onComplete) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = ReactDOM.createRoot(container)

  function close() {
    root.unmount()
    container.remove()
  }

  root.render(
    <CropModal
      file={file}
      onComplete={result => { close(); onComplete(result) }}
      onCancel={close}
    />
  )
}
