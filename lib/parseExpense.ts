import type { Currency, CategoryId, PersonalCategoryId } from '@/types';

// Duplicated here to keep the parser dependency-free (no React, no native modules).
function localDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export interface ParsedExpense {
  amount: number | null;
  currency: Currency;
  category: CategoryId;
  note: string;
  date: string; // YYYY-MM-DD local
  // Confidence flags — true when explicitly detected (not just defaulted)
  detectedAmount: boolean;
  detectedCurrency: boolean;
  detectedCategory: boolean;
  detectedDate: boolean;
  /** 0–1 overall confidence derived from detection flags. */
  confidence: number;
}

// ── Category keyword table ────────────────────────────────────────────────────
// Words/substrings that strongly imply a category. Order matters for scoring.
const CATEGORY_KEYWORDS: Record<PersonalCategoryId, string[]> = {
  ushqim: [
    'kafe', 'kafé', 'caffe', 'cappuccino', 'espresso', 'ekspres', 'latte',
    'fraps', 'frapé', 'frape', 'çaj', 'caj', 'smoothie',
    'restorant', 'restoran', 'restaurant',
    'drekë', 'dreke', 'darkë', 'darke', 'mëngjes', 'mengjes',
    'ushqim', 'supermarket', 'market', 'dyqan ushqimor', 'ushqimore',
    'verë', 'vere', 'birrë', 'birre', 'alkool', 'raki', 'konjak', 'pije',
    'byrek', 'pizza', 'burger', 'fruta', 'perime',
    'bukë', 'buke', 'qumësht', 'qumesht', 'djathë', 'djath', 'mish', 'peshk',
    'çokollatë', 'çokolate', 'akullore', 'kek', 'tortë', 'torte',
    'supe', 'sallatë', 'sallate', 'sanduiç', 'sanduic', 'snack',
    'bar', 'doner', 'kebab', 'lëng', 'leng', 'ujë', 'uje', 'mineral',
    'conad', 'lidl', 'spar', 'mega', 'euromax', 'albsupermarket',
    'ëmbëlsirë', 'embelsire', 'krisur',
  ],
  transport: [
    'taksi', 'taxi', 'uber', 'bolt', 'autobus', 'bus', 'metro', 'tren',
    'aeroplan', 'avion', 'biletë', 'bilete',
    'karburant', 'naftë', 'nafte', 'benzinë', 'benzine',
    'parking', 'makinë', 'makine', 'mjet',
    'autostradë', 'autostrade', 'rrugë', 'rruge',
    'ferry', 'tragjet', 'lundrim', 'skoter', 'bicikletë', 'biciklete', 'trotinet',
    'aerodrom', 'aeroport', 'fluturim', 'transfertë', 'transferte',
    'udhëtim', 'udhetim', 'transport',
  ],
  faturat: [
    'faturë', 'fature', 'faturat', 'fatura',
    'elektrik', 'dritë', 'drite', 'gaz',
    'internet', 'wifi', 'telefon', 'celular', 'cel',
    'qira', 'qera', 'hua', 'borxh',
    'abonim', 'abonament', 'sigurim',
    'taksë', 'takse', 'tvsh', 'tatim', 'tarifë', 'tarife',
    'shërbim', 'sherbim', 'mirëmbajtje', 'mirembajtje',
    'hipotekë', 'hipoteke', 'kredi', 'bankë', 'banke',
    'detyrim', 'kontribut', 'pagesa',
  ],
  shopping: [
    'dyqan', 'blerje', 'rroba', 'rrobë', 'bluzë', 'bluze',
    'pantallonë', 'pantalone', 'këpucë', 'kepuce', 'çantë', 'çante',
    'mall', 'shoping', 'shopping', 'veshjë', 'veshje', 'fashion',
    'aksesore', 'orë', 'ore', 'çorape', 'triko', 'pallto',
    'xhaketë', 'xhakete', 'xhinse', 'kolier', 'byzylyk', 'unazë', 'unaze',
    'libër', 'liber', 'parfum', 'kozmetikë', 'kozmetike',
    'shampo', 'sapun', 'krem', 'grims', 'makeup',
    'laptop', 'kufje', 'tablet', 'karikues', 'elektronikë', 'elektronike',
    'mobilë', 'mobilje', 'tavolinë', 'karrige', 'divan', 'shtrat', 'dekorim',
  ],
  shendet: [
    'farmaci', 'ilaç', 'ilac', 'ilaçe', 'barna', 'barnë', 'barne',
    'barnatore', 'apotekë', 'apoteke',
    'mjek', 'doktor', 'doktorë', 'spital', 'klinikë', 'klinike',
    'dentist', 'dhëmbë', 'dhembe', 'optik', 'syze',
    'vitamin', 'vitaminë', 'vitamine',
    'shëndet', 'shendet', 'masazh', 'massage',
    'gym', 'palestër', 'palestere', 'sport',
    'terapi', 'psikolog', 'analizë', 'analize', 'recetë', 'recete',
    'operacion', 'kontroll', 'vaksinë', 'vaksine',
  ],
  argetime: [
    'kino', 'kinema', 'film', 'teatër', 'teater', 'koncert',
    'muzikë', 'muzike', 'klubi', 'klub', 'diskotekë', 'diskotek',
    'netflix', 'spotify', 'youtube', 'prime', 'hbo', 'disney',
    'lojë', 'loje', 'lodër', 'lodra', 'lojra',
    'pushime', 'piknik', 'dhuratë', 'dhurate',
    'aheng', 'festë', 'feste', 'festim', 'zbavitje',
    'argëtim', 'argetim', 'biliard', 'bowling', 'karting',
    'eveniment', 'event', 'lagunë', 'lagune', 'pishinë', 'pishine',
    'plazh', 'beach', 'resort', 'hostel', 'airbnb',
    'playstation', 'xbox', 'gaming', 'game', 'subscription',
  ],
  biznes: [
    'zyrë', 'zyre', 'biznes', 'business',
    'furnizues', 'furnizim', 'kontratë', 'kontrate',
    'material', 'produkt', 'pajisje', 'klient',
    'mbledhje', 'konferencë', 'konference', 'takim',
    'sipërmarrje', 'sipermarre', 'kompani', 'firmë', 'firme',
    'printer', 'server', 'domain', 'hosting', 'softuer', 'software',
    'licencë', 'licence', 'marketing', 'reklamë', 'reklame',
    'logo', 'dizajn', 'design', 'zhvillim', 'programim',
    'kontabilist', 'avokat', 'noter', 'regjistrim',
  ],
  tjera: [
    'tjetër', 'tjeter', 'personale', 'familje', 'fëmijë', 'femije',
    'shtëpi', 'shtepi', 'dhomë', 'dhome',
    'donacion', 'bamirësi', 'bamiresi', 'kishë', 'kishe', 'xhami',
    'funeral', 'kurorë', 'kurore', 'martesë', 'martese', 'dasmë', 'dasme',
    'rimbursim', 'tjera',
  ],
};

// ── Currency detection patterns ────────────────────────────────────────────────
const EUR_RE = /\b(euro?|eur|evro)\b|€/i;
const USD_RE = /\b(dollar|dolar|usd)\b|\$/i;
// "lek", "leke", "lekë", "all" — but NOT standalone "l" (too aggressive)
const ALL_RE = /\b(lek[eë]?|all)\b/i;

// ── Date keyword patterns ─────────────────────────────────────────────────────
const DATE_PATTERNS: { re: RegExp; offset: number }[] = [
  { re: /\bpardje\b/i, offset: 2 },
  { re: /\bdje\b/i, offset: 1 },
  { re: /\bsot\b/i, offset: 0 },
  // "para 2 ditëve" / "para 2 dit"
  { re: /\bpara\s+2\s+dit/i, offset: 2 },
  { re: /\bpara\s+3\s+dit/i, offset: 3 },
];

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseExpense(raw: string): ParsedExpense {
  let text = raw.trim();
  const lower = text.toLowerCase();

  // ── 1. Currency ──────────────────────────────────────────────────────────
  let currency: Currency = 'ALL';
  let detectedCurrency = false;

  if (EUR_RE.test(lower)) {
    currency = 'EUR';
    detectedCurrency = true;
    text = text.replace(EUR_RE, '').replace(/€/g, '');
  } else if (USD_RE.test(lower)) {
    currency = 'USD';
    detectedCurrency = true;
    text = text.replace(USD_RE, '').replace(/\$/g, '');
  } else if (ALL_RE.test(lower)) {
    currency = 'ALL';
    detectedCurrency = true;
    text = text.replace(ALL_RE, '');
  }

  // ── 2. Date ──────────────────────────────────────────────────────────────
  let date = localDateStr();
  let detectedDate = false;

  for (const { re, offset } of DATE_PATTERNS) {
    if (re.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      date = localDateStr(d);
      detectedDate = true;
      text = text.replace(re, '');
      break;
    }
  }

  // ── 3. Amount ────────────────────────────────────────────────────────────
  // Match the first numeric token (supports comma/period decimals).
  // E.g. "1200", "15.5", "1,50", "3 000" (space-separated thousands ignored).
  let amount: number | null = null;
  let detectedAmount = false;

  const amountMatch = text.match(/\b(\d[\d\s]*(?:[,.]\d+)?)\b/);
  if (amountMatch) {
    // Remove internal spaces (thousands separator) and normalize decimal
    const normalized = amountMatch[1].replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
      detectedAmount = true;
      text = text.slice(0, amountMatch.index!) + text.slice(amountMatch.index! + amountMatch[0].length);
    }
  }

  // ── 4. Category ──────────────────────────────────────────────────────────
  const lowerFull = raw.toLowerCase(); // score against full original text for better matching
  let bestCategory: PersonalCategoryId = 'ushqim'; // default
  let bestScore = 0;
  let detectedCategory = false;

  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS) as [PersonalCategoryId, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerFull.includes(kw)) score += kw.length; // weight by length to prefer specific matches
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = catId;
    }
  }

  if (bestScore > 0) detectedCategory = true;

  // ── 5. Note ──────────────────────────────────────────────────────────────
  // Whatever text remains (after currency/date/amount removed) is the note.
  const note = text
    .replace(/[,.\-–—]/g, ' ') // clean stray punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Weighted confidence: amount matters most (0.5), then category (0.35), then currency (0.15).
  const confidence =
    (detectedAmount ? 0.5 : 0) +
    (detectedCategory ? 0.35 : 0) +
    (detectedCurrency ? 0.15 : 0);

  return {
    amount,
    currency,
    category: bestCategory,
    note,
    date,
    detectedAmount,
    detectedCurrency,
    detectedCategory,
    detectedDate,
    confidence,
  };
}
