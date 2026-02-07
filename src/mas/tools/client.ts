/**
 * Tool Client — Execute tool calls against Lookfor API
 */

import { ToolDefinition, getToolByHandle, ALL_TOOLS } from '../../meta/tool-mapper/tools';
import { ToolError, ErrorCode } from '../errors';
import { toolCircuitBreaker, withRetry } from '../resilience';

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: ErrorCode;
  retryable?: boolean;
  suggestion?: string;
}

export class ToolClient {
  private apiUrl: string;
  private timeout: number;

  constructor(apiUrl: string = process.env.API_URL || 'https://lookfor-backend.ngrok.app/v1/api', timeout: number = 30000) {
    this.apiUrl = apiUrl;
    this.timeout = timeout;
    console.log(`[ToolClient] Using API: ${this.apiUrl}`);
  }

  /**
   * Execute a tool call with circuit breaker and retry
   */
  async execute(toolHandle: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const tool = getToolByHandle(toolHandle);
    if (!tool) {
      const err = ToolError.notFound(toolHandle);
      return {
        success: false,
        error: err.message,
        errorCode: err.code,
        retryable: false,
        suggestion: err.context.suggestion,
      };
    }

    // Validate required params
    const validation = this.validateParams(tool, params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: ErrorCode.TOOL_VALIDATION_FAILED,
        retryable: true,
        suggestion: `Fix parameter and retry. ${validation.error}`,
      };
    }

    // Check circuit breaker
    if (!toolCircuitBreaker.canExecute(toolHandle)) {
      const err = ToolError.rateLimited(toolHandle, 15);
      return {
        success: false,
        error: `Circuit open: ${toolHandle} temporarily unavailable`,
        errorCode: ErrorCode.TOOL_RATE_LIMITED,
        retryable: true,
        suggestion: 'Tool is experiencing issues. Wait and retry.',
      };
    }

    try {
      // Execute with retry logic (max 2 attempts for tools)
      const response = await withRetry(
        () => this.makeRequest(tool.endpoint, toolHandle, params),
        {
          maxAttempts: 2,
          initialDelayMs: 500,
          retryOn: (err) => {
            // Only retry on network/timeout errors
            if (err instanceof Error) {
              return err.message.includes('timeout') || err.message.includes('network');
            }
            return false;
          },
        }
      );

      // Record success for circuit breaker
      if (response.success) {
        toolCircuitBreaker.recordSuccess(toolHandle);
      } else {
        toolCircuitBreaker.recordFailure(toolHandle);
      }

      return response;
    } catch (error) {
      toolCircuitBreaker.recordFailure(toolHandle);

      const err = ToolError.networkError(toolHandle, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: err.message,
        errorCode: err.code,
        retryable: true,
        suggestion: err.context.suggestion,
      };
    }
  }

  /**
   * Make HTTP request to tool endpoint
   */
  private async makeRequest(endpoint: string, toolHandle: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const url = `${this.apiUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        const err = ToolError.rateLimited(toolHandle, retryAfter);
        return {
          success: false,
          error: err.message,
          errorCode: err.code,
          retryable: true,
          suggestion: err.context.suggestion,
        };
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const text = await response.text();
        let errorMessage: string;
        try {
          const errData = JSON.parse(text) as { message?: string; error?: string };
          errorMessage = errData.message || errData.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${text.slice(0, 100)}`;
        }
        return {
          success: false,
          error: errorMessage,
          errorCode: ErrorCode.TOOL_EXECUTION_FAILED,
          retryable: response.status >= 500,
          suggestion: response.status >= 500 ? 'Server error - retry may succeed' : 'Check request parameters',
        };
      }

      // All success responses are HTTP 200 per spec
      const data = await response.json() as { success: boolean; data?: unknown; error?: string; message?: string };

      if (data.success) {
        return { success: true, data: data.data };
      } else {
        return {
          success: false,
          error: data.error || data.message || 'Unknown error from tool',
          errorCode: ErrorCode.TOOL_EXECUTION_FAILED,
          retryable: false,
          suggestion: 'Check parameters or try alternative approach',
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const err = ToolError.timeout(toolHandle, this.timeout);
        return {
          success: false,
          error: err.message,
          errorCode: err.code,
          retryable: true,
          suggestion: err.context.suggestion,
        };
      }

      throw error;
    }
  }

  /**
   * Validate params against tool schema
   */
  private validateParams(tool: ToolDefinition, params: Record<string, unknown>): { valid: boolean; error?: string } {
    for (const param of tool.params) {
      if (param.required && !(param.name in params)) {
        return { valid: false, error: `Missing required parameter: ${param.name}` };
      }

      if (param.name in params) {
        const value = params[param.name];

        // Type checking
        if (param.type === 'string' && typeof value !== 'string') {
          return { valid: false, error: `Parameter ${param.name} must be a string` };
        }
        if (param.type === 'number' && typeof value !== 'number') {
          return { valid: false, error: `Parameter ${param.name} must be a number` };
        }
        if (param.type === 'boolean' && typeof value !== 'boolean') {
          return { valid: false, error: `Parameter ${param.name} must be a boolean` };
        }
        if (param.type === 'array' && !Array.isArray(value)) {
          return { valid: false, error: `Parameter ${param.name} must be an array` };
        }
        if (param.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
          return { valid: false, error: `Parameter ${param.name} must be an object` };
        }

        // Enum checking
        if (param.enum && !param.enum.includes(value as string)) {
          return { valid: false, error: `Parameter ${param.name} must be one of: ${param.enum.join(', ')}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Get tool schemas for LLM
   */
  getToolSchemas(): object[] {
    return ALL_TOOLS.map(tool => ({
      name: tool.handle,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.params.map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {})
            }
          ])
        ),
        required: tool.params.filter(p => p.required).map(p => p.name)
      }
    }));
  }

  /**
   * Get tool schemas for specific agent
   */
  getAgentToolSchemas(toolHandles: string[]): object[] {
    return this.getToolSchemas().filter(s => toolHandles.includes((s as { name: string }).name));
  }
}

// Singleton instance with lazy initialization
let _toolClient: ToolClient | null = null;

export function getToolClient(): ToolClient {
  if (!_toolClient) {
    _toolClient = new ToolClient();
  }
  return _toolClient;
}

export function resetToolClient(): void {
  _toolClient = null;
}

// Legacy export for backwards compatibility (lazy)
export const toolClient = {
  get instance() { return getToolClient(); },
  execute: (...args: Parameters<ToolClient['execute']>) => getToolClient().execute(...args),
  getToolSchemas: () => getToolClient().getToolSchemas(),
  getAgentToolSchemas: (handles: string[]) => getToolClient().getAgentToolSchemas(handles)
};
