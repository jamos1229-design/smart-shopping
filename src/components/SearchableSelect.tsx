import { useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, emptyMessage }: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<number | undefined>(undefined);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(needle) || (o.sublabel ?? '').toLowerCase().includes(needle),
    );
  }, [options, query]);

  function handleFocus() {
    window.clearTimeout(blurTimeout.current);
    setQuery('');
    setOpen(true);
  }

  function handleBlur() {
    blurTimeout.current = window.setTimeout(() => setOpen(false), 120);
  }

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? '入力して検索'}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: 'relative',
            marginTop: 6,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--surface)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div className="muted" style={{ padding: '10px 12px' }}>
              {emptyMessage ?? '該当する項目がありません'}
            </div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(option)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: option.value === value ? 'var(--accent-bg)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: 15,
                }}
              >
                {option.label}
                {option.sublabel && (
                  <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                    {option.sublabel}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
