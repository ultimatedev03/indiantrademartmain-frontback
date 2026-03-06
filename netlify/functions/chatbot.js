import OpenAI from 'openai';
import Groq from 'groq-sdk';

const FALLBACK_LANG = 'en';
const FALLBACK_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const FALLBACK_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const buildFallbackReply = (language = FALLBACK_LANG, messages = []) => {
  const lang = String(language || FALLBACK_LANG).toLowerCase() === 'hi' ? 'hi' : 'en';
  const lastUserMessage = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((m) => String(m?.role || '').toLowerCase() === 'user');
  const query = String(lastUserMessage?.text || '').toLowerCase();

  if (lang === 'hi') {
    if (query.includes('register') || query.includes('vendor') || query.includes('sell')) {
      return 'Vendor registration ke liye: 1) Sell with Us par jaayein 2) Business + GST/license details bharein 3) Documents upload karke verification complete karein.';
    }
    if (query.includes('quote') || query.includes('rfq') || query.includes('price')) {
      return 'Quote paane ke liye product search karke enquiry bhejein. Vendor replies dashboard me mil jayenge.';
    }
    if (query.includes('supplier') || query.includes('product') || query.includes('search')) {
      return 'Product/supplier dhoondhne ke liye keyword + location filter use karein aur verified vendors compare karein.';
    }
    return 'Main ITM support assistant hoon. Aap product search, supplier finding, enquiry, ya vendor registration me help le sakte hain.';
  }

  if (query.includes('register') || query.includes('vendor') || query.includes('sell')) {
    return 'To register as a vendor: 1) Open Sell with Us 2) Fill business + GST/license details 3) Upload documents and complete verification.';
  }
  if (query.includes('quote') || query.includes('rfq') || query.includes('price')) {
    return 'To get quotes, search the product, submit an enquiry/RFQ, and track vendor responses in your dashboard.';
  }
  if (query.includes('supplier') || query.includes('product') || query.includes('search')) {
    return 'Use search with product keywords and location filters, then compare verified suppliers before contacting them.';
  }
  return 'I can help with product search, supplier discovery, enquiries/RFQs, and vendor onboarding on IndianTradeMart.';
};

const buildSystemPrompt = (language = FALLBACK_LANG) =>
  [
    `You are “Khushi from ITM”, the official assistant of IndianTradeMart (indiantrademart.com), a B2B marketplace that connects trusted manufacturers, suppliers, and buyers across India.`,
    `Always answer in the user’s selected language code: ${language}. If language is 'hi', reply in natural Hindi; otherwise use English.`,
    `Core duties: help users find products, suppliers, manufacturers; guide vendor registration (“Sell with Us/Become a Vendor” -> fill business + GST/license details, upload docs, verify phone/email, then list products); explain buying flow (search products, compare vendors, raise inquiries/RFQs, track responses).`,
    `Tone: concise, friendly, professional, action-oriented. Offer 2–3 short steps or quick calls-to-action. Ask a brief clarifying question if intent is unclear.`,
    `Safety: never share API keys or internal info; if asked about sensitive data, politely refuse.`,
  ].join(' ');

const okCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: okCors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: okCors, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { messages, language = FALLBACK_LANG, model } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers: okCors, body: JSON.stringify({ error: 'messages[] required' }) };
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!openaiKey && !groqKey) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...okCors },
        body: JSON.stringify({ text: buildFallbackReply(language, messages), provider: 'fallback' }),
      };
    }

    let completion;
    let providerUsed = 'openai';

    // Try OpenAI first
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      try {
        completion = await openai.chat.completions.create({
          model: model || FALLBACK_OPENAI_MODEL,
          temperature: 0.6,
          max_tokens: 512,
          messages: [
            { role: 'system', content: buildSystemPrompt(language) },
            ...messages.map((m) => ({ role: m.role, content: m.text })),
          ],
        });
      } catch (err) {
        const status = err?.status || err?.response?.status;
        const detail = err?.error?.message || err?.response?.data || err?.message;
        const quotaError = status === 429 || (typeof detail === 'string' && detail.toLowerCase().includes('quota'));
        if (!quotaError || !groqKey) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', ...okCors },
            body: JSON.stringify({
              text: buildFallbackReply(language, messages),
              provider: 'fallback',
              warning: detail || 'OpenAI unavailable',
            }),
          };
        }
        providerUsed = 'groq';
      }
    } else {
      providerUsed = 'groq';
    }

    // Groq fallback or primary
    if (providerUsed === 'groq') {
      const groq = new Groq({ apiKey: groqKey });
      try {
        completion = await groq.chat.completions.create({
          model: FALLBACK_GROQ_MODEL,
          temperature: 0.6,
          max_tokens: 512,
          messages: [
            { role: 'system', content: buildSystemPrompt(language) },
            ...messages.map((m) => ({ role: m.role, content: m.text })),
          ],
        });
      } catch (err) {
        const detail = err?.error?.message || err?.response?.data || err?.message;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', ...okCors },
          body: JSON.stringify({
            text: buildFallbackReply(language, messages),
            provider: 'fallback',
            warning: detail || 'Groq unavailable',
          }),
        };
      }
    }

    const text =
      completion?.choices?.[0]?.message?.content ||
      'Sorry, I could not generate a response right now.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...okCors },
      body: JSON.stringify({ text, provider: providerUsed }),
    };
  } catch (err) {
    console.error('netlify chatbot error', err);
    return { statusCode: 500, headers: okCors, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
