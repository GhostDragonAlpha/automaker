/**
 * Update Colony Resources Route Handler
 * PUT /api/the-colony/colonies/:id/resources
 */

import { Request, Response } from 'express';
import { updateColonyResources, initializeColonyService } from '../../../services/colony-service';

export async function handleUpdateColonyResources(req: Request, res: Response): Promise<void> {
  try {
    // Ensure service is initialized
    initializeColonyService();

    const { id } = req.params;
    const resourceUpdates = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Colony ID is required',
      });
      return;
    }

    const resources = updateColonyResources(id, resourceUpdates);

    res.status(200).json({
      success: true,
      data: resources,
      message: 'Colony resources updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating colony resources:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update colony resources',
    });
  }
}
