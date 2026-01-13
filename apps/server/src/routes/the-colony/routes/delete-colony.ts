/**
 * Delete Colony Route Handler
 * DELETE /api/the-colony/colonies/:id
 */

import { Request, Response } from 'express';
import { deleteColony, initializeColonyService } from '../../../services/colony-service';

export async function handleDeleteColony(req: Request, res: Response): Promise<void> {
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

    const deleted = deleteColony(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Colony not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Colony abandoned successfully',
    });
  } catch (error: any) {
    console.error('Error deleting colony:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete colony',
    });
  }
}
