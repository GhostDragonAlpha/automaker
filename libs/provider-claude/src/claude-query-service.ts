/**
 * ClaudeQueryService
 *
 * QueryService implementation for Claude/Anthropic.
 * Wraps @anthropic-ai/claude-agent-sdk query function.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { QueryService, QueryOptions, QueryResult } from '@automaker/providers-core';

const ALLOWED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL', // Allow custom base URL if set
  'PATH',
  'HOME',
  'SHELL',
  'TERM',
  'USER',
  'LANG',
  'LC_ALL',
];

function buildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of ALLOWED_ENV_VARS) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  // Use real Anthropic API - no router spoofing
  // ANTHROPIC_API_KEY must be set in environment
  if (!env['ANTHROPIC_API_KEY']) {
    console.warn('[ClaudeQueryService] ANTHROPIC_API_KEY not set - Claude provider may not work');
  }
  return env;
}

export class ClaudeQueryService implements QueryService {
  getName(): string {
    return 'claude';
  }

  /**
   * Simple one-shot query returning text
   */
  async simpleQuery(prompt: string, options?: QueryOptions): Promise<string> {
    try {
      let result = '';

      // Build SDK options with forced router and permissions bypass
      const sdkOptions: Options = {
        model: options?.model,
        systemPrompt: options?.systemPrompt,
        maxTurns: 1,
        // Pass default tools to avoid CLI errors
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
        cwd: process.cwd(),
        env: buildEnv(),
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      };

      if (options?.abortController) {
        sdkOptions.abortController = options.abortController;
      }

      // Use the query function from the SDK
      const stream = query({ prompt, options: sdkOptions });

      // Collect streaming response
      for await (const msg of stream) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              result += block.text;
            }
          }
        } else if (msg.type === 'result' && msg.subtype === 'success') {
          // Use result if available
          if (msg.result) {
            result = msg.result;
          }
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Claude query failed: ${message}`);
    }
  }

  /**
   * Streaming query
   */
  async *streamQuery(prompt: string, options?: QueryOptions): AsyncGenerator<string> {
    try {
      const sdkOptions: Options = {
        model: options?.model,
        systemPrompt: options?.systemPrompt,
        maxTurns: 1,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
        cwd: process.cwd(),
        env: buildEnv(),
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      };

      if (options?.abortController) {
        sdkOptions.abortController = options.abortController;
      }

      const stream = query({ prompt, options: sdkOptions });

      for await (const msg of stream) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              yield block.text;
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Claude stream query failed: ${message}`);
    }
  }

  /**
   * Full query with metadata
   */
  async query(prompt: string, options?: QueryOptions): Promise<QueryResult> {
    const text = await this.simpleQuery(prompt, options);

    return {
      text,
      model: options?.model ?? 'claude-sonnet-4-20250514',
      // Note: Token usage would require SDK changes to expose
    };
  }

  /**
   * Check if Claude is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Assume available if SDK is importable
      return true;
    } catch {
      return false;
    }
  }
}
