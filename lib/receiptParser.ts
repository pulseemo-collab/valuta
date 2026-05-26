// Receipt-specific text parser.
// Different from parseExpense (natural language) — this handles structured receipt OCR output.

import { parseExpense, type ParsedExpense } from '@/lib/parseExpense';
import type { Currency, CategoryId } from '@/types';

export interface ReceiptParseResult {
  parsed: ParsedExpense;
  merchantName: string;
  items: string[];
  summary: string;
  uncertainAmount: boolean;
  itemsConfidence: boolean;
}

function localDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// Handles European (1.250,50), US (1,250.50), and plain (1250) number formats.
function parseAmountStr(s: string): number | null {
  let n = s.replace(/[\s']/g, '');
  if (!n) return null;

  const hasComma = n.includes(',');
  const hasPeriod = n.includes('.');

  if (hasComma && hasPeriod) {
    const lastComma = n.lastIndexOf(',');
    const lastPeriod = n.lastIndexOf('.');
    if (lastComma > lastPeriod) {
      // European: 1.250,50 → remove thousands period, decimal comma → .
      n = n.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,250.50 → remove thousands comma
      n = n.replace(/,/g, '');
    }
  } else if (hasComma) {
    const afterComma = n.slice(n.lastIndexOf(',') + 1);
    if (afterComma.length <= 2) {
      n = n.replace(',', '.'); // decimal comma
    } else {
      n = n.replace(/,/g, ''); // thousands comma
    }
  } else if (hasPeriod) {
    const afterPeriod = n.slice(n.lastIndexOf('.') + 1);
    if (afterPeriod.length === 3) {
      n = n.replace(/\./g, ''); // thousands period (Albanian style)
    }
    // else: normal decimal period — keep as-is
  }

  const result = parseFloat(n);
  return isNaN(result) || result <= 0 ? null : result;
}

// Extract the last (rightmost) number from a line — where the price column typically sits.
function extractLineAmount(line: string): number | null {
  const matches = [...line.matchAll(/[\d][\d\s,.']{0,14}(?:[,.]\d{1,2})?/g)];
  if (matches.length === 0) return null;
  return parseAmountStr(matches[matches.length - 1][0].trim());
}

// Lines whose total-label should be IGNORED — subtotals, tax amounts, intermediate sums.
// Check the WHOLE line so "Totali pa TVSH: 1200" is excluded even though it starts with "totali".
const SKIP_TOTAL_RE = /\b(?:pa\s+tvsh|pa\s+vat|tvsh|vat|tatim|n[eë]ntotal|nentotal|subtotal|subgj|para\s+tvsh|ex[ct]\.?\s*tax|neto\b|bruto\b)\b/i;

// High-priority labels — these are the definitive "amount owed" lines.
// SKIP_TOTAL_RE is always checked first, so "Totali pa TVSH" is already excluded before reaching here.
const IS_PRIORITY_TOTAL = /\b(?:total[i]?\s+lek[ëe]?|shum[aë]\s+totale?|vlera\s+totale?|p[ëe]r\s+t[u']\s*u?\s*paguar|gjithsej\s+lek[ëe]?|total\s+i\s+paguar|shuma\s+finale?|shumë\s+e\s+paguar|total\s+lek[ëe]?)\b/i;

// General total labels — fallback if no priority label found.
const IS_GENERAL_TOTAL = /\b(?:total[i]?|gjithsej|paguar|vlera\b|grand\s*total|kjo\s+fatur[ëe])\b/i;

// Merchant name → category hints based on store name or top-of-receipt keywords.
const MERCHANT_CATEGORY: Array<{ re: RegExp; category: CategoryId }> = [
  {
    re: /\b(?:big\s*market|conad|spar|lidl|mega\s*market|euromax|albsupermarket|neptun\s*market|mirakel|market|supermarket|dyqan\s+ushqimor|minimarket|food\s*store|albfood)\b/i,
    category: 'ushqim',
  },
  {
    re: /\b(?:farmaci|apoteke?|barnator[e]?|pharmacy|laborator|klinik|spital|poliklinik|dentist|mjekësor)\b/i,
    category: 'shendet',
  },
  {
    re: /\b(?:kastrati|agip|shell|bp\b|total\s*oil|fuel|nafto|benzino|karburant|petrol|gas\s*station)\b/i,
    category: 'transport',
  },
  {
    re: /\b(?:vodafone|albtelecom|ipko|one\s*teleco|telekomi|oshee|elektrik|ujsj|albgaz|kesh\b|abkons)\b/i,
    category: 'faturat',
  },
  {
    re: /\b(?:pizza|burger|restorant|restaurant|fast\s*food|kafe|caffe|cafe|bar\b|doner|kebab|expres|bistro)\b/i,
    category: 'ushqim',
  },
  {
    re: /\b(?:mall|fashion|style\b|zara|h&m|bershka|shop\b|dyqan\s+veshjesh|kepuc[ëe]|rroberia|sports\s+direct|decathlon)\b/i,
    category: 'shopping',
  },
  {
    re: /\b(?:gym|fitness|palestër|palestere|sport\s+club|swimming|piscin)\b/i,
    category: 'shendet',
  },
];

// Words that should disqualify a line from being treated as a receipt item.
const SKIP_ITEM_RE = /^\s*(?:produkti|artikulli|sasia|çmimi|cmimi|vlera|total|gjithsej|tvsh|tatim|n[eë]ntotal|subtotal|nipt|nui|tel:|fax:|www\.|data\b|ora\b|operatori|kasier|kasa\b|ref\.|nr\.|fatura\b|leke?|lekë|all\b|paguar|pagesa\b|shuma|kart[eë]\b|cash\b|faleminderit|blerësi|bleres|adresë|adrese|qyteti|tiranë|tirane|kontrata|kuponi|fiskale|nr\s+fiskal)\b/i;

// Strip leading quantities, trailing product codes, and OCR noise from a candidate name.
function cleanItemName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^\d+\s*[xX×]\s*/, '');
  name = name.replace(/\s+[A-Z]{1,3}\d{3,}\S*\s*$/, '');
  name = name.replace(/[\*\|#@]+.*$/, '');
  name = name.replace(/\s{2,}/g, ' ').trim();
  return name;
}

// Infer category from item names when merchant-based detection fails.
function inferCategoryFromItems(items: string[]): CategoryId | null {
  if (items.length === 0) return null;
  const text = items.join(' ').toLowerCase();
  if (/qum[eë]sht|buk[eë]\b|kos\b|djath[eë]|vaj\b|miell\b|sheqer|krip[eë]|vez[eë]|mish\b|pule\b|peshk\b|fruta\b|perime\b|makarona|oriz\b|birr[eë]?|ver[eë]\b|uj[eë]\b|l[eë]ng\b|[cç]aj\b|[cç]okollatë?|biskota|kaf[eë]\b|jogurt|tomat[eë]?|patate/.test(text)) {
    return 'ushqim';
  }
  if (/aspirinë?|ibuprofen|paracetamol|vitaminë?|antibiotik|serum\b|shampo|sapun\b|garzë?|medikament|ilaç|ilac\b|pastile?/.test(text)) {
    return 'shendet';
  }
  if (/benzinë?|naftë?|karburant|motorinë?|diesel/.test(text)) {
    return 'transport';
  }
  return null;
}

// Extract product names from the middle section of the receipt (between header and totals).
function extractItems(lines: string[], totalLineIdx: number): string[] {
  const startIdx = Math.min(6, Math.floor(lines.length * 0.2));
  const endIdx = Math.min(totalLineIdx, lines.length);
  const items: string[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (line.length < 4 || line.length > 70) continue;
    if (SKIP_TOTAL_RE.test(line)) continue;
    if (IS_PRIORITY_TOTAL.test(line) || IS_GENERAL_TOTAL.test(line)) continue;
    if (SKIP_ITEM_RE.test(line)) continue;

    // Must start with a letter (product name starts with a word, not a barcode/number)
    if (!/^[a-zA-ZÀ-ÿ]/.test(line)) continue;
    // Must contain at least one digit (item has a price)
    if (!/\d/.test(line)) continue;

    // Extract the name portion — text before the first number cluster after whitespace
    const nameMatch = line.match(/^([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9%\s\-\/\.&'°]{2,40}?)(?:\s{2,}|\t|\s+\d)/);
    if (!nameMatch) continue;

    const name = cleanItemName(nameMatch[1]);
    if (name.length < 3) continue;
    if (SKIP_ITEM_RE.test(name)) continue;

    items.push(name);
    if (items.length >= 5) break;
  }

  return items;
}

export function parseReceiptText(rawText: string): ReceiptParseResult {
  const empty: ReceiptParseResult = {
    parsed: {
      amount: null, currency: 'ALL', category: 'tjera', note: '',
      date: localDateStr(), detectedAmount: false, detectedCurrency: false,
      detectedCategory: false, detectedDate: false, confidence: 0,
    },
    merchantName: '',
    items: [],
    summary: '',
    uncertainAmount: false,
    itemsConfidence: false,
  };

  if (!rawText || !rawText.trim()) return empty;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // ── 1. Currency ──────────────────────────────────────────────────────────────
  let currency: Currency = 'ALL';
  let detectedCurrency = false;

  if (/\b(?:euro?|eur|evro)\b|€/i.test(rawText)) {
    currency = 'EUR'; detectedCurrency = true;
  } else if (/\b(?:dollar|dolar|usd)\b|\$/i.test(rawText)) {
    currency = 'USD'; detectedCurrency = true;
  } else if (/\b(?:lek[ëe]?|all)\b/i.test(rawText)) {
    currency = 'ALL'; detectedCurrency = true;
  }

  // ── 2. Total amount — prioritized detection ───────────────────────────────────
  //
  // Strategy: prefer labels like "TOTAL LEK", "SHUMA TOTALE", "PËR T'U PAGUAR".
  // Exclude lines containing "pa TVSH", "TVSH", "TATIM", "NËNTOTAL", "SUBTOTAL".
  // Among matching lines, take the LAST one (deepest in receipt = final payable total).
  // This avoids the bug where the largest amount was picked, which could be a subtotal.

  let amount: number | null = null;
  let detectedAmount = false;
  let uncertainAmount = false;
  let totalLineIdx = lines.length;

  // Pass 1: high-priority label lines (definitive totals)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_TOTAL_RE.test(line)) continue;
    if (!IS_PRIORITY_TOTAL.test(line)) continue;
    const candidate = extractLineAmount(line);
    if (candidate !== null) {
      // Keep going — take the LAST priority match (bottom of receipt)
      amount = candidate;
      detectedAmount = true;
      totalLineIdx = i;
    }
  }

  // Pass 2: general total labels (only if no priority label matched)
  if (!detectedAmount) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (SKIP_TOTAL_RE.test(line)) continue;
      if (!IS_GENERAL_TOTAL.test(line)) continue;
      const candidate = extractLineAmount(line);
      if (candidate !== null) {
        amount = candidate;
        detectedAmount = true;
        totalLineIdx = i;
        uncertainAmount = true; // general label — less confident
      }
    }
  }

  // Pass 3: standalone number line from bottom (no label match at all)
  if (!detectedAmount) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (SKIP_TOTAL_RE.test(line)) continue;
      const m = line.match(/^[^\d]*([\d][\d\s,.']{0,14}(?:[,.]\d{1,2})?)\s*(?:lek[ëe]?|all|€|\$)?$/i);
      if (m) {
        const candidate = parseAmountStr(m[1]);
        if (candidate !== null && candidate >= 50) {
          amount = candidate;
          detectedAmount = true;
          totalLineIdx = i;
          uncertainAmount = true;
          break;
        }
      }
    }
  }

  // Last resort: largest plausible number
  if (!detectedAmount) {
    let best: number | null = null;
    for (const m of rawText.matchAll(/\b(\d[\d\s,.']{0,12})\b/g)) {
      const n = parseAmountStr(m[1]);
      if (n !== null && n >= 1 && n <= 9_999_999 && (best === null || n > best)) best = n;
    }
    if (best !== null) {
      amount = best;
      detectedAmount = true;
      uncertainAmount = true;
    }
  }

  // ── 3. Date ──────────────────────────────────────────────────────────────────
  let date = localDateStr();
  let detectedDate = false;

  const dmyMatch = rawText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!isNaN(new Date(candidate).getTime())) { date = candidate; detectedDate = true; }
  }
  if (!detectedDate) {
    const ymdMatch = rawText.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch;
      const candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (!isNaN(new Date(candidate).getTime())) { date = candidate; detectedDate = true; }
    }
  }

  // ── 4. Merchant name ─────────────────────────────────────────────────────────
  let merchantName = '';
  const headerLines = lines.slice(0, 6).filter(l =>
    l.length >= 3 &&
    !/^\d+$/.test(l) &&
    !/^(?:nipt|nui|tvsh|vat|tel:|fax:|www\.|http)/i.test(l)
  );
  if (headerLines.length > 0) merchantName = headerLines[0].slice(0, 50);

  // ── 5. Category — merchant hints first, keyword table as fallback ─────────────
  let category: CategoryId = 'tjera';
  let detectedCategory = false;

  // Check top ~200 chars (header) against known merchant patterns
  const headerText = rawText.slice(0, 200);
  for (const { re, category: cat } of MERCHANT_CATEGORY) {
    if (re.test(merchantName) || re.test(headerText)) {
      category = cat;
      detectedCategory = true;
      break;
    }
  }

  if (!detectedCategory) {
    const local = parseExpense(rawText);
    if (local.detectedCategory) {
      category = local.category;
      detectedCategory = true;
    }
  }

  // ── 6. Item extraction ────────────────────────────────────────────────────────
  const items = extractItems(lines, totalLineIdx);

  // Item-based category refinement — fires when merchant detection didn't lock a category.
  if (!detectedCategory || category === 'tjera') {
    const itemCat = inferCategoryFromItems(items);
    if (itemCat) {
      category = itemCat;
      detectedCategory = true;
    }
  }

  const itemsConfidence = items.length > 0;

  // ── 7. Summary note ───────────────────────────────────────────────────────────
  let summary = '';
  if (merchantName && items.length > 0) {
    const itemList = items.slice(0, 5).map(n => n.toLowerCase()).join(', ');
    summary = `${merchantName}: ${itemList}`;
  } else if (merchantName) {
    summary = merchantName;
  } else if (items.length > 0) {
    summary = items.slice(0, 5).map(n => n.toLowerCase()).join(', ');
  }

  const confidence =
    (detectedAmount ? (uncertainAmount ? 0.35 : 0.5) : 0) +
    (detectedCategory ? 0.35 : 0) +
    (detectedCurrency ? 0.15 : 0);

  if (__DEV__) {
    console.log('[receiptParser] rawText:\n', rawText);
    console.log('[receiptParser] result:', { amount, currency, category, merchantName, items, summary, uncertainAmount, confidence });
  }

  return {
    parsed: {
      amount,
      currency,
      category,
      note: summary || merchantName,
      date,
      detectedAmount,
      detectedCurrency,
      detectedCategory,
      detectedDate,
      confidence,
    },
    merchantName,
    items,
    summary,
    uncertainAmount,
    itemsConfidence,
  };
}
