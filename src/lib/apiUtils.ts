/**
 * Production-grade API utility with retries, caching, and error tracking.
 */

interface FetchOptions extends RequestInit {
  retries?: number;
  backoff?: number;
  cacheTime?: number; // ms
}

const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Enhanced fetch with exponential backoff retries
 */
export async function smartFetch(url: string, options: FetchOptions = {}) {
  const { retries = 3, backoff = 1000, cacheTime = 0, ...fetchOptions } = options;
  
  // 1. Check Cache (GET only)
  if (fetchOptions.method === 'GET' || !fetchOptions.method) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, fetchOptions);
      
      // Handle rate limits or server errors with retry
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // If we get HTML (like the "Starting Server" page), it's a retryable error
        const text = await response.text();
        if (text.includes('Please wait while your application starts')) {
          throw new Error('SERVER_WARMUP');
        }
        throw new Error(`Non-JSON response: ${response.status} ${contentType || 'no-type'}`);
      }
      
      const data = await response.json();
      
      // 2. Update Cache
      if (fetchOptions.method === 'GET' || !fetchOptions.method) {
        cache.set(url, { data, timestamp: Date.now() });
      }
      
      return data;
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        const delay = backoff * Math.pow(2, i);
        console.warn(`[API] Retry ${i + 1}/${retries} for ${url} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 3. Log to "Production Monitor" (Console for now, but structured)
  console.error('[Production Monitor] API Failure:', {
    url,
    method: fetchOptions.method || 'GET',
    error: lastError?.message,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
  
  throw lastError;
}

/**
 * Clear specific or all cache
 */
export function clearApiCache(url?: string) {
  if (url) cache.delete(url);
  else cache.clear();
}
