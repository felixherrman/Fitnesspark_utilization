import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { DataPoint } from '../types';

interface HistoryChartProps {
  data: DataPoint[];
  color: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-sm">
        <p className="text-slate-300 mb-1">{label}</p>
        <p className="text-white font-bold">
          {payload[0].value} Visitors
        </p>
      </div>
    );
  }
  return null;
};

export const RecentActivityChart: React.FC<HistoryChartProps> = ({ data, color }) => {
  // Process data to only show last 24h OR if no data in last 24h, show last 20 points
  const chartData = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // First try filtering for real last 24h
    let recent = data.filter(d => d.timestamp > now - oneDay);
    
    // If empty (e.g. data is old or future), take the last 20 points available
    if (recent.length === 0 && data.length > 0) {
       recent = data.slice(-20);
    }

    return recent.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        visitors: d.visitors,
        timestamp: d.timestamp,
        date: new Date(d.timestamp).toLocaleDateString()
      }));
  }, [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8" 
            fontSize={12} 
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="visitors"
            stroke={color}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DayAverageChart: React.FC<{ data: DataPoint[], color: string }> = ({ data, color }) => {
  // Aggregate average visitors per day of week
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);

    data.forEach(d => {
      const dayIndex = new Date(d.timestamp).getDay();
      sums[dayIndex] += d.visitors;
      counts[dayIndex] += 1;
    });

    return days.map((day, i) => ({
      day,
      avg: counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0
    }));
  }, [data]);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickMargin={5} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip 
            cursor={{fill: '#1e293b'}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
          />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
             {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DailyHourlyChart: React.FC<{ data: DataPoint[], color: string }> = ({ data, color }) => {
  // Show average visitors for the CURRENT day of week, from 06:00 to 22:00
  const chartData = useMemo(() => {
    const currentDay = new Date().getDay(); // 0-6
    const hourSums = new Array(24).fill(0);
    const hourCounts = new Array(24).fill(0);

    // Filter for current day of week
    data.forEach(d => {
      const date = new Date(d.timestamp);
      if (date.getDay() === currentDay) {
        const hour = date.getHours();
        hourSums[hour] += d.visitors;
        hourCounts[hour] += 1;
      }
    });

    // Create array for 06:00 to 22:00
    const hours = [];
    for (let h = 6; h <= 22; h++) {
      hours.push({
        time: `${h}:00`,
        avg: hourCounts[h] > 0 ? Math.round(hourSums[h] / hourCounts[h]) : 0
      });
    }
    return hours;
  }, [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={5} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip 
             cursor={{fill: '#1e293b'}}
             contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
          />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]} fill={color} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
