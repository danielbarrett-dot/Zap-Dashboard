const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type FetchOptions = RequestInit & {
  query?: Record<string, string | number | undefined | null>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const buildUrl = (path: string, query?: FetchOptions["query"]) => {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || "Request failed", response.status);
  }

  return data as T;
}

export const apiFetcher = <T>(path: string) => apiFetch<T>(path);
