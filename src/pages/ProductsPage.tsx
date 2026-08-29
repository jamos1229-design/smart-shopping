import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { Modal } from '../components/Modal';
import { ProductDetailSheet } from '../components/ProductDetailSheet';
import { generateId } from '../lib/id';
import type { Category, ComparisonUnit, Product } from '../types';
import { COMPARISON_UNIT_LABELS } from '../lib/unitPrice';

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

export function ProductsPage() {
  const { categories, products, taxCategories, saveCategory, removeCategory, saveProduct, removeProduct } =
    useAppData();
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const defaultTaxCategoryId = taxCategories.find((t) => t.code === 'reduced')?.taxCategoryId ?? '';

  const categoryName = (id: string) => categories.find((c) => c.categoryId === id)?.name ?? '未分類';

  const filteredProducts = useMemo(
    () => (categoryFilter === 'all' ? products : products.filter((p) => p.categoryId === categoryFilter)),
    [products, categoryFilter],
  );

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    saveCategory({ categoryId: generateId(), name: newCategoryName.trim(), memo: '' });
    setNewCategoryName('');
    setCategoryModalOpen(false);
  }

  function handleSaveProduct() {
    if (!editingProduct || !editingProduct.name.trim() || !editingProduct.categoryId) return;
    saveProduct(editingProduct);
    setEditingProduct(null);
  }

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
          <div className="card">
            {categories.map((cat: Category) => (
              <div className="list-row" key={cat.categoryId}>
                <div className="item-name">{cat.name}</div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (products.some((p) => p.categoryId === cat.categoryId)) {
                      alert('このカテゴリーに属する商品があるため削除できません。');
                      return;
                    }
                    if (confirm(`「${cat.name}」を削除しますか？`)) removeCategory(cat.categoryId);
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setCategoryModalOpen(true)}>
            ＋ カテゴリーを追加
          </button>
        </div>
      )}

      {tab === 'products' && (
        <div>
          <div className="field">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">すべてのカテゴリー</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty-state card">
              <p>商品がまだ登録されていません。</p>
            </div>
          )}

          <div className="card">
            {filteredProducts.map((product) => (
              <div
                className="list-row"
                key={product.productId}
                onClick={() => setDetailProductId(product.productId)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div className="item-name">{product.name}</div>
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
          onClose={() => setEditingProduct(null)}
        >
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
            <label>カテゴリー</label>
            <select
              value={editingProduct.categoryId}
              onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
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
            <input
              type="text"
              value={editingProduct.janCode}
              onChange={(e) => setEditingProduct({ ...editingProduct, janCode: e.target.value })}
            />
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
