import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { Modal } from '../components/Modal';
import { generateId, todayISODate } from '../lib/id';
import { formatDate, formatPercent } from '../lib/format';
import type { TaxRate, TaxRoundingMethod } from '../types';

const ROUNDING_LABEL: Record<TaxRoundingMethod, string> = {
  floor: '切り捨て',
  round: '四捨五入',
  ceil: '切り上げ',
};

function emptyTaxRate(taxCategoryId: string): TaxRate {
  return {
    taxRateId: generateId(),
    taxCategoryId,
    name: '',
    rate: 0.1,
    validFrom: todayISODate(),
    validTo: null,
    isActive: true,
    memo: '',
  };
}

export function SettingsPage() {
  const { userSettings, saveUserSettings, taxCategories, taxRates, saveTaxRate, removeTaxRate } = useAppData();
  const [form, setForm] = useState(userSettings);
  const [taxUnlocked, setTaxUnlocked] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

  function handleSaveSettings() {
    saveUserSettings(form);
    alert('設定を保存しました');
  }

  return (
    <div>
      <div className="section-title">買い物の設定</div>
      <div className="card">
        <h2>店舗数のバランス</h2>
        <div className="field">
          <label>最大で回りたい店舗数</label>
          <input
            type="number"
            value={form.maxStoresToVisit}
            onChange={(e) => setForm({ ...form, maxStoresToVisit: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>1店舗増やすのに必要な最低節約額（円）</label>
          <input
            type="number"
            value={form.minSavingsPerExtraStore}
            onChange={(e) => setForm({ ...form, minSavingsPerExtraStore: Number(e.target.value) })}
          />
          <p className="muted">例: 200円未満しか安くならないなら店舗を増やさずおすすめします。</p>
        </div>
      </div>

      <div className="card">
        <h2>車・ガソリン（将来のガソリン代計算用）</h2>
        <div className="row">
          <div className="field">
            <label>燃費（km/L）</label>
            <input
              type="number"
              value={form.fuelEfficiencyKmPerL ?? ''}
              onChange={(e) =>
                setForm({ ...form, fuelEfficiencyKmPerL: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="field">
            <label>ガソリン単価（円/L）</label>
            <input
              type="number"
              value={form.fuelPricePerL ?? ''}
              onChange={(e) =>
                setForm({ ...form, fuelPricePerL: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>基準地点（将来の距離計算用）</h2>
        <div className="field">
          <label>名称</label>
          <input
            type="text"
            value={form.baseLocation.name}
            onChange={(e) => setForm({ ...form, baseLocation: { ...form.baseLocation, name: e.target.value } })}
            placeholder="自宅"
          />
        </div>
        <div className="field">
          <label>住所</label>
          <input
            type="text"
            value={form.baseLocation.address}
            onChange={(e) => setForm({ ...form, baseLocation: { ...form.baseLocation, address: e.target.value } })}
          />
        </div>
      </div>

      <div className="card">
        <h2>消費税の端数処理</h2>
        <div className="chip-group">
          {(Object.keys(ROUNDING_LABEL) as TaxRoundingMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              className={`chip ${form.taxRoundingMethod === method ? 'active' : ''}`}
              onClick={() => setForm({ ...form, taxRoundingMethod: method })}
            >
              {ROUNDING_LABEL[method]}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={handleSaveSettings}>
        設定を保存する
      </button>

      <div className="section-title">税率マスター設定</div>
      {!taxUnlocked ? (
        <div className="card">
          <div className="lock-banner">
            🔒 税率は買い物全体の計算に影響する重要な設定です。誤操作を防ぐため、通常はロックされています。
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setTaxUnlocked(true)}>
            編集をロック解除する
          </button>
        </div>
      ) : (
        <div>
          {taxCategories.map((tc) => (
            <div className="card" key={tc.taxCategoryId}>
              <h2>{tc.name}</h2>
              {taxRates
                .filter((r) => r.taxCategoryId === tc.taxCategoryId)
                .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))
                .map((rate) => (
                  <div className="list-row" key={rate.taxRateId}>
                    <div>
                      <div className="item-name">
                        {rate.name} ・ {formatPercent(rate.rate)}
                        {!rate.isActive && <span className="badge badge-warn" style={{ marginLeft: 6 }}>無効</span>}
                      </div>
                      <div className="muted">
                        適用開始: {formatDate(rate.validFrom)}
                        {rate.validTo ? ` ・ 終了: ${formatDate(rate.validTo)}` : ' ・ 終了日なし'}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingRate(rate)}>
                      編集
                    </button>
                  </div>
                ))}
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingRate(emptyTaxRate(tc.taxCategoryId))}
                >
                  ＋ この税区分に税率を追加
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => setTaxUnlocked(false)}>
            ロックする
          </button>
        </div>
      )}

      {editingRate && (
        <Modal title="税率を編集" onClose={() => setEditingRate(null)}>
          <div className="field">
            <label>名称</label>
            <input
              type="text"
              value={editingRate.name}
              onChange={(e) => setEditingRate({ ...editingRate, name: e.target.value })}
              placeholder="標準税率"
            />
          </div>
          <div className="field">
            <label>税率（%）</label>
            <input
              type="number"
              value={editingRate.rate * 100}
              onChange={(e) => setEditingRate({ ...editingRate, rate: Number(e.target.value) / 100 })}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>適用開始日</label>
              <input
                type="date"
                value={editingRate.validFrom}
                onChange={(e) => setEditingRate({ ...editingRate, validFrom: e.target.value })}
              />
            </div>
            <div className="field">
              <label>適用終了日（任意）</label>
              <input
                type="date"
                value={editingRate.validTo ?? ''}
                onChange={(e) => setEditingRate({ ...editingRate, validTo: e.target.value || null })}
              />
            </div>
          </div>
          <div className="chip-group" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`chip ${editingRate.isActive ? 'active' : ''}`}
              onClick={() => setEditingRate({ ...editingRate, isActive: !editingRate.isActive })}
            >
              {editingRate.isActive ? '有効' : '無効'}
            </button>
          </div>
          <div className="field">
            <label>メモ</label>
            <textarea
              value={editingRate.memo}
              onChange={(e) => setEditingRate({ ...editingRate, memo: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveTaxRate(editingRate);
                setEditingRate(null);
              }}
            >
              保存する
            </button>
            {taxRates.some((r) => r.taxRateId === editingRate.taxRateId) && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('この税率を削除しますか？既存の価格履歴には影響しません。')) {
                    removeTaxRate(editingRate.taxRateId);
                    setEditingRate(null);
                  }
                }}
              >
                削除
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
