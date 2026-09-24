const { GoogleGenAI } = require('@google/genai');
async function run() {
  try {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY is not set in the Node environment.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log(response.text);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
run();
