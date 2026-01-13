/**
 * Generate subtasks route - Returns structured AI subtasks for a parent task
 */

import type { Request, Response } from 'express';
import type { IdeationService } from '../../../services/ideation-service.js';
import { createLogger } from '@automaker/utils';
import { getErrorMessage, logError } from '../common.js';

const logger = createLogger('ideation:tasks-generate');

export function createTasksGenerateHandler(ideationService: IdeationService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, parentTask, count, context } = req.body;

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath is required' });
        return;
      }

      if (!parentTask) {
        res.status(400).json({ success: false, error: 'parentTask is required' });
        return;
      }

      // Default to 5 subtasks, allow 1-50
      const taskCount = Math.min(Math.max(count || 5, 1), 50);

      logger.info(`Generating ${taskCount} subtasks for: ${parentTask.substring(0, 30)}...`);

      const suggestions = await ideationService.generateSubtasks(
        projectPath,
        parentTask,
        taskCount,
        context
      );

      res.json({
        success: true,
        suggestions,
      });
    } catch (error) {
      logError(error, 'Failed to generate subtasks');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      });
    }
  };
}
