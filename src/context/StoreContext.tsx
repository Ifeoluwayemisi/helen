import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db, DatabaseState } from '../services/store';
import {
  User,
  Product,
  CartItem,
  Sale,
  PaymentMethod,
  Category,
  BusinessSettings,
} from '../types';
import { api } from '../services/api';

export interface ApiSyncStatus {
  status: 'idle' | 'loading' | 'synced' | 'error';
  source: 'database' | 'local_storage';
  message?: string;
  lastChecked?: string;
}

interface StoreContextValue {
  dbState: DatabaseState;
  currentUser: User;
  switchUser: (userId: string) => void;

  // Live Database Sync State (Stage 2)
  apiSyncStatus: ApiSyncStatus;
  syncCatalogFromApi: () => Promise<void>;

  // Cart Management
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartItemCount: number;

  // Discount
  discount: number;
  discountType: 'fixed' | 'percentage';
  discountAmount: number;
  setDiscountVal: (amount: number, type: 'fixed' | 'percentage') => void;
  clearDiscount: () => void;

  // Final calculated payable
  taxAmount: number;
  totalPayable: number;

  // Sale Completion
  processCheckout: (params: {
    paymentMethod: PaymentMethod;
    amountPaid: number;
    paymentReference?: string;
  }) => Promise<Sale>;

  // Receipt & Navigation
  activeReceipt: Sale | null;
  setActiveReceipt: (sale: Sale | null) => void;

  // Inventory & Product methods
  receiveStock: (params: { productId: string; quantity: number; supplier?: string; note?: string; unitCost?: number }) => void;
  adjustStock: (params: { productId: string; newQuantity: number; reason: 'ADJUSTMENT' | 'DAMAGED' | 'RETURN'; note: string }) => void;
  createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  toggleProductActive: (id: string) => void;
  createCategory: (data: Omit<Category, 'id' | 'createdAt'>) => Category;

  // User Management
  createUser: (data: Omit<User, 'id' | 'createdAt'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  toggleUserActive: (id: string) => void;

  // Settings & DB Management
  updateSettings: (settings: Partial<BusinessSettings>) => void;
  exportDatabase: () => string;
  importDatabase: (json: string) => void;
  resetDatabase: () => void;

  // Toast / Notifications
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbState, setDbState] = useState<DatabaseState>(db.getState());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [activeReceipt, setActiveReceipt] = useState<Sale | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3800);
  };

  // Live Database Sync State (Stage 2)
  const [apiSyncStatus, setApiSyncStatus] = useState<ApiSyncStatus>({
    status: 'idle',
    source: 'local_storage',
    message: 'Local storage active',
  });

  const syncCatalogFromApi = async () => {
    setApiSyncStatus((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Fetching live catalog from PostgreSQL API...',
    }));

    try {
      const [liveProducts, liveCategories] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
      ]);

      if (Array.isArray(liveProducts) && Array.isArray(liveCategories) && liveProducts.length > 0) {
        setDbState((prev) => ({
          ...prev,
          products: liveProducts,
          categories: liveCategories,
        }));

        setApiSyncStatus({
          status: 'synced',
          source: 'database',
          message: `Connected to live database (${liveProducts.length} products, ${liveCategories.length} categories)`,
          lastChecked: new Date().toISOString(),
        });
      } else {
        setApiSyncStatus({
          status: 'synced',
          source: 'database',
          message: 'Live database connected (empty catalog)',
          lastChecked: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'API offline';
      // Explicitly label as development fallback without throwing or corrupting local state
      setApiSyncStatus({
        status: 'error',
        source: 'local_storage',
        message: `API unreached (${errorMsg}). Retaining local storage catalog (development fallback).`,
        lastChecked: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setDbState({ ...db.getState() });
    });

    // Attempt live catalog sync on mount
    syncCatalogFromApi();

    return unsubscribe;
  }, []);

  const currentUser = dbState.currentUser;

  const switchUser = (userId: string) => {
    try {
      db.setCurrentUser(userId);
      const user = db.getState().users.find((u) => u.id === userId);
      if (user) {
        showToast(`Switched user to ${user.name} (${user.role})`, 'success');
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to switch user', 'error');
    }
  };

  // Cart Functions
  const addToCart = (product: Product, quantity = 1) => {
    // Check available stock in live DB
    const liveProd = dbState.products.find((p) => p.id === product.id) || product;
    if (liveProd.stockQuantity <= 0) {
      showToast(`Cannot add "${product.name}": Out of stock!`, 'error');
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      const existingQty = existing ? existing.quantity : 0;
      const targetQty = existingQty + quantity;

      if (targetQty > liveProd.stockQuantity) {
        showToast(`Only ${liveProd.stockQuantity} units available in stock!`, 'error');
        return prevCart;
      }

      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: targetQty }
            : item
        );
      }
      return [...prevCart, { product: liveProd, quantity, unitPrice: liveProd.sellingPrice }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const liveProd = dbState.products.find((p) => p.id === productId);
    if (!liveProd) return;

    if (quantity > liveProd.stockQuantity) {
      showToast(`Stock limit reached! Only ${liveProd.stockQuantity} in stock.`, 'error');
      quantity = liveProd.stockQuantity;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const setDiscountVal = (val: number, type: 'fixed' | 'percentage') => {
    setDiscount(Math.max(0, val));
    setDiscountType(type);
  };

  const clearDiscount = () => {
    setDiscount(0);
    setDiscountType('fixed');
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discount <= 0 || cartSubtotal <= 0) return 0;
    if (discountType === 'percentage') {
      return Math.round((cartSubtotal * Math.min(100, discount)) / 100);
    }
    return Math.min(cartSubtotal, discount);
  }, [cartSubtotal, discount, discountType]);

  const netSubtotal = Math.max(0, cartSubtotal - discountAmount);

  const taxAmount = useMemo(() => {
    if (!dbState.settings.enableTax || dbState.settings.taxRate <= 0) return 0;
    return Math.round(netSubtotal * (dbState.settings.taxRate / 100));
  }, [dbState.settings.enableTax, dbState.settings.taxRate, netSubtotal]);

  const totalPayable = netSubtotal + taxAmount;

  // Checkout process
  const processCheckout = async (params: {
    paymentMethod: PaymentMethod;
    amountPaid: number;
    paymentReference?: string;
  }): Promise<Sale> => {
    try {
      const sale = db.createSale({
        items: cart,
        subtotal: cartSubtotal,
        discount: discountAmount,
        discountType,
        paymentMethod: params.paymentMethod,
        amountPaid: params.amountPaid,
        paymentReference: params.paymentReference,
        actor: currentUser,
      });

      // Clear cart on successful transaction
      setCart([]);
      setDiscount(0);
      setActiveReceipt(sale);
      showToast(`Sale completed! Receipt #${sale.receiptNumber}`, 'success');
      return sale;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed.';
      showToast(msg, 'error');
      throw e;
    }
  };

  const receiveStock = (params: {
    productId: string;
    quantity: number;
    supplier?: string;
    note?: string;
    unitCost?: number;
  }) => {
    try {
      db.receiveStock({ ...params, actor: currentUser });
      showToast(`Stock replenished (+${params.quantity} units)`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to receive stock', 'error');
      throw e;
    }
  };

  const adjustStock = (params: {
    productId: string;
    newQuantity: number;
    reason: 'ADJUSTMENT' | 'DAMAGED' | 'RETURN';
    note: string;
  }) => {
    try {
      db.adjustStock({ ...params, actor: currentUser });
      showToast(`Stock updated to ${params.newQuantity} units`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to adjust stock', 'error');
      throw e;
    }
  };

  const createProduct = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const p = db.createProduct(data, currentUser);
      showToast(`Product "${p.name}" added to catalogue`, 'success');
      return p;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create product', 'error');
      throw e;
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    try {
      db.updateProduct(id, updates, currentUser);
      showToast('Product details updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update product', 'error');
      throw e;
    }
  };

  const toggleProductActive = (id: string) => {
    try {
      db.toggleProductActive(id, currentUser);
      showToast('Product status updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to toggle product status', 'error');
      throw e;
    }
  };

  const createCategory = (data: Omit<Category, 'id' | 'createdAt'>) => {
    try {
      const c = db.createCategory(data, currentUser);
      showToast(`Category "${c.name}" created`, 'success');
      return c;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create category', 'error');
      throw e;
    }
  };

  const createUser = (data: Omit<User, 'id' | 'createdAt'>) => {
    try {
      const u = db.createUser(data, currentUser);
      showToast(`Staff member "${u.name}" created`, 'success');
      return u;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create staff member', 'error');
      throw e;
    }
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    try {
      db.updateUser(id, updates, currentUser);
      showToast('Staff member updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update staff member', 'error');
      throw e;
    }
  };

  const toggleUserActive = (id: string) => {
    try {
      db.toggleUserActive(id, currentUser);
      showToast('Staff account status updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update staff status', 'error');
      throw e;
    }
  };

  const updateSettings = (settings: Partial<BusinessSettings>) => {
    try {
      db.updateSettings(settings, currentUser);
      showToast('Store settings saved', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update settings', 'error');
      throw e;
    }
  };

  const exportDatabase = () => {
    return db.exportDatabase();
  };

  const importDatabase = (json: string) => {
    try {
      db.importDatabase(json, currentUser);
      showToast('Database imported successfully', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to import database', 'error');
      throw e;
    }
  };

  const resetDatabase = () => {
    try {
      db.resetDatabase(currentUser);
      clearCart();
      showToast('Database reset to demonstration defaults', 'info');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to reset database', 'error');
      throw e;
    }
  };

  return (
    <StoreContext.Provider
      value={{
        dbState,
        currentUser,
        switchUser,
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
        receiveStock,
        adjustStock,
        createProduct,
        updateProduct,
        toggleProductActive,
        createCategory,
        createUser,
        updateUser,
        toggleUserActive,
        updateSettings,
        exportDatabase,
        importDatabase,
        resetDatabase,
        toastMessage,
        toastType,
        showToast,
        apiSyncStatus,
        syncCatalogFromApi,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
