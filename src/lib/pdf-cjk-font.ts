import type jsPDF from 'jspdf';

/**
 * Lädt eine chinesische Schriftart (Noto Sans SC) bei Bedarf
 * und registriert sie unter dem Font-Namen "NotoSC" für jsPDF.
 *
 * Hinweis: Wir nutzen ein im Browser gehostetes TTF (jsDelivr-Mirror der
 * Google Fonts Noto-Quelle). Das Ergebnis wird im Modul gecached.
 */
let cjkBase64Promise: Promise<string> | null = null;

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansSC/hinted/ttf/NotoSansSC-Regular.ttf';

async function fetchFontBase64(): Promise<string> {
  if (cjkBase64Promise) return cjkBase64Promise;
  cjkBase64Promise = (async () => {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`CJK font load failed: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    // Base64 in Chunks (große Buffers brechen String.fromCharCode(...buf))
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode.apply(
        null,
        Array.from(buf.subarray(i, i + chunk)),
      );
    }
    return btoa(bin);
  })();
  return cjkBase64Promise;
}

export async function ensureCJKFont(doc: jsPDF): Promise<boolean> {
  try {
    const base64 = await fetchFontBase64();
    doc.addFileToVFS('NotoSansSC-Regular.ttf', base64);
    doc.addFont('NotoSansSC-Regular.ttf', 'NotoSC', 'normal');
    doc.addFont('NotoSansSC-Regular.ttf', 'NotoSC', 'bold');
    return true;
  } catch (e) {
    console.warn('CJK font konnte nicht geladen werden:', e);
    return false;
  }
}
