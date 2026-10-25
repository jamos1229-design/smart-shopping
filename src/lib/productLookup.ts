// JANコードから商品名・メーカー・容量を外部の無料データベース（Open Food Facts）で調べる。
// 価格は取得しない（店頭価格を公開しているデータベースは存在しないため）。
// 日本の商品は未登録も多いので、見つからない前提でUIを作ること。

export interface ProductLookupResult {
  name: string;
  brand: string;
  volume: number | null;
  volumeUnit: string;
  source: 'openfoodfacts';
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

export async function lookupProductByJan(
  jan: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<ProductLookupResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(jan)}.json` +
      '?fields=product_name,product_name_ja,generic_name_ja,brands,quantity,product_quantity,product_quantity_unit';
    const res = await fetch(url, { signal: controller.signal });
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
      source: 'openfoodfacts',
    };
  } catch {
    // オフライン・タイムアウト・CORS等。手入力にフォールバックする。
    return null;
  } finally {
    clearTimeout(timer);
  }
}
