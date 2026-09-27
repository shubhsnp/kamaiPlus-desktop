import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { getDesktopApi, PaperFormat, DesktopResult } from '@/lib/desktop/desktopBridge';
import { PRINT_BASE_CSS } from '@/components/invoices/print/invoiceStyles';

/**
 * Output pipeline for every printable document (invoices, statements, reports):
 * React element -> standalone HTML -> Electron (vector PDF / OS printer), or the
 * browser print dialog when running outside Electron.
 */

/** Renders a pure (hook-free) element to static markup in a detached node. */
export function renderElementToHtml(element: ReactElement): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const html = host.innerHTML;
  root.unmount();
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function pageCssFor(paper: PaperFormat): string {
  if (paper === 'a4') return '@page{size:A4 portrait;margin:0;}';
  // Roll paper has no fixed height: the desktop shell measures the slip and sets
  // the page size itself; the printer driver handles it in the browser fallback.
  return '@page{margin:0;}';
}

export function buildPrintHtml(bodyHtml: string, title: string, paper: PaperFormat, extraCss = ''): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_BASE_CSS}${pageCssFor(
    paper
  )}${extraCss}</style></head><body>${bodyHtml}</body></html>`;
}

/** Flowing A4 documents (reports, statements): page margins, table headers repeat on every page. */
export const FLOWING_A4_CSS =
  '@page{size:A4 portrait;margin:12mm 11mm 14mm;}thead{display:table-header-group;}tr{break-inside:avoid;page-break-inside:avoid;}';

let brandLogoCache: string | null = null;

/** App logo as a data URL, so printed documents never depend on a relative URL. */
export async function getBrandLogoDataUrl(): Promise<string> {
  if (brandLogoCache !== null) return brandLogoCache;
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    brandLogoCache = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    brandLogoCache = '';
  }
  return brandLogoCache;
}

/** Browser fallback: print a standalone document through a hidden iframe. */
function printViaIframe(html: string): Promise<DesktopResult> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      resolve({ ok: false, error: 'Print window could not be opened.' });
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const fire = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve({ ok: true });
      } catch (err: any) {
        resolve({ ok: false, error: err?.message || 'Printing failed.' });
      } finally {
        setTimeout(() => frame.remove(), 1500);
      }
    };
    // Give embedded data-URL images a moment to decode before printing.
    setTimeout(fire, 400);
  });
}

export async function printHtml(
  html: string,
  paper: PaperFormat | 'label',
  opts: { deviceName?: string; silent?: boolean; pageSizeMm?: { width: number; height: number } } = {}
): Promise<DesktopResult & { method: 'desktop' | 'browser' }> {
  const api = getDesktopApi();
  if (api) {
    const res = await api.print({ html, paper, pageSizeMm: opts.pageSizeMm, deviceName: opts.deviceName || undefined, silent: Boolean(opts.silent) });
    return { ...res, method: 'desktop' };
  }
  const res = await printViaIframe(html);
  return { ...res, method: 'browser' };
}

/**
 * Saves an A4 document as a real (vector, searchable) PDF under
 * Documents/KamaiPlus/<folder>. Outside Electron it opens the print dialog,
 * where "Save as PDF" produces the same file.
 */
export async function saveHtmlAsPdf(
  html: string,
  fileName: string,
  folder: 'Invoices' | 'Reports' | 'Statements'
): Promise<DesktopResult & { method: 'desktop' | 'browser' }> {
  const api = getDesktopApi();
  if (api) {
    const res = await api.printToPdf({ html, fileName, folder });
    return { ...res, method: 'desktop' };
  }
  const res = await printViaIframe(html);
  return { ...res, method: 'browser' };
}

export function safeFileName(value: string, fallback: string): string {
  const cleaned = (value || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}
