import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export async function pickPhoto() {
  if (!Capacitor.isNativePlatform()) {
    return null; // Web: caller falls back to its hidden <input type="file">
  }
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    quality: 90,
  });
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  return new File([blob], `photo.${photo.format}`, { type: blob.type });
}
