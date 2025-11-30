import React, { useState } from 'react';
import { GymConfig } from '../types';

interface AddGymModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: GymConfig) => void;
}

export const AddGymModal: React.FC<AddGymModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Robust URL parsing
      // Handle cases where user might copy just parameters or full URL
      let urlToParse = url.trim();
      
      // If it doesn't start with http, try to construct a dummy URL to parse search params
      if (!urlToParse.startsWith('http')) {
         if (urlToParse.includes('?')) {
           urlToParse = `http://dummy.com${urlToParse.substring(urlToParse.indexOf('?'))}`;
         } else {
            // Maybe they pasted just the query string without ?
            urlToParse = `http://dummy.com?${urlToParse}`;
         }
      }

      const urlObj = new URL(urlToParse);
      const params = new URLSearchParams(urlObj.search);

      const parkId = params.get('park_id');
      const locationId = params.get('location_id');
      const locationName = params.get('location_name');

      if (!parkId || !locationId || !locationName) {
        throw new Error("The URL must contain park_id, location_id, and location_name parameters.");
      }

      onAdd({
        id: Date.now().toString(),
        name: name || locationName, // Use location name if user didn't type a custom name
        parkId,
        locationId,
        locationName
      });

      // Reset form
      setName('');
      setUrl('');
      onClose();

    } catch (e) {
      setError("Invalid API Link. Please paste the full URL containing park_id and location_id.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Track New Location</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Gym Name (Optional)</label>
            <input 
              type="text" 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
              placeholder="e.g. My Home Gym"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">API URL</label>
            <textarea 
              required
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
              placeholder="Paste the link: https://www.fitnesspark.ch/wp/wp-admin/admin-ajax.php?action=single_park_update_visitors..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Paste the full link containing park_id, location_id, etc.
            </p>
          </div>
          
          <div className="flex gap-3 mt-6 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-900/20"
            >
              Add Gym
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};