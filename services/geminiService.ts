import { GoogleGenAI, Type } from "@google/genai";
import { ValidationResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Generates an image based on a prompt.
 * Uses gemini-3-pro-image-preview for high-quality assessment target images.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt cannot be empty for image generation.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
      }
    });

    // Extract image
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    // Check for text refusal (Safety filter)
    const textPart = parts.find(p => p.text);
    if (textPart?.text) {
        console.warn("Image generation refused by model:", textPart.text);
        throw new Error(`Generation Refused: ${textPart.text}`);
    }

    throw new Error("No image generated. The model returned an empty response.");
  } catch (error: any) {
    console.error("Image generation failed:", error);
    throw new Error(error.message || "Image generation failed due to an unknown error.");
  }
};

/**
 * Acts as the "Judge". Compares the Target Image and the User Generated Image.
 * Returns a score and feedback.
 */
export const evaluateSimilarity = async (
  targetImageBase64: string,
  userImageBase64: string,
  originalPrompt: string,
  userPrompt: string,
  threshold: number = 70
): Promise<ValidationResult> => {
  
  // Clean base64 headers if present
  const cleanTarget = targetImageBase64.replace(/^data:image\/\w+;base64,/, "");
  const cleanUser = userImageBase64.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `
    You are an expert AI Assessment Auditor.
    
    The Task: Evaluate a candidate's attempt to recreate a target image using a text prompt.
    
    1. TARGET IMAGE: The first image provided.
    2. CANDIDATE IMAGE: The second image provided.
    3. HIDDEN ORIGINAL PROMPT: "${originalPrompt}"
    4. CANDIDATE PROMPT: "${userPrompt}"

    Evaluate on three specific axes (0-100):
    1. Visual Accuracy (Effectiveness): How close is the final image to the target visually?
    2. Prompt Engineering (Technique): Did they use specific keywords, style descriptors, lighting terms, or structured formatting?
    3. Creativity (Interaction): Did they capture the core concept even if the exact pixels differ? Did they understand the "vibe"?

    Return JSON:
    {
      "visual_accuracy": number,
      "prompt_technique": number,
      "creativity": number,
      "overall_score": number (weighted average),
      "feedback": "Short, bullet-point tactical feedback.",
      "reasoning": "A professional paragraph explaining the candidate's prompting strengths and weaknesses based on this specific attempt."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: cleanTarget } },
          { inlineData: { mimeType: 'image/png', data: cleanUser } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visual_accuracy: { type: Type.INTEGER },
            prompt_technique: { type: Type.INTEGER },
            creativity: { type: Type.INTEGER },
            overall_score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    const score = result.overall_score || 0;
    
    return {
      score: score,
      passed: score >= threshold,
      metrics: {
        accuracy: result.visual_accuracy || 0,
        promptEngineering: result.prompt_technique || 0,
        creativity: result.creativity || 0
      },
      feedback: result.feedback || "Unable to evaluate.",
      reasoning: result.reasoning || "Analysis not available."
    };
  } catch (error) {
    console.error("Evaluation failed:", error);
    return { 
        score: 0, 
        passed: false, 
        metrics: { accuracy: 0, promptEngineering: 0, creativity: 0 },
        feedback: "Error during evaluation.",
        reasoning: "System error."
    };
  }
};

/**
 * Helper to generate random questions for the admin
 */
export const generateRandomPromptQuestion = async (
  difficulty: string = 'MEDIUM',
  customInstructions: string = ''
): Promise<{ prompt: string, image: string }> => {
  
  // Define context based on difficulty
  let difficultyContext = "";
  switch(difficulty) {
    case 'NOVICE': 
      difficultyContext = "Simple, clear subject matter. Standard lighting. Photorealistic or cartoon style. Easy to describe in 1 sentence."; 
      break;
    case 'EASY': 
      difficultyContext = "Distinct subject. Clear composition. One or two key elements. Basic style descriptors."; 
      break;
    case 'MEDIUM': 
      difficultyContext = "Creative composition. Specific lighting (e.g., golden hour, neon). Interesting textures or materials. Moderate complexity."; 
      break;
    case 'HARD': 
      difficultyContext = "Complex scene. Abstract concepts blended with reality. Specific artistic style (e.g., synthwave, impressionist, oil painting). Detailed background."; 
      break;
    case 'EXPERT': 
      difficultyContext = "Surreal, highly abstract, or extremely detailed. Complex lighting setups (volumetric, chiaroscuro). Unusual camera angles or lenses. Hard to reverse-engineer perfectly."; 
      break;
    default: 
      difficultyContext = "Creative and distinct.";
  }

  const systemPrompt = `
    Write a single, highly visual image generation prompt.
    Target Difficulty Level: ${difficulty}
    Context: ${difficultyContext}
    ${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}
    
    IMPORTANT SAFETY CONSTRAINTS:
    - Do NOT use specific real names of celebrities, politicians, or trademarked characters (e.g., no Mickey Mouse, Superman, Mario).
    - Do NOT include violent, sexual, or offensive concepts.
    - Focus on visual style, lighting, composition, and generic subjects (e.g., "a robot" instead of "Wall-E").
    
    The prompt should be descriptive but concise enough to be reverse-engineered by a human looking at the image.
    Do not include markdown or quotes. Just return the prompt text.
  `;

  // 1. Get a creative prompt idea based on constraints
  const textResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: systemPrompt,
  });
  
  let prompt = textResponse.text?.trim() || "A futuristic city in a glass bottle";
  
  // Clean up prompt to avoid issues (remove quotes, markdown)
  prompt = prompt.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();

  // 2. Generate the image for it
  // This might fail if the prompt is still unsafe, but the systemPrompt above tries to mitigate it.
  try {
    const image = await generateImage(prompt);
    return { prompt, image };
  } catch (e: any) {
    console.error("Failed to generate image for prompt:", prompt, e);
    // Fallback if the generated prompt was blocked
    const fallbackPrompt = "A glowing geometric crystal floating in a dark void, digital art style";
    const image = await generateImage(fallbackPrompt);
    return { prompt: fallbackPrompt, image };
  }
}