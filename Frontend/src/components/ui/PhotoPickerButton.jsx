import { useRef, useEffect } from "react";
import { Camera } from "lucide-react";
import { openCropModal } from "@/lib/imageUtils.jsx";
import { pickPhoto } from "@/lib/camera";

// Shared photo-picker button: tries the native camera/library picker (Capacitor) and falls back to a
// hidden web file input. The chosen file goes through the shared crop modal; the cropped result is
// reported via `onPicked({ blob, orientation })`. Renders a <Camera> icon followed by `children`
// (the label). Manages its own in-flight crop-modal cleanup on unmount.
// `shape="circle"` opts into the 1:1 circular crop (sv2-s3.5); omit it for the default crop.
export default function PhotoPickerButton({ onPicked, className, children, shape }) {
  const inputRef = useRef(null);
  const cancelCropRef = useRef(null);
  useEffect(() => () => cancelCropRef.current?.(), []);

  const startCrop = (file) => {
    if (!file) return;
    cancelCropRef.current = openCropModal(
      file,
      (result) => {
        cancelCropRef.current = null;
        onPicked(result);
      },
      // Clear the ref on cancel too, so the unmount cleanup never calls a stale (already-closed) modal.
      () => { cancelCropRef.current = null; },
      { shape },
    );
  };

  const open = async () => {
    const file = await pickPhoto();
    if (file) startCrop(file);
    else inputRef.current?.click();
  };

  return (
    <>
      <button type="button" onClick={open} className={className}>
        <Camera className="w-4 h-4" />
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files[0];
          e.target.value = "";
          startCrop(file);
        }}
      />
    </>
  );
}
