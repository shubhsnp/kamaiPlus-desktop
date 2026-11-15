/*
 * A WhatsApp request → what the WhatsApp window shows (v4.79.0): who it goes to, the number it
 * starts with, reminder tones, whether the language can be picked, and the message builder.
 */

import type { Business, Sale } from '@/types';
import { db } from '@/lib/db';
import { getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { msg } from '@/lib/i18n/core';
import { isRestaurantMode } from '@/lib/features/featureSwitches';
import {
  billMessage, customerGreetingMessage, khataReminderMessage, ledgerSlipMessage, MessageOptions, MessageShop, paymentRequestMessage, ReminderTone,
} from './customerMessages';
import { supplierMessage } from './businessMessages';
import { getWhatsAppSettings } from './whatsappSettings';
import type { WhatsAppRequest } from './openWhatsApp';

export interface WhatsAppDraft {
  /** Message id (msg) — translated where shown. */
  title: string;
  recipientName?: string;
  phone: string;
  /** Empty number allowed: WhatsApp then asks which chat. */
  phoneOptional: boolean;
  /** A saved customer without a number: offer to save the typed one. */
  customerId?: string;
  customerHasPhone?: boolean;
  tones?: { id: ReminderTone; label: string }[];
  languages: boolean;
  /** Language, pay link and sign-off come from the window (they can change there). */
  build: (o: MessageOptions, tone: ReminderTone) => string;
  /** Bill: offer "Save the bill PDF to attach". */
  pdfSale?: Sale;
  remember?: 'owner' | 'ca';
}

export const REMINDER_TONES: { id: ReminderTone; label: string }[] = [
  { id: 'friendly', label: msg('Friendly') },
  { id: 'formal', label: msg('Formal') },
];

export function messageShop(business: Business | null | undefined): MessageShop {
  // v4.184.0: in Restaurant mode the customer messages say "Guest" / "Thank you for dining with us".
  return { name: business?.name?.trim() || 'Our store', phone: business?.phone || '', upiId: getPrimaryUpiVpa(business), dining: isRestaurantMode() };
}

export async function resolveWhatsAppDraft(request: WhatsAppRequest, business: Business | null | undefined): Promise<WhatsAppDraft | null> {
  const shop = messageShop(business);
  const settings = getWhatsAppSettings();

  switch (request.kind) {
    case 'bill': {
      const sale = request.sale;
      const customer = sale.customer_id ? await db.customers.get(sale.customer_id) : undefined;
      return {
        title: msg('Send bill on WhatsApp'),
        recipientName: sale.customer_name || customer?.name,
        phone: sale.customer_phone || customer?.phone || '',
        phoneOptional: false,
        customerId: customer?.id,
        customerHasPhone: Boolean(customer?.phone),
        languages: true,
        build: (o) => billMessage(sale, shop, o),
        pdfSale: sale,
      };
    }
    case 'khata':
    case 'customer': {
      const c = await db.customers.get(request.customerId);
      if (!c) return null;
      const who = { name: c.name, balancePaise: c.current_balance || 0 };
      const reminder = request.kind === 'khata' || who.balancePaise > 0;
      return {
        title: request.kind === 'khata' && who.balancePaise > 0 ? msg('Udhar reminder on WhatsApp') : msg('Message on WhatsApp'),
        recipientName: c.name,
        phone: c.phone || '',
        phoneOptional: false,
        customerId: c.id,
        customerHasPhone: Boolean(c.phone),
        tones: who.balancePaise > 0 ? REMINDER_TONES : undefined,
        languages: true,
        build: (o, tone) => (reminder ? khataReminderMessage(who, shop, o, tone) : customerGreetingMessage(who, shop, o)),
      };
    }
    case 'slip': {
      const c = await db.customers.get(request.entry.party_id);
      const name = c?.name || request.entry.party_name;
      return {
        title: msg('Share khata slip on WhatsApp'),
        recipientName: name,
        phone: c?.phone || '',
        phoneOptional: false,
        customerId: c?.id,
        customerHasPhone: Boolean(c?.phone),
        languages: true,
        build: (o) => ledgerSlipMessage(request.entry, name, shop, o),
      };
    }
    case 'supplier': {
      const s = await db.suppliers.get(request.supplierId);
      if (!s) return null;
      return {
        title: msg('Message supplier on WhatsApp'),
        recipientName: s.name,
        phone: s.phone || '',
        phoneOptional: false,
        languages: false,
        build: () => supplierMessage({ shop, supplierName: s.name, balancePaise: s.current_balance || 0 }),
      };
    }
    case 'payment':
      return {
        title: msg('Send payment link on WhatsApp'),
        recipientName: request.customerName,
        phone: request.phone || '',
        phoneOptional: false,
        languages: true,
        build: (o) => paymentRequestMessage(request.customerName || 'Customer', request.amountPaise, shop, o),
      };
    case 'text':
      return {
        title: request.title,
        recipientName: request.recipientName,
        // Owner reports go to the shop's own number until another one is typed and remembered.
        phone: request.phone || (request.remember === 'owner' ? settings.ownerPhone || shop.phone : request.remember === 'ca' ? settings.caPhone : '') || '',
        phoneOptional: true,
        languages: false,
        build: () => request.message,
        remember: request.remember,
      };
    default:
      return null;
  }
}
