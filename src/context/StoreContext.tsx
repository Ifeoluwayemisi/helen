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
  addToCart: (
    product: Product,
    quantity?: number,
    selectedUnit?: import('../types').SellingUnitType,
    priceTier?: import('../types').PriceTier
  ) => void;
  updateCartQuantity: (
    productId: string,
    quantity: number,
    selectedUnit?: import('../types').SellingUnitType,
    priceTier?: import('../types').PriceTier
  ) => void;
  removeFromCart: (
    productId: string,
    selectedUnit?: import('../types').SellingUnitType,
    priceTier?: import('../types').PriceTier
  ) => void;
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
  receiveStock: (params: {
    productId: string;
    quantity: number;
    sellingUnit?: import('../types').SellingUnitType;
    supplier?: string;
    note?: string;
    unitCost?: number;
  }) => Promise<void>;
  adjustStock: (params: {
    productId: string;
    newQuantity: number;
    reason: 'ADJUSTMENT' | 'DAMAGED' | 'RETURN';
    note: string;
  }) => Promise<void>;
  createProduct: (
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { openingStock?: number }
  ) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product | void>;
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

  // Authentication & Session State (Stage 3)
  isServerAuthenticated: boolean;
  serverUser: User | null;
  loginToServer: (email: string, credential: string) => Promise<{ success: boolean; error?: string }>;
  logoutFromServer: () => Promise<void>;
  resetStaffCredential: (id: string, credential: string) => Promise<void>;

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

  // Authentication & Session State (Stage 3)
  const [isServerAuthenticated, setIsServerAuthenticated] = useState<boolean>(false);
  const [serverUser, setServerUser] = useState<User | null>(null);

  // Live Database Sync State (Stage 2)
  const [apiSyncStatus, setApiSyncStatus] = useState<ApiSyncStatus>({
    status: 'idle',
    source: 'local_storage',
    message: 'Local storage active',
  });

  const syncStaffAndAudit = async () => {
    try {
      const [staffList, liveLogs] = await Promise.all([
        api.getStaff().catch(() => null),
        api.getAuditLogs().catch(() => null),
      ]);
      if (staffList && staffList.length > 0) {
        setDbState((prev) => ({ ...prev, users: staffList }));
      }
      if (liveLogs && liveLogs.length > 0) {
        setDbState((prev) => ({ ...prev, auditLogs: liveLogs }));
      }
    } catch {
      // ignore
    }
  };

  const checkSession = async () => {
    try {
      const activeUser = await api.getMe();
      if (activeUser) {
        setIsServerAuthenticated(true);
        setServerUser(activeUser);
        const match = db.getState().users.find((u) => u.id === activeUser.id);
        if (match) {
          db.setCurrentUser(activeUser.id);
        }
        if (activeUser.role === 'ADMIN') {
          syncStaffAndAudit();
        }
      } else {
        setIsServerAuthenticated(false);
        setServerUser(null);
      }
    } catch {
      setIsServerAuthenticated(false);
    }
  };

  const loginToServer = async (email: string, credential: string) => {
    try {
      const res = await api.login(email, credential);
      if (res.success && res.user) {
        setIsServerAuthenticated(true);
        setServerUser(res.user);
        const match = db.getState().users.find((u) => u.id === res.user.id);
        if (match) {
          db.setCurrentUser(res.user.id);
        }
        showToast(`Authenticated as ${res.user.name} (${res.user.role})`, 'success');
        if (res.user.role === 'ADMIN') {
          syncStaffAndAudit();
        }
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };

  const logoutFromServer = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      setIsServerAuthenticated(false);
      setServerUser(null);
      showToast('Logged out of server session', 'info');
    }
  };

  const resetStaffCredential = async (id: string, credential: string) => {
    try {
      await api.resetStaffCredential(id, credential);
      showToast('Staff credential updated on server', 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to reset credential';
      showToast(msg, 'error');
      throw e;
    }
  };

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

    // Attempt live catalog and session check on mount
    syncCatalogFromApi();
    checkSession();

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

  // Cart Functions (Stage 4A: Selling units and price tiers)
  const addToCart = (
    product: Product,
    quantity = 1,
    selectedUnit: import('../types').SellingUnitType = 'BASE',
    priceTier: import('../types').PriceTier = 'RETAIL'
  ) => {
    // Check available stock in live DB
    const liveProd = dbState.products.find((p) => p.id === product.id) || product;
    if (liveProd.stockQuantity <= 0) {
      showToast(`Cannot add "${product.name}": Out of stock!`, 'error');
      return;
    }

    // Determine unit conversion factor and effective unit price
    let conversionFactor = 1;
    let unitName = liveProd.baseUnit || 'bottle';
    let unitPrice = priceTier === 'WHOLESALE' && liveProd.wholesalePrice !== undefined
      ? liveProd.wholesalePrice
      : liveProd.sellingPrice;

    if (selectedUnit === 'PACK' && liveProd.hasPack) {
      conversionFactor = liveProd.packSize || 12;
      unitName = liveProd.packUnitName || `Pack of ${conversionFactor}`;
      unitPrice = priceTier === 'WHOLESALE' && liveProd.packWholesalePrice !== undefined
        ? liveProd.packWholesalePrice
        : (liveProd.packRetailPrice ?? (liveProd.sellingPrice * conversionFactor));
    } else if (selectedUnit === 'CARTON' && liveProd.hasCarton) {
      conversionFactor = liveProd.cartonSize || 24;
      unitName = liveProd.cartonUnitName || `Carton of ${conversionFactor}`;
      unitPrice = priceTier === 'WHOLESALE' && liveProd.cartonWholesalePrice !== undefined
        ? liveProd.cartonWholesalePrice
        : (liveProd.cartonRetailPrice ?? (liveProd.sellingPrice * conversionFactor));
    }

    setCart((prevCart) => {
      // Find existing item with exact same product, unit and price tier
      const existing = prevCart.find(
        (item) =>
          item.product.id === product.id &&
          (item.selectedUnit || 'BASE') === selectedUnit &&
          (item.priceTier || 'RETAIL') === priceTier
      );
      const existingQty = existing ? existing.quantity : 0;
      const targetQty = existingQty + quantity;

      // Validate total required base units against total inventory
      const totalBaseUnitsRequested = prevCart.reduce((sum, item) => {
        if (item.product.id !== product.id) return sum;
        const factor = item.unitConversionFactor || 1;
        const itemQty = item === existing ? targetQty : item.quantity;
        return sum + itemQty * factor;
      }, (existing ? 0 : targetQty * conversionFactor));

      if (totalBaseUnitsRequested > liveProd.stockQuantity) {
        showToast(
          `Only ${liveProd.stockQuantity} base ${liveProd.baseUnit || 'unit'}s available in stock!`,
          'error'
        );
        return prevCart;
      }

      if (existing) {
        return prevCart.map((item) =>
          item === existing
            ? {
                ...item,
                quantity: targetQty,
                unitPrice,
                totalBaseUnits: targetQty * conversionFactor,
              }
            : item
        );
      }

      return [
        ...prevCart,
        {
          product: liveProd,
          quantity,
          unitPrice,
          selectedUnit,
          selectedUnitName: unitName,
          unitConversionFactor: conversionFactor,
          priceTier,
          totalBaseUnits: quantity * conversionFactor,
        },
      ];
    });
  };

  const updateCartQuantity = (
    productId: string,
    quantity: number,
    selectedUnit: import('../types').SellingUnitType = 'BASE',
    priceTier: import('../types').PriceTier = 'RETAIL'
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedUnit, priceTier);
      return;
    }

    const liveProd = dbState.products.find((p) => p.id === productId);
    if (!liveProd) return;

    setCart((prev) => {
      const match = prev.find(
        (item) =>
          item.product.id === productId &&
          (item.selectedUnit || 'BASE') === selectedUnit &&
          (item.priceTier || 'RETAIL') === priceTier
      );
      if (!match) return prev;

      const factor = match.unitConversionFactor || 1;
      const otherBaseUnits = prev.reduce((sum, item) => {
        if (item.product.id !== productId || item === match) return sum;
        return sum + item.quantity * (item.unitConversionFactor || 1);
      }, 0);

      const requestedTotalBase = otherBaseUnits + quantity * factor;
      if (requestedTotalBase > liveProd.stockQuantity) {
        const maxUnits = Math.floor((liveProd.stockQuantity - otherBaseUnits) / factor);
        showToast(`Stock limit reached! Max available: ${maxUnits} ${match.selectedUnitName || 'units'}.`, 'error');
        quantity = Math.max(1, maxUnits);
      }

      return prev.map((item) =>
        item === match
          ? {
              ...item,
              quantity,
              totalBaseUnits: quantity * factor,
            }
          : item
      );
    });
  };

  const removeFromCart = (
    productId: string,
    selectedUnit?: import('../types').SellingUnitType,
    priceTier?: import('../types').PriceTier
  ) => {
    setCart((prev) =>
      prev.filter((item) => {
        if (item.product.id !== productId) return true;
        if (selectedUnit && (item.selectedUnit || 'BASE') !== selectedUnit) return true;
        if (priceTier && (item.priceTier || 'RETAIL') !== priceTier) return true;
        return false;
      })
    );
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

  const receiveStock = async (params: {
    productId: string;
    quantity: number;
    sellingUnit?: import('../types').SellingUnitType;
    supplier?: string;
    note?: string;
    unitCost?: number;
  }) => {
    try {
      if (isServerAuthenticated) {
        await api.receiveStock(params);
        // Sync catalog after server intake
        await syncCatalogFromApi();
      } else {
        db.receiveStock({ ...params, actor: currentUser });
      }
      showToast(`Stock replenished (+${params.quantity} units)`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to receive stock', 'error');
      throw e;
    }
  };

  const adjustStock = async (params: {
    productId: string;
    newQuantity: number;
    reason: 'ADJUSTMENT' | 'DAMAGED' | 'RETURN';
    note: string;
  }) => {
    try {
      if (isServerAuthenticated) {
        await api.adjustStock(params);
        await syncCatalogFromApi();
      } else {
        db.adjustStock({ ...params, actor: currentUser });
      }
      showToast(`Stock updated to ${params.newQuantity} units`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to adjust stock', 'error');
      throw e;
    }
  };

  const createProduct = async (
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { openingStock?: number }
  ): Promise<Product> => {
    try {
      if (isServerAuthenticated) {
        const prod = await api.createProduct(data);
        if (prod) {
          await syncCatalogFromApi();
          showToast(`Product "${prod.name}" added to catalogue`, 'success');
          return prod;
        }
      }
      const p = db.createProduct(data, currentUser);
      showToast(`Product "${p.name}" added to catalogue`, 'success');
      return p;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create product', 'error');
      throw e;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | void> => {
    try {
      if (isServerAuthenticated) {
        const prod = await api.updateProduct(id, updates);
        if (prod) {
          await syncCatalogFromApi();
          showToast('Product details updated on server', 'success');
          return prod;
        }
      }
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
      api
        .createStaff({
          name: data.name,
          email: data.email,
          role: data.role,
          credential: data.pin || '1234',
        })
        .catch((err) => {
          console.warn('Server staff creation fallback:', err.message);
        });
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
      api
        .updateStaff(id, {
          name: updates.name,
          email: updates.email,
          role: updates.role,
          active: updates.active,
        })
        .catch((err) => {
          console.warn('Server staff update fallback:', err.message);
        });
      showToast('Staff member updated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update staff member', 'error');
      throw e;
    }
  };

  const toggleUserActive = (id: string) => {
    try {
      const user = db.getState().users.find((u) => u.id === id);
      db.toggleUserActive(id, currentUser);
      if (user) {
        api
          .updateStaff(id, { active: !user.active })
          .catch((err) => {
            console.warn('Server staff toggle fallback:', err.message);
          });
      }
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
        isServerAuthenticated,
        serverUser,
        loginToServer,
        logoutFromServer,
        resetStaffCredential,
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
