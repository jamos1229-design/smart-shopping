import { useMemo } from 'react';
import { useAppData } from '../state/AppDataContext';
import { useActiveShoppingList } from '../state/useActiveShoppingList';
import { resolveItemOptions, summarizeOptimization, buildStoreBreakdown } from '../lib/optimize';
import type { RecommendationCandidate } from '../lib/optimize';
import { formatYen, formatYenSigned } from '../lib/format';

const KIND_LABEL: Record<RecommendationCandidate['kind'], string> = {
  single: '1店舗',
  pair: '2店舗',
  unlimited: '店舗数制限なし',
};

export function TodayPage() {
  const { products, stores, priceRecords, userSettings, toggleItemPurchased } = useAppData();
  const { list, items } = useActiveShoppingList();

  const itemOptions = useMemo(
    () => resolveItemOptions(items, products, priceRecords, stores),
    [items, products, priceRecords, stores],
  );

  const summary = useMemo(
    () => summarizeOptimization(items, itemOptions, stores, userSettings),
    [items, itemOptions, stores, userSettings],
  );

  const breakdown = useMemo(
    () => (summary.recommendation ? buildStoreBreakdown(summary.recommendation, items, itemOptions) : null),
    [summary.recommendation, items, itemOptions],
  );

  const uncoveredItems = items.filter((item) => (itemOptions.get(item.shoppingListItemId)?.size ?? 0) === 0);

  const storeName = (id: string) => stores.find((s) => s.storeId === id)?.displayName ?? '不明な店舗';
  const productName = (id: string) => products.find((p) => p.productId === id)?.name ?? '(削除済み)';

  if (items.length === 0) {
    return (
      <div className="empty-state card">
        <p>「リスト」タブで今日買うものを追加すると、おすすめの店舗の組み合わせを計算します。</p>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="empty-state card">
        <p>「店舗」タブで店舗を登録すると、価格を比較できるようになります。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">{list?.name ?? '今日'}のおすすめ</div>

      {summary.recommendation ? (
        <div className="recommend-hero">
          <div className="price-sub">おすすめの組み合わせ（{KIND_LABEL[summary.recommendation.kind]}）</div>
          <div className="price-big">{formatYen(summary.recommendation.total)}</div>
          <div className="price-sub" style={{ marginTop: 6 }}>
            {summary.recommendation.storeIds.map(storeName).join(' ＋ ')}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="muted">価格データが不足しているため、まだおすすめを計算できません。商品の価格を登録してください。</p>
        </div>
      )}

      {uncoveredItems.length > 0 && (
        <div className="card" style={{ background: 'var(--warn-bg)' }}>
          <p style={{ color: 'var(--warn)', fontWeight: 700, marginBottom: 6 }}>価格未登録の商品があります</p>
          {uncoveredItems.map((item) => (
            <p key={item.shoppingListItemId} className="muted">
              {item.selectionType === 'product' ? productName(item.productId ?? '') : 'カテゴリー指定の商品'}
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h2>店舗数ごとの比較（税込商品代）</h2>
        <table className="compare-table">
          <thead>
            <tr>
              <th>店舗数</th>
              <th>合計</th>
              <th>おすすめとの差</th>
            </tr>
          </thead>
          <tbody>
            {summary.allCandidates.map((candidate) => (
              <tr key={candidate.kind}>
                <td>
                  {KIND_LABEL[candidate.kind]}
                  {candidate.kind === 'unlimited' ? `（${candidate.storeCount}店舗）` : ''}
                  {summary.recommendation?.kind === candidate.kind && (
                    <span className="badge badge-good" style={{ marginLeft: 6 }}>
                      おすすめ
                    </span>
                  )}
                </td>
                <td>{formatYen(candidate.total)}</td>
                <td>
                  {summary.recommendation && candidate.kind !== summary.recommendation.kind
                    ? formatYenSigned(candidate.total - summary.recommendation.total)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.single && summary.recommendation && summary.single.total !== summary.recommendation.total && (
          <p className="muted" style={{ marginTop: 8 }}>
            1店舗だけの場合より {formatYen(summary.single.total - summary.recommendation.total)} お得です。
          </p>
        )}
      </div>

      {breakdown && summary.recommendation && (
        <>
          <div className="section-title">店舗別の買い物リスト</div>
          {summary.recommendation.storeIds.map((storeId) => {
            const lines = breakdown.get(storeId) ?? [];
            if (lines.length === 0) return null;
            const storeTotal = lines.reduce((sum, line) => sum + line.price, 0);
            return (
              <div className="card" key={storeId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2>{storeName(storeId)}</h2>
                  <span className="muted">{formatYen(storeTotal)}</span>
                </div>
                {lines.map(({ item, price, productId }) => (
                  <div className={`check-row ${item.isPurchased ? 'done' : ''}`} key={item.shoppingListItemId}>
                    <input
                      type="checkbox"
                      checked={item.isPurchased}
                      onChange={() => toggleItemPurchased(item.shoppingListItemId)}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="item-name">{productName(productId)}</div>
                      <div className="muted">数量 {item.quantity}</div>
                    </div>
                    <div>{formatYen(price)}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
