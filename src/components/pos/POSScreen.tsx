import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, PaymentMethod } from '../../types';
import {
  Search,
  Barcode as BarcodeIcon,
  Plus,
  Minus,
  Trash2,
  Tag,
  CreditCard,
  Banknote,
  Building2,
  AlertTriangle,
  ArrowRight,
  X,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from '../receipts/ReceiptModal';

export const POSScreen: React.FC = () => {
  const {
    dbState,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    cartItemCount,
    discount,
    discountType,
    discountAmount,
    setDiscountVal,
    clearDiscount,
    taxAmount,
    totalPayable,
    processCheckout,
    activeReceipt,
    setActiveReceipt,
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [tempDiscountVal, setTempDiscountVal] = useState<string>('');
  const [tempDiscountType, setTempDiscountType] = useState<'fixed' | 'percentage'>('fixed');

  // Quick-Sale Unit & Price Tier Selection Modal (Stage 4A Quick-sale preparation)
  const [unitSelectProduct, setUnitSelectProduct] = useState<Product | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<import('../../types').SellingUnitType>('BASE');
  const [selectedPriceTier, setSelectedPriceTier] = useState<import('../../types').PriceTier>('RETAIL');
  const [unitQuantityInput, setUnitQuantityInput] = useState<number>(1);

  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { products, categories, settings } = dbState;

  // Filter products by category, active status, and search query
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (!prod.active) return false;
      if (selectedCategory !== 'all' && prod.categoryId !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesSku = prod.sku.toLowerCase().includes(q);
        const matchesBarcode = prod.barcode ? prod.barcode.toLowerCase().includes(q) : false;
        return matchesName || matchesSku || matchesBarcode;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle opening checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('CASH');
    setAmountPaidInput(String(totalPayable));
    setPaymentReference('');
    setTransferConfirmed(false);
    setCardConfirmed(false);
    setCheckoutError(null);
    setIsCheckoutOpen(true);
  };

  // Cash Quick Denominations
  const quickAddCash = (extra: number) => {
    const current = parseFloat(amountPaidInput) || 0;
    setAmountPaidInput(String(current + extra));
  };

  const setExactCash = () => {
    setAmountPaidInput(String(totalPayable));
  };

  const parsedAmountPaid = parseFloat(amountPaidInput) || 0;
  const cashChange = Math.max(0, parsedAmountPaid - totalPayable);
  const isCashSufficient = parsedAmountPaid >= totalPayable;

  // Execute payment completion
  const handleConfirmCheckout = async () => {
    setCheckoutError(null);

    if (paymentMethod === 'CASH' && !isCashSufficient) {
      setCheckoutError(`Amount tendered (${settings.currency}${parsedAmountPaid.toLocaleString()}) is less than total payable (${settings.currency}${totalPayable.toLocaleString()}).`);
      return;
    }

    if (paymentMethod === 'BANK_TRANSFER' && !transferConfirmed) {
      setCheckoutError('Please confirm that the bank transfer alert has been verified on the store account.');
      return;
    }

    if (paymentMethod === 'POS_CARD' && !cardConfirmed) {
      setCheckoutError('Please confirm that the POS terminal transaction printed an APPROVED receipt slip.');
      return;
    }

    setIsSubmitting(true);
    try {
      await processCheckout({
        paymentMethod,
        amountPaid: paymentMethod === 'CASH' ? parsedAmountPaid : totalPayable,
        paymentReference: paymentReference.trim() || undefined,
      });
      setIsCheckoutOpen(false);
      setIsCartOpenMobile(false);
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-100">
      {/* LEFT AREA: Product Search, Category Filters & Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU or barcode..."
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-xs transition active:scale-95"
              title="Scan Barcode with Camera"
            >
              <BarcodeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          {/* Category Tabs (Horizontal Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items ({products.filter((p) => p.active).length})
            </button>
            {categories
              .filter((c) => c.active)
              .map((cat) => {
                const count = products.filter((p) => p.active && p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
              <Package className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No products found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Try searching with a different keyword or select another category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockQuantity <= 0;
                const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= product.minStockThreshold;
                const inCart = cart.find((i) => i.product.id === product.id);

                return (
                  <button
                    key={product.id}
                    disabled={isOutOfStock}
                    onClick={() => {
                      if (product.hasPack || product.hasCarton || product.wholesalePrice !== undefined) {
                        setUnitSelectProduct(product);
                        setSelectedUnitType('BASE');
                        setSelectedPriceTier('RETAIL');
                        setUnitQuantityInput(1);
                      } else {
                        addToCart(product, 1, 'BASE', 'RETAIL');
                      }
                    }}
                    className={`relative flex flex-col justify-between text-left p-3 rounded-2xl border transition text-slate-900 ${
                      isOutOfStock
                        ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'bg-emerald-50/70 border-emerald-300 shadow-xs hover:border-emerald-400'
                        : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs active:scale-[0.98]'
                    }`}
                  >
                    {/* In cart badge */}
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      {/* SKU and Selling Units Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-slate-400 block truncate">
                          {product.sku}
                        </span>
                        {product.hasCarton && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1 rounded">
                            Carton
                          </span>
                        )}
                        {product.hasPack && !product.hasCarton && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1 rounded">
                            Pack
                          </span>
                        )}
                      </div>
                      {/* Product Name */}
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-end justify-between">
                      <div>
                        {/* Price */}
                        <div className="text-xs sm:text-sm font-extrabold text-emerald-800">
                          {settings.currency}{product.sellingPrice.toLocaleString()}
                          <span className="text-[10px] font-normal text-slate-500">/{product.baseUnit || 'btl'}</span>
                        </div>
                        {product.wholesalePrice !== undefined && (
                          <div className="text-[10px] text-indigo-700 font-semibold leading-none mt-0.5">
                            Ws: {settings.currency}{product.wholesalePrice.toLocaleString()}
                          </div>
                        )}
                        {/* Stock indicator */}
                        <div className="text-[10px] font-medium mt-0.5">
                          {isOutOfStock ? (
                            <span className="text-rose-600 font-bold">Out of stock</span>
                          ) : isLowStock ? (
                            <span className="text-amber-700 font-semibold">
                              Low: {product.stockQuantity} left
                            </span>
                          ) : (
                            <span className="text-slate-500">{product.stockQuantity} in stock</span>
                          )}
                        </div>
                      </div>

                      {!isOutOfStock && (
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Sticky Bottom Cart Trigger Bar */}
        <div className="lg:hidden p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {cartItemCount}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Due</div>
              <div className="text-base font-extrabold text-slate-900">
                {settings.currency}{totalPayable.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsCartOpenMobile(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-95'
            }`}
          >
            <span>View Cart</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RIGHT AREA: POS Cart & Checkout Drawer (Desktop fixed sidebar & mobile slide-over) */}
      <div
        className={`fixed inset-0 z-40 lg:relative lg:z-auto lg:w-96 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          isCartOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } ${!isCartOpenMobile ? 'hidden lg:flex' : 'flex'}`}
      >
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Current Sale</h3>
            <p className="text-xs text-slate-500">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in basket
            </p>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="p-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                title="Clear Cart"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsCartOpenMobile(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Your cart is empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Select products from the catalogue or use the barcode scanner to add items.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={`${item.product.id}_${item.selectedUnit || 'BASE'}_${item.priceTier || 'RETAIL'}`}
                className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h5 className="text-xs font-bold text-slate-900 truncate">
                        {item.product.name}
                      </h5>
                      {item.selectedUnit && item.selectedUnit !== 'BASE' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                          {item.selectedUnitName || item.selectedUnit}
                        </span>
                      )}
                      {item.priceTier === 'WHOLESALE' && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.2 rounded">
                          WHOLESALE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {settings.currency}{item.unitPrice.toLocaleString()}/{item.selectedUnitName || item.product.baseUnit || 'unit'}
                      {item.totalBaseUnits && item.totalBaseUnits !== item.quantity && (
                        <span className="text-slate-400"> ({item.totalBaseUnits} {item.product.baseUnit || 'bottle'}s)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-emerald-800 whitespace-nowrap">
                    {settings.currency}{(item.quantity * item.unitPrice).toLocaleString()}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.selectedUnit, item.priceTier)}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        updateCartQuantity(item.product.id, val, item.selectedUnit, item.priceTier);
                      }}
                      className="w-12 h-7 text-center font-bold text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <button
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.selectedUnit, item.priceTier)}
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id, item.selectedUnit, item.priceTier)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Checkout Trigger */}
        {cart.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
            {/* Subtotal & Discount rows */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold">
                  {settings.currency}{cartSubtotal.toLocaleString()}
                </span>
              </div>

              {discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-semibold items-center">
                  <div className="flex items-center gap-1">
                    <span>Discount</span>
                    <button
                      onClick={clearDiscount}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remove discount"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span>-{settings.currency}{discountAmount.toLocaleString()}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempDiscountVal('');
                    setIsDiscountModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-[11px] font-semibold"
                >
                  <Tag className="w-3 h-3" />
                  <span>+ Add Discount</span>
                </button>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT ({settings.taxRate}%)</span>
                  <span>{settings.currency}{taxAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Due</span>
                <span className="text-emerald-900">
                  {settings.currency}{totalPayable.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenCheckout}
              className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md transition active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL: Apply Discount */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-700" />
                Apply Discount
              </h3>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTempDiscountType('fixed')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    tempDiscountType === 'fixed'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Amount ({settings.currency})
                </button>
                <button
                  type="button"
                  onClick={() => setTempDiscountType('percentage')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    tempDiscountType === 'percentage'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Percentage (%)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  min={0}
                  max={tempDiscountType === 'percentage' ? 100 : cartSubtotal}
                  placeholder={tempDiscountType === 'percentage' ? 'e.g. 5' : 'e.g. 500'}
                  value={tempDiscountVal}
                  onChange={(e) => setTempDiscountVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(tempDiscountVal) || 0;
                  setDiscountVal(val, tempDiscountType);
                  setIsDiscountModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Payment Checkout Flow */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold">Complete Sale</h3>
                <p className="text-xs text-slate-400">
                  {cartItemCount} items · Total: {settings.currency}{totalPayable.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Display */}
            <div className="bg-emerald-800 text-white p-5 text-center">
              <div className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
                Amount Payable
              </div>
              <div className="text-3xl font-extrabold mt-0.5">
                {settings.currency}{totalPayable.toLocaleString()}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {checkoutError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setAmountPaidInput(String(totalPayable));
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'CASH'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Banknote className="w-5 h-5 mb-1 text-emerald-700" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('BANK_TRANSFER');
                      setAmountPaidInput(String(totalPayable));
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mb-1 text-emerald-700" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('POS_CARD');
                      setAmountPaidInput(String(totalPayable));
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === 'POS_CARD'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mb-1 text-emerald-700" />
                    <span>POS / Card</span>
                  </button>
                </div>
              </div>

              {/* METHOD 1: CASH DETAILS */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cash Tendered ({settings.currency})
                    </label>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-full px-3 py-2 text-base font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={setExactCash}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    >
                      Exact ({settings.currency}{totalPayable.toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => quickAddCash(500)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      +500
                    </button>
                    <button
                      type="button"
                      onClick={() => quickAddCash(1000)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      +1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => quickAddCash(5000)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      +5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => quickAddCash(10000)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      +10,000
                    </button>
                  </div>

                  {/* Change Breakdown */}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">Change to Return:</span>
                    <span
                      className={`text-base font-extrabold ${
                        isCashSufficient ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {isCashSufficient
                        ? `${settings.currency}${cashChange.toLocaleString()}`
                        : `Short by ${settings.currency}${(totalPayable - parsedAmountPaid).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              )}

              {/* METHOD 2: BANK TRANSFER DETAILS */}
              {paymentMethod === 'BANK_TRANSFER' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  {settings.bankDetails && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">Store Bank Account</div>
                      <div className="text-slate-600">
                        Bank: <strong className="text-slate-800">{settings.bankDetails.bankName}</strong>
                      </div>
                      <div className="text-slate-600">
                        Account Name: <strong className="text-slate-800">{settings.bankDetails.accountName}</strong>
                      </div>
                      <div className="text-slate-600 font-mono text-sm font-extrabold text-emerald-800">
                        {settings.bankDetails.accountNumber}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Transfer Reference / Session ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GTB-TRF-492102"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <label className="flex items-start gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferConfirmed}
                      onChange={(e) => setTransferConfirmed(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="font-semibold text-slate-800">
                      I have confirmed that the funds have reached the store bank account (BR-08 Payment Confirmation).
                    </span>
                  </label>
                </div>
              )}

              {/* METHOD 3: POS CARD DETAILS */}
              {paymentMethod === 'POS_CARD' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      POS Approval Code / Terminal Ref (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STANBIC-POS-9812"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <label className="flex items-start gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardConfirmed}
                      onChange={(e) => setCardConfirmed(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="font-semibold text-slate-800">
                      The customer card was debited and the terminal issued an APPROVED receipt slip.
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
              >
                Back to Cart
              </button>

              <button
                type="button"
                onClick={handleConfirmCheckout}
                disabled={isSubmitting}
                className="flex-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-extrabold shadow-md transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Finalizing Sale...' : 'Confirm & Complete Sale'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK-SALE: SELLING UNIT & PRICING SELECTION MODAL (Stage 4A Quick-sale preparation) */}
      {unitSelectProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Quick-Sale Configuration
                </span>
                <h3 className="text-sm font-bold truncate max-w-[260px]">
                  {unitSelectProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setUnitSelectProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {/* Product Info & Stock */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">SKU: {unitSelectProduct.sku}</span>
                  <span className="font-bold text-slate-800">
                    Stock: {unitSelectProduct.stockQuantity} {unitSelectProduct.baseUnit || 'bottle'}s
                  </span>
                </div>
                <span className="text-xs font-extrabold text-emerald-800">
                  {settings.currency}{unitSelectProduct.sellingPrice.toLocaleString()}/{unitSelectProduct.baseUnit || 'bottle'}
                </span>
              </div>

              {/* 1. Choose Selling Unit */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  1. Choose Selling Unit
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedUnitType('BASE')}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                      selectedUnitType === 'BASE'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>Single {unitSelectProduct.baseUnit || 'Bottle'} (1 unit)</span>
                    <span className="text-xs font-mono">
                      {settings.currency}
                      {(selectedPriceTier === 'WHOLESALE' && unitSelectProduct.wholesalePrice !== undefined
                        ? unitSelectProduct.wholesalePrice
                        : unitSelectProduct.sellingPrice
                      ).toLocaleString()}
                    </span>
                  </button>

                  {unitSelectProduct.hasPack && (
                    <button
                      type="button"
                      onClick={() => setSelectedUnitType('PACK')}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                        selectedUnitType === 'PACK'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{unitSelectProduct.packUnitName || `Pack of ${unitSelectProduct.packSize}`} ({unitSelectProduct.packSize} {unitSelectProduct.baseUnit || 'bottle'}s)</span>
                      <span className="text-xs font-mono">
                        {settings.currency}
                        {(selectedPriceTier === 'WHOLESALE' && unitSelectProduct.packWholesalePrice !== undefined
                          ? unitSelectProduct.packWholesalePrice
                          : (unitSelectProduct.packRetailPrice ?? (unitSelectProduct.sellingPrice * (unitSelectProduct.packSize || 12)))
                        ).toLocaleString()}
                      </span>
                    </button>
                  )}

                  {unitSelectProduct.hasCarton && (
                    <button
                      type="button"
                      onClick={() => setSelectedUnitType('CARTON')}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                        selectedUnitType === 'CARTON'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{unitSelectProduct.cartonUnitName || `Carton of ${unitSelectProduct.cartonSize}`} ({unitSelectProduct.cartonSize} {unitSelectProduct.baseUnit || 'bottle'}s)</span>
                      <span className="text-xs font-mono">
                        {settings.currency}
                        {(selectedPriceTier === 'WHOLESALE' && unitSelectProduct.cartonWholesalePrice !== undefined
                          ? unitSelectProduct.cartonWholesalePrice
                          : (unitSelectProduct.cartonRetailPrice ?? (unitSelectProduct.sellingPrice * (unitSelectProduct.cartonSize || 24)))
                        ).toLocaleString()}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Choose Price Tier */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  2. Choose Pricing Rule
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPriceTier('RETAIL')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition ${
                      selectedPriceTier === 'RETAIL'
                        ? 'border-emerald-600 bg-emerald-700 text-white shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Retail Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPriceTier('WHOLESALE')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition ${
                      selectedPriceTier === 'WHOLESALE'
                        ? 'border-indigo-600 bg-indigo-700 text-white shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Wholesale Sale
                  </button>
                </div>
              </div>

              {/* 3. Quantity input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. Enter Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitQuantityInput((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={unitQuantityInput}
                    onChange={(e) => setUnitQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 py-1.5 text-center font-extrabold text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setUnitQuantityInput((q) => q + 1)}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnitSelectProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToCart(unitSelectProduct, unitQuantityInput, selectedUnitType, selectedPriceTier);
                    setUnitSelectProduct(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductFound={(product) => {
          if (product.hasPack || product.hasCarton || product.wholesalePrice !== undefined) {
            setUnitSelectProduct(product);
            setSelectedUnitType('BASE');
            setSelectedPriceTier('RETAIL');
            setUnitQuantityInput(1);
          } else {
            addToCart(product, 1, 'BASE', 'RETAIL');
          }
        }}
      />

      {/* Receipt Modal (after sale or reprint) */}
      <ReceiptModal
        sale={activeReceipt}
        onClose={() => setActiveReceipt(null)}
        onNewSale={() => {
          setActiveReceipt(null);
          clearCart();
        }}
        isNewSaleCompleted={true}
      />
    </div>
  );
};
