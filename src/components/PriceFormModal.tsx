import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useAppData } from '../state/AppDataContext';
import { calculatePriceBreakdown } from '../lib/tax';
import { formatYen } from '../lib/format';
import { generateId, todayISODate } from '../lib/id';
import type { InputPriceType, PriceRecord, PriceType, Product } from '../types';

interface PriceFormModalProps {
  product: Product;
  onClose: () => void;
  editingRecord?: PriceRecord;
}

export function PriceFormModal({ product, onClose, editingRecord }: PriceFormModalProps) {
  const { stores, taxRates, userSettings, savePriceRecord } = useAppData();
  const [storeId, setStoreId] = useState(editingRecord?.storeId ?? stores[0]?.storeId ?? '');
  const [inputPrice, setInputPrice] = useState(editingRecord ? String(editingRecord.inputPrice) : '');
  const [inputPriceType, setInputPriceType] = useState<InputPriceType>(editingRecord?.inputPriceType ?? 'tax_included');
  const [actualPrice, setActualPrice] = useState(
    editingRecord?.actualTaxIncludedPrice != null ? String(editingRecord.actualTaxIncludedPrice) : '',
  );
  const [confirmedDate, setConfirmedDate] = useState(editingRecord?.confirmedDate ?? todayISODate());
  const [priceType, setPriceType] = useState<PriceType>(editingRecord?.priceType ?? 'regular');
  const [saleStart, setSaleStart] = useState(editingRecord?.saleStartDate ?? '');
  const [saleEnd, setSaleEnd] = useState(editingRecord?.saleEndDate ?? '');
  const [memo, setMemo] = useState(editingRecord?.memo ?? '');

  const preview = useMemo(() => {
    const price = Number(inputPrice);
    if (!inputPrice || Number.isNaN(price) || price <= 0) return null;
    return calculatePriceBreakdown({
      inputPrice: price,
      inputPriceType,
      taxCategoryId: product.taxCategoryId,
      confirmedDate: confirmedDate || todayISODate(),
      actualTaxIncludedPrice: actualPrice ? Number(actualPrice) : null,
      taxRates,
      roundingMethod: userSettings.taxRoundingMethod,
    });
  }, [inputPrice, inputPriceType, product.taxCategoryId, confirmedDate, actualPrice, taxRates, userSettings]);

  function handleSave() {
    if (!storeId || !preview) return;
    const record: PriceRecord = {
      priceRecordId: editingRecord?.priceRecordId ?? generateId(),
      productId: product.productId,
      storeId,
      inputPrice: Number(inputPrice),
      inputPriceType,
      taxExcludedPrice: preview.taxExcludedPrice,
      taxAmount: preview.taxAmount,
      taxIncludedPrice: preview.taxIncludedPrice,
      appliedTaxRate: preview.appliedTaxRate,
      taxCategoryId: product.taxCategoryId,
      actualTaxIncludedPrice: actualPrice ? Number(actualPrice) : null,
      priceKind: preview.priceKind,
      confirmedDate: confirmedDate || todayISODate(),
      priceType,
      saleStartDate: priceType === 'sale' && saleStart ? saleStart : null,
      saleEndDate: priceType === 'sale' && saleEnd ? saleEnd : null,
      memo,
      createdAt: editingRecord?.createdAt ?? new Date().toISOString(),
    };
    savePriceRecord(record);
    onClose();
  }

  return (
    <Modal title={`${editingRecord ? '価格を編集' : '価格を登録'}：${product.name}`} onClose={onClose}>
      {stores.length === 0 ? (
        <p className="muted">先に店舗を登録してください。</p>
      ) : (
        <>
          <div className="field">
            <label>店舗</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>入力価格区分</label>
            <div className="chip-group">
              <button
                type="button"
                className={`chip ${inputPriceType === 'tax_included' ? 'active' : ''}`}
                onClick={() => setInputPriceType('tax_included')}
              >
                税込価格
              </button>
              <button
                type="button"
                className={`chip ${inputPriceType === 'tax_excluded' ? 'active' : ''}`}
                onClick={() => setInputPriceType('tax_excluded')}
              >
                税抜価格
              </button>
            </div>
          </div>

          <div className="field">
            <label>{inputPriceType === 'tax_included' ? '税込価格' : '税抜価格'}（円）</label>
            <input
              type="number"
              inputMode="numeric"
              value={inputPrice}
              onChange={(e) => setInputPrice(e.target.value)}
              placeholder="198"
              autoFocus
            />
          </div>

          {preview && (
            <div className="card" style={{ background: 'var(--accent-bg)' }}>
              <div className="price-big">{formatYen(preview.taxIncludedPrice)}</div>
              <div className="price-sub">
                税抜 {formatYen(preview.taxExcludedPrice)} ・ 消費税 {formatYen(preview.taxAmount)} ・ 適用税率{' '}
                {Math.round(preview.appliedTaxRate * 100)}%
              </div>
            </div>
          )}

          <div className="field">
            <label>実売税込価格（レシート等で確認できた場合。任意）</label>
            <input
              type="number"
              inputMode="numeric"
              value={actualPrice}
              onChange={(e) => setActualPrice(e.target.value)}
              placeholder="未入力なら自動計算値を使用"
            />
          </div>

          <div className="field">
            <label>確認日</label>
            <input type="date" value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} />
          </div>

          <div className="field">
            <label>価格区分</label>
            <div className="chip-group">
              <button
                type="button"
                className={`chip ${priceType === 'regular' ? 'active' : ''}`}
                onClick={() => setPriceType('regular')}
              >
                通常価格
              </button>
              <button
                type="button"
                className={`chip ${priceType === 'sale' ? 'active' : ''}`}
                onClick={() => setPriceType('sale')}
              >
                特売価格
              </button>
            </div>
          </div>

          {priceType === 'sale' && (
            <div className="row">
              <div className="field">
                <label>特売開始日</label>
                <input type="date" value={saleStart} onChange={(e) => setSaleStart(e.target.value)} />
              </div>
              <div className="field">
                <label>特売終了日</label>
                <input type="date" value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div className="field">
            <label>メモ</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <button type="button" className="btn btn-primary" disabled={!preview} onClick={handleSave}>
            {editingRecord ? '変更を保存する' : '価格を保存する'}
          </button>
        </>
      )}
    </Modal>
  );
}
