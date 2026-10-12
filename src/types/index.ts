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

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  minStockThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'RECEIVED' | 'SALE' | 'ADJUSTMENT' | 'DAMAGED' | 'RETURN';

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
  quantity: number;
  unitPrice: number;
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
  actionType: 'PRICE_CHANGE' | 'STOCK_ADJUSTMENT' | 'STOCK_RECEIVE' | 'STAFF_UPDATE' | 'PRODUCT_CREATE' | 'PRODUCT_UPDATE' | 'SETTINGS_CHANGE' | 'SALE_COMPLETED';
  entityType: 'PRODUCT' | 'USER' | 'SETTINGS' | 'INVENTORY' | 'SALE';
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
