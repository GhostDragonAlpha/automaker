/**
 * Get Colony Route Handler
 * GET /api/the-colony/colonies/:id
 */

import { Request, Response } from 'express';
import { getColony, initializeColonyService } from '../../../services/colony-service';

export async function handleGetColony(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Colony ID is required',
      });
      return;
    }

    const colony = getColony(id);

    if (!colony) {
      res.status(404).json({
        success: false,
        error: 'Colony not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: colony,
    });
  } catch (error: any) {
    console.error('Error getting colony:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get colony',
    });
  }
}
