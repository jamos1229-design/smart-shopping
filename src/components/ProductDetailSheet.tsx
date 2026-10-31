import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { PriceFormModal } from './PriceFormModal';
import { useAppData } from '../state/AppDataContext';
import { analyzeProductPrices, latestPriceByStore } from '../lib/priceAnalysis';
import { computeUnitPrice, COMPARISON_UNIT_LABELS } from '../lib/unitPrice';
import { effectiveTaxIncludedPrice } from '../lib/tax';
import { formatYen, formatDate } from '../lib/format';
import { generateId } from '../lib/id';
import { LOOKUP_SOURCE_LABELS, type LookupSource } from '../lib/productLookup';
import type { PriceRecord, Product } from '../types';

interface ProductDetailSheetProps {
  productId: string;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

export function ProductDetailSheet({ productId, onClose, onEdit, onDelete }: ProductDetailSheetProps) {
  const {
    products,
    categories,
    stores,
    priceRecords,
    favoriteProducts,
    saveFavoriteProduct,
    removeFavoriteProduct,
    removePriceRecord,
  } = useAppData();
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PriceRecord | null>(null);

  const product = products.find((p) => p.productId === productId);
  const records = useMemo(() => priceRecords.filter((r) => r.productId === productId), [priceRecords, productId]);
  const analysis = useMemo(() => analyzeProductPrices(records), [records]);
  const byStore = useMemo(() => latestPriceByStore(records), [records]);
  const favorite = favoriteProducts.find((f) => f.productId === productId);

  const history = useMemo(
    () => [...records].sort((a, b) => (a.confirmedDate < b.confirmedDate ? 1 : -1)),
    [records],
  );

  if (!product) return null;
  const categoryName = categories.find((c) => c.categoryId === product.categoryId)?.name ?? '未分類';

  return (
    <Modal title={product.name} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 10 }}>
        {categoryName}
        {product.manufacturer ? ` ・ ${product.manufacturer}` : ''}
        {product.volume ? ` ・ ${product.volume}${product.volumeUnit}` : ''}
        {product.quantity ? ` × ${product.quantity}` : ''}
      </p>
      <p style={{ marginBottom: 10 }}>
        {product.autoFilledFrom && product.autoFilledFrom in LOOKUP_SOURCE_LABELS ? (
          <span className="badge badge-accent">
            🔎 {LOOKUP_SOURCE_LABELS[product.autoFilledFrom as LookupSource]}から自動入力
          </span>
        ) : (
          <span className="badge">✏️ 手入力</span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(product)}>
          商品を編集
        </button>
        <button
          type="button"
          className="btn btn-sm"
          style={{ background: favorite ? 'var(--good-bg)' : 'var(--accent-bg)', color: favorite ? 'var(--good)' : 'var(--accent-dark)' }}
          onClick={() => {
            if (favorite) removeFavoriteProduct(favorite.favoriteProductId);
            else saveFavoriteProduct({ favoriteProductId: generateId(), productId, memo: '', addedAt: new Date().toISOString() });
          }}
        >
          {favorite ? '★ いつもの商品' : '☆ いつもの商品に追加'}
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(productId)}>
          削除
        </button>
      </div>

      <div className="card">
        <h2>価格分析（税込）</h2>
        {analysis.recordCount === 0 ? (
          <p className="muted">まだ価格データがありません。</p>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap', rowGap: 10 }}>
            <div>
              <div className="muted">現在価格</div>
              <div className="price-big" style={{ fontSize: 22 }}>
                {formatYen(analysis.currentPrice ?? 0)}
              </div>
            </div>
            <div>
              <div className="muted">過去最安値</div>
              <div className="price-big" style={{ fontSize: 22, color: 'var(--good)' }}>
                {formatYen(analysis.lowestPrice ?? 0)}
              </div>
            </div>
            <div>
              <div className="muted">平均価格</div>
              <div className="price-big" style={{ fontSize: 22 }}>
                {formatYen(analysis.averagePrice ?? 0)}
              </div>
            </div>
            <div>
              <div className="muted">最高値</div>
              <div className="price-big" style={{ fontSize: 22 }}>
                {formatYen(analysis.highestPrice ?? 0)}
              </div>
            </div>
          </div>
        )}
        {analysis.lastConfirmedDate && <p className="muted" style={{ marginTop: 8 }}>最終確認日: {formatDate(analysis.lastConfirmedDate)}</p>}
      </div>

      <div className="card">
        <h2>店舗別 現在価格（{COMPARISON_UNIT_LABELS[product.comparisonUnit]}）</h2>
        {byStore.size === 0 ? (
          <p className="muted">店舗別の価格がまだありません。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>店舗</th>
                  <th>税込価格</th>
                  <th>単価</th>
                  <th>確認日</th>
                </tr>
              </thead>
              <tbody>
                {[...byStore.entries()]
                  .sort((a, b) => effectiveTaxIncludedPrice(a[1]) - effectiveTaxIncludedPrice(b[1]))
                  .map(([storeId, record]) => {
                    const store = stores.find((s) => s.storeId === storeId);
                    const price = effectiveTaxIncludedPrice(record);
                    const unitPrice = computeUnitPrice(product, price);
                    return (
                      <tr key={storeId}>
                        <td>{store?.displayName ?? '不明な店舗'}</td>
                        <td>{formatYen(price)}</td>
                        <td>{unitPrice !== null ? formatYen(unitPrice) : '-'}</td>
                        <td>{formatDate(record.confirmedDate)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>価格履歴</h2>
        {history.length === 0 ? (
          <p className="muted">履歴がありません。</p>
        ) : (
          history.map((record) => {
            const store = stores.find((s) => s.storeId === record.storeId);
            return (
              <div className="list-row" key={record.priceRecordId}>
                <div>
                  <div className="item-name">{store?.displayName ?? '不明な店舗'}</div>
                  <div className="muted">
                    {formatDate(record.confirmedDate)}
                    {record.priceType === 'sale' ? ' ・ 特売' : ''}
                    {record.priceKind === 'actual' ? ' ・ 実売価格' : ''}
                    {' ・ 適用税率'}
                    {Math.round(record.appliedTaxRate * 100)}%
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>{formatYen(effectiveTaxIncludedPrice(record))}</div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="この価格記録を編集"
                    onClick={() => setEditingRecord(record)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="この価格記録を削除"
                    onClick={() => {
                      if (confirm('この価格記録を削除しますか？')) {
                        removePriceRecord(record.priceRecordId);
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button type="button" className="btn btn-primary" onClick={() => setPriceFormOpen(true)}>
        ＋ 価格を登録する
      </button>

      {priceFormOpen && <PriceFormModal product={product} onClose={() => setPriceFormOpen(false)} />}
      {editingRecord && (
        <PriceFormModal product={product} editingRecord={editingRecord} onClose={() => setEditingRecord(null)} />
      )}
    </Modal>
  );
}
