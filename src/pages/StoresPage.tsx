import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { Modal } from '../components/Modal';
import { generateId } from '../lib/id';
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

  const storesByChain = useMemo(() => {
    const map = new Map<string, Store[]>();
    for (const store of stores) {
      const list = map.get(store.chainId) ?? [];
      list.push(store);
      map.set(store.chainId, list);
    }
    return map;
  }, [stores]);

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
      <div className="section-title">チェーン・店舗</div>

      {chains.length === 0 && (
        <div className="empty-state card">
          <p>まだチェーンが登録されていません。</p>
        </div>
      )}

      {chains.map((chain) => (
        <div className="card" key={chain.chainId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{chain.name}</h2>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (confirm(`「${chain.name}」を削除しますか？所属する店舗も削除されます。`)) {
                  for (const store of storesByChain.get(chain.chainId) ?? []) removeStore(store.storeId);
                  removeChain(chain.chainId);
                }
              }}
            >
              削除
            </button>
          </div>

          {(storesByChain.get(chain.chainId) ?? []).map((store) => (
            <div className="list-row" key={store.storeId}>
              <div>
                <div className="item-name">
                  {store.isFavorite ? '★ ' : ''}
                  {store.displayName}
                </div>
                <div className="muted">
                  {STORE_TYPE_LABEL[store.storeType]}
                  {store.address ? ` ・ ${store.address}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingStore(store)}>
                  編集
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`「${store.displayName}」を削除しますか？`)) removeStore(store.storeId);
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => startAddStore(chain)}>
              ＋ この系列に店舗を追加
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-primary" onClick={() => setChainModalOpen(true)}>
        ＋ チェーンを追加
      </button>

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
