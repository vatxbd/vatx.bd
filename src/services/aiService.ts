import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface TaxUpdate {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'tax' | 'vat';
  impact: 'low' | 'medium' | 'high';
}

export const generateLawUpdates = async (language: 'en' | 'bn'): Promise<TaxUpdate[]> => {
  const prompt = `Generate 3 recent or simulated updates regarding Bangladesh NBR Tax and VAT laws for the year 2024-25. 
  The updates should be professional and relevant to businesses/individuals in Bangladesh.
  Language: ${language === 'bn' ? 'Bengali (Bangla)' : 'English'}.
  Return as a JSON array of objects with id, title, content, date (YYYY-MM-DD), type ('tax' or 'vat'), and impact ('low', 'medium', or 'high').`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            date: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['tax', 'vat'] },
            impact: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
          },
          required: ['id', 'title', 'content', 'date', 'type', 'impact']
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateSocialPost = async (update: TaxUpdate, platform: 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'instagram' | 'threads'): Promise<string> => {
  const prompt = `Create a social media post for ${platform} based on this tax/VAT law update from Bangladesh NBR:
  Update Title: ${update.title}
  Update Content: ${update.content}
  Language: Bengali (Bangla).
  The post should be engaging, informative, and include relevant emojis and hashtags tailored for ${platform}.
  ${platform === 'twitter' ? 'Maximum 280 characters.' : ''}
  ${platform === 'instagram' ? 'Focus on visual tone and hashtags.' : ''}
  Output ONLY the post text.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }]
  });

  return response.text || '';
};
