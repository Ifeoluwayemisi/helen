import {
  Product,
  Category,
  BusinessSettings,
  User,
  UserRole,
  AuditLog,
  StockMovement,
  Sale,
} from "../types";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  database: {
    configured: boolean;
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("hs_session_token");
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("hs_session_token", token);
      } else {
        localStorage.removeItem("hs_session_token");
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async fetchJson<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...((options?.headers as Record<string, string>) || {}),
      };

      const response = await fetch(endpoint, {
        credentials: "include", // Sends & receives HTTP-only cookies
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Response body was not JSON
        }
        throw new ApiRequestError(errorMessage, response.status);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(
        "Network request failed. Please check your internet connection.",
      );
    }
  }

  // Health check: GET /api/health
  public async getHealth(): Promise<HealthCheckResponse> {
    return this.fetchJson<HealthCheckResponse>("/api/health");
  }

  // Fetch active products: GET /api/products
  public async getProducts(params?: {
    search?: string;
    categoryId?: string;
  }): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params?.search && params.search.trim()) {
      searchParams.set("search", params.search.trim());
    }
    if (params?.categoryId && params.categoryId !== "all") {
      searchParams.set("categoryId", params.categoryId);
    }

    const qs = searchParams.toString();
    const endpoint = `/api/products${qs ? `?${qs}` : ""}`;
    const result = await this.fetchJson<{
      success: boolean;
      products: Product[];
      count: number;
    }>(endpoint);
    return result.products;
  }

  // Fetch categories: GET /api/categories
  public async getCategories(): Promise<Category[]> {
    const result = await this.fetchJson<{
      success: boolean;
      categories: Category[];
      count: number;
    }>("/api/categories");
    return result.categories;
  }

  // Fetch store business settings: GET /api/settings
  public async getSettings(): Promise<BusinessSettings> {
    const result = await this.fetchJson<{
      success: boolean;
      settings: BusinessSettings;
    }>("/api/settings");
    return result.settings;
  }

  // =========================================================================
  // Product Catalog Management (Stage 4A)
  // =========================================================================

  // Fetch single product: GET /api/products/:id
  public async getProduct(id: string): Promise<Product> {
    const result = await this.fetchJson<{ success: boolean; product: Product }>(
      `/api/products/${id}`,
    );
    return result.product;
  }

  // Register product: POST /api/products
  public async createProduct(
    data: Partial<Product> & {
      name: string;
      categoryId: string;
      sellingPrice: number;
      openingStock?: number;
    },
  ): Promise<Product> {
    const result = await this.fetchJson<{
      success: boolean;
      product: Product;
      message: string;
    }>("/api/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result.product;
  }

  // Update product: PATCH /api/products/:id
  public async updateProduct(
    id: string,
    updates: Partial<Product>,
  ): Promise<Product> {
    const result = await this.fetchJson<{
      success: boolean;
      product: Product;
      message: string;
    }>(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return result.product;
  }

  // =========================================================================
  // Inventory Foundations: Receiving & Adjustments (Stage 4A)
  // =========================================================================

  // Authorized stock intake: POST /api/inventory/receive
  public async receiveStock(params: {
    productId: string;
    quantity: number;
    sellingUnit?: "BASE" | "PACK" | "CARTON";
    unitCost?: number;
    supplier?: string;
    note?: string;
  }): Promise<{ success: boolean; product: Product; received: any }> {
    return this.fetchJson<{
      success: boolean;
      product: Product;
      received: any;
    }>("/api/inventory/receive", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Authorized stock adjustment: POST /api/inventory/adjust
  public async adjustStock(params: {
    productId: string;
    newQuantity: number;
    reason?: "ADJUSTMENT" | "DAMAGED" | "RETURN";
    note: string;
  }): Promise<{ success: boolean; product: Product; adjustment: any }> {
    return this.fetchJson<{
      success: boolean;
      product: Product;
      adjustment: any;
    }>("/api/inventory/adjust", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Audit movements ledger: GET /api/inventory/movements
  public async getStockMovements(productId?: string): Promise<StockMovement[]> {
    const endpoint = productId
      ? `/api/inventory/movements?productId=${encodeURIComponent(productId)}`
      : "/api/inventory/movements";
    const result = await this.fetchJson<{
      success: boolean;
      movements: StockMovement[];
      count: number;
    }>(endpoint);
    return result.movements;
  }

  public async createSale(
    payload: {
      items: Array<{
        productId: string;
        quantity: number;
        sellingUnit: "BASE" | "PACK" | "CARTON";
        priceTier: "RETAIL" | "WHOLESALE";
      }>;
      discount: { value: number; type: "fixed" | "percentage" };
      paymentMethod: "CASH" | "BANK_TRANSFER" | "POS_CARD";
      amountPaid: number;
      paymentReference?: string;
      paymentConfirmed?: boolean;
    },
    idempotencyKey: string,
  ): Promise<Sale> {
    const result = await this.fetchJson<{ success: boolean; sale: Sale }>(
      "/api/sales",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      },
    );
    return result.sale;
  }

  public async getSales(): Promise<Sale[]> {
    const result = await this.fetchJson<{ success: boolean; sales: Sale[] }>(
      "/api/sales",
    );
    return result.sales;
  }

  // =========================================================================
  // Authentication & Session Management (Stage 3)
  // =========================================================================

  // Authenticate user with password/PIN: POST /api/auth/login
  public async login(
    email: string,
    credential: string,
  ): Promise<{ success: boolean; user: User; token: string }> {
    const result = await this.fetchJson<{
      success: boolean;
      user: User;
      token: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, credential }),
    });

    if (result.token) {
      this.setToken(result.token);
    }

    return result;
  }

  // Revoke session & clear cookie: POST /api/auth/logout
  public async logout(): Promise<void> {
    try {
      await this.fetchJson<{ success: boolean }>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      this.setToken(null);
    }
  }

  // Validate current active session: GET /api/auth/me
  public async getMe(): Promise<User | null> {
    try {
      const result = await this.fetchJson<{ success: boolean; user: User }>(
        "/api/auth/me",
      );
      return result.user;
    } catch {
      return null;
    }
  }

  // Check if store owner is configured: GET /api/auth/setup-status
  public async getSetupStatus(): Promise<{ hasOwner: boolean }> {
    const result = await this.fetchJson<{
      success: boolean;
      hasOwner: boolean;
    }>("/api/auth/setup-status");
    return { hasOwner: result.hasOwner };
  }

  // First owner provisioning: POST /api/auth/setup-owner
  public async setupOwner(data: {
    name: string;
    email: string;
    credential: string;
  }): Promise<User> {
    const result = await this.fetchJson<{ success: boolean; user: User }>(
      "/api/auth/setup-owner",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return result.user;
  }

  // =========================================================================
  // Staff Directory & RBAC Management (Stage 3)
  // =========================================================================

  // Fetch staff directory (Admin only): GET /api/staff
  public async getStaff(): Promise<User[]> {
    const result = await this.fetchJson<{
      success: boolean;
      users: User[];
      count: number;
    }>("/api/staff");
    return result.users;
  }

  // Create new staff account (Admin only): POST /api/staff
  public async createStaff(data: {
    name: string;
    email: string;
    role: UserRole;
    credential?: string;
  }): Promise<User> {
    const result = await this.fetchJson<{ success: boolean; user: User }>(
      "/api/staff",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return result.user;
  }

  // Update staff details or toggle active (Admin only): PATCH /api/staff/:id
  public async updateStaff(
    id: string,
    updates: {
      name?: string;
      email?: string;
      role?: UserRole;
      active?: boolean;
    },
  ): Promise<User> {
    const result = await this.fetchJson<{ success: boolean; user: User }>(
      `/api/staff/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
    return result.user;
  }

  // Reset staff credential (Admin only): PATCH /api/staff/:id/credential
  public async resetStaffCredential(
    id: string,
    credential: string,
  ): Promise<void> {
    await this.fetchJson<{ success: boolean; message: string }>(
      `/api/staff/${id}/credential`,
      {
        method: "PATCH",
        body: JSON.stringify({ credential }),
      },
    );
  }

  // Fetch audit trail (Admin only): GET /api/audit-logs
  public async getAuditLogs(): Promise<AuditLog[]> {
    const result = await this.fetchJson<{
      success: boolean;
      auditLogs: AuditLog[];
      count: number;
    }>("/api/audit-logs");
    return result.auditLogs;
  }
}

export const api = new ApiService();
