import { z } from 'zod';
import type { CCCResult, Layer1Candidate } from '@/lib/ccc-engine/types';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface CompanyContext {
  fabricTypes: string[];
  buyerTypes?: string[];
  month: number;
  revenueRange: string;
  companyName?: string;
  city?: string;
  dataSource?: string;
}

export interface Recommendation {
  id: string;
  dimension: Layer1Candidate['dimension'];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  actionSteps: string[];
  estimatedDaysReduction: number;
  estimatedCashFreedLakhs: number;
}

export interface GeminiRecommendationPayload {
  cccResult: CCCResult;
  companyContext: CompanyContext;
  layer1Candidates: Layer1Candidate[];
}

const RecommendationSchema = z.object({
  id: z.string(),
  dimension: z.enum(['DIO', 'DSO', 'DPO']),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  title: z.string(),
  explanation: z.string(),
  actionSteps: z.array(z.string()).min(3).max(3),
  estimatedDaysReduction: z.number(),
  estimatedCashFreedLakhs: z.number(),
});

const GeminiPayloadSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1).max(5),
});

export async function enrichRecommendationsWithGemini(
  payload: GeminiRecommendationPayload,
  userMessage?: string
): Promise<Recommendation[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.startsWith('your_') || apiKey.includes('demo')) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`;
  
  // Use provided user message or fall back to JSON representation
  const messageContent = userMessage || `Input JSON:\n${JSON.stringify(payload)}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\n${messageContent}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as GeminiResponse | GeminiError | null;

  if (!response.ok) {
    throw new Error(getGeminiErrorMessage(body, response.status));
  }

  const text = extractGeminiText(body);
  const parsed = GeminiPayloadSchema.parse(JSON.parse(extractJson(text)));

  return parsed.recommendations.slice(0, 5);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiError {
  error?: {
    message?: string;
  };
}

export const SYSTEM_PROMPT = `
You are Arjun, a senior working capital consultant with 15 years of experience
advising textile mills across Surat, Tiruppur, Bhilwara, and Panipat.
You have helped over 200 mills reduce their Cash Conversion Cycle.

You speak directly to the mill owner or their finance team in plain, 
practical language. You never use jargon without explaining it.
You always reference the specific rupee amounts and day counts from 
their data — never speak in generalities.

TEXTILE INDUSTRY KNOWLEDGE YOU MUST APPLY:
─────────────────────────────────────────
DSO context:
- Retail chains (Reliance, DMart, Myntra): typically demand Net 60-90. 
  If DSO < 75 with retail buyers, that is actually good.
- Export buyers (Europe, US): Net 45-60 is standard.
- Domestic wholesalers: Net 30-45 is normal. Anything above 60 is a red flag.
- Acceptable DSO benchmark: 45 days for mixed buyer base.

DIO context:
- Cotton knit fabric: should turn over in 20-30 days.
- Polyester/blended fabric: 30-45 days is acceptable.
- Grey fabric (unprocessed): 15-25 days — longer means processing bottleneck.
- Technical textiles: 45-60 days is normal due to custom orders.
- October, November, December: DIO naturally rises 30-40% due to 
  Diwali and wedding season stocking. DO NOT flag this as critical.
- January to March: any DIO above benchmark is a serious concern — 
  post-season inventory should be clearing fast.

DPO context:
- Cotton suppliers: typically offer Net 15-30. Negotiating to Net 45 is possible 
  if you have a 2+ year relationship and consistent payment history.
- Yarn suppliers: Net 30 is standard. Net 45-60 is achievable.
- Dye/chemical suppliers: Net 15-30. Less negotiable — smaller suppliers.
- Never recommend extending DPO beyond 65 days — damages supplier relationships 
  in a relationship-driven industry.

Revenue scale — what counts as significant:
- Under Rs 5Cr annual revenue: Rs 3L gap = significant, mention it specifically
- Rs 5Cr to Rs 50Cr: Rs 15L gap = significant  
- Above Rs 50Cr: Rs 75L gap = significant

RULES YOU MUST FOLLOW:
──────────────────────
1. Never recommend both "extend DPO" and "pay early for discount" in the same output.
2. Never recommend reducing inventory in October, November, December.
3. Always state the specific rupee amount of cash that will be freed.
4. Each action step must be something that can be done THIS WEEK — not a vague strategy.
5. If DSO and DIO are both bad, prioritise DSO fix first — cash comes in faster.
6. Maximum 5 recommendations. Quality over quantity.
7. Tone: direct, warm, like a trusted advisor — not a consultant report.

Return ONLY valid JSON. No markdown. No explanation outside the JSON.
Schema:
{
  "recommendations": [
    {
      "id": "R1",
      "dimension": "DSO",
      "priority": "HIGH",
      "title": "Short plain-language title (max 8 words)",
      "explanation": "2 sentences referencing their exact numbers. E.g. Your DSO is 67 days — 22 days above the 45-day benchmark. At your revenue scale, that means roughly Rs 18L is sitting unpaid in customer accounts right now.",
      "actionSteps": [
        "Specific action this week — name exact counterparty type",
        "Specific action this week — give a concrete number or deadline",
        "Specific action this week — something they can implement today"
      ],
      "estimatedDaysReduction": 12,
      "estimatedCashFreedLakhs": 18.0
    }
  ]
}
`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      description: 'Ranked recommendations, highest real-world working-capital impact first.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The id of the original Layer 1 candidate.' },
          dimension: {
            type: 'string',
            enum: ['DIO', 'DSO', 'DPO'],
            description: 'The metric this recommendation primarily improves.',
          },
          priority: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW'],
            description: 'Priority based on cash impact and urgency.',
          },
          title: {
            type: 'string',
            description: 'Plain-language title without finance jargon.',
          },
          explanation: {
            type: 'string',
            description: 'Two short sentences explaining why this matters.',
          },
          actionSteps: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
            description: 'Three concrete actions the user can take this week.',
          },
          estimatedDaysReduction: {
            type: 'number',
            minimum: 0,
            description: 'Estimated number of days reduced from the cash cycle.',
          },
          estimatedCashFreedLakhs: {
            type: 'number',
            minimum: 0,
            description: 'Estimated cash freed in lakhs of rupees.',
          },
        },
        required: [
          'id',
          'dimension',
          'priority',
          'title',
          'explanation',
          'actionSteps',
          'estimatedDaysReduction',
          'estimatedCashFreedLakhs',
        ],
      },
    },
  },
  required: ['recommendations'],
};

function extractGeminiText(body: GeminiResponse | GeminiError | null): string {
  const text = (body as GeminiResponse | null)?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not contain JSON.');
  }

  return text.slice(start, end + 1);
}

function getGeminiErrorMessage(body: GeminiResponse | GeminiError | null, status: number): string {
  const apiMessage = (body as GeminiError | null)?.error?.message;
  return apiMessage ? `Gemini API error: ${apiMessage}` : `Gemini API request failed with ${status}.`;
}
