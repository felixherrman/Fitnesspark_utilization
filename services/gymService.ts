import { GymData, GymConfig, DataPoint } from '../types';
import { RAW_DATA_GLATTPARK, parseRawData } from '../data/initialData';

const STORAGE_KEY = 'gym_pulse_data_v4'; 
const SERVER_URL = 'http://localhost:3001'; // Optional: For local dev with server.js
const STATIC_FILE_URL = './gym_history.json'; // For GitHub Pages / Static hosting

const DEFAULT_GYMS: GymConfig[] = [
  {
    id: 'glattpark',
    name: 'FP Glattpark',
    parkId: '698',
    locationId: '31',
    locationName: 'FP_Glattpark'
  }
];

export const loadGyms = async (): Promise<{ data: GymData[], source: 'server' | 'cloud' | 'local' }> => {
  // 1. Try fetching from Local Background Server (Dev Mode)
  try {
    const response = await fetch(`${SERVER_URL}/api/gyms`);
    if (response.ok) {
      const serverData = await response.json();
      return { data: serverData, source: 'server' };
    }
  } catch (e) {
    // Server offline, continue...
  }

  // 2. Try fetching from Static Cloud File (GitHub Pages Mode)
  try {
    const response = await fetch(STATIC_FILE_URL, { cache: "no-store" }); // no-store to get fresh version
    if (response.ok) {
      // The file structure in the static file matches the server structure:
      // { glattpark: [DataPoint, DataPoint...] }
      const historyDb = await response.json();
      
      const gymData: GymData[] = DEFAULT_GYMS.map(config => {
        const history = historyDb[config.id] || [];
        const lastPoint = history.length > 0 ? history[history.length - 1] : undefined;
        return {
          config,
          history,
          current: lastPoint, // Note: This might be up to 30 mins old, we will refresh it client-side immediately after load
          lastUpdated: lastPoint ? lastPoint.timestamp : 0
        };
      });
      
      return { data: gymData, source: 'cloud' };
    }
  } catch (e) {
    // File not found (first run), continue...
  }

  // 3. Fallback to Local Storage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { data: parsed, source: 'local' };
    } catch (e) {
      console.error("Failed to parse local storage", e);
    }
  }

  // 4. Seed default data (First run ever)
  const realHistory = parseRawData(RAW_DATA_GLATTPARK);
  
  const seedData = DEFAULT_GYMS.map(config => {
    const history = config.id === 'glattpark' ? realHistory : []; 
    const lastPoint = history.length > 0 ? history[history.length - 1] : undefined;

    return {
      config,
      history: history,
      current: lastPoint,
      lastUpdated: lastPoint ? lastPoint.timestamp : Date.now()
    };
  });

  return { data: seedData, source: 'local' };
};

export const saveGyms = (data: GymData[]) => {
  // We only save to local storage if we are in local mode.
  // In server/cloud mode, the source of truth is remote.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const addGymToServer = async (config: GymConfig) => {
  try {
    const urlParams = new URLSearchParams({
        action: 'single_park_update_visitors',
        park_id: config.parkId,
        location_id: config.locationId,
        location_name: config.locationName
    });
    const targetUrl = `https://www.fitnesspark.ch/wp/wp-admin/admin-ajax.php?${urlParams.toString()}`;

    await fetch(`${SERVER_URL}/api/gyms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...config,
            url: targetUrl
        })
    });
  } catch (e) {
    console.warn("Could not add to server.");
  }
};

export const fetchGymData = async (config: GymConfig): Promise<DataPoint | null> => {
  // Construct the specific URL format requested
  const params = new URLSearchParams({
    action: 'single_park_update_visitors',
    park_id: config.parkId,
    location_id: config.locationId,
    location_name: config.locationName
  });

  const targetUrl = `https://www.fitnesspark.ch/wp/wp-admin/admin-ajax.php?${params.toString()}`;
  
  // Use a CORS proxy to bypass browser restrictions
  const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const visitors = parseInt(text.trim(), 10);

    if (isNaN(visitors)) {
      throw new Error(`Invalid data received: ${text}`);
    }

    const max = 300; 

    return {
      timestamp: Date.now(),
      visitors: visitors,
      maxCapacity: max
    };

  } catch (error) {
    console.warn(`Fetch failed for ${config.name}:`, error);
    return null;
  }
};