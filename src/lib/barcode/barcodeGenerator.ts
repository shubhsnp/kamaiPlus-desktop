// Pure TypeScript 1D barcodes as vector SVG — EAN-13 and Code-128 (B / C).
// Verified against ZXing (the decoder behind the camera scanner) in Suite 9 §9e.

/*
 * v4.71.0: the old Code-128 took the check character from Object.keys() of a
 * character→pattern map. JavaScript lists the digit keys '0'–'9' first, so check
 * values 0–25 got the wrong pattern, and 95–102 had none — about 1 label in 3 did
 * not scan. Patterns are now looked up by value in the standard table below.
 */

/** Code-128 bar/space widths for values 0–106 (106 = stop, 7 elements). */
const CODE128: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

const widthsToModules = (widths: string, out: boolean[]) => {
  let bar = true;
  for (const w of widths) {
    for (let i = 0; i < Number(w); i++) out.push(bar);
    bar = !bar;
  }
};

/** Code-128 module row (true = bar), without quiet zones. Digits of even length use the denser Code C. */
export function code128Modules(text: string): boolean[] {
  const safe = (text || '0').slice(0, 40);
  const values: number[] = [];
  if (/^\d+$/.test(safe) && safe.length >= 4 && safe.length % 2 === 0) {
    values.push(START_C);
    for (let i = 0; i < safe.length; i += 2) values.push(Number(safe.slice(i, i + 2)));
  } else {
    values.push(START_B);
    for (const ch of safe) {
      const code = ch.charCodeAt(0);
      values.push(code >= 32 && code <= 126 ? code - 32 : 31); // anything else prints as "?"
    }
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, STOP);
  const modules: boolean[] = [];
  for (const v of values) widthsToModules(CODE128[v], modules);
  return modules;
}

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function isEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** EAN-13 module row (95 modules), without quiet zones. */
export function ean13Modules(code: string): boolean[] {
  const d = code.split('').map(Number);
  const parity = EAN_PARITY[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[d[i]];
  bits += '101';
  return bits.split('').map((b) => b === '1');
}

export interface BarcodeSymbol {
  /** Bars and spaces including the quiet zones. */
  modules: boolean[];
  format: 'EAN-13' | 'CODE-128';
}

/** A valid EAN-13 prints as EAN-13 (every store code does); anything else as Code-128. */
export function barcodeSymbol(text: string): BarcodeSymbol {
  const clean = (text || '').trim();
  if (isEan13(clean)) {
    const quietL = Array(11).fill(false);
    const quietR = Array(7).fill(false);
    return { modules: quietL.concat(ean13Modules(clean), quietR), format: 'EAN-13' };
  }
  const quiet = Array(10).fill(false);
  return { modules: quiet.concat(code128Modules(clean), quiet), format: 'CODE-128' };
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string));

export interface BarcodeRenderOptions {
  width?: number; // unused (kept for older callers); the SVG fills its box
  height?: number; // bar height in viewBox units (1 module = 2 units)
  showText?: boolean; // human-readable digits under the bars
  barColor?: string;
  bgColor?: string;
  fontSize?: number;
}

/**
 * Barcode SVG that stretches to the box it is placed in (preserveAspectRatio none),
 * with bars drawn as one crisp path — labels set the size in mm.
 */
export function barcodeSVG(text: string, options: BarcodeRenderOptions = {}): string {
  const { height = 50, showText = true, barColor = '#000000', bgColor = '#ffffff', fontSize = 11 } = options;
  const value = (text || '').trim() || '0';
  const { modules } = barcodeSymbol(value);
  const unit = 2;
  const totalWidth = modules.length * unit;
  const totalHeight = showText ? height + fontSize + 6 : height;
  let d = '';
  let i = 0;
  while (i < modules.length) {
    if (!modules[i]) { i++; continue; }
    let j = i;
    while (j < modules.length && modules[j]) j++;
    d += `M${i * unit} 0h${(j - i) * unit}v${height}h-${(j - i) * unit}z`;
    i = j;
  }
  const label = showText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize + 2}" text-anchor="middle" font-family="Consolas, 'Courier New', monospace" font-weight="bold" font-size="${fontSize}" fill="${barColor}" letter-spacing="1">${escapeXml(value)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" preserveAspectRatio="none" shape-rendering="crispEdges" style="background-color:${bgColor}"><path d="${d}" fill="${barColor}"/>${label}</svg>`;
}

/** Kept name for older callers: now EAN-13 or Code-128 as fits the value. */
export function generateCode128SVG(text: string, options: BarcodeRenderOptions = {}): string {
  return barcodeSVG(text, options);
}

export function generateCode128DataURL(text: string, options: BarcodeRenderOptions = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(barcodeSVG(text, options))}`;
}
