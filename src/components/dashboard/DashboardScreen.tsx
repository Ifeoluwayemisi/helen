import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Package,
  AlertTriangle,
  XCircle,
  BarChart3,
  Calendar,
  Banknote,
  Building2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export const DashboardScreen: React.FC<{ onNavigateToPOS: () => void; onNavigateToInventory: () => void }> = ({
  onNavigateToPOS,
  onNavigateToInventory,
}) => {
  const { dbState, currentUser, setActiveReceipt } = useStore();
  const { sales, products, categories, settings } = dbState;

  const isAdmin = currentUser.role === 'ADMIN';

  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');

  // Filter sales based on chosen range
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return sales.filter((s) => {
      const saleDate = s.createdAt.slice(0, 10);
      if (dateRange === 'today') return saleDate === todayStr;
      if (dateRange === 'yesterday') return saleDate === yesterdayStr;
      if (dateRange === 'week') return new Date(s.createdAt) >= sevenDaysAgo;
      if (dateRange === 'month') return new Date(s.createdAt) >= thirtyDaysAgo;
      return true;
    });
  }, [sales, dateRange]);

  // Aggregate metrics
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.total, 0);
  }, [filteredSales]);

  const transactionCount = filteredSales.length;

  const averageTicket = useMemo(() => {
    return transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0;
  }, [totalRevenue, transactionCount]);

  const activeProductsCount = products.filter((p) => p.active).length;

  const lowStockCount = products.filter(
    (p) => p.active && p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold
  ).length;

  const outOfStockCount = products.filter((p) => p.active && p.stockQuantity === 0).length;

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const cash = filteredSales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const transfer = filteredSales.filter((s) => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.total, 0);
    const card = filteredSales.filter((s) => s.paymentMethod === 'POS_CARD').reduce((sum, s) => sum + s.total, 0);

    return { cash, transfer, card };
  }, [filteredSales]);

  // Top Selling Products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = map.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += item.lineTotal;
        map.set(item.productId, current);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  // Recent 5 sales
  const recentSales = useMemo(() => {
    return sales.slice(0, 5);
  }, [sales]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 space-y-6">
      {/* Header and Date Filter */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-700" />
            <span>Store Performance &amp; Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time analytics for Hellen Store · {new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Records' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setDateRange(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                dateRange === t.id ? 'bg-emerald-800 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: Revenue */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase text-[10px] tracking-wider">Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 truncate">
              {settings.currency}{totalRevenue.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              Across {transactionCount} sales
            </div>
          </div>

          {/* Card 2: Transactions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase text-[10px] tracking-wider">Orders</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {transactionCount}
            </div>
            <div className="text-[11px] text-slate-500">
              Avg ticket: {settings.currency}{averageTicket.toLocaleString()}
            </div>
          </div>

          {/* Card 3: Active Products */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase text-[10px] tracking-wider">Catalogue</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {activeProductsCount}
            </div>
            <div className="text-[11px] text-slate-500">
              In {categories.length} categories
            </div>
          </div>

          {/* Card 4: Inventory Alerts */}
          <button
            onClick={onNavigateToInventory}
            className="text-left bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-300 shadow-2xs space-y-2 transition group"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase text-[10px] tracking-wider">Stock Alerts</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:bg-amber-200 transition">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700">
              {lowStockCount + outOfStockCount}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="text-amber-800 font-bold">{lowStockCount} low</span>
              <span>·</span>
              <span className="text-rose-700 font-bold">{outOfStockCount} out</span>
            </div>
          </button>
        </div>

        {/* PAYMENT BREAKDOWN & TOP PRODUCTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payment Method Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>Payment Method Breakdown</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Selected period</span>
            </div>

            <div className="space-y-3">
              {/* Cash */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Cash Sales</span>
                    <span className="text-[10px] text-slate-500">
                      {totalRevenue > 0
                        ? `${Math.round((paymentBreakdown.cash / totalRevenue) * 100)}% of total`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {settings.currency}{paymentBreakdown.cash.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Bank Transfer */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Bank Transfer</span>
                    <span className="text-[10px] text-slate-500">
                      {totalRevenue > 0
                        ? `${Math.round((paymentBreakdown.transfer / totalRevenue) * 100)}% of total`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {settings.currency}{paymentBreakdown.transfer.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* POS Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">POS / Card Terminal</span>
                    <span className="text-[10px] text-slate-500">
                      {totalRevenue > 0
                        ? `${Math.round((paymentBreakdown.card / totalRevenue) * 100)}% of total`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {settings.currency}{paymentBreakdown.card.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>Top Selling Products</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">By revenue</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400">
                <p className="text-xs">No sales recorded during this period.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 block truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-500">{p.quantity} units sold</span>
                      </div>
                    </div>
                    <div className="font-extrabold text-slate-900 whitespace-nowrap">
                      {settings.currency}{p.revenue.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT SALES TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>Recent Completed Transactions</span>
            </h3>
            <button
              onClick={onNavigateToPOS}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Go to POS</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Receipt</th>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(sale.createdAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{sale.cashierName}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-[10px] text-slate-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                      {settings.currency}{sale.total.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setActiveReceipt(sale)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
                      >
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
