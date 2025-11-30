/**
 * GYMPULSE SERVER
 * 
 * Setup:
 * 1. Create a folder and place this file inside as 'server.js'
 * 2. Run: npm init -y
 * 3. Run: npm install express cors node-fetch
 * 4. Start: node server.js
 * 
 * This server will:
 * - Run continuously in the background
 * - Fetch gym data every 30 minutes
 * - Save data to 'gym_history.json'
 * - Serve the data to your React Frontend
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Dynamic import for node-fetch (ESM module support in CommonJS)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'gym_history.json');

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
// You can add more gyms here via the API or manually
let gyms = [
  {
    id: 'glattpark',
    name: 'FP Glattpark',
    parkId: '698',
    locationId: '31',
    locationName: 'FP_Glattpark',
    url: 'https://www.fitnesspark.ch/wp/wp-admin/admin-ajax.php?action=single_park_update_visitors&park_id=698&location_id=31&location_name=FP_Glattpark'
  }
];

// --- INITIAL DATA SEEDING (FROM YOUR PROVIDED DATA) ---
const RAW_SEED_DATA = `20.06.2025 11:14	78
20.06.2025 11:33	76
20.06.2025 12:03	90
20.06.2025 13:11	130
20.06.2025 13:40	96
20.06.2025 14:10	65
20.06.2025 14:40	57
20.06.2025 15:10	67
20.06.2025 15:39	68
20.06.2025 16:09	70
20.06.2025 16:39	80
20.06.2025 17:09	85
20.06.2025 17:38	107
20.06.2025 18:08	122
20.06.2025 18:38	126
20.06.2025 19:08	109
20.06.2025 19:38	110
20.06.2025 20:07	105
20.06.2025 20:37	94
20.06.2025 21:07	76
20.06.2025 21:31	57
20.06.2025 21:36	57
21.06.2025 08:04	3
21.06.2025 08:13	3
21.06.2025 08:48	69
21.06.2025 09:18	95
21.06.2025 09:47	120
21.06.2025 10:17	170
21.06.2025 10:47	184
21.06.2025 11:17	169
21.06.2025 11:46	148
21.06.2025 12:16	149
21.06.2025 12:46	146
21.06.2025 13:16	135
21.06.2025 13:46	118
21.06.2025 14:56	80
21.06.2025 15:25	76
21.06.2025 15:55	67
21.06.2025 16:25	68
21.06.2025 16:55	78
21.06.2025 17:24	79
21.06.2025 17:54	79
21.06.2025 18:24	63
21.06.2025 18:54	65
21.06.2025 19:24	65`;

// --- DATABASE MANAGEMENT ---
let db = {
  glattpark: []
};

// Parse custom date format: DD.MM.YYYY HH:mm
const parseCustomDate = (dateStr) => {
  try {
    const [d, t] = dateStr.split(' ');
    const [day, month, year] = d.split('.').map(Number);
    const [hour, minute] = t.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime();
  } catch (e) { return 0; }
};

// Initialize DB
const initDB = () => {
  if (fs.existsSync(DATA_FILE)) {
    console.log("Loading existing database...");
    const raw = fs.readFileSync(DATA_FILE);
    db = JSON.parse(raw);
  } else {
    console.log("Creating new database with seed data...");
    // Parse seed data
    const seedHistory = RAW_SEED_DATA.split('\n')
      .map(line => {
        const [dateStr, val] = line.split('\t');
        if (!dateStr || !val) return null;
        return {
          timestamp: parseCustomDate(dateStr),
          visitors: parseInt(val.trim()),
          maxCapacity: 300
        };
      })
      .filter(x => x !== null)
      .sort((a,b) => a.timestamp - b.timestamp);
    
    db.glattpark = seedHistory;
    saveDB();
  }
};

const saveDB = () => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
};

// --- WORKER LOGIC ---
const fetchGymData = async (gymConfig) => {
  console.log(`[${new Date().toLocaleTimeString()}] Fetching ${gymConfig.name}...`);
  try {
    // Note: On the server (Node.js), we don't need the CORS proxy! We can fetch directly.
    const response = await fetch(gymConfig.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (GymPulse Server)'
      }
    });
    
    if (!response.ok) throw new Error(response.statusText);
    
    const text = await response.text();
    const visitors = parseInt(text.trim(), 10);
    
    if (isNaN(visitors)) throw new Error(`Invalid number: ${text}`);
    
    const dataPoint = {
      timestamp: Date.now(),
      visitors: visitors,
      maxCapacity: 300
    };
    
    // Save to DB
    if (!db[gymConfig.id]) db[gymConfig.id] = [];
    db[gymConfig.id].push(dataPoint);
    
    // Keep file size reasonable? (Optional: maybe cap at 10,000 records)
    // db[gymConfig.id] = db[gymConfig.id].slice(-10000); 

    saveDB();
    console.log(`> Success: ${visitors} visitors`);
    return dataPoint;
    
  } catch (e) {
    console.error(`> Error fetching ${gymConfig.name}:`, e.message);
    return null;
  }
};

const runJob = async () => {
  for (const gym of gyms) {
    await fetchGymData(gym);
  }
};

// --- API ENDPOINTS ---

// Get all data for frontend
app.get('/api/gyms', (req, res) => {
  // Construct the structure the frontend expects
  const response = gyms.map(config => {
    const history = db[config.id] || [];
    const current = history.length > 0 ? history[history.length - 1] : null;
    return {
      config,
      history,
      current,
      lastUpdated: current ? current.timestamp : 0
    };
  });
  res.json(response);
});

// Add a new gym
app.post('/api/gyms', (req, res) => {
  const newGym = req.body;
  if (!newGym.id || !newGym.url) {
    return res.status(400).json({ error: "Invalid gym config" });
  }
  
  gyms.push(newGym);
  // Initial fetch
  fetchGymData(newGym);
  res.json({ success: true, gym: newGym });
});

// Force refresh
app.post('/api/refresh', async (req, res) => {
  await runJob();
  res.json({ success: true });
});

// --- STARTUP ---
initDB();

// Run job immediately on start
runJob();

// Schedule job every 30 minutes (30 * 60 * 1000)
setInterval(runJob, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`GymPulse Background Server running on http://localhost:${PORT}`);
});
