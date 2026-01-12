/**
 * Generic Worker Thread
 *
 * Handles various CPU-intensive tasks in a background thread.
 * Receives messages from the main thread and responds with results.
 *
 * Supported task types:
 * - 'parse-dependencies': Parse and resolve dependencies
 * - 'scan-files': Scan directory for files
 * - 'analyze-code': Analyze code structure
 */

import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

const workerId = workerData?.workerId || 0;

// Task handlers
const handlers: Record<string, (data: unknown) => Promise<unknown>> = {
  /**
   * Parse dependencies from package.json files
   */
  'parse-dependencies': async (data: { projectPath: string }) => {
    const packageJsonPath = path.join(data.projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return { dependencies: {}, devDependencies: {} };
    }

    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      name: pkg.name,
      version: pkg.version,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
    };
  },

  /**
   * Scan directory for files matching patterns
   */
  'scan-files': async (data: { directory: string; patterns?: string[]; maxDepth?: number }) => {
    const files: string[] = [];
    const patterns = data.patterns || ['*'];
    const maxDepth = data.maxDepth || 10;

    function scanDir(dir: string, depth: number): void {
      if (depth > maxDepth) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return; // Skip inaccessible directories
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip common ignore directories
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            continue;
          }
          scanDir(fullPath, depth + 1);
        } else {
          // Check if file matches any pattern
          const matches = patterns.some((pattern) => {
            if (pattern === '*') return true;
            if (pattern.startsWith('*.')) {
              return entry.name.endsWith(pattern.slice(1));
            }
            return entry.name === pattern;
          });

          if (matches) {
            files.push(fullPath);
          }
        }
      }
    }

    scanDir(data.directory, 0);
    return { files, count: files.length };
  },

  /**
   * Analyze code structure (basic AST-like analysis)
   */
  'analyze-code': async (data: { filePath: string }) => {
    const content = fs.readFileSync(data.filePath, 'utf-8');
    const lines = content.split('\n');

    const analysis = {
      lines: lines.length,
      imports: [] as string[],
      exports: [] as string[],
      functions: [] as string[],
      classes: [] as string[],
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('import(')) {
        analysis.imports.push(trimmed);
      }

      // Detect exports
      if (trimmed.startsWith('export ')) {
        analysis.exports.push(trimmed.substring(0, 100)); // Truncate long exports
      }

      // Detect functions
      const funcMatch = trimmed.match(/^(async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        analysis.functions.push(funcMatch[2]);
      }

      // Detect arrow functions with names
      const arrowMatch = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/);
      if (arrowMatch) {
        analysis.functions.push(arrowMatch[3]);
      }

      // Detect classes
      const classMatch = trimmed.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        analysis.classes.push(classMatch[3]);
      }
    }

    return analysis;
  },

  /**
   * Heavy computation example (for testing)
   */
  compute: async (data: { iterations: number }) => {
    let result = 0;
    for (let i = 0; i < data.iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    return { result, iterations: data.iterations };
  },
};

// Listen for messages from main thread
parentPort?.on('message', async (message: { type: string; data: unknown }) => {
  try {
    const handler = handlers[message.type];

    if (!handler) {
      parentPort?.postMessage({
        success: false,
        error: `Unknown task type: ${message.type}`,
      });
      return;
    }

    const result = await handler(message.data);
    parentPort?.postMessage({
      success: true,
      data: result,
    });
  } catch (error) {
    parentPort?.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Signal ready
parentPort?.postMessage({ type: 'ready', workerId });
