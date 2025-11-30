/**
 * GYMPULSE STATIC UPDATER
 * Run this script via a cron job (e.g., GitHub Actions) to update the history file.
 * Command: node update_data.js
 */

const fs = require('fs');
const path = require('path');

// Dynamic import for fetch (ESM/CommonJS compat)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const DATA_FILE = path.join(__dirname, 'gym_history.json');

// Configuration
const GYMS = [
  {
    id: 'glattpark',
    url: 'https://www.fitnesspark.ch/wp/wp-admin/admin-ajax.php?action=single_park_update_visitors&park_id=698&location_id=31&location_name=FP_Glattpark'
  }
];

// Helper to get raw numeric data
async function fetchVisitors(url) {
  try {
    // Direct fetch (Node.js doesn't need CORS proxy)
    const res = await fetch(url, { headers: { 'User-Agent': 'GymPulse-Updater' } });
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    const val = parseInt(text.trim(), 10);
    return isNaN(val) ? null : val;
  } catch (e) {
    console.error("Fetch error:", e.message);
    return null;
  }
}

async function run() {
  console.log("Starting update...");
  
  // 1. Load existing data
  let db = {};
  if (fs.existsSync(DATA_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error("Error reading DB, starting fresh.");
    }
  }

  // 2. Fetch new data for all gyms
  for (const gym of GYMS) {
    const visitors = await fetchVisitors(gym.url);
    
    if (visitors !== null) {
      if (!db[gym.id]) db[gym.id] = [];
      
      const newPoint = {
        timestamp: Date.now(),
        visitors: visitors,
        maxCapacity: 300
      };
      
      // Prevent duplicates if run too frequently (check last timestamp)
      const last = db[gym.id][db[gym.id].length - 1];
      if (!last || (Date.now() - last.timestamp > 60000)) {
         db[gym.id].push(newPoint);
         console.log(`Updated ${gym.id}: ${visitors}`);
      } else {
         console.log(`Skipped ${gym.id} (updated recently)`);
      }
      
      // Optional: Trim history to prevent massive file size (keep last ~5000 points)
      if (db[gym.id].length > 5000) {
        db[gym.id] = db[gym.id].slice(-5000);
      }
    }
  }

  // 3. Save
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  console.log("Database saved.");
}

run();