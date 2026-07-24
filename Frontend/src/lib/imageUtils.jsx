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

function CropModal({ file, onComplete, onCancel, shape, fixedAspect }) {
  // Opt-in circular mode (sv2-s3.5): locks a 1:1 square crop with a round preview overlay. Used only
  // by callers that pass { shape: 'circle' } (Your People photos + baby avatar). Default is unchanged.
  const isCircle = shape === 'circle'
  // Opt-in fixed aspect (pr4 follow-up): a caller passes { aspect } to LOCK the crop to one ratio and hide
  // the landscape/portrait toggle — e.g. the book cover, whose photo slot is exactly 4:3 on-screen and in
  // print, so a portrait crop would only get re-cropped by object-fit. Omitted → unchanged toggle behaviour.
  const locked = !isCircle && typeof fixedAspect === 'number'
  const [imgSrc, setImgSrc] = useState('')
  const [orientation, setOrientation] = useState('landscape')
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [loadError, setLoadError] = useState(false)
  const imgRef = useRef(null)

  const aspect = isCircle ? 1 : (locked ? fixedAspect : (orientation === 'landscape' ? 4 / 3 : 3 / 4))

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result)
    reader.onerror = () => setLoadError(true)
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  function onImageLoad(e) {
    const { naturalWidth, naturalHeight } = e.currentTarget
    // A decode failure can fire onLoad with zero dimensions; bail rather than build a NaN crop.
    if (!naturalWidth || !naturalHeight) { setLoadError(true); return }
    setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspect))
  }

  const handleOrientationChange = useCallback((newOrientation) => {
    setOrientation(newOrientation)
    const img = imgRef.current
    if (img && img.naturalWidth && img.naturalHeight) {
      const newAspect = newOrientation === 'landscape' ? 4 / 3 : 3 / 4
      setCrop(centerAspectCrop(img.naturalWidth, img.naturalHeight, newAspect))
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
    onComplete({ blob, orientation: isCircle ? 'square' : orientation })
  }

  return (
    // pointer-events-auto: when this modal is opened from inside a Radix modal Dialog, Radix sets
    // `pointer-events: none` on <body>. We're portaled to body (outside the dialog), so without this
    // the whole crop modal would be click/drag-dead.
    <div
      data-crop-overlay
      className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 pointer-events-auto"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg text-slate-800">{isCircle ? 'Position Photo' : 'Crop Photo'}</h2>

        {!isCircle && !locked && (
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
        )}

        <div className="flex justify-center overflow-auto" style={{ maxHeight: '320px' }}>
          {loadError ? (
            <p className="text-sm text-red-600 py-8 text-center">
              That file couldn&apos;t be opened as an image. Please choose a JPG, PNG, or GIF.
            </p>
          ) : imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={aspect}
              circularCrop={isCircle}
            >
              <img
                ref={imgRef}
                src={imgSrc}
                onLoad={onImageLoad}
                onError={() => setLoadError(true)}
                alt="crop preview"
                style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain' }}
              />
            </ReactCrop>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            disabled={!completedCrop || loadError}
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

function SlotCropModal({ url, slotAspect, onComplete, onCancel }) {
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const imgRef = useRef(null)

  function onImageLoad(e) {
    const { naturalWidth, naturalHeight } = e.currentTarget
    setCrop(centerAspectCrop(naturalWidth, naturalHeight, slotAspect))
  }

  function handleConfirm() {
    if (!completedCrop || !imgRef.current) return
    const image = imgRef.current
    const nx = completedCrop.x / image.width
    const ny = completedCrop.y / image.height
    const nw = completedCrop.width / image.width
    const nh = completedCrop.height / image.height
    // Clamp to valid range so floating-point dust doesn't produce out-of-bounds values
    const x = Math.max(0, Math.min(nx, 1))
    const y = Math.max(0, Math.min(ny, 1))
    const w = Math.max(0.01, Math.min(nw, 1 - x))
    const h = Math.max(0.01, Math.min(nh, 1 - y))
    onComplete({ x, y, width: w, height: h })
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg text-slate-800">Frame Photo</h2>
        <p className="text-sm text-slate-500">Drag to choose what shows in this slot.</p>

        <div className="flex justify-center overflow-auto" style={{ maxHeight: '320px' }}>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompletedCrop(c)}
            aspect={slotAspect}
          >
            <img
              ref={imgRef}
              src={url}
              onLoad={onImageLoad}
              alt="crop preview"
              style={{ maxHeight: '320px', maxWidth: '100%', display: 'block' }}
            />
          </ReactCrop>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            disabled={!completedCrop}
            className="flex-1 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            Use This Frame
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

// Mount a transient modal on a throwaway DOM node and return its `close()`.
// `render(close)` receives the close fn so the modal can dismiss itself, and
// owns the createRoot/append/unmount/remove lifecycle every crop modal repeats.
function mountModal(render) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = ReactDOM.createRoot(container)

  let closed = false
  function close() {
    if (closed) return
    closed = true
    // Defer the unmount: close() may be invoked from inside a React commit (e.g. a parent Radix
    // Dialog unmounting the trigger that owns this modal), and synchronously unmounting another
    // root mid-render triggers React's "synchronously unmount a root while rendering" warning.
    queueMicrotask(() => {
      root.unmount()
      container.remove()
    })
  }

  root.render(render(close))
  return close
}

export function openSlotCropModal(url, slotAspect, onComplete, onCancel) {
  return mountModal(close => (
    <SlotCropModal
      url={url}
      slotAspect={slotAspect}
      onComplete={result => { close(); onComplete(result) }}
      onCancel={() => { close(); onCancel?.() }}
    />
  ))
}

// Upload a cropped-photo blob through the caller's upload function and return the resulting URL.
// Centralises the FormData boilerplate every crop→upload site repeats. `onUpload` receives the
// FormData (the caller decides the endpoint) and is expected to resolve to `{ url }`.
export async function uploadCroppedPhoto(onUpload, blob) {
  const form = new FormData();
  form.append('file', blob, 'photo.jpg');
  const res = await onUpload(form);
  return res.url;
}

// `options.shape: 'circle'` opts into a 1:1 circular crop (sv2-s3.5). `options.aspect: <number>` locks the
// crop to one ratio and hides the landscape/portrait toggle (pr4 follow-up; the book cover passes 4/3).
// Both omitted → unchanged portrait/landscape behaviour.
export function openCropModal(file, onComplete, onCancel, options = {}) {
  // Defense-in-depth: the picker's accept="image/*" is only a UX hint and is bypassable
  // (drag-drop, "All files" in the OS dialog, non-browser clients). A non-image file can't be
  // decoded — feeding it to the cropper leaves the <img> unloaded and crashes ReactCrop on the
  // resulting NaN crop dimensions. The backend rejects it too (S5), but never open the modal for it.
  if (!file || !file.type || !file.type.startsWith('image/')) {
    window.alert('Please choose an image file (JPG, PNG, GIF, etc.).')
    onCancel?.()
    return () => {}
  }

  return mountModal(close => (
    <CropModal
      file={file}
      shape={options.shape}
      fixedAspect={options.aspect}
      onComplete={result => { close(); onComplete(result) }}
      onCancel={() => { close(); onCancel?.() }}
    />
  ))
}
