// 日本語の打ち込み検索用のユーティリティ。
// 全角/半角・大文字/小文字・カタカナ/ひらがなの違いを吸収する。
// 例: 「うぃんなー」「ｳｲﾝﾅｰ」「ウィンナー」→ どれでも「香薫あらびきポークウィンナー」に一致

/** 検索用に文字列をそろえる */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s・･,、。.\-_/]+/g, '');
}

/** 検索語をスペースで区切った語に分ける（すべての語を含むものが一致） */
export function splitQuery(query: string): string[] {
  return query
    .normalize('NFKC')
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter((t) => t.length > 0);
}

/** いずれかのフィールドに、すべての検索語が含まれていれば一致 */
export function matchesQuery(fields: (string | null | undefined)[], terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = fields.map((f) => normalizeForSearch(f ?? '')).join('|');
  return terms.every((t) => haystack.includes(t));
}
