import { GoogleGenAI, ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';

export const PRIMARY_FREE_TEXT_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_FREE_TEXT_MODEL = 'gemini-4-hydrogen';
export const FREE_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
export const FREE_LIVE_MODEL = 'gemini-3.8-live';
export const SCENE_SCRIPT_MIME_TYPE = 'application/vnd.vectora-scene-script+json';

export interface ParsedGeminiError {
  status: number;
  code: 'RATE_LIMIT' | 'API_KEY_ERROR' | 'MODEL_NOT_FOUND' | 'UPSTREAM_BUSY' | 'UPSTREAM_ERROR';
  isRateLimit: boolean;
  isRetryable: boolean;
  retryAfterSeconds?: number;
  userMessage: string;
  rawMessage: string;
}

export interface AvailableModelsSummary {
  checkedAt: string;
  keyConfigured: boolean;
  selectedTextModel: string;
  fallbackTextModel: string;
  availableModels: string[];
  freeTierCompatibleModels: string[];
  probe?: {
    model: string;
    succeeded: boolean;
    latencyMs: number;
    error?: string;
  };
}

let cachedModelsSummary: { expiresAt: number; data: AvailableModelsSummary } | null = null;

// Short-lived in-memory cache + in-flight request deduplication to prevent burst 429s
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getCachedValue<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs = 10 * 60 * 1000): void {
  if (responseCache.size > 200) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export async function dedupeAsync<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export function parseGeminiApiError(error: unknown): ParsedGeminiError {
  const rawMessage = error instanceof Error ? error.message : String(error || 'Unknown Gemini API error');
  const statusProp =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : NaN;

  const lower = rawMessage.toLowerCase();
  const isRateLimit =
    statusProp === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota');

  const retryMatch = rawMessage.match(/retry\s*(?:in|after)?\s*([\d.]+)\s*s/i);
  const retryAfterSeconds = retryMatch
    ? Math.min(60, Math.max(2, Math.ceil(Number(retryMatch[1]))))
    : isRateLimit
      ? 12
      : undefined;

  if (isRateLimit) {
    return {
      status: 429,
      code: 'RATE_LIMIT',
      isRateLimit: true,
      isRetryable: true,
      retryAfterSeconds,
      userMessage: `Gemini Free Tier rate limit reached. Please wait ${retryAfterSeconds ?? 12} seconds before retrying.`,
      rawMessage,
    };
  }

  if (
    statusProp === 401 ||
    statusProp === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return {
      status: 403,
      code: 'API_KEY_ERROR',
      isRateLimit: false,
      isRetryable: false,
      userMessage: 'Gemini API key check failed. Please verify your GEMINI_API_KEY in Settings > Secrets.',
      rawMessage,
    };
  }

  if (statusProp === 404 || lower.includes('not_found') || lower.includes('is not found')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      isRateLimit: false,
      isRetryable: false,
      userMessage: 'The requested Gemini model is unavailable for your current API key.',
      rawMessage,
    };
  }

  if (
    statusProp === 503 ||
    statusProp === 504 ||
    lower.includes('unavailable') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('overloaded')
  ) {
    return {
      status: 503,
      code: 'UPSTREAM_BUSY',
      isRateLimit: false,
      isRetryable: true,
      retryAfterSeconds: 5,
      userMessage: 'Gemini AI service is temporarily busy. Please try again in a few seconds.',
      rawMessage,
    };
  }

  return {
    status: Number.isFinite(statusProp) && statusProp >= 400 ? statusProp : 500,
    code: 'UPSTREAM_ERROR',
    isRateLimit: false,
    isRetryable: false,
    userMessage: 'Unable to complete the AI request right now. Please try again shortly.',
    rawMessage,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateContentWithRateLimitHandling(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'> & { model?: string },
  options?: {
    lowThinking?: boolean;
    allowFallbackModel?: boolean;
    maxRetries?: number;
  }
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  const primaryModel = params.model || PRIMARY_FREE_TEXT_MODEL;
  const allowFallback = options?.allowFallbackModel !== false;
  const maxRetries = options?.maxRetries ?? 1;

  const buildParams = (modelName: string): GenerateContentParameters => {
    const baseConfig = params.config ? { ...params.config } : {};
    if (options?.lowThinking && (modelName === 'gemini-4-hydrogen' || modelName === 'gemini-3.1-flash-lite')) {
      baseConfig.thinkingConfig = {
        ...(baseConfig.thinkingConfig || {}),
        thinkingLevel: ThinkingLevel.LOW,
      };
    }
    return {
      ...params,
      model: modelName,
      config: Object.keys(baseConfig).length > 0 ? baseConfig : undefined,
    };
  };

  let lastError: unknown;
  const modelsToTry =
    allowFallback && primaryModel !== FALLBACK_FREE_TEXT_MODEL
      ? [primaryModel, FALLBACK_FREE_TEXT_MODEL]
      : [primaryModel];

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const modelName = modelsToTry[mIdx];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent(buildParams(modelName));
        return { response, modelUsed: modelName };
      } catch (err) {
        lastError = err;
        const parsed = parseGeminiApiError(err);

        // If 404 or rate-limited and we still have a distinct free-tier fallback model, switch immediately after brief pause
        if (attempt < maxRetries && parsed.isRetryable) {
          const delayMs = Math.min(2500, (parsed.retryAfterSeconds ?? 2) * 250 * (attempt + 1));
          await sleep(delayMs);
          continue;
        }
        if (
          (parsed.isRateLimit || parsed.code === 'MODEL_NOT_FOUND' || parsed.code === 'UPSTREAM_BUSY') &&
          mIdx < modelsToTry.length - 1
        ) {
          break;
        }
        throw err;
      }
    }
  }

  throw lastError;
}

export async function inspectAvailableModels(
  runLiveProbe = false
): Promise<AvailableModelsSummary> {
  const ai = getGeminiClient();
  const checkedAt = new Date().toISOString();

  if (!ai) {
    return {
      checkedAt,
      keyConfigured: false,
      selectedTextModel: PRIMARY_FREE_TEXT_MODEL,
      fallbackTextModel: FALLBACK_FREE_TEXT_MODEL,
      availableModels: [],
      freeTierCompatibleModels: [],
    };
  }

  if (!runLiveProbe && cachedModelsSummary && Date.now() < cachedModelsSummary.expiresAt) {
    return cachedModelsSummary.data;
  }

  const availableModels: string[] = [];
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      if (m.name) {
        availableModels.push(m.name.replace(/^models\//, ''));
      }
    }
  } catch (err) {
    console.warn('Gemini models.list check failed:', parseGeminiApiError(err).rawMessage);
  }

  const preferredFreeCandidates = [
    PRIMARY_FREE_TEXT_MODEL,
    FALLBACK_FREE_TEXT_MODEL,
    FREE_TTS_MODEL,
    FREE_LIVE_MODEL,
  ];
  const freeTierCompatibleModels =
    availableModels.length > 0
      ? preferredFreeCandidates.filter((name) => availableModels.includes(name))
      : [PRIMARY_FREE_TEXT_MODEL, FALLBACK_FREE_TEXT_MODEL];

  const selectedTextModel = availableModels.includes(PRIMARY_FREE_TEXT_MODEL)
    ? PRIMARY_FREE_TEXT_MODEL
    : availableModels.includes(FALLBACK_FREE_TEXT_MODEL)
      ? FALLBACK_FREE_TEXT_MODEL
      : PRIMARY_FREE_TEXT_MODEL;

  let probe: AvailableModelsSummary['probe'];
  if (runLiveProbe) {
    const started = Date.now();
    try {
      const { modelUsed } = await generateContentWithRateLimitHandling(
        ai,
        {
          model: selectedTextModel,
          contents: 'Reply with OK.',
        },
        { lowThinking: true, maxRetries: 1, allowFallbackModel: true }
      );
      probe = {
        model: modelUsed,
        succeeded: true,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const parsed = parseGeminiApiError(err);
      probe = {
        model: selectedTextModel,
        succeeded: false,
        latencyMs: Date.now() - started,
        error: `${parsed.status} (${parsed.code}): ${parsed.userMessage}`,
      };
    }
  }

  const summary: AvailableModelsSummary = {
    checkedAt,
    keyConfigured: true,
    selectedTextModel,
    fallbackTextModel: FALLBACK_FREE_TEXT_MODEL,
    availableModels,
    freeTierCompatibleModels,
    ...(probe ? { probe } : {}),
  };

  cachedModelsSummary = {
    expiresAt: Date.now() + 10 * 60 * 1000,
    data: summary,
  };

  return summary;
}
