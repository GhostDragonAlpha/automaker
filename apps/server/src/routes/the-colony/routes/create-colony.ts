/**
 * Create Colony Route Handler
 * POST /api/the-colony/colonies
 */

import { Request, Response } from 'express';
import { createColony, initializeColonyService } from '../../../services/colony-service';

export async function handleCreateColony(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { name, location, options } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Colony name is required and must be a string',
      });
      return;
    }

    if (!location || !location.world) {
      res.status(400).json({
        success: false,
        error: 'Location with world is required',
      });
      return;
    }

    // Create colony
    const result = await createColony(name, location, options);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating colony:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create colony',
    });
  }
}
