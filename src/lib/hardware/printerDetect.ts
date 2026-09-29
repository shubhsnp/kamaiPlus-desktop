/*
 * Printer auto-detect (v4.78.0), pure rules. The shop plugs in a printer and the app works
 * out what it is (receipt / label / A4) from its name and driver, ignores "printers" that
 * only make files (PDF, XPS, OneNote, Fax), picks it on its own when there is no doubt,
 * and otherwise asks once: "New printer found — use it for bills?".
 */

import type { PaperFormat } from '@/lib/desktop/desktopBridge';

export type PrinterKind = 'thermal' | 'label' | 'a4' | 'other';

export interface PrinterFacts {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  driver?: string;
  port?: string;
  status?: string;
  offline?: boolean;
}

/** Printers seen on this computer (localStorage) — a new one is asked about only once. */
export const KNOWN_PRINTERS_KEY = 'kamai_known_printers';

const VIRTUAL_NAME = /print to pdf|xps|onenote|\bfax\b|adobe pdf|pdf ?creator|pdf24|cutepdf|foxit|nitro pdf|dopdf|bullzip|document writer|snagit|anydesk|teamviewer|redirected/i;
const VIRTUAL_PORT = /^(portprompt:|nul:?|file:|shrfax:|xps|onenote)|\.pdf$/i;

// Label printers as Windows names them (queue + driver). v4.80.0: Zebra's own driver is
// "ZDesigner …"; Xprinter label models end in B (XP-365B — its receipt ones are XP-58, XP-80C);
// Retsol LS, Gprinter GP-1xxx / 2120 / 3120 / 9xxx, Rongta RP4xx, Bixolon SLP / XD, SNBC BTP-2xxx
// are the label lines of makers whose receipt printers the THERMAL list knows.
const LABEL = /\btsc\b|zebra|zdesigner|godex|argox|tvs[ -]?lp|\blp[ -]?4\d|\bttp[ -]?\d|label|citizen cl|honeywell[ -]?p[cdmx]\d|intermec|datamax|\bsato\b|brother ql|dymo|barcode printer|\bxp-?(dt|tt|h|p)?\d{3}b\b|retsol[ -]?ls|\bgp-?(1\d{3}|[23]120|9[01]\d{2})|rongta[ -]?rp?[ -]?4\d{2}|\bslp-|\bx[dtm]\d-\d{2}|\bbtp-?([23]\d{3}|l\d)|postek|hprt[ -]?(ht|hlp|sl)\d|idprt|wincode|\bzj-?9\d{3}/i;
// Receipt printers; checked after LABEL, so the broad Xprinter / Gprinter / SNBC / Zjiang model
// patterns (v4.80.0: XP-Q200, GP-80250N, BTP-R880NP, ZJ-5890 were "other") never catch a label model.
const THERMAL = /receipt|thermal|\bpos\b|\bpos[ -]?\d|tvs[ -]?rp|\brp[ -]?3\d{3}|epson tm|\btm-?[tmu]\d|\bxp-?[a-z]{0,2}\d{2,3}|\b(58|80) ?mm|star tsp|bixolon|\bsrp-|citizen ct|rugtek|retsol|posiflex|everycom|sewoo|rongta|gprinter|\bgp-?[a-z]?\d{2,5}|\bbtp-?[a-z]\d{2,3}|hprt[ -]?(tp|pp)|\bzj-?[58]\d{3}|hoin/i;
const A4 = /laserjet|deskjet|officejet|inkjet|\bhp\b|canon|brother (hl|dcp|mfc)|epson (l\d|m\d|wf|et|ecotank)|samsung|xerox|ricoh|kyocera|lexmark|pantum|sharp|konica|okidata/i;

const text = (p: PrinterFacts) => `${p.name} ${p.driver || ''}`;

/** A "printer" that only saves a file or sends somewhere else — never a bill printer. */
export function isVirtualPrinter(p: PrinterFacts): boolean {
  return VIRTUAL_NAME.test(text(p)) || VIRTUAL_PORT.test((p.port || '').trim());
}

/** Receipt, label or A4 — from the name and driver (label first: "TVS LP 46" is not a receipt printer). */
export function printerKind(p: PrinterFacts): PrinterKind {
  const t = text(p);
  if (LABEL.test(t)) return 'label';
  if (THERMAL.test(t)) return 'thermal';
  if (A4.test(t)) return 'a4';
  return 'other';
}

/** Roll width of a receipt printer: 58 mm only when it says so, else 80 mm (the common one). */
export function thermalFormat(p: PrinterFacts): PaperFormat {
  return /\b58\b|58 ?mm|xp-?58|pos-?58|gp-?58|zj-?58/i.test(text(p)) ? 'thermal-58' : 'thermal-80';
}

export type BillPrinterMismatch = 'label' | 'receipt-for-a4';

/**
 * A bill printer of the wrong kind (v4.80.0) — on the test PC the TSC label printer had been
 * chosen for bills, so every bill would print on the label roll. Only warned about: a printer
 * the shop chose is never switched.
 */
export function billPrinterMismatch(p: PrinterFacts, format: PaperFormat): BillPrinterMismatch | null {
  const kind = printerKind(p);
  if (kind === 'label') return 'label';
  if (format === 'a4' && kind === 'thermal') return 'receipt-for-a4';
  return null;
}

export interface BillPrinterChoice {
  defaultFormat: PaperFormat;
  a4Printer: string;
  thermalPrinter: string;
}

export interface PrinterReview {
  /** Names to remember as seen. */
  known: string[];
  /** Picked on its own — nothing was chosen and there is no doubt which printer it is. */
  bill?: { name: string; format: PaperFormat };
  label?: string;
  /** New real printers not picked on their own: ask the shop once. */
  fresh: PrinterFacts[];
}

/**
 * What to do with the printers Windows has now. `known` null = the first look on this
 * computer: printers already there are not "new", but a sure pick is still made.
 */
export function reviewPrinters(input: { known: string[] | null; printers: PrinterFacts[]; bill: BillPrinterChoice; labelPrinter: string }): PrinterReview {
  const { printers, bill, labelPrinter } = input;
  const firstLook = input.known === null;
  const known = new Set(input.known || []);
  const real = printers.filter((p) => !isVirtualPrinter(p));
  const isNew = (p: PrinterFacts) => firstLook || !known.has(p.name);
  const review: PrinterReview = { known: Array.from(new Set([...Array.from(known), ...printers.map((p) => p.name)])), fresh: [] };

  // Bill printer: only when none was ever chosen, and exactly one printer fits.
  if (!bill.thermalPrinter && !bill.a4Printer) {
    const thermals = real.filter((p) => printerKind(p) === 'thermal');
    const office = real.filter((p) => printerKind(p) === 'a4' || printerKind(p) === 'other');
    if (thermals.length === 1 && isNew(thermals[0])) {
      review.bill = { name: thermals[0].name, format: thermalFormat(thermals[0]) };
    } else if (thermals.length === 0 && office.length === 1 && isNew(office[0]) && bill.defaultFormat === 'a4') {
      review.bill = { name: office[0].name, format: 'a4' };
    }
  }
  if (!labelPrinter) {
    const labels = real.filter((p) => printerKind(p) === 'label');
    if (labels.length === 1 && isNew(labels[0])) review.label = labels[0].name;
  }
  if (!firstLook) {
    review.fresh = real.filter((p) => !known.has(p.name) && p.name !== review.bill?.name && p.name !== review.label);
  }
  return review;
}

export type PrinterHealth = 'ready' | 'offline' | 'missing' | 'default';

/** Chosen printer ('' = Windows default) against what Windows has now. */
export function printerHealth(chosen: string, printers: PrinterFacts[]): PrinterHealth {
  if (!chosen) return 'default';
  const found = printers.find((p) => p.name === chosen);
  if (!found) return 'missing';
  return found.offline ? 'offline' : 'ready';
}

/** Stored list → names (bad / missing → null = first look). */
export function parseKnownPrinters(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : null;
  } catch {
    return null;
  }
}

export type PrinterLine =
  | { state: 'ready' | 'offline' | 'missing'; name: string }
  | { state: 'default'; name: string; virtual: boolean; offline: boolean }
  | { state: 'none' | 'no-default' };

/** What the status bar says about a chosen printer ('' = Windows default). */
export function printerLine(chosen: string, printers: PrinterFacts[]): PrinterLine {
  if (printers.length === 0) return { state: 'none' };
  if (chosen) {
    const found = printers.find((p) => p.name === chosen);
    if (!found) return { state: 'missing', name: chosen };
    return { state: found.offline ? 'offline' : 'ready', name: found.displayName || found.name };
  }
  const def = printers.find((p) => p.isDefault);
  if (!def) return { state: 'no-default' };
  return { state: 'default', name: def.displayName || def.name, virtual: isVirtualPrinter(def), offline: Boolean(def.offline) };
}
