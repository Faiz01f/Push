/**
 * API client with axios-like interface
 * Handles authentication, request/response interceptors, and error handling
 */

import { useAuthStore } from '@/store/auth'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Request options interface
interface RequestOptions {
  headers?: Record<string, string>
  params?: Record<string, any>
  timeout?: number
  signal?: AbortSignal
}

// Response interface
interface ApiResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
}

// HTTP client class
class ApiClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL.replace(/\/$/, '') // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint.startsWith('/') ? endpoint : `/${endpoint}`, this.baseURL)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): Record<string, string> {
    const token = useAuthStore.getState().token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /**
   * Handle fetch response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type')
    let data: T

    try {
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = (await response.text()) as unknown as T
      }
    } catch (error) {
      throw new ApiError('Failed to parse response', response.status)
    }

    // Convert Headers to plain object
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    const apiResponse: ApiResponse<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers,
    }

    if (!response.ok) {
      const errorData = data as any
      const message = errorData?.message || errorData?.error || response.statusText
      const code = errorData?.code || errorData?.type
      
      throw new ApiError(message, response.status, code, errorData)
    }

    return apiResponse
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { headers = {}, params, timeout = 30000, signal } = options

    const url = this.buildURL(endpoint, params)
    const requestHeaders = {
      ...this.defaultHeaders,
      ...this.getAuthHeader(),
      ...headers,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: signal || controller.signal,
      })

      clearTimeout(timeoutId)
      return this.handleResponse<T>(response)
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof ApiError) {
        // Handle unauthorized errors
        if (error.status === 401) {
          useAuthStore.getState().clearAuth()
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login'
          }
        }
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408)
      }

      throw new ApiError('Network error', 0, 'NETWORK_ERROR', error)
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options)
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body, options)
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body, options)
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body, options)
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options)
  }

  /**
   * Upload file
   */
  async upload<T>(
    endpoint: string,
    file: File,
    options: RequestOptions & { onProgress?: (progress: number) => void } = {}
  ): Promise<ApiResponse<T>> {
    const { headers = {}, onProgress, ...requestOptions } = options

    const formData = new FormData()
    formData.append('file', file)

    const uploadHeaders = {
      ...this.getAuthHeader(),
      ...headers,
    }
    // Remove Content-Type to let browser set it with boundary
    delete uploadHeaders['Content-Type']

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress(progress)
          }
        })
      }

      // Handle response
      xhr.addEventListener('load', () => {
        try {
          const response = {
            data: JSON.parse(xhr.responseText),
            status: xhr.status,
            statusText: xhr.statusText,
            headers: {},
          }

          if (xhr.status >= 400) {
            const errorData = response.data as any
            const message = errorData?.message || errorData?.error || xhr.statusText
            reject(new ApiError(message, xhr.status, errorData?.code, errorData))
          } else {
            resolve(response)
          }
        } catch (error) {
          reject(new ApiError('Failed to parse upload response', xhr.status))
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new ApiError('Upload failed', 0, 'UPLOAD_ERROR'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new ApiError('Upload timeout', 408))
      })

      // Make request
      xhr.open('POST', this.buildURL(endpoint))
      Object.entries(uploadHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })
      xhr.timeout = requestOptions.timeout || 300000 // 5 minutes default for uploads
      xhr.send(formData)
    })
  }

  /**
   * Download file
   */
  async download(
    endpoint: string,
    filename?: string,
    options?: RequestOptions
  ): Promise<void> {
    const response = await fetch(this.buildURL(endpoint, options?.params), {
      method: 'GET',
      headers: {
        ...this.getAuthHeader(),
        ...options?.headers,
      },
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new ApiError('Download failed', response.status)
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

// Create and export API client instance
export const api = new ApiClient()

// Utility functions for common operations
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: any; token: string; refreshToken: string }>('/auth/login', {
      email,
      password,
    }),

  register: (email: string, password: string, name: string) =>
    api.post<{ user: any; token: string; refreshToken: string }>('/auth/register', {
      email,
      password,
      name,
    }),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<{ token: string; refreshToken: string }>('/auth/refresh', {
      refreshToken,
    }),

  me: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

// Export default
export default api