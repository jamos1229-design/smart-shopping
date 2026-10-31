// JANコードから商品名・メーカー・容量を外部データベースで調べる。
//
// 検索先（この順で試し、見つかった時点で確定）:
// 1. Open Food Facts（食品）・2. Open Products Facts（日用品・洗剤など食品以外）
//    どちらもAPIキー不要・CORS許可済みの無料オープンデータベース。確実に繋がるためまず試す。
// 3. Yahoo!ショッピング 商品検索API（日本の商品に強いが、サーバー間通信向けのAPIで
//    ブラウザから直接呼ぶとCORSでブロックされる可能性が高い。本アプリはサーバーを
//    持たない静的サイトのためほぼ確実に失敗するが、将来CORSが許可された場合や
//    別環境での動作に備えて最後に一応試す。失敗しても他の2つより待たせないよう
//    タイムアウトは短めにしてある）。
//
// 各検索先の結果（見つかった／見つからない／通信エラー／HTTPエラー）は
// LookupAttempt として記録し、呼び出し側で「どこまで試して、なぜ失敗したか」を
// 画面に出せるようにしている。情報が取れなかった項目は推測で埋めない。
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

export type LookupOutcome = 'found' | 'not_found' | 'http_error' | 'network_error' | 'timeout';

export interface LookupAttempt {
  source: LookupSource;
  outcome: LookupOutcome;
  httpStatus?: number;
  elapsedMs: number;
}

export const LOOKUP_OUTCOME_LABELS: Record<LookupOutcome, string> = {
  found: '見つかりました',
  not_found: 'この検索先にはありませんでした',
  http_error: 'APIがエラーを返しました',
  network_error: '通信できませんでした（CORS制限の可能性があります）',
  timeout: '応答がありませんでした（タイムアウト）',
};

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

type SourceOutcome =
  | { kind: 'found'; result: ProductLookupResult }
  | { kind: 'not_found' }
  | { kind: 'http_error'; status: number };

async function lookupYahoo(jan: string, signal: AbortSignal): Promise<SourceOutcome> {
  const url =
    'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch' +
    `?appid=${encodeURIComponent(YAHOO_APP_ID)}&jan_code=${encodeURIComponent(jan)}&results=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) return { kind: 'http_error', status: res.status };
  const data = (await res.json()) as { hits?: YahooHit[] };
  const hits = (data.hits ?? []).filter((h) => h.name);
  if (hits.length === 0) return { kind: 'not_found' };

  // 店ごとに名前がばらつくので、整形後いちばん短い名前を採用（販促文言が少ない）
  const names = hits.map((h) => cleanShoppingItemName(h.name ?? '')).filter((n) => n.length >= 2);
  if (names.length === 0) return { kind: 'not_found' };
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
    kind: 'found',
    result: {
      name,
      brand,
      volume: parsed?.volume ?? null,
      volumeUnit: parsed?.unit ?? '',
      source: 'yahoo',
    },
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
): Promise<SourceOutcome> {
  const url =
    `https://${host}/api/v2/product/${encodeURIComponent(jan)}.json` +
    '?fields=product_name,product_name_ja,generic_name_ja,brands,quantity,product_quantity,product_quantity_unit';
  const res = await fetch(url, { signal });
  if (!res.ok) return { kind: 'http_error', status: res.status };
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return { kind: 'not_found' };

  const p = data.product;
  const name = pickName(p);
  const brand = (p.brands ?? '').split(',')[0]?.trim() ?? '';
  const parsed =
    parseQuantity(p.quantity) ??
    (p.product_quantity && p.product_quantity_unit
      ? parseQuantity(`${p.product_quantity} ${p.product_quantity_unit}`)
      : null);

  if (!name && !brand && !parsed) return { kind: 'not_found' };
  return {
    kind: 'found',
    result: { name, brand, volume: parsed?.volume ?? null, volumeUnit: parsed?.unit ?? '', source },
  };
}

function lookupOpenFoodFacts(jan: string, signal: AbortSignal): Promise<SourceOutcome> {
  return lookupOpenFactsFamily('world.openfoodfacts.org', 'openfoodfacts', jan, signal);
}

function lookupOpenProductsFacts(jan: string, signal: AbortSignal): Promise<SourceOutcome> {
  return lookupOpenFactsFamily('world.openproductsfacts.org', 'openproductsfacts', jan, signal);
}

async function runSource(
  source: LookupSource,
  fn: (signal: AbortSignal) => Promise<SourceOutcome>,
  timeoutMs: number,
): Promise<{ attempt: LookupAttempt; result: ProductLookupResult | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const outcome = await fn(controller.signal);
    const elapsedMs = Date.now() - startedAt;
    if (outcome.kind === 'found') {
      return { attempt: { source, outcome: 'found', elapsedMs }, result: outcome.result };
    }
    if (outcome.kind === 'http_error') {
      return { attempt: { source, outcome: 'http_error', httpStatus: outcome.status, elapsedMs }, result: null };
    }
    return { attempt: { source, outcome: 'not_found', elapsedMs }, result: null };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.warn('[productLookup]', source, err);
    return { attempt: { source, outcome: isAbort ? 'timeout' : 'network_error', elapsedMs }, result: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface JanLookupReport {
  result: ProductLookupResult | null;
  attempts: LookupAttempt[];
}

/**
 * 確実に繋がる（CORS許可済みの）検索先から先に試し、
 * サーバー間通信向けで繋がらない可能性が高いYahooは最後に短いタイムアウトで一応試す。
 * 見つかった時点でそれ以降の検索先は呼ばない。
 */
export async function lookupProductByJan(jan: string): Promise<JanLookupReport> {
  const plan: { source: LookupSource; fn: (signal: AbortSignal) => Promise<SourceOutcome>; timeoutMs: number }[] = [
    { source: 'openfoodfacts', fn: (s) => lookupOpenFoodFacts(jan, s), timeoutMs: 6000 },
    { source: 'openproductsfacts', fn: (s) => lookupOpenProductsFacts(jan, s), timeoutMs: 6000 },
    { source: 'yahoo', fn: (s) => lookupYahoo(jan, s), timeoutMs: 3000 },
  ];

  const attempts: LookupAttempt[] = [];
  for (const step of plan) {
    const { attempt, result } = await runSource(step.source, step.fn, step.timeoutMs);
    attempts.push(attempt);
    if (result) return { result, attempts };
  }
  return { result: null, attempts };
}
