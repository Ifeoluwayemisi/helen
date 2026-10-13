import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Category } from '../../types';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Power,
  FolderPlus,
  AlertCircle,
  X,
  Check,
  Package,
  Layers,
  Lock,
} from 'lucide-react';

export const ProductsScreen: React.FC = () => {
  const {
    dbState,
    createProduct,
    updateProduct,
    toggleProductActive,
    createCategory,
    currentUser,
    showToast,
  } = useStore();
  const { products, categories, settings } = dbState;

  const isAdmin = currentUser.role === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

  // New product form
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [baseUnit, setBaseUnit] = useState('bottle');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [minStockThreshold, setMinStockThreshold] = useState('5');

  // Pack configuration
  const [hasPack, setHasPack] = useState(false);
  const [packUnitName, setPackUnitName] = useState('Pack of 12');
  const [packSize, setPackSize] = useState('12');
  const [packRetailPrice, setPackRetailPrice] = useState('');
  const [packWholesalePrice, setPackWholesalePrice] = useState('');

  // Carton configuration
  const [hasCarton, setHasCarton] = useState(false);
  const [cartonUnitName, setCartonUnitName] = useState('Carton of 24');
  const [cartonSize, setCartonSize] = useState('24');
  const [cartonRetailPrice, setCartonRetailPrice] = useState('');
  const [cartonWholesalePrice, setCartonWholesalePrice] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  // New category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
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
  }, [products, categoryFilter, statusFilter, searchQuery]);

  const handleOpenAdd = () => {
    setName('');
    setCategoryId(categories[0]?.id || '');
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setBarcode('');
    setSellingPrice('');
    setWholesalePrice('');
    setCostPrice('');
    setBaseUnit('bottle');
    setStockQuantity('15');
    setMinStockThreshold('5');
    setHasPack(false);
    setPackUnitName('Pack of 12');
    setPackSize('12');
    setPackRetailPrice('');
    setPackWholesalePrice('');
    setHasCarton(false);
    setCartonUnitName('Carton of 24');
    setCartonSize('24');
    setCartonRetailPrice('');
    setCartonWholesalePrice('');
    setFormError(null);
    setIsAddProductOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const price = parseFloat(sellingPrice);
    const wholePrice = wholesalePrice ? parseFloat(wholesalePrice) : undefined;
    const cost = costPrice ? parseFloat(costPrice) : undefined;
    const qty = parseInt(stockQuantity, 10);
    const thresh = parseInt(minStockThreshold, 10) || 5;

    if (isNaN(price) || price < 0) {
      setFormError('Please enter a valid non-negative retail selling price.');
      return;
    }
    if (isNaN(qty) || qty < 0) {
      setFormError('Opening stock quantity cannot be negative.');
      return;
    }

    const pSize = parseInt(packSize, 10) || 12;
    const cSize = parseInt(cartonSize, 10) || 24;

    try {
      await createProduct({
        name: name.trim(),
        categoryId,
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || undefined,
        sellingPrice: price,
        wholesalePrice: wholePrice,
        costPrice: cost,
        baseUnit: baseUnit.trim().toLowerCase() || 'bottle',
        stockQuantity: qty,
        minStockThreshold: thresh,
        hasPack,
        packUnitName: hasPack ? (packUnitName.trim() || `Pack of ${pSize}`) : undefined,
        packSize: hasPack ? pSize : undefined,
        packRetailPrice: hasPack && packRetailPrice ? parseFloat(packRetailPrice) : undefined,
        packWholesalePrice: hasPack && packWholesalePrice ? parseFloat(packWholesalePrice) : undefined,
        hasCarton,
        cartonUnitName: hasCarton ? (cartonUnitName.trim() || `Carton of ${cSize}`) : undefined,
        cartonSize: hasCarton ? cSize : undefined,
        cartonRetailPrice: hasCarton && cartonRetailPrice ? parseFloat(cartonRetailPrice) : undefined,
        cartonWholesalePrice: hasCarton && cartonWholesalePrice ? parseFloat(cartonWholesalePrice) : undefined,
        active: true,
      });
      setIsAddProductOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error creating product.');
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategoryId(p.categoryId);
    setSku(p.sku);
    setBarcode(p.barcode || '');
    setSellingPrice(String(p.sellingPrice));
    setWholesalePrice(p.wholesalePrice !== undefined ? String(p.wholesalePrice) : '');
    setCostPrice(p.costPrice ? String(p.costPrice) : '');
    setBaseUnit(p.baseUnit || 'bottle');
    setMinStockThreshold(String(p.minStockThreshold));
    setHasPack(Boolean(p.hasPack));
    setPackUnitName(p.packUnitName || 'Pack of 12');
    setPackSize(p.packSize ? String(p.packSize) : '12');
    setPackRetailPrice(p.packRetailPrice !== undefined ? String(p.packRetailPrice) : '');
    setPackWholesalePrice(p.packWholesalePrice !== undefined ? String(p.packWholesalePrice) : '');
    setHasCarton(Boolean(p.hasCarton));
    setCartonUnitName(p.cartonUnitName || 'Carton of 24');
    setCartonSize(p.cartonSize ? String(p.cartonSize) : '24');
    setCartonRetailPrice(p.cartonRetailPrice !== undefined ? String(p.cartonRetailPrice) : '');
    setCartonWholesalePrice(p.cartonWholesalePrice !== undefined ? String(p.cartonWholesalePrice) : '');
    setFormError(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFormError(null);

    const price = parseFloat(sellingPrice);
    const wholePrice = wholesalePrice ? parseFloat(wholesalePrice) : undefined;
    const cost = costPrice ? parseFloat(costPrice) : undefined;
    const thresh = parseInt(minStockThreshold, 10) || 5;

    if (isNaN(price) || price < 0) {
      setFormError('Please enter a valid non-negative retail selling price.');
      return;
    }

    const pSize = parseInt(packSize, 10) || 12;
    const cSize = parseInt(cartonSize, 10) || 24;

    try {
      await updateProduct(editingProduct.id, {
        name: name.trim(),
        categoryId,
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || undefined,
        sellingPrice: price,
        wholesalePrice: wholePrice,
        costPrice: cost,
        baseUnit: baseUnit.trim().toLowerCase() || 'bottle',
        minStockThreshold: thresh,
        hasPack,
        packUnitName: hasPack ? (packUnitName.trim() || `Pack of ${pSize}`) : undefined,
        packSize: hasPack ? pSize : undefined,
        packRetailPrice: hasPack && packRetailPrice ? parseFloat(packRetailPrice) : undefined,
        packWholesalePrice: hasPack && packWholesalePrice ? parseFloat(packWholesalePrice) : undefined,
        hasCarton,
        cartonUnitName: hasCarton ? (cartonUnitName.trim() || `Carton of ${cSize}`) : undefined,
        cartonSize: hasCarton ? cSize : undefined,
        cartonRetailPrice: hasCarton && cartonRetailPrice ? parseFloat(cartonRetailPrice) : undefined,
        cartonWholesalePrice: hasCarton && cartonWholesalePrice ? parseFloat(cartonWholesalePrice) : undefined,
      });
      setEditingProduct(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error updating product.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
        active: true,
      });
      setNewCatName('');
      setNewCatDesc('');
      setIsAddCategoryOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create category', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-700" />
              <span>Product Catalogue &amp; Pricing</span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage supermarket catalog, SKU codes, barcodes, categories, and selling prices
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
                  <span>+ Category</span>
                </button>

                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Price edit requires Admin role</span>
              </div>
            )}
          </div>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'active' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'inactive' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Catalogue List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Item &amp; Category</th>
                  <th className="py-3 px-3">Identifiers (SKU / Barcode)</th>
                  <th className="py-3 px-3">Selling Price</th>
                  <th className="py-3 px-3">Cost Price</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No matching products found in catalogue.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const cat = categories.find((c) => c.id === p.categoryId);
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/70 transition ${
                          !p.active ? 'bg-slate-50/50 opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-500">{cat?.name || 'Uncategorized'}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                              Base: {p.baseUnit || 'bottle'}
                            </span>
                            {p.hasPack && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                {p.packUnitName || `Pack of ${p.packSize}`}
                              </span>
                            )}
                            {p.hasCarton && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">
                                {p.cartonUnitName || `Carton of ${p.cartonSize}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          <div>SKU: <strong className="text-slate-900">{p.sku}</strong></div>
                          {p.barcode && <div className="text-[10px] text-slate-400">Bar: {p.barcode}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-sm text-emerald-800">
                            {settings.currency}{p.sellingPrice.toLocaleString()}<span className="text-[10px] font-normal text-slate-500">/{p.baseUnit || 'unit'}</span>
                          </div>
                          {p.wholesalePrice !== undefined && (
                            <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                              Wholesale: {settings.currency}{p.wholesalePrice.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {p.costPrice ? `${settings.currency}${p.costPrice.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span
                            className={
                              p.stockQuantity <= 0
                                ? 'text-rose-600'
                                : p.stockQuantity <= p.minStockThreshold
                                ? 'text-amber-700'
                                : 'text-slate-800'
                            }
                          >
                            {p.stockQuantity} {p.baseUnit ? (p.stockQuantity === 1 ? p.baseUnit : `${p.baseUnit}s`) : 'units'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              p.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.active ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                                  title="Edit Product & Price"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void toggleProductActive(p.id).catch(() => undefined)}
                                  className={`p-1.5 rounded-lg transition ${
                                    p.active
                                      ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                      : 'text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={p.active ? 'Deactivate Product' : 'Reactivate Product'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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

      {/* MODAL: ADD PRODUCT */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-300" />
                <h3 className="text-base font-bold">Add Product to Catalogue</h3>
              </div>
              <button onClick={() => setIsAddProductOpen(false)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Golden Penny Semovita 2kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GPS-002"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Inventory Unit *</label>
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="bottle">Bottle (e.g. beer, soft drink, wine)</option>
                    <option value="can">Can (e.g. 33cl / 50cl malt, soda)</option>
                    <option value="sachet">Sachet (e.g. water, seasoning, powder)</option>
                    <option value="packet">Packet / Pouch (e.g. biscuits, noodles)</option>
                    <option value="tin">Tin (e.g. powdered milk, beverage)</option>
                    <option value="piece">Piece / Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode (EAN/UPC)</label>
                  <input
                    type="text"
                    placeholder="Optional (leave empty if none)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Pricing Rules: Retail vs Wholesale per Base Unit */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Retail Price / {baseUnit} ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 350"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-indigo-900 mb-1">
                    Wholesale Price / {baseUnit} (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 300"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50/50 text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Stock and Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cost Price / {baseUnit}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 280"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Stock ({baseUnit}s) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={minStockThreshold}
                    onChange={(e) => setMinStockThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Pack Selling Unit Configuration */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasPack}
                      onChange={(e) => setHasPack(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 text-xs">Configure Pack Selling Unit (e.g. 6-pack, 12-pack)</span>
                  </label>
                </div>

                {hasPack && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Pack Name</label>
                      <input
                        type="text"
                        value={packUnitName}
                        onChange={(e) => setPackUnitName(e.target.value)}
                        placeholder="Pack of 12"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Units / Pack *</label>
                      <input
                        type="number"
                        min="2"
                        value={packSize}
                        onChange={(e) => setPackSize(e.target.value)}
                        placeholder="12"
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Pack Retail (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={packRetailPrice}
                        onChange={(e) => setPackRetailPrice(e.target.value)}
                        placeholder="e.g. 4200"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-700 mb-0.5">Pack Wholesale (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={packWholesalePrice}
                        onChange={(e) => setPackWholesalePrice(e.target.value)}
                        placeholder="e.g. 3600"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Carton Selling Unit Configuration */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasCarton}
                      onChange={(e) => setHasCarton(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 text-xs">Configure Carton / Crate Unit (e.g. 24 or 36 bottles)</span>
                  </label>
                </div>

                {hasCarton && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Carton Name</label>
                      <input
                        type="text"
                        value={cartonUnitName}
                        onChange={(e) => setCartonUnitName(e.target.value)}
                        placeholder="Carton of 24"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Units / Carton *</label>
                      <input
                        type="number"
                        min="2"
                        value={cartonSize}
                        onChange={(e) => setCartonSize(e.target.value)}
                        placeholder="24"
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Carton Retail (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={cartonRetailPrice}
                        onChange={(e) => setCartonRetailPrice(e.target.value)}
                        placeholder="e.g. 8200"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-700 mb-0.5">Carton Wholesale (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={cartonWholesalePrice}
                        onChange={(e) => setCartonWholesalePrice(e.target.value)}
                        placeholder="e.g. 7000"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT & PRICE */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold">Edit Product &amp; Selling Price</h3>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Inventory Unit *</label>
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="bottle">Bottle (e.g. beer, soft drink, wine)</option>
                    <option value="can">Can (e.g. 33cl / 50cl malt, soda)</option>
                    <option value="sachet">Sachet (e.g. water, seasoning, powder)</option>
                    <option value="packet">Packet / Pouch (e.g. biscuits, noodles)</option>
                    <option value="tin">Tin (e.g. powdered milk, beverage)</option>
                    <option value="piece">Piece / Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Retail vs Wholesale Pricing per Base Unit */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <label className="block font-bold text-emerald-900 mb-1">
                    Retail Price / {baseUnit} ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold rounded-lg border border-emerald-300 bg-white text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                  <label className="block font-bold text-indigo-900 mb-1">
                    Wholesale Price / {baseUnit} ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-extrabold rounded-lg border border-indigo-300 bg-white text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Pack Selling Unit Configuration */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasPack}
                      onChange={(e) => setHasPack(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 text-xs">Configure Pack Selling Unit (e.g. 6-pack, 12-pack)</span>
                  </label>
                </div>

                {hasPack && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Pack Name</label>
                      <input
                        type="text"
                        value={packUnitName}
                        onChange={(e) => setPackUnitName(e.target.value)}
                        placeholder="Pack of 12"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Units / Pack *</label>
                      <input
                        type="number"
                        min="2"
                        value={packSize}
                        onChange={(e) => setPackSize(e.target.value)}
                        placeholder="12"
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Pack Retail (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={packRetailPrice}
                        onChange={(e) => setPackRetailPrice(e.target.value)}
                        placeholder="e.g. 4200"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-700 mb-0.5">Pack Wholesale (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={packWholesalePrice}
                        onChange={(e) => setPackWholesalePrice(e.target.value)}
                        placeholder="e.g. 3600"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Carton Selling Unit Configuration */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasCarton}
                      onChange={(e) => setHasCarton(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 text-xs">Configure Carton / Crate Unit (e.g. 24 or 36 bottles)</span>
                  </label>
                </div>

                {hasCarton && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Carton Name</label>
                      <input
                        type="text"
                        value={cartonUnitName}
                        onChange={(e) => setCartonUnitName(e.target.value)}
                        placeholder="Carton of 24"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Units / Carton *</label>
                      <input
                        type="number"
                        min="2"
                        value={cartonSize}
                        onChange={(e) => setCartonSize(e.target.value)}
                        placeholder="24"
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Carton Retail (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={cartonRetailPrice}
                        onChange={(e) => setCartonRetailPrice(e.target.value)}
                        placeholder="e.g. 8200"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-700 mb-0.5">Carton Wholesale (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={cartonWholesalePrice}
                        onChange={(e) => setCartonWholesalePrice(e.target.value)}
                        placeholder="e.g. 7000"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cost Price ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minStockThreshold}
                    onChange={(e) => setMinStockThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold shadow-sm transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">New Category</h3>
              </div>
              <button onClick={() => setIsAddCategoryOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frozen Foods / Canned Goods"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Short description of items in category"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
