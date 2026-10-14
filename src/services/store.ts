import {
  User,
  Category,
  Product,
  StockMovement,
  Sale,
  AuditLog,
  BusinessSettings,
  PaymentMethod,
  CartItem,
  SaleItem,
} from '../types';

const STORAGE_KEY = 'hellen_store_pos_db_v1';

export interface DatabaseState {
  users: User[];
  currentUser: User;
  categories: Category[];
  products: Product[];
  sales: Sale[];
  movements: StockMovement[];
  auditLogs: AuditLog[];
  settings: BusinessSettings;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'user_admin_1',
    name: 'Hellen Olayode',
    email: 'hellen@hellenstore.com',
    role: 'ADMIN',
    active: true,
    pin: '1234',
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'user_cashier_1',
    name: 'Blessing Adebayo',
    email: 'blessing@hellenstore.com',
    role: 'CASHIER',
    active: true,
    pin: '0000',
    createdAt: '2026-10-02T09:00:00Z',
  },
  {
    id: 'user_inventory_1',
    name: 'Emeka Nwosu',
    email: 'emeka@hellenstore.com',
    role: 'INVENTORY',
    active: true,
    pin: '5555',
    createdAt: '2026-10-03T09:00:00Z',
  },
];

const DEFAULT_SETTINGS: BusinessSettings = {
  storeName: 'Hellen Store',
  branchName: 'Main Supermarket Branch',
  phone: '+234 802 345 6789',
  address: '14 Commercial Avenue, Yaba, Lagos',
  currency: '₦',
  receiptFooter: 'Thank you for shopping at Hellen Store! Please retain receipt for exchange within 48hrs.',
  taxRate: 0,
  enableTax: false,
  lowStockGlobalThreshold: 10,
  timezone: 'Africa/Lagos',
  bankDetails: {
    bankName: 'GTBank / Access Bank',
    accountName: 'Hellen Store Enterprise',
    accountNumber: '0123456789',
  },
};

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat_groceries',
    name: 'Groceries & Staples',
    description: 'Flour, rice, grains, sugar, spices and pantry essentials',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'cat_beverages',
    name: 'Beverages & Drinks',
    description: 'Juices, water, soft drinks, milk, tea and coffee',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'cat_bakery',
    name: 'Bakery & Snacks',
    description: 'Fresh bread, pastries, biscuits, crisps and confectionery',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'cat_toiletries',
    name: 'Household & Toiletries',
    description: 'Soaps, detergents, toiletries, and cleaning supplies',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'cat_dairy',
    name: 'Dairy & Chilled',
    description: 'Eggs, cheese, butter, yoghurts and chilled food',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
  },
];

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Mama Gold Parboiled Rice 5kg',
    categoryId: 'cat_groceries',
    sku: 'MGR-005',
    barcode: '6151234567890',
    sellingPrice: 9500,
    costPrice: 8200,
    stockQuantity: 28,
    minStockThreshold: 10,
    baseUnit: 'bag',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_2',
    name: 'Golden Penny Semovita 2kg',
    categoryId: 'cat_groceries',
    sku: 'GPS-002',
    barcode: '6152345678901',
    sellingPrice: 3400,
    costPrice: 2900,
    stockQuantity: 4,
    minStockThreshold: 10,
    baseUnit: 'bag',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_3',
    name: 'Dangote Refined Sugar 1kg',
    categoryId: 'cat_groceries',
    sku: 'DRS-001',
    barcode: '6153456789012',
    sellingPrice: 2200,
    costPrice: 1900,
    stockQuantity: 45,
    minStockThreshold: 12,
    baseUnit: 'packet',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_4',
    name: 'Kings Pure Vegetable Oil 1L',
    categoryId: 'cat_groceries',
    sku: 'KVO-001',
    barcode: '6154567890123',
    sellingPrice: 3800,
    costPrice: 3200,
    stockQuantity: 18,
    minStockThreshold: 8,
    baseUnit: 'bottle',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_5',
    name: 'Indomie Instant Noodles Super Pack (120g x 10)',
    categoryId: 'cat_groceries',
    sku: 'IND-010',
    barcode: '6155678901234',
    sellingPrice: 4800,
    wholesalePrice: 4200,
    costPrice: 4200,
    stockQuantity: 5,
    minStockThreshold: 15,
    baseUnit: 'packet',
    hasCarton: true,
    cartonUnitName: 'Carton of 40',
    cartonSize: 40,
    cartonRetailPrice: 18500,
    cartonWholesalePrice: 16800,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_6',
    name: 'Peak Full Cream Milk Powder 400g Tin',
    categoryId: 'cat_beverages',
    sku: 'PKM-400',
    barcode: '6156789012345',
    sellingPrice: 4500,
    wholesalePrice: 4100,
    costPrice: 3900,
    stockQuantity: 0,
    minStockThreshold: 8,
    baseUnit: 'tin',
    hasCarton: true,
    cartonUnitName: 'Carton of 24',
    cartonSize: 24,
    cartonRetailPrice: 105000,
    cartonWholesalePrice: 96000,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_7',
    name: 'Milo Cocoa Beverage Refill 500g',
    categoryId: 'cat_beverages',
    sku: 'MLO-500',
    barcode: '6157890123456',
    sellingPrice: 4100,
    costPrice: 3500,
    stockQuantity: 22,
    minStockThreshold: 10,
    baseUnit: 'pouch',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_8',
    name: 'Coca-Cola Original 50cl PET',
    categoryId: 'cat_beverages',
    sku: 'COK-500',
    barcode: '6158901234567',
    sellingPrice: 350,
    wholesalePrice: 300,
    costPrice: 280,
    stockQuantity: 120,
    minStockThreshold: 24,
    baseUnit: 'bottle',
    hasPack: true,
    packUnitName: 'Pack of 12',
    packSize: 12,
    packRetailPrice: 4200,
    packWholesalePrice: 3600,
    hasCarton: true,
    cartonUnitName: 'Carton of 24',
    cartonSize: 24,
    cartonRetailPrice: 8200,
    cartonWholesalePrice: 7000,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_9',
    name: 'Chi Exotic Pineapple Juice 1L',
    categoryId: 'cat_beverages',
    sku: 'CEX-001',
    barcode: '6159012345678',
    sellingPrice: 2100,
    wholesalePrice: 1850,
    costPrice: 1750,
    stockQuantity: 45,
    minStockThreshold: 10,
    baseUnit: 'pack',
    hasCarton: true,
    cartonUnitName: 'Carton of 10',
    cartonSize: 10,
    cartonRetailPrice: 20500,
    cartonWholesalePrice: 18000,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_10',
    name: 'Eva Bottled Mineral Water 75cl',
    categoryId: 'cat_beverages',
    sku: 'EVA-750',
    barcode: '6150123456789',
    sellingPrice: 250,
    wholesalePrice: 200,
    costPrice: 180,
    stockQuantity: 96,
    minStockThreshold: 24,
    baseUnit: 'bottle',
    hasPack: true,
    packUnitName: 'Pack of 12',
    packSize: 12,
    packRetailPrice: 2800,
    packWholesalePrice: 2300,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_11',
    name: 'Hellen Bakery Fresh Sliced Butter Bread 800g',
    categoryId: 'cat_bakery',
    sku: 'HBB-800',
    barcode: '6151122334455',
    sellingPrice: 1600,
    costPrice: 1100,
    stockQuantity: 19,
    minStockThreshold: 8,
    baseUnit: 'loaf',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_12',
    name: 'McVitie Digestive Biscuits 400g',
    categoryId: 'cat_bakery',
    sku: 'MVD-400',
    barcode: '6152233445566',
    sellingPrice: 1950,
    costPrice: 1550,
    stockQuantity: 26,
    minStockThreshold: 10,
    baseUnit: 'roll',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_13',
    name: 'Pringles Potato Crisps Sour Cream 165g',
    categoryId: 'cat_bakery',
    sku: 'PNG-165',
    barcode: '6153344556677',
    sellingPrice: 3200,
    costPrice: 2600,
    stockQuantity: 14,
    minStockThreshold: 6,
    baseUnit: 'can',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_14',
    name: 'Ariel Automatic Detergent Powder 900g',
    categoryId: 'cat_toiletries',
    sku: 'ARL-900',
    barcode: '6154455667788',
    sellingPrice: 3100,
    costPrice: 2500,
    stockQuantity: 30,
    minStockThreshold: 10,
    baseUnit: 'bag',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_15',
    name: 'Dettol Original Antiseptic Bath Soap (110g x 3)',
    categoryId: 'cat_toiletries',
    sku: 'DTL-330',
    barcode: '6155566778899',
    sellingPrice: 2600,
    costPrice: 2100,
    stockQuantity: 24,
    minStockThreshold: 8,
    baseUnit: 'pack',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_16',
    name: 'Sunlight Lemon Dishwashing Liquid 750ml',
    categoryId: 'cat_toiletries',
    sku: 'SNL-750',
    barcode: '6156677889900',
    sellingPrice: 1850,
    costPrice: 1450,
    stockQuantity: 16,
    minStockThreshold: 6,
    baseUnit: 'bottle',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_17',
    name: 'Fresh Farm Grade A Eggs (Full Crate 30s)',
    categoryId: 'cat_dairy',
    sku: 'EGG-030',
    barcode: '6157788990011',
    sellingPrice: 5200,
    costPrice: 4400,
    stockQuantity: 12,
    minStockThreshold: 6,
    baseUnit: 'crate',
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_18',
    name: 'Hollandia Plain Sweetened Yoghurt 1L',
    categoryId: 'cat_dairy',
    sku: 'HLY-001',
    barcode: '6158899001122',
    sellingPrice: 2400,
    wholesalePrice: 2100,
    costPrice: 1950,
    stockQuantity: 20,
    minStockThreshold: 8,
    baseUnit: 'bottle',
    hasPack: true,
    packUnitName: 'Pack of 6',
    packSize: 6,
    packRetailPrice: 14000,
    packWholesalePrice: 12200,
    active: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
];

const DEFAULT_SALES: Sale[] = [
  {
    id: 'sale_demo_1',
    receiptNumber: 'HS-20261012-0001',
    cashierId: 'user_cashier_1',
    cashierName: 'Blessing Adebayo',
    items: [
      {
        id: 'si_1',
        productId: 'prod_1',
        productName: 'Mama Gold Parboiled Rice 5kg',
        sku: 'MGR-005',
        quantity: 1,
        unitPrice: 9500,
        costPriceSnapshot: 8200,
        lineTotal: 9500,
      },
      {
        id: 'si_2',
        productId: 'prod_11',
        productName: 'Hellen Bakery Fresh Sliced Butter Bread 800g',
        sku: 'HBB-800',
        quantity: 2,
        unitPrice: 1600,
        costPriceSnapshot: 1100,
        lineTotal: 3200,
      },
    ],
    subtotal: 12700,
    discount: 500,
    discountType: 'fixed',
    taxAmount: 0,
    total: 12200,
    amountPaid: 15000,
    changeAmount: 2800,
    paymentMethod: 'CASH',
    status: 'COMPLETED',
    createdAt: '2026-10-12T09:15:22Z',
  },
  {
    id: 'sale_demo_2',
    receiptNumber: 'HS-20261012-0002',
    cashierId: 'user_cashier_1',
    cashierName: 'Blessing Adebayo',
    items: [
      {
        id: 'si_3',
        productId: 'prod_4',
        productName: 'Kings Pure Vegetable Oil 1L',
        sku: 'KVO-001',
        quantity: 1,
        unitPrice: 3800,
        costPriceSnapshot: 3200,
        lineTotal: 3800,
      },
      {
        id: 'si_4',
        productId: 'prod_7',
        productName: 'Milo Cocoa Beverage Refill 500g',
        sku: 'MLO-500',
        quantity: 1,
        unitPrice: 4100,
        costPriceSnapshot: 3500,
        lineTotal: 4100,
      },
    ],
    subtotal: 7900,
    discount: 0,
    discountType: 'fixed',
    taxAmount: 0,
    total: 7900,
    amountPaid: 7900,
    changeAmount: 0,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: 'GTB-TRF-982145',
    paymentConfirmedBy: 'Blessing Adebayo',
    status: 'COMPLETED',
    createdAt: '2026-10-12T10:42:00Z',
  },
  {
    id: 'sale_demo_3',
    receiptNumber: 'HS-20261012-0003',
    cashierId: 'user_admin_1',
    cashierName: 'Hellen Olayode',
    items: [
      {
        id: 'si_5',
        productId: 'prod_17',
        productName: 'Fresh Farm Grade A Eggs (Full Crate 30s)',
        sku: 'EGG-030',
        quantity: 1,
        unitPrice: 5200,
        costPriceSnapshot: 4400,
        lineTotal: 5200,
      },
      {
        id: 'si_6',
        productId: 'prod_18',
        productName: 'Hollandia Plain Sweetened Yoghurt 1L',
        sku: 'HLY-001',
        quantity: 2,
        unitPrice: 2400,
        costPriceSnapshot: 1950,
        lineTotal: 4800,
      },
    ],
    subtotal: 10000,
    discount: 0,
    discountType: 'fixed',
    taxAmount: 0,
    total: 10000,
    amountPaid: 10000,
    changeAmount: 0,
    paymentMethod: 'POS_CARD',
    paymentReference: 'STANBIC-POS-5541',
    paymentConfirmedBy: 'Hellen Olayode',
    status: 'COMPLETED',
    createdAt: '2026-10-12T11:20:15Z',
  },
];

const DEFAULT_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov_1',
    productId: 'prod_1',
    productName: 'Mama Gold Parboiled Rice 5kg',
    sku: 'MGR-005',
    type: 'RECEIVED',
    quantityChange: 30,
    previousQuantity: 0,
    resultingQuantity: 30,
    userId: 'user_inventory_1',
    userName: 'Emeka Nwosu',
    note: 'Initial batch delivery from Golden Star Distributors',
    timestamp: '2026-10-01T08:30:00Z',
  },
  {
    id: 'mov_2',
    productId: 'prod_1',
    productName: 'Mama Gold Parboiled Rice 5kg',
    sku: 'MGR-005',
    type: 'SALE',
    quantityChange: -1,
    previousQuantity: 29,
    resultingQuantity: 28,
    userId: 'user_cashier_1',
    userName: 'Blessing Adebayo',
    receiptNumber: 'HS-20261012-0001',
    note: 'Checkout purchase',
    timestamp: '2026-10-12T09:15:22Z',
  },
  {
    id: 'mov_3',
    productId: 'prod_2',
    productName: 'Golden Penny Semovita 2kg',
    sku: 'GPS-002',
    type: 'ADJUSTMENT',
    quantityChange: -2,
    previousQuantity: 6,
    resultingQuantity: 4,
    userId: 'user_admin_1',
    userName: 'Hellen Olayode',
    note: 'Stock audit reconciliation: 2 bags damaged in transit',
    timestamp: '2026-10-11T14:10:00Z',
  },
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    userId: 'user_admin_1',
    userName: 'Hellen Olayode',
    actionType: 'PRICE_CHANGE',
    entityType: 'PRODUCT',
    entityId: 'prod_1',
    previousValue: '₦9,000',
    newValue: '₦9,500',
    details: 'Adjusted selling price for Mama Gold Parboiled Rice 5kg due to supplier price increase',
    timestamp: '2026-10-08T11:00:00Z',
  },
  {
    id: 'aud_2',
    userId: 'user_admin_1',
    userName: 'Hellen Olayode',
    actionType: 'STOCK_ADJUSTMENT',
    entityType: 'INVENTORY',
    entityId: 'prod_2',
    previousValue: '6 bags',
    newValue: '4 bags',
    details: 'Reconciled damaged goods during weekend inspection',
    timestamp: '2026-10-11T14:10:00Z',
  },
];

export class DatabaseStore {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    if (import.meta.env.DEV) {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.users && parsed.products && parsed.sales) {
            // ensure currentUser exists and is valid
            const currentUser = parsed.currentUser || parsed.users[0] || DEFAULT_USERS[0];
            return {
              ...parsed,
              currentUser,
            };
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved state, using default database', e);
      }

      const initialState: DatabaseState = {
        users: DEFAULT_USERS,
        currentUser: DEFAULT_USERS[0], // Hellen Olayode (Admin)
        categories: DEFAULT_CATEGORIES,
        products: DEFAULT_PRODUCTS,
        sales: DEFAULT_SALES,
        movements: DEFAULT_MOVEMENTS,
        auditLogs: DEFAULT_AUDIT_LOGS,
        settings: DEFAULT_SETTINGS,
      };
      this.saveStateToDisk(initialState);
      return initialState;
    }

    return {
      users: [],
      currentUser: {
        id: "unauthenticated",
        name: "Sign in required",
        email: "",
        role: "CASHIER",
        active: false,
        createdAt: new Date(0).toISOString(),
      },
      categories: [],
      products: [],
      sales: [],
      movements: [],
      auditLogs: [],
      settings: {
        storeName: "",
        branchName: "",
        phone: "",
        address: "",
        currency: "₦",
        receiptFooter: "",
        taxRate: 0,
        enableTax: false,
        lowStockGlobalThreshold: 0,
        timezone: "",
      },
    };
  }

  private saveStateToDisk(state: DatabaseState) {
    if (import.meta.env.PROD) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  private notify() {
    this.saveStateToDisk(this.state);
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): DatabaseState {
    return this.state;
  }

  // --- Auth / User Management ---
  public setCurrentUser(userId: string) {
    const user = this.state.users.find((u) => u.id === userId && u.active);
    if (user) {
      this.state.currentUser = user;
      this.notify();
    }
  }

  public createUser(userData: Omit<User, 'id' | 'createdAt'>, actor: User): User {
    const newUser: User = {
      ...userData,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(newUser);

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'STAFF_UPDATE',
      entityType: 'USER',
      entityId: newUser.id,
      details: `Created new staff account "${newUser.name}" with role ${newUser.role}`,
    });

    this.notify();
    return newUser;
  }

  public updateUser(userId: string, updates: Partial<User>, actor: User) {
    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      const prev = this.state.users[index];
      this.state.users[index] = { ...prev, ...updates };

      if (this.state.currentUser.id === userId) {
        this.state.currentUser = this.state.users[index];
      }

      this.logAudit({
        userId: actor.id,
        userName: actor.name,
        actionType: 'STAFF_UPDATE',
        entityType: 'USER',
        entityId: userId,
        details: `Updated staff "${prev.name}" details: ${JSON.stringify(updates)}`,
      });

      this.notify();
    }
  }

  public toggleUserActive(userId: string, actor: User) {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    if (user.id === actor.id) {
      throw new Error('You cannot deactivate your own account.');
    }

    user.active = !user.active;
    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'STAFF_UPDATE',
      entityType: 'USER',
      entityId: userId,
      details: `${user.active ? 'Activated' : 'Deactivated'} staff account "${user.name}"`,
    });

    this.notify();
  }

  // --- POS / Sale Completion (Atomic with Overselling Prevention) ---
  public createSale(params: {
    items: CartItem[];
    subtotal: number;
    discount: number;
    discountType: 'fixed' | 'percentage';
    paymentMethod: PaymentMethod;
    amountPaid: number;
    paymentReference?: string;
    actor: User;
    idempotencyKey?: string;
  }): Sale {
    const { items, subtotal, discount, discountType, paymentMethod, amountPaid, paymentReference, actor, idempotencyKey } = params;

    // Idempotency check: BR-13 Prevent duplicate requests
    if (idempotencyKey) {
      const existing = this.state.sales.find((s) => s.idempotencyKey === idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    if (items.length === 0) {
      throw new Error('Cannot complete a sale with an empty cart.');
    }

    // BR-03 & BR-11: Validate stock availability for all items atomically before committing
    for (const item of items) {
      const product = this.state.products.find((p) => p.id === item.product.id);
      if (!product) {
        throw new Error(`Product "${item.product.name}" no longer exists in catalogue.`);
      }
      if (!product.active) {
        throw new Error(`Product "${product.name}" has been deactivated.`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}.`
        );
      }
    }

    // Calculate tax if configured
    const netSubtotal = Math.max(0, subtotal - discount);
    const taxAmount = this.state.settings.enableTax
      ? Math.round(netSubtotal * (this.state.settings.taxRate / 100))
      : 0;
    const finalTotal = netSubtotal + taxAmount;

    // BR-08 & PAY-02: Payment validation
    if (paymentMethod === 'CASH' && amountPaid < finalTotal) {
      throw new Error(
        `Insufficient payment received: ${this.state.settings.currency}${amountPaid.toLocaleString()} paid, but ${this.state.settings.currency}${finalTotal.toLocaleString()} due.`
      );
    }

    const changeAmount = paymentMethod === 'CASH' ? Math.max(0, amountPaid - finalTotal) : 0;

    // Generate unique receipt number: HS-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todaysCount = this.state.sales.filter((s) => s.createdAt.startsWith(now.toISOString().slice(0, 10))).length + 1;
    const receiptNumber = `HS-${dateStr}-${String(todaysCount).padStart(4, '0')}`;

    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = now.toISOString();

    const saleItems: SaleItem[] = items.map((ci) => ({
      id: `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: ci.product.id,
      productName: ci.product.name,
      sku: ci.product.sku,
      quantity: ci.quantity,
      unitPrice: ci.unitPrice, // BR-04 Historical price snapshot
      costPriceSnapshot: ci.product.costPrice,
      lineTotal: ci.quantity * ci.unitPrice,
    }));

    // Atomically update inventory quantities and log stock movements
    for (const ci of items) {
      const prod = this.state.products.find((p) => p.id === ci.product.id)!;
      const prevQty = prod.stockQuantity;
      const nextQty = prevQty - ci.quantity;

      prod.stockQuantity = nextQty;
      prod.updatedAt = timestamp;

      // BR-07: Traceable stock movement
      const movement: StockMovement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        type: 'SALE',
        quantityChange: -ci.quantity,
        previousQuantity: prevQty,
        resultingQuantity: nextQty,
        userId: actor.id,
        userName: actor.name,
        transactionId: saleId,
        receiptNumber,
        note: `Sold at POS (Receipt ${receiptNumber})`,
        timestamp,
      };
      this.state.movements.unshift(movement);
    }

    const newSale: Sale = {
      id: saleId,
      receiptNumber,
      cashierId: actor.id,
      cashierName: actor.name,
      items: saleItems,
      subtotal,
      discount,
      discountType,
      taxAmount,
      total: finalTotal,
      amountPaid: paymentMethod === 'CASH' ? amountPaid : finalTotal,
      changeAmount,
      paymentMethod,
      paymentReference,
      paymentConfirmedBy: actor.name,
      status: 'COMPLETED',
      createdAt: timestamp,
      idempotencyKey,
    };

    this.state.sales.unshift(newSale);

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'SALE_COMPLETED',
      entityType: 'SALE',
      entityId: saleId,
      details: `Completed sale ${receiptNumber} for ${this.state.settings.currency}${finalTotal.toLocaleString()} via ${paymentMethod}`,
    });

    this.notify();
    return newSale;
  }

  // --- Inventory Management: Receiving & Adjustments ---
  public receiveStock(params: {
    productId: string;
    quantity: number;
    supplier?: string;
    note?: string;
    unitCost?: number;
    actor: User;
  }) {
    const { productId, quantity, supplier, note, unitCost, actor } = params;
    if (quantity <= 0) {
      throw new Error('Received quantity must be greater than zero.');
    }

    const product = this.state.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found.');

    const prevQty = product.stockQuantity;
    const nextQty = prevQty + quantity;
    const timestamp = new Date().toISOString();

    product.stockQuantity = nextQty;
    if (unitCost && unitCost > 0) {
      product.costPrice = unitCost;
    }
    product.updatedAt = timestamp;

    const movement: StockMovement = {
      id: `mov_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'RECEIVED',
      quantityChange: quantity,
      previousQuantity: prevQty,
      resultingQuantity: nextQty,
      userId: actor.id,
      userName: actor.name,
      note: note || (supplier ? `Received from ${supplier}` : 'Stock replenishment'),
      timestamp,
    };
    this.state.movements.unshift(movement);

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'STOCK_RECEIVE',
      entityType: 'INVENTORY',
      entityId: product.id,
      previousValue: `${prevQty} units`,
      newValue: `${nextQty} units`,
      details: `Received +${quantity} units for ${product.name}. ${note || ''}`,
    });

    this.notify();
  }

  public adjustStock(params: {
    productId: string;
    newQuantity: number;
    reason: 'ADJUSTMENT' | 'DAMAGED' | 'RETURN';
    note: string;
    actor: User;
  }) {
    const { productId, newQuantity, reason, note, actor } = params;
    if (newQuantity < 0) {
      throw new Error('Stock quantity cannot be negative.');
    }

    const product = this.state.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found.');

    const prevQty = product.stockQuantity;
    const diff = newQuantity - prevQty;
    if (diff === 0) {
      throw new Error('New quantity matches current stock; no adjustment needed.');
    }

    const timestamp = new Date().toISOString();
    product.stockQuantity = newQuantity;
    product.updatedAt = timestamp;

    const movement: StockMovement = {
      id: `mov_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: reason,
      quantityChange: diff,
      previousQuantity: prevQty,
      resultingQuantity: newQuantity,
      userId: actor.id,
      userName: actor.name,
      note: note || `Stock adjustment (${reason})`,
      timestamp,
    };
    this.state.movements.unshift(movement);

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'STOCK_ADJUSTMENT',
      entityType: 'INVENTORY',
      entityId: product.id,
      previousValue: `${prevQty} units`,
      newValue: `${newQuantity} units`,
      details: `Adjusted ${product.name} from ${prevQty} to ${newQuantity} (${reason}). Reason: ${note}`,
    });

    this.notify();
  }

  // --- Product Management ---
  public createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, actor: User): Product {
    // Unique SKU check
    if (this.state.products.some((p) => p.sku.toLowerCase() === data.sku.toLowerCase())) {
      throw new Error(`A product with SKU "${data.sku}" already exists.`);
    }

    // Unique barcode check if provided
    if (data.barcode && data.barcode.trim()) {
      if (this.state.products.some((p) => p.barcode && p.barcode.trim() === data.barcode?.trim())) {
        throw new Error(`A product with Barcode "${data.barcode}" already exists.`);
      }
    }

    if (data.sellingPrice < 0) throw new Error('Selling price cannot be negative.');
    if (data.stockQuantity < 0) throw new Error('Initial stock quantity cannot be negative.');

    const timestamp = new Date().toISOString();
    const newProduct: Product = {
      ...data,
      id: `prod_${Date.now()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.products.unshift(newProduct);

    // Initial stock movement if opening stock > 0
    if (newProduct.stockQuantity > 0) {
      this.state.movements.unshift({
        id: `mov_${Date.now()}`,
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'RECEIVED',
        quantityChange: newProduct.stockQuantity,
        previousQuantity: 0,
        resultingQuantity: newProduct.stockQuantity,
        userId: actor.id,
        userName: actor.name,
        note: 'Opening inventory recorded upon product creation',
        timestamp,
      });
    }

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'PRODUCT_CREATE',
      entityType: 'PRODUCT',
      entityId: newProduct.id,
      newValue: `${this.state.settings.currency}${newProduct.sellingPrice.toLocaleString()}`,
      details: `Created product "${newProduct.name}" (SKU: ${newProduct.sku}) with ${newProduct.stockQuantity} initial units`,
    });

    this.notify();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>, actor: User) {
    const index = this.state.products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Product not found.');

    const prev = this.state.products[index];

    // Check SKU collision
    if (updates.sku && updates.sku.toLowerCase() !== prev.sku.toLowerCase()) {
      if (this.state.products.some((p) => p.id !== id && p.sku.toLowerCase() === updates.sku?.toLowerCase())) {
        throw new Error(`SKU "${updates.sku}" is already assigned to another product.`);
      }
    }

    // Check Barcode collision
    if (updates.barcode && updates.barcode.trim()) {
      if (this.state.products.some((p) => p.id !== id && p.barcode && p.barcode.trim() === updates.barcode?.trim())) {
        throw new Error(`Barcode "${updates.barcode}" is already assigned to another product.`);
      }
    }

    // Price change audit log (AUDIT-01 & BR-04)
    if (updates.sellingPrice !== undefined && updates.sellingPrice !== prev.sellingPrice) {
      this.logAudit({
        userId: actor.id,
        userName: actor.name,
        actionType: 'PRICE_CHANGE',
        entityType: 'PRODUCT',
        entityId: id,
        previousValue: `${this.state.settings.currency}${prev.sellingPrice.toLocaleString()}`,
        newValue: `${this.state.settings.currency}${updates.sellingPrice.toLocaleString()}`,
        details: `Updated selling price of "${prev.name}" from ${this.state.settings.currency}${prev.sellingPrice.toLocaleString()} to ${this.state.settings.currency}${updates.sellingPrice.toLocaleString()}`,
      });
    }

    this.state.products[index] = {
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.notify();
  }

  public toggleProductActive(id: string, actor: User) {
    const prod = this.state.products.find((p) => p.id === id);
    if (!prod) return;

    prod.active = !prod.active;
    prod.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'PRODUCT_UPDATE',
      entityType: 'PRODUCT',
      entityId: id,
      details: `${prod.active ? 'Reactivated' : 'Deactivated'} product "${prod.name}"`,
    });

    this.notify();
  }

  // --- Category Management ---
  public createCategory(data: Omit<Category, 'id' | 'createdAt'>, actor: User): Category {
    if (this.state.categories.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
      throw new Error(`Category "${data.name}" already exists.`);
    }

    const newCategory: Category = {
      ...data,
      id: `cat_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.state.categories.push(newCategory);

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'SETTINGS_CHANGE',
      entityType: 'SETTINGS',
      entityId: newCategory.id,
      details: `Created category "${newCategory.name}"`,
    });

    this.notify();
    return newCategory;
  }

  // --- Settings ---
  public updateSettings(newSettings: Partial<BusinessSettings>, actor: User) {
    this.state.settings = { ...this.state.settings, ...newSettings };

    this.logAudit({
      userId: actor.id,
      userName: actor.name,
      actionType: 'SETTINGS_CHANGE',
      entityType: 'SETTINGS',
      entityId: 'global_settings',
      details: `Updated business settings: ${Object.keys(newSettings).join(', ')}`,
    });

    this.notify();
  }

  // --- Audit Logging Helper ---
  private logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const audit: AuditLog = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(audit);
  }

  // --- Backup & Restore (JSON) ---
  public exportDatabase(): string {
    return JSON.stringify(this.state, null, 2);
  }

  public importDatabase(jsonString: string, actor: User) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.products || !data.sales || !data.users) {
        throw new Error('Invalid database format. Missing core collections.');
      }
      this.state = data;
      this.logAudit({
        userId: actor.id,
        userName: actor.name,
        actionType: 'SETTINGS_CHANGE',
        entityType: 'SETTINGS',
        entityId: 'database_restore',
        details: 'Restored database from external JSON backup',
      });
      this.notify();
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : 'Failed to import database file.');
    }
  }

  public resetDatabase(actor: User) {
    if (import.meta.env.DEV) {
      this.state = {
        users: DEFAULT_USERS,
        currentUser: DEFAULT_USERS[0],
        categories: DEFAULT_CATEGORIES,
        products: DEFAULT_PRODUCTS,
        sales: DEFAULT_SALES,
        movements: DEFAULT_MOVEMENTS,
        auditLogs: DEFAULT_AUDIT_LOGS,
        settings: DEFAULT_SETTINGS,
      };
      this.logAudit({
        userId: actor.id,
        userName: actor.name,
        actionType: 'SETTINGS_CHANGE',
        entityType: 'SETTINGS',
        entityId: 'database_reset',
        details: 'Reset system database to factory default demonstration data',
      });
      this.notify();
      return;
    }
    throw new Error('Resetting demonstration data is disabled in production.');
  }
}

export const db = new DatabaseStore();
