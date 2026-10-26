import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { Modal } from '../components/Modal';
import { ProductDetailSheet } from '../components/ProductDetailSheet';
import { SearchableSelect } from '../components/SearchableSelect';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { generateId } from '../lib/id';
import type { Category, ComparisonUnit, Product } from '../types';
import { COMPARISON_UNIT_LABELS } from '../lib/unitPrice';
import { sameJan, normalizeJan } from '../lib/jan';
import { matchesQuery, splitQuery } from '../lib/search';
import { lookupProductByJan, LOOKUP_SOURCE_LABELS, type LookupSource, type ProductLookupResult } from '../lib/productLookup';

function emptyProduct(categoryId: string, taxCategoryId: string): Product {
  return {
    productId: generateId(),
    categoryId,
    name: '',
    manufacturer: '',
    brand: '',
    volume: null,
    volumeUnit: 'ml',
    quantity: null,
    spec: '',
    comparisonUnit: 'per100ml',
    janCode: '',
    taxCategoryId,
    memo: '',
  };
}

const UNIT_TO_COMPARISON: Record<string, ComparisonUnit> = {
  ml: 'per100ml',
  L: 'per100ml',
  g: 'per100g',
  kg: 'per1kg',
  個: 'per1piece',
  本: 'per1piece',
  袋: 'per1piece',
  枚: 'per1sheet',
  ロール: 'per1roll',
};

/** 外部DBの結果を、空欄の項目にだけ反映する（ユーザーが入力済みの値は上書きしない） */
function applyLookup(product: Product, result: ProductLookupResult): Product {
  const next = { ...product };
  if (!next.name.trim() && result.name) next.name = result.name;
  if (!next.manufacturer.trim() && result.brand) next.manufacturer = result.brand;
  if (next.volume === null && result.volume !== null) {
    next.volume = result.volume;
    next.volumeUnit = result.volumeUnit || next.volumeUnit;
    next.comparisonUnit = UNIT_TO_COMPARISON[next.volumeUnit] ?? next.comparisonUnit;
  }
  return next;
}

type ScanMode = 'find' | 'field';
type SortKey = 'name' | 'recentPrice' | 'added';

const SORT_LABELS: Record<SortKey, string> = {
  name: '名前順',
  recentPrice: '価格を最近登録した順',
  added: '新しく追加した順',
};
type LookupNotice = { productId: string; kind: 'loading' | 'found' | 'notfound'; source?: LookupSource } | null;

export function ProductsPage() {
  const {
    categories,
    products,
    taxCategories,
    priceRecords,
    favoriteProducts,
    saveCategory,
    removeCategory,
    saveProduct,
    removeProduct,
  } = useAppData();
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  const [lookupNotice, setLookupNotice] = useState<LookupNotice>(null);

  const defaultTaxCategoryId = taxCategories.find((t) => t.code === 'reduced')?.taxCategoryId ?? '';

  const categoryName = (id: string) => categories.find((c) => c.categoryId === id)?.name ?? '未分類';

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.categoryId, c.name])), [categories]);

  const lastPriceDateByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of priceRecords) {
      const key = `${r.confirmedDate}|${r.createdAt}`;
      const prev = map.get(r.productId);
      if (!prev || key > prev) map.set(r.productId, key);
    }
    return map;
  }, [priceRecords]);

  const favoriteIds = useMemo(() => new Set(favoriteProducts.map((f) => f.productId)), [favoriteProducts]);

  const filteredProducts = useMemo(() => {
    const terms = splitQuery(query);
    const digits = normalizeJan(query);
    const list = products
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => categoryFilter === 'all' || p.categoryId === categoryFilter)
      .filter(({ p }) => !favoritesOnly || favoriteIds.has(p.productId))
      .filter(({ p }) => {
        if (terms.length === 0) return true;
        // 数字だけの入力はJANコードの一部としても探す
        if (digits.length >= 4 && digits === query.trim() && p.janCode.includes(digits)) return true;
        return matchesQuery(
          [p.name, p.manufacturer, p.brand, p.spec, p.memo, categoryNameById.get(p.categoryId)],
          terms,
        );
      });

    list.sort((a, b) => {
      if (sortKey === 'added') return b.index - a.index;
      if (sortKey === 'recentPrice') {
        const da = lastPriceDateByProduct.get(a.p.productId) ?? '';
        const db = lastPriceDateByProduct.get(b.p.productId) ?? '';
        if (da !== db) return da < db ? 1 : -1;
      }
      return a.p.name.localeCompare(b.p.name, 'ja');
    });
    return list.map(({ p }) => p);
  }, [products, categoryFilter, favoritesOnly, favoriteIds, query, sortKey, lastPriceDateByProduct, categoryNameById]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    const terms = splitQuery(categoryQuery);
    return categories
      .filter((c) => matchesQuery([c.name, c.memo], terms))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [categories, categoryQuery]);

  const isFiltering = query.trim() !== '' || categoryFilter !== 'all' || favoritesOnly;

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    saveCategory({ categoryId: generateId(), name: newCategoryName.trim(), memo: '' });
    setNewCategoryName('');
    setCategoryModalOpen(false);
  }

  function findByJan(jan: string, excludeProductId?: string): Product | undefined {
    return products.find((p) => p.productId !== excludeProductId && p.janCode && sameJan(p.janCode, jan));
  }

  async function runLookup(productId: string, jan: string) {
    setLookupNotice({ productId, kind: 'loading' });
    const result = await lookupProductByJan(jan);
    setLookupNotice((prev) =>
      prev && prev.productId === productId
        ? { productId, kind: result ? 'found' : 'notfound', source: result?.source }
        : prev,
    );
    if (!result) return;
    setEditingProduct((prev) => (prev && prev.productId === productId && sameJan(prev.janCode, jan) ? applyLookup(prev, result) : prev));
  }

  function handleScanned(jan: string) {
    const mode = scanMode;
    setScanMode(null);

    if (mode === 'field') {
      if (!editingProduct) return;
      const updated = { ...editingProduct, janCode: jan };
      setEditingProduct(updated);
      if (!findByJan(jan, updated.productId)) runLookup(updated.productId, jan);
      return;
    }

    // 「バーコードで探す」：登録済みなら商品詳細（価格登録）へ、未登録なら新規追加へ
    const existing = findByJan(jan);
    if (existing) {
      setDetailProductId(existing.productId);
      return;
    }
    if (categories.length === 0) {
      alert('この商品はまだ登録されていません。先にカテゴリーを追加してください。');
      return;
    }
    const fresh = {
      ...emptyProduct(categoryFilter !== 'all' ? categoryFilter : (categories[0]?.categoryId ?? ''), defaultTaxCategoryId),
      janCode: jan,
    };
    setEditingProduct(fresh);
    runLookup(fresh.productId, jan);
  }

  function closeProductForm() {
    setEditingProduct(null);
    setLookupNotice(null);
  }

  function handleSaveProduct() {
    if (!editingProduct || !editingProduct.name.trim() || !editingProduct.categoryId) return;
    const duplicate = editingProduct.janCode ? findByJan(editingProduct.janCode, editingProduct.productId) : undefined;
    if (duplicate && !confirm(`このJANコードは「${duplicate.name}」で登録済みです。それでも保存しますか？`)) return;
    saveProduct(editingProduct);
    closeProductForm();
  }

  const editingDuplicate =
    editingProduct?.janCode ? findByJan(editingProduct.janCode, editingProduct.productId) : undefined;
  const notice = lookupNotice && editingProduct && lookupNotice.productId === editingProduct.productId ? lookupNotice : null;

  return (
    <div>
      <div className="tabbar">
        <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          商品一覧
        </button>
        <button type="button" className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>
          カテゴリー
        </button>
      </div>

      {tab === 'categories' && (
        <div>
          {categories.length === 0 && (
            <div className="empty-state card">
              <p>カテゴリーがまだありません。例: 牛乳、卵、洗剤</p>
            </div>
          )}
          {categories.length > 0 && (
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="カテゴリーを検索"
                enterKeyHint="search"
              />
              {categoryQuery && (
                <button type="button" className="search-clear" aria-label="検索をクリア" onClick={() => setCategoryQuery('')}>
                  ✕
                </button>
              )}
            </div>
          )}
          {categories.length > 0 && filteredCategories.length === 0 && (
            <div className="empty-state card">
              <p>「{categoryQuery}」に一致するカテゴリーはありません。</p>
            </div>
          )}
          {filteredCategories.length > 0 && (
            <div className="card">
              {filteredCategories.map((cat: Category) => {
                const count = productCountByCategory.get(cat.categoryId) ?? 0;
                return (
                  <div className="list-row" key={cat.categoryId}>
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => {
                        setCategoryFilter(cat.categoryId);
                        setQuery('');
                        setFavoritesOnly(false);
                        setTab('products');
                      }}
                    >
                      <div className="item-name">{cat.name}</div>
                      <div className="muted">{count}件の商品 ・ タップで一覧を表示</div>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (count > 0) {
                          alert('このカテゴリーに属する商品があるため削除できません。');
                          return;
                        }
                        if (confirm(`「${cat.name}」を削除しますか？`)) removeCategory(cat.categoryId);
                      }}
                    >
                      削除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setCategoryModalOpen(true)}>
            ＋ カテゴリーを追加
          </button>
        </div>
      )}

      {tab === 'products' && (
        <div>
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="商品名・メーカー・JANで検索"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="search-clear" aria-label="検索をクリア" onClick={() => setQuery('')}>
                ✕
              </button>
            )}
            <button
              type="button"
              className="search-scan"
              aria-label="バーコードで探す"
              onClick={() => setScanMode('find')}
            >
              📷
            </button>
          </div>

          <div className="filter-row">
            <button
              type="button"
              className={`chip ${favoritesOnly ? 'active' : ''}`}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              ★ いつもの
            </button>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="カテゴリーで絞り込み"
            >
              <option value="all">全カテゴリー</option>
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
                .map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}（{productCountByCategory.get(c.categoryId) ?? 0}）
                  </option>
                ))}
            </select>
            <select
              className="filter-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="並び替え"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {products.length > 0 && (
            <div className="result-count">
              <span className="muted">
                {isFiltering ? `${filteredProducts.length}件 / 全${products.length}件` : `全${products.length}件`}
              </span>
              {isFiltering && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setQuery('');
                    setCategoryFilter('all');
                    setFavoritesOnly(false);
                  }}
                >
                  条件をクリア
                </button>
              )}
            </div>
          )}

          {products.length === 0 && (
            <div className="empty-state card">
              <p>商品がまだ登録されていません。</p>
            </div>
          )}

          {products.length > 0 && filteredProducts.length === 0 && (
            <div className="empty-state card">
              <p>{query.trim() ? `「${query.trim()}」は見つかりませんでした。` : '条件に合う商品はありません。'}</p>
              {query.trim() && categories.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setEditingProduct({
                      ...emptyProduct(
                        categoryFilter !== 'all' ? categoryFilter : (categories[0]?.categoryId ?? ''),
                        defaultTaxCategoryId,
                      ),
                      name: query.trim(),
                    })
                  }
                >
                  ＋「{query.trim()}」を新しく登録
                </button>
              )}
            </div>
          )}

          {filteredProducts.length > 0 && (
            <div className="card">
              {filteredProducts.map((product) => (
                <div
                  className="list-row"
                  key={product.productId}
                  onClick={() => setDetailProductId(product.productId)}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <div className="item-name">
                      {favoriteIds.has(product.productId) ? '★ ' : ''}
                      {product.name}
                    </div>
                    <div className="muted">
                      {categoryName(product.categoryId)}
                      {product.manufacturer ? ` ・ ${product.manufacturer}` : ''}
                      {product.volume ? ` ・ ${product.volume}${product.volumeUnit}` : ''}
                    </div>
                  </div>
                  <span className="badge badge-accent">{COMPARISON_UNIT_LABELS[product.comparisonUnit]}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginBottom: 10 }}
            onClick={() => setScanMode('find')}
          >
            📷 バーコードで探す・追加
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={categories.length === 0}
            onClick={() => setEditingProduct(emptyProduct(categories[0]?.categoryId ?? '', defaultTaxCategoryId))}
          >
            ＋ 商品を追加
          </button>
          {categories.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>先にカテゴリーを追加してください</p>}
        </div>
      )}

      {categoryModalOpen && (
        <Modal title="カテゴリーを追加" onClose={() => setCategoryModalOpen(false)}>
          <div className="field">
            <label>カテゴリー名（例: 牛乳）</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddCategory}>
            追加する
          </button>
        </Modal>
      )}

      {editingProduct && (
        <Modal
          title={products.some((p) => p.productId === editingProduct.productId) ? '商品を編集' : '商品を追加'}
          onClose={closeProductForm}
        >
          {notice?.kind === 'loading' && <div className="notice notice-warn">商品データベースを検索しています…</div>}
          {notice?.kind === 'found' && (
            <div className="notice notice-good">
              {notice.source ? LOOKUP_SOURCE_LABELS[notice.source] : '商品データベース'}
              から自動入力しました。商品名・容量が正しいか確認してください。
              {notice.source === 'yahoo' && (
                <div style={{ marginTop: 4 }}>
                  <a href="https://developer.yahoo.co.jp/sitemap/" target="_blank" rel="noreferrer">
                    Webサービス by Yahoo! JAPAN
                  </a>
                </div>
              )}
            </div>
          )}
          {notice?.kind === 'notfound' && (
            <div className="notice notice-warn">
              商品データベースに見つかりませんでした。商品名などを入力してください。次からはこのバーコードで呼び出せます。
            </div>
          )}
          <div className="field">
            <label>正式商品名</label>
            <input
              type="text"
              value={editingProduct.name}
              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              placeholder="明治おいしい牛乳900ml"
              autoFocus
            />
          </div>
          <div className="field">
            <label>カテゴリー（入力して検索できます）</label>
            <SearchableSelect
              value={editingProduct.categoryId}
              onChange={(categoryId) => setEditingProduct({ ...editingProduct, categoryId })}
              placeholder="カテゴリー名で検索"
              options={categories.map((c) => ({ value: c.categoryId, label: c.name }))}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>メーカー</label>
              <input
                type="text"
                value={editingProduct.manufacturer}
                onChange={(e) => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ブランド</label>
              <input
                type="text"
                value={editingProduct.brand}
                onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>容量</label>
              <input
                type="number"
                value={editingProduct.volume ?? ''}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    volume: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="900"
              />
            </div>
            <div className="field">
              <label>容量単位</label>
              <input
                type="text"
                value={editingProduct.volumeUnit}
                onChange={(e) => setEditingProduct({ ...editingProduct, volumeUnit: e.target.value })}
                placeholder="ml / g / kg / 個"
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>個数（パック数）</label>
              <input
                type="number"
                value={editingProduct.quantity ?? ''}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    quantity: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="10"
              />
            </div>
            <div className="field">
              <label>比較単位</label>
              <select
                value={editingProduct.comparisonUnit}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, comparisonUnit: e.target.value as ComparisonUnit })
                }
              >
                {Object.entries(COMPARISON_UNIT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>規格（任意）</label>
            <input
              type="text"
              value={editingProduct.spec}
              onChange={(e) => setEditingProduct({ ...editingProduct, spec: e.target.value })}
              placeholder="成分無調整"
            />
          </div>
          <div className="field">
            <label>JANコード（任意）</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="tel"
                inputMode="numeric"
                value={editingProduct.janCode}
                onChange={(e) => setEditingProduct({ ...editingProduct, janCode: e.target.value })}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="バーコードを読み取る"
                style={{ width: 46, height: 46 }}
                onClick={() => setScanMode('field')}
              >
                📷
              </button>
            </div>
            {editingDuplicate && (
              <p className="muted" style={{ color: 'var(--warn)', marginTop: 4 }}>
                このJANコードは「{editingDuplicate.name}」で登録済みです。
              </p>
            )}
          </div>
          <div className="field">
            <label>税区分</label>
            <select
              value={editingProduct.taxCategoryId}
              onChange={(e) => setEditingProduct({ ...editingProduct, taxCategoryId: e.target.value })}
            >
              {taxCategories.map((tc) => (
                <option key={tc.taxCategoryId} value={tc.taxCategoryId}>
                  {tc.name}
                </option>
              ))}
            </select>
            <p className="muted" style={{ marginTop: 4 }}>
              目安: 食品・飲料（酒類・外食を除く）は軽減税率対象（8%）、日用品・酒類・ペットフード等は標準税率対象（10%）です。同じレシート内でも商品によって税率が異なります。
            </p>
          </div>
          <div className="field">
            <label>メモ</label>
            <textarea
              value={editingProduct.memo}
              onChange={(e) => setEditingProduct({ ...editingProduct, memo: e.target.value })}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSaveProduct}>
            保存する
          </button>
        </Modal>
      )}

      {scanMode && (
        <BarcodeScanner
          title={scanMode === 'field' ? 'JANコードを読み取る' : 'バーコードで探す・追加'}
          onDetected={handleScanned}
          onClose={() => setScanMode(null)}
        />
      )}

      {detailProductId && (
        <ProductDetailSheet
          productId={detailProductId}
          onClose={() => setDetailProductId(null)}
          onEdit={(product) => {
            setDetailProductId(null);
            setEditingProduct(product);
          }}
          onDelete={(productId) => {
            removeProduct(productId);
            setDetailProductId(null);
          }}
        />
      )}
    </div>
  );
}
