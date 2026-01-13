/**
 * Colony Service (TypeScript)
 * Permanent off-world habitation management system
 *
 * Manages colonies established on celestial bodies:
 * - Colony creation and administration
 * - Population tracking and demographics
 * - Resource management (oxygen, water, food, energy)
 * - Life support systems monitoring
 * - Colony expansion and growth
 * - Habitability status assessment
 * - Inter-colony communication and logistics
 */

import {
  Colony,
  ColonyCreateOptions,
  ColonyLocation,
  Population,
  Resources,
  Infrastructure,
  ColonyMetrics,
} from '../types/colony';

// Configuration
const COLONY_CONFIG = {
  maxColonies: 50,
  defaultCapacity: 10000,
  resourceDecayRate: 0.01,
  growthRate: 0.001,
  enableTelemetry: true,
  autoResourceManagement: true,
} as const;

// State management
let isInitialized = false;
let colonyRegistry = new Map<string, Colony>();
let populationRegistry = new Map<string, Population>();
let resourceRegistry = new Map<string, Resources>();
let infrastructureRegistry = new Map<string, Infrastructure>();
let colonizationEvents: ColonyEvent[] = [];

// Metrics
let metrics: ColonyMetrics = {
  totalColonies: 0,
  totalPopulation: 0,
  totalInfrastructure: 0,
  colonizationSuccessRate: 1.0,
  resourceEfficiency: 0.95,
  averageHabitability: 0.75,
};

export interface ColonyConfig {
  maxColonies?: number;
  defaultCapacity?: number;
  resourceDecayRate?: number;
  growthRate?: number;
  enableTelemetry?: boolean;
  autoResourceManagement?: boolean;
}

export interface ColonyCreateResult {
  colony: Colony;
  population: Population;
  resources: Resources;
  infrastructure: Infrastructure;
  event: ColonyEvent;
}

export interface SimulationResult {
  populationChanges: PopulationChange[];
  resourceChanges: ResourceChange[];
  events: SimulationEvent[];
}

export interface PopulationChange {
  day: number;
  births: number;
  deaths: number;
  netChange: number;
  total: number;
}

export interface ResourceChange {
  day: number;
  resource: string;
  change: number;
  level: number;
  capacity: number;
}

export interface SimulationEvent {
  type: string;
  severity: string;
  resource: string;
  level: number;
  timestamp: string;
}

export interface ColonyEvent {
  type: string;
  colonyId?: string;
  name?: string;
  location?: ColonyLocation;
  expansion?: any;
  timestamp: string;
  duration?: number;
}

export interface HabitabilityScore {
  overall: number;
  resources: number;
  infrastructure: number;
  environmental: number;
  classification: string;
  recommendations: string[];
}

export interface ServiceStatus {
  initialized: boolean;
  config: typeof COLONY_CONFIG;
  registry: {
    totalColonies: number;
    totalPopulation: number;
  };
  metrics: ColonyMetrics;
  colonizationEvents: number;
}

/**
 * Initialize Colony Service
 */
export function initializeColonyService(config: ColonyConfig = {}): ServiceStatus {
  if (isInitialized) {
    console.warn('Colony Service is already initialized');
    return getColonyServiceStatus();
  }

  Object.assign(COLONY_CONFIG, config);
  isInitialized = true;

  console.log('🏗️  Colony Service initialized');
  console.log(`   Max colonies: ${COLONY_CONFIG.maxColonies}`);
  console.log(`   Default capacity: ${COLONY_CONFIG.defaultCapacity}`);
  console.log(`   Auto resource management: ${COLONY_CONFIG.autoResourceManagement}`);

  return {
    initialized: true,
    config: COLONY_CONFIG,
    registry: {
      totalColonies: 0,
      totalPopulation: 0,
    },
    metrics: { ...metrics },
    colonizationEvents: 0,
  };
}

/**
 * Create a new colony
 */
export async function createColony(
  name: string,
  location: ColonyLocation,
  options: ColonyCreateOptions = {}
): Promise<ColonyCreateResult> {
  if (!isInitialized) {
    throw new Error('Colony Service is not initialized');
  }

  console.log(`🚀 Establishing new colony: ${name}`);

  const colonyId = generateColonyId();
  const capacity = options.capacity || COLONY_CONFIG.defaultCapacity;
  const startTime = Date.now();

  const colony: Colony = {
    id: colonyId,
    name,
    location: {
      world: location.world || 'unknown',
      coordinates: location.coordinates || { x: 0, y: 0, z: 0 },
      terrain: location.terrain || 'plains',
      gravity: location.gravity || 1.0,
      atmosphere: location.atmosphere || 'none',
    },
    status: 'establishing',
    capacity,
    foundedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    metadata: {
      founder: options.founder || 'unknown',
      mission: options.mission || 'habitation',
      specialization: options.specialization || 'general',
      priority: options.priority || 'normal',
    },
  };

  const initialPopulation: Population = {
    colonyId,
    total: options.initialPopulation || 100,
    demographics: {
      scientists: options.scientists || 20,
      engineers: options.engineers || 20,
      workers: options.workers || 40,
      children: options.children || 10,
      others: 10,
    },
    birthRate: 0.001,
    deathRate: 0.0005,
    migrationRate: 0,
    lastUpdate: new Date().toISOString(),
  };

  const initialResources: Resources = {
    colonyId,
    oxygen: { level: 100, capacity: 100, production: 10, consumption: 5 },
    water: { level: 100, capacity: 100, production: 8, consumption: 6 },
    food: { level: 100, capacity: 100, production: 12, consumption: 7 },
    energy: { level: 100, capacity: 100, production: 15, consumption: 10 },
    materials: { level: 50, capacity: 200, production: 5, consumption: 3 },
    lastUpdate: new Date().toISOString(),
  };

  const initialInfrastructure: Infrastructure = {
    colonyId,
    habitatModules: { count: 5, capacity: 20, condition: 'good' },
    lifeSupport: { status: 'operational', efficiency: 0.95, backup: true },
    powerSystems: { status: 'operational', primary: 'solar', backup: 'nuclear' },
    communication: { status: 'online', bandwidth: 'high', latency: 'low' },
    transport: { landingPads: 2, vehicles: 5, status: 'operational' },
    research: { labs: 2, facilities: 3, status: 'operational' },
    manufacturing: { factories: 1, output: 'normal', status: 'operational' },
    agriculture: { hydroponics: 2, greenhouses: 1, status: 'operational' },
    medical: { bays: 3, beds: 50, staff: 10, status: 'operational' },
    defense: { status: 'minimal', shields: false, weapons: 0 },
    lastUpdate: new Date().toISOString(),
  };

  colonyRegistry.set(colonyId, colony);
  populationRegistry.set(colonyId, initialPopulation);
  resourceRegistry.set(colonyId, initialResources);
  infrastructureRegistry.set(colonyId, initialInfrastructure);

  const event: ColonyEvent = {
    type: 'colony-established',
    colonyId,
    name,
    location: colony.location,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
  colonizationEvents.push(event);

  metrics.totalColonies++;
  metrics.totalPopulation += initialPopulation.total;
  metrics.totalInfrastructure += calculateInfrastructureScore(initialInfrastructure);

  setTimeout(() => {
    const currentColony = colonyRegistry.get(colonyId);
    if (currentColony) {
      currentColony.status = 'operational';
      currentColony.lastUpdated = new Date().toISOString();
      console.log(`✅ Colony ${name} is now operational`);
    }
  }, 1000);

  console.log(`✅ Colony established: ${name} (${colonyId})`);

  return {
    colony,
    population: initialPopulation,
    resources: initialResources,
    infrastructure: initialInfrastructure,
    event,
  };
}

/**
 * Get colony by ID
 */
export function getColony(
  colonyId: string
): {
  colony: Colony;
  population: Population;
  resources: Resources;
  infrastructure: Infrastructure;
} | null {
  const colony = colonyRegistry.get(colonyId);

  if (!colony) {
    return null;
  }

  return {
    colony,
    population: populationRegistry.get(colonyId)!,
    resources: resourceRegistry.get(colonyId)!,
    infrastructure: infrastructureRegistry.get(colonyId)!,
  };
}

/**
 * Get all colonies with optional filtering
 */
export function getAllColonies(
  filters: { status?: string; world?: string; specialization?: string } = {}
): Array<{
  colony: Colony;
  population: Population;
  resources: Resources;
  infrastructure: Infrastructure;
}> {
  const results: Array<{
    colony: Colony;
    population: Population;
    resources: Resources;
    infrastructure: Infrastructure;
  }> = [];

  for (const [colonyId, colony] of colonyRegistry.entries()) {
    const data = {
      colony,
      population: populationRegistry.get(colonyId)!,
      resources: resourceRegistry.get(colonyId)!,
      infrastructure: infrastructureRegistry.get(colonyId)!,
    };

    let matches = true;

    if (filters.status && colony.status !== filters.status) {
      matches = false;
    }

    if (filters.world && colony.location.world !== filters.world) {
      matches = false;
    }

    if (filters.specialization && colony.metadata.specialization !== filters.specialization) {
      matches = false;
    }

    if (matches) {
      results.push(data);
    }
  }

  return results;
}

/**
 * Update colony resources
 */
export function updateColonyResources(
  colonyId: string,
  resourceUpdates: Partial<Resources>
): Resources {
  const resources = resourceRegistry.get(colonyId);

  if (!resources) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  for (const [resource, updates] of Object.entries(resourceUpdates)) {
    if (typeof updates === 'object' && updates !== null && resource in resources) {
      Object.assign((resources as any)[resource], updates);
    }
  }

  resources.lastUpdate = new Date().toISOString();
  checkResourceLevels(colonyId);

  return resources;
}

/**
 * Update colony population
 */
export function updateColonyPopulation(
  colonyId: string,
  populationUpdates: Partial<Population>
): Population {
  const population = populationRegistry.get(colonyId);

  if (!population) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  Object.assign(population, populationUpdates);
  population.lastUpdate = new Date().toISOString();
  recalculatePopulationMetrics();

  return population;
}

/**
 * Update colony infrastructure
 */
export function updateColonyInfrastructure(
  colonyId: string,
  infrastructureUpdates: Partial<Infrastructure>
): Infrastructure {
  const infrastructure = infrastructureRegistry.get(colonyId);

  if (!infrastructure) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  for (const [system, updates] of Object.entries(infrastructureUpdates)) {
    if (typeof updates === 'object' && updates !== null && system in infrastructure) {
      Object.assign((infrastructure as any)[system], updates);
    }
  }

  infrastructure.lastUpdate = new Date().toISOString();
  recalculateInfrastructureMetrics();

  return infrastructure;
}

/**
 * Expand colony
 */
export function expandColony(
  colonyId: string,
  expansionPlan: { capacityIncrease?: number; newModules?: Array<{ type: string }> }
): {
  colony: Colony;
  population: Population;
  resources: Resources;
  infrastructure: Infrastructure;
} {
  const colony = colonyRegistry.get(colonyId);

  if (!colony) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  if (colony.status !== 'operational') {
    throw new Error(`Colony ${colonyId} cannot be expanded (status: ${colony.status})`);
  }

  console.log(`📈 Expanding colony: ${colony.name}`);

  if (expansionPlan.capacityIncrease) {
    colony.capacity += expansionPlan.capacityIncrease;
  }

  const infrastructure = infrastructureRegistry.get(colonyId)!;
  if (expansionPlan.newModules) {
    for (const module of expansionPlan.newModules) {
      if ((infrastructure as any)[module.type]) {
        (infrastructure as any)[module.type].count =
          ((infrastructure as any)[module.type].count || 0) + 1;
      }
    }
  }

  colony.status = 'expanding';
  colony.lastUpdated = new Date().toISOString();

  const event: ColonyEvent = {
    type: 'colony-expanded',
    colonyId,
    name: colony.name,
    expansion: expansionPlan,
    timestamp: new Date().toISOString(),
  };
  colonizationEvents.push(event);

  setTimeout(() => {
    const currentColony = colonyRegistry.get(colonyId);
    if (currentColony && currentColony.status === 'expanding') {
      currentColony.status = 'operational';
      currentColony.lastUpdated = new Date().toISOString();
      console.log(`✅ Colony ${colony.name} expansion complete`);
    }
  }, 5000);

  console.log(`✅ Colony expansion initiated: ${colony.name}`);

  return getColony(colonyId)!;
}

/**
 * Simulate colony time step
 */
export function simulateColonyTime(colonyId: string, days: number = 1): SimulationResult {
  const colony = colonyRegistry.get(colonyId);

  if (!colony) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  const population = populationRegistry.get(colonyId)!;
  const resources = resourceRegistry.get(colonyId)!;

  const result: SimulationResult = {
    populationChanges: [],
    resourceChanges: [],
    events: [],
  };

  for (let day = 0; day < days; day++) {
    const births = Math.floor(population.total * population.birthRate);
    const deaths = Math.floor(population.total * population.deathRate);
    const netChange = births - deaths + population.migrationRate;

    population.total = Math.max(0, population.total + netChange);

    result.populationChanges.push({
      day: day + 1,
      births,
      deaths,
      netChange,
      total: population.total,
    });

    for (const [resourceName, resource] of Object.entries(resources)) {
      if (typeof resource === 'object' && resource !== null && 'level' in resource) {
        const res = resource as {
          level: number;
          capacity: number;
          production: number;
          consumption: number;
        };
        const netResourceChange = res.production - res.consumption;
        res.level = Math.max(0, Math.min(res.capacity, res.level + netResourceChange));

        result.resourceChanges.push({
          day: day + 1,
          resource: resourceName,
          change: netResourceChange,
          level: res.level,
          capacity: res.capacity,
        });

        if (res.level < 20) {
          result.events.push({
            type: 'resource-warning',
            severity: 'critical',
            resource: resourceName,
            level: res.level,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  population.lastUpdate = new Date().toISOString();
  (resources as any).lastUpdate = new Date().toISOString();
  colony.lastUpdated = new Date().toISOString();

  recalculatePopulationMetrics();

  return result;
}

/**
 * Delete a colony
 */
export function deleteColony(colonyId: string): boolean {
  const colony = colonyRegistry.get(colonyId);

  if (!colony) {
    return false;
  }

  console.log(`🗑️  Abandoning colony: ${colony.name}`);

  colony.status = 'abandoned';
  colony.lastUpdated = new Date().toISOString();

  const event: ColonyEvent = {
    type: 'colony-abandoned',
    colonyId,
    name: colony.name,
    timestamp: new Date().toISOString(),
  };
  colonizationEvents.push(event);

  setTimeout(() => {
    colonyRegistry.delete(colonyId);
    populationRegistry.delete(colonyId);
    resourceRegistry.delete(colonyId);
    infrastructureRegistry.delete(colonyId);

    metrics.totalColonies--;
    recalculatePopulationMetrics();
    recalculateInfrastructureMetrics();
  }, 60000);

  console.log(`✅ Colony abandoned: ${colony.name}`);

  return true;
}

/**
 * Get habitability score for a colony
 */
export function getHabitabilityScore(colonyId: string): HabitabilityScore {
  const colony = colonyRegistry.get(colonyId);
  const resources = resourceRegistry.get(colonyId);
  const infrastructure = infrastructureRegistry.get(colonyId);

  if (!colony || !resources || !infrastructure) {
    throw new Error(`Colony ${colonyId} not found`);
  }

  const resourceScore = calculateResourceScore(resources);
  const infrastructureScore = calculateInfrastructureScore(infrastructure) / 100;
  const environmentalScore = calculateEnvironmentalScore(colony);

  const habitability = resourceScore * 0.4 + infrastructureScore * 0.4 + environmentalScore * 0.2;

  return {
    overall: habitability,
    resources: resourceScore,
    infrastructure: infrastructureScore,
    environmental: environmentalScore,
    classification: getHabitabilityClassification(habitability),
    recommendations: generateHabitabilityRecommendations(
      resourceScore,
      infrastructureScore,
      environmentalScore
    ),
  };
}

/**
 * Get colony service status
 */
export function getColonyServiceStatus(): ServiceStatus {
  return {
    initialized: isInitialized,
    config: COLONY_CONFIG,
    registry: {
      totalColonies: colonyRegistry.size,
      totalPopulation: Array.from(populationRegistry.values()).reduce((sum, p) => sum + p.total, 0),
    },
    metrics: { ...metrics },
    colonizationEvents: colonizationEvents.length,
  };
}

/**
 * Get colonization events
 */
export function getColonizationEvents(
  filters: { type?: string; colonyId?: string; limit?: number } = {}
): ColonyEvent[] {
  let events = [...colonizationEvents];

  if (filters.type) {
    events = events.filter((event) => event.type === filters.type);
  }

  if (filters.colonyId) {
    events = events.filter((event) => event.colonyId === filters.colonyId);
  }

  if (filters.limit) {
    events = events.slice(-filters.limit);
  }

  return events;
}

/**
 * Clear all colonies
 */
export function clearAllColonies(): void {
  const count = colonyRegistry.size;
  colonyRegistry.clear();
  populationRegistry.clear();
  resourceRegistry.clear();
  infrastructureRegistry.clear();
  colonizationEvents = [];
  console.log(`🧹 Cleared ${count} colonies`);
}

/**
 * Cleanup Colony Service
 */
export function cleanupColonyService(): void {
  if (!isInitialized) {
    return;
  }

  clearAllColonies();

  metrics = {
    totalColonies: 0,
    totalPopulation: 0,
    totalInfrastructure: 0,
    colonizationSuccessRate: 1.0,
    resourceEfficiency: 0.95,
    averageHabitability: 0.75,
  };

  isInitialized = false;
  console.log('🛑 Colony Service cleaned up');
}

// Helper functions

function generateColonyId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `colony-${timestamp}-${random}`;
}

function calculateInfrastructureScore(infrastructure: Infrastructure): number {
  let score = 0;
  for (const [system, data] of Object.entries(infrastructure)) {
    if (typeof data === 'object' && data !== null && 'count' in data) {
      score += (data as { count: number }).count * 10;
    }
  }
  return score;
}

function calculateResourceScore(resources: Resources): number {
  let totalLevel = 0;
  let totalCapacity = 0;
  let count = 0;

  for (const [name, resource] of Object.entries(resources)) {
    if (typeof resource === 'object' && resource !== null && 'level' in resource) {
      const res = resource as { level: number; capacity: number };
      totalLevel += res.level;
      totalCapacity += res.capacity;
      count++;
    }
  }

  return count > 0 ? totalLevel / totalCapacity : 0;
}

function calculateEnvironmentalScore(colony: Colony): number {
  let score = 0.5;

  if (colony.location.gravity >= 0.8 && colony.location.gravity <= 1.2) {
    score += 0.2;
  } else if (colony.location.gravity >= 0.5 && colony.location.gravity <= 1.5) {
    score += 0.1;
  }

  if (colony.location.atmosphere === 'breathable') {
    score += 0.3;
  } else if (colony.location.atmosphere === 'thin') {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

function getHabitabilityClassification(habitability: number): string {
  if (habitability >= 0.9) return 'excellent';
  if (habitability >= 0.7) return 'good';
  if (habitability >= 0.5) return 'moderate';
  if (habitability >= 0.3) return 'poor';
  return 'uninhabitable';
}

function generateHabitabilityRecommendations(
  resourceScore: number,
  infrastructureScore: number,
  environmentalScore: number
): string[] {
  const recommendations: string[] = [];

  if (resourceScore < 0.5) {
    recommendations.push('Increase resource production capacity');
    recommendations.push('Implement resource conservation measures');
  }

  if (infrastructureScore < 0.5) {
    recommendations.push('Expand infrastructure systems');
    recommendations.push('Upgrade life support systems');
  }

  if (environmentalScore < 0.3) {
    recommendations.push('Enhance environmental protection');
    recommendations.push('Improve habitat shielding');
  }

  return recommendations;
}

function checkResourceLevels(colonyId: string): void {
  const resources = resourceRegistry.get(colonyId);

  if (!resources) return;

  for (const [resourceName, resource] of Object.entries(resources)) {
    if (typeof resource === 'object' && resource !== null && 'level' in resource) {
      const res = resource as { level: number };
      if (res.level < 10) {
        const event: ColonyEvent = {
          type: 'critical-resource-shortage',
          colonyId,
          resource: resourceName,
          timestamp: new Date().toISOString(),
        } as any;
        colonizationEvents.push(event);
        console.warn(`⚠️  Critical shortage in ${resourceName} for colony ${colonyId}`);
      }
    }
  }
}

function recalculatePopulationMetrics(): void {
  metrics.totalPopulation = Array.from(populationRegistry.values()).reduce(
    (sum, p) => sum + p.total,
    0
  );
}

function recalculateInfrastructureMetrics(): void {
  let totalScore = 0;
  for (const infrastructure of infrastructureRegistry.values()) {
    totalScore += calculateInfrastructureScore(infrastructure);
  }
  metrics.totalInfrastructure = totalScore;
}

console.log('Colony Service (TypeScript) module loaded');
