import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(here, 'real-workflow-1-crm-rate-extraction.json');

const credentials = {
  inbound: {
    httpHeaderAuth: {
      id: 'REPLACE_WITH_N8N_CRM_WEBHOOK_HEADER_CREDENTIAL_ID',
      name: 'REPLACE_WITH_N8N_CRM_WEBHOOK_HEADER_CREDENTIAL_NAME',
    },
  },
  gemini: {
    httpHeaderAuth: {
      id: 'REPLACE_WITH_N8N_GEMINI_HEADER_CREDENTIAL_ID',
      name: 'REPLACE_WITH_N8N_GEMINI_HEADER_CREDENTIAL_NAME',
    },
  },
  callback: {
    httpHeaderAuth: {
      id: 'REPLACE_WITH_N8N_CRM_CALLBACK_HEADER_CREDENTIAL_ID',
      name: 'REPLACE_WITH_N8N_CRM_CALLBACK_HEADER_CREDENTIAL_NAME',
    },
  },
};

const validateRequestCode = String.raw`const input = items[0]?.json || {};
const payload = input.body && typeof input.body === 'object' ? input.body : input;
const documentId = String(payload.documentId || '').trim();
const fileName = String(payload.fileName || '').trim();
const downloadUrl = String(payload.downloadUrl || '').trim();
const callbackUrl = String(payload.callbackUrl || '').trim();

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
  throw new Error('CRM request is missing a valid documentId.');
}
if (!fileName.toLowerCase().endsWith('.pdf')) {
  throw new Error('CRM request fileName must end in .pdf.');
}
if (!/^https?:\/\//i.test(downloadUrl) || !/^https?:\/\//i.test(callbackUrl)) {
  throw new Error('CRM request must include absolute downloadUrl and callbackUrl values.');
}

return [{
  json: {
    documentId,
    fileName,
    downloadUrl,
    callbackUrl,
    acceptedAt: new Date().toISOString(),
  },
}];`;

const buildGeminiRequestCode = String.raw`const MAX_PDF_BYTES = 18 * 1024 * 1024;
const GEMINI_MODEL = 'gemini-3.5-flash';

const nullableString = (description) => ({ type: 'STRING', nullable: true, description });
const nullableInteger = (description) => ({ type: 'INTEGER', nullable: true, description });
const nullableNumber = (description) => ({ type: 'NUMBER', nullable: true, description });

const rateSchema = {
  type: 'OBJECT',
  properties: {
    rate_type: {
      type: 'STRING',
      enum: ['Accommodation', 'Child', 'Extra Bed', 'Meal Supplement', 'Mandatory Supplement', 'Package', 'Other'],
      description: 'Commercial purpose of this exact price row.',
    },
    season_name: { type: 'STRING', description: 'Printed season or period label, or empty string.' },
    valid_from: nullableString('Start date in YYYY-MM-DD, or null only if not stated.'),
    valid_to: nullableString('End date in YYYY-MM-DD, or null only if not stated.'),
    booking_by: nullableString('Book-by deadline in YYYY-MM-DD, or null.'),
    blackout_dates: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Explicit blackout dates or ranges.' },
    room_type: { type: 'STRING', description: 'Exact room/category, or N/A for a general supplement.' },
    meal_plan: { type: 'STRING', description: 'Meal plan such as RO, BB, HB, FB, AI, or Not Stated.' },
    occupancy: { type: 'STRING', description: 'Printed occupancy such as SGL, DBL, PPS, TRPL, or a child age band.' },
    adults: nullableInteger('Adults represented by this price when explicit.'),
    children: nullableInteger('Children represented by this price when explicit.'),
    amount: nullableNumber('Exact numeric supplier amount without symbols or separators.'),
    currency: { type: 'STRING', description: 'Three-letter currency for this row, or empty to use the document default.' },
    market: { type: 'STRING', description: 'Market or residency restriction, or empty to use the document default.' },
    rate_basis: {
      type: 'STRING',
      enum: ['Per Room Per Night', 'Per Person Per Night', 'Per Person Sharing Per Night', 'Per Child Per Night', 'Per Person Per Stay', 'Per Room Per Stay', 'Package Total', 'Flat Amount', 'Other'],
      description: 'The unit to which the exact amount applies.',
    },
    minimum_stay: nullableInteger('Minimum nights when explicit.'),
    tax_included: { type: 'STRING', enum: ['Yes', 'No', 'Unknown'] },
    commission_included: { type: 'STRING', enum: ['Yes', 'No', 'Unknown'] },
    conditions: { type: 'STRING', description: 'Restrictions specific to this exact row.' },
    source_page: nullableInteger('One-based page containing this exact price.'),
    confidence: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
  },
  required: [
    'rate_type', 'season_name', 'valid_from', 'valid_to', 'booking_by', 'blackout_dates',
    'room_type', 'meal_plan', 'occupancy', 'adults', 'children', 'amount', 'currency',
    'market', 'rate_basis', 'minimum_stay', 'tax_included', 'commission_included',
    'conditions', 'source_page', 'confidence',
  ],
};

const hotelSchema = {
  type: 'OBJECT',
  properties: {
    hotel_name: { type: 'STRING', description: 'Official hotel/property name printed in the PDF.' },
    destination: { type: 'STRING', description: 'Tourism destination or area.' },
    city: { type: 'STRING', description: 'City or town when stated, otherwise empty.' },
    country: { type: 'STRING', description: 'Country when stated or explicit, otherwise empty.' },
    star_rating: nullableNumber('Printed star rating, otherwise null.'),
    child_policy: { type: 'STRING', description: 'Child policy and age bands without invented details.' },
    cancellation_policy: { type: 'STRING', description: 'Cancellation and no-show terms.' },
    payment_terms: { type: 'STRING', description: 'Deposit and payment terms.' },
    tax_notes: { type: 'STRING', description: 'Taxes, levies, inclusions, and exclusions.' },
    rates: { type: 'ARRAY', items: rateSchema },
  },
  required: [
    'hotel_name', 'destination', 'city', 'country', 'star_rating', 'child_policy',
    'cancellation_policy', 'payment_terms', 'tax_notes', 'rates',
  ],
};

const schema = {
  type: 'OBJECT',
  properties: {
    document: {
      type: 'OBJECT',
      properties: {
        document_type: { type: 'STRING', enum: ['Rate Sheet', 'Contract', 'Special Offer', 'Supplement', 'Brochure', 'Other'] },
        is_rate_sheet: { type: 'BOOLEAN' },
        supplier_name: { type: 'STRING', description: 'Supplier, DMC, hotel group, or wholesaler issuing the rates.' },
        contract_name: { type: 'STRING', description: 'Printed document title or contract name.' },
        pricing_basis: {
          type: 'STRING',
          enum: ['unknown', 'rack', 'net'],
          description: 'net only when the document explicitly says net/non-commissionable/buying rates; rack only when it explicitly says rack/public/selling rates; otherwise unknown.',
        },
        default_market: { type: 'STRING', description: 'Default residency or market restriction.' },
        default_currency: { type: 'STRING', description: 'Three-letter default currency, or empty if unclear.' },
        issued_date: nullableString('Issue date in YYYY-MM-DD, or null.'),
        overall_valid_from: nullableString('Document-wide validity start in YYYY-MM-DD, or null.'),
        overall_valid_to: nullableString('Document-wide validity end in YYYY-MM-DD, or null.'),
        summary: { type: 'STRING', description: 'Short factual description of the commercial content.' },
        confidence: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
      },
      required: [
        'document_type', 'is_rate_sheet', 'supplier_name', 'contract_name', 'pricing_basis',
        'default_market', 'default_currency', 'issued_date', 'overall_valid_from',
        'overall_valid_to', 'summary', 'confidence',
      ],
    },
    hotels: { type: 'ARRAY', items: hotelSchema },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['document', 'hotels', 'warnings'],
};

const prompt = [
  'You extract supplier hotel rates for Airavat Tours and Travel Ltd.',
  'Read the complete PDF, including scanned text, every table, repeated headers, and footnotes.',
  '',
  'NON-NEGOTIABLE RULES:',
  '- Never invent or estimate a price, date, currency, hotel, room, occupancy, policy, tax, market, or price basis.',
  '- Copy supplier amounts exactly. Do not add markup, convert currency, calculate totals, or infer availability.',
  '- Expand every matrix into one row per hotel + printed date range + room + meal plan + occupancy + amount.',
  '- A room with different prices in different date ranges MUST produce separate rows. Never merge ranges or average prices.',
  '- Never combine different seasons, occupancies, currencies, markets, or rate bases into one row.',
  '- Create separate rows for child rates, extra beds, meals, mandatory festive supplements, and packages.',
  '- Use a document-wide date only when the PDF clearly states that it applies to every relevant row.',
  '- Structured dates must be YYYY-MM-DD. Put ambiguous or non-convertible dates in warnings.',
  '- Preserve East African resident, resident, non-resident, and all other market restrictions.',
  '- Determine pricing_basis only from explicit wording. Return unknown when it is not stated.',
  '- Page numbers are one-based. Cite the page containing each exact price whenever visible.',
  '- If there are no commercially usable rates, set is_rate_sheet false and return empty hotel rate arrays.',
  '- Return only JSON matching the supplied schema.',
].join('\n');

const source = $items('Code - Validate CRM Request')[0]?.json || {};
let buffer = Buffer.alloc(0);
let preflightError = '';

try {
  buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
} catch (error) {
  const downloadError = items[0]?.json?.error;
  preflightError = downloadError?.message || downloadError || ('The signed PDF download failed: ' + error.message);
}

if (!preflightError && buffer.length === 0) preflightError = 'The downloaded supplier PDF is empty.';
if (!preflightError && buffer.length > MAX_PDF_BYTES) preflightError = 'The supplier PDF exceeds the 18 MiB extraction limit.';
if (!preflightError && !buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1').includes('%PDF-')) {
  preflightError = 'The downloaded file does not have a valid PDF signature.';
}

const requestReady = !preflightError;
const geminiRequestBody = requestReady ? {
  contents: [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } },
      { text: prompt },
    ],
  }],
  generationConfig: {
    temperature: 0,
    maxOutputTokens: 65536,
    responseMimeType: 'application/json',
    responseSchema: schema,
  },
} : null;

return [{
  json: {
    ...source,
    geminiModel: GEMINI_MODEL,
    actualSize: buffer.length,
    requestReady,
    preflightError,
    geminiRequestBody,
  },
}];`;

const parseGeminiResponseCode = String.raw`function firstText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
}

function apiError(response) {
  const error = response?.error;
  if (!error) return '';
  if (typeof error === 'string') return error;
  return String(error.message || JSON.stringify(error));
}

const source = $items('Code - Build Gemini Request')[0]?.json || {};
const response = items[0]?.json || {};
let extraction = null;
let errorMessage = apiError(response);

try {
  if (errorMessage) throw new Error(errorMessage);
  let text = firstText(response);
  if (!text) throw new Error('Gemini returned no structured text response.');
  const fence = String.fromCharCode(96).repeat(3);
  if (text.startsWith(fence)) text = text.slice(fence.length).replace(/^json\s*/i, '');
  if (text.endsWith(fence)) text = text.slice(0, -fence.length);
  extraction = JSON.parse(text.trim());
  if (!extraction?.document || !Array.isArray(extraction?.hotels) || !Array.isArray(extraction?.warnings)) {
    throw new Error('Gemini JSON is missing document, hotels, or warnings.');
  }
} catch (error) {
  extraction = null;
  errorMessage = error.message;
}

return [{
  json: {
    documentId: source.documentId,
    callbackUrl: source.callbackUrl,
    callbackBody: extraction ? {
      documentId: source.documentId,
      status: 'completed',
      model: source.geminiModel,
      extraction,
    } : {
      documentId: source.documentId,
      status: 'error',
      model: source.geminiModel,
      errorMessage,
    },
  },
}];`;

const preflightCallbackCode = String.raw`const source = items[0]?.json || {};
return [{
  json: {
    documentId: source.documentId,
    callbackUrl: source.callbackUrl,
    callbackBody: {
      documentId: source.documentId,
      status: 'error',
      model: source.geminiModel,
      errorMessage: source.preflightError || 'The supplier PDF failed extraction preflight.',
    },
  },
}];`;

const workflow = {
  name: 'REAL WORKFLOW 1 - CRM Supplier Rate Extraction v1',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'airavat-crm-supplier-rate-extraction',
        authentication: 'headerAuth',
        responseMode: 'onReceived',
        options: {},
      },
      id: '41000000-0000-4000-8000-000000000001',
      name: 'Webhook - CRM Supplier Rate PDF',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [-1120, 80],
      webhookId: '41000000-0000-4000-8000-000000000101',
      credentials: credentials.inbound,
    },
    {
      parameters: { jsCode: validateRequestCode },
      id: '41000000-0000-4000-8000-000000000002',
      name: 'Code - Validate CRM Request',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-880, 80],
    },
    {
      parameters: {
        url: '={{ $json.downloadUrl }}',
        options: {
          response: {
            response: {
              responseFormat: 'file',
              outputPropertyName: 'data',
            },
          },
          timeout: 120000,
        },
      },
      id: '41000000-0000-4000-8000-000000000003',
      name: 'HTTP - Download Private Supplier PDF',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [-640, 80],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: buildGeminiRequestCode },
      id: '41000000-0000-4000-8000-000000000004',
      name: 'Code - Build Gemini Request',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-400, 80],
    },
    {
      parameters: {
        conditions: { boolean: [{ value1: '={{ $json.requestReady }}', value2: true }] },
      },
      id: '41000000-0000-4000-8000-000000000005',
      name: 'IF - PDF Is Ready For Gemini',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [-160, 80],
    },
    {
      parameters: {
        method: 'POST',
        url: "={{ 'https://generativelanguage.googleapis.com/v1beta/models/' + $json.geminiModel + ':generateContent' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ $json.geminiRequestBody }}',
        options: { timeout: 300000 },
      },
      id: '41000000-0000-4000-8000-000000000006',
      name: 'Gemini - Extract Structured Supplier Rates',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [80, 0],
      continueOnFail: true,
      credentials: credentials.gemini,
    },
    {
      parameters: { jsCode: parseGeminiResponseCode },
      id: '41000000-0000-4000-8000-000000000007',
      name: 'Code - Prepare Gemini Callback',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [320, 0],
    },
    {
      parameters: { jsCode: preflightCallbackCode },
      id: '41000000-0000-4000-8000-000000000008',
      name: 'Code - Prepare Preflight Error Callback',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [80, 180],
    },
    {
      parameters: {
        method: 'POST',
        url: '={{ $json.callbackUrl }}',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ $json.callbackBody }}',
        options: { timeout: 120000 },
      },
      id: '41000000-0000-4000-8000-000000000009',
      name: 'HTTP - Return Extraction To CRM',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [560, 80],
      credentials: credentials.callback,
    },
    {
      parameters: {
        content: '## Configure credentials\n\nInbound Header Auth: Authorization = Bearer N8N_RATE_WEBHOOK_SECRET. Gemini Header Auth: x-goog-api-key. Callback Header Auth: Authorization = Bearer N8N_RATE_CALLBACK_SECRET.',
        height: 260,
        width: 430,
      },
      id: '41000000-0000-4000-8000-000000000010',
      name: 'Sticky Note - Required Credentials',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [-1120, -300],
    },
    {
      parameters: {
        content: '## Publication boundary\n\nThis workflow extracts only. It cannot activate rates. The CRM callback stages inactive rows; an administrator must review and publish them before the website can use them.',
        height: 220,
        width: 430,
        color: 5,
      },
      id: '41000000-0000-4000-8000-000000000011',
      name: 'Sticky Note - Human Approval Required',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [80, -300],
    },
  ],
  connections: {
    'Webhook - CRM Supplier Rate PDF': {
      main: [[{ node: 'Code - Validate CRM Request', type: 'main', index: 0 }]],
    },
    'Code - Validate CRM Request': {
      main: [[{ node: 'HTTP - Download Private Supplier PDF', type: 'main', index: 0 }]],
    },
    'HTTP - Download Private Supplier PDF': {
      main: [[{ node: 'Code - Build Gemini Request', type: 'main', index: 0 }]],
    },
    'Code - Build Gemini Request': {
      main: [[{ node: 'IF - PDF Is Ready For Gemini', type: 'main', index: 0 }]],
    },
    'IF - PDF Is Ready For Gemini': {
      main: [
        [{ node: 'Gemini - Extract Structured Supplier Rates', type: 'main', index: 0 }],
        [{ node: 'Code - Prepare Preflight Error Callback', type: 'main', index: 0 }],
      ],
    },
    'Gemini - Extract Structured Supplier Rates': {
      main: [[{ node: 'Code - Prepare Gemini Callback', type: 'main', index: 0 }]],
    },
    'Code - Prepare Gemini Callback': {
      main: [[{ node: 'HTTP - Return Extraction To CRM', type: 'main', index: 0 }]],
    },
    'Code - Prepare Preflight Error Callback': {
      main: [[{ node: 'HTTP - Return Extraction To CRM', type: 'main', index: 0 }]],
    },
  },
  pinData: {},
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'Africa/Nairobi',
    saveManualExecutions: true,
  },
  versionId: '41000000-0000-4000-8000-000000000100',
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outputPath}`);
