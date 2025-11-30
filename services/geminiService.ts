import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DataPoint, PredictionResult } from '../types';

export const getUtilizationPrediction = async (
  gymName: string,
  history: DataPoint[]
): Promise<PredictionResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0-6 (Sun-Sat)

  // 1. Calculate Historical Average for this specific Day & Hour (simple heuristic)
  const sameTimePoints = history.filter(d => {
    const dObj = new Date(d.timestamp);
    // Match day of week and be within +/- 1 hour
    return dObj.getDay() === currentDay && Math.abs(dObj.getHours() - currentHour) <= 1;
  });

  const avgVisitors = sameTimePoints.length > 0 
    ? Math.round(sameTimePoints.reduce((acc, curr) => acc + curr.visitors, 0) / sameTimePoints.length) 
    : 'Unknown';

  // 2. Get Recent Live Data (Last 4 points)
  // If no recent data (gap > 4 hours), rely on history
  const oneHour = 3600 * 1000;
  const recentThreshold = Date.now() - (4 * oneHour);
  const recentData = history.filter(d => d.timestamp > recentThreshold);
  
  // If recent data is empty, we might be looking at a dataset that is in the future or past relative to "Date.now()"
  // In that case, we take the absolute last few points of the history array to simulate "current status".
  const effectiveRecentData = recentData.length > 0 ? recentData : history.slice(-5);

  const dataString = effectiveRecentData.map(d => {
    const time = new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${time}: ${d.visitors} visitors`;
  }).join('\n');

  const lastPoint = effectiveRecentData[effectiveRecentData.length - 1];
  const currentVisitors = lastPoint?.visitors || 0;
  const currentMax = lastPoint?.maxCapacity || 100;
  const percentage = Math.round((currentVisitors / currentMax) * 100);

  const prompt = `
    You are an expert analyst for gym facility management.
    
    Context:
    Gym Name: ${gymName}
    Current Time (System): ${now.toLocaleTimeString()}
    Current Day: ${now.toLocaleDateString([], {weekday: 'long'})}
    
    Current Status:
    Utilization: ${percentage}% (${currentVisitors}/${currentMax} visitors)
    
    Historical Average for this Day/Time: ${avgVisitors} visitors
    
    Recent Recorded Data Points:
    ${dataString}
    
    Task:
    Predict the utilization trend for the NEXT 3 HOURS.
    Is it likely to Rise, Fall, or remain Stable? 
    Compare the "Recent Recorded Data" against the "Historical Average" and typical human behavior (after-work rush, lunch, etc).
    
    Return a strict JSON response.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      trend: { 
        type: Type.STRING, 
        enum: ['Rising', 'Falling', 'Stable'],
        description: "The predicted direction of visitor numbers."
      },
      confidence: {
        type: Type.INTEGER,
        description: "Confidence score between 0 and 100."
      },
      reasoning: {
        type: Type.STRING,
        description: "Short explanation for the prediction (max 1 sentence)."
      },
      predictedUsageNextHour: {
        type: Type.INTEGER,
        description: "Estimated number of visitors in 1 hour."
      }
    },
    required: ['trend', 'confidence', 'reasoning', 'predictedUsageNextHour']
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3, 
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    return JSON.parse(text) as PredictionResult;

  } catch (error) {
    console.error("Gemini Prediction Failed", error);
    return {
      trend: 'Stable',
      confidence: 0,
      reasoning: "AI prediction unavailable.",
      predictedUsageNextHour: currentVisitors
    };
  }
};