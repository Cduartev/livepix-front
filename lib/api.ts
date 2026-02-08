const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

export const api = {
  get: async <T>(endpoint: string, options?: FetchOptions): Promise<T> => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  post: async <T>(
    endpoint: string,
    body: any,
    options?: FetchOptions,
  ): Promise<T> => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  put: async <T>(
    endpoint: string,
    body: any,
    options?: FetchOptions,
  ): Promise<T> => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  delete: async <T>(endpoint: string, options?: FetchOptions): Promise<T> => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },
};
