// JANコードから商品名・メーカー・容量を外部データベースで調べる。
// 1. Yahoo!ショッピング 商品検索API（日本の商品に強い）
//    ただしこのAPIはサーバー間通信向けで、ブラウザから直接呼ぶとCORSで
//    ブロックされる環境がある（本アプリはサーバーを持たない静的サイトのため該当しうる）。
//    その場合は例外として捕まえ、黙って次の検索先へ進む。
// 2. Open Food Facts（食品）・Open Products Facts（日用品・洗剤など食品以外）
//    どちらもAPIキー不要・CORS許可済みの無料オープンデータベース。食品かどうかで
//    データが分かれているため、洗剤等は2を見る必要がある。
// 価格は取得しない（ネット通販の価格は近所の店頭価格とは別物のため）。

// 商品検索APIのClient ID（ID連携なし）。公開されても商品検索にしか使えない。
const YAHOO_APP_ID = 'dmVyPTIwMjUwNyZpZD1wNTJ4c2ZNNnFNJmhhc2g9TXpCbU16TTNZakExTm1RME1tRXhNZw';

export type LookupSource = 'yahoo' | 'openfoodfacts' | 'openproductsfacts';

export const LOOKUP_SOURCE_LABELS: Record<LookupSource, string> = {
  yahoo: 'Yahoo!ショッピング',
  openfoodfacts: 'Open Food Facts',
  openproductsfacts: 'Open Products Facts',
};

export interface ProductLookupResult {
  name: string;
  brand: string;
  volume: number | null;
  volumeUnit: string;
  source: LookupSource;
}

interface OffProduct {
  product_name_ja?: string;
  product_name?: string;
  generic_name_ja?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
}

const UNIT_ALIASES: Record<string, string> = {
  ml: 'ml',
  mℓ: 'ml',
  cl: 'cl',
  l: 'L',
  ℓ: 'L',
  g: 'g',
  kg: 'kg',
  個: '個',
  枚: '枚',
  本: '本',
  袋: '袋',
  ロール: 'ロール',
};

/** "1000 ml" "900ml" "1 L" "6 x 200 ml" などから容量を取り出す */
export function parseQuantity(text: string | undefined): { volume: number; unit: string } | null {
  if (!text) return null;
  const t = text.replace(/，/g, ',').replace(/．/g, '.').trim();
  const match = t.match(/(\d+(?:[.,]\d+)?)\s*(ml|mℓ|cl|l|ℓ|kg|g|個|枚|本|袋|ロール)(?![a-z])/i);
  if (!match) return null;
  let volume = Number(match[1].replace(',', '.'));
  let unit = UNIT_ALIASES[match[2].toLowerCase()] ?? UNIT_ALIASES[match[2]] ?? match[2];
  if (unit === 'cl') {
    volume *= 10;
    unit = 'ml';
  }
  if (!Number.isFinite(volume) || volume <= 0) return null;
  return { volume, unit };
}

function pickName(p: OffProduct): string {
  return (p.product_name_ja || p.product_name || p.generic_name_ja || '').trim();
}

/**
 * 通販の商品名から販促用の文言を取り除く。
 * 例: "【送料無料】明治 おいしい牛乳 900ml×6本 ケース" → "明治 おいしい牛乳 900ml"
 */
export function cleanShoppingItemName(raw: string): string {
  let s = raw.normalize('NFKC');
  s = s.replace(/[【\[［(（〔<＜《][^】\]］)）〕>＞》]*[】\]］)）〕>＞》]/g, ' ');
  s = s.replace(/[×x*]\s*\d+\s*(本|個|袋|パック|缶|箱|セット|ケース|入)?/gi, ' ');
  s = s.replace(/\d+\s*(本|個|袋|パック|缶|箱)\s*(セット|入り?)/g, ' ');
  s = s.replace(
    /(送料無料|送料込み?|ポイント\d*倍|まとめ買い|ケース販売|ケース|セット|あす楽|即日発送|在庫あり|お取り寄せ|最安値|激安|特価|クーポン[^ ]*|公式|正規品|代引[^ ]*)/g,
    ' ',
  );
  s = s.replace(/[★☆◆◇■□●○♪!！※・]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

interface YahooHit {
  name?: string;
  brand?: { name?: string };
}

async function lookupYahoo(jan: string, signal: AbortSignal): Promise<ProductLookupResult | null> {
  const url =
    'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch' +
    `?appid=${encodeURIComponent(YAHOO_APP_ID)}&jan_code=${encodeURIComponent(jan)}&results=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { hits?: YahooHit[] };
  const hits = (data.hits ?? []).filter((h) => h.name);
  if (hits.length === 0) return null;

  // 店ごとに名前がばらつくので、整形後いちばん短い名前を採用（販促文言が少ない）
  const names = hits.map((h) => cleanShoppingItemName(h.name ?? '')).filter((n) => n.length >= 2);
  if (names.length === 0) return null;
  const name = names.reduce((a, b) => (b.length < a.length ? b : a));

  // ブランドは最も多く出てくるものを採用
  const brandCounts = new Map<string, number>();
  for (const h of hits) {
    const b = h.brand?.name?.trim();
    if (b) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  }
  const brand = [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const parsed = parseQuantity(name) ?? names.map((n) => parseQuantity(n)).find((q) => q) ?? null;
  return {
    name,
    brand,
    volume: parsed?.volume ?? null,
    volumeUnit: parsed?.unit ?? '',
    source: 'yahoo',
  };
}

/**
 * Open Food Facts と、そのきょうだいプロジェクトである Open Products Facts（食品以外の日用品）は
 * 同じ Product Opener というソフトウェアで動いており、APIの形が共通。ホスト名だけ差し替えて使い回す。
 */
async function lookupOpenFactsFamily(
  host: string,
  source: 'openfoodfacts' | 'openproductsfacts',
  jan: string,
  signal: AbortSignal,
): Promise<ProductLookupResult | null> {
  const url =
    `https://${host}/api/v2/product/${encodeURIComponent(jan)}.json` +
    '?fields=product_name,product_name_ja,generic_name_ja,brands,quantity,product_quantity,product_quantity_unit';
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const name = pickName(p);
  const brand = (p.brands ?? '').split(',')[0]?.trim() ?? '';
  const parsed =
    parseQuantity(p.quantity) ??
    (p.product_quantity && p.product_quantity_unit
      ? parseQuantity(`${p.product_quantity} ${p.product_quantity_unit}`)
      : null);

  if (!name && !brand && !parsed) return null;
  return {
    name,
    brand,
    volume: parsed?.volume ?? null,
    volumeUnit: parsed?.unit ?? '',
    source,
  };
}

function lookupOpenFoodFacts(jan: string, signal: AbortSignal): Promise<ProductLookupResult | null> {
  return lookupOpenFactsFamily('world.openfoodfacts.org', 'openfoodfacts', jan, signal);
}

function lookupOpenProductsFacts(jan: string, signal: AbortSignal): Promise<ProductLookupResult | null> {
  return lookupOpenFactsFamily('world.openproductsfacts.org', 'openproductsfacts', jan, signal);
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    // オフライン・タイムアウト・CORS等は「見つからない」扱い
    console.warn('[productLookup]', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupProductByJan(
  jan: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<ProductLookupResult | null> {
  return (
    (await withTimeout((signal) => lookupYahoo(jan, signal), timeoutMs)) ??
    (await withTimeout((signal) => lookupOpenFoodFacts(jan, signal), timeoutMs)) ??
    (await withTimeout((signal) => lookupOpenProductsFacts(jan, signal), timeoutMs))
  );
}
