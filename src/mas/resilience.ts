/**
 * MAS Resilience Patterns
 *
 * Circuit Breaker, Retry Logic, Fallback Chains
 */

import { MASError, ToolError, LLMError, ErrorCode } from './errors';

// ============================================================================
// RETRY LOGIC
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOn: (error: unknown) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryOn: (error) => {
    if (error instanceof MASError) {
      return error.context.retryable;
    }
    return false;
  },
};

/**
 * Execute function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let delay = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!cfg.retryOn(error) || attempt === cfg.maxAttempts) {
        throw error;
      }

      console.log(`[Retry] Attempt ${attempt}/${cfg.maxAttempts} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject all calls
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes to close from half-open
  resetTimeoutMs: number;      // Time before trying again
  monitoringWindowMs: number;  // Window for counting failures
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeoutMs: 30000,
  monitoringWindowMs: 60000,
};

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  lastStateChange: number;
  recentFailures: number[]; // Timestamps of recent failures
}

/**
 * Circuit Breaker pattern implementation
 */
export class CircuitBreaker {
  private circuits: Map<string, CircuitStats> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Get or create circuit for a service
   */
  private getCircuit(serviceId: string): CircuitStats {
    let circuit = this.circuits.get(serviceId);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailure: 0,
        lastStateChange: Date.now(),
        recentFailures: [],
      };
      this.circuits.set(serviceId, circuit);
    }
    return circuit;
  }

  /**
   * Check if circuit allows request
   */
  canExecute(serviceId: string): boolean {
    const circuit = this.getCircuit(serviceId);
    const now = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (now - circuit.lastStateChange >= this.config.resetTimeoutMs) {
          circuit.state = CircuitState.HALF_OPEN;
          circuit.lastStateChange = now;
          circuit.successes = 0;
          console.log(`[CircuitBreaker] ${serviceId}: OPEN → HALF_OPEN`);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;
    }
  }

  /**
   * Record successful call
   */
  recordSuccess(serviceId: string): void {
    const circuit = this.getCircuit(serviceId);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successes++;
      if (circuit.successes >= this.config.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.lastStateChange = Date.now();
        console.log(`[CircuitBreaker] ${serviceId}: HALF_OPEN → CLOSED`);
      }
    }
  }

  /**
   * Record failed call
   */
  recordFailure(serviceId: string): void {
    const circuit = this.getCircuit(serviceId);
    const now = Date.now();

    // Clean up old failures outside monitoring window
    circuit.recentFailures = circuit.recentFailures.filter(
      (t) => now - t < this.config.monitoringWindowMs
    );
    circuit.recentFailures.push(now);

    circuit.failures++;
    circuit.lastFailure = now;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Immediate trip on failure in half-open state
      circuit.state = CircuitState.OPEN;
      circuit.lastStateChange = now;
      console.log(`[CircuitBreaker] ${serviceId}: HALF_OPEN → OPEN`);
    } else if (circuit.state === CircuitState.CLOSED) {
      // Check if failure threshold exceeded
      if (circuit.recentFailures.length >= this.config.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        circuit.lastStateChange = now;
        console.log(`[CircuitBreaker] ${serviceId}: CLOSED → OPEN (${circuit.recentFailures.length} failures)`);
      }
    }
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(serviceId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute(serviceId)) {
      throw new LLMError(
        ErrorCode.LLM_RATE_LIMITED,
        `Circuit open for ${serviceId}. Service temporarily unavailable.`,
        {
          recoverable: true,
          retryable: true,
          suggestion: `Wait ${Math.ceil(this.config.resetTimeoutMs / 1000)}s before retrying.`,
        }
      );
    }

    try {
      const result = await fn();
      this.recordSuccess(serviceId);
      return result;
    } catch (error) {
      this.recordFailure(serviceId);
      throw error;
    }
  }

  /**
   * Get circuit state for monitoring
   */
  getState(serviceId: string): CircuitStats {
    return { ...this.getCircuit(serviceId) };
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Record<string, CircuitStats> {
    const states: Record<string, CircuitStats> = {};
    this.circuits.forEach((circuit, id) => {
      states[id] = { ...circuit };
    });
    return states;
  }

  /**
   * Reset circuit (for testing)
   */
  reset(serviceId: string): void {
    this.circuits.delete(serviceId);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.clear();
  }
}

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

export interface ConfidenceConfig {
  routingMinConfidence: number;      // Min confidence for agent routing
  clarificationThreshold: number;    // Below this, ask for clarification
  escalationThreshold: number;       // Below this, consider escalation
  toolConfidenceThreshold: number;   // Min confidence for tool selection
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  routingMinConfidence: 0.3,
  clarificationThreshold: 0.2,
  escalationThreshold: 0.1,
  toolConfidenceThreshold: 0.5,
};

/**
 * Confidence-based routing decision
 */
export interface ConfidenceDecision {
  action: 'proceed' | 'clarify' | 'fallback' | 'escalate';
  confidence: number;
  reason: string;
}

/**
 * Evaluate confidence and decide action
 */
export function evaluateConfidence(
  confidence: number,
  config: Partial<ConfidenceConfig> = {}
): ConfidenceDecision {
  const cfg = { ...DEFAULT_CONFIDENCE_CONFIG, ...config };

  if (confidence >= cfg.routingMinConfidence) {
    return {
      action: 'proceed',
      confidence,
      reason: 'Confidence sufficient for routing',
    };
  }

  if (confidence >= cfg.clarificationThreshold) {
    return {
      action: 'clarify',
      confidence,
      reason: 'Low confidence - ask customer for clarification',
    };
  }

  if (confidence >= cfg.escalationThreshold) {
    return {
      action: 'fallback',
      confidence,
      reason: 'Very low confidence - use fallback agent',
    };
  }

  return {
    action: 'escalate',
    confidence,
    reason: 'Confidence too low - escalate to human',
  };
}

// ============================================================================
// FALLBACK CHAINS
// ============================================================================

export interface FallbackChainConfig<T> {
  handlers: Array<{
    name: string;
    execute: () => Promise<T>;
    shouldTry: (previousError?: unknown) => boolean;
  }>;
  timeout?: number;
}

/**
 * Execute with fallback chain
 */
export async function withFallbackChain<T>(
  config: FallbackChainConfig<T>
): Promise<{ result: T; usedHandler: string }> {
  let lastError: unknown;

  for (const handler of config.handlers) {
    if (!handler.shouldTry(lastError)) {
      continue;
    }

    try {
      console.log(`[FallbackChain] Trying: ${handler.name}`);

      let result: T;
      if (config.timeout) {
        result = await Promise.race([
          handler.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${handler.name}`)), config.timeout)
          ),
        ]);
      } else {
        result = await handler.execute();
      }

      console.log(`[FallbackChain] Success: ${handler.name}`);
      return { result, usedHandler: handler.name };
    } catch (error) {
      console.log(`[FallbackChain] Failed: ${handler.name} - ${error}`);
      lastError = error;
    }
  }

  throw lastError || new Error('All fallback handlers failed');
}

// ============================================================================
// LLM PROVIDER FALLBACK
// ============================================================================

export interface LLMFallbackConfig {
  providers: Array<{
    name: string;
    apiKey?: string;
    createClient: () => unknown;
    priority: number;
  }>;
}

/**
 * Create LLM client with fallback providers
 */
export function createLLMClientWithFallback(config: LLMFallbackConfig): {
  chat: (messages: unknown[], tools?: unknown[]) => Promise<unknown>;
  currentProvider: string;
} {
  // Sort by priority
  const sorted = [...config.providers]
    .filter((p) => p.apiKey)
    .sort((a, b) => a.priority - b.priority);

  if (sorted.length === 0) {
    throw LLMError.apiKeyMissing();
  }

  let currentProvider = sorted[0].name;
  const clients = new Map<string, unknown>();

  // Lazy create clients
  const getClient = (name: string) => {
    if (!clients.has(name)) {
      const provider = sorted.find((p) => p.name === name);
      if (provider) {
        clients.set(name, provider.createClient());
      }
    }
    return clients.get(name);
  };

  return {
    get currentProvider() {
      return currentProvider;
    },

    async chat(messages: unknown[], tools?: unknown[]) {
      for (const provider of sorted) {
        try {
          const client = getClient(provider.name) as {
            chat: (msgs: unknown[], tools?: unknown[]) => Promise<unknown>;
          };
          if (!client) continue;

          currentProvider = provider.name;
          return await client.chat(messages, tools);
        } catch (error) {
          console.error(`[LLM] ${provider.name} failed:`, error);
          // Continue to next provider
        }
      }

      throw LLMError.requestFailed('all providers', 'All LLM providers failed');
    },
  };
}

// ============================================================================
// RATE LIMITER
// ============================================================================

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxRequests: 60,
  windowMs: 60000,
};

/**
 * Simple sliding window rate limiter
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.config.maxRequests) {
      return false;
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    return Math.max(0, this.config.maxRequests - timestamps.length);
  }

  /**
   * Get time until reset
   */
  getResetTime(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) return 0;

    const oldestInWindow = Math.min(...timestamps);
    const resetTime = oldestInWindow + this.config.windowMs;
    return Math.max(0, resetTime - Date.now());
  }
}

// ============================================================================
// TIMEOUT WRAPPER
// ============================================================================

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ============================================================================
// EXPORTS (Singletons)
// ============================================================================

// Global circuit breaker for tools
export const toolCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 15000,
});

// Global circuit breaker for LLM
export const llmCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

// Global rate limiter for sessions
export const sessionRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000,
});
