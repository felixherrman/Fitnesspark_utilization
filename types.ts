export interface GymConfig {
  id: string;
  name: string;
  parkId: string;
  locationId: string;
  locationName: string; // Used in API call
}

export interface DataPoint {
  timestamp: number;
  visitors: number;
  maxCapacity: number;
}

export interface GymData {
  config: GymConfig;
  current?: DataPoint;
  history: DataPoint[];
  lastUpdated: number;
}

export interface PredictionResult {
  trend: 'Rising' | 'Falling' | 'Stable';
  confidence: number;
  reasoning: string;
  predictedUsageNextHour: number;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  DETAIL = 'DETAIL',
}