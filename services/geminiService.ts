
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, EditResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of exactly 3 distinct, fascinating facts or observations about the image/video content."
    },
    detectedObjects: {
      type: Type.ARRAY,
      description: "A list of key objects detected in the scene with their bounding box coordinates.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "The name of the object detected." },
          box_2d: { 
            type: Type.ARRAY, 
            items: { type: Type.INTEGER },
            description: "The bounding box coordinates [ymin, xmin, ymax, xmax] in normalized 0-1000 scale."
          }
        },
        required: ["label", "box_2d"]
      }
    }
  },
  required: ["points", "detectedObjects"]
};

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this image. 1. Provide 3 interesting observations. 2. Identify major objects and return their normalized bounding box coordinates [ymin, xmin, ymax, xmax] in 0-1000 range." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      points: json.points || ["Analysis available", "Visual confirmed", "Processing complete"],
      detectedObjects: json.detectedObjects || []
    };
  } catch (error) {
    console.error("Analysis failed:", error);
    return { points: ["Analysis error occurred.", "Please verify your connection.", "Try again with a clearer shot."], detectedObjects: [] };
  }
};

export const analyzeVideo = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Examine this video. Provide 3 key visual insights and detect any prominent objects found throughout the recording." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      points: json.points || ["Video insight 1", "Video insight 2", "Video insight 3"],
      detectedObjects: json.detectedObjects || []
    };
  } catch (error) {
    console.error("Video Analysis failed:", error);
    return { points: ["Video analysis interrupted.", "Mime type or size issue.", "Check camera stream."], detectedObjects: [] };
  }
};

export const generalChat = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: `CONTEXT: You are looking at a visual file provided by the user. QUESTION: ${prompt}` }
        ]
      }
    });
    return response.text || "I'm sorry, I couldn't generate a helpful response for that.";
  } catch (error) {
    console.error("General chat failed:", error);
    return "I encountered an error trying to process your question about this image.";
  }
};

export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<EditResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    });

    let result: EditResult = {};
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          result.imageData = part.inlineData.data;
        } else if (part.text) {
          result.textResponse = part.text;
        }
      }
    }
    return result;
  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};
