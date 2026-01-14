/**
 * Z.AI Tool Definitions and Implementations
 *
 * Provides schemas (OpenAI format) and execution logic for standard tools
 * used by the agent (Bash, File Operations).
 *
 * Security: Uses secureFs to enforce ALLOWED_ROOT_DIRECTORY.
 */

import * as secureFs from '../lib/secure-fs.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
// @ts-ignore - glob may not have type declarations
import glob from 'glob';
const globAsync = promisify(glob);

const execAsync = promisify(exec);

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// --- Tool Schemas ---

// --- Tool Schemas ---

const BASH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Bash',
    description:
      'Execute a bash command. Use this for file operations, git commands, and system tasks.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute.',
        },
      },
      required: ['command'],
    },
  },
};

const READ_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Read',
    description: 'Read the contents of a file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to read.',
        },
      },
      required: ['path'],
    },
  },
};

const WRITE_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Write',
    description:
      'Write content to a file. Overwrites existing content. Create the file if it does not exist.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to write.',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
};

const EDIT_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Edit',
    description: 'Edit a file by replacing a unique string with a new string.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to edit.',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to replace. Must be unique in the file.',
        },
        new_string: {
          type: 'string',
          description: 'The new string to replace it with.',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
};

const GLOB_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Glob',
    description: 'Find files matching a glob pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern to match.',
        },
      },
      required: ['pattern'],
    },
  },
};

const GREP_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'Grep',
    description: 'Search for a pattern in a directory.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regex pattern to search for.',
        },
        path: {
          type: 'string',
          description: 'The directory path to search in.',
        },
        include: {
          type: 'string',
          description: 'Glob pattern to include files (e.g. "**/*.ts"). Defaults to "**/*".',
        },
      },
      required: ['pattern', 'path'],
    },
  },
};

const LIST_DIR_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'ListDir', // Keeping PascalCase consistency, though likely unused by AgentService defaults
    description: 'List contents of a directory. (Optional, use Bash "ls -R" usually preferred)',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list.',
        },
      },
      required: ['path'],
    },
  },
};

// --- Execution Logic ---

export class ZaiTools {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /**
   * Get all tool definitions for Z.AI
   */
  getTools(): ToolDefinition[] {
    return [BASH_TOOL, READ_FILE_TOOL, WRITE_FILE_TOOL, EDIT_FILE_TOOL, GLOB_TOOL, GREP_TOOL];
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'Bash':
        case 'bash': // Backwards compat
          return await this.executeBash(args.command as string);
        case 'Read':
        case 'read_file':
          return await this.executeReadFile(args.path as string);
        case 'Write':
        case 'write_file':
          return await this.executeWriteFile(args.path as string, args.content as string);
        case 'Edit':
          return await this.executeEditFile(
            args.path as string,
            args.old_string as string,
            args.new_string as string
          );
        case 'Glob':
        case 'glob':
          return await this.executeGlob(args.pattern as string);
        case 'Grep':
          return await this.executeGrep(
            args.pattern as string,
            args.path as string,
            args.include as string
          );
        case 'ListDir':
        case 'list_dir':
          return await this.executeListDir(args.path as string);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private resolvePath(filePath: string): string {
    return path.resolve(this.cwd, filePath);
  }

  private async executeBash(command: string): Promise<string> {
    if (!command) throw new Error('Command is required');
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
      if (stderr) {
        return `Stdout:\n${stdout}\n\nStderr:\n${stderr}`;
      }
      return stdout || 'Command executed successfully (no output).';
    } catch (error: any) {
      return `Command failed:\n${error.stderr || error.message}`;
    }
  }

  private async executeReadFile(filePath: string): Promise<string> {
    const resolved = this.resolvePath(filePath);
    // secureFs validates path is within allowed root
    const content = await secureFs.readFile(resolved, 'utf-8');
    return content as string;
  }

  private async executeWriteFile(filePath: string, content: string): Promise<string> {
    const resolved = this.resolvePath(filePath);
    const dir = path.dirname(resolved);
    await secureFs.mkdir(dir, { recursive: true });
    await secureFs.writeFile(resolved, content, 'utf-8');
    return `Successfully wrote to ${filePath}`;
  }

  private async executeEditFile(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<string> {
    const resolved = this.resolvePath(filePath);
    const content = (await secureFs.readFile(resolved, 'utf-8')) as string;

    // Check occurrence count
    const firstIndex = content.indexOf(oldString);
    if (firstIndex === -1) {
      throw new Error(`old_string not found in file: ${filePath}`);
    }
    const secondIndex = content.indexOf(oldString, firstIndex + 1);
    if (secondIndex !== -1) {
      throw new Error(`old_string matches multiple times in file. It must be unique.`);
    }

    const newContent = content.replace(oldString, newString);
    await secureFs.writeFile(resolved, newContent, 'utf-8');
    return `Successfully edited ${filePath}`;
  }

  private async executeGlob(pattern: string): Promise<string> {
    const files = await globAsync(pattern, { cwd: this.cwd });
    return files.join('\n') || 'No files found.';
  }

  private async executeListDir(dirPath: string): Promise<string> {
    const resolved = this.resolvePath(dirPath);
    const files = await secureFs.readdir(resolved);
    return files.join('\n');
  }

  private async executeGrep(
    pattern: string,
    searchPath: string,
    include?: string
  ): Promise<string> {
    // Simple JS implementation to avoid 'rg' dependency issues in various envs
    const resolvedPath = this.resolvePath(searchPath);
    const globPattern = include || '**/*';

    // Find files
    const files = await globAsync(globPattern, { cwd: resolvedPath, nodir: true });

    const results: string[] = [];
    const regex = new RegExp(pattern); // Validate regex?

    for (const file of files) {
      try {
        const fullPath = path.join(resolvedPath, file);
        const content = (await secureFs.readFile(fullPath, 'utf-8')) as string;
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });

        if (results.length > 100) {
          results.push('... truncated results ...');
          break;
        }
      } catch (e) {
        // Ignore read errors (binary files etc)
      }
    }

    return results.join('\n') || 'No matches found.';
  }
}
