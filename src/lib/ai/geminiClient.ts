import { BILL_SCAN_SYSTEM_PROMPT, PurchaseBillExtractionSchema, PurchaseBillExtractionResult } from './billScanPrompt';
import { PurchaseBillLineItem } from '@/types';
import { parseRupeesToPaise } from '@/lib/utils';

/**
 * Gemini Vision client for AI purchase-bill scanning.
 *
 * The desktop app has no server of its own, so it calls Gemini directly with
 * the shop's own API key, saved on this computer from Settings. A key is never
 * shipped inside the app.
 */

const KEY_STORAGE = 'kamai_gemini_api_key';

export function getGeminiApiKey(): string {
  try {
    return (localStorage.getItem(KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

export async function extractPurchaseBillWithGemini(
  base64Data: string,
  mimeType: string = 'image/jpeg',
  apiKeyOverride?: string
): Promise<PurchaseBillExtractionResult> {
  const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error('AI Bill Scan needs a Gemini API key. Add it in Settings → Invoice & Bill Rules → AI Purchase Bill Scan.');
  }

  // Primary model with fallback (Gemini 3.6-flash / 3.7-flash / 3.5-flash / flash-latest)
  const modelsToTry = [
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite'
  ];
  let lastError: any = null;

  // Clean raw base64 string if data URL prefix was passed
  const cleanBase64 = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `${BILL_SCAN_SYSTEM_PROMPT}\n\nExtract and return structured JSON conforming to the requested schema.`,
              },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} returned error status ${response.status}:`, errorText);
        
        if (response.status === 429) {
          throw new Error('Gemini API Quota Exhausted: Your Google AI Studio prepayment credits or free quota limit has been depleted. Please refill credits or use another key from https://aistudio.google.com/');
        }

        lastError = new Error(`Gemini API error (${response.status}): ${errorText}`);
        continue;
      }

      const responseData = await response.json();
      const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        console.warn(`Gemini model ${model} returned empty candidate text.`);
        lastError = new Error('Empty response from AI Vision model.');
        continue;
      }

      // Parse JSON from model output
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(candidateText);
      } catch (parseErr) {
        // Strip markdown code fences if present
        const cleanedText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleanedText);
      }

      // Validate against Zod schema
      const validated = PurchaseBillExtractionSchema.parse(parsedJson);
      return validated;
    } catch (err: any) {
      console.warn(`Failed extracting with model ${model}:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to extract purchase bill details from image.');
}

export interface ScannedPurchaseBill {
  supplier_name_raw: string;
  bill_number: string;
  bill_date: string;
  total_amount: number; // paise
  line_items: PurchaseBillLineItem[];
  ai_model_used: string;
  raw_ai_response: string;
}

/** Scans a bill photo / PDF and returns line items in integer paise (what the review sheet expects). */
export async function scanPurchaseBill(base64Data: string, mimeType: string): Promise<ScannedPurchaseBill> {
  const extraction = await extractPurchaseBillWithGemini(base64Data, mimeType);
  const lineItems: PurchaseBillLineItem[] = (extraction.line_items || []).map((item) => {
    const unitPricePaise = parseRupeesToPaise(item.unit_price.toString());
    const totalPricePaise = item.total_price
      ? parseRupeesToPaise(item.total_price.toString())
      : Math.round(unitPricePaise * item.quantity);
    return {
      raw_name: item.name.trim(),
      is_new_product: true, // resolved on the client by fuzzy product matching
      quantity: item.quantity,
      unit: item.unit || 'piece',
      unit_price: unitPricePaise,
      total_price: totalPricePaise,
      selling_price: Math.round(unitPricePaise * 1.25), // suggested 20% retail margin
      confidence: item.confidence || 'medium',
    };
  });
  return {
    supplier_name_raw: extraction.supplier_name || '',
    bill_number: extraction.bill_number || '',
    bill_date: extraction.bill_date || '',
    total_amount: extraction.total_amount
      ? parseRupeesToPaise(extraction.total_amount.toString())
      : lineItems.reduce((sum, i) => sum + i.total_price, 0),
    line_items: lineItems,
    ai_model_used: 'gemini-flash-vision',
    raw_ai_response: JSON.stringify(extraction),
  };
}
