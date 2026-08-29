import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { useActiveShoppingList } from '../state/useActiveShoppingList';
import { Modal } from '../components/Modal';
import { generateId, todayISODate } from '../lib/id';
import type { ItemSelectionType, ShoppingListItem } from '../types';

export function ShoppingListPage() {
  const {
    products,
    categories,
    favoriteProducts,
    shoppingLists,
    saveShoppingList,
    saveShoppingListItem,
    removeShoppingListItem,
    toggleItemPurchased,
  } = useAppData();
  const { list, items, selectedListId, setSelectedListId } = useActiveShoppingList();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<ItemSelectionType>('product');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [minVolume, setMinVolume] = useState('');
  const [desiredSpec, setDesiredSpec] = useState('');
  const [memo, setMemo] = useState('');

  function resetForm() {
    setSelectionType('product');
    setProductId('');
    setCategoryId('');
    setQuantity('1');
    setMinVolume('');
    setDesiredSpec('');
    setMemo('');
  }

  function addItem(overrides?: Partial<ShoppingListItem>) {
    if (!list) return;
    const item: ShoppingListItem = {
      shoppingListItemId: generateId(),
      shoppingListId: list.shoppingListId,
      selectionType,
      productId: selectionType === 'product' ? productId || null : null,
      categoryId: selectionType === 'category' ? categoryId || null : null,
      quantity: Number(quantity) || 1,
      minVolume: minVolume ? Number(minVolume) : null,
      desiredSpec,
      memo,
      isPurchased: false,
      ...overrides,
    };
    saveShoppingListItem(item);
  }

  function handleAdd() {
    if (selectionType === 'product' && !productId) return;
    if (selectionType === 'category' && !categoryId) return;
    addItem();
    resetForm();
    setAddModalOpen(false);
  }

  function quickAddFavorite(favProductId: string) {
    if (!list) return;
    addItem({
      shoppingListItemId: generateId(),
      shoppingListId: list.shoppingListId,
      selectionType: 'product',
      productId: favProductId,
      categoryId: null,
      quantity: 1,
      minVolume: null,
      desiredSpec: '',
      memo: '',
      isPurchased: false,
    });
  }

  function itemLabel(item: ShoppingListItem): string {
    if (item.selectionType === 'product') {
      return products.find((p) => p.productId === item.productId)?.name ?? '(削除済みの商品)';
    }
    const category = categories.find((c) => c.categoryId === item.categoryId)?.name ?? '(削除済みのカテゴリー)';
    return `${category}（カテゴリー指定）`;
  }

  function createNewList() {
    const name = prompt('リスト名を入力してください', '買い物リスト');
    if (!name) return;
    const newList = {
      shoppingListId: generateId(),
      name,
      date: todayISODate(),
      memo: '',
      createdAt: new Date().toISOString(),
    };
    saveShoppingList(newList);
    setSelectedListId(newList.shoppingListId);
    setListPickerOpen(false);
  }

  const favoritesNotInList = favoriteProducts.filter(
    (fav) => !items.some((item) => item.selectionType === 'product' && item.productId === fav.productId),
  );

  return (
    <div>
      <div className="card" onClick={() => setListPickerOpen(true)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="muted">買い物リスト</div>
            <div className="item-name" style={{ fontSize: 17 }}>
              {list?.name ?? '読み込み中...'}
            </div>
          </div>
          <span className="badge badge-accent">切替 ▾</span>
        </div>
      </div>

      {favoritesNotInList.length > 0 && (
        <div className="card">
          <h2>いつもの商品からすぐ追加</h2>
          <div className="chip-group">
            {favoritesNotInList.map((fav) => {
              const product = products.find((p) => p.productId === fav.productId);
              if (!product) return null;
              return (
                <button key={fav.favoriteProductId} type="button" className="chip" onClick={() => quickAddFavorite(fav.productId)}>
                  ＋ {product.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-title">買うもの（{items.length}件）</div>
      {items.length === 0 ? (
        <div className="empty-state card">
          <p>まだ商品が追加されていません。</p>
        </div>
      ) : (
        <div className="card">
          {items.map((item) => (
            <div className={`check-row ${item.isPurchased ? 'done' : ''}`} key={item.shoppingListItemId}>
              <input
                type="checkbox"
                checked={item.isPurchased}
                onChange={() => toggleItemPurchased(item.shoppingListItemId)}
              />
              <div style={{ flex: 1 }}>
                <div className="item-name">{itemLabel(item)}</div>
                <div className="muted">
                  数量 {item.quantity}
                  {item.minVolume ? ` ・ ${item.minVolume}以上` : ''}
                  {item.desiredSpec ? ` ・ ${item.desiredSpec}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeShoppingListItem(item.shoppingListItemId)}
                aria-label="削除"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
        ＋ 商品を追加する
      </button>

      {addModalOpen && (
        <Modal
          title="買い物リストに追加"
          onClose={() => {
            setAddModalOpen(false);
            resetForm();
          }}
        >
          <div className="field">
            <label>指定方法</label>
            <div className="chip-group">
              <button
                type="button"
                className={`chip ${selectionType === 'product' ? 'active' : ''}`}
                onClick={() => setSelectionType('product')}
              >
                商品を指定
              </button>
              <button
                type="button"
                className={`chip ${selectionType === 'category' ? 'active' : ''}`}
                onClick={() => setSelectionType('category')}
              >
                カテゴリーで指定
              </button>
            </div>
          </div>

          {selectionType === 'product' ? (
            <div className="field">
              <label>商品</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">選択してください</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="field">
                <label>カテゴリー（何でもいい場合）</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">選択してください</option>
                  {categories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>最低容量（任意）</label>
                <input type="number" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} />
              </div>
              <div className="field">
                <label>希望規格（任意）</label>
                <input
                  type="text"
                  value={desiredSpec}
                  onChange={(e) => setDesiredSpec(e.target.value)}
                  placeholder="成分無調整 など"
                />
              </div>
            </>
          )}

          <div className="field">
            <label>数量</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} />
          </div>
          <div className="field">
            <label>メモ</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <button type="button" className="btn btn-primary" onClick={handleAdd}>
            追加する
          </button>
        </Modal>
      )}

      {listPickerOpen && (
        <Modal title="買い物リストを切り替え" onClose={() => setListPickerOpen(false)}>
          {shoppingLists.map((l) => (
            <div
              className="list-row"
              key={l.shoppingListId}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedListId(l.shoppingListId);
                setListPickerOpen(false);
              }}
            >
              <div>
                <div className="item-name">{l.name}</div>
                <div className="muted">{l.date}</div>
              </div>
              {l.shoppingListId === selectedListId && <span className="badge badge-good">選択中</span>}
            </div>
          ))}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={createNewList}>
            ＋ 新しいリストを作る
          </button>
        </Modal>
      )}
    </div>
  );
}
