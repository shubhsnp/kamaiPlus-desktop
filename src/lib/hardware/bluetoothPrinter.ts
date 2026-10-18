'use client';

import { EscPosEncoder, ThermalPaperWidth } from './escpos';
import { Sale, Business } from '@/types';
import { generateUPILink } from '@/lib/utils';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { buildInvoiceDocument, getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { getLineGrossPaise, getSalePaymentBreakdown } from '@/lib/sales/saleMath';

// Standard Bluetooth Serial Port Profile (SPP) and Printer UUIDs
const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic Chinese / Sunmi POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 common
  0xff00,
  0x18f0,
];

export interface BluetoothPrinterDevice {
  id: string;
  name: string;
  connected: boolean;
}

class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'bluetooth' in navigator;
  }

  public isConnected(): boolean {
    return !!(this.device && this.device.gatt && this.device.gatt.connected && this.characteristic);
  }

  public getDeviceName(): string {
    return this.device?.name || 'Bluetooth Printer';
  }

  public getSavedPaperWidth(): ThermalPaperWidth {
    if (typeof window === 'undefined') return 58;
    try {
      const saved = localStorage.getItem('kamai_thermal_paper_width');
      return saved === '80' ? 80 : 58;
    } catch {
      return 58;
    }
  }

  public setSavedPaperWidth(width: ThermalPaperWidth): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kamai_thermal_paper_width', width.toString());
    } catch {
      // ignore
    }
  }

  public isCashDrawerEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('kamai_cash_drawer_enabled') !== 'false';
    } catch {
      return true;
    }
  }

  public setCashDrawerEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kamai_cash_drawer_enabled', enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  public isUpiQrEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('kamai_print_upi_qr') !== 'false';
    } catch {
      return true;
    }
  }

  public setUpiQrEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kamai_print_upi_qr', enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  // Request & Connect to Bluetooth ESC/POS Printer
  public async connect(): Promise<BluetoothPrinterDevice> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Windows/Mac.');
    }

    try {
      // Request device from browser modal
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_PRINTER_SERVICES,
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        console.warn('Bluetooth printer disconnected');
        this.characteristic = null;
        this.server = null;
      });

      this.server = await this.device.gatt.connect();

      // Discover writable characteristic
      const services = await this.server.getPrimaryServices();
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              break;
            }
          }
          if (this.characteristic) break;
        } catch {
          // continue checking other services
        }
      }

      if (!this.characteristic) {
        throw new Error('No writable ESC/POS characteristic found on this printer.');
      }

      return {
        id: this.device.id,
        name: this.device.name || 'Bluetooth Printer',
        connected: true,
      };
    } catch (err: any) {
      console.error('Bluetooth connection error:', err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  // Write raw bytecode in chunks (Web BLE MTU limit friendly)
  public async sendRawBytes(bytes: Uint8Array): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    // Desktop Web Bluetooth chunk write
    const CHUNK_SIZE = 512;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Small sleep between packets
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // Format and Print Sale Invoice directly via ESC/POS
  public async printSaleReceipt(
    sale: Sale,
    business: Business,
    customWidth?: ThermalPaperWidth
  ): Promise<void> {
    const width = customWidth || this.getSavedPaperWidth();
    const enc = new EscPosEncoder(width);
    const config = resolveInvoiceConfig(business);
    const upiVpa = getPrimaryUpiVpa(business);
    const doc = buildInvoiceDocument(sale, business, { config, upiVpa });
    const rs = (paise: number) => `Rs. ${(paise / 100).toFixed(2)}`;

    // 1. Kick cash drawer when cash changed hands
    const pay = getSalePaymentBreakdown(sale);
    if (pay.cash > 0 && this.isCashDrawerEnabled()) {
      enc.openCashDrawer();
    }

    // 2. Header — honours Invoice Themes (tagline / owner phone toggles, heading)
    enc.alignCenter();
    enc.doubleHeight(true).bold(true).textLine(business.name).bold(false).doubleHeight(false);
    if (config.show_tagline && business.tagline) enc.textLine(business.tagline);
    if (business.address) enc.textLine(business.address);
    if (doc.store.phoneLine) enc.textLine(doc.store.phoneLine);
    if (business.gstin) enc.textLine(`GSTIN: ${business.gstin}`);
    if (doc.store.licenseLine) enc.textLine(doc.store.licenseLine);
    enc.bold(true).textLine(doc.heading).bold(false);
    enc.hr();

    // 3. Invoice meta
    enc.alignLeft();
    enc.bold(true).textLine(`Invoice: ${sale.invoice_number}`).bold(false);
    enc.textLine(`Date: ${doc.dateText}`);
    if (sale.customer_name && sale.customer_name !== 'Cash Customer') {
      enc.textLine(`Customer: ${sale.customer_name}${sale.customer_phone ? ` (${sale.customer_phone})` : ''}`);
    }
    if (doc.billedTo.details) enc.textLine(doc.billedTo.details);
    if (doc.isB2B) enc.textLine(doc.billedTo.gstinLine);
    enc.textLine(`Payment: ${doc.payment.label.replace('● ', '')}`);
    enc.hr();

    // 4. Items
    enc.bold(true);
    if (width === 80) {
      enc.itemRow('ITEM', 'QTY x RATE', 'TOTAL');
    } else {
      enc.row('ITEM / QTY x RATE', 'TOTAL (Rs)');
    }
    enc.bold(false);
    enc.hr('-');
    sale.items.forEach((item, idx) => {
      const row = doc.rows[idx];
      const priceStr = `${row ? row.qty : item.quantity} x ${(item.unit_price / 100).toFixed(2)}`;
      // v4.180.0 (Customer Change): numbered 1) 2) 3), like the slip.
      enc.itemRow(`${idx + 1}) ${item.product_name}`, priceStr, (getLineGrossPaise(item) / 100).toFixed(2));
      const meta = [item.size ? `Size:${item.size}` : '', item.color || '', item.imei_serial ? `SN:${item.imei_serial}` : '']
        .filter(Boolean)
        .join(' ');
      if (meta) enc.textLine(`  [${meta}]`);
      if ((item.discount_amount || 0) > 0) enc.textLine(`  Disc -${(item.discount_amount / 100).toFixed(2)}`);
    });
    enc.hr('-');
    enc.bold(true);
    enc.row(`Total Items: ${doc.itemCount}`, `Qty: ${doc.totalQty}`);
    enc.bold(false);
    enc.hr('-');

    // 5. Totals
    doc.totals.forEach((t) => enc.row(t.label, t.value));
    enc.doubleHr();
    enc.bold(true).doubleHeight(true);
    enc.row('TOTAL:', rs(sale.grand_total));
    enc.doubleHeight(false).bold(false);
    enc.doubleHr();
    doc.afterTotals.forEach((t) => enc.row(t.label, t.value));
    if (doc.payment.splitText) enc.textLine(doc.payment.splitText);
    if (doc.savingsText) enc.alignCenter().bold(true).textLine(doc.savingsText).bold(false).alignLeft();

    // 6. Dynamic UPI QR — only for the shop's own saved UPI ID, never a guessed one
    if (doc.thermal.showUpi && this.isUpiQrEnabled() && sale.grand_total > 0) {
      const payable = sale.balance_due > 0 ? sale.balance_due : sale.grand_total;
      enc.feed(1);
      enc.alignCenter();
      enc.bold(true).textLine('* Scan & Pay with any UPI App *').bold(false);
      enc.qrcode(generateUPILink(doc.upi.vpa, business.name, payable, sale.invoice_number), width === 80 ? 6 : 5);
      enc.textLine(`UPI ID: ${doc.upi.vpa}`);
      enc.textLine(`Amount: ${rs(payable)}`);
    }

    // 7. Terms & footer
    enc.feed(1);
    enc.alignCenter();
    doc.terms.forEach((t) => enc.textLine(t));
    enc.bold(true).textLine(doc.footerNote || 'Thank you for your visit!').bold(false);
    enc.textLine('KamaiPlus Smart POS');

    // 8. Auto paper cut
    enc.cut();
    await this.sendRawBytes(enc.getBytes());
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();
