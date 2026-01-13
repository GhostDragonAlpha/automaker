/**
 * Simulate Colony Route Handler
 * POST /api/the-colony/colonies/:id/simulate
 */

import { Request, Response } from 'express';
import { simulateColonyTime, initializeColonyService } from '../../../services/colony-service';

export async function handleSimulateColony(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { id } = req.params;
    const { days } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Colony ID is required',
      });
      return;
    }

    const simulationDays = typeof days === 'number' ? Math.max(1, Math.min(365, days)) : 1;

    const result = simulateColonyTime(id, simulationDays);

    res.status(200).json({
      success: true,
      data: result,
      message: `Colony simulation completed for ${simulationDays} day(s)`,
    });
  } catch (error: any) {
    console.error('Error simulating colony:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to simulate colony',
    });
  }
}
