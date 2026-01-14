/**
 * Z.AI Provider - Executes queries using Z.AI (GLM) via OpenAI SDK
 *
 * Implements BaseProvider for integration with AutoMaker's provider system.
 */

import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';
import { createLogger } from '@automaker/utils';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

import { isZaiModel, validateBareModelId, type ModelProvider } from '@automaker/types';
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from './types.js';

const logger = createLogger('ZaiProvider');

// Z.AI API configuration
const ZAI_API_URL = 'https://api.z.ai/api/coding/paas/v4';

// Model-specific configurations
interface ModelConfig {
  id: string;
  name: string;
  modelString: string;
  provider: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  tier: 'basic' | 'standard' | 'premium';
  default?: boolean;
  // Model-specific settings
  thinkingMode?: 'interleaved' | 'preserved' | 'none';
  customSystemPrompt?: string;
  toolCallingNotes?: string;
}

// Z.AI Models definitions with model-specific configurations
const ZAI_MODELS_DEF: ModelConfig[] = [
  {
    id: 'glm-4.7',
    name: 'GLM 4.7',
    modelString: 'GLM-4.7',
    provider: 'zai',
    description: 'New Flagship - Best reasoning & coding with Interleaved Thinking',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
    default: true,
    thinkingMode: 'interleaved', // Inserts reasoning before each tool call
    customSystemPrompt:
      'You are a highly capable coding assistant. Use your reasoning abilities to plan multi-step tasks carefully. Execute tools one at a time and verify results.',
    toolCallingNotes:
      'Supports Interleaved Thinking - automatically reasons before each tool call. Best for complex multi-step coding tasks.',
  },
  {
    id: 'glm-4.6',
    name: 'GLM 4.6 (Agentic)',
    modelString: 'GLM-4.6',
    provider: 'zai',
    description: 'Optimized for agentic workflows with streaming tool calls',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
    thinkingMode: 'none', // Uses streaming tool call mode instead
    customSystemPrompt:
      'You are an autonomous agent. Execute tasks efficiently using available tools. Prefer direct action over excessive planning.',
    toolCallingNotes:
      'Optimized for agents with streaming tool output. Autonomously decides when to use tools.',
  },
  {
    id: 'glm-4.5-flash',
    name: 'GLM 4.5 Flash',
    modelString: 'GLM-4.5-Flash',
    provider: 'zai',
    description: 'Fast lightweight model with dual thinking modes',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    tier: 'basic',
    thinkingMode: 'none', // Non-thinking mode for speed
    customSystemPrompt:
      'You are a fast, efficient assistant. Complete tasks quickly and concisely.',
    toolCallingNotes:
      'Fastest model. Use for simple tasks where speed matters more than complex reasoning.',
  },
];

import { ZaiTools } from './zai-tools.js';

export class ZaiProvider extends BaseProvider {
  private client: OpenAI | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.ZAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: ZAI_API_URL,
      });
    }
  }

  private generateToken(apiKey: string): string {
    try {
      const trimmedKey = apiKey.trim();
      const [id, secret] = trimmedKey.split('.');
      if (!id || !secret) {
        logger.warn('Invalid Z.AI API key format (expected id.secret)');
        return apiKey;
      }

      logger.info(`Generating Z.AI token for ID: ${id.substring(0, 4)}...`);

      // Match official Zhipu AI SDK format: milliseconds with 3.5 minute TTL
      const API_TOKEN_TTL_SECONDS = 210; // 3 min cache + 30 sec buffer
      const now = Math.round(Date.now()); // Milliseconds
      const exp = now + API_TOKEN_TTL_SECONDS * 1000;

      const payload = {
        api_key: id,
        exp, // Expiration in ms
        timestamp: now, // Current time in ms
      };

      // Sign with HS256 algorithm as required by Zhipu AI
      const token = jwt.sign(payload, secret, {
        algorithm: 'HS256',
        header: {
          alg: 'HS256',
          sign_type: 'SIGN',
        },
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate Z.AI JWT token', error);
      return apiKey; // Fallback
    }
  }

  getName(): string {
    return 'zai';
  }

  /**
   * Execute a query using Z.AI (OpenAI compatible) with full Agentic Loop
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    if (!this.client) {
      this.initializeClient();
      if (!this.client) {
        throw new Error('Z.AI API key not configured. Please set ZAI_API_KEY.');
      }
    }

    // Generate fresh JWT for this request if using ID.Secret format
    const apiKey = process.env.ZAI_API_KEY || '';
    if (apiKey.includes('.')) {
      const token = this.generateToken(apiKey);
      // Re-initialize client with token as key (OpenAI SDK uses this as Bearer token)
      this.client = new OpenAI({
        apiKey: token,
        baseURL: ZAI_API_URL,
      });
    }

    // Validate model ID
    validateBareModelId(options.model, 'ZaiProvider');

    const {
      prompt,
      model,
      systemPrompt,
      maxTurns = 20,
      allowedTools,
      conversationHistory,
      cwd,
    } = options;

    // Initialize Tools
    const zaiTools = new ZaiTools(cwd);

    // Determine tools based on allowedTools parameter:
    // - undefined: text-only mode (no tools)
    // - empty array []: no tools allowed
    // - array with values: filter to only allowed tool names
    let tools: ReturnType<ZaiTools['getTools']> | undefined;
    if (allowedTools === undefined) {
      // Text-only mode - no tools
      tools = undefined;
    } else if (Array.isArray(allowedTools) && allowedTools.length === 0) {
      // Explicit empty array - no tools
      tools = undefined;
    } else if (Array.isArray(allowedTools)) {
      // Filter tools to only those in allowedTools
      const allTools = zaiTools.getTools();
      tools = allTools.filter((tool) => allowedTools.includes(tool.function?.name || ''));
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Get model-specific configuration
    const modelDef = ZAI_MODELS_DEF.find((m) => m.id === model);

    // Build system prompt: model-specific + user-provided
    let fullSystemPrompt = '';
    if (modelDef?.customSystemPrompt) {
      fullSystemPrompt = modelDef.customSystemPrompt;
    }
    if (systemPrompt) {
      const userSystemPrompt =
        typeof systemPrompt === 'string' ? systemPrompt : JSON.stringify(systemPrompt);
      fullSystemPrompt = fullSystemPrompt
        ? `${fullSystemPrompt}\n\n${userSystemPrompt}`
        : userSystemPrompt;
    }

    // Add combined system prompt
    if (fullSystemPrompt) {
      messages.push({ role: 'system', content: fullSystemPrompt });
    }

    // Add conversation history
    // TODO: Map provider messages to OpenAI messages if needed.
    // For now we assume a fresh start or simple prompt.

    // Add user prompt
    if (typeof prompt === 'string') {
      messages.push({ role: 'user', content: prompt });
    } else if (Array.isArray(prompt)) {
      const textParts = prompt.filter((p) => typeof p === 'string').join('\n');
      // TODO: handle image blocks if present
      messages.push({ role: 'user', content: textParts });
    }

    let turnCount = 0;

    // --- Agent Loop ---
    while (turnCount < maxTurns) {
      turnCount++;

      try {
        // Find model definition to ensure correct casing (GLM-4.7)
        const modelDef = ZAI_MODELS_DEF.find((m) => m.id === model);
        const apiModel = modelDef ? modelDef.modelString : model;

        // Call Z.AI API
        const stream: AsyncIterable<OpenAI.ChatCompletionChunk> =
          (await this.client.chat.completions.create({
            model: apiModel,
            messages,
            max_tokens: 8192, // Increased to support large file operations
            stream: true,
            // Only pass tools if we have them
            tools: tools && tools.length > 0 ? tools : undefined,
            tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
          })) as AsyncIterable<OpenAI.ChatCompletionChunk>;

        let currentContent = '';
        // Support multiple simultaneous tool calls from GLM-4
        const currentToolCalls: { id: string; name: string; arguments: string }[] = [];

        // We need to accumulate the full response for history,
        // but also yield incremental updates to UI.

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          const finishReason = chunk.choices[0]?.finish_reason;

          // 1. Handle Text Content
          // Check for reasoning content (GLM-4 specific)
          const reasoning = (delta as any)?.reasoning_content || (delta as any)?.thinking;
          if (reasoning) {
            currentContent += `\n*Thinking: ${reasoning}*\n`;
            yield {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [{ type: 'text', text: `\n*Thinking: ${reasoning}*\n` }],
              },
            };
          }

          if (delta?.content) {
            currentContent += delta.content;
            yield {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [{ type: 'text', text: delta.content }],
              },
            };
          }

          // 2. Handle Tool Calls (Streaming)
          // Z.AI GLM-4 can return multiple tool calls in a single response
          // and streams partial data across multiple chunks
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index ?? 0;

              // Initialize tool calls array if needed
              if (!currentToolCalls[index]) {
                currentToolCalls[index] = {
                  id: toolCall.id || `tool_${index}`,
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                };
              } else {
                // Append to existing tool call data
                if (toolCall.id) {
                  currentToolCalls[index].id = toolCall.id;
                }
                if (toolCall.function?.name) {
                  currentToolCalls[index].name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  currentToolCalls[index].arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }

        // Append assistant response to history
        const assistantMsg: OpenAI.ChatCompletionMessageParam = {
          role: 'assistant',
          content: currentContent || null,
        };

        // If we had tool calls, we need to handle them
        if (currentToolCalls.length > 0) {
          // Add all tool calls to assistant message
          assistantMsg.tool_calls = currentToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }));

          messages.push(assistantMsg);

          // Execute each tool call in sequence
          for (const toolCall of currentToolCalls) {
            // Normalize arguments
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(toolCall.arguments);
            } catch (e) {
              logger.error(`Failed to parse tool arguments for ${toolCall.name}`, e);
              // Add error result to history
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: Failed to parse tool arguments: ${e instanceof Error ? e.message : String(e)}`,
              });
              continue;
            }

            // Yield Tool Use to UI
            yield {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [
                  {
                    type: 'tool_use',
                    name: toolCall.name,
                    input: args,
                    tool_use_id: toolCall.id,
                  },
                ],
              },
            };

            // Execute Tool
            logger.info(`Executing tool: ${toolCall.name}`, args);
            const result = await zaiTools.executeTool(toolCall.name, args);

            // Add tool result to history
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }

          // Loop continues to send all tool results back to model
          continue;
        } else {
          // No tool calls -> Final response (text only)
          messages.push(assistantMsg);

          // Yield 'result' to signal completion of this query to AutoModeService
          yield {
            type: 'result',
            subtype: 'success',
            result: currentContent,
          };
          return;
        }
      } catch (error) {
        logger.error('Z.AI execution loop failed', error);
        yield {
          type: 'error',
          error: `Z.AI Error: ${error instanceof Error ? error.message : String(error)}`,
        };
        return;
      }
    }

    yield { type: 'error', error: 'Max turns reached.' };
  }

  /**
   * Detect Z.AI installation (API key check)
   */
  async detectInstallation(): Promise<InstallationStatus> {
    const hasApiKey = !!process.env.ZAI_API_KEY;
    return {
      installed: true, // It's a cloud service
      method: 'sdk',
      hasApiKey,
      authenticated: hasApiKey,
    };
  }

  /**
   * Get available Z.AI models
   */
  getAvailableModels(): ModelDefinition[] {
    // Cast strict type to mutable ModelDefinition array needed by interface
    return ZAI_MODELS_DEF.map((m) => ({
      ...m,
      tier: m.tier as 'basic' | 'standard' | 'premium',
    }));
  }

  /**
   * Check feature support
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = ['text', 'vision', 'tools', 'json_mode'];
    return supportedFeatures.includes(feature);
  }
}
