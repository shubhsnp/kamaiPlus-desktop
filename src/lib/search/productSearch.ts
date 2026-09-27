/*
 * Product search in English letters for Hindi / Marathi names (v4.73.0), and the other
 * way round: "chitput" finds "चीटपुट", "rocket" finds "रॉकेट", "silver" finds "सिल्व्हर".
 *
 * Every word becomes a sound key: its consonants, similar sounds merged (ट/त/th → t,
 * श/ष/स/sh → s, फ/f/ph → p, ग/ज/g/z → j, व/w → v, …), plus a mark when it starts with a
 * vowel (अनार = anar ≠ नर). A query word matches when its key starts a name word's key,
 * or runs on into the next words ("atombomb" finds "अटॅम बॉम्ब"); all query words must
 * match, in any order. Vowels are not needed to match — English spelling of Indian words
 * never agrees on them (silver = सिल्वर = "silvar") — they only rank the results, and the
 * "a" sound (written or not: chaurasa / chaursa) is left out even there: "chaurasa" puts
 * चौरसा (o) above चिअर्स (i).
 */

const DEVA_CONSONANT: Record<string, string> = {
  'क': 'k', 'ख': 'k', 'ग': 'j', 'घ': 'j', 'ङ': 'n',
  'च': 'c', 'छ': 'c', 'ज': 'j', 'झ': 'j', 'ञ': 'n',
  'ट': 't', 'ठ': 't', 'ड': 'd', 'ढ': 'd', 'ण': 'n',
  'त': 't', 'थ': 't', 'द': 'd', 'ध': 'd', 'न': 'n',
  'प': 'p', 'फ': 'p', 'ब': 'b', 'भ': 'b', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 's', 'ष': 's', 'स': 's', 'ह': 'h',
  // One-character nukta letters: ऩ ऱ ऴ क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़
  'ऩ': 'n', 'ऱ': 'r', 'ऴ': 'l',
  'क़': 'k', 'ख़': 'k', 'ग़': 'j', 'ज़': 'j', 'ड़': 'd', 'ढ़': 'd', 'फ़': 'p', 'य़': 'y',
};
// Independent vowels and vowel signs → i / u / e / o; the "a" sounds → '' (ॅ ॲ ऍ are the
// Marathi "a" of English words: कॅप्स = caps, मॅजिक = magic).
const DEVA_VOWEL: Record<string, string> = {
  'अ': '', 'आ': '', 'ा': '', 'ॲ': '', 'ऍ': '', 'ॅ': '',
  'इ': 'i', 'ई': 'i', 'ि': 'i', 'ी': 'i',
  'उ': 'u', 'ऊ': 'u', 'ु': 'u', 'ू': 'u',
  'ए': 'e', 'े': 'e', 'ऐ': 'e', 'ै': 'e', 'ऎ': 'e', 'ॆ': 'e',
  'ओ': 'o', 'ो': 'o', 'औ': 'o', 'ौ': 'o', 'ऑ': 'o', 'ॉ': 'o', 'ऒ': 'o', 'ॊ': 'o',
};
const HALANT = '्';
const VOWEL_START = '_';

function isLatinVowel(ch: string | undefined): boolean {
  return ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u';
}
/** y / w are consonants before a vowel (yali, flower, white), vowels otherwise (baby, show). */
function isLatinVowelAt(w: string, j: number): boolean {
  const ch = w[j];
  if (isLatinVowel(ch)) return true;
  if (ch !== 'y' && ch !== 'w') return false;
  return !(isLatinVowel(w[j + 1]) || (w[j + 1] === 'h' && isLatinVowel(w[j + 2])));
}
function latinVowelClass(run: string): string {
  const r = run.replace(/y/g, 'i').replace(/w/g, 'u');
  switch (r) {
    case 'a': case 'aa': return '';
    case 'i': case 'ii': case 'ee': case 'ea': case 'ie': return 'i';
    case 'u': case 'uu': case 'oo': case 'eu': return 'u';
    case 'e': case 'ai': case 'ei': return 'e';
    case 'o': case 'au': case 'ao': case 'ou': case 'oa': return 'o';
    default: return r.replace(/a/g, '');
  }
}

interface SoundKey {
  c: string; // consonant key (+ vowel-start mark) — decides the match
  v: string; // vowel pattern without "a" — only ranks
}

function soundKey(word: string): SoundKey {
  const w = word.toLowerCase();
  let c = '';
  let v = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    const next = w[i + 1];
    const code = ch.charCodeAt(0);

    if (code >= 0x0900 && code <= 0x097f) {
      if (code >= 0x0966 && code <= 0x096f) { c += String(code - 0x0966); continue; } // ०–९
      if (ch === 'ऋ' || ch === 'ृ') { c += 'r'; v += 'i'; continue; }
      if (ch === 'ं' || ch === 'ँ') { c += 'n'; continue; }
      if (ch === 'ॐ') { c += (i === 0 ? VOWEL_START : '') + 'm'; v += 'o'; continue; }
      const vowel = DEVA_VOWEL[ch];
      if (vowel !== undefined) {
        if (i === 0) c += VOWEL_START;
        v += vowel;
        continue;
      }
      let cons = DEVA_CONSONANT[ch];
      if (!cons) continue; // halant, nukta, visarga, marks
      if (ch === 'ज' && next === HALANT && w[i + 2] === 'ञ') { cons = 'jy'; i += 2; } // ज्ञ = gya / dnya
      if (cons === 'h' && i > 0) cons = ''; // ह counts only at the start (व्हाइट = white)
      // Marathi writes the English "u" after a consonant as ्यु (ज्युपिटर = Jupiter).
      if (ch === 'य' && w[i - 1] === HALANT && (next === 'ु' || next === 'ू')) cons = '';
      c += cons;
      continue;
    }

    if (ch >= '0' && ch <= '9') { c += ch; continue; }
    if (ch < 'a' || ch > 'z') continue;
    if (isLatinVowelAt(w, i)) {
      let end = i;
      while (end < w.length && isLatinVowelAt(w, end)) end++;
      const run = w.slice(i, end);
      if (i === 0) c += VOWEL_START;
      if (run === 'e' && end === w.length && i > 1) { /* silent final e: candle, tube */ }
      else if (run === 'e' && end === w.length - 1 && w[end] === 'r') { /* silver = सिल्वर */ }
      else v += latinVowelClass(run);
      i = end - 1;
      continue;
    }
    switch (ch) {
      case 'h': if (i === 0) c += 'h'; break; // ph, sh, th, kh, bh… → the consonant alone
      case 'y': c += 'y'; break;
      case 'w': c += 'v'; break;
      case 'c':
        if (next === 'h') c += 'c';
        else if (next === 'k') { /* ck → k */ }
        else if (next === 'e' || next === 'i' || next === 'y') c += 's'; // pencil
        else c += 'k';
        break;
      case 't': c += next === 'i' && w[i + 2] === 'o' ? 's' : 't'; break; // station
      case 'q': c += 'k'; break;
      case 'x': c += 'ks'; break;
      case 'f': c += 'p'; break;
      case 'g': case 'z': c += 'j'; break;
      default: c += ch;
    }
  }
  // m before p / b sounds as n (कंपनी = company = kampani); then no doubled letters.
  c = c.replace(/m(?=[pb])/g, 'n');
  let key = '';
  for (let i = 0; i < c.length; i++) if (c[i] !== key[key.length - 1]) key += c[i];
  return { c: key, v };
}

/** Consonant sound key of one word (exported for the test suite). */
export function wordSoundKey(word: string): string {
  return soundKey(word).c;
}

const WORD_SPLIT = /[^0-9a-zऀ-ॿ]+/;
function words(text: string): string[] {
  return text.toLowerCase().split(WORD_SPLIT).filter(Boolean);
}

/** Sound keys of every word in a text. */
export function soundKeys(text: string): string[] {
  return words(text).map(wordSoundKey).filter(Boolean);
}

// For each word of a name: its own key, and the key of the name from that word on
// ("अटॅम बॉम्ब" → "अटॅमबॉम्ब"), so a query word may run on into the next words.
type NameIndex = { word: SoundKey; rest: SoundKey }[];
const indexCache = new Map<string, NameIndex>();
function nameIndex(text: string): NameIndex {
  let hit = indexCache.get(text);
  if (!hit) {
    if (indexCache.size > 20000) indexCache.clear();
    const ws = words(text);
    hit = ws.map((word, i) => ({ word: soundKey(word), rest: soundKey(ws.slice(i).join('')) }));
    indexCache.set(text, hit);
  }
  return hit;
}

export interface ProductQuery {
  text: string;      // lower-case, trimmed
  keys: SoundKey[];  // one per word
}

export function makeProductQuery(query: string): ProductQuery {
  const text = query.toLowerCase().trim();
  const keys = text.length >= 2 ? words(text).map(soundKey).filter((k) => k.c) : [];
  return { text, keys };
}

/**
 * -1 no match, else a penalty (lower = better) summed over the query words: +4 vowels
 * differ, +2 only when run on into the next word, +1 not the name's first word.
 */
function soundMatch(q: ProductQuery, text: string | undefined | null): number {
  if (!text || q.keys.length === 0) return -1;
  const index = nameIndex(text);
  let total = 0;
  for (const qk of q.keys) {
    let best = -1;
    for (let w = 0; w < index.length; w++) {
      const { word, rest } = index[w];
      let p: number;
      if (word.c.indexOf(qk.c) === 0) p = word.v.indexOf(qk.v) === 0 ? 0 : 4;
      else if (rest.c.indexOf(qk.c) === 0) p = (rest.v.indexOf(qk.v) === 0 ? 0 : 4) + 2;
      else continue;
      if (w > 0) p += 1;
      if (best < 0 || p < best) best = p;
    }
    if (best < 0) return -1;
    total += best;
  }
  return total;
}

export interface SearchableProduct {
  name: string;
  barcode?: string | null;
  category_name?: string | null;
}

/**
 * How well a product matches (lower is better; -1 = no match): 0 the name or barcode
 * contains the typed text (the old search); 1 + penalty the name sounds alike; with
 * `category`, 1.5 (+ penalty) the category contains / sounds like it — just after an
 * equally good name match.
 */
export function productSearchScore(p: SearchableProduct, q: ProductQuery, opts: { category?: boolean } = {}): number {
  if (!q.text) return 0;
  if (p.name.toLowerCase().includes(q.text) || (p.barcode && p.barcode.toLowerCase().includes(q.text))) return 0;
  const byName = soundMatch(q, p.name);
  let best = byName >= 0 ? 1 + byName : -1;
  if (opts.category && p.category_name) {
    const byCategory = p.category_name.toLowerCase().includes(q.text) ? 0 : soundMatch(q, p.category_name);
    if (byCategory >= 0 && (best < 0 || 1.5 + byCategory < best)) best = 1.5 + byCategory;
  }
  return best;
}

/** The matching products, best first (the old order kept within each group). */
export function searchProducts<T extends SearchableProduct>(products: T[], query: string, opts: { category?: boolean } = {}): T[] {
  const q = makeProductQuery(query);
  if (!q.text) return products;
  const scored: { p: T; s: number; i: number }[] = [];
  products.forEach((p, i) => {
    const s = productSearchScore(p, q, opts);
    if (s >= 0) scored.push({ p, s, i });
  });
  scored.sort((a, b) => a.s - b.s || a.i - b.i);
  return scored.map((x) => x.p);
}
