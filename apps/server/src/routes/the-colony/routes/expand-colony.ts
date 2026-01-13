/**
 * Expand Colony Route Handler
 * POST /api/the-colony/colonies/:id/expand
 */

import { Request, Response } from 'express';
import { expandColony, initializeColonyService } from '../../../services/colony-service';

export async function handleExpandColony(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { id } = req.params;
    const expansionPlan = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Colony ID is required',
      });
      return;
    }

    const result = expandColony(id, expansionPlan);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Colony expansion initiated successfully',
    });
  } catch (error: any) {
    console.error('Error expanding colony:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to expand colony',
    });
  }
}
