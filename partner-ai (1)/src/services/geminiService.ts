import { GoogleGenAI, Type } from "@google/genai";

// Lazy initialization to prevent startup API calls
let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("Gemini API Key is missing or default. AI features will be disabled.");
    return null;
  }
  
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export interface ExtractedProduct {
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
}

export const scanProductsFromImage = async (base64Image: string): Promise<ExtractedProduct[]> => {
  const ai = getAi();
  if (!ai) {
    throw new Error("AI haijasanidiwa (Missing API Key). Tafadhali weka 'VITE_GEMINI_API_KEY' kwenye Settings.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] || base64Image
          }
        },
        {
          text: "Identify all distinct store products visible in this image. For each product, extract its likely Name, Category, Typical Selling Price (Tsh), Typical Cost Price (Tsh), and Current Quantity/Stock visible. If exact prices are not visible, estimate based on Tanzanian market standard for such items. Return ONLY a JSON array of objects."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the product" },
              category: { type: Type.STRING, description: "Category of the product (e.g., Vinywaji, Chakula)" },
              price: { type: Type.NUMBER, description: "Selling price in Tsh" },
              costPrice: { type: Type.NUMBER, description: "Estimated cost price in Tsh" },
              stock: { type: Type.NUMBER, description: "Quantity/Units observed" }
            },
            required: ["name", "category", "price", "costPrice", "stock"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as ExtractedProduct[];
  } catch (error) {
    console.error("Gemini AI Scan Error:", error);
    throw error;
  }
};

export interface IntelligentColumnMap {
  name: string;
  stock: string;
  costPrice: string;
  expiryDate?: string;
}

export const detectSpreadsheetColumns = async (sampleData: any[]): Promise<IntelligentColumnMap> => {
  const ai = getAi();
  if (!ai) return { name: 'name', stock: 'stock', costPrice: 'costPrice' };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          text: `I have a spreadsheet with these columns: ${Object.keys(sampleData[0] || {}).join(', ')}. 
          Map these to the following keys: 'name', 'stock', 'costPrice', 'expiryDate'.
          The spreadsheet might be in Swahili or English. Return ONLY the JSON mapping object.`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            stock: { type: Type.STRING },
            costPrice: { type: Type.STRING },
            expiryDate: { type: Type.STRING }
          },
          required: ["name", "stock", "costPrice"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as IntelligentColumnMap;
  } catch (error) {
    console.error("Column Detection Error:", error);
    return { name: 'name', stock: 'stock', costPrice: 'costPrice' };
  }
};

export const scanReceiptForPurchases = async (base64Image: string): Promise<ExtractedProduct[]> => {
  return scanProductsFromImage(base64Image); // Reusing the same logic but can be tailored if needed
};

/**
 * Intelligent AI Chat response generator
 */
export const generateAiBriefing = async (prompt: string): Promise<string> => {
  const ai = getAi();
  if (!ai) return "AI haijasanidiwa. Tafadhali weka API Key kwenye Settings.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ text: prompt }]
    });
    return response.text || "Imeshindwa kutengeneza ripoti.";
  } catch (error) {
    console.error("AI Briefing Error:", error);
    return "Hitilafu imetokea wakati wa kuzungumza na AI. Jaribu tena baadae.";
  }
};
