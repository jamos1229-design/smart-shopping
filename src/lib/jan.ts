// JAN（EAN-13 / EAN-8）・UPC-A コードの正規化とチェックディジット検証。

/** 数字以外を取り除く */
export function normalizeJan(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

function checkDigitOk(digits: string): boolean {
  // 末尾がチェックディジット。右から数えて奇数桁（チェックディジット除く）に×3。
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[digits.length - 1]);
}

/** 有効なJAN/EAN/UPCコードならtrue（8・12・13桁に対応） */
export function isValidJan(raw: string): boolean {
  const digits = normalizeJan(raw);
  if (![8, 12, 13].includes(digits.length)) return false;
  return checkDigitOk(digits);
}

/**
 * 比較用の正規形。UPC-A(12桁)は先頭に0を付けてEAN-13相当にそろえる。
 * 無効なコードはnullを返す。
 */
export function canonicalJan(raw: string): string | null {
  const digits = normalizeJan(raw);
  if (!isValidJan(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

/** 2つのコードが同じ商品を指すか（UPC-A と EAN-13 の表記ゆれを吸収） */
export function sameJan(a: string, b: string): boolean {
  const ca = canonicalJan(a);
  const cb = canonicalJan(b);
  if (ca && cb) return ca === cb;
  const na = normalizeJan(a);
  return na !== '' && na === normalizeJan(b);
}
