import type { AxiosInstance, AxiosRequestConfig } from 'axios';

interface RateLimiterState {
  remaining: number;
  resetSeconds: number;
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const jitter = (baseMs: number): number =>
  baseMs + Math.floor(Math.random() * 300);

export class RedditRateLimiter {
  private readonly client: AxiosInstance;
  private state: RateLimiterState;

  constructor(client: AxiosInstance) {
    this.client = client;
    this.state = { remaining: 60, resetSeconds: 60 };
  }

  private updateFromHeaders(headers: Record<string, string | string[] | undefined>): void {
    const remaining = Number(headers['x-ratelimit-remaining']);
    const reset = Number(headers['x-ratelimit-reset']);
    if (!Number.isNaN(remaining) && remaining >= 0) {
      this.state.remaining = remaining;
    }
    if (!Number.isNaN(reset) && reset > 0) {
      this.state.resetSeconds = reset;
    }
  }

  async request<T>(config: AxiosRequestConfig, retries = 0): Promise<T> {
    if (this.state.remaining < 2) {
      await sleep(jitter(this.state.resetSeconds * 1000));
    }

    try {
      const response = await this.client.request<T>({
        timeout: 15_000,
        ...config,
      });
      this.updateFromHeaders(response.headers as Record<string, string | string[] | undefined>);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: {
          status?: number;
          headers?: Record<string, string | string[] | undefined>;
        };
      };
      const status = axiosError.response?.status ?? 0;
      const retryAfterRaw = axiosError.response?.headers?.['retry-after'];
      const retryAfterSeconds =
        typeof retryAfterRaw === 'string' ? Number(retryAfterRaw) : NaN;

      if ((status === 429 || (status >= 500 && status < 600)) && retries < 4) {
        const backoff = !Number.isNaN(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : Math.min(40000, 5000 * Math.pow(2, retries));
        await sleep(jitter(backoff));
        return this.request<T>(config, retries + 1);
      }
      throw error;
    }
  }
}
