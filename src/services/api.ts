import { Product, Category, BusinessSettings } from '../types';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
  private async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
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
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Network request failed. Please check your internet connection.');
    }
  }

  // Health check: GET /api/health
  public async getHealth(): Promise<HealthCheckResponse> {
    return this.fetchJson<HealthCheckResponse>('/api/health');
  }

  // Fetch active products: GET /api/products
  public async getProducts(params?: { search?: string; categoryId?: string }): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params?.search && params.search.trim()) {
      searchParams.set('search', params.search.trim());
    }
    if (params?.categoryId && params.categoryId !== 'all') {
      searchParams.set('categoryId', params.categoryId);
    }

    const qs = searchParams.toString();
    const endpoint = `/api/products${qs ? `?${qs}` : ''}`;
    const result = await this.fetchJson<{ success: boolean; products: Product[]; count: number }>(endpoint);
    return result.products;
  }

  // Fetch categories: GET /api/categories
  public async getCategories(): Promise<Category[]> {
    const result = await this.fetchJson<{ success: boolean; categories: Category[]; count: number }>('/api/categories');
    return result.categories;
  }

  // Fetch store business settings: GET /api/settings
  public async getSettings(): Promise<BusinessSettings> {
    const result = await this.fetchJson<{ success: boolean; settings: BusinessSettings }>('/api/settings');
    return result.settings;
  }
}

export const api = new ApiService();
