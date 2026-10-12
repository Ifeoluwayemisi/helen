import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  ShoppingBag,
  Boxes,
  Receipt,
  TrendingUp,
  Package,
  Settings,
  Users,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { OfflineIndicator } from '../common/OfflineIndicator';

interface AppShellProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const { dbState, currentUser, switchUser, cartItemCount, toastMessage, toastType } = useStore();
  const { settings, users, products } = dbState;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const lowStockCount = products.filter(
    (p) => p.active && p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold
  ).length;
  const outOfStockCount = products.filter((p) => p.active && p.stockQuantity === 0).length;
  const totalAlerts = lowStockCount + outOfStockCount;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <OfflineIndicator />

      {/* TOP APPLICATION BAR */}
      <header className="h-14 bg-emerald-900 text-white flex items-center justify-between px-3 sm:px-5 shrink-0 shadow-sm z-30 select-none">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-800 border border-emerald-700 flex items-center justify-center text-emerald-300 font-extrabold shadow-2xs">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                {settings.storeName}
              </h1>
              <span className="text-[10px] bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                POS
              </span>
            </div>
            <p className="text-[10px] text-emerald-300 font-medium hidden sm:block">
              {settings.branchName}
            </p>
          </div>
        </div>

        {/* Right Section: PWA Install Button, Quick Operator Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Current Operator Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 py-1 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-800 text-left transition active:scale-95"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs font-bold uppercase">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-white block leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-emerald-300 font-mono block leading-tight">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Current User
                    </span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {currentUser.name} ({currentUser.role})
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      {currentUser.email}
                    </span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                      Switch Active Operator
                    </span>
                    {users
                      .filter((u) => u.active)
                      .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            switchUser(u.id);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                            u.id === currentUser.id
                              ? 'bg-emerald-50 text-emerald-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="block font-medium">{u.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{u.role}</span>
                          </div>
                          {u.id === currentUser.id && (
                            <UserCheck className="w-4 h-4 text-emerald-700" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN SCREEN AREA */}
      <main className="flex-1 flex overflow-hidden relative">
        {children}
      </main>

      {/* BOTTOM MOBILE NAVIGATION BAR (Touch target >= 44px) */}
      <nav className="h-16 bg-white border-t border-slate-200 flex items-stretch shrink-0 z-30 select-none shadow-xs">
        {/* TAB 1: POS (Checkout) */}
        <button
          onClick={() => onSelectTab('pos')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'pos' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-5 h-5 ${currentTab === 'pos' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-700 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">POS</span>
        </button>

        {/* TAB 2: INVENTORY */}
        <button
          onClick={() => onSelectTab('inventory')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'inventory' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Boxes className={`w-5 h-5 ${currentTab === 'inventory' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Stock</span>
        </button>

        {/* TAB 3: PRODUCTS */}
        <button
          onClick={() => onSelectTab('products')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'products' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className={`w-5 h-5 ${currentTab === 'products' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Products</span>
        </button>

        {/* TAB 4: SALES HISTORY */}
        <button
          onClick={() => onSelectTab('sales')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'sales' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className={`w-5 h-5 ${currentTab === 'sales' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Sales</span>
        </button>

        {/* TAB 5: DASHBOARD / REPORTS */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'dashboard' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className={`w-5 h-5 ${currentTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Reports</span>
        </button>

        {/* TAB 6: STAFF */}
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => onSelectTab('staff')}
            className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
              currentTab === 'staff' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className={`w-5 h-5 ${currentTab === 'staff' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Staff</span>
          </button>
        )}

        {/* TAB 7: AUDIT (Admin only) */}
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => onSelectTab('audit')}
            className={`hidden sm:flex flex-1 flex-col items-center justify-center min-w-0 transition active:scale-95 ${
              currentTab === 'audit' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 ${currentTab === 'audit' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Audit</span>
          </button>
        )}

        {/* TAB 8: SETTINGS */}
        <button
          onClick={() => onSelectTab('settings')}
          className={`flex-1 flex flex-col items-center justify-center min-w-0 transition active:scale-95 ${
            currentTab === 'settings' ? 'text-emerald-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className={`w-5 h-5 ${currentTab === 'settings' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] sm:text-[11px] mt-1 font-semibold truncate">Settings</span>
        </button>
      </nav>

      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold animate-in fade-in slide-in-from-bottom-2 bg-slate-900 text-white border border-slate-700">
          {toastType === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastType === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastType === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
