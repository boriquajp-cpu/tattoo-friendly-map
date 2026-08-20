import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * ネイティブiOSアプリでのみ、カメラ/フォトライブラリから写真を選択する。
 * Web版(ブラウザ)では null を返す（呼び出し側は既存の <input type="file"> を使う）。
 */
export async function pickPhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    quality: 80,
  });

  if (!photo.webPath) return null;

  const res = await fetch(photo.webPath);
  const blob = await res.blob();
  const ext = photo.format || 'jpg';
  return new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` });
}
