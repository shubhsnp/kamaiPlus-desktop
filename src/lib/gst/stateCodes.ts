// Official GST state / UT codes (first two digits of every GSTIN).
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

/** "27AAACA1234F1Z8" -> "27", or '' when the GSTIN is missing or malformed. */
export function stateCodeFromGstin(gstin?: string | null): string {
  const code = (gstin || '').trim().slice(0, 2);
  return /^\d{2}$/.test(code) ? code : '';
}

export function stateNameFromCode(code: string): string {
  return GST_STATE_CODES[code] || '';
}

/** Place-of-supply label in the same "27 (Maharashtra)" form the Android invoice prints. */
export function placeOfSupplyLabel(code: string): string {
  if (!code) return '';
  const name = stateNameFromCode(code);
  return name ? `${code} (${name})` : code;
}

export function placeOfSupplyFromGstin(gstin?: string | null): string {
  return placeOfSupplyLabel(stateCodeFromGstin(gstin));
}
