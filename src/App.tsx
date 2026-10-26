import { useEffect, useRef, useState } from 'react';
import { AppDataProvider } from './state/AppDataContext';
import { TodayPage } from './pages/TodayPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { ProductsPage } from './pages/ProductsPage';
import { StoresPage } from './pages/StoresPage';
import { SettingsPage } from './pages/SettingsPage';

type Tab = 'today' | 'list' | 'products' | 'stores' | 'settings';

const TABS: { key: Tab; label: string; icon: string; title: string }[] = [
  { key: 'today', label: '今日', icon: '🏠', title: '今日のおすすめ' },
  { key: 'list', label: 'リスト', icon: '📝', title: '買い物リスト' },
  { key: 'products', label: '商品', icon: '🛒', title: '商品・価格' },
  { key: 'stores', label: '店舗', icon: '🏬', title: '店舗管理' },
  { key: 'settings', label: '設定', icon: '⚙️', title: '設定' },
];

function AppShell() {
  const [tab, setTab] = useState<Tab>('today');
  const current = TABS.find((t) => t.key === tab)!;
  const headerRef = useRef<HTMLElement | null>(null);

  // 固定ヘッダーの高さをCSS変数にして、画面内の固定ツールバーをその直下に置けるようにする
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <header className="app-header" ref={headerRef}>
        <h1>{current.title}</h1>
      </header>
      <main className="app-main">
        {tab === 'today' && <TodayPage />}
        {tab === 'list' && <ShoppingListPage />}
        {tab === 'products' && <ProductsPage />}
        {tab === 'stores' && <StoresPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

export default App;
