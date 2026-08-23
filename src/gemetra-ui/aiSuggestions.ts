export interface AISuggestionGroup {
  id: string;
  label: string;
  questions: string[];
}

export const AI_SUGGESTION_GROUPS: AISuggestionGroup[] = [
  {
    id: 'vat',
    label: 'VAT Refunds',
    questions: [
      'How do VAT refunds work on Gemetra?',
      'What is the status of my VAT refunds?',
      'How long do VAT refunds take?',
      'What receipts do I need for a VAT claim?',
      'How are refunds paid in XLM?',
      'Which countries support tourist VAT refunds?',
    ],
  },
  {
    id: 'wallet',
    label: 'Wallet & Payouts',
    questions: [
      'How do I connect Freighter or Albedo?',
      'How are refunds paid in XLM?',
      'What is the minimum purchase for a VAT refund?',
      'What happens after I submit a claim?',
    ],
  },
  {
    id: 'stellar',
    label: 'Stellar & XLM',
    questions: [
      'What is XLM?',
      'What is the current price of XLM?',
      'What is Stellar used for?',
      'How fast are Stellar transactions?',
    ],
  },
  {
    id: 'account',
    label: 'My account',
    questions: [
      'Show me my refund history',
      'When was my last VAT refund?',
      'Show me pending VAT refunds',
    ],
  },
];

export function getWelcomeSuggestions(mobile = false): string[] {
  const pick = (groupId: string, count: number) => {
    const group = AI_SUGGESTION_GROUPS.find((g) => g.id === groupId);
    return group?.questions.slice(0, count) ?? [];
  };

  if (mobile) {
    return [...pick('vat', 2), ...pick('stellar', 1)];
  }

  return [...pick('vat', 3), ...pick('wallet', 2), ...pick('stellar', 2), ...pick('account', 2)];
}

export const AI_WELCOME_MESSAGE = `Hello! I'm **Gemetra AI** — your guide for tourist VAT refunds, Stellar wallets, and XLM payouts.

I can help you with:
- **Refund claims** — documents, timelines, and payout status
- **50+ countries** — UAE, France, Italy, Singapore, and more
- **Stellar & XLM** — wallets, fees, and live market data

Pick a question below or type your own.`;
