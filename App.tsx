import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  fetchGymData, 
  loadGyms, 
  saveGyms,
  addGymToServer
} from './services/gymService';
import { getUtilizationPrediction } from './services/geminiService';
import { GymData, GymConfig, ViewMode, PredictionResult } from './types';
import { GymCard } from './components/GymCard';
import { AddGymModal } from './components/AddGymModal';
import { RecentActivityChart, DayAverageChart, DailyHourlyChart } from './components/Charts.tsx';

// Icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
);
const RefreshIcon = ({ loading }: { loading: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);
const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
);
const ServerIcon = ({ connected, type }: { connected: boolean, type: 'server' | 'cloud' | 'local' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={connected ? (type === 'local' ? "#94a3b8" : "#10b981") : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {type === 'cloud' ? (
      <>
        <path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19" />
        <path d="M20 16a4 4 0 0 0 0-8 4 4 0 0 0-5.32-3.1" />
        <path d="M9.32 4.9A4 4 0 0 0 4 8a4 4 0 0 0 0 8" />
      </>
    ) : (
      <>
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <line x1="6" y1="6" x2="6.01" y2="6"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
      </>
    )}
  </svg>
);

function App() {
  const [gyms, setGyms] = useState<GymData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [dataMode, setDataMode] = useState<'server' | 'cloud' | 'local'>('local');
  
  // Ref to track if we've already predicted for this session view to avoid loop
  const hasPredictedRef = useRef(false);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const { data, source } = await loadGyms();
      setGyms(data);
      setDataMode(source);
    };
    init();
  }, []);

  // Persistence effect (Only if local)
  useEffect(() => {
    if (gyms.length > 0 && dataMode === 'local') {
      saveGyms(gyms);
    }
  }, [gyms, dataMode]);

  // Global Refresh Logic
  const refreshAllGyms = useCallback(async () => {
    setIsLoading(true);

    // Local Mode & Cloud Mode: We fetch the LIVE data point from the API
    // so the user sees the absolute latest numbers, even if the static file is 30 mins old.
    const updatedGyms = await Promise.all(
      gyms.map(async (gym) => {
        const newDataPoint = await fetchGymData(gym.config);
        
        // If fetch fails (returns null), keep old history/current state
        if (!newDataPoint) {
           return gym;
        }

        // Append to history, keeping only last 3000 points (prevent unbounded growth)
        // If in Cloud/Server mode, we append visually but don't save back to server from here
        const updatedHistory = [...gym.history, newDataPoint].slice(-5000);
        
        return {
          ...gym,
          current: newDataPoint,
          history: updatedHistory,
          lastUpdated: Date.now()
        };
      })
    );
    setGyms(updatedGyms);
    setIsLoading(false);
  }, [gyms, dataMode]);

  // Auto-refresh interval (30 mins)
  useEffect(() => {
    // Initial fetch if data current is empty or if we are in cloud mode (to ensure we have the very latest minute)
    if (!isLoading && gyms.length > 0) {
       // Check if current data is stale (> 5 mins)
       const isStale = gyms.some(g => !g.current || (Date.now() - g.lastUpdated > 5 * 60 * 1000));
       if (isStale) {
         refreshAllGyms();
       }
    }

    const intervalId = setInterval(() => {
      refreshAllGyms();
    }, 30 * 60 * 1000); 

    return () => clearInterval(intervalId);
  }, [refreshAllGyms, gyms.length]); 

  const handleAddGym = async (config: GymConfig) => {
    if (dataMode === 'server') {
        await addGymToServer(config);
        setTimeout(refreshAllGyms, 500);
    } else {
        // For Local and Cloud mode, we just add it to the state locally for this session
        // (Cloud mode users need to update the update_data.js script manually to add permanent tracking)
        const newGym: GymData = {
            config,
            history: [],
            lastUpdated: 0
        };
        setGyms(prev => [...prev, newGym]);
        // Immediately fetch data for the new gym
        fetchGymData(config).then(data => {
            if (data) {
                setGyms(prev => prev.map(g => {
                if (g.config.id === config.id) {
                    return { ...g, current: data, history: [data], lastUpdated: Date.now() };
                }
                return g;
                }));
            }
        });
    }
  };

  const handleOpenDetail = (id: string) => {
    setSelectedGymId(id);
    setPrediction(null);
    hasPredictedRef.current = false; // Reset prediction tracker
    setViewMode(ViewMode.DETAIL);
  };

  const handleBack = () => {
    setSelectedGymId(null);
    setViewMode(ViewMode.DASHBOARD);
  };

  // Prediction Logic
  const handlePredict = useCallback(async (gym: GymData) => {
    if (!process.env.API_KEY) {
      console.warn("API Key missing");
      return;
    }
    setIsPredicting(true);
    try {
      const result = await getUtilizationPrediction(gym.config.name, gym.history);
      setPrediction(result);
      hasPredictedRef.current = true;
    } catch (e) {
      console.error(e);
    } finally {
      setIsPredicting(false);
    }
  }, []);

  const selectedGym = gyms.find(g => g.config.id === selectedGymId);

  // Auto-invoke AI when detail view is active
  useEffect(() => {
    if (
      viewMode === ViewMode.DETAIL && 
      selectedGym && 
      !prediction && 
      !isPredicting && 
      !hasPredictedRef.current
    ) {
      handlePredict(selectedGym);
    }
  }, [viewMode, selectedGym, prediction, isPredicting, handlePredict]);

  // Determine label for current day
  const currentDayLabel = new Date().toLocaleDateString([], { weekday: 'long' });

  // Status text map
  const getStatusText = () => {
    if (dataMode === 'server') return 'Server Connected (Localhost)';
    if (dataMode === 'cloud') return 'Cloud Connected (GitHub Pages)';
    return 'Local Mode (Browser Storage)';
  }

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             {viewMode === ViewMode.DETAIL && (
               <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                 <ArrowLeftIcon />
               </button>
             )}
             <div>
               <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                GymPulse
               </h1>
               {viewMode === ViewMode.DETAIL && selectedGym && (
                 <p className="text-xs text-slate-400 hidden sm:block">Viewing {selectedGym.config.name}</p>
               )}
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={refreshAllGyms}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Refresh Data"
            >
              <RefreshIcon loading={isLoading} />
            </button>
            {viewMode === ViewMode.DASHBOARD && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
              >
                <PlusIcon />
                <span className="hidden sm:inline">Add Gym</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {viewMode === ViewMode.DASHBOARD && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gyms.map(gym => (
              <GymCard 
                key={gym.config.id} 
                gym={gym} 
                onClick={() => handleOpenDetail(gym.config.id)} 
              />
            ))}
            {gyms.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                <p className="mb-4">No gyms tracked yet.</p>
                <button onClick={() => setIsModalOpen(true)} className="text-blue-400 hover:underline">Add your first gym</button>
              </div>
            )}
          </div>
        )}

        {viewMode === ViewMode.DETAIL && selectedGym && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current Status */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl col-span-1">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Current Load</h3>
                <div className="flex items-baseline gap-2">
                   <span className="text-5xl font-bold text-white">{selectedGym.current?.visitors || 0}</span>
                   <span className="text-xl text-slate-500">/ {selectedGym.current?.maxCapacity || 300}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  {isLoading ? 'Updating...' : 'Live'}
                </div>
              </div>

              {/* Prediction Widget */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 p-6 rounded-xl col-span-1 lg:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <BrainIcon />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-slate-300 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                    <span className="text-purple-400"><BrainIcon /></span> AI Forecast
                  </h3>
                  {isPredicting && (
                     <span className="text-xs text-purple-400 animate-pulse">Analyzing patterns...</span>
                  )}
                </div>

                {prediction ? (
                   <div className="animate-fade-in-up">
                      <div className="flex items-center gap-4 mb-3">
                         <span className={`text-3xl font-bold ${
                           prediction.trend === 'Rising' ? 'text-red-400' : 
                           prediction.trend === 'Falling' ? 'text-emerald-400' : 'text-blue-400'
                         }`}>
                           {prediction.trend}
                         </span>
                         <span className="bg-slate-950/50 px-2 py-1 rounded text-xs text-slate-400 border border-slate-700">
                           {prediction.confidence}% Confidence
                         </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed mb-3">
                        {prediction.reasoning}
                      </p>
                      <div className="text-xs text-slate-500">
                        Projected: ~{prediction.predictedUsageNextHour} visitors in 1h
                      </div>
                   </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-slate-500 text-sm italic">
                     {isPredicting ? 'Connecting to Gemini...' : 'Waiting for prediction...'}
                  </div>
                )}
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl col-span-1 lg:col-span-2">
                 <h3 className="text-white font-semibold mb-6">Today's Hourly Trend ({currentDayLabel})</h3>
                 <DailyHourlyChart data={selectedGym.history} color="#8b5cf6" />
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                 <h3 className="text-white font-semibold mb-6">Recent Activity (Last 24h)</h3>
                 <RecentActivityChart data={selectedGym.history} color="#3b82f6" />
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                 <h3 className="text-white font-semibold mb-6">Average by Day of Week</h3>
                 <DayAverageChart data={selectedGym.history} color="#06b6d4" />
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-0 w-full bg-slate-950/80 backdrop-blur text-[10px] text-slate-600 border-t border-slate-800 py-2 px-6 flex justify-between items-center z-50">
          <div className="flex items-center gap-2">
              <ServerIcon connected={dataMode !== 'local'} type={dataMode} />
              <span>{getStatusText()}</span>
          </div>
          <div>v4.1</div>
      </footer>

      <AddGymModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handleAddGym} 
      />
    </div>
  );
}

export default App;