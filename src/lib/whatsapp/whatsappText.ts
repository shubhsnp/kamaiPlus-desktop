/*
 * Words of the customer messages in English / हिंदी / मराठी (v4.79.0). Chosen per message in the
 * WhatsApp window, independent of the app's own language — the shop may run the app in English
 * and write to a customer in Marathi. Business messages (supplier, CA, owner) stay English.
 */

import type { WaLang } from './whatsappSettings';

export interface WaWords {
  invoice: string;
  estimate: string;
  customer: string;
  date: string;
  discount: string;
  total: string;
  paid: string;
  due: string;
  returned: string;
  payLink: string;
  upiId: string;
  thanks: string;
  dear: string;
  reminderFriendly: string;
  reminderFormal: string;
  reminderThanks: string;
  settled: string;
  advance: string;
  greeting: string;
  slipTitle: string;
  creditGiven: string;
  paymentReceived: string;
  note: string;
  balance: string;
  amountToPay: string;
  moreItems: string;
  methods: Record<string, string>;
}

const EN: WaWords = {
  invoice: 'INVOICE',
  estimate: 'ESTIMATE',
  customer: 'Customer',
  date: 'Date',
  discount: 'Discount',
  total: 'Total',
  paid: 'Paid',
  due: 'Balance due',
  returned: 'Returned',
  payLink: 'Pay by UPI',
  upiId: 'UPI ID',
  thanks: 'Thank you for shopping with us! Visit again 🙏',
  dear: 'Dear {name},',
  reminderFriendly: 'Your balance at {store} is {amount}. Please clear it at your convenience.',
  reminderFormal: 'This is a reminder that {amount} is outstanding on your account at {store}. Kindly clear the dues at the counter or by UPI.',
  reminderThanks: 'Thank you!',
  settled: 'Your account at {store} is fully settled. Thank you!',
  advance: 'You have an advance of {amount} with {store}.',
  greeting: 'Greetings from {store}!',
  slipTitle: 'ACCOUNT SLIP',
  creditGiven: 'Credit given (udhar)',
  paymentReceived: 'Payment received',
  note: 'Note',
  balance: 'Balance',
  amountToPay: 'Amount to pay',
  moreItems: '…and {count} more items',
  methods: { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', credit: 'Udhar', split: 'Split' },
};

const HI: WaWords = {
  invoice: 'बिल',
  estimate: 'एस्टिमेट',
  customer: 'ग्राहक',
  date: 'तारीख',
  discount: 'छूट',
  total: 'कुल',
  paid: 'भुगतान',
  due: 'बाकी रकम',
  returned: 'वापसी',
  payLink: 'UPI से भुगतान करें',
  upiId: 'UPI आईडी',
  thanks: 'हमारे यहाँ से ख़रीदारी के लिए धन्यवाद! फिर पधारें 🙏',
  dear: 'नमस्ते {name} जी,',
  reminderFriendly: '{store} पर आपका {amount} बाकी है। सुविधा अनुसार चुका दीजिए।',
  reminderFormal: 'याद दिलाना चाहते हैं कि {store} में आपके खाते पर {amount} बकाया है। कृपया काउंटर पर या UPI से भुगतान करें।',
  reminderThanks: 'धन्यवाद!',
  settled: '{store} में आपका खाता पूरा चुकता है। धन्यवाद!',
  advance: '{store} में आपका {amount} एडवांस जमा है।',
  greeting: '{store} की ओर से नमस्कार!',
  slipTitle: 'खाता पर्ची',
  creditGiven: 'उधार दिया',
  paymentReceived: 'भुगतान मिला',
  note: 'नोट',
  balance: 'बाकी',
  amountToPay: 'भुगतान राशि',
  moreItems: '…और {count} सामान',
  methods: { cash: 'नकद', upi: 'UPI', card: 'कार्ड', bank_transfer: 'बैंक ट्रांसफ़र', credit: 'उधार', split: 'मिश्रित' },
};

const MR: WaWords = {
  invoice: 'बिल',
  estimate: 'एस्टिमेट',
  customer: 'ग्राहक',
  date: 'तारीख',
  discount: 'सूट',
  total: 'एकूण',
  paid: 'भरणा',
  due: 'बाकी रक्कम',
  returned: 'परत',
  payLink: 'UPI ने पैसे भरा',
  upiId: 'UPI आयडी',
  thanks: 'आमच्याकडून खरेदी केल्याबद्दल धन्यवाद! पुन्हा भेट द्या 🙏',
  dear: 'नमस्कार {name},',
  reminderFriendly: '{store} येथे तुमची {amount} बाकी आहे. सोयीनुसार भरावी ही विनंती.',
  reminderFormal: 'आठवण करून देतो की {store} येथे तुमच्या खात्यावर {amount} थकबाकी आहे. कृपया काउंटरवर किंवा UPI ने भरणा करा.',
  reminderThanks: 'धन्यवाद!',
  settled: '{store} येथे तुमचे खाते पूर्ण भरलेले आहे. धन्यवाद!',
  advance: '{store} येथे तुमचा {amount} ॲडव्हान्स जमा आहे.',
  greeting: '{store} कडून नमस्कार!',
  slipTitle: 'खाते पावती',
  creditGiven: 'उधार दिले',
  paymentReceived: 'पैसे मिळाले',
  note: 'टीप',
  balance: 'बाकी',
  amountToPay: 'भरायची रक्कम',
  moreItems: '…आणि आणखी {count} वस्तू',
  methods: { cash: 'रोख', upi: 'UPI', card: 'कार्ड', bank_transfer: 'बँक ट्रान्सफर', credit: 'उधार', split: 'मिश्र' },
};

export const WA_WORDS: Record<WaLang, WaWords> = { en: EN, hi: HI, mr: MR };

/** "{name}" placeholders → values. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
