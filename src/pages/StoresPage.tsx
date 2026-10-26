import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { Modal } from '../components/Modal';
import { generateId } from '../lib/id';
import { matchesQuery, splitQuery } from '../lib/search';
import type { Chain, Store, StoreType } from '../types';

const STORE_TYPE_LABEL: Record<StoreType, string> = {
  super: 'スーパー',
  drugstore: 'ドラッグストア',
  homecenter: 'ホームセンター',
  discount: 'ディスカウント',
  other: 'その他',
};

function emptyStore(chainId: string, chainName: string): Store {
  return {
    storeId: generateId(),
    chainId,
    chainName,
    branchName: '',
    displayName: '',
    storeType: 'super',
    address: '',
    postalCode: '',
    lat: null,
    lng: null,
    phone: '',
    businessHours: '',
    hasParking: false,
    isFavorite: false,
    memo: '',
  };
}

export function StoresPage() {
  const { chains, stores, saveChain, removeChain, saveStore, removeStore } = useAppData();
  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [addingChainId, setAddingChainId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const storesByChain = useMemo(() => {
    const map = new Map<string, Store[]>();
    for (const store of stores) {
      const list = map.get(store.chainId) ?? [];
      list.push(store);
      map.set(store.chainId, list);
    }
    return map;
  }, [stores]);

  const terms = useMemo(() => splitQuery(query), [query]);

  // 検索中は、チェーン名に一致すれば全店舗、店舗名・住所に一致すればその店舗だけを表示
  const visibleChains = useMemo(() => {
    return chains
      .map((chain) => {
        const all = storesByChain.get(chain.chainId) ?? [];
        if (terms.length === 0 || matchesQuery([chain.name], terms)) return { chain, stores: all };
        const hit = all.filter((st) =>
          matchesQuery([chain.name, st.displayName, st.branchName, st.address, STORE_TYPE_LABEL[st.storeType]], terms),
        );
        return { chain, stores: hit };
      })
      .filter(({ chain, stores: list }) => terms.length === 0 || list.length > 0 || matchesQuery([chain.name], terms));
  }, [chains, storesByChain, terms]);

  function handleAddChain() {
    if (!newChainName.trim()) return;
    saveChain({ chainId: generateId(), name: newChainName.trim(), memo: '' });
    setNewChainName('');
    setChainModalOpen(false);
  }

  function startAddStore(chain: Chain) {
    setAddingChainId(chain.chainId);
    setEditingStore(emptyStore(chain.chainId, chain.name));
  }

  function handleSaveStore() {
    if (!editingStore || !editingStore.branchName.trim()) return;
    const displayName = editingStore.displayName.trim() || `${editingStore.chainName}${editingStore.branchName}`;
    saveStore({ ...editingStore, displayName });
    setEditingStore(null);
    setAddingChainId(null);
  }

  return (
    <div>
      <div className="sticky-toolbar">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="店舗名・住所で検索"
            enterKeyHint="search"
          />
          {query && (
            <button type="button" className="search-clear" aria-label="検索をクリア" onClick={() => setQuery('')}>
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-primary"
          aria-label="チェーンを追加"
          onClick={() => setChainModalOpen(true)}
        >
          ＋
        </button>
      </div>

      <div className="result-count">
        <span className="muted">
          チェーン{chains.length}件 ・ 店舗{stores.length}件
        </span>
        <span className="muted">＋でチェーンを追加</span>
      </div>

      {chains.length === 0 && (
        <div className="empty-state card">
          <p>まだチェーンが登録されていません。右上の＋から追加してください。</p>
        </div>
      )}

      {chains.length > 0 && visibleChains.length === 0 && (
        <div className="empty-state card">
          <p>「{query.trim()}」に一致する店舗はありません。</p>
        </div>
      )}

      {visibleChains.map(({ chain, stores: chainStores }) => (
        <div className="card" key={chain.chainId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0 }}>{chain.name}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startAddStore(chain)}
              >
                ＋ 店舗
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                aria-label={`${chain.name}を削除`}
                onClick={() => {
                  if (confirm(`「${chain.name}」を削除しますか？所属する店舗も削除されます。`)) {
                    for (const store of storesByChain.get(chain.chainId) ?? []) removeStore(store.storeId);
                    removeChain(chain.chainId);
                  }
                }}
              >
                🗑
              </button>
            </div>
          </div>

          {chainStores.length === 0 && (
            <p className="muted" style={{ margin: '10px 0 0' }}>
              店舗がまだありません。「＋ 店舗」から追加してください。
            </p>
          )}

          {chainStores.map((store) => (
            <div className="list-row" key={store.storeId}>
              <button type="button" className="row-link" onClick={() => setEditingStore(store)}>
                <div className="item-name">
                  {store.isFavorite ? '★ ' : ''}
                  {store.displayName}
                </div>
                <div className="muted">
                  {STORE_TYPE_LABEL[store.storeType]}
                  {store.address ? ` ・ ${store.address}` : ''}
                </div>
              </button>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${store.displayName}を編集`}
                  onClick={() => setEditingStore(store)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={`${store.displayName}を削除`}
                  onClick={() => {
                    if (confirm(`「${store.displayName}」を削除しますか？`)) removeStore(store.storeId);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {chainModalOpen && (
        <Modal title="チェーンを追加" onClose={() => setChainModalOpen(false)}>
          <div className="field">
            <label>チェーン名（例: サニー）</label>
            <input
              type="text"
              value={newChainName}
              onChange={(e) => setNewChainName(e.target.value)}
              placeholder="サニー"
              autoFocus
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddChain}>
            追加する
          </button>
        </Modal>
      )}

      {editingStore && (
        <Modal
          title={addingChainId ? '店舗を追加' : '店舗を編集'}
          onClose={() => {
            setEditingStore(null);
            setAddingChainId(null);
          }}
        >
          <div className="field">
            <label>店舗名（支店名。例: ○○店）</label>
            <input
              type="text"
              value={editingStore.branchName}
              onChange={(e) =>
                setEditingStore({
                  ...editingStore,
                  branchName: e.target.value,
                  displayName: editingStore.displayName || `${editingStore.chainName}${e.target.value}`,
                })
              }
              placeholder="○○店"
              autoFocus
            />
          </div>
          <div className="field">
            <label>正式表示名</label>
            <input
              type="text"
              value={editingStore.displayName}
              onChange={(e) => setEditingStore({ ...editingStore, displayName: e.target.value })}
              placeholder={`${editingStore.chainName}○○店`}
            />
          </div>
          <div className="field">
            <label>店舗種別</label>
            <select
              value={editingStore.storeType}
              onChange={(e) => setEditingStore({ ...editingStore, storeType: e.target.value as StoreType })}
            >
              {Object.entries(STORE_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>住所（任意）</label>
            <input
              type="text"
              value={editingStore.address}
              onChange={(e) => setEditingStore({ ...editingStore, address: e.target.value })}
              placeholder="福岡県○○市○○"
            />
          </div>
          <div className="row">
            <div className="field">
              <label>郵便番号</label>
              <input
                type="text"
                value={editingStore.postalCode}
                onChange={(e) => setEditingStore({ ...editingStore, postalCode: e.target.value })}
              />
            </div>
            <div className="field">
              <label>電話番号</label>
              <input
                type="tel"
                value={editingStore.phone}
                onChange={(e) => setEditingStore({ ...editingStore, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>緯度（任意）</label>
              <input
                type="number"
                value={editingStore.lat ?? ''}
                onChange={(e) =>
                  setEditingStore({ ...editingStore, lat: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </div>
            <div className="field">
              <label>経度（任意）</label>
              <input
                type="number"
                value={editingStore.lng ?? ''}
                onChange={(e) =>
                  setEditingStore({ ...editingStore, lng: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="field">
            <label>営業時間</label>
            <input
              type="text"
              value={editingStore.businessHours}
              onChange={(e) => setEditingStore({ ...editingStore, businessHours: e.target.value })}
              placeholder="9:00-21:00"
            />
          </div>
          <div className="chip-group" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`chip ${editingStore.hasParking ? 'active' : ''}`}
              onClick={() => setEditingStore({ ...editingStore, hasParking: !editingStore.hasParking })}
            >
              🅿️ 駐車場あり
            </button>
            <button
              type="button"
              className={`chip ${editingStore.isFavorite ? 'active' : ''}`}
              onClick={() => setEditingStore({ ...editingStore, isFavorite: !editingStore.isFavorite })}
            >
              ★ お気に入り店舗
            </button>
          </div>
          <div className="field">
            <label>メモ</label>
            <textarea
              value={editingStore.memo}
              onChange={(e) => setEditingStore({ ...editingStore, memo: e.target.value })}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSaveStore}>
            保存する
          </button>
        </Modal>
      )}
    </div>
  );
}
