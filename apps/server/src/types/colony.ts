/**
 * Colony Type Definitions
 * Types for the Colony Service - Permanent off-world habitation management
 */

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface ColonyLocation {
  world: string;
  coordinates: Coordinates;
  terrain: 'plains' | 'mountains' | 'desert' | 'ice' | 'ocean' | 'caves' | 'crater';
  gravity: number;
  atmosphere: 'none' | 'thin' | 'breathable' | 'dense' | 'toxic';
}

export interface ColonyMetadata {
  founder: string;
  mission: string;
  specialization: 'general' | 'mining' | 'research' | 'agriculture' | 'manufacturing' | 'military';
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface Colony {
  id: string;
  name: string;
  location: ColonyLocation;
  status: 'establishing' | 'operational' | 'expanding' | 'declining' | 'abandoned';
  capacity: number;
  foundedAt: string;
  lastUpdated: string;
  metadata: ColonyMetadata;
}

export interface Demographics {
  scientists: number;
  engineers: number;
  workers: number;
  children: number;
  others: number;
}

export interface Population {
  colonyId: string;
  total: number;
  demographics: Demographics;
  birthRate: number;
  deathRate: number;
  migrationRate: number;
  lastUpdate: string;
}

export interface ResourceLevel {
  level: number;
  capacity: number;
  production: number;
  consumption: number;
}

export interface Resources {
  colonyId: string;
  oxygen: ResourceLevel;
  water: ResourceLevel;
  food: ResourceLevel;
  energy: ResourceLevel;
  materials: ResourceLevel;
  lastUpdate: string;
}

export interface HabitatModules {
  count: number;
  capacity: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export interface LifeSupport {
  status: 'operational' | 'degraded' | 'critical' | 'offline';
  efficiency: number;
  backup: boolean;
}

export interface PowerSystems {
  status: 'operational' | 'degraded' | 'critical' | 'offline';
  primary: 'solar' | 'nuclear' | 'geothermal' | 'fusion' | 'battery';
  backup: 'solar' | 'nuclear' | 'geothermal' | 'fusion' | 'battery' | 'none';
}

export interface Communication {
  status: 'online' | 'degraded' | 'offline';
  bandwidth: 'low' | 'medium' | 'high';
  latency: 'low' | 'medium' | 'high';
}

export interface Transport {
  landingPads: number;
  vehicles: number;
  status: 'operational' | 'degraded' | 'critical' | 'offline';
}

export interface ResearchFacilities {
  labs: number;
  facilities: number;
  status: 'operational' | 'degraded' | 'critical' | 'offline';
}

export interface Manufacturing {
  factories: number;
  output: 'low' | 'normal' | 'high';
  status: 'operational' | 'degraded' | 'critical' | 'offline';
}

export interface Agriculture {
  hydroponics: number;
  greenhouses: number;
  status: 'operational' | 'degraded' | 'critical' | 'offline';
}

export interface Medical {
  bays: number;
  beds: number;
  staff: number;
  status: 'operational' | 'degraded' | 'critical' | 'offline';
}

export interface Defense {
  status: 'minimal' | 'moderate' | 'high' | 'maximum';
  shields: boolean;
  weapons: number;
}

export interface Infrastructure {
  colonyId: string;
  habitatModules: HabitatModules;
  lifeSupport: LifeSupport;
  powerSystems: PowerSystems;
  communication: Communication;
  transport: Transport;
  research: ResearchFacilities;
  manufacturing: Manufacturing;
  agriculture: Agriculture;
  medical: Medical;
  defense: Defense;
  lastUpdate: string;
}

export interface ColonyMetrics {
  totalColonies: number;
  totalPopulation: number;
  totalInfrastructure: number;
  colonizationSuccessRate: number;
  resourceEfficiency: number;
  averageHabitability: number;
}

export interface ColonyCreateOptions {
  capacity?: number;
  initialPopulation?: number;
  scientists?: number;
  engineers?: number;
  workers?: number;
  children?: number;
  founder?: string;
  mission?: string;
  specialization?: ColonyMetadata['specialization'];
  priority?: ColonyMetadata['priority'];
}
