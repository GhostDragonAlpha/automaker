/**
 * Get Colony Habitability Route Handler
 * GET /api/the-colony/colonies/:id/habitability
 */

import { Request, Response } from 'express';
import { getHabitabilityScore, initializeColonyService } from '../../../services/colony-service';

export async function handleGetHabitability(req: Request, res: Response): Promise<void> {
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

    const habitability = getHabitabilityScore(id);

    res.status(200).json({
      success: true,
      data: habitability,
    });
  } catch (error: any) {
    console.error('Error getting colony habitability:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get colony habitability',
    });
  }
}
