const BASE_URL = 'https://api.ragnaplace.com';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RagnaPlaceClient {
  constructor({ apiKey, maxRequestsPerWindow = 380, windowMs = 60_000 } = {}) {
    if (!apiKey) {
      throw new Error(
        'RAGNAPLACE_API_KEY não definida. Copie .env.example para .env e preencha sua chave.'
      );
    }
    this.apiKey = apiKey;
    this.maxRequestsPerWindow = maxRequestsPerWindow;
    this.windowMs = windowMs;
    this.requestTimestamps = [];
  }

  async #throttle() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < this.windowMs);
    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      const oldest = this.requestTimestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 50;
      await sleep(waitMs);
      return this.#throttle();
    }
  }

  async get(path, params = {}) {
    await this.#throttle();

    const url = new URL(BASE_URL + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const res = await fetch(url, { headers: { 'x-api-key': this.apiKey } });
    this.requestTimestamps.push(Date.now());

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '5');
      console.error(`  [rate limit] aguardando ${retryAfter}s antes de tentar de novo...`);
      await sleep((retryAfter + 1) * 1000);
      return this.get(path, params);
    }

    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = await res.json();
        message = body.message ?? message;
      } catch {
        // corpo não era JSON, mantém statusText
      }
      const err = new Error(`API respondeu ${res.status}: ${message}`);
      err.status = res.status;
      throw err;
    }

    return res.json();
  }

  gateways() {
    return this.get('/v1/gateways');
  }

  search(gateway, { type, q, page, limit, order, dir } = {}) {
    return this.get(`/v1/${gateway}/search`, { type, q, page, limit, order, dir });
  }

  item(gateway, id) {
    return this.get(`/v1/${gateway}/item/${id}`);
  }

  mob(gateway, id) {
    return this.get(`/v1/${gateway}/mob/${id}`);
  }

  map(gateway, id) {
    return this.get(`/v1/${gateway}/map/${id}`);
  }

  quest(gateway, id) {
    return this.get(`/v1/${gateway}/quest/${id}`);
  }

  achievement(gateway, id) {
    return this.get(`/v1/${gateway}/achievement/${id}`);
  }
}
