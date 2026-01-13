/**
 * Get All Colonies Route Handler
 * GET /api/the-colony/colonies
 */

import { Request, Response } from 'express';
import { getAllColonies, initializeColonyService } from '../../../services/colony-service';

export async function handleGetAllColonies(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const filters = {
      status: req.query.status as string | undefined,
      world: req.query.world as string | undefined,
      specialization: req.query.specialization as string | undefined,
    };

    const colonies = getAllColonies(filters);

    res.status(200).json({
      success: true,
      data: colonies,
      count: colonies.length,
    });
  } catch (error: any) {
    console.error('Error getting all colonies:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get all colonies',
    });
  }
}
