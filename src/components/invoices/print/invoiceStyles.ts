import type { CSSProperties } from 'react';

/**
 * Inline styles for printable documents. They are rendered to a standalone HTML
 * string for printing / PDF, where Tailwind classes do not exist, so every
 * printable component styles itself with these.
 */

export const PRINT_FONT =
  "'Inter', 'Mukta', 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', Roboto, Arial, sans-serif";

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export const C = {
  slate900: '#0F172A',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  paidBg: '#ECFDF5',
  paidBorder: '#A7F3D0',
  paidText: '#059669',
  dueBg: '#FEF3C7',
  dueBorder: '#FDE68A',
  dueText: '#B45309',
  red: '#DC2626',
  roseBg: '#FFF1F2',
  roseBorder: '#FECDD3',
};

/** "#0284C7" + alpha (0–255) -> "rgba(2,132,199,0.09)" */
export function tint(hex: string, alpha255: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${(alpha255 / 255).toFixed(3)})`;
}

export const text = (size: number, weight: number, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.35,
  ...extra,
});

export const right: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

export const card: CSSProperties = {
  background: C.slate50,
  border: `1px solid ${C.slate200}`,
  borderRadius: 7,
};

export const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** Base CSS for the standalone print document. */
export const PRINT_BASE_CSS = `
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
html,body{margin:0;padding:0;background:#ffffff;}
body{font-family:${PRINT_FONT};color:${C.slate900};}
img{display:block;}
table{border-collapse:collapse;width:100%;}
td,th{padding:0;}
.kp-page{page-break-after:always;break-after:page;}
.kp-page:last-child{page-break-after:auto;break-after:auto;}
`;
