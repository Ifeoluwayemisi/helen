export type UserRole = 'ADMIN' | 'CASHIER' | 'INVENTORY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  pin?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export type SellingUnitType = 'BASE' | 'PACK' | 'CARTON';
export type PriceTier = 'RETAIL' | 'WHOLESALE';

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  sku: string;
  barcode?: string;
  sellingPrice: number; // Retail price per base unit
  wholesalePrice?: number; // Optional wholesale price per base unit
  costPrice?: number;
  stockQuantity: number; // Stored in base units
  minStockThreshold: number;
  active: boolean;

  // Stage 4A: Selling units & conversion factors
  baseUnit: string; // e.g. 'bottle', 'can', 'sachet'
  hasPack?: boolean;
  packUnitName?: string; // e.g. 'Pack of 12'
  packSize?: number; // Conversion factor (base units per pack)
  packRetailPrice?: number;
  packWholesalePrice?: number;

  hasCarton?: boolean;
  cartonUnitName?: string; // e.g. 'Carton of 24'
  cartonSize?: number; // Conversion factor (base units per carton)
  cartonRetailPrice?: number;
  cartonWholesalePrice?: number;

  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'RECEIVED' | 'SALE' | 'ADJUSTMENT' | 'DAMAGED' | 'RETURN' | 'OPENING_STOCK';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantityChange: number; // positive for added, negative for deducted
  previousQuantity: number;
  resultingQuantity: number;
  userId: string;
  userName: string;
  note?: string;
  transactionId?: string;
  receiptNumber?: string;
  timestamp: string;
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS_CARD';

export interface CartItem {
  product: Product;
  quantity: number; // Quantity of chosen selling units
  unitPrice: number; // Price per chosen selling unit
  selectedUnit?: SellingUnitType; // 'BASE' | 'PACK' | 'CARTON'
  selectedUnitName?: string; // e.g. 'Bottle', 'Pack of 12', 'Carton of 24'
  unitConversionFactor?: number; // Multiplier into base units
  priceTier?: PriceTier; // 'RETAIL' | 'WHOLESALE'
  totalBaseUnits?: number; // quantity * unitConversionFactor
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPriceSnapshot?: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  taxAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paymentConfirmedBy?: string;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  idempotencyKey?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionType:
    | 'PRICE_CHANGE'
    | 'STOCK_ADJUSTMENT'
    | 'STOCK_RECEIVE'
    | 'STAFF_UPDATE'
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'SETTINGS_CHANGE'
    | 'SALE_COMPLETED'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'LOGIN_LOCKED'
    | 'LOGIN_BLOCKED'
    | 'FIRST_OWNER_PROVISIONED'
    | 'STAFF_CREATE'
    | 'STAFF_DEACTIVATE'
    | 'STAFF_ACTIVATE'
    | 'STAFF_PASSWORD_RESET'
    | string;
  entityType: 'PRODUCT' | 'USER' | 'SETTINGS' | 'INVENTORY' | 'SALE' | 'AUTH' | string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  details: string;
  timestamp: string;
}

export interface BusinessSettings {
  storeName: string;
  branchName: string;
  phone: string;
  address: string;
  currency: string;
  receiptFooter: string;
  taxRate: number; // e.g. 7.5%
  enableTax: boolean;
  lowStockGlobalThreshold: number;
  timezone: string;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}
