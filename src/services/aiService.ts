import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchCryptoPrice, formatPriceResponse } from './priceService';
import { fixTypos } from './textProcessingService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('Gemini API key not found. AI features will use fallback responses.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface AIContext {
  payments: any[];
  companyName: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Advanced memory and thinking system
interface ConversationMemory {
  message: string;
  response: string;
  type: string;
  timestamp: Date;
  topics: string[];
  entities: string[];
  intent: string;
  context: any;
}

interface ThinkingContext {
  currentTopic: string;
  primaryCrypto: string;
  userIntent: string;
  conversationPhase: 'initial' | 'exploring' | 'deep_dive' | 'comparative';
  establishedFacts: { [key: string]: any };
  userPreferences: string[];
  recentQuestions: string[];
}

const initialThinkingContext: ThinkingContext = {
  currentTopic: 'stellar',
  primaryCrypto: 'stellar',
  userIntent: 'general',
  conversationPhase: 'initial',
  establishedFacts: {},
  userPreferences: [],
  recentQuestions: [],
};

let conversationMemory: ConversationMemory[] = [];
let thinkingContext: ThinkingContext = { ...initialThinkingContext };

/** Clear module-level AI state (call on new chat). */
export function resetAIConversationMemory(): void {
  conversationMemory = [];
  thinkingContext = { ...initialThinkingContext };
}

/** Rebuild memory from persisted session messages before answering. */
export function prepareConversationContext(history: ChatHistoryMessage[]): void {
  conversationMemory = [];
  thinkingContext = { ...initialThinkingContext };

  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    const next = history[i + 1];
    if (msg.role === 'user' && next?.role === 'assistant') {
      addToMemory(msg.content, next.content, 'session');
    }
  }

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (lastUser) {
    updateThinkingContext(lastUser.content, analyzeMessage(lastUser.content));
  }
}

const analyzeMessage = (message: string): { topics: string[], entities: string[], intent: string } => {

  const topics = [];
  const entities = [];

  // Topic detection - expanded for comprehensive company intelligence
  if (/(price|cost|value|worth)/i.test(message)) topics.push('pricing');
  if (/(ath|all.?time.?high|highest|peak)/i.test(message)) topics.push('ath');
  if (/(atl|all.?time.?low|lowest|bottom)/i.test(message)) topics.push('atl');
  if (/(founder|create|start|who)/i.test(message)) topics.push('foundation');
  if (/(market|cap|rank|volume)/i.test(message)) topics.push('market_data');
  if (/(analysis|technical|trend)/i.test(message)) topics.push('analysis');
  if (/(compare|vs|versus)/i.test(message)) topics.push('comparison');

  // Company intelligence topics
  if (/(employee|staff|worker|team)/i.test(message)) topics.push('employees');
  if (/(salary|wage|pay|compensation|income)/i.test(message)) topics.push('salary');
  if (/(highest|top|maximum|most)/i.test(message)) topics.push('highest');
  if (/(lowest|bottom|minimum|least)/i.test(message)) topics.push('lowest');
  if (/(newest|latest|recent|new)/i.test(message)) topics.push('newest');
  if (/(oldest|first|original)/i.test(message)) topics.push('oldest');
  if (/(total|count|number|how many)/i.test(message)) topics.push('count');
  if (/(overview|summary|breakdown|list)/i.test(message)) topics.push('overview');
  if (/(company|business|organization)/i.test(message)) topics.push('company');
  if (/(payroll|payment|budget)/i.test(message)) topics.push('payroll');
  if (/(department|division|team)/i.test(message)) topics.push('department');
  if (/(average|mean|typical)/i.test(message)) topics.push('average');
  if (/(increase|growth|rise|percentage)/i.test(message)) topics.push('growth');
  if (/(name|called|title)/i.test(message)) topics.push('name');
  if (/(does|do|business|industry)/i.test(message)) topics.push('business_type');

  // Entity detection - include XLM variations
  const cryptos = message.match(/(stellar|xlm|lumens|bitcoin|btc|cardano|ada|solana|sol|stablecoin|usd.?backed)/gi) || [];
  entities.push(...cryptos.map(c => c.toLowerCase()));

  // Detect XLM-specific questions
  if (/(xlm|lumens|stellar|stellar lumens|xlm price|xlm company|xlm mission|xlm about|what is xlm|tell.*about.*xlm|explain.*xlm)/i.test(message)) {
    entities.push('xlm');
    topics.push('xlm_info');
  }

  const people = message.match(/(founder|creator|ceo|vitalik|buterin)/gi) || [];
  entities.push(...people.map(p => p.toLowerCase()));

  const departments = message.match(/(engineering|marketing|sales|hr|finance|operations|design|product)/gi) || [];
  entities.push(...departments.map(d => d.toLowerCase()));

  // Intent detection - expanded
  let intent = 'general';
  if (/(what|whats|tell me)/i.test(message)) intent = 'question';
  if (/(how|explain|why)/i.test(message)) intent = 'explanation';
  if (/(compare|difference|vs)/i.test(message)) intent = 'comparison';
  if (/(founder|who|create)/i.test(message)) intent = 'knowledge';
  if (/(list|show|give me)/i.test(message)) intent = 'data_request';
  if (/(overview|summary)/i.test(message)) intent = 'summary';

  return { topics, entities, intent };
};

const updateThinkingContext = (message: string, analysis: any) => {
  // Update primary crypto
  if (analysis.entities.includes('bitcoin') || analysis.entities.includes('btc')) {
    thinkingContext.primaryCrypto = 'bitcoin';
  } else if (analysis.entities.includes('stellar') || analysis.entities.includes('xlm')) {
    thinkingContext.primaryCrypto = 'stellar';
  } else if (analysis.entities.includes('stellar') || analysis.entities.includes('xlm') || analysis.topics.includes('ath') || analysis.topics.includes('atl')) {
    thinkingContext.primaryCrypto = 'stellar';
  }

  // Update topic
  if (analysis.topics.length > 0) {
    thinkingContext.currentTopic = analysis.topics[0];
  }

  // Update intent
  thinkingContext.userIntent = analysis.intent;

  // Update conversation phase
  const messageCount = conversationMemory.length;
  if (messageCount < 3) thinkingContext.conversationPhase = 'initial';
  else if (messageCount < 7) thinkingContext.conversationPhase = 'exploring';
  else thinkingContext.conversationPhase = 'deep_dive';

  // Track recent questions
  thinkingContext.recentQuestions.push(message);
  if (thinkingContext.recentQuestions.length > 5) {
    thinkingContext.recentQuestions = thinkingContext.recentQuestions.slice(-5);
  }
};

const addToMemory = (message: string, response: string, responseType: string) => {
  const analysis = analyzeMessage(message);

  conversationMemory.push({
    message,
    response,
    type: responseType,
    timestamp: new Date(),
    topics: analysis.topics,
    entities: analysis.entities,
    intent: analysis.intent,
    context: { ...thinkingContext }
  });

  // Keep last 20 exchanges for deep context
  if (conversationMemory.length > 20) {
    conversationMemory = conversationMemory.slice(-20);
  }

  updateThinkingContext(message, analysis);
};

const intelligentThinking = (message: string): { shouldAnswer: boolean, directAnswer?: string, reasoning: string } => {
  const analysis = analyzeMessage(message);

  console.log('🤔 AI Thinking:', {
    message,
    analysis,
    currentContext: thinkingContext,
    recentMemory: conversationMemory.slice(-3).map(m => ({ msg: m.message, topics: m.topics }))
  });

  // Intelligent reasoning based on context

  // Payout/how-to questions mentioning XLM — not "what is XLM" definition queries
  const isXlmPayoutQuestion = /how are refunds paid|refunds paid in xlm|xlm payout|receive.*xlm|paid out in xlm/i.test(message);

  // XLM-specific questions - HIGHEST PRIORITY - check FIRST before anything else
  // This handles simple queries like "xlm", "what is xlm", "tell me about xlm", etc.
  if (
    !isXlmPayoutQuestion &&
    (analysis.topics.includes('xlm_info') ||
      /^xlm$/i.test(message.trim()) ||
      /^what is xlm/i.test(message.trim()) ||
      /^tell me about xlm/i.test(message.trim()) ||
      /^explain xlm/i.test(message.trim()) ||
      /what is xlm|tell me about xlm|explain xlm|xlm token|xlm coin/i.test(message))
  ) {
    return {
      shouldAnswer: true,
      directAnswer: 'xlm_info',
      reasoning: `User asking about XLM. XLM is mentioned in the message. Provide comprehensive information about Stellar Lumens.`
    };
  }

  // ATH questions - always answer with Stellar/XLM unless another crypto explicitly mentioned
  if (analysis.topics.includes('ath')) {
    const targetCrypto = analysis.entities.find(e => ['bitcoin', 'stellar', 'xlm', 'cardano', 'solana'].includes(e)) || 'stellar';
    return {
      shouldAnswer: true,
      directAnswer: 'ath',
      reasoning: `User asking about ATH. Context suggests ${targetCrypto}. This is a Stellar/XLM app, so default to Stellar/XLM unless specifically mentioned otherwise.`
    };
  }

  // ATL questions
  if (analysis.topics.includes('atl')) {
    const targetCrypto = analysis.entities.find(e => ['bitcoin', 'stellar', 'xlm', 'cardano', 'solana'].includes(e)) || 'stellar';
    return {
      shouldAnswer: true,
      directAnswer: 'atl',
      reasoning: `User asking about ATL. Context suggests ${targetCrypto}.`
    };
  }

  // Founder questions
  if (analysis.topics.includes('foundation') || analysis.entities.includes('founder')) {
    return {
      shouldAnswer: true,
      directAnswer: 'founder',
      reasoning: `User asking about founder. In Stellar context, this means Jed McCaleb and Joyce Kim.`
    };
  }

  // Price questions - include XLM and catch "current price of" - CHECK BEFORE OTHER CHECKS
  // Make regex more flexible to catch variations
  const pricePatterns = [
    /(current|what is|what's|tell me).*(price|pricing|cost|value).*(of|for)/i,
    /price.*(of|for).*(stellar|xlm|bitcoin|btc|cardano|solana)/i,
    /(stellar|xlm|bitcoin|btc|cardano|solana).*price/i,
    /how much.*(stellar|xlm|bitcoin|btc|cardano|solana)/i
  ];

  if (analysis.topics.includes('pricing') || pricePatterns.some(pattern => pattern.test(message))) {
    // Extract crypto from message - check entities first, then message match
    let targetCrypto = analysis.entities.find(e => ['bitcoin', 'stellar', 'xlm', 'cardano', 'solana'].includes(e));

    // If not in entities, try to extract from message directly
    if (!targetCrypto) {
      const cryptoMatch = message.match(/(stellar|xlm|bitcoin|btc|cardano|solana)/i);
      if (cryptoMatch) {
        targetCrypto = cryptoMatch[0].toLowerCase();
      }
    }

    // Default to stellar if in Stellar/XLM app context
    targetCrypto = targetCrypto || thinkingContext.primaryCrypto || 'stellar';

    console.log('💰 Price question detected:', { message, targetCrypto, entities: analysis.entities, topics: analysis.topics });

    return {
      shouldAnswer: true,
      directAnswer: 'price',
      reasoning: `User asking about price. Target crypto: ${targetCrypto}`
    };
  }

  // If we've been in a conversation and user asks vague questions, use context
  if (conversationMemory.length > 2 && analysis.intent === 'question') {
    const recentTopics = conversationMemory.slice(-3).flatMap(m => m.topics);
    if (recentTopics.includes('ath') || recentTopics.includes('atl') || recentTopics.includes('pricing')) {
      return {
        shouldAnswer: true,
        directAnswer: 'contextual',
        reasoning: `Based on conversation history, user likely wants ${thinkingContext.primaryCrypto} data.`
      };
    }
  }

  return {
    shouldAnswer: false,
    reasoning: 'Need more context or should use Gemini for complex response.'
  };
};

const createSystemPrompt = (context: AIContext) => {
  const vatPayments = context.payments.filter((p) => p.employee_id === 'vat-refund');
  const paymentData = vatPayments.length > 0
    ? vatPayments.slice(-5).map(payment => {
        const merchant = payment.vat_refund_details?.merchantName || 'Unknown merchant';
        return `- $${payment.amount} VAT refund (${merchant}) on ${payment.created_at || 'N/A'}`;
      }).join('\n')
    : '- No VAT refunds submitted yet';

  const memoryContext = conversationMemory.slice(-5).map(m =>
    `User: ${m.message} (Topics: ${m.topics.join(', ')}) -> AI: ${m.response.substring(0, 100)}...`
  ).join('\n');

  const factContext = Object.entries(thinkingContext.establishedFacts)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `You are an EXTREMELY intelligent AI with advanced memory and contextual thinking capabilities. You are focused on Stellar and XLM (Lumens) but knowledgeable about all crypto.

🧠 ADVANCED COGNITIVE ABILITIES:
✅ Perfect memory of our entire conversation
✅ Contextual thinking and inference
✅ Pattern recognition across exchanges
✅ Intelligent assumption making
✅ Topic continuity awareness
✅ Entity relationship understanding

🏢 COMPANY CONTEXT:
- Platform: Gemetra (Stellar-based tourist VAT refund app using XLM)
- VAT Refunds: ${vatPayments.length}

🧾 RECENT VAT REFUNDS:
${paymentData}

🧠 CURRENT THINKING CONTEXT:
- Primary Focus: ${thinkingContext.primaryCrypto.toUpperCase()}
- Current Topic: ${thinkingContext.currentTopic}
- User Intent: ${thinkingContext.userIntent}
- Conversation Phase: ${thinkingContext.conversationPhase}
- Recent Questions: ${thinkingContext.recentQuestions.slice(-3).join(' | ')}

📚 CONVERSATION MEMORY:
${memoryContext}

💡 ESTABLISHED FACTS:
${factContext}

🎯 INTELLIGENT BEHAVIOR:
1. **Context Continuity**: When user asks follow-up questions, understand they're continuing the same topic
2. **Smart Defaults**: In a Stellar/XLM app, crypto questions default to Stellar/XLM unless specified
3. **Memory Integration**: Reference previous exchanges naturally
4. **Inference Making**: Make intelligent assumptions based on context
5. **Progressive Depth**: Provide deeper insights as conversation develops
6. **Entity Awareness**: Remember what we've discussed about specific topics
7. **XLM Recognition**: ALWAYS recognize XLM-related queries, even simple ones like "xlm", "what is xlm", "tell me about xlm", etc. Provide comprehensive XLM information immediately.

🚀 SPECIALIZED KNOWLEDGE:

**Stellar:**
- Founded by Jed McCaleb, a decentralized open-source network foundation
- Powers fast, low-cost cross-border payments and asset issuance
- Network where XLM is the native token

**XLM (Stellar Lumens) - CRITICAL KNOWLEDGE:**

**About XLM:**
XLM (Lumens) is the native utility token of the Stellar blockchain. It serves as a bridge currency and is used to pay transaction fees and initialize accounts.

**XLM Token Details:**
- **Full Name**: Stellar Lumens
- **Ticker**: XLM
- **Role**: Native Utility Token
- **Network**: Stellar Network
- **Consensus**: Stellar Consensus Protocol (SCP)
- **Speed**: 3-5 seconds per transaction
- **Cost**: Fraction of a cent (0.00001 XLM base fee)
- **Sustainability**: Highly energy-efficient compared to PoW chains

**Key Features:**
- **Instant Settlement**: Transactions confirm in seconds
- **Extremely Low Fees**: Makes micropayments viable
- **Asset Issuance**: Stellar allows anyone to tokenize real-world assets
- **Decentralized Exchange**: Built-in DEX at the protocol level
- **Bridge Currency**: Facilitates multi-currency transactions

**Use Cases:**
- Cross-border payments and remittances
- Micropayments
- Tokenization of assets
- DeFI and smart contracts (Soroban)
- Banking infrastructure

**Official Resources:**
- **Website**: https://www.stellar.org
- **Explorer**: https://stellar.expert
- **Documentation**: https://developers.stellar.org

CRITICAL: Think intelligently. Use context. Make inferences. Provide direct answers when context is clear. Be naturally conversational and remember everything we've discussed.`;
};

const handleIntelligentQueries = async (message: string, context: AIContext): Promise<string | null> => {
  const thinking = intelligentThinking(message);

  console.log('🧠 Intelligent Analysis:', thinking);

  // Check for XLM questions FIRST (highest priority) - before company intelligence
  if (thinking.directAnswer === 'xlm_info') {
    // Handle XLM info directly
    const xlmResponse = `🪙 **XLM (Stellar Lumens) - Complete Guide**

**What is XLM?**
XLM, also known as Lumens, is the native utility token of the Stellar network. Unlike stablecoins, XLM trades on the open market and fluctuates in value. It serves two main purposes: preventing spam on the network (minimum balance/fees) and acting as a bridge currency for multi-asset transactions.

**Stellar Network:**
Stellar is a decentralized, open-source blockchain designed to move money quickly and reliably at minimum cost. It connects banks, payment systems, and people.

**XLM Token Details:**
• **Name**: Stellar Lumens
• **Ticker**: XLM
• **Network**: Stellar Mainnet
• **Max Supply**: 50 Billion (Fixed)
• **Consensus**: Stellar Consensus Protocol (SCP)
• **Transaction Speed**: 3-5 seconds
• **Base Fee**: 0.00001 XLM (fraction of a penny)

**Key Features:**
⚡ **Instant Settlement** - Transactions confirm in seconds
💰 **Ultra-Low Cost** - Extremely cheap to transact, ideal for micropayments
🌍 **Global Reach** - Facilitates cross-border payments
🌉 **Asset Issuance** - Anyone can issue redeemable assets on Stellar
💹 **Built-in DEX** - Decentralized exchange protocol layer

**Use Cases:**
✅ **Cross-border Payments** - Send money anywhere cheaply
✅ **Micropayments** - Viable for transactions < $0.01
✅ **Token Assets** - Issue securities, stablecoins (like USDC), or NFTs
✅ **DeFi** - Smart contracts via Soroban
✅ **Aid Distribution** - Efficient NGO funds distribution

**Official Resources:**
🌐 **Stellar.org**: https://www.stellar.org
🔍 **Explorer**: https://stellar.expert
📚 **Developers**: https://developers.stellar.org
`;

    thinkingContext.establishedFacts['xlm_info'] = 'Native utility token of Stellar';
    thinkingContext.primaryCrypto = 'xlm';
    addToMemory(message, xlmResponse, 'xlm_info');
    return xlmResponse;
  }

  // Then check for company intelligence questions
  const companyResponse = handleCompanyIntelligence(message, context);
  if (companyResponse) {
    addToMemory(message, companyResponse, 'company_intelligence');
    return companyResponse;
  }

  if (!thinking.shouldAnswer) return null;

  try {
    switch (thinking.directAnswer) {
      case 'ath':
        const athCrypto = thinkingContext.primaryCrypto;
        const athData = await fetchCryptoPrice(athCrypto);
        if (athData?.ath) {
          const athDate = new Date(athData.athDate || '').toLocaleDateString();
          const distanceFromATH = athData.athChangePercentage || 0;

          const response = `📈 **${athCrypto.toUpperCase()} All-Time High**

🎯 **ATH:** $${athData.ath.toFixed(4)} (${athDate})
📍 **Current:** $${athData.price.toFixed(4)}
📉 **From ATH:** ${distanceFromATH.toFixed(1)}% below peak

${distanceFromATH > -50 ? '💡 Still within reasonable distance of peak levels!' : '🔍 Significant discount from peak - interesting for long-term perspective.'}`;

          thinkingContext.establishedFacts[`${athCrypto}_ath`] = athData.ath;
          addToMemory(message, response, 'ath_intelligent');
          return response;
        }
        break;

      case 'atl':
        const atlCrypto = thinkingContext.primaryCrypto;
        const atlData = await fetchCryptoPrice(atlCrypto);
        if (atlData?.atl) {
          const atlDate = new Date(atlData.atlDate || '').toLocaleDateString();
          const gainFromATL = atlData.atlChangePercentage || 0;

          const response = `📉 **${atlCrypto.toUpperCase()} All-Time Low**

🔻 **ATL:** $${atlData.atl.toFixed(6)} (${atlDate})
📍 **Current:** $${atlData.price.toFixed(4)}  
📈 **From ATL:** +${gainFromATL.toFixed(1)}% above bottom

🚀 Amazing ${gainFromATL.toFixed(0)}% recovery from the absolute lows!`;

          thinkingContext.establishedFacts[`${atlCrypto}_atl`] = atlData.atl;
          addToMemory(message, response, 'atl_intelligent');
          return response;
        }
        break;

      case 'founder':
        const founderResponse = `👨‍🎓 **Stellar Founders: Jed McCaleb & Joyce Kim**

🏆 **Credentials:**
• Jed McCaleb: Creator of eDonkey, Mt. Gox (original), and co-founder of Ripple
• Joyce Kim: Former lawyer and VC
• Founded Stellar in 2014 via the non-profit Stellar Development Foundation (SDF)

🚀 **Stellar Vision:**
Created Stellar to act as an open financial system that makes money move as easily as email.

💡 **Why It Matters:** Stellar is a decentralized protocol designed for speed and low cost, specifically for moving money across borders and assets.`;

        thinkingContext.establishedFacts['stellar_founder'] = 'Jed McCaleb & Joyce Kim (Stellar Development Foundation)';
        addToMemory(message, founderResponse, 'founder_intelligent');
        return founderResponse;

      case 'price':
        // Re-analyze message to get entities (analysis might not be in scope here)
        const priceAnalysis = analyzeMessage(message);

        // Check if user is asking about a specific crypto asset
        // Also extract crypto from message if not in entities
        let requestedCrypto = priceAnalysis.entities.find(e => ['xlm', 'stellar', 'bitcoin', 'btc'].includes(e));

        // If not found in entities, try to extract from message directly
        if (!requestedCrypto) {
          const cryptoMatch = message.match(/(stellar|xlm|bitcoin|btc)/i);
          if (cryptoMatch) {
            requestedCrypto = cryptoMatch[0].toLowerCase();
          }
        }

        // Default to stellar if in Stellar/XLM app context
        requestedCrypto = requestedCrypto || thinkingContext.primaryCrypto || 'stellar';
        const priceCrypto = requestedCrypto === 'lumens' ? 'stellar' : requestedCrypto;

        console.log('💰 Fetching price for:', { requestedCrypto, priceCrypto, message });

        const priceData = await fetchCryptoPrice(priceCrypto);
        if (priceData) {
          let response;
          response = formatPriceResponse(priceData, priceCrypto);
          thinkingContext.establishedFacts[`${priceCrypto}_price`] = priceData.price;
          addToMemory(message, response, 'price_intelligent');
          return response;
        }
        break;
    }
  } catch (error) {
    console.error('Error in intelligent query handling:', error);
  }

  return null;
};

const fallbackResponses = {
  greeting: [
    "Hello! I'm your Gemetra AI assistant for VAT refunds on Stellar. I can help with refund status, XLM wallet questions, Stellar blockchain topics, and live market data. What would you like to know?",
    "Hi there! I can help with VAT refund claims, Stellar/XLM payments, and crypto market analysis. How can I help?",
    "Hey! Ask me about VAT refunds, your claim history, Stellar, or XLM prices."
  ],
  clarification: [
    "I want to give you the most accurate information! Could you clarify which specific aspect you're interested in? 🤔",
    "I'd love to help! Just to make sure I understand correctly - which particular data point or cryptocurrency are you asking about? 📊",
    "Great question! To give you the perfect answer, could you specify which cryptocurrency or metric you're most interested in? 🎯"
  ],
  intelligent: [
    "I'm analyzing multiple data points to give you the most comprehensive answer. Let me break this down with real insights... 🧠",
    "Based on our conversation and current market conditions, here's what I'm seeing... 📈",
    "Interesting question! Let me provide some intelligent analysis on this... 🔍"
  ]
};

const getContextualFallback = (message: string): string => {
  const messageCount = conversationMemory.length;

  // Check for XLM queries first
  if (/xlm|stellar|lumens/i.test(message)) {
    return `🪙 **XLM (Stellar Lumens)**

XLM is the native utility token of the Stellar network, designed for fast, low-cost cross-border payments.

**Key Features:**
• Instant transactions (3-5 seconds)
• Extremely low fees (< $0.0001)
• Built-in Decentralized Exchange
• Ideal for payments and asset issuance

Would you like to see latest price data or learn more about Stellar technology?`;
  }

  if (/(hi|hello|hey)/i.test(message)) {
    return fallbackResponses.greeting[Math.floor(Math.random() * fallbackResponses.greeting.length)];
  }

  if (messageCount > 3) {
    return fallbackResponses.intelligent[Math.floor(Math.random() * fallbackResponses.intelligent.length)];
  }

  return fallbackResponses.clarification[Math.floor(Math.random() * fallbackResponses.clarification.length)];
};

export const generateAIResponse = async (
  message: string,
  context: AIContext,
  history: ChatHistoryMessage[] = [],
): Promise<string> => {
  if (history.length > 0) {
    prepareConversationContext(history);
  }

  console.log('🧠 Generating ultra-intelligent response for:', message);
  console.log('📊 Full context:', {
    vatRefunds: context.payments.filter((p) => p.employee_id === 'vat-refund').length,
    company: context.companyName,
    conversationMemory: conversationMemory.length,
    thinkingContext
  });

  // First, try intelligent contextual handling (includes price, company intelligence)
  const intelligentResponse = await handleIntelligentQueries(message, context);
  if (intelligentResponse) {
    console.log('🎯 Returning contextually intelligent response');
    return intelligentResponse;
  }

  // If no intelligent response, check company intelligence directly (before fallback)
  const companyResponse = handleCompanyIntelligence(message, context);
  if (companyResponse) {
    console.log('🏢 Returning company intelligence response');
    addToMemory(message, companyResponse, 'company_intelligence');
    return companyResponse;
  }

  // Fix typos in the message
  const correctedMessage = fixTypos(message);
  if (correctedMessage !== message) {
    console.log('✏️ Fixed typos:', message, '->', correctedMessage);
  }

  if (!genAI) {
    console.log('🔄 Using contextual fallback');
    const response = getContextualFallback(correctedMessage);
    addToMemory(correctedMessage, response, 'contextual_fallback');
    return response;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1200,
      },
    });

    const systemPrompt = createSystemPrompt(context);
    const historyBlock = history
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const fullPrompt = `${systemPrompt}

${historyBlock ? `RECENT CONVERSATION:\n${historyBlock}\n\n` : ''}User Question: ${correctedMessage}

Respond with accurate, concise markdown. Focus on Gemetra VAT refunds and Stellar/XLM. Use the user's refund data when relevant. If unsure, say so clearly.`;

    console.log('🚀 Calling Gemini...');
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage(fullPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Ultra-intelligent response received:', text?.substring(0, 100) + '...');

    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI');
    }

    addToMemory(correctedMessage, text.trim(), 'gemini_intelligent');
    return text.trim();

  } catch (error) {
    console.error('❌ AI service error:', error);
    console.log('🔄 Falling back to contextual response');

    const response = getContextualFallback(correctedMessage);
    addToMemory(correctedMessage, response, 'error_fallback');
    return response;
  }
};

export const generateCompanyInsights = (context: AIContext) => {
  const vatRefunds = context.payments.filter((p) => p.employee_id === 'vat-refund');
  const completedRefunds = vatRefunds.filter((p) => p.status === 'completed');
  const totalRefunded = completedRefunds.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalRefunds: vatRefunds.length,
    completedRefunds: completedRefunds.length,
    pendingRefunds: vatRefunds.filter((p) => p.status === 'pending').length,
    totalRefunded,
  };
};

const generateCompanyAnalytics = (context: AIContext) => {
  const { payments } = context;
  const vatRefunds = payments.filter((p) => p.employee_id === 'vat-refund');
  const completedRefunds = vatRefunds.filter((p) => p.status === 'completed');
  const pendingRefunds = vatRefunds.filter((p) => p.status === 'pending');
  const totalRefunded = completedRefunds.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = pendingRefunds.reduce((sum, p) => sum + (p.amount || 0), 0);
  const lastRefund = vatRefunds.length > 0
    ? [...vatRefunds].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;

  return {
    totalRefunds: vatRefunds.length,
    completedRefunds: completedRefunds.length,
    pendingRefunds: pendingRefunds.length,
    totalRefunded,
    pendingAmount,
    lastRefund,
    companyDescription: `Gemetra is a Stellar-powered VAT refund platform. Tourists submit purchase receipts and receive refunds settled in XLM with fast, low-cost on-chain payouts.`,
  };
};

const payrollOnlyMessage =
  'Gemetra is focused on **VAT refunds** only — payroll features have been removed. I can help with VAT claims, refund status, Stellar wallets, and XLM.';

const formatRefundHistory = (context: AIContext): string => {
  const vatRefunds = context.payments.filter((p) => p.employee_id === 'vat-refund');
  if (vatRefunds.length === 0) {
    return "You haven't submitted any VAT refund claims yet. Go to **Submit Refund** to upload your first receipt.";
  }

  const sorted = [...vatRefunds].sort(
    (a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime(),
  );

  const lines = sorted.slice(0, 10).map((p, i) => {
    const merchant = p.vat_refund_details?.merchantName || 'Unknown merchant';
    const date = new Date(p.created_at || p.payment_date).toLocaleDateString();
    const statusEmoji = p.status === 'completed' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
    return `${i + 1}. ${statusEmoji} **$${(p.amount || 0).toLocaleString()}** ${p.token || 'XLM'} — ${merchant} (${date}) — ${p.status}`;
  });

  return `🧾 **Your Refund History** (${vatRefunds.length} claim${vatRefunds.length !== 1 ? 's' : ''})\n\n${lines.join('\n')}`;
};

const formatPendingRefunds = (context: AIContext): string => {
  const pending = context.payments.filter((p) => p.employee_id === 'vat-refund' && p.status === 'pending');
  if (pending.length === 0) {
    return 'You have no pending VAT refund claims right now. All submitted claims have been processed or none have been submitted yet.';
  }

  const lines = pending.map((p, i) => {
    const merchant = p.vat_refund_details?.merchantName || 'Unknown merchant';
    const date = new Date(p.created_at || p.payment_date).toLocaleDateString();
    return `${i + 1}. ⏳ **$${(p.amount || 0).toLocaleString()}** ${p.token || 'XLM'} — ${merchant} (submitted ${date})`;
  });

  const totalPending = pending.reduce((sum, p) => sum + (p.amount || 0), 0);
  return `⏳ **Pending VAT Refunds** (${pending.length})\n\n${lines.join('\n')}\n\n**Total pending:** $${totalPending.toLocaleString()}`;
};

const handleCompanyIntelligence = (message: string, context: AIContext): string | null => {
  const analysis = analyzeMessage(message);
  const analytics = generateCompanyAnalytics(context);

  if (
    analysis.topics.includes('employees') ||
    analysis.topics.includes('salary') ||
    analysis.topics.includes('payroll') ||
    analysis.topics.includes('department') ||
    /payroll|employee|salary|staff|worker|payrun/i.test(message)
  ) {
    return payrollOnlyMessage;
  }

  if (/(thank you|thanks|thx|appreciate|great|awesome|perfect|excellent)/i.test(message) && message.length < 50) {
    return "You're welcome! Ask anytime about VAT refunds, Stellar, or XLM.";
  }

  if (/(^hi$|^hello$|^hey$|good morning|good afternoon|good evening)/i.test(message.trim())) {
    return "Hello! I'm your Gemetra AI assistant for VAT refunds on Stellar. I can help with refund status, XLM wallet questions, and live market data. What would you like to know?";
  }

  if (
    analysis.topics.includes('name') ||
    /what.*(company|business).*name/i.test(message) ||
    /company.*overview/i.test(message) ||
    /overview.*company/i.test(message) ||
    analysis.topics.includes('business_type') ||
    /what.*(company|business).*(do|does)/i.test(message)
  ) {
    return `# **Gemetra**

${analytics.companyDescription}

## 📊 **VAT Refund Stats**
- **${analytics.totalRefunds}** total claims
- **${analytics.completedRefunds}** completed refunds
- **${analytics.pendingRefunds}** pending
- **$${analytics.totalRefunded.toLocaleString()}** total refunded
- **$${analytics.pendingAmount.toLocaleString()}** pending amount`;
  }

  if (/how do vat refunds work|how does gemetra.*vat/i.test(message)) {
    return `🧾 **How VAT Refunds Work on Gemetra**

1. **Shop** as a tourist in a supported country (UAE, France, Italy, Singapore, and 50+ more).
2. **Submit** your receipt and passport details via **Submit Refund** in your dashboard.
3. **Validation** — Gemetra verifies eligibility, VAT amount, and merchant details.
4. **Payout** — approved refunds are sent to your connected Stellar wallet in **XLM**, usually within seconds after validation.

Connect **Freighter** or **Albedo** in Settings to receive payouts. Browse the **Country Index** for per-country minimum spend and document requirements.`;
  }

  if (/how long.*vat refunds? take|how long.*refund/i.test(message)) {
    return `⏱️ **VAT Refund Timelines**

- **On-chain payout:** Once validated, XLM refunds settle on Stellar in **3–5 seconds**.
- **Validation:** Receipt review typically completes within **24–48 hours** depending on document clarity and country rules.
- **End-to-end:** Most tourists receive their refund within **1–3 business days** of submitting a complete claim.

You can track each claim's status under **My Refunds** or ask me "What is the status of my VAT refunds?"`;
  }

  if (/what receipts.*need|documents.*vat claim|receipts.*vat claim/i.test(message)) {
    return `📄 **Documents for a VAT Claim**

You'll typically need:
- **Tax invoice / receipt** showing VAT paid, merchant name, and purchase date
- **Passport** (photo page) to confirm tourist status
- **Proof of export** where required (e.g. customs stamp or departure confirmation)

Requirements vary by country — check the **Country Index** for your destination's specific rules and minimum spend threshold.`;
  }

  if (/how are refunds paid|refunds paid in xlm|xlm payout|receive.*xlm.*refund/i.test(message)) {
    return `💸 **How Refunds Are Paid in XLM**

1. Connect a Stellar wallet (**Freighter** or **Albedo**) in **Settings** — this is where refunds arrive.
2. After your claim is approved, Gemetra pays you from the **platform treasury** on **Stellar mainnet** (not from your own wallet).
3. Payouts use **XLM** — Stellar's native token — so settlement is fast (~3–5 seconds) and fees are negligible (< $0.0001).
4. You can hold XLM, swap it on Stellar's built-in DEX, or transfer it to an exchange that supports Stellar deposits.

Your receiver wallet address (or connected wallet) is where treasury payouts land.`;
  }

  if (/connect.*(freighter|albedo)|how do i connect.*wallet/i.test(message)) {
    return `🔗 **Connect Freighter or Albedo**

1. Install **Freighter** (browser extension) or use **Albedo** (web wallet) if you don't have one yet.
2. Go to **Settings** in Gemetra (or click **Connect** in the navbar).
3. Choose **Freighter** or **Albedo** and approve the connection request in your wallet.
4. Your Stellar address will appear in the navbar — this is where VAT refunds in XLM are sent.

You stay connected across pages until you click **Disconnect**.`;
  }

  if (/minimum purchase|minimum spend/i.test(message)) {
    return `💰 **Minimum Purchase for VAT Refunds**

Minimum spend thresholds **vary by country**. Common examples:
- **UAE:** ~AED 250 per purchase
- **France / EU:** often €100+ per store visit
- **Singapore:** SGD 100+ including GST

Check the **Country Index** or **Explore** page for exact minimums, net refund rates, and eligible purchase types for your destination.`;
  }

  if (/what happens after.*submit|after i submit.*claim/i.test(message)) {
    return `📬 **After You Submit a Claim**

1. **Confirmation** — your claim appears under **My Refunds** with status *pending*.
2. **Review** — Gemetra validates your receipt, passport, and country-specific rules.
3. **Approval** — once approved, the refund amount is calculated and queued for payout.
4. **XLM payout** — funds are sent to your connected Stellar wallet, typically within seconds of approval.
5. **Tracking** — check **My Refunds** or ask me about status anytime.

Incomplete documents may delay review — ensure your receipt clearly shows VAT paid.`;
  }

  if (/what is stellar used for|what is stellar for/i.test(message)) {
    return `🌐 **What Stellar Is Used For**

Stellar is an open blockchain built for **moving money quickly and cheaply** across borders:
- **Cross-border payments** — banks and fintechs settle in seconds
- **Stablecoins & assets** — USDC and other tokens on Stellar
- **Micropayments** — fees under $0.0001 make small transfers viable
- **DeFi & smart contracts** — via Soroban for programmable finance

Gemetra uses Stellar to pay VAT refunds in **XLM** so tourists receive funds instantly with minimal fees.`;
  }

  if (/how fast.*stellar|stellar.*transaction.*speed|stellar.*how long/i.test(message)) {
    return `⚡ **Stellar Transaction Speed**

- **Confirmation time:** ~3–5 seconds per transaction
- **Finality:** Transactions are irreversible once confirmed in a ledger
- **Fees:** ~0.00001 XLM base fee (fraction of a cent)

This is why Gemetra settles VAT refunds on Stellar — tourists get paid almost instantly after approval.`;
  }

  if (/status of my vat refunds?|what is the status of my/i.test(message)) {
    if (analytics.totalRefunds === 0) {
      return "You don't have any VAT refund claims yet. Head to **Submit Refund** to upload your first receipt.";
    }

    let pendingDetail = '';
    if (analytics.pendingRefunds > 0) {
      const pending = context.payments.filter((p) => p.employee_id === 'vat-refund' && p.status === 'pending');
      pendingDetail =
        '\n\n**Pending claims:**\n' +
        pending
          .map((p) => `- $${(p.amount || 0).toLocaleString()} — ${p.vat_refund_details?.merchantName || 'Unknown merchant'}`)
          .join('\n');
    }

    return `📋 **Your VAT Refund Status**

- **${analytics.completedRefunds}** completed ($${analytics.totalRefunded.toLocaleString()} refunded)
- **${analytics.pendingRefunds}** pending ($${analytics.pendingAmount.toLocaleString()} awaiting payout)
- **${analytics.totalRefunds}** total claims${pendingDetail}`;
  }

  if (/show me my refund history|my refund history|refund history/i.test(message)) {
    return formatRefundHistory(context);
  }

  if (/pending vat refunds?|show me pending/i.test(message)) {
    return formatPendingRefunds(context);
  }

  const isGenericVatQuery =
    /vat refund overview|tell me about vat|what is a vat refund/i.test(message) ||
    /^(vat|refund)$/i.test(message.trim()) ||
    (analysis.topics.includes('overview') &&
      /vat|refund/i.test(message) &&
      !/history|status|pending|how|receipt|paid|long|work|last|countries/i.test(message));

  if (isGenericVatQuery) {
    return `🧾 **VAT Refund Overview**

- Total claims: **${analytics.totalRefunds}**
- Completed: **${analytics.completedRefunds}**
- Pending: **${analytics.pendingRefunds}**
- Total refunded: **$${analytics.totalRefunded.toLocaleString()}**
- Pending amount: **$${analytics.pendingAmount.toLocaleString()}**

Submit a new claim from **Submit Refund** in your dashboard. Refunds settle in **XLM on Stellar mainnet**, typically within seconds after validation.`;
  }

  if (/which countries|countries support|supported countries|where can i claim/i.test(message)) {
    return `🌍 **Supported VAT Refund Destinations**

Gemetra covers **50+ countries** with active tourist VAT refund schemes, including:

- **Middle East:** UAE, Saudi Arabia, Qatar
- **Europe:** France, Italy, Spain, Germany, UK, Netherlands, and EU members
- **Asia:** Singapore, Japan, South Korea, Thailand, Australia
- **Americas:** Argentina, Chile, Uruguay, and more

Browse the **Country Index** or **Explore** page to compare net refund rates, minimum spend, and required documents per destination.`;
  }

  if (/last.*(refund|payment)/i.test(message) || /when.*(last|recent).*(refund|payment)/i.test(message)) {
    if (!analytics.lastRefund) {
      return 'No VAT refunds have been submitted yet.';
    }
    const refundDate = new Date(analytics.lastRefund.created_at || analytics.lastRefund.payment_date || '');
    const merchant = analytics.lastRefund.vat_refund_details?.merchantName || 'Unknown merchant';
    return `🧾 **Last VAT Refund**

- **Amount:** $${analytics.lastRefund.amount?.toLocaleString()} ${analytics.lastRefund.token || 'XLM'}
- **Merchant:** ${merchant}
- **Date:** ${refundDate.toLocaleDateString()}
- **Status:** ${analytics.lastRefund.status}`;
  }

  return null;
}; 