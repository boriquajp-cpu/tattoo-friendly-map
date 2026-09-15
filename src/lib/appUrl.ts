/**
 * アプリの公開Web URL。
 * ネイティブアプリ内では window.location.href が capacitor://localhost/... 等の
 * 内部URLになり、外部と共有しても意味をなさないため、共有・コピー用途では
 * 必ずこちらの固定URLを使う。
 */
export const APP_PUBLIC_URL = 'https://tattoo-friendly-map-lemon.vercel.app';

export function facilityShareUrl(facilityId: string): string {
  return `${APP_PUBLIC_URL}/facility/${facilityId}`;
}
