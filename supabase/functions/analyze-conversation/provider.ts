// ALIX AI – Provider-Abstraktion (Prompt 5)
// Der restliche Code kennt NUR dieses Interface. Ein Providerwechsel
// erfordert lediglich eine weitere Implementierung von AIProviderAdapter.
// API Keys ausschliesslich serverseitig (Edge Function Secret).

export type AIRequest = {
  system: string;
  user: string;
  /** Strikt-kompatibles JSON-Schema (alle Felder required, additionalProperties:false). */
  schema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
};

export type AIResult = {
  ok: boolean;
  text: string;
  json: Record<string, unknown> | null;
  model: string;
  latency_ms: number;
  error?: string;
  status?: number;
};

export interface AIProviderAdapter {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  run(req: AIRequest): Promise<AIResult>;
}

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/responses';

/** Lovable AI Gateway (OpenAI Responses API). */
export class LovableGatewayAdapter implements AIProviderAdapter {
  readonly name = 'lovable-ai-gateway';
  readonly model = 'openai/gpt-5.6-sol';
  private key = Deno.env.get('LOVABLE_API_KEY') ?? '';

  isConfigured() { return this.key.length > 0; }

  async run(req: AIRequest): Promise<AIResult> {
    const started = Date.now();
    if (!this.isConfigured()) {
      return { ok: false, text: '', json: null, model: this.model, latency_ms: 0, error: 'AI_PROVIDER_NOT_CONFIGURED' };
    }

    const body: Record<string, unknown> = {
      model: this.model,
      stream: true,
      instructions: req.system,
      input: [{ role: 'user', content: [{ type: 'input_text', text: req.user }] }],
      reasoning: { effort: 'low', summary: 'auto' },
    };
    if (req.schema) {
      body.text = {
        format: {
          type: 'json_schema',
          name: req.schema.name,
          strict: true,
          schema: req.schema.schema,
        },
      };
    }

    let res: Response;
    try {
      res = await fetch(GATEWAY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Lovable-API-Key': this.key,
          'X-Lovable-AIG-SDK': 'fetch',
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (e) {
      return { ok: false, text: '', json: null, model: this.model, latency_ms: Date.now() - started, error: String((e as Error).message) };
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false, text: '', json: null, model: this.model,
        latency_ms: Date.now() - started, status: res.status,
        // Kein Nachrichtentext im Fehlerlog – nur technische Angaben.
        error: `AI_HTTP_${res.status}`,
        ...(detail ? {} : {}),
      };
    }

    // Streaming ist auf /v1/responses Pflicht; wir konsumieren serverseitig.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let out = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') out += evt.delta;
          else if (evt.type === 'response.completed' && !out && typeof evt.response?.output_text === 'string') out = evt.response.output_text;
        } catch { /* unvollständiges Event ignorieren */ }
      }
    }

    let json: Record<string, unknown> | null = null;
    if (out.trim()) {
      try { json = JSON.parse(out); } catch { json = null; }
    }
    return { ok: true, text: out, json, model: this.model, latency_ms: Date.now() - started };
  }
}

export function getProvider(): AIProviderAdapter {
  // Weitere Provider später hier auswählbar (Konfiguration in app_settings).
  return new LovableGatewayAdapter();
}
