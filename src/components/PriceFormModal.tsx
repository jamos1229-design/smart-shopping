import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { SearchableSelect } from './SearchableSelect';
import { useAppData } from '../state/AppDataContext';
import { calculatePriceBreakdown, findApplicableTaxRate, listActiveRateOptions } from '../lib/tax';
import { formatYen, formatPercent } from '../lib/format';
import { generateId, todayISODate } from '../lib/id';
import type { InputPriceType, PriceRecord, PriceType, Product } from '../types';

interface PriceFormModalProps {
  product: Product;
  onClose: () => void;
  editingRecord?: PriceRecord;
}

export function PriceFormModal({ product, onClose, editingRecord }: PriceFormModalProps) {
  const { stores, taxCategories, taxRates, userSettings, savePriceRecord } = useAppData();
  const [storeId, setStoreId] = useState(editingRecord?.storeId ?? stores[0]?.storeId ?? '');
  const [inputPrice, setInputPrice] = useState(editingRecord ? String(editingRecord.inputPrice) : '');
  const [inputPriceType, setInputPriceType] = useState<InputPriceType>(editingRecord?.inputPriceType ?? 'tax_included');
  const [actualPrice, setActualPrice] = useState(
    editingRecord?.actualTaxIncludedPrice != null ? String(editingRecord.actualTaxIncludedPrice) : '',
  );
  const [confirmedDate, setConfirmedDate] = useState(editingRecord?.confirmedDate ?? todayISODate());
  // この価格記録に適用する税区分。商品の税区分から初期値を決めるが、レシートの実際の税率が
  // 違う場合などに備えてこの記録だけ上書きできる（商品側の税区分は変更しない）。
  const [taxCategoryId, setTaxCategoryId] = useState(editingRecord?.taxCategoryId ?? product.taxCategoryId);
  const [priceType, setPriceType] = useState<PriceType>(editingRecord?.priceType ?? 'regular');
  const [saleStart, setSaleStart] = useState(editingRecord?.saleStartDate ?? '');
  const [saleEnd, setSaleEnd] = useState(editingRecord?.saleEndDate ?? '');
  const [memo, setMemo] = useState(editingRecord?.memo ?? '');

  const effectiveDate = confirmedDate || todayISODate();

  // 確認日時点で有効な税率を税区分ごとに一覧化し、「8%」「10%」のようなボタンにする。
  // 表示されるパーセンテージは税率マスターから取得するため、将来税率が変わっても
  // コードの変更なしにボタンの表示が自動的に追従する。
  const rateOptions = useMemo(
    () => listActiveRateOptions(taxCategories, taxRates, effectiveDate),
    [taxCategories, taxRates, effectiveDate],
  );
  const currentRate = findApplicableTaxRate(taxRates, taxCategoryId, effectiveDate)?.rate ?? null;

  const preview = useMemo(() => {
    const price = Number(inputPrice);
    if (!inputPrice || Number.isNaN(price) || price <= 0) return null;
    return calculatePriceBreakdown({
      inputPrice: price,
      inputPriceType,
      taxCategoryId,
      confirmedDate: effectiveDate,
      actualTaxIncludedPrice: actualPrice ? Number(actualPrice) : null,
      taxRates,
      roundingMethod: userSettings.taxRoundingMethod,
    });
  }, [inputPrice, inputPriceType, taxCategoryId, effectiveDate, actualPrice, taxRates, userSettings]);

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
      taxCategoryId,
      actualTaxIncludedPrice: actualPrice ? Number(actualPrice) : null,
      priceKind: preview.priceKind,
      confirmedDate: effectiveDate,
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
            <label>店舗（入力して検索できます）</label>
            <SearchableSelect
              value={storeId}
              onChange={setStoreId}
              placeholder="店舗名で検索"
              emptyMessage="該当する店舗がありません"
              options={stores.map((s) => ({ value: s.storeId, label: s.displayName }))}
            />
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

          <div className="field">
            <label>消費税率</label>
            <div className="chip-group">
              {rateOptions.map((option) => (
                <button
                  key={option.taxCategoryId}
                  type="button"
                  className={`chip ${currentRate === option.rate ? 'active' : ''}`}
                  onClick={() => setTaxCategoryId(option.taxCategoryId)}
                >
                  {formatPercent(option.rate)}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              商品の税区分から自動選択しています。レシートと違う場合はここで変更できます（この価格記録だけに適用され、商品の設定自体は変わりません）。
            </p>
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
