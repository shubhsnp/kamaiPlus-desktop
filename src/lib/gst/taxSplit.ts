/**
 * CGST + SGST of an intra-state tax amount (v4.99.0, tracker K-D40).
 *
 * Split the TOTAL of a row — an HSN row, one rate of one invoice, a B2C state row, one bill
 * for Tally — never each bill line before adding up. Splitting every line with
 * `round(tax / 2)` gave the odd half-paisa to CGST every time, so over a month CGST ran ahead
 * of SGST by up to a paisa per line (demo shop, HSN 0713: CGST ₹16.31, SGST ₹16.27).
 *
 * The halves are equal; an odd paisa goes to CGST, so they differ by at most one paisa and
 * always add up to the tax exactly.
 */
export function splitIntraStateTax(taxPaise: number): { cgst: number; sgst: number } {
  const cgst = Math.round(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst };
}
