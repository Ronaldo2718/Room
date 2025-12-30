
import { GoogleGenAI } from "@google/genai";

// Analyzes management data and provides practical insights using Gemini AI.
export const getManagementInsights = async (
  financialData: any,
  alerts: any[],
  occupancy: number
) => {
  try {
    // Instantiate right before making the call as per guidelines to ensure current API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise estes dados de gestão imobiliária e forneça 3 dicas práticas em português (máximo 150 palavras):
        - Lucro Mensal: ${financialData.profit}
        - Ocupação: ${occupancy}%
        - Alertas: ${JSON.stringify(alerts)}
        Aja como um consultor imobiliário experiente.`,
      config: {
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Não foi possível gerar insights no momento. Verifique sua conexão ou chave de API.";
  }
};
