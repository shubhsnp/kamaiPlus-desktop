import { Product, PurchaseBillLineItem } from '@/types';

// Letters and digits in English and the Indian scripts (U+0900–U+0DFF: Devanagari … Sinhala).
const NOT_NAME_CHAR = new RegExp(`[^a-z0-9${String.fromCharCode(0x0900)}-${String.fromCharCode(0x0dff)}\\s]`, 'gi');

/**
 * Normalizes text for clean fuzzy token comparison. Indian scripts (Devanagari and the
 * other Indic blocks, with their vowel signs) are kept — `\w` alone turned every Hindi
 * name into "" and matched it to the first Hindi-named product (fixed v4.77.0).
 */
export function normalizeName(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(NOT_NAME_CHAR, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pack units written many ways on bills: "1 Ltr", "1L", "1 litre" are the same size.
const UNIT_ALIASES: Record<string, string> = {
  l: 'l', lt: 'l', ltr: 'l', ltrs: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  ml: 'ml', mls: 'ml', kg: 'kg', kgs: 'kg', kilo: 'kg', g: 'g', gm: 'g', gms: 'g', gr: 'g', gram: 'g', grams: 'g',
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', m: 'm', mtr: 'm', mtrs: 'm', meter: 'm', metre: 'm',
};

/**
 * A name split into its size ("500 ml", "1 l") and its words, for matching bill lines to items.
 * Exported for the tests.
 */
export function nameParts(text: string): { words: string[]; size: string } {
  const prepared = (text || '').replace(/(\d)[.,](\d)/g, '$1p$2'); // 1.5 kg keeps its point
  const tokens = normalizeName(prepared)
    .replace(/(\d)(?!p\d)([a-z])/g, '$1 $2') // 500ml → 500 ml (but 1p5 = 1.5 stays one number)
    .replace(/([a-z])(?<!\dp)(\d)/g, '$1 $2')
    .split(' ')
    .filter(Boolean);
  const size: string[] = [];
  const words: string[] = [];
  tokens.forEach((t, i) => {
    if (/^\d+(p\d+)?$/.test(t)) {
      const unit = UNIT_ALIASES[tokens[i + 1]] || '';
      size.push(t.replace(/^0+(?=\d)/, '') + unit);
    } else if (UNIT_ALIASES[t] && i > 0 && /^\d+(p\d+)?$/.test(tokens[i - 1])) {
      // the unit of the number before it — already in `size`
    } else if (t.length > 1) {
      words.push(t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t); // biscuits = biscuit
    }
  });
  return { words: Array.from(new Set(words)), size: size.sort().join(' ') };
}

/**
 * How well a bill line's name fits a saved item (0 = not the same item), v4.100.0 (K-D32).
 * Before, half the words in common was enough: "Sesame Oil 500 ml" went to "Coconut Oil 500 ml"
 * and its stock landed on the wrong item. Now the size must be the same and every word of the
 * shorter name must be in the longer one ("Sunflower Oil 1 L" = "Fortune Sunflower Oil 1 Ltr").
 */
export function nameMatchScore(a: string, b: string): number {
  const pa = nameParts(a);
  const pb = nameParts(b);
  if (pa.size !== pb.size) return 0;
  const [short, long] = pa.words.length <= pb.words.length ? [pa.words, pb.words] : [pb.words, pa.words];
  if (short.length === 0) return 0;
  const longSet = new Set(long);
  if (!short.every((w) => longSet.has(w))) return 0;
  return short.length / long.length;
}

/**
 * Enriches extracted bill line items by fuzzy matching against existing products in local inventory
 */
export function matchExtractedItemsWithProducts(
  extractedItems: PurchaseBillLineItem[],
  existingProducts: Product[]
): PurchaseBillLineItem[] {
  // A variant parent holds no stock of its own — its sizes / colours are matched instead.
  const candidates = existingProducts.filter((p) => !p.has_variants);
  return extractedItems.map((item) => {
    let bestMatch: Product | null = null;
    let highestScore = 0;
    const itemName = normalizeName(item.raw_name);
    const itemCode = (item.barcode || '').trim();

    // 0. The bill's barcode finds the saved item even when the supplier names it differently.
    const byCode = itemCode ? candidates.find((p) => p.barcode?.trim() === itemCode) : undefined;
    if (byCode) {
      bestMatch = byCode;
      highestScore = 1.0;
    }

    let tie = false;
    for (const product of byCode ? [] : candidates) {
      // 1. Direct name match (an empty name never matches)
      if (itemName && normalizeName(product.name) === itemName) {
        bestMatch = product;
        highestScore = 1.0;
        tie = false;
        break;
      }

      // 2. Barcode match if present
      if (product.barcode && product.barcode === item.raw_name) {
        bestMatch = product;
        highestScore = 1.0;
        tie = false;
        break;
      }

      // 3. Same item written differently (same size, the shorter name's words all in the longer)
      const score = nameMatchScore(product.name, item.raw_name);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = product;
        tie = false;
      } else if (score > 0 && score === highestScore) {
        tie = true;
      }
    }
    // Two saved items fit equally well: the shop picks (a wrong guess puts stock on the wrong item).
    if (tie) bestMatch = null;

    if (bestMatch) {
      return {
        ...item,
        matched_product_id: bestMatch.id,
        is_new_product: false,
        selling_price: item.selling_price || bestMatch.selling_price,
        unit: item.unit || bestMatch.unit,
      };
    }

    return {
      ...item,
      matched_product_id: undefined,
      is_new_product: true,
    };
  });
}
