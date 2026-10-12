import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, StockMovementType } from '../../types';
import {
  Boxes,
  ArrowDownLeft,
  SlidersHorizontal,
  History,
  Search,
  Plus,
  AlertTriangle,
  XCircle,
  CheckCircle,
  FileText,
  User,
  X,
  Calendar,
} from 'lucide-react';

export const InventoryScreen: React.FC = () => {
  const { dbState, receiveStock, adjustStock, currentUser } = useStore();
  const { products, movements, settings } = dbState;

  const [activeTab, setActiveTab] = useState<'overview' | 'receive' | 'adjust' | 'movements'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Receive stock modal / form state
  const [receiveModalProduct, setReceiveModalProduct] = useState<Product | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState<string>('10');
  const [receiveSellingUnit, setReceiveSellingUnit] = useState<import('../../types').SellingUnitType>('BASE');
  const [receiveSupplier, setReceiveSupplier] = useState('');
  const [receiveUnitCost, setReceiveUnitCost] = useState<string>('');
  const [receiveNote, setReceiveNote] = useState('');

  // Adjustment modal state
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustNewQuantity, setAdjustNewQuantity] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<'ADJUSTMENT' | 'DAMAGED' | 'RETURN'>('ADJUSTMENT');
  const [adjustNote, setAdjustNote] = useState('');

  // Movement filter
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');

  const lowStockCount = products.filter(
    (p) => p.active && p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold
  ).length;

  const outOfStockCount = products.filter((p) => p.active && p.stockQuantity === 0).length;

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (stockFilter === 'low' && (p.stockQuantity <= 0 || p.stockQuantity > p.minStockThreshold)) {
        return false;
      }
      if (stockFilter === 'out' && p.stockQuantity > 0) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, stockFilter, searchQuery]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementTypeFilter !== 'all' && m.type !== movementTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          m.productName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.userName.toLowerCase().includes(q) ||
          (m.note && m.note.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, movementTypeFilter, searchQuery]);

  // Handle open receive
  const openReceiveModal = (product: Product) => {
    setReceiveModalProduct(product);
    setReceiveQuantity('10');
    setReceiveSellingUnit('BASE');
    setReceiveSupplier('');
    setReceiveUnitCost(product.costPrice ? String(product.costPrice) : '');
    setReceiveNote('');
  };

  const handleExecuteReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalProduct) return;
    const qty = parseInt(receiveQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    receiveStock({
      productId: receiveModalProduct.id,
      quantity: qty,
      sellingUnit: receiveSellingUnit,
      supplier: receiveSupplier.trim() || undefined,
      note: receiveNote.trim() || undefined,
      unitCost: receiveUnitCost ? parseFloat(receiveUnitCost) : undefined,
    });
    setReceiveModalProduct(null);
  };

  // Handle open adjust
  const openAdjustModal = (product: Product) => {
    setAdjustModalProduct(product);
    setAdjustNewQuantity(String(product.stockQuantity));
    setAdjustReason('ADJUSTMENT');
    setAdjustNote('');
  };

  const handleExecuteAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct) return;
    const qty = parseInt(adjustNewQuantity, 10);
    if (isNaN(qty) || qty < 0) return;

    adjustStock({
      productId: adjustModalProduct.id,
      newQuantity: qty,
      reason: adjustReason,
      note: adjustNote.trim() || 'Manual stock reconciliation',
    });
    setAdjustModalProduct(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner & KPI metrics */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-700" />
              <span>Inventory Management &amp; Stock Ledger</span>
            </h2>
            <p className="text-xs text-slate-500">
              Real-time stock levels, replenishment intake, authorized adjustments, and audit trail
            </p>
          </div>

          {/* Quick status counters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('overview');
                setStockFilter('low');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                stockFilter === 'low'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{lowStockCount} Low Stock</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('overview');
                setStockFilter('out');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                stockFilter === 'out'
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{outOfStockCount} Out of Stock</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Current Stock ({products.filter((p) => p.active).length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'movements'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Movement History ({movements.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {/* TAB 1: STOCK OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter stock by name, SKU or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Status pill filters */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    stockFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Active
                </button>
                <button
                  onClick={() => setStockFilter('low')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    stockFilter === 'low'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Low Stock ({lowStockCount})
                </button>
                <button
                  onClick={() => setStockFilter('out')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    stockFilter === 'out'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Out of Stock ({outOfStockCount})
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-3">Price</th>
                      <th className="py-3 px-3 text-center">Current Stock</th>
                      <th className="py-3 px-3 text-center">Alert Threshold</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No matching inventory items found.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isOut = p.stockQuantity === 0;
                        const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                SKU: {p.sku} {p.barcode && `· Barcode: ${p.barcode}`}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900">
                                {settings.currency}{p.sellingPrice.toLocaleString()}
                              </div>
                              {p.costPrice && (
                                <div className="text-[10px] text-slate-400">
                                  Cost: {settings.currency}{p.costPrice.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                                  isOut
                                    ? 'bg-rose-100 text-rose-800'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                {p.stockQuantity} {p.baseUnit ? (p.stockQuantity === 1 ? p.baseUnit : `${p.baseUnit}s`) : 'units'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-500">
                              {p.minStockThreshold} {p.baseUnit || 'unit'}s
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isOut ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Adequate
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openReceiveModal(p)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold transition flex items-center gap-1"
                                  title="Receive Goods"
                                >
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>Receive</span>
                                </button>
                                <button
                                  onClick={() => openAdjustModal(p)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center gap-1"
                                  title="Stock Adjustment"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                  <span>Adjust</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MOVEMENT HISTORY LEDGER */}
        {activeTab === 'movements' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledger by product, SKU, user, or note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Movement Type Filter */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {(['all', 'RECEIVED', 'SALE', 'ADJUSTMENT', 'DAMAGED', 'RETURN'] as const).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => setMovementTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        movementTypeFilter === type
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type === 'all' ? 'All Movements' : type}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Movements Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Date &amp; Time</th>
                      <th className="py-3 px-3">Product</th>
                      <th className="py-3 px-3">Movement Type</th>
                      <th className="py-3 px-3 text-center">Change</th>
                      <th className="py-3 px-3 text-center">Before &rarr; After</th>
                      <th className="py-3 px-3">Staff / Cashier</th>
                      <th className="py-3 px-4">Note / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No stock movement records found.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m) => {
                        const isPositive = m.quantityChange > 0;
                        const dateFormatted = new Date(m.timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                              {dateFormatted}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{m.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                SKU: {m.sku}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  m.type === 'RECEIVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.type === 'SALE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : m.type === 'DAMAGED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-extrabold whitespace-nowrap">
                              <span
                                className={isPositive ? 'text-emerald-700' : 'text-slate-800'}
                              >
                                {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {m.previousQuantity} &rarr;{' '}
                              <strong className="text-slate-900">{m.resultingQuantity}</strong>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {m.userName}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {m.receiptNumber && (
                                <span className="font-mono text-emerald-700 font-bold block">
                                  {m.receiptNumber}
                                </span>
                              )}
                              <span>{m.note || '—'}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: RECEIVE INCOMING GOODS */}
      {receiveModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-300" />
                <h3 className="text-sm font-bold">Receive Incoming Stock</h3>
              </div>
              <button
                onClick={() => setReceiveModalProduct(null)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReceive} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">
                  {receiveModalProduct.name}
                </div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  SKU: {receiveModalProduct.sku} · Current Stock: {receiveModalProduct.stockQuantity} units
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Intake Unit Type *
                  </label>
                  <select
                    value={receiveSellingUnit}
                    onChange={(e) => setReceiveSellingUnit(e.target.value as import('../../types').SellingUnitType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="BASE">
                      Individual {receiveModalProduct.baseUnit || 'unit'} (1x)
                    </option>
                    {receiveModalProduct.hasPack && (
                      <option value="PACK">
                        {receiveModalProduct.packUnitName || `Pack of ${receiveModalProduct.packSize}`} ({receiveModalProduct.packSize}x {receiveModalProduct.baseUnit || 'unit'}s)
                      </option>
                    )}
                    {receiveModalProduct.hasCarton && (
                      <option value="CARTON">
                        {receiveModalProduct.cartonUnitName || `Carton of ${receiveModalProduct.cartonSize}`} ({receiveModalProduct.cartonSize}x {receiveModalProduct.baseUnit || 'unit'}s)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Quantity to Receive *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={receiveQuantity}
                    onChange={(e) => setReceiveQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    autoFocus
                  />
                </div>
              </div>

              {/* Conversion factor explanation banner */}
              {(() => {
                const qty = parseInt(receiveQuantity, 10) || 0;
                const multiplier =
                  receiveSellingUnit === 'PACK'
                    ? (receiveModalProduct.packSize || 1)
                    : receiveSellingUnit === 'CARTON'
                    ? (receiveModalProduct.cartonSize || 1)
                    : 1;
                const totalBase = qty * multiplier;
                const unitName =
                  receiveSellingUnit === 'PACK'
                    ? (receiveModalProduct.packUnitName || 'pack')
                    : receiveSellingUnit === 'CARTON'
                    ? (receiveModalProduct.cartonUnitName || 'carton')
                    : (receiveModalProduct.baseUnit || 'unit');

                return (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold">Intake: </span>
                      <strong>{qty} {unitName}</strong>
                      {multiplier > 1 && (
                        <span className="text-slate-600"> (×{multiplier} base {receiveModalProduct.baseUnit || 'unit'}s)</span>
                      )}
                    </div>
                    <div className="font-extrabold text-emerald-800">
                      +{totalBase} {receiveModalProduct.baseUnit || 'unit'}s into stock
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier / Vendor Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Golden Penny Mills Depot / Nestle Wholesalers"
                  value={receiveSupplier}
                  onChange={(e) => setReceiveSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unit Cost Price ({settings.currency}) (Optional)
                </label>
                <input
                  type="number"
                  placeholder="Update cost price if changed"
                  value={receiveUnitCost}
                  onChange={(e) => setReceiveUnitCost(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Invoice / Batch Delivery Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Waybill #WB-9941 received in good condition"
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReceiveModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition"
                >
                  Confirm &amp; Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Authorized Stock Adjustment</h3>
              </div>
              <button
                onClick={() => setAdjustModalProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjust} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{adjustModalProduct.name}</div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  Current Stored Stock: <strong className="text-slate-900">{adjustModalProduct.stockQuantity}</strong> units
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Adjusted Actual Stock Count *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustNewQuantity}
                  onChange={(e) => setAdjustNewQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Adjustment Reason *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustReason('ADJUSTMENT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjustReason === 'ADJUSTMENT'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Inventory Count
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustReason('DAMAGED')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjustReason === 'DAMAGED'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Damaged / Broken
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustReason('RETURN')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjustReason === 'RETURN'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Customer Return
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason Note / Justification *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain reason for discrepancy (BR-07 / BR-11 traceability requirement)"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold shadow-sm transition"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
