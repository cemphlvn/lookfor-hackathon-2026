/**
 * MAS Error System — Comprehensive typed errors for all edge cases
 *
 * Error Hierarchy:
 * - MASError (base)
 *   - SessionError (session lifecycle)
 *   - ToolError (tool execution)
 *   - RoutingError (agent routing)
 *   - EscalationError (escalation handling)
 *   - ValidationError (input validation)
 *   - LLMError (LLM API failures)
 *   - ConfigError (configuration issues)
 */

export enum ErrorCode {
  // Session errors (1xxx)
  SESSION_NOT_FOUND = 'E1001',
  SESSION_ALREADY_ESCALATED = 'E1002',
  SESSION_EXPIRED = 'E1003',
  SESSION_INVALID_STATE = 'E1004',
  SESSION_CREATE_FAILED = 'E1005',

  // Tool errors (2xxx)
  TOOL_NOT_FOUND = 'E2001',
  TOOL_VALIDATION_FAILED = 'E2002',
  TOOL_EXECUTION_FAILED = 'E2003',
  TOOL_TIMEOUT = 'E2004',
  TOOL_RATE_LIMITED = 'E2005',
  TOOL_NETWORK_ERROR = 'E2006',

  // Routing errors (3xxx)
  ROUTING_NO_AGENT = 'E3001',
  ROUTING_INVALID_INTENT = 'E3002',
  ROUTING_LOOP_DETECTED = 'E3003',
  ROUTING_CONFIDENCE_LOW = 'E3004',

  // Escalation errors (4xxx)
  ESCALATION_ALREADY_ESCALATED = 'E4001',
  ESCALATION_SUMMARY_FAILED = 'E4002',
  ESCALATION_INVALID_REASON = 'E4003',

  // Validation errors (5xxx)
  VALIDATION_MISSING_FIELD = 'E5001',
  VALIDATION_INVALID_TYPE = 'E5002',
  VALIDATION_INVALID_FORMAT = 'E5003',
  VALIDATION_CONSTRAINT_VIOLATED = 'E5004',

  // LLM errors (6xxx)
  LLM_API_KEY_MISSING = 'E6001',
  LLM_REQUEST_FAILED = 'E6002',
  LLM_RESPONSE_INVALID = 'E6003',
  LLM_RATE_LIMITED = 'E6004',
  LLM_CONTEXT_TOO_LONG = 'E6005',
  LLM_TOOL_PARSE_FAILED = 'E6006',

  // Config errors (7xxx)
  CONFIG_INVALID = 'E7001',
  CONFIG_AGENT_NOT_FOUND = 'E7002',
  CONFIG_TOOL_NOT_MAPPED = 'E7003',

  // Storage errors (8xxx)
  STORAGE_READ_FAILED = 'E8001',
  STORAGE_WRITE_FAILED = 'E8002',
  STORAGE_CORRUPTED = 'E8003',
}

export interface ErrorContext {
  sessionId?: string;
  toolHandle?: string;
  agentId?: string;
  params?: Record<string, unknown>;
  timestamp: string;
  recoverable: boolean;
  retryable: boolean;
  suggestion?: string;
}

/**
 * Base error class for all MAS errors
 */
export class MASError extends Error {
  readonly code: ErrorCode;
  readonly context: ErrorContext;
  readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    originalError?: Error
  ) {
    super(`[${code}] ${message}`);
    this.name = 'MASError';
    this.code = code;
    this.context = {
      timestamp: new Date().toISOString(),
      recoverable: false,
      retryable: false,
      ...context,
    };
    this.originalError = originalError;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Session lifecycle errors
 */
export class SessionError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    sessionId?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, { ...context, sessionId });
    this.name = 'SessionError';
  }

  static notFound(sessionId: string): SessionError {
    return new SessionError(
      ErrorCode.SESSION_NOT_FOUND,
      `Session not found: ${sessionId}`,
      sessionId,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Start a new session with POST /session/start',
      }
    );
  }

  static alreadyEscalated(sessionId: string): SessionError {
    return new SessionError(
      ErrorCode.SESSION_ALREADY_ESCALATED,
      `Session already escalated: ${sessionId}`,
      sessionId,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Wait for human agent response. No further automated processing.',
      }
    );
  }

  static expired(sessionId: string): SessionError {
    return new SessionError(
      ErrorCode.SESSION_EXPIRED,
      `Session expired: ${sessionId}`,
      sessionId,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Start a new session. Session timeout exceeded.',
      }
    );
  }

  static invalidState(sessionId: string, expectedState: string, actualState: string): SessionError {
    return new SessionError(
      ErrorCode.SESSION_INVALID_STATE,
      `Invalid session state. Expected: ${expectedState}, Got: ${actualState}`,
      sessionId,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Check session status before performing this operation.',
      }
    );
  }
}

/**
 * Tool execution errors
 */
export class ToolError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    toolHandle: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, { ...context, toolHandle });
    this.name = 'ToolError';
  }

  static notFound(toolHandle: string): ToolError {
    return new ToolError(
      ErrorCode.TOOL_NOT_FOUND,
      `Unknown tool: ${toolHandle}`,
      toolHandle,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Check tool handle spelling. Available tools: shopify_*, skio_*',
      }
    );
  }

  static validationFailed(toolHandle: string, paramName: string, reason: string): ToolError {
    return new ToolError(
      ErrorCode.TOOL_VALIDATION_FAILED,
      `Validation failed for ${paramName}: ${reason}`,
      toolHandle,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Fix parameter '${paramName}' and retry.`,
      }
    );
  }

  static executionFailed(toolHandle: string, error: string, originalError?: Error): ToolError {
    return new ToolError(
      ErrorCode.TOOL_EXECUTION_FAILED,
      `Tool execution failed: ${error}`,
      toolHandle,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Check API availability and retry.',
      }
    );
  }

  static timeout(toolHandle: string, timeoutMs: number): ToolError {
    return new ToolError(
      ErrorCode.TOOL_TIMEOUT,
      `Tool call timed out after ${timeoutMs}ms`,
      toolHandle,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'API is slow. Retry or escalate if persists.',
      }
    );
  }

  static rateLimited(toolHandle: string, retryAfter?: number): ToolError {
    return new ToolError(
      ErrorCode.TOOL_RATE_LIMITED,
      `Rate limited. ${retryAfter ? `Retry after ${retryAfter}s` : 'Please wait.'}`,
      toolHandle,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Wait ${retryAfter || 60} seconds before retrying.`,
      }
    );
  }

  static networkError(toolHandle: string, error: string): ToolError {
    return new ToolError(
      ErrorCode.TOOL_NETWORK_ERROR,
      `Network error: ${error}`,
      toolHandle,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Check network connectivity and API endpoint.',
      }
    );
  }
}

/**
 * Routing errors
 */
export class RoutingError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'RoutingError';
  }

  static noAgent(intent: string): RoutingError {
    return new RoutingError(
      ErrorCode.ROUTING_NO_AGENT,
      `No agent found for intent: ${intent}`,
      {
        recoverable: true,
        retryable: false,
        suggestion: 'Falling back to general-support-agent.',
      }
    );
  }

  static invalidIntent(message: string): RoutingError {
    return new RoutingError(
      ErrorCode.ROUTING_INVALID_INTENT,
      `Could not classify intent for message`,
      {
        recoverable: true,
        retryable: false,
        suggestion: 'Using fallback agent for ambiguous intent.',
      }
    );
  }

  static loopDetected(sessionId: string, agents: string[]): RoutingError {
    return new RoutingError(
      ErrorCode.ROUTING_LOOP_DETECTED,
      `Agent routing loop detected: ${agents.join(' → ')}`,
      {
        sessionId,
        recoverable: false,
        retryable: false,
        suggestion: 'Escalate to human agent.',
      }
    );
  }

  static lowConfidence(sessionId: string, confidence: number): RoutingError {
    return new RoutingError(
      ErrorCode.ROUTING_CONFIDENCE_LOW,
      `Routing confidence too low: ${confidence.toFixed(2)}`,
      {
        sessionId,
        recoverable: true,
        retryable: false,
        suggestion: 'Ask customer for clarification.',
      }
    );
  }
}

/**
 * Escalation errors
 */
export class EscalationError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'EscalationError';
  }

  static alreadyEscalated(sessionId: string): EscalationError {
    return new EscalationError(
      ErrorCode.ESCALATION_ALREADY_ESCALATED,
      'Session is already escalated',
      {
        sessionId,
        recoverable: false,
        retryable: false,
        suggestion: 'No action needed. Human agent will respond.',
      }
    );
  }

  static summaryFailed(sessionId: string, reason: string): EscalationError {
    return new EscalationError(
      ErrorCode.ESCALATION_SUMMARY_FAILED,
      `Failed to build escalation summary: ${reason}`,
      {
        sessionId,
        recoverable: true,
        retryable: true,
        suggestion: 'Escalation proceeding with minimal summary.',
      }
    );
  }
}

/**
 * Validation errors
 */
export class ValidationError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'ValidationError';
  }

  static missingField(field: string, location: string): ValidationError {
    return new ValidationError(
      ErrorCode.VALIDATION_MISSING_FIELD,
      `Missing required field: ${field}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Provide '${field}' in ${location}.`,
      }
    );
  }

  static invalidType(field: string, expected: string, received: string): ValidationError {
    return new ValidationError(
      ErrorCode.VALIDATION_INVALID_TYPE,
      `Invalid type for ${field}. Expected ${expected}, got ${received}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Ensure '${field}' is of type ${expected}.`,
      }
    );
  }

  static invalidFormat(field: string, format: string): ValidationError {
    return new ValidationError(
      ErrorCode.VALIDATION_INVALID_FORMAT,
      `Invalid format for ${field}. Expected: ${format}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Format '${field}' as ${format}.`,
      }
    );
  }

  static constraintViolated(field: string, constraint: string): ValidationError {
    return new ValidationError(
      ErrorCode.VALIDATION_CONSTRAINT_VIOLATED,
      `Constraint violated for ${field}: ${constraint}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Ensure '${field}' satisfies: ${constraint}.`,
      }
    );
  }
}

/**
 * LLM API errors
 */
export class LLMError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'LLMError';
  }

  static apiKeyMissing(): LLMError {
    return new LLMError(
      ErrorCode.LLM_API_KEY_MISSING,
      'No LLM API key configured',
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY.',
      }
    );
  }

  static requestFailed(provider: string, error: string): LLMError {
    return new LLMError(
      ErrorCode.LLM_REQUEST_FAILED,
      `${provider} API request failed: ${error}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Check API status and retry.',
      }
    );
  }

  static responseInvalid(reason: string): LLMError {
    return new LLMError(
      ErrorCode.LLM_RESPONSE_INVALID,
      `Invalid LLM response: ${reason}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Retry request. May be transient issue.',
      }
    );
  }

  static rateLimited(retryAfter?: number): LLMError {
    return new LLMError(
      ErrorCode.LLM_RATE_LIMITED,
      `LLM API rate limited. ${retryAfter ? `Retry after ${retryAfter}s` : ''}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: `Wait ${retryAfter || 60} seconds before retrying.`,
      }
    );
  }

  static contextTooLong(tokenCount: number, maxTokens: number): LLMError {
    return new LLMError(
      ErrorCode.LLM_CONTEXT_TOO_LONG,
      `Context too long: ${tokenCount} tokens (max: ${maxTokens})`,
      {
        recoverable: true,
        retryable: false,
        suggestion: 'Truncate conversation history or summarize.',
      }
    );
  }

  static toolParseFailed(raw: string): LLMError {
    return new LLMError(
      ErrorCode.LLM_TOOL_PARSE_FAILED,
      'Failed to parse tool call from LLM response',
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Retry. LLM may have produced malformed tool call.',
      }
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'ConfigError';
  }

  static invalid(reason: string): ConfigError {
    return new ConfigError(
      ErrorCode.CONFIG_INVALID,
      `Invalid MAS configuration: ${reason}`,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Fix configuration and restart server.',
      }
    );
  }

  static agentNotFound(agentId: string): ConfigError {
    return new ConfigError(
      ErrorCode.CONFIG_AGENT_NOT_FOUND,
      `Agent not found in config: ${agentId}`,
      {
        agentId,
        recoverable: false,
        retryable: false,
        suggestion: 'Check orchestrator.agents in MAS config.',
      }
    );
  }

  static toolNotMapped(toolHandle: string, agentId: string): ConfigError {
    return new ConfigError(
      ErrorCode.CONFIG_TOOL_NOT_MAPPED,
      `Tool '${toolHandle}' not available for agent '${agentId}'`,
      {
        toolHandle,
        agentId,
        recoverable: false,
        retryable: false,
        suggestion: 'Add tool to agent tools[] in config.',
      }
    );
  }
}

/**
 * Storage errors
 */
export class StorageError extends MASError {
  constructor(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(code, message, context);
    this.name = 'StorageError';
  }

  static readFailed(path: string, error: string): StorageError {
    return new StorageError(
      ErrorCode.STORAGE_READ_FAILED,
      `Failed to read ${path}: ${error}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Check file permissions and disk space.',
      }
    );
  }

  static writeFailed(path: string, error: string): StorageError {
    return new StorageError(
      ErrorCode.STORAGE_WRITE_FAILED,
      `Failed to write ${path}: ${error}`,
      {
        recoverable: true,
        retryable: true,
        suggestion: 'Check file permissions and disk space.',
      }
    );
  }

  static corrupted(path: string): StorageError {
    return new StorageError(
      ErrorCode.STORAGE_CORRUPTED,
      `Storage file corrupted: ${path}`,
      {
        recoverable: false,
        retryable: false,
        suggestion: 'Delete corrupted file and restart. Data may be lost.',
      }
    );
  }
}

/**
 * Error handler utilities
 */
export const ErrorHandler = {
  /**
   * Check if error is recoverable
   */
  isRecoverable(error: unknown): boolean {
    if (error instanceof MASError) {
      return error.context.recoverable;
    }
    return false;
  },

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof MASError) {
      return error.context.retryable;
    }
    return false;
  },

  /**
   * Get user-friendly message
   */
  getUserMessage(error: unknown): string {
    if (error instanceof SessionError) {
      if (error.code === ErrorCode.SESSION_NOT_FOUND) {
        return 'Your session has expired. Please start a new conversation.';
      }
      if (error.code === ErrorCode.SESSION_ALREADY_ESCALATED) {
        return 'Your issue has been escalated to our team. A specialist will respond shortly.';
      }
    }

    if (error instanceof ToolError) {
      return 'We encountered a technical issue. Please try again in a moment.';
    }

    if (error instanceof LLMError) {
      return 'Our AI service is temporarily unavailable. Please try again shortly.';
    }

    return 'An unexpected error occurred. Please try again.';
  },

  /**
   * Format error for API response
   */
  toAPIResponse(error: unknown): { success: false; error: string; code?: string; suggestion?: string } {
    if (error instanceof MASError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        suggestion: error.context.suggestion,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  },

  /**
   * Log error with context
   */
  log(error: unknown, context?: Record<string, unknown>): void {
    if (error instanceof MASError) {
      console.error(`[${error.name}] ${error.code}: ${error.message}`);
      console.error('Context:', { ...error.context, ...context });
      if (error.originalError) {
        console.error('Original:', error.originalError);
      }
    } else if (error instanceof Error) {
      console.error(`[Error] ${error.message}`);
      console.error('Stack:', error.stack);
    } else {
      console.error('[Unknown Error]', error);
    }
  },
};

/**
 * Result type for operations that can fail
 */
export type Result<T, E = MASError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<E extends MASError>(error: E): Result<never, E> {
  return { success: false, error };
}
