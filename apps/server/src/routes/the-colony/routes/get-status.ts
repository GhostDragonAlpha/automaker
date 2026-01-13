/**
 * Get Colony Service Status Route Handler
 * GET /api/the-colony/status
 */

import { Request, Response } from 'express';
import { getColonyServiceStatus, initializeColonyService } from '../../../services/colony-service';

export async function handleGetStatus(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const status = getColonyServiceStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Error getting colony service status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get colony service status',
    });
  }
}
