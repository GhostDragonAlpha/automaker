/**
 * Update Colony Population Route Handler
 * PUT /api/the-colony/colonies/:id/population
 */

import { Request, Response } from 'express';
import { updateColonyPopulation, initializeColonyService } from '../../../services/colony-service';

export async function handleUpdateColonyPopulation(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { id } = req.params;
    const populationUpdates = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Colony ID is required',
      });
      return;
    }

    const population = updateColonyPopulation(id, populationUpdates);

    res.status(200).json({
      success: true,
      data: population,
      message: 'Colony population updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating colony population:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update colony population',
    });
  }
}
