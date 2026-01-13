/**
 * The Colony Routes
 * Permanent off-world habitation management routes
 */

import { Router } from 'express';
import { handleCreateColony } from './routes/create-colony';
import { handleGetColony } from './routes/get-colony';
import { handleGetAllColonies } from './routes/get-all-colonies';
import { handleExpandColony } from './routes/expand-colony';
import { handleUpdateColonyResources } from './routes/update-colony-resources';
import { handleUpdateColonyPopulation } from './routes/update-colony-population';
import { handleSimulateColony } from './routes/simulate-colony';
import { handleGetHabitability } from './routes/get-habitability';
import { handleGetStatus } from './routes/get-status';
import { handleDeleteColony } from './routes/delete-colony';

export function createTheColonyRoutes() {
  const router = Router();

  /**
   * @route   GET /api/the-colony/status
   * @desc    Get colony service status
   */
  router.get('/status', handleGetStatus);

  /**
   * @route   GET /api/the-colony/colonies
   * @desc    Get all colonies with optional filtering
   * @query   status - Filter by colony status
   * @query   world - Filter by world
   * @query   specialization - Filter by specialization
   */
  router.get('/colonies', handleGetAllColonies);

  /**
   * @route   POST /api/the-colony/colonies
   * @desc    Create a new colony
   * @body    name - Colony name
   * @body    location - Colony location (world, coordinates, terrain, gravity, atmosphere)
   * @body    options - Colony options (capacity, initialPopulation, founder, etc.)
   */
  router.post('/colonies', handleCreateColony);

  /**
   * @route   GET /api/the-colony/colonies/:id
   * @desc    Get a specific colony by ID
   */
  router.get('/colonies/:id', handleGetColony);

  /**
   * @route   POST /api/the-colony/colonies/:id/expand
   * @desc    Expand a colony
   * @body    capacityIncrease - Number to increase capacity by
   * @body    newModules - Array of new module types to add
   */
  router.post('/colonies/:id/expand', handleExpandColony);

  /**
   * @route   PUT /api/the-colony/colonies/:id/resources
   * @desc    Update colony resources
   * @body    Resource updates (oxygen, water, food, energy, materials)
   */
  router.put('/colonies/:id/resources', handleUpdateColonyResources);

  /**
   * @route   PUT /api/the-colony/colonies/:id/population
   * @desc    Update colony population
   * @body    Population updates (total, demographics, birthRate, deathRate, etc.)
   */
  router.put('/colonies/:id/population', handleUpdateColonyPopulation);

  /**
   * @route   POST /api/the-colony/colonies/:id/simulate
   * @desc    Simulate colony time progression
   * @body    days - Number of days to simulate (1-365)
   */
  router.post('/colonies/:id/simulate', handleSimulateColony);

  /**
   * @route   GET /api/the-colony/colonies/:id/habitability
   * @desc    Get habitability score for a colony
   */
  router.get('/colonies/:id/habitability', handleGetHabitability);

  /**
   * @route   DELETE /api/the-colony/colonies/:id
   * @desc    Delete/abandon a colony
   */
  router.delete('/colonies/:id', handleDeleteColony);

  return router;
}
