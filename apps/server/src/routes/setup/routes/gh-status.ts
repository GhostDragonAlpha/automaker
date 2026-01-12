/**
 * GET /gh-status endpoint - Get GitHub CLI status
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getGitHubCliPaths, getExtendedPath, systemPathAccess } from '@automaker/platform';
import { getErrorMessage, logError } from '../common.js';

const execAsync = promisify(exec);

const execEnv = {
  ...process.env,
  PATH: getExtendedPath(),
};

export interface GhStatus {
  installed: boolean;
  authenticated: boolean;
  version: string | null;
  path: string | null;
  user: string | null;
  error?: string;
}

async function getGhStatus(): Promise<GhStatus> {
  const status: GhStatus = {
    installed: false,
    authenticated: false,
    version: null,
    path: null,
    user: null,
  };

  // Check if gh CLI is installed
  const isWindows = process.platform === 'win32';

  try {
    // Primary check: Try to locate executable
    const findCommand = isWindows ? 'where gh' : 'command -v gh';
    // Use shell: true to better support shims/aliases on Windows
    const { stdout } = await execAsync(findCommand, { env: execEnv, shell: true });
    const foundPath = stdout.trim().split(/\r?\n/)[0];
    if (foundPath) {
      status.path = foundPath;
      status.installed = true;
    }
  } catch (e) {
    // Locate failed, but command might still be runnable (e.g. shim)
  }

  // Secondary check: If not found by 'where', try checking version directly
  if (!status.installed) {
    try {
      const { stdout } = await execAsync('gh --version', { env: execEnv });
      if (stdout.includes('gh version')) {
        status.installed = true;
        status.path = 'gh'; // Assume it's in PATH even if 'where' failed
        status.version = stdout.match(/gh version ([\d.]+)/)?.[1] || null;
      }
    } catch {
      // Only checking hardcoded paths if direct execution failed
      const commonPaths = getGitHubCliPaths();
      for (const p of commonPaths) {
        try {
          if (await systemPathAccess(p)) {
            status.path = p;
            status.installed = true;
            break;
          }
        } catch {}
      }
    }
  }

  if (!status.installed) {
    return status;
  }

  // Get version
  try {
    const { stdout } = await execAsync('gh --version', { env: execEnv });
    // Extract version from output like "gh version 2.40.1 (2024-01-09)"
    const versionMatch = stdout.match(/gh version ([\d.]+)/);
    status.version = versionMatch ? versionMatch[1] : stdout.trim().split('\n')[0];
  } catch {
    // Version command failed
  }

  // Check authentication status by actually making an API call
  // gh auth status can return non-zero even when GH_TOKEN is valid
  let apiCallSucceeded = false;
  try {
    const { stdout } = await execAsync('gh api user --jq ".login"', { env: execEnv });
    const user = stdout.trim();
    if (user) {
      status.authenticated = true;
      status.user = user;
      apiCallSucceeded = true;
    }
    // If stdout is empty, fall through to gh auth status fallback
  } catch {
    // API call failed - fall through to gh auth status fallback
  }

  // Fallback: try gh auth status if API call didn't succeed
  if (!apiCallSucceeded) {
    try {
      const { stdout } = await execAsync('gh auth status', { env: execEnv });
      status.authenticated = true;

      // Try to extract username from output
      const userMatch =
        stdout.match(/Logged in to [^\s]+ account ([^\s]+)/i) ||
        stdout.match(/Logged in to [^\s]+ as ([^\s]+)/i);
      if (userMatch) {
        status.user = userMatch[1];
      }
    } catch {
      // Auth status returns non-zero if not authenticated
      status.authenticated = false;
    }
  }

  return status;
}

export function createGhStatusHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await getGhStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      logError(error, 'Get GitHub CLI status failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
