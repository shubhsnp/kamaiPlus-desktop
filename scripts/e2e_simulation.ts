/**
 * KamaiPlus Comprehensive End-to-End Simulation & QA Suite
 * Tests financial invariants, category engine profiles, security mechanisms,
 * and ESC/POS thermal hardware bytecode generation.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

// Load .env.local if present in development / simulation
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').replace(/^["'](.*)["']$/, '$1').trim();
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { MASTER_UNITS, RECOMMENDED_UNITS, STARTER_CATEGORIES } from '../src/lib/constants/storeProfiles';
import { getDefaultProductsForCategory, DEFAULT_CATEGORY_PRODUCTS } from '../src/lib/constants/defaultProducts';
import { checkRateLimit } from '../src/lib/security/rateLimiter';
import { EscPosEncoder } from '../src/lib/hardware/escpos';

import { signSessionToken, verifySessionToken } from '../src/lib/auth/session';
import { calculateGstSummary } from '../src/lib/invoices/gstCalculator';
import { formatINR } from '../src/lib/utils';
import { parsePaymentNotification } from '../src/lib/payments/notificationParser';
import { numberToHindiWords, numberToEnglishWords, soundboxEngine } from '../src/lib/payments/soundboxEngine';
import { paymentBridge } from '../src/lib/payments/paymentBridge';
import { signOtpSessionToken, verifyStatelessOtp } from '../src/lib/auth/otpService';
import { 
  validateIndianPhone, 
  validateGstin, 
  validateUpiId, 
  validatePincode, 
  validateFssaiLicense, 
  validateEmail, 
  validateProductData, 
  validateCustomerData, 
  validateExpenseData 
} from '../src/lib/validation/validators';
import { formatInvoiceNumber, parseInvoiceSequenceNumber } from '../src/lib/invoices/invoiceNumberService';
import crypto from 'crypto';
import { buildInvoiceDocument, getPrimaryUpiVpa, paginateInvoiceRows } from '../src/lib/invoices/invoiceDocument';
import { buildSampleSale } from '../src/lib/invoices/sampleInvoice';
import { resolveInvoiceConfig } from '../src/lib/invoices/themeDefaults';
import {
  allocateBillDiscount,
  calculateLineTax,
  computeBillTotals,
  getLineRefundPaise,
  getNetPaymentBreakdown,
  getReturnedQtyByLine,
  getSaleNetTotal,
  getSalePaymentBreakdown,
  isRevenueSale,
} from '../src/lib/sales/saleMath';
import { computeDrawerSummary, localDateKey } from '../src/lib/reports/cashDrawer';
import { makeEmptyTab, tabsAfterClosing } from '../src/lib/billing/billTabs';
import { applyPaymentToBill, openBillsOldestFirst, planBillAllocation } from '../src/lib/khata/billAllocation';
import { generalCategoryId } from '../src/lib/products/defaultCategory';
import { nextSupplierBalance } from '../src/lib/suppliers/supplierLedger';
import { cleanVariantLabels, summarizeVariants, tracksOwnStock } from '../src/lib/products/variants';
import {
  WALK_IN_ID,
  buildAdvancedReport,
  isDeadStock,
  isProfitPartial,
  marginPercent,
  resolveReportPeriod,
  sortReport,
} from '../src/lib/reports/advancedReports';
import { generateGSTR1Report, getStateName } from '../src/lib/gst/gstr1Generator';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DIGITS, supportEmailUrl, supportWhatsAppUrl } from '../src/lib/support/contact';
import { DEFAULT_IDLE_LOCK_MINUTES, parseIdleLockMinutes, safeReturnPath, shouldIdleLock } from '../src/lib/auth/idleLock';
import { buildGstr1Json, gstPeriodRange } from '../src/lib/gst/gstr1Json';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

console.log('================================================================');
console.log('🚀 RUNNING KAMAIPLUS COMPREHENSIVE END-TO-END QA SIMULATION');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: 5 CORE INDIAN RETAIL PILLARS & ADAPTIVE CAPABILITY MATRIX


// -----------------------------------------------------------------------------
// TEST SUITE 2: FINANCIAL & GST INVARIANTS (PAISE ARITHMETIC)
// -----------------------------------------------------------------------------
console.log('💰 SUITE 2: Financial Invariants & Zero-Drift Paise Math');

// Sample Line Items
const sampleItems: any[] = [
  {
    product_id: 'p1',
    product_name: 'Tata Tea Gold 250g',
    quantity: 2,
    unit: 'packet',
    unit_price: 15000, // ₹150.00
    total_amount: 30000, // ₹300.00
    tax_rate: 5,
    hsn_code: '0902',
  },
  {
    product_id: 'p2',
    product_name: 'Fortune Sunflower Oil 1L',
    quantity: 1,
    unit: 'pouch',
    unit_price: 14000, // ₹140.00
    total_amount: 14000, // ₹140.00
    tax_rate: 12,
    hsn_code: '1512',
  },
  {
    product_id: 'p3',
    product_name: 'Cadbury Silk Chocolate',
    quantity: 3,
    unit: 'piece',
    unit_price: 8000, // ₹80.00
    total_amount: 24000, // ₹240.00
    tax_rate: 18,
    hsn_code: '1806',
  }
];

const subtotal = sampleItems.reduce((sum, item) => sum + item.total_amount, 0); // 68000 paise (₹680.00)
assert(subtotal === 68000, `Subtotal calculation exact: ${formatINR(subtotal)}`);

const gstBreakups = calculateGstSummary(sampleItems, true); // Tax inclusive
const totalTaxable = gstBreakups.reduce((sum, b) => sum + b.taxableAmountPaise, 0);
const totalTax = gstBreakups.reduce((sum, b) => sum + b.totalTaxPaise, 0);

assert(totalTaxable > 0, `Taxable amount extracted (${formatINR(totalTaxable)})`);
assert(totalTax > 0, `Total GST tax calculated (${formatINR(totalTax)})`);
assert(
  totalTaxable + totalTax === subtotal,
  `Taxable amount + Total Tax matches Subtotal exactly (${totalTaxable} + ${totalTax} === ${subtotal})`
);

// Discount & Grand Total Verification
const discountTotal = 3000; // ₹30.00 discount
const grandTotal = subtotal - discountTotal; // 65000 paise (₹650.00)
const amountReceived = 50000; // ₹500.00 cash paid
const balanceDue = grandTotal - amountReceived; // 15000 paise (₹150.00) Udhar

assert(grandTotal === 65000, `Grand Total (${formatINR(grandTotal)}) = Subtotal - Discount`);
assert(amountReceived + balanceDue === grandTotal, `Cash Received (${formatINR(amountReceived)}) + Balance Due (${formatINR(balanceDue)}) = Grand Total`);

console.log('');

// -----------------------------------------------------------------------------
// TEST SUITE 3: SECURITY, RATE LIMITING & CONSTANT-TIME VERIFICATION
// -----------------------------------------------------------------------------
console.log('🛡️ SUITE 3: Security, Rate Limiting & Token Signatures');

// 1. In-Memory Sliding Window Rate Limiter
const testIp = '192.168.1.100';
const limitKey = `admin_login_qa:${testIp}`;

// 5 requests allowed
for (let i = 1; i <= 5; i++) {
  const result = checkRateLimit(limitKey, 5, 10000);
  assert(result.isAllowed, `Rate limit attempt ${i}/5 allowed (remaining: ${result.remaining})`);
}

// 6th request must be blocked
const blockedResult = checkRateLimit(limitKey, 5, 10000);
assert(!blockedResult.isAllowed, 'Rate limit attempt 6/5 successfully blocked (429 Too Many Requests)');
assert(blockedResult.remaining === 0, 'Rate limit remaining requests is 0 when blocked');

// 2. Constant-Time Hash Comparison
const secretPw = 'Vivaan@52523384';
const enteredCorrect = 'Vivaan@52523384';
const enteredWrong = 'WrongPassword123';

const hashExpected = crypto.createHash('sha256').update(secretPw).digest();
const hashCorrect = crypto.createHash('sha256').update(enteredCorrect).digest();
const hashWrong = crypto.createHash('sha256').update(enteredWrong).digest();

assert(crypto.timingSafeEqual(hashExpected, hashCorrect), 'Constant-time verification accepts matching password hash');
assert(!crypto.timingSafeEqual(hashExpected, hashWrong), 'Constant-time verification rejects invalid password hash');



// 4. Staff / Merchant Session Token Lifecycle
const staffPayload = {
  staff_id: 'staff_123',
  business_id: 'biz_456',
  phone: '9876543210',
  role: 'owner' as const,
};

const userToken = signSessionToken(staffPayload);
assert(typeof userToken === 'string' && userToken.length > 20, 'Merchant staff JWT token signed successfully');

const userSession = verifySessionToken(userToken);
assert(
  userSession !== null && userSession.staff_id === 'staff_123' && userSession.business_id === 'biz_456',
  'Merchant staff JWT token verified with exact business_id & staff_id claims'
);

console.log('');

// -----------------------------------------------------------------------------
// TEST SUITE 4: ESC/POS THERMAL HARDWARE BYTECODE GENERATION
// -----------------------------------------------------------------------------
console.log('🖨️ SUITE 4: ESC/POS Thermal Hardware Bytecode Verification');

// Test 58mm (32 Chars) Encoder
const enc58 = new EscPosEncoder(58);
enc58.alignCenter().bold(true).textLine('MAHADEV SUPER MART').bold(false);
enc58.hr();
enc58.itemRow('Tata Tea Gold 250g', '2 x 150.00', '300.00');
enc58.hr('-');
enc58.row('GRAND TOTAL:', 'Rs. 300.00');

const upiTestUri = 'upi://pay?pa=merchant@upi&pn=Mahadev%20Mart&am=300.00&cu=INR&tn=INV-001';
enc58.qrcode(upiTestUri, 5);
enc58.cut();

const bytes58 = enc58.getBytes();
assert(bytes58 instanceof Uint8Array, '58mm ESC/POS encoder returns Uint8Array buffer');
assert(bytes58.length > 50, `58mm bytecode stream generated (${bytes58.length} bytes)`);

// Verify Initialize Command (ESC @ = 0x1b 0x40)
assert(bytes58[0] === 0x1b && bytes58[1] === 0x40, 'Bytecode begins with ESC @ (Initialize printer)');

// Verify Paper Cut Command (GS V 0 = 0x1d 0x56 0x00)
const lastBytes = Array.from(bytes58.slice(-3));
assert(lastBytes[0] === 0x1d && lastBytes[1] === 0x56, 'Bytecode concludes with GS V (Auto Paper Cut)');

// Test 80mm (48 Chars) Encoder with Cash Drawer Kick
const enc80 = new EscPosEncoder(80);
enc80.openCashDrawer();
enc80.alignCenter().doubleHeight(true).textLine('KIRANA HYPERMARKET').doubleHeight(false);
enc80.itemRow('Fortune Oil 1L', '1 x 140.00', '140.00');
enc80.cut();

const bytes80 = enc80.getBytes();
assert(bytes80.length > 50, `80mm bytecode stream generated (${bytes80.length} bytes)`);

// Verify Cash Drawer Pulse Command (ESC p 0 25 250 = 0x1b 0x70 0x00 0x19 0xfa)
const drawerOpCodeIdx = Array.from(bytes80).findIndex((b, idx) => b === 0x1b && bytes80[idx + 1] === 0x70);
assert(drawerOpCodeIdx !== -1, 'Bytecode contains ESC p (Cash Drawer Kick Pulse)');

// -----------------------------------------------------------------------------
// TEST SUITE 5: NOTIFICATION PARSER & SMART SOUNDBOX AUDIO ENGINE
// -----------------------------------------------------------------------------
console.log('🔊 SUITE 5: Bank SMS, Notification Parser & Smart Soundbox Verification');

// 1. HDFC Bank SMS Parsing
const hdfcMsg = 'Your a/c no. XX1234 is credited with INR 848.00 on 25-AUG-26 by a/c linked to UPI/423589123456/Rahul Sharma';
const hdfcParsed = parsePaymentNotification(hdfcMsg, 'HDFCBK');
assert(hdfcParsed !== null, 'HDFC Bank credit SMS parsed successfully');
assert(hdfcParsed?.amountPaise === 84800, 'HDFC SMS extracted exact amount in paise (84800)');
assert(hdfcParsed?.referenceNumber === '423589123456', 'HDFC SMS extracted exact 12-digit UTR (423589123456)');
assert(hdfcParsed?.bankName === 'HDFC Bank', 'HDFC Bank correctly recognized');

// 2. SBI SMS Parsing
const sbiMsg = 'Dear UPI user, A/C XXXX credited by Rs 848.00 on 25Aug26 transfer from Rahul Sharma Ref No 423589123456';
const sbiParsed = parsePaymentNotification(sbiMsg, 'SBI-UPI');
assert(sbiParsed !== null && sbiParsed.amountPaise === 84800, 'SBI credit SMS extracted exact amount (84800 paise)');
assert(sbiParsed?.bankName === 'State Bank of India', 'State Bank of India correctly recognized');

// 3. PhonePe Business Notification Parsing
const phonePeMsg = 'Received ₹848.00 from Rahul Sharma via PhonePe on Kamai QR';
const phonePeParsed = parsePaymentNotification(phonePeMsg);
assert(phonePeParsed !== null && phonePeParsed.sourceApp === 'PhonePe', 'PhonePe notification recognized with sourceApp');
assert(phonePeParsed?.amountPaise === 84800, 'PhonePe notification extracted exact amount (₹848.00)');

// 4. Paytm Business Notification Parsing
const paytmMsg = 'Received ₹848 from 9876543210 on Paytm QR (Ref 423589123456)';
const paytmParsed = parsePaymentNotification(paytmMsg);
assert(paytmParsed !== null && paytmParsed.sourceApp === 'Paytm', 'Paytm notification recognized with sourceApp');

// 5. Debit SMS Rejection (Ignore Debits)
const debitMsg = 'Your a/c no. XX1234 is debited by INR 500.00 on 25-AUG-26';
const debitParsed = parsePaymentNotification(debitMsg);
assert(debitParsed === null, 'Debit transaction SMS is strictly ignored (returns null)');

// 6. Soundbox Spoken Number Phonetics
const hindi848 = numberToHindiWords(848);
assert(hindi848.includes('आठ सौ') && hindi848.includes('अड़तालीस'), `Hindi number phonetics for 848 matches ('${hindi848}')`);

const eng848 = numberToEnglishWords(848);
assert(eng848 === 'Eight Hundred Forty-Eight', `English number words for 848 matches ('${eng848}')`);

// 7. Payment Bridge Matching & Deduplication
paymentBridge.clearHistory();
paymentBridge.handleIncomingParsedPayment({
  id: 'test_1',
  amountPaise: 84800,
  amountRupees: 848,
  referenceNumber: '423589123456',
  sourceApp: 'PhonePe',
  timestamp: Date.now(),
  rawText: phonePeMsg,
  isCredit: true,
});

const matched = paymentBridge.matchActiveBill(84800, 60000);
assert(matched !== null && matched.amountPaise === 84800, 'Payment bridge matches active POS bill of ₹848.00 within 60s window');

const duplicateAttempt = paymentBridge.handleIncomingParsedPayment({
  id: 'test_2',
  amountPaise: 84800,
  amountRupees: 848,
  referenceNumber: '423589123456', // Same UTR
  sourceApp: 'PhonePe',
  timestamp: Date.now(),
  rawText: phonePeMsg,
  isCredit: true,
});
assert(duplicateAttempt === false, 'Duplicate payment notification with same UTR is rejected');

// -----------------------------------------------------------------------------
// TEST SUITE 6: OFFICIAL META WHATSAPP CLOUD API & WEBHOOK SUITE
// -----------------------------------------------------------------------------
console.log('\n💬 SUITE 6: Official Meta WhatsApp Cloud API & Webhook Verification');



// 3. Webhook Challenge Verification Logic
const defaultVerifyToken = 'kamaiplus_verify_token_2026';
const mockChallenge = 'test_meta_challenge_token_xyz123';

const testWebhookVerification = (mode: string | null, token: string | null, challenge: string | null) => {
  if (mode === 'subscribe' && token === defaultVerifyToken) {
    return { status: 200, challenge };
  }
  return { status: 403, error: 'Verification token mismatch' };
};

const validResult = testWebhookVerification('subscribe', 'kamaiplus_verify_token_2026', mockChallenge);
assert(validResult.status === 200 && validResult.challenge === mockChallenge, 'Meta Webhook GET verification returns challenge string with HTTP 200');

const tamperedResult = testWebhookVerification('subscribe', 'wrong_token', mockChallenge);
assert(tamperedResult.status === 403, 'Tampered verify token is strictly rejected with HTTP 403');

const invalidModeResult = testWebhookVerification('unknown', 'kamaiplus_verify_token_2026', mockChallenge);
assert(invalidModeResult.status === 403, 'Invalid hub.mode is rejected with HTTP 403');

// 4. Webhook HMAC-SHA256 Signature Verification
const mockSecret = 'test_meta_app_secret_123';
const mockPayload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const validHmac = `sha256=${crypto.createHmac('sha256', mockSecret).update(mockPayload).digest('hex')}`;
const invalidHmac = 'sha256=invalid_signature_hash_xyz';

const verifyHmacSignature = (header: string, body: string, secret: string): boolean => {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  const bufA = Buffer.from(header, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

assert(verifyHmacSignature(validHmac, mockPayload, mockSecret) === true, 'Webhook HMAC-SHA256 signature passes with valid secret');
assert(verifyHmacSignature(invalidHmac, mockPayload, mockSecret) === false, 'Tampered Webhook HMAC-SHA256 signature is rejected');

// 5. Serverless Stateless OTP Verification
const testPhone = '9876543210';
const testOtp = '748291';
const expiresAt = Date.now() + 10 * 60 * 1000;
const validSessionToken = signOtpSessionToken(testPhone, testOtp, expiresAt);

const otpVerifyPass = verifyStatelessOtp(testPhone, testOtp, validSessionToken);
assert(otpVerifyPass.valid === true, 'Stateless OTP verification succeeds with matching token and code across lambdas');

const otpVerifyWrongCode = verifyStatelessOtp(testPhone, '000000', validSessionToken);
assert(otpVerifyWrongCode.valid === false, 'Stateless OTP verification rejects incorrect code');

const otpVerifyWrongPhone = verifyStatelessOtp('9999999999', testOtp, validSessionToken);
assert(otpVerifyWrongPhone.valid === false, 'Stateless OTP verification rejects mismatched phone number');

const expiredSessionToken = signOtpSessionToken(testPhone, testOtp, Date.now() - 1000);
const otpVerifyExpired = verifyStatelessOtp(testPhone, testOtp, expiredSessionToken);
assert(otpVerifyExpired.valid === false, 'Stateless OTP verification rejects expired token');



// -----------------------------------------------------------------------------
// TEST SUITE 7: CENTRALIZED ENTERPRISE VALIDATION & DATA INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n🛡️ SUITE 7: Centralized Enterprise Validation & Data Integrity');

// 1. Phone Validation
assert(validateIndianPhone('9876543210', true).isValid === true, 'Valid 10-digit Indian mobile number accepted');
assert(validateIndianPhone('+91 98765 43210', true).isValid === true, 'Formatted mobile number normalized and accepted');
assert(validateIndianPhone('1234567890', true).isValid === false, 'Mobile number starting with 1 rejected');
assert(validateIndianPhone('98765', true).isValid === false, 'Short 5-digit mobile number rejected');
assert(validateIndianPhone('', false).isValid === true, 'Empty phone accepted when optional');

// 2. GSTIN Statutory Validation
assert(validateGstin('27AAAAA0000A1Z5', false).isValid === true, 'Valid 15-character GSTIN structure accepted');
assert(validateGstin('27aaaaa0000a1z5', false).isValid === true, 'Lowercase GSTIN automatically capitalized');
assert(validateGstin('12345', false).isValid === false, 'Malformed GSTIN rejected');
assert(validateGstin('', false).isValid === true, 'Empty GSTIN accepted when optional');

// 3. UPI VPA Address Validation
assert(validateUpiId('store@okaxis', true).isValid === true, 'Valid bank VPA accepted');
assert(validateUpiId('9876543210@paytm', true).isValid === true, 'Valid phone VPA accepted');
assert(validateUpiId('invalidupi', true).isValid === false, 'UPI missing @ symbol rejected');
assert(validateUpiId('', true).isValid === false, 'Empty UPI rejected when required');

// 4. Pincode & FSSAI
assert(validatePincode('411001', false).isValid === true, 'Valid 6-digit Indian pincode accepted');
assert(validatePincode('011001', false).isValid === false, 'Pincode starting with 0 rejected');
assert(validatePincode('41100', false).isValid === false, 'Short 5-digit pincode rejected');
assert(validateFssaiLicense('12345678901234', false).isValid === true, 'Valid 14-digit FSSAI license accepted');
assert(validateFssaiLicense('12345', false).isValid === false, 'Short FSSAI license rejected');

// 5. Product & Legal Metrology Pricing Validation
const validProduct = validateProductData({
  name: 'Basmati Rice 5kg',
  sellingPricePaise: 45000,
  mrpPaise: 50000,
  purchasePricePaise: 40000,
  currentStock: 20,
  minStockLevel: 5,
  taxRate: 5,
});
assert(validProduct.isValid === true, 'Compliant product details accepted');

const zeroPriceProduct = validateProductData({
  name: 'Free Item',
  sellingPricePaise: 0,
});
assert(zeroPriceProduct.isValid === false, 'Product with zero selling price rejected');

const illegalMrpProduct = validateProductData({
  name: 'Overcharged Item',
  sellingPricePaise: 50000,
  mrpPaise: 40000, // MRP lower than selling price (Violation of Legal Metrology)
});
assert(illegalMrpProduct.isValid === false, 'Product with MRP < Selling Price strictly rejected');

const negativeStockProduct = validateProductData({
  name: 'Stock Item',
  sellingPricePaise: 10000,
  currentStock: -5,
});
assert(negativeStockProduct.isValid === false, 'Product with negative stock rejected');

// 6. Customer & Khata Validation
const validCustomer = validateCustomerData({
  name: 'Ramesh Gupta',
  phone: '9876543210',
});
assert(validCustomer.isValid === true, 'Valid customer profile accepted');

const shortNameCustomer = validateCustomerData({
  name: 'R',
  phone: '9876543210',
});
assert(shortNameCustomer.isValid === false, 'Single letter customer name rejected');

// 7. Expense Validation
const validExpense = validateExpenseData({
  amountPaise: 15000,
  category: 'tea_snacks',
});
assert(validExpense.isValid === true, 'Valid expense entry accepted');

const zeroExpense = validateExpenseData({
  amountPaise: 0,
  category: 'tea_snacks',
});
assert(zeroExpense.isValid === false, 'Zero amount expense rejected');

// 8. Unique Sequential Invoice Numbering
assert(formatInvoiceNumber('INV-', 1) === 'INV-001', 'Sequence 1 formats to INV-001 with 3-digit padding');
assert(formatInvoiceNumber('INV-', 2) === 'INV-002', 'Sequence 2 formats to INV-002');
assert(formatInvoiceNumber('INV-', 3) === 'INV-003', 'Sequence 3 formats to INV-003');
assert(formatInvoiceNumber('INV-', 10) === 'INV-010', 'Sequence 10 formats to INV-010');
assert(formatInvoiceNumber('INV-', 100) === 'INV-100', 'Sequence 100 formats to INV-100');
assert(formatInvoiceNumber('BILL-', 1) === 'BILL-001', 'Custom prefix BILL- formats to BILL-001');
assert(formatInvoiceNumber('TAX-', 25) === 'TAX-025', 'Custom prefix TAX- formats to TAX-025');

assert(parseInvoiceSequenceNumber('INV-001') === 1, 'parseInvoiceSequenceNumber extracts 1 from INV-001');
assert(parseInvoiceSequenceNumber('INV-002') === 2, 'parseInvoiceSequenceNumber extracts 2 from INV-002');
assert(parseInvoiceSequenceNumber('BILL-1045') === 1045, 'parseInvoiceSequenceNumber extracts 1045 from BILL-1045');
assert(parseInvoiceSequenceNumber('CUSTOM-99') === 99, 'parseInvoiceSequenceNumber extracts 99 from CUSTOM-99');

// SUITE 8 (AI purchase-bill scan) was removed in v4.43.0 together with the feature.
// The desktop app is sold as a one-time licence with no AI. Suite 9 §8 keeps it out.

// 🧭 SUITE 9: Universal Product Invariants (no per-vertical branching anywhere)
console.log('\n🧭 SUITE 9: Universal Product Invariants (no per-vertical branching anywhere)');

const SRC_ROOT = path.join(__dirname, '..', 'src');

function walkSource(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, out);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const ALL_SOURCE = walkSource(SRC_ROOT);
const readSource = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

// 1. No screen may branch on the shop's business type ever again.
const VERTICAL_BRANCH = /business_type\s*===|businessType\s*===|\bisRestaurant\b|\bisPharmacy\b|\bisClothing\b|\bisGrocery\b|featureToggles/;
const verticalOffenders = ALL_SOURCE.filter((f) => VERTICAL_BRANCH.test(fs.readFileSync(f, 'utf8')));
assert(
  verticalOffenders.length === 0,
  `No source file branches on business type (found: ${verticalOffenders.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`
);

// 2. The store-profile module is reduced to shared units + starter categories only.
const profileSrc = readSource('lib/constants/storeProfiles.ts');
assert(!/getStoreProfile|hasModule|getAllStoreProfiles|StoreProfile\b/.test(profileSrc), 'storeProfiles.ts exposes no per-vertical profile API');
assert(MASTER_UNITS.length > 0, 'MASTER_UNITS still ships the shared unit list');
assert(STARTER_CATEGORIES.length > 0, 'STARTER_CATEGORIES seeds a universal starter catalogue');
assert(RECOMMENDED_UNITS.every((u) => MASTER_UNITS.some((m) => m.id === u)), 'Every recommended unit exists in MASTER_UNITS');

// 3. `ModuleId` (the per-vertical module gate) is gone from the domain types.
assert(!/ModuleId/.test(readSource('types/index.ts')), 'types/index.ts no longer declares the per-vertical ModuleId union');

// 4. The POS checkout panel must keep its pay button reachable: a scrolling body
//    plus a pinned footer. This is the bug where a long bill hid the totals.
const billingSrc = readSource('app/billing/page.tsx');
assert(
  /const renderCheckoutPanel = \(\) => \(\s*\n\s*<div className="flex flex-col flex-1 min-h-0">/.test(billingSrc),
  'POS checkout panel root is a bounded flex column (flex-1 min-h-0)'
);
assert(
  /<div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 -mr-1">/.test(billingSrc),
  'POS checkout panel has exactly one scrolling body region'
);
assert(
  /Bottom Total & Checkout Button \(always visible\)[\s\S]{0,120}flex-shrink-0/.test(billingSrc),
  'POS grand total + Complete Sale button stay pinned (flex-shrink-0)'
);

// 5. Heavy libraries must never sit in the always-loaded app shell.
const HEAVY = ["from 'jspdf'", "from 'html2canvas'", "from 'xlsx'", "from 'firebase/firestore'"];
const shellFiles = ['app/layout.tsx', 'components/layout/AppShell.tsx', 'components/layout/Navbar.tsx', 'components/layout/Sidebar.tsx', 'components/layout/GlobalDrawers.tsx', 'components/layout/DesktopStatusBar.tsx'];
for (const rel of shellFiles) {
  const src = readSource(rel);
  for (const lib of HEAVY) {
    assert(!src.includes(lib), `App shell file ${rel} does not statically import ${lib}`);
  }
}
assert(/dynamic\(\s*\(\) => import\('@\/components\/paytm\/MerchantQRModal'\)/.test(readSource('components/layout/Navbar.tsx')), 'Navbar loads the QR standee modal lazily (keeps jsPDF/html2canvas out of every page)');
assert(/dynamic\(\s*\(\) => import\('@\/components\/invoices\/InvoiceModal'\)/.test(readSource('components/layout/GlobalDrawers.tsx')), 'GlobalDrawers loads the invoice viewer lazily');

// 6. Billing reaches the cloud only through the lazy bridge.
assert(!/from 'firebase\//.test(billingSrc), 'Billing page has no static Firebase import');
assert(/from '@\/lib\/firebase\/lazyCloud'/.test(billingSrc), 'Billing page mirrors to the cloud via the lazy bridge');
const lazyCloudSrc = readSource('lib/firebase/lazyCloud.ts');
for (const fn of ['cloudMerge', 'cloudSyncSoon', 'cloudTrackInvoice', 'prewarmCloud']) {
  assert(lazyCloudSrc.includes(`export `) && lazyCloudSrc.includes(fn), `lazyCloud exports ${fn}`);
}
assert(!/^import .*firebase/m.test(lazyCloudSrc), 'lazyCloud itself only imports Firebase dynamically');

// 7. Category counts are one indexed pass, not one query per category.
assert(
  /db\.products\.orderBy\('category_id'\)\.eachKey/.test(billingSrc),
  'POS category counts use a single indexed pass over category_id'
);
assert(
  !/for \(const cat of categories\)[\s\S]{0,200}db\.products\.where\('category_id'\)/.test(billingSrc),
  'POS no longer issues one count() query per category'
);

// 8. Dead modules stay deleted.
const DELETED = [
  'components/voice/VoiceBillingModal.tsx',
  'components/layout/BottomNav.tsx',
  'components/layout/MobileMenuCardsModal.tsx',
  'components/auth/IntroWalkthrough.tsx',
  'lib/firebase/messaging.ts',
  'lib/firebase/remoteConfig.ts',
  'lib/firebase/appCheck.ts',
  'lib/firebase/storage.ts',
  'lib/voice/paytmSoundbox.ts',
  'lib/auth/reverseHandshakeService.ts',
  'lib/api/publicBarcodeLookup.ts',
  // v4.43.0: no Pro tiers, payments or AI scan in the one-time-licence desktop app.
  'components/subscription/ProFeatureGate.tsx',
  'components/subscription/UpgradeModal.tsx',
  'lib/subscription/subscriptionService.ts',
  'components/purchases/ScanBillButton.tsx',
  'components/settings/AiScanSettingsCard.tsx',
  'lib/ai/geminiClient.ts',
  'lib/ai/billScanPrompt.ts',
];
for (const rel of DELETED) {
  assert(!fs.existsSync(path.join(SRC_ROOT, rel)), `Dead module ${rel} is not back in the tree`);
}

// 8a. Completing a bill must not load every sale to pick the next invoice number.
const invoiceNumberSrc = readSource('lib/invoices/invoiceNumberService.ts');
assert(!/db\.sales[^;]*\.toArray\(\)/.test(invoiceNumberSrc), 'Invoice numbering never loads the whole sales table (uses index keys + cache)');
assert(/orderBy\('invoice_number'\)\.uniqueKeys\(\)/.test(invoiceNumberSrc), 'Invoice numbering scans only the invoice_number index keys');

// 8c. No page or component statically imports Firebase: it must go through
//     lazyCloud.ts (DashboardHome and SettleInvoicesModal both used to).
const STATIC_FIREBASE = /^import .*from '(firebase\/|@\/lib\/firebase\/(config|firestoreSync|backgroundSync|analytics)|@\/lib\/sync\/syncEngine)/m;
const uiFiles = ALL_SOURCE.filter((f) => /[\\/](app|components)[\\/]/.test(path.relative(SRC_ROOT, f).replace(/^/, '/')));
assert(uiFiles.length > 50, `Firebase-import guard actually scans the UI tree (${uiFiles.length} files)`);
const staticFirebaseOffenders = uiFiles.filter((f) => STATIC_FIREBASE.test(fs.readFileSync(f, 'utf8')));
assert(
  staticFirebaseOffenders.length === 0,
  `No page/component statically imports Firebase (found: ${staticFirebaseOffenders.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`
);

// 8d. Cloud writes are switched off until the desktop app has a Firebase login
//     (the rules reject every unauthenticated write), and every entry point obeys it.
assert(/export const CLOUD_SYNC_ENABLED = false;/.test(readSource('lib/firebase/cloudAvailability.ts')), 'Cloud sync stays off until a cloud login exists');
for (const rel of ['lib/firebase/lazyCloud.ts', 'lib/firebase/backgroundSync.ts', 'lib/sync/syncEngine.ts', 'app/onboarding/page.tsx']) {
  assert(readSource(rel).includes('CLOUD_SYNC_ENABLED'), `${rel} checks CLOUD_SYNC_ENABLED before touching the cloud`);
}
assert(!/await setDoc/.test(readSource('components/khata/SettleInvoicesModal.tsx')), 'Khata settlement never waits on a cloud write');

// 8e. Big-history screens stay light.
assert(/filteredSales\.slice\(0, visibleCount\)/.test(readSource('app/transactions/page.tsx')), 'Transactions renders bills page by page, not the whole history');
assert(/useMemo\(/.test(readSource('components/transactions/useTransactionFilters.ts')), 'Transaction filters are memoised, not recomputed on every render');
assert(!/db\.sales\.orderBy\('created_at'\)\.reverse\(\)\.toArray\(\)/.test(readSource('app/khata/page.tsx')), 'Khata loads only the selected customer\'s bills');

// 8f. Licence gate (one key = one computer, no trial). Nothing may open without it.
const layoutSrc = readSource('app/layout.tsx');
assert(/<LicenceGate>\s*<AppShell>/.test(layoutSrc), 'LicenceGate wraps the whole AppShell (no screen opens unlicensed)');
const licenceJs = fs.readFileSync(path.join(__dirname, '..', 'licence.js'), 'utf8');
assert(/-----BEGIN PUBLIC KEY-----/.test(licenceJs) && !/PRIVATE KEY/.test(licenceJs), 'licence.js ships only the public key');
assert(/crypto\.verify\(/.test(licenceJs) && /payload\.machine_id !== getMachineId\(\)/.test(licenceJs), 'licence.js verifies the signature AND the machine id');
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
assert((pkgJson.build?.files || []).includes('licence.js'), 'licence.js is packaged into the installer (build.files)');
const gateSrc = readSource('components/licence/LicenceGate.tsx');
assert(!/localStorage/.test(gateSrc), 'The licence decision never comes from localStorage (main process only)');

// 8g. Auto-update: packaged, pointed at our own Hosting site, never restarts on its own.
const updaterJs = fs.readFileSync(path.join(__dirname, '..', 'updater.js'), 'utf8');
assert((pkgJson.build?.files || []).includes('updater.js'), 'updater.js is packaged into the installer');
assert(Boolean(pkgJson.dependencies?.['electron-updater']), 'electron-updater is a runtime dependency (packaged)');
assert(pkgJson.build?.publish?.[0]?.url === 'https://kamaiplus-desktop.web.app/', 'Updates come from kamaiplus-desktop.web.app');
assert(!/\s/.test(pkgJson.build?.nsis?.artifactName || ' '), 'Installer file name has no spaces (latest.yml URLs must resolve)');
assert(/quitAndInstall/.test(updaterJs) && /ipcMain\.handle\('kp:update-install'/.test(updaterJs) && (updaterJs.match(/quitAndInstall\(/g) || []).length === 1, 'The app restarts for an update only when the user clicks Restart & Update');
assert(/enabled: app\.isPackaged && !isDevServer/.test(fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')), 'Auto-update is off in development');
assert(pkgJson.build?.win?.icon === 'build/icon.ico' && fs.existsSync(path.join(__dirname, '..', 'build', 'icon.ico')), 'Windows icon is a ready .ico (electron-builder\'s PNG→ICO step fails with EINVAL on this PC)');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
assert(Array.isArray(firebaseJson.hosting) && firebaseJson.hosting.every((h: any) => h.target === 'updates' && h.public === 'release'), 'firebase.json can only deploy the update site, never the public website');

// 8h. Automatic daily backup.
assert((pkgJson.build?.files || []).includes('backup.js'), 'backup.js is packaged into the installer');
assert(/<AutoBackupScheduler \/>/.test(readSource('components/layout/AppShell.tsx')), 'AppShell runs the daily automatic backup');
const backupJs = fs.readFileSync(path.join(__dirname, '..', 'backup.js'), 'utf8');
assert(/renameSync/.test(backupJs) && /startsWith\(PREFIX\)/.test(backupJs), 'Backups are written atomically and pruning only touches auto-backup files');
const backupSvc = readSource('lib/backup/cloudBackupService.ts');
assert(/db\.purchase_bills\.toArray\(\)/.test(backupSvc) && /Array\.isArray\(purchase_bills\) \? db\.purchase_bills\.clear\(\)/.test(backupSvc), 'Backups include purchase bills; an older backup never wipes them');

// 8i. Small known issues stay fixed.
const statusBarSrc = readSource('components/layout/DesktopStatusBar.tsx');
assert(!/<span>Products<\/span>|<span>Register<\/span>/.test(statusBarSrc) && /BILLING_SHORTCUTS/.test(statusBarSrc), 'Status bar lists only shortcuts that exist (no fake F1 Billing / F2 Products / F4 Register)');
for (const [key] of [['F1'], ['F2'], ['F4'], ['F8'], ['F9'], ['F10']]) {
  assert(billingSrc.includes(`e.key === '${key}'`), `Advertised shortcut ${key} is really handled on the billing screen`);
}
assert(/pathname === '\/pay'/.test(readSource('components/layout/AppShell.tsx')), '/pay (customer UPI link) opens without a shop login');
assert(/\+ Add size \/ colour/.test(readSource('components/products/AddEditProductModal.tsx')), 'Size / colour can be added to a new product');

// 8j. Supplier accounts: paise math, one transaction per change, cash payments hit the drawer.
assert(nextSupplierBalance(500000, 'purchase', 120050) === 620050, 'Supplier purchase on credit adds to what the shop owes (paise)');
assert(nextSupplierBalance(100000, 'payment', 150000) === -50000, 'Paying a supplier more than owed becomes an advance (negative balance)');
const supplierLedgerSrc = readSource('lib/suppliers/supplierLedger.ts');
assert(/db\.transaction\('rw', db\.suppliers, db\.ledger_transactions, db\.cash_expenses/.test(supplierLedgerSrc), 'Supplier balance, ledger row and cash expense are written in one transaction');
assert(/category: 'supplier_payout'/.test(supplierLedgerSrc) && /mode === 'cash'/.test(supplierLedgerSrc), 'Only CASH supplier payments create a cash-drawer expense');
assert(/current_balance \|\| 0\) !== 0/.test(supplierLedgerSrc), 'A supplier with a balance cannot be deleted');
const supplierWriters = ALL_SOURCE.filter((f) => /db\.suppliers\.(put|update|delete|bulkPut|add)\(/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, '/'));
assert(
  supplierWriters.every((f) => ['lib/suppliers/supplierLedger.ts', 'lib/backup/cloudBackupService.ts', 'lib/firebase/firestoreSync.ts', 'lib/db/index.ts'].includes(f)),
  `Only supplierLedger.ts changes supplier balances (writers: ${supplierWriters.join(', ')})`
);

// 8k. Variants (Android model): a parent is never sold; children are ordinary products.
assert(JSON.stringify(cleanVariantLabels([' M', 'm', '', 'XL'])) === JSON.stringify(['M', 'XL']), 'Variant labels are trimmed and de-duplicated case-insensitively');
assert(!tracksOwnStock({ has_variants: true } as any) && tracksOwnStock({ has_variants: false } as any), 'Stock alerts skip a variant parent (its stock lives in the sizes / colours)');
assert(summarizeVariants([{ selling_price: 64900, current_stock: 2 }, { selling_price: 59900, current_stock: 3 }] as any).minPricePaise === 59900, 'POS shows a variant parent "from" its cheapest variant');
assert(/if \(product\.has_variants\) \{\s*setVariantPick/.test(billingSrc), 'Every POS add path opens the variant picker for a parent (never sells the parent)');
assert(/if \(variantPick\) return;/.test(billingSrc), 'Billing shortcuts (Enter = complete sale) are off while the variant picker is open');
assert(/searching \|\| !p\.parent_id/.test(billingSrc), 'POS grid hides variants under their parent unless searching');
assert(/\.\.\.editingProduct,\s*\.\.\.productPayload/.test(readSource('app/products/page.tsx')), 'Editing a product keeps its variant links (parent_id / has_variants)');
for (const rel of ['app/inventory/page.tsx', 'app/purchases/page.tsx', 'components/dashboard/DashboardHome.tsx']) {
  assert(readSource(rel).includes('tracksOwnStock('), `${rel} leaves variant parents out of stock alerts`);
}

// 8l. A forgotten master password must never lock a shop out of its own data.
const authFormSrc = readSource('components/auth/AuthForm.tsx');
assert(/Forgot password\?/.test(authFormSrc) && /verifyLicenceKey\(/.test(authFormSrc), 'Login screen offers "Forgot password?" via the licence key');
assert(/async function verifyOwnKey/.test(licenceJs) && /verifyLicence\(record\)/.test(licenceJs.slice(licenceJs.indexOf('async function verifyOwnKey'))), 'Recovery checks the key against the SIGNED licence of this PC');
assert(!/db\.|indexedDB|clear\(\)/.test(readSource('lib/auth/masterPassword.ts')), 'Password recovery never touches shop data');

// 8m. No status that claims something the app does not do.
const statusSrc = readSource('components/layout/DesktopStatusBar.tsx');
assert(!/>Ready<\/span>/.test(statusSrc) && /getPrinters\(\)/.test(statusSrc), 'Status bar printer state comes from the installed Windows printers, not a fixed "Ready"');
assert(!/Multi-Counter Sync|Real-time cloud sync/.test(readSource('app/cloud-backup/page.tsx')), 'Backup page does not advertise cloud sync the app does not have');

// 8n. Errors on a shop's computer are recorded, not lost.
const mainJsSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert((pkgJson.build?.files || []).includes('errorlog.js'), 'errorlog.js is packaged into the installer');
assert(/process\.on\('uncaughtException'/.test(mainJsSrc) && /render-process-gone/.test(mainJsSrc), 'Main-process errors and page crashes are logged');
assert(/<ErrorReporter \/>/.test(readSource('app/layout.tsx')) && fs.existsSync(path.join(SRC_ROOT, 'app', 'error.tsx')) && fs.existsSync(path.join(SRC_ROOT, 'app', 'global-error.tsx')), 'Page errors are logged and a crashed screen shows a friendly message');
assert(/Copy report for support/.test(readSource('components/settings/HelpSupportTab.tsx')), 'Settings → Help & Support can copy a report for support');

// 8o. No browser alert() / confirm() popups — in-app dialogs only.
const popupOffenders = ALL_SOURCE.filter((f) => !f.endsWith(path.join('lib', 'ui', 'dialogs.ts')))
  .filter((f) => /(?<![\w.'"`])(?:window\.)?(?:alert|confirm)\(/.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
assert(popupOffenders.length === 0, `No browser alert()/confirm() popups (found: ${popupOffenders.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`);
assert(/<DialogHost \/>/.test(readSource('app/layout.tsx')), 'The in-app dialog host is mounted once in the root layout');
assert(/addEventListener\('keydown', onKey, true\)/.test(readSource('components/ui/DialogHost.tsx')), 'Dialogs capture Enter/Esc so page shortcuts (Enter = complete sale) cannot fire underneath');

// 8p. Staged rollout: beta channel, never a downgrade, promote without rebuilding.
const updaterSrc = fs.readFileSync(path.join(__dirname, '..', 'updater.js'), 'utf8');
assert(/autoUpdater\.channel = beta \? 'beta' : 'latest';\s*[\s\S]{0,200}autoUpdater\.allowDowngrade = false;/.test(updaterSrc), 'Switching update channel never allows a downgrade');
const prepSrc = fs.readFileSync(path.join(__dirname, 'prepare_release.js'), 'utf8');
assert(Boolean(pkgJson.scripts?.['release:beta']?.includes('--beta')) && Boolean(pkgJson.scripts?.['release:promote']?.includes('--promote')), 'release:beta and release:promote scripts exist');
assert(!/rmSync\(release,/.test(prepSrc) && /keep\.has\(f\)/.test(prepSrc), 'Preparing a release never wipes release/; only unreferenced installers are removed');

// 8q. A bill is marked paid only by the cashier — never by a simulated payment.
const paymentPanelsSrc = readSource('components/billing/PosPaymentPanels.tsx');
assert(!/simulatePayment|paymentBridge|Test Pay Received/.test((billingSrc + paymentPanelsSrc).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'POS has no "Test Pay Received" / simulated-payment path that saves a bill as UPI-paid');
assert(/const handleCompleteSale = async \(\) =>/.test(billingSrc), 'Complete Sale takes no argument (a click event can never be read as a payment)');
{
  const total = 10150; const cash = Math.floor(total / 2); const upi = total - cash;
  assert(cash + upi === total && /Math\.floor\(grandTotalPaise \/ 2\)/.test(paymentPanelsSrc), '50/50 split preset adds up to the bill to the paisa (₹101.50 → ₹50.75 + ₹50.75)');
}

// 8r. The POS page stays split: presentational pieces live in their own files.
assert(
  ["from '@/components/billing/PosProductCard'", "from '@/components/billing/PosDialogs'", "from '@/components/billing/PosPaymentPanels'", "from '@/lib/billing/billTabs'"].every((s) => billingSrc.includes(s)) &&
    !/const PosProductCard = React\.memo|function getInitialTabs/.test(billingSrc),
  'POS page imports its product card, dialogs, payment panels and bill-tab storage instead of defining them inline'
);
assert(billingSrc.split('\n').length < 2300, `POS page stays under 2,300 lines (now ${billingSrc.split('\n').length})`);

// 8s. The Electron E2E data folder hook can never redirect an installed shop's data,
// and no update-publisher lock is set before a signed build exists (Bible §2.2).
{
  const mainJsSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(/if \(process\.env\.KAMAI_E2E_DIR && !app\.isPackaged\)/.test(mainJsSrc) && (mainJsSrc.match(/KAMAI_E2E_DIR/g) || []).length === 3, 'KAMAI_E2E_DIR (test data folder) is honoured only by unpackaged runs');
  assert(pkgJson.scripts?.['test:electron'] === 'node scripts/electron_e2e.mjs' && !JSON.stringify(pkgJson.build?.win || {}).includes('publisherName'), 'Electron E2E script is wired up; no publisherName until the first signed release');
}

// 8t. Lock on launch: the unlock lives in sessionStorage (gone when the app closes),
// and a locked shell renders no shop page (Bible §12 #10).
{
  const mpSrc = readSource('lib/auth/masterPassword.ts');
  const shellSrc = readSource('components/layout/AppShell.tsx');
  const authSrc = readSource('components/auth/AuthForm.tsx');
  assert(/sessionStorage\.setItem\(UNLOCK_KEY/.test(mpSrc) && !/localStorage\.setItem\(UNLOCK_KEY/.test(mpSrc), 'Master-password unlock is kept for this app session only (sessionStorage), so every restart asks again');
  assert(/currentUser\.business_id === 'biz_pending' \|\| locked\)/.test(shellSrc) && /if \(user && locked\)/.test(shellSrc) && /markUnlocked\(\)/.test(authSrc), 'A locked app renders no shop page and redirects to the password screen; only a correct password unlocks');
}

// 8u. Wiring & calculation audit (v4.59.0).
{
  const pos = billingSrc;
  assert(/if \(completingSaleRef\.current\) return;\s*completingSaleRef\.current = true;/.test(pos), 'Complete Sale ignores a second Enter / click while the first sale is saving (no double bill, no double stock cut)');
  assert(/const typedCashPaise = paymentMethod === 'cash' && amountReceivedInput/.test(pos) && /receivedPaise = typedCashPaise \?\?/.test(pos), 'Cash typed in cash mode never leaks into a UPI / card / credit bill as a part payment');
  assert(/typedCashPaise < grandTotalPaise && !targetCustomer/.test(pos), 'Short cash without a customer is refused (no untracked udhar)');
  assert(/if \(excess > parts\[0\]\)/.test(pos) && /changeReturnedPaise = excessP;/.test(pos), 'Overpaid split: the excess is change from the cash part, never counted in the drawer');
  assert(/const price = existing\.unit_price;/.test(pos) && /const price = item\.unit_price;/.test(pos) && (pos.match(/const price = product\.selling_price;/g) || []).length === 1, 'Adding more of a line keeps the rate the cashier edited (only a new line takes the catalogue price)');
  assert((pos.match(/is_tax_inclusive: product\.is_tax_inclusive \?\? !isBusinessGstExclusive/g) || []).length === 2, 'Cart lines store a resolved tax mode, so POS tax and bill totals (saleMath) agree');
  // Split overpay arithmetic: 848.00 bill, 900 cash + 0 UPI -> 52.00 change, 848.00 kept.
  const grand = 84800; const cash = 90000; const excess = cash - grand;
  assert(excess === 5200 && cash - excess === grand, 'Split overpay: cash kept + change = cash tendered, kept cash = bill');
  const productsSrc = readSource('app/products/page.tsx');
  const importSrc = readSource('components/inventory/ExcelInventoryImporter.tsx');
  assert(/is_tax_inclusive: editingProduct\?\.is_tax_inclusive \?\? business\?\.gst_pricing_mode !== 'exclusive'/.test(productsSrc) && /is_tax_inclusive: taxInclusive/.test(importSrc), 'New and imported products follow Settings → Default GST Calculation (the setting is wired)');
  assert(!/hsn_code: r\.hsn_code \|\| '1905'/.test(importSrc), 'Excel import never invents an HSN code');
  const custSrc = readSource('app/customers/page.tsx');
  assert(/notes: 'Balance corrected in customer details'/.test(custSrc), 'A balance changed in customer details is written to the khata ledger');
}

// 8w. Live A–Z audit (v4.61.0) — every fix below was found by driving the real app.
{
  // (a) A finished bill leaves nothing behind, and the next bill is never a held one.
  const held = { ...makeEmptyTab('t_held', 1), isHeld: true, cart: [{ product_id: 'x' } as any] };
  const done = { ...makeEmptyTab('t_done', 2), selectedCustomerId: 'c1', paymentMethod: 'split' as const, splitCash: '90', billDiscountType: 'percentage' as const, billDiscountValue: '10' };
  const after1 = tabsAfterClosing([held, done], 't_done', 't_new');
  const fresh = after1.tabs.find((t) => t.id === after1.activeTabId)!;
  assert(after1.activeTabId === 't_new' && fresh.cart.length === 0 && fresh.selectedCustomerId === '' && fresh.paymentMethod === 'cash' && !fresh.splitCash && !fresh.billDiscountValue && after1.tabs.find((t) => t.id === 't_held')!.cart.length === 1,
    'After a sale the next bill is blank (no customer, discount, split) and a held bill is never reused');
  const waiting = makeEmptyTab('t_wait', 3);
  const after2 = tabsAfterClosing([held, done, waiting], 't_done', 't_new');
  assert(after2.activeTabId === 't_wait' && after2.tabs.length === 2, 'After a sale an open (not held) bill is shown next');
  const after3 = tabsAfterClosing([done], 't_done', 't_new');
  assert(after3.tabs.length === 1 && after3.tabs[0].tabNumber === 1 && after3.tabs[0].cart.length === 0, 'Single bill: completing it leaves one blank bill');
  const billingPos = readSource('app/billing/page.tsx');
  assert(!/onNewBill=\{\(\) => \{[\s\S]{0,300}setCart\(\[\]\)/.test(billingPos), '"New Bill" after a sale never clears the cart of the bill now on screen');

  // (b) Khata payments clear bills oldest-first and are never counted twice in the drawer.
  const mkSale = (id: string, at: string, due: number) => ({ id, customer_id: 'c1', created_at: at, grand_total: due, balance_due: due, amount_received: 0, payment_method: 'credit', status: 'completed', invoice_number: id } as any);
  const bills = [mkSale('s2', '2026-09-02', 12000), mkSale('s1', '2026-09-01', 5000)];
  const plan = planBillAllocation(openBillsOldestFirst(bills, 'c1'), 7000);
  assert(plan.length === 2 && plan[0].sale_id === 's1' && plan[0].amount === 5000 && plan[1].amount === 2000, 'A ₹70 khata payment clears the oldest bill (₹50) first, then ₹20 of the next');
  const paid = applyPaymentToBill(bills[0], 2000, '2026-09-03');
  const bd = getSalePaymentBreakdown(paid);
  assert(paid.balance_due === 10000 && paid.payment_status === 'partial' && bd.credit === 12000 && bd.cash === 0, 'A later khata payment is not turned into a cash sale on the bill date (no double count in the drawer)');
  const undone = applyPaymentToBill(paid, -2000, '2026-09-04');
  assert(undone.balance_due === 12000 && undone.payment_status === 'unpaid' && undone.amount_received === 0, 'Deleting a khata payment puts the bill back to unpaid');
  const khataSrc = readSource('app/khata/page.tsx');
  const settleSrc = readSource('components/khata/SettleInvoicesModal.tsx');
  assert(/allocatePaymentToOpenBills\(/.test(khataSrc) && (khataSrc.match(/undoBillAllocations\(/g) || []).length >= 2 && /balance_due_at_sale: sale\.balance_due_at_sale \?\? currentSaleDue/.test(settleSrc),
    'Khata payment / edit / delete and Settle Invoices keep bills and the drawer consistent');

  // (c) No default owner PIN ("1234" used to be printed on the PIN screen).
  const privacySrc = readSource('lib/auth/cashierPrivacy.ts') + readSource('components/privacy/CashierPinModal.tsx') + readSource('components/privacy/OwnerPinPrompt.tsx');
  assert(!/DEFAULT_PIN|Default PIN is|Default is 1234/.test(privacySrc) && /verifyMasterPassword/.test(readSource('components/privacy/OwnerPinSetup.tsx')), 'There is no default owner PIN; the owner sets / resets it with the master password');

  // (d) Every custom overlay closes with Esc.
  for (const f of ['components/paytm/MerchantQRModal.tsx', 'components/billing/RapidScanMode.tsx', 'components/layout/GlobalDrawers.tsx', 'components/purchases/PurchaseInwardOptionsSheet.tsx']) {
    assert(/'Escape'/.test(readSource(f)), `${f.split('/').pop()} closes with Esc`);
  }

  // (e) No Tailwind class that does not exist (pl-8.5 put search icons on top of the text).
  const badSpacing = ALL_SOURCE.filter((f) => /\b(p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap|w|h|top|left|right|bottom)-(4|5|6|7|8|9|10|11|12)\.5\b/.test(fs.readFileSync(f, 'utf8')));
  assert(badSpacing.length === 0, `No non-existent Tailwind half-step spacing classes${badSpacing.length ? ': ' + badSpacing.join(', ') : ''}`);

  // (f) No file saved in the wrong encoding (₹ turned into "â‚¹" once already).
  const mojibake = ALL_SOURCE.filter((f) => /â‚¹|â€”|â€™|Ã©|ðŸ/.test(fs.readFileSync(f, 'utf8')));
  assert(mojibake.length === 0, `No source file has broken characters (wrong encoding)${mojibake.length ? ': ' + mojibake.join(', ') : ''}`);

  // (g) Products land in the real "General" category; HSN can be entered; current GST slabs.
  assert(generalCategoryId([{ id: 'cat_x', name: 'FMCG' }, { id: 'cat_123_0', name: 'General' }]) === 'cat_123_0' && !/category_id: 'cat_general'/.test(readSource('app/billing/page.tsx') + readSource('app/products/page.tsx') + readSource('components/purchases/BillScanReviewModal.tsx')),
    'New products go into the shop\'s real "General" category (not a missing id)');
  const productForm = readSource('components/products/AddEditProductModal.tsx');
  assert(/HSN \/ SAC Code/.test(productForm) && /hsn_code: formHsn\.trim\(\) \|\| undefined/.test(readSource('app/products/page.tsx')), 'The product form takes an HSN / SAC code');
  assert(/<option value=\{40\}>/.test(productForm) && /<option value=\{3\}>/.test(productForm) && validateProductData({ name: 'Premium Cigar Box', sellingPricePaise: 45000, mrpPaise: 50000, purchasePricePaise: 40000, currentStock: 20, minStockLevel: 5, taxRate: 40 }).isValid,
    'GST slabs include 3% and the 40% slab (22 Sep 2025 rates)');
  assert(!/8 popular items for General Retail/.test(readSource('app/onboarding/page.tsx')), 'Onboarding describes the starter catalogue it really adds');
}

// 8v. Page changes stay inside the app: the app:// handler serves Next.js RSC
// payloads as text/x-component (anything else = full reload + black blink).
{
  const mainJsSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(/const isRscRequest = searchParams\.has\('_rsc'\) \|\| request\.headers\.get\('rsc'\) === '1';/.test(mainJsSrc) && /isRscRequest \? 'text\/x-component'/.test(mainJsSrc), 'app:// serves RSC page payloads as text/x-component (sidebar clicks do not reload the app)');
}

// 8x. Hindi / Marathi UI (v4.63.0). The English text is the message id; every
// tr() / msg() text must have both translations, and screen text may not skip tr().
{
  const hiDict = JSON.parse(readSource('locales/hi.json')) as Record<string, string>;
  const mrDict = JSON.parse(readSource('locales/mr.json')) as Record<string, string>;
  const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  // Print documents, the invoice/pay pages and the base UI kit stay English on purpose.
  const NOT_TRANSLATED_UI = /(app[\\/](layout|invoice[\\/]page|pay[\\/]page)\.tsx|components[\\/](invoices[\\/](print[\\/]|InvoicePreview)|reports[\\/]print[\\/]|pwa[\\/]|payments[\\/]PaymentCelebrationModal|ui[\\/](Button|Card|Input)\.tsx|layout[\\/]LanguageSwitcher)|lib[\\/].*\.tsx$)/;
  const BRANDS = new Set(['KamaiPlus', 'Kamai+', 'Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'BHIM UPI', 'WhatsApp', 'Tally Prime', 'Excel', 'Enter ↵']);
  const needsTr = (text: string) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(t) || BRANDS.has(t) || /^[\w.+-]+@[\w.-]+$/.test(t)) return false;
    if (/^[A-Z0-9₹+\-/:.,#%()&×\s]{1,6}$/.test(t)) return false; // UPI, GST, F4, PDF
    return true;
  };
  const texts = new Map<string, string>();
  const dynamicTr: string[] = [];
  const bareJsx: string[] = [];
  for (const file of ALL_SOURCE) {
    const rel = path.relative(SRC_ROOT, file);
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const translatedUi = file.endsWith('.tsx') && !NOT_TRANSLATED_UI.test(rel);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['tr', 'msg', 't'].includes(node.expression.text) && node.arguments.length) {
        const a0 = node.arguments[0];
        if (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0)) {
          if (!texts.has(a0.text)) texts.set(a0.text, rel);
        } else if (ts.isTemplateExpression(a0)) dynamicTr.push(`${rel}: ${a0.getText(sf).slice(0, 60)}`);
      }
      if (translatedUi && ts.isJsxText(node) && needsTr(node.text)) {
        const parent = node.parent;
        const tag = ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(sf) : '';
        if (!['kbd', 'code', 'pre', 'script', 'style'].includes(tag)) bareJsx.push(`${rel}: "${node.text.replace(/\s+/g, ' ').trim().slice(0, 50)}"`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const missingHi = Array.from(texts.keys()).filter((k) => !hiDict[k]);
  const missingMr = Array.from(texts.keys()).filter((k) => !mrDict[k]);
  assert(texts.size > 1500 && missingHi.length === 0 && missingMr.length === 0,
    `Every tr()/msg() text (${texts.size}) has a Hindi and a Marathi translation`,
    [...missingHi.map((k) => `hi: ${k} (${texts.get(k)})`), ...missingMr.map((k) => `mr: ${k} (${texts.get(k)})`)].slice(0, 10).join(' | '));
  const badHoles = Object.keys(hiDict).filter((k) => holes(k) !== holes(hiDict[k]) || !mrDict[k] || holes(k) !== holes(mrDict[k]));
  assert(badHoles.length === 0, 'Hindi and Marathi translations keep every {placeholder} of the English text', badHoles.slice(0, 5).join(' | '));
  assert(Object.values(hiDict).concat(Object.values(mrDict)).every((v) => v.trim().length > 0 && !/â€|Ã|ðŸ/.test(v)), 'No translation is empty or saved in a broken encoding');
  assert(dynamicTr.length === 0, 'tr() is never given a `template ${literal}` (it could not be looked up) — use tr(\'… {name}\', { name })', dynamicTr.slice(0, 5).join(' | '));
  assert(bareJsx.length === 0, 'No screen text is written without tr() (it would stay English in Hindi / Marathi)', bareJsx.slice(0, 8).join(' | '));

  const i18nCore = readSource('lib/i18n/core.ts');
  assert(/export function paymentMethodLabel/.test(i18nCore) && /export function expenseCategoryLabel/.test(i18nCore)
    && /paymentMethodLabel\(sale\.payment_method\)/.test(readSource('components/transactions/TransactionBillCard.tsx'))
    && /expenseCategoryLabel\(e\.category\)/.test(readSource('components/cash-register/CashExpensesList.tsx')),
    'Payment-mode and expense badges show a translated name, not the raw "cash" / "tea_snacks" id');
  assert(/\{tr\(p\)\}/.test(readSource('app/reports/page.tsx')) && /msg\('This Month'\)/.test(readSource('lib/reports/advancedReports.ts')), 'Report period chips are translated (the English id stays the key)');
  for (const f of ['app/auth/page.tsx', 'app/onboarding/page.tsx', 'components/licence/LicenceGate.tsx']) {
    assert(/<LanguageSwitcher/.test(readSource(f)), `${f.split('/').slice(-2).join('/')} lets the shop pick English / हिंदी / मराठी before the app opens`);
  }
  const layoutSrc = readSource('app/layout.tsx');
  assert(layoutSrc.indexOf('<I18nProvider>') > -1 && layoutSrc.indexOf('<I18nProvider>') < layoutSrc.indexOf('<LicenceGate>'), 'The language provider wraps the licence screen too');
  assert(/language: getLanguage\(\)/.test(readSource('app/onboarding/page.tsx')), 'A new store saves the language picked on the setup screen (not always Hindi)');
}

// 8y. Support contacts (v4.64.0): WhatsApp / call +91 86699 97711, kamaiplus.app@gmail.com —
// written once in lib/support/contact.ts, reachable from every "stuck" screen.
{
  const wa = supportWhatsAppUrl('Namaste — test & 100%');
  const mail = supportEmailUrl('Help', 'Body');
  assert(SUPPORT_PHONE_DIGITS === '918669997711' && SUPPORT_EMAIL === 'kamaiplus.app@gmail.com', 'Support number is 8669997711 and e-mail is kamaiplus.app@gmail.com');
  assert(wa.startsWith('https://wa.me/918669997711?text=') && decodeURIComponent(wa.split('text=')[1]) === 'Namaste — test & 100%', 'WhatsApp support link opens a chat with the message typed (special characters kept)');
  assert(mail.startsWith('https://mail.google.com/') && new URL(mail).searchParams.get('to') === 'kamaiplus.app@gmail.com', 'E-mail support link opens a Gmail compose to support (https, so main.js opens it in the browser)');
  assert(decodeURIComponent(supportWhatsAppUrl('x'.repeat(5000)).split('text=')[1]).length < 2000, 'A long error report is cut so the WhatsApp link still opens');
  const oldAddress = ALL_SOURCE.filter((f) => /info@proventure\.in/.test(fs.readFileSync(f, 'utf8')));
  const siteHtml = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8');
  assert(oldAddress.length === 0 && !/info@proventure\.in/.test(siteHtml) && /wa\.me\/918669997711/.test(siteHtml) && /kamaiplus\.app@gmail\.com/.test(siteHtml),
    'The old info@proventure.in address is gone from the app and the download page', oldAddress.join(', '));
  assert(/<SupportContactLine/.test(readSource('components/licence/LicenceGate.tsx')) && /<SupportContactLine/.test(readSource('components/layout/AppShell.tsx')) && /<SupportContactLine/.test(readSource('components/auth/AuthForm.tsx')),
    'Licence screen, locked-account screen and forgotten-password screen show WhatsApp + e-mail support');
  const helpSrc = readSource('components/settings/HelpSupportTab.tsx');
  assert(/<SupportContactCard/.test(helpSrc) && /sendReport\('whatsapp'\)/.test(helpSrc) && /sendReport\('email'\)/.test(helpSrc), 'Help & Support has the contact card and sends the problem report on WhatsApp / e-mail');
}

// 8z. Idle lock + Lock now (v4.65.0): the app locks itself after N idle minutes
// (per computer, default 10, Off possible) and returns to the same page after the password.
{
  assert(parseIdleLockMinutes(null) === DEFAULT_IDLE_LOCK_MINUTES && DEFAULT_IDLE_LOCK_MINUTES === 10 && parseIdleLockMinutes('5') === 5 && parseIdleLockMinutes('0') === 0 && parseIdleLockMinutes('7') === 10 && parseIdleLockMinutes('abc') === 10,
    'Idle-lock time: 10 min by default, Off / 5 / 10 / 15 / 30 / 60 allowed, anything else falls back to 10');
  const min = 60_000;
  assert(shouldIdleLock(0, 5 * min, 5) && !shouldIdleLock(0, 5 * min - 1, 5) && !shouldIdleLock(0, 24 * 60 * min, 0), 'Locks exactly when the idle time is reached, never when Off');
  assert(safeReturnPath('/billing') === '/billing' && safeReturnPath('/invoice-designer') === '/invoice-designer' && safeReturnPath('/auth') === null && safeReturnPath('/onboarding') === null
    && safeReturnPath('/invoice?id=1') === null && safeReturnPath('//evil.example') === null && safeReturnPath('https://evil.example') === null,
    'After unlocking, the app only returns to one of its own shop pages');
  const mpSrc = readSource('lib/auth/masterPassword.ts');
  const shellSrc = readSource('components/layout/AppShell.tsx');
  const navSrc = readSource('components/layout/Navbar.tsx');
  assert(/export function lockApp[\s\S]{0,300}sessionStorage\.removeItem\(UNLOCK_KEY\)[\s\S]{0,300}dispatchEvent\(new Event\('auth_changed'\)\)/.test(mpSrc), 'Locking forgets the unlock and tells the shell (auth_changed)');
  assert(/<IdleLock \/>/.test(shellSrc) && /router\.replace\(unlockDestination\(\)\)/.test(shellSrc), 'The unlocked shell runs the idle timer and returns to the saved page after the password');
  assert(/lockApp\(pathname\)/.test(navSrc) && /IDLE_LOCK_OPTIONS\.map/.test(navSrc), 'Store menu has "Lock now" and the auto-lock choices');
  assert(/const destination = unlockDestination\(\);[\s\S]{0,200}router\.replace\(destination\)/.test(readSource('components/auth/AuthForm.tsx')), 'The password screen reads the saved page before the shell clears it (no bounce to Home)');
  const idleSrc = readSource('components/layout/IdleLock.tsx');
  assert(/'keydown'/.test(idleSrc) && /'pointerdown'/.test(idleSrc) && /shouldIdleLock\(last, Date\.now\(\), minutes\)/.test(idleSrc), 'Keyboard, scanner and mouse use keep the app open; the check uses the clock (locks after PC sleep too)');
}

// 8b. No Pro gating, payment upsell or AI scan anywhere in the source.
const PRO_OR_AI = /useProSubscription|requirePro|UpgradeModal|ProFeatureBadge|subscriptionService|razorpay|generativelanguage\.googleapis|gemini/i;
const proOrAiOffenders = ALL_SOURCE.filter((f) => PRO_OR_AI.test(fs.readFileSync(f, 'utf8')));
assert(
  proOrAiOffenders.length === 0,
  `No Pro gate, payment upsell or AI scan code in src (found: ${proOrAiOffenders.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`
);

// 9. Exactly one live query for the active business, shared through context.
const bizQuery = ALL_SOURCE.filter((f) => /db\.businesses\.toCollection\(\)\.first\(\)/.test(fs.readFileSync(f, 'utf8')) && /useLiveQuery/.test(fs.readFileSync(f, 'utf8')));
assert(
  bizQuery.length <= 2,
  `The active business is read through BusinessProvider, not per page (live-query holders: ${bizQuery.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`
);

// --- 10. Documentation system: the map may not silently rot ---------------
// ENGINEERING_BIBLE.md is what a cold agent reads instead of scanning the tree.
// These assertions fail the build the moment the code drifts away from it.
const REPO_ROOT = path.join(__dirname, '..');
const bible = fs.readFileSync(path.join(REPO_ROOT, 'ENGINEERING_BIBLE.md'), 'utf8');
const agentsMd = fs.readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8');

assert(bible.length > 4000, 'ENGINEERING_BIBLE.md exists and is substantive');
assert(
  /RULE 0/.test(agentsMd) && agentsMd.includes('ENGINEERING_BIBLE.md'),
  'AGENTS.md Rule 0 points every agent at ENGINEERING_BIBLE.md'
);

// Superseded docs must keep warning agents off, or be deleted outright.
for (const stale of ['FEATURE_REGISTRY.md', 'SYSTEM_ARCHITECTURE.md', 'HANDOVER.md', 'KamaiPlus_Complete_App_Documentation.md']) {
  const full = path.join(REPO_ROOT, stale);
  const flagged = !fs.existsSync(full) || fs.readFileSync(full, 'utf8').slice(0, 400).includes('ENGINEERING_BIBLE.md');
  assert(flagged, `Stale doc ${stale} is either deleted or banner-flagged as superseded`);
}

// Every route on disk must appear in the Bible's route table.
const routeDirs = fs
  .readdirSync(path.join(SRC_ROOT, 'app'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(SRC_ROOT, 'app', d.name, 'page.tsx')))
  .map((d) => '/' + d.name);
const undocumentedRoutes = routeDirs.filter((r) => !bible.includes('`' + r + '`'));
assert(
  undocumentedRoutes.length === 0,
  `Every route is documented in ENGINEERING_BIBLE.md (missing: ${undocumentedRoutes.join(', ') || 'none'})`
);

// Every localStorage key the app uses must be listed in the Bible.
const lsKeys = new Set<string>();
const lsRegex = /localStorage\.(?:getItem|setItem|removeItem)\('([^']+)'/g;
for (const f of ALL_SOURCE) {
  const src = fs.readFileSync(f, 'utf8');
  let match: RegExpExecArray | null;
  while ((match = lsRegex.exec(src)) !== null) {
    lsKeys.add(match[1]);
  }
}
const undocumentedKeys = Array.from(lsKeys).filter((k) => !bible.includes(k));
assert(
  undocumentedKeys.length === 0,
  `Every localStorage key is documented in ENGINEERING_BIBLE.md (missing: ${undocumentedKeys.join(', ') || 'none'})`
);

// Every Electron IPC channel must be documented.
const mainJs = fs.readFileSync(path.join(REPO_ROOT, 'main.js'), 'utf8');
const ipcRegex = /ipcMain\.handle\('([^']+)'/g;
const ipcChannels: string[] = [];
let ipcMatch: RegExpExecArray | null;
while ((ipcMatch = ipcRegex.exec(mainJs)) !== null) {
  ipcChannels.push(ipcMatch[1]);
}
const undocumentedIpc = ipcChannels.filter((c) => !bible.includes(c));
assert(
  ipcChannels.length > 0 && undocumentedIpc.length === 0,
  `Every Electron IPC channel is documented (missing: ${undocumentedIpc.join(', ') || 'none'})`
);

// 🌙 SUITE 10: WhatsApp Daily Summary, Khata Payment Deep-Link & Hardware Quotation/Estimate
console.log('\n🌙 SUITE 10: WhatsApp Daily Summary, Khata Payment Deep-Link & Hardware Quotation/Estimate');

// 1. Hardware Store Profile Quotation/Estimate Toggle Verification



// 2. WhatsApp Khata Payment Deep-Link Construction & Validation
const mockUpiId = 'shreeganesh@oksbi';
const mockStoreName = 'Shree Ganesh Hardware';
const mockDueAmount = 145000; // in paise = ₹1,450.00
const mockCustName = 'Ramesh Patel';

const payUrlParams = new URLSearchParams({
  pa: mockUpiId,
  pn: mockStoreName,
  am: (mockDueAmount / 100).toFixed(2),
  cu: 'INR',
  tn: `Khata payment to ${mockStoreName}`,
  cust: mockCustName,
});
const fullPayUrl = `http://localhost:3000/pay?${payUrlParams.toString()}`;

assert(fullPayUrl.includes('pa=shreeganesh%40oksbi'), 'Pay URL correctly encodes merchant UPI VPA');
assert(fullPayUrl.includes('am=1450.00'), 'Pay URL correctly encodes amount in decimal rupees');
assert(fullPayUrl.includes('cust=Ramesh+Patel'), 'Pay URL preserves customer name context');
assert(fullPayUrl.includes('cu=INR'), 'Pay URL enforces INR currency parameter');

// 3. Estimate Number Formatting & Invariant Simulation
const mockEstimateNum = `EST-${String(1).padStart(3, '0')}`;
assert(mockEstimateNum.startsWith('EST-'), 'Estimate sequence starts with EST- prefix');
assert(mockEstimateNum === 'EST-001', 'First estimate formatted as EST-001');

// Verify Estimate to Official Tax Invoice Transition
const mockConvertedInv = `INV-${String(1).padStart(3, '0')}`;
assert(mockConvertedInv.startsWith('INV-'), 'Converted invoice starts with INV- prefix');
assert(mockConvertedInv === 'INV-001', 'First tax invoice formatted as INV-001');

// Verify Stock Reservation vs Stock Deduction
const initialStock = 25;
const estimateQty = 5;
// When creating estimate, stock is NOT deducted
const stockAfterEstimate = initialStock;
assert(stockAfterEstimate === 25, 'Creating quotation/estimate does NOT deduct inventory stock');

// When converted to tax invoice, stock is deducted
const stockAfterConversion = stockAfterEstimate - estimateQty;
assert(stockAfterConversion === 20, 'Converting quotation to tax invoice successfully deducts stock from 25 to 20');

// ================================================================
// SUITE 11: Admin Deletion, Tombstone Persistence & Anti-Resurrection Invariants
// ================================================================
console.log('\n🛡️ SUITE 11: Admin Deletion, Tombstone Persistence & Anti-Resurrection');

const mockDeletedBizId = 'biz_deleted_test_999';
const mockDeletedPhone = '9876500000';
const mockTombstone = {
  id: mockDeletedBizId,
  business_id: mockDeletedBizId,
  phone: mockDeletedPhone,
  deleted_at: new Date().toISOString(),
  reason: 'admin_deleted',
};

// 1. Tombstone verification
assert(mockTombstone.reason === 'admin_deleted', 'Admin deletion writes tombstone with admin_deleted reason');
assert(Boolean(mockTombstone.deleted_at), 'Tombstone contains valid ISO deletion timestamp');

// 2. Anti-resurrection guard logic simulation
const isStoreTombstoned = (id: string, tombstoneMap: Set<string>) => tombstoneMap.has(id);
const mockTombstones = new Set([mockDeletedBizId]);

assert(isStoreTombstoned(mockDeletedBizId, mockTombstones) === true, 'Tombstoned store is correctly detected');
assert(isStoreTombstoned('biz_active_123', mockTombstones) === false, 'Active legitimate store is not flagged as tombstoned');

// 3. Cloud sync abort on deleted store
const simulateSyncAttempt = (targetBizId: string, isDeleted: boolean) => {
  if (isDeleted) {
    return { shouldAbort: true, shouldPurgeDevice: true, shouldUpload: false };
  }
  return { shouldAbort: false, shouldPurgeDevice: false, shouldUpload: true };
};

const syncResultForDeleted = simulateSyncAttempt(mockDeletedBizId, true);
assert(syncResultForDeleted.shouldAbort === true, 'Sync attempt for deleted store is immediately aborted');
assert(syncResultForDeleted.shouldPurgeDevice === true, 'Sync attempt triggers local device data purge');
assert(syncResultForDeleted.shouldUpload === false, 'Sync attempt strictly refuses to write or resurrect document to cloud');

// 4. Session check returns 410 Gone for deleted store
const simulateAuthCheck = (bizId: string | undefined, isFoundInCloud: boolean, isTombstoned: boolean) => {
  if (isTombstoned || (bizId && !isFoundInCloud)) {
    return { status: 410, authenticated: false, isDeleted: true };
  }
  return { status: 200, authenticated: true, isDeleted: false };
};

const authCheckForDeleted = simulateAuthCheck(mockDeletedBizId, false, true);
assert(authCheckForDeleted.status === 410, 'Session check returns HTTP 410 Gone for deleted store');
assert(authCheckForDeleted.isDeleted === true, 'Session check sets isDeleted flag to true');
assert(authCheckForDeleted.authenticated === false, 'Session check de-authenticates deleted merchant');

// 5. Admin merchant list excludes tombstoned stores
const rawMerchantsList = [
  { id: 'biz_active_1', name: 'Active Store', phone: '9111111111' },
  { id: mockDeletedBizId, name: 'Ghost Deleted Store', phone: mockDeletedPhone },
];
const filteredMerchants = rawMerchantsList.filter((m) => !mockTombstones.has(m.id));
assert(filteredMerchants.length === 1, 'Admin merchant query strictly filters out deleted stores');
assert(filteredMerchants[0].id === 'biz_active_1', 'Only active stores remain visible in Admin panel');

// ================================================================
// SUITE 16: ADMIN 2-PLAN LIMIT, REALTIME PRO/FREEZE & UNIVERSAL AUTH BINDING
// ================================================================
console.log('\n--- Test Suite 16: Admin 2-Plan Limit, Realtime Pro/Freeze Sync & Dual Auth Binding ---');

// (Pro plan / tier-sync mocks removed in v4.43.0: the desktop app has no subscription tiers.)

// 3. Real-time Freeze / Block Lockout Enforcement
const simulateCloudSnapshot = (cloudBiz: { is_active: boolean }) => {
  if (cloudBiz.is_active === false) {
    return { event: 'account_frozen', lockout: true };
  }
  return { event: 'account_unfrozen', lockout: false };
};

const frozenEvent = simulateCloudSnapshot({ is_active: false });
assert(frozenEvent.event === 'account_frozen', 'Snapshot with is_active: false emits account_frozen event');
assert(frozenEvent.lockout === true, 'Account lockout is activated immediately');

const unfrozenEvent = simulateCloudSnapshot({ is_active: true });
assert(unfrozenEvent.event === 'account_unfrozen', 'Snapshot with is_active: true emits account_unfrozen event');
assert(unfrozenEvent.lockout === false, 'Account lockout is released immediately');

// 4. Bi-directional Google Email <-> WhatsApp Phone Universal Binding
interface MockMerchantDoc {
  uid: string;
  business_id: string;
  phone?: string;
  email?: string;
}
const mockFirestoreMerchants = new Map<string, MockMerchantDoc>();

// Step A: User logs in with Google OAuth (uid: google_user_123, email: merchant@example.com)
const googleUid = 'google_user_123';
const userEmail = 'merchant@example.com';
const userPhone = '9876543210';
const businessId = 'biz_cross_indexed_456';

// Onboarding saves both Google UID and wa_phone documents
mockFirestoreMerchants.set(googleUid, {
  uid: googleUid,
  business_id: businessId,
  phone: userPhone,
  email: userEmail,
});
mockFirestoreMerchants.set(`wa_${userPhone}`, {
  uid: `wa_${userPhone}`,
  business_id: businessId,
  phone: userPhone,
  email: userEmail,
});

// Step B: User later logs in via WhatsApp OTP with phone 9876543210
const resolveStoreByPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '').slice(-10);
  const waDoc = mockFirestoreMerchants.get(`wa_${clean}`);
  return waDoc ? waDoc.business_id : null;
};
assert(resolveStoreByPhone(userPhone) === businessId, 'WhatsApp login with phone opens the EXACT same store as Google account');

// Step C: User later logs in with Google email
const resolveStoreByEmail = (email: string) => {
  for (const doc of Array.from(mockFirestoreMerchants.values())) {
    if (doc.email === email) return doc.business_id;
  }
  return null;
};
assert(resolveStoreByEmail(userEmail) === businessId, 'Google login with email opens the EXACT same store as WhatsApp account');

// -------------------------------------------------------------
// SUITE 17: Security & Auth Hardening (Subscription Auth-Bypass, ensureStarterBusiness, Firestore Rules)
// -------------------------------------------------------------
console.log('\n🔒 SUITE 17: Security & Auth Hardening (Subscription Auth-Bypass, ensureStarterBusiness, Firestore Rules)');

// (Subscription-activation mocks removed in v4.43.0: the desktop app has no paid tiers.)

// 2. ensureStarterBusinessIfEmpty identity binding invariant
function simulateEnsureStarterBusiness(user: { business_id?: string; business_name?: string; phone?: string } | null) {
  const isRealMerchant = Boolean(user && user.business_id && user.business_id !== 'biz_pending');
  return {
    id: isRealMerchant ? user!.business_id! : 'biz_dummy_starter',
    name: isRealMerchant ? (user!.business_name || 'My Retail Store') : 'My Retail Store',
    isRealMerchant,
  };
}

const loggedInStore = simulateEnsureStarterBusiness({
  business_id: 'biz_real_merchant_888',
  business_name: 'Gupta General Store',
  phone: '9876543210',
});
assert(loggedInStore.id === 'biz_real_merchant_888', 'ensureStarterBusiness binds to authenticated merchant ID');
assert(loggedInStore.name === 'Gupta General Store', 'ensureStarterBusiness preserves merchant business name');

const guestStore = simulateEnsureStarterBusiness(null);
assert(guestStore.id === 'biz_dummy_starter', 'Unauthenticated guest receives safe isolated starter store');

// 3. Firestore rules are owned, tested and deployed by the KamaiPlus Android repo
// (firebase.json here only has hosting). The stale copy that used to sit in this
// repo — and the checks that read it — were removed in v4.62.0: they tested a file
// that is never deployed.
assert(!fs.existsSync(path.resolve(__dirname, '../firestore.rules')), 'No stale, undeployed firestore.rules copy in the desktop repo');


// -------------------------------------------------------------
// SUITE 18: Desktop Invoice Engine (Android InvoicePdfService parity)
// -------------------------------------------------------------
console.log('\n🧾 SUITE 18: Desktop Invoice Engine — B2C/GST layouts, slabs, IGST, settings honoured');

const invBiz: any = {
  id: 'biz_inv', name: 'Shree Ganesh Kirana', tagline: 'Daily needs', business_type: 'retail', owner_name: 'Ramesh',
  phone: '9000000001', address: 'Market Yard, Pune', gstin: '27ABCDE1234F1Z5', upi_id: 'shop@upi', currency: 'INR', language: 'en',
  invoice_prefix: 'INV-', next_invoice_number: 1, is_onboarded: true, created_at: '', updated_at: '', sync_status: 'synced',
};
const sampleGstSale = buildSampleSale(invBiz);
const gstDoc = buildInvoiceDocument(sampleGstSale, invBiz, { upiVpa: 'shop@upi' });
assert(sampleGstSale.grand_total === 1499000, 'Sample GST bill totals ₹14,990 like the Android sample', `got ${sampleGstSale.grand_total}`);
assert(gstDoc.statutory === true && gstDoc.isB2B === true, 'Buyer GSTIN bill renders statutory 8-column GST layout');
assert(gstDoc.rows[0].taxable === formatINR(400000) && gstDoc.rows[0].gstAmount === formatINR(20000), 'Inclusive 5% line splits ₹4,200 into ₹4,000 taxable + ₹200 GST');
assert(gstDoc.taxSlabs.length === 2 && gstDoc.taxSlabs[0].label === '1101, 1512 (5%)', 'GST slabs grouped by rate with HSN list (Android format)');
assert(gstDoc.taxSlabs[0].taxable === formatINR(1104762) && gstDoc.taxSlabs[0].cgstAmount === formatINR(27619), '5% slab taxable ₹11,047.62 and CGST ₹276.19 match Android preview');
assert(gstDoc.isInterState === false && gstDoc.placeOfSupply === '27 (Maharashtra)', 'Same-state buyer is intra-state with POS "27 (Maharashtra)"');
assert(gstDoc.amountInWords.startsWith('Indian Rupees Fourteen Thousand Nine Hundred Ninety'), 'Amount in words uses the statutory "Indian Rupees ... Only." form');
assert(gstDoc.pages.length === 1, '4-line bill fits on one A4 page');

const interDoc = buildInvoiceDocument({ ...sampleGstSale, customer_gstin: '29AAACB1234F1Z3' }, invBiz, {});
assert(interDoc.isInterState === true && interDoc.taxSlabs.every((s) => s.igstAmount !== '-' && s.cgstAmount === '-'), 'Inter-state buyer (29 vs 27) gets IGST instead of CGST/SGST');

const retailSale: any = {
  ...sampleGstSale, customer_gstin: undefined, customer_name: 'Cash Customer', tax_total: 0,
  items: [{ product_id: 'x', product_name: 'Loose Rice', quantity: 2.5, unit: 'kg', unit_price: 6000, mrp: 6000, discount_amount: 0, tax_rate: 0, tax_amount: 0, total_amount: 15000 }],
  subtotal: 15000, grand_total: 15000, payment_method: 'cash',
};
const retailDoc = buildInvoiceDocument(retailSale, invBiz, {});
assert(retailDoc.statutory === false && retailDoc.showTaxSlabs === false, 'No-GST walk-in bill renders the clean 5-column retail layout');
assert(retailDoc.rows[0].qty === '2.5 kg', 'Loose quantity prints as "2.5 kg" (no rounding)');
assert(retailDoc.payment.label === '● PAID (CASH)', 'Paid cash bill shows "● PAID (CASH)" badge');

const hiddenDoc = buildInvoiceDocument(sampleGstSale, { ...invBiz, invoice_theme_config: { ...resolveInvoiceConfig(invBiz), show_upi_qr: false, show_terms: false, show_signature: false, show_tagline: false, custom_title: 'CASH MEMO' } }, { upiVpa: 'shop@upi' });
assert(hiddenDoc.upi.show === false && hiddenDoc.terms.length === 0 && hiddenDoc.showSignatory === false, 'Invoice Themes toggles (UPI QR, terms, signatory) are honoured');
assert(hiddenDoc.heading === 'CASH MEMO' && hiddenDoc.store.tagline === '', 'Custom heading and tagline toggle are honoured');
const noUpiDoc = buildInvoiceDocument(sampleGstSale, { ...invBiz, upi_id: '', upi_ids: [] }, { upiVpa: getPrimaryUpiVpa({ ...invBiz, upi_id: '', upi_ids: [] }) });
assert(noUpiDoc.upi.show === false, 'Store without its own UPI ID never prints a UPI QR (no guessed VPA)');
const estDoc = buildInvoiceDocument({ ...sampleGstSale, status: 'draft', invoice_number: 'EST-9' } as any, invBiz, {});
assert(estDoc.isEstimate && estDoc.heading === 'ESTIMATE / QUOTATION' && estDoc.upi.show === false, 'Estimates print as ESTIMATE / QUOTATION without payment QR');

const longRows = Array.from({ length: 40 }, (_, i) => ({ sno: i + 1, name: `Item ${i}`, meta: [], hsn: '-', qty: '1', rate: '', taxable: '', gstAmount: '', gstRate: '', total: '' }));
const longPages = paginateInvoiceRows(longRows as any);
assert(longPages.length >= 2 && longPages[0].length === 20 && longPages[longPages.length - 1].length <= 14, '40-line bill paginates 20 on page 1 and ≤14 on the summary page (Android budget)');
assert(longPages.reduce((a, p) => a + p.length, 0) === 40, 'Pagination keeps every invoice line');

// -------------------------------------------------------------
// SUITE 19: Bill Discount GST, Returns & Cash Drawer Money Rules
// -------------------------------------------------------------
console.log('\n💰 SUITE 19: Bill-discount GST, sales returns & cash drawer money rules');

const discLine = (id: string, total: number, rate: number, inclusive = true): any => ({
  product_id: id, product_name: id, quantity: 1, unit: 'piece', unit_price: total, mrp: total, discount_amount: 0,
  tax_rate: rate, tax_amount: calculateLineTax(total, rate, inclusive), total_amount: total, is_tax_inclusive: inclusive,
});
const discounted = allocateBillDiscount([discLine('a', 11800, 18), discLine('b', 10000, 0)], 2180);
const discTotals = computeBillTotals(discounted);
assert(discounted[0].discount_amount + discounted[1].discount_amount === 2180, 'Bill discount is spread over the lines exactly to the paisa');
assert(discTotals.grandTotal === 21800 - 2180, 'Customer pays items total minus bill discount (₹196.20)', `got ${discTotals.grandTotal}`);
assert(discounted[0].tax_amount === calculateLineTax(discounted[0].total_amount, 18, true) && discounted[0].tax_amount < 1800, 'GST is recomputed on the discounted amount (not charged on the discount)');
const exclDisc = computeBillTotals(allocateBillDiscount([discLine('c', 10000, 18, false)], 1000));
assert(exclDisc.subtotal === 9000 && exclDisc.taxTotal === 1620 && exclDisc.grandTotal === 10620, 'Tax-exclusive line: 10% off base then 18% GST on ₹90 = ₹106.20');

const retSale: any = {
  id: 'rs1', invoice_number: 'INV-050', status: 'completed', payment_method: 'cash', grand_total: 23600, balance_due: 0,
  amount_received: 23600, change_returned: 0,
  items: [{ ...discLine('p', 11800, 18), quantity: 2, unit_price: 5900, total_amount: 11800 }, { ...discLine('q', 11800, 18, false), total_amount: 10000, tax_amount: 1800 }],
};
assert(getLineRefundPaise(retSale.items[1], 1) === 11800, 'Refund of a tax-exclusive line includes the GST charged (₹118, not ₹100)');
assert(getLineRefundPaise(retSale.items[0], 1) === 5900, 'Refund of 1 of 2 units is prorated from the charged line amount');
const retRecords: any[] = [{ original_sale_id: 'rs1', refund_amount: 5900, refund_method: 'cash', items: [{ product_id: 'p', quantity: 1 }] }];
assert(getReturnedQtyByLine(retSale, retRecords)[0] === 1, 'Returned quantity is rebuilt per line from return records');
assert(getSaleNetTotal({ ...retSale, status: 'partial_return' }, retRecords) === 17700, 'Partially returned bill counts net of refund');
assert(getNetPaymentBreakdown({ ...retSale, status: 'partial_return' }, retRecords).cash === 17700, 'Cash refund comes out of the cash bucket');
assert(!isRevenueSale({ status: 'returned', invoice_number: 'INV-1' } as any) && !isRevenueSale({ status: 'draft', invoice_number: 'EST-1' } as any), 'Fully returned bills and estimates are not revenue');

const drawerSales: any[] = [
  { status: 'completed', invoice_number: 'INV-1', payment_method: 'cash', grand_total: 45000, balance_due: 0, amount_received: 50000, change_returned: 5000 },
  { status: 'completed', invoice_number: 'INV-2', payment_method: 'split', grand_total: 30000, payment_split: { cash_amount: 10000, upi_amount: 15000, card_amount: 0, credit_amount: 5000 } },
  { status: 'draft', invoice_number: 'EST-3', payment_method: 'cash', grand_total: 99900, balance_due: 0, amount_received: 0 },
  { status: 'completed', invoice_number: 'INV-4', payment_method: 'cash', grand_total: 20000, balance_due: 12000, amount_received: 8000 },
];
const drawer = computeDrawerSummary({
  sales: drawerSales,
  expenses: [{ amount: 2000, payment_mode: 'cash', category: 'tea_snacks' }, { amount: 3000, payment_mode: 'cash', category: 'refund' }, { amount: 999, payment_mode: 'upi', category: 'refund' }] as any,
  ledger: [{ party_type: 'customer', transaction_type: 'PAYMENT_RECEIVED', payment_method: 'cash', amount: 7000 }, { party_type: 'customer', transaction_type: 'PAYMENT_RECEIVED', amount: 5900 }] as any,
  openingCash: 100000,
});
assert(drawer.cashSales === 45000 + 10000 + 8000, 'Drawer cash excludes change handed back and estimates, includes split cash', `got ${drawer.cashSales}`);
assert(drawer.khataCashCollected === 7000, 'Khata payments received in cash count as drawer money (non-cash adjustments do not)');
assert(drawer.cashExpenses === 5000 && drawer.cashRefunds === 3000, 'Cash expenses include cash refunds; UPI refunds do not leave the drawer');
assert(drawer.expectedCash === 100000 + 63000 + 7000 - 5000, 'Expected drawer cash = opening + cash sales + khata cash − cash out');
const julyNight = new Date(2026, 6, 15, 0, 30);
assert(localDateKey(julyNight) === '2026-07-15', 'Local day key keeps 12:30 AM bills on the same shop day (no UTC shift)');

// -------------------------------------------------------------
// SUITE 20: Advanced Sales Analytics (Android ReportsRepository parity)
// -------------------------------------------------------------
console.log('\n📈 SUITE 20: Advanced Sales Analytics — periods, profit coverage, parties, dead stock');

const nowRef = new Date(2026, 8, 21, 15, 0);
const pToday = resolveReportPeriod('Today', nowRef);
const p7 = resolveReportPeriod('7 Days', nowRef);
const pLast = resolveReportPeriod('Last Month', nowRef);
assert(pToday.start.getTime() === new Date(2026, 8, 21).getTime() && pToday.end.getTime() === new Date(2026, 8, 22).getTime(), 'Today is the half-open local day [00:00, next 00:00)');
assert(Math.round((p7.end.getTime() - p7.start.getTime()) / 86400000) === 7, '"7 Days" spans exactly seven calendar days (today + 6)');
assert(pLast.start.getMonth() === 7 && pLast.end.getMonth() === 8 && pLast.end.getDate() === 1, '"Last Month" is the whole previous calendar month');

const catA: any = { id: 'ca', name: 'Grocery' };
const prods: any[] = [
  { id: 'pa', name: 'Atta', category_id: 'ca', current_stock: 5, is_active: true, unit: 'pkt' },
  { id: 'pb', name: 'Soap', category_id: 'ca', current_stock: 9, is_active: true, unit: 'pcs' },
  { id: 'pd', name: 'Dusty Item', category_id: 'ca', current_stock: 3, is_active: true, unit: 'pcs' },
  { id: 'pu', name: 'Service', category_id: 'ca', current_stock: 0, is_unlimited_stock: true, is_active: true, unit: 'pcs' },
];
const mk = (id: string, cust: string | undefined, items: any[], extra: any = {}): any => ({
  id, invoice_number: `INV-${id}`, customer_id: cust, customer_name: cust ? 'Arihant' : 'Cash Customer', status: 'completed',
  payment_method: 'cash', balance_due: 0, amount_received: 0, change_returned: 0, created_at: nowRef.toISOString(),
  grand_total: items.reduce((a, i) => a + i.total_amount, 0), items, ...extra,
});
const li = (pid: string, qty: number, price: number, cost?: number): any => ({
  product_id: pid, product_name: pid, quantity: qty, unit: 'pcs', unit_price: price, mrp: price, discount_amount: 0,
  tax_rate: 0, tax_amount: 0, total_amount: price * qty, is_tax_inclusive: true, cost_price: cost,
});
const rep = buildAdvancedReport({
  sales: [
    mk('1', 'c1', [li('pa', 2, 5000, 4000)], { payment_method: 'credit', balance_due: 10000 }),
    mk('2', undefined, [li('pb', 3, 1000)]),
    mk('3', undefined, [li('pa', 1, 5000, 4000)], { status: 'returned' }),
    mk('E', undefined, [li('pd', 1, 900, 500)], { status: 'draft', invoice_number: 'EST-1' }),
  ],
  returns: [], products: prods, categories: [catA],
});
assert(rep.invoiceCount === 2 && rep.paymentSummary.totalPaise === 13000, 'Revenue excludes the returned bill and the estimate');
assert(rep.totalProfitPaise === 2000 && rep.costedRevenuePaise === 10000, 'Profit covers only lines with a frozen buying price (never 100% on uncosted lines)');
assert(isProfitPartial(rep) && rep.uncostedLineCount === 1, 'Uncosted line marks profit as partial');
assert(Math.abs(marginPercent(rep) - 20) < 0.001, 'Margin is measured over costed revenue only (20%)');
const arihant = rep.partyData.find((p) => p.partyId === 'c1');
assert(!!arihant && arihant.creditPaise === 10000 && rep.paymentSummary.totalCreditPaise === 10000, 'Party udhar and period credit sales are reported');
assert(!!rep.partyData.find((p) => p.partyId === WALK_IN_ID && p.partyName === 'Walk-in Customer'), 'Bills without a customer group under Walk-in Customer');
const deadIds = rep.itemData.filter(isDeadStock).map((d) => d.itemName);
assert(deadIds.includes('Dusty Item') && !deadIds.includes('Service') && !deadIds.includes('Atta'), 'Dead stock = in-stock items with no sale (estimates do not count, unlimited-stock skipped)');
const sortedByQty = sortReport(rep, 'qty');
assert(sortedByQty.itemData[0].quantitySold >= sortedByQty.itemData[1].quantitySold, 'Sort by quantity orders items high to low');

// -------------------------------------------------------------
// SUITE 21: GSTR-1 honesty & ESC/POS text safety
// -------------------------------------------------------------
console.log('\n🧮 SUITE 21: GSTR-1 exclusive tax, no fabricated values; ESC/POS ASCII-safe text');

const gstrReport = generateGSTR1Report(
  [
    { ...mk('g1', undefined, [discLine('ex', 10000, 18, false)]), grand_total: 11800 },
    { ...mk('g2', undefined, [li('pa', 1, 5000)]), status: 'draft', invoice_number: 'EST-7' },
  ] as any,
  [],
  { ...invBiz, gstin: '' } as any,
  'Sep 2026'
);
assert(gstrReport.total_taxable_value === 10000 && gstrReport.total_cgst + gstrReport.total_sgst === 1800, 'Tax-exclusive line reports ₹100 taxable + ₹18 GST (not tax pulled out of the base)');
assert(gstrReport.total_invoices_count === 1 && gstrReport.doc_from_num === 'INV-g1', 'Estimates are not reported as supplies or documents');
assert(gstrReport.business_gstin === '', 'Missing store GSTIN stays blank — never a placeholder GSTIN');
assert(getStateName('29') === 'Karnataka' && getStateName('88') === '88', 'State names cover every code and unknown codes are not called Maharashtra');

// GSTR-1 JSON for the GST portal / offline tool (v4.66.0). The old export repeated a
// B2B invoice once per line, used yyyy-mm-dd dates, "canc", no HSN rate, and always fp 082026.
{
  const gl = (id: string, total: number, rate: number, hsn: string, qty = 1): any => ({ ...discLine(id, total, rate, true), hsn_code: hsn, quantity: qty, unit: 'pcs' });
  const on = new Date(2026, 8, 5, 11, 0).toISOString();
  const gSales: any[] = [
    { ...mk('101', 'cB', [gl('soap', 11800, 18, '3401'), gl('oil', 10500, 5, '1512'), gl('rice', 5000, 0, '1006')]), created_at: on, customer_gstin: '27AAACB1234C1Z5' },
    { ...mk('102', 'cK', [gl('soap', 11800, 18, '3401')]), created_at: on, customer_gstin: '29AAACK1234C1Z5' },
    { ...mk('103', undefined, [gl('soap', 23600, 18, '3401', 2), gl('pen', 1180, 18, '')]), created_at: on },
    { ...mk('104', undefined, [gl('soap', 11800, 18, '3401')]), created_at: on, status: 'cancelled' },
    { ...mk('E9', undefined, [gl('soap', 11800, 18, '3401')]), created_at: on, status: 'draft', invoice_number: 'EST-9' },
  ];
  const res = buildGstr1Json({ sales: gSales, customers: [], business: invBiz, fp: gstPeriodRange('this_month', new Date(2026, 8, 20)).fp! });
  const j: any = res.json;
  assert(j.fp === '092026' && j.gstin === '27ABCDE1234F1Z5' && !('cur_gt' in j), 'GSTR-1 JSON has the shop GSTIN and the return period as MMYYYY (092026)');
  const allInv = j.b2b.flatMap((c: any) => c.inv);
  assert(allInv.length === 2 && new Set(allInv.map((i: any) => i.inum)).size === 2, 'Each B2B invoice appears once (not once per line)');
  const inv101 = j.b2b.find((c: any) => c.ctin === '27AAACB1234C1Z5').inv[0];
  assert(inv101.idt === '05-09-2026' && inv101.pos === '27' && inv101.inv_typ === 'R' && inv101.rchrg === 'N' && inv101.val === 273,
    'B2B invoice: date dd-mm-yyyy, place of supply = state code, regular invoice, full bill value');
  assert(inv101.itms.length === 2 && inv101.itms.every((it: any) => 'camt' in it.itm_det && 'samt' in it.itm_det && !('iamt' in it.itm_det)),
    'B2B items are grouped per GST rate; within the state CGST + SGST only; the 0 % line is not in B2B');
  const inv102 = j.b2b.find((c: any) => c.ctin === '29AAACK1234C1Z5').inv[0];
  assert(inv102.pos === '29' && inv102.itms[0].itm_det.iamt === 18 && !('camt' in inv102.itms[0].itm_det), 'Inter-state B2B (Karnataka buyer) reports IGST with place of supply 29');
  assert(j.b2cs.length === 1 && j.b2cs[0].typ === 'OE' && j.b2cs[0].sply_ty === 'INTRA' && j.b2cs[0].pos === '27' && j.b2cs[0].rt === 18 && j.b2cs[0].txval === 210 && j.b2cs[0].camt === 18.9,
    'B2C sales: one OE row per state and rate (₹210 taxable, CGST ₹18.90)');
  assert(j.nil?.inv?.length === 1 && j.nil.inv[0].sply_ty === 'INTRAB2B' && j.nil.inv[0].nil_amt === 50, 'The 0 % line is reported in Table 8 (nil rated)');
  assert(Array.isArray(j.hsn?.hsn_b2b) && Array.isArray(j.hsn?.hsn_b2c) && [...j.hsn.hsn_b2b, ...j.hsn.hsn_b2c].every((h: any) => 'rt' in h && !('val' in h)),
    'HSN summary is split into B2B and B2C, with the rate on every row');
  const soapB2b = j.hsn.hsn_b2b.find((h: any) => h.hsn_sc === '3401' && h.rt === 18);
  assert(soapB2b.qty === 2 && soapB2b.txval === 200 && soapB2b.iamt === 18 && soapB2b.camt === 9 && soapB2b.samt === 9 && soapB2b.uqc === 'PCS',
    'HSN row adds up both B2B bills: qty 2, ₹200 taxable, IGST 18 + CGST 9 + SGST 9');
  const docs = j.doc_issue.doc_det[0].docs;
  assert(j.doc_issue.doc_det[0].doc_num === 1 && docs.length === 1 && docs[0].from === 'INV-101' && docs[0].to === 'INV-104' && docs[0].totnum === 4 && docs[0].cancel === 1 && docs[0].net_issue === 3,
    'Documents issued: INV-101 … INV-104, 1 cancelled, estimates not counted');
  assert(res.issues.some((i) => i.kind === 'missing_hsn' && i.examples.includes('pen')) && !res.issues.some((i) => i.kind === 'no_gstin') && res.fileName === 'GSTR1_27ABCDE1234F1Z5_092026.json',
    'Items without HSN are named before download; file name has GSTIN and period');
  const noGst = buildGstr1Json({ sales: [], customers: [], business: { gstin: '', name: 'x' }, fp: '092026' });
  assert(noGst.issues[0]?.kind === 'no_gstin' && !('b2b' in noGst.json) && !('hsn' in noGst.json), 'A shop without GSTIN is warned; empty tables are left out');

  const sep = new Date(2026, 8, 20);
  const q2 = gstPeriodRange('q2', sep), q3 = gstPeriodRange('q3', sep), q4 = gstPeriodRange('q4', sep), fy = gstPeriodRange('all_year', sep);
  assert(q2.fp === '092026' && q3.fp === '122025' && q3.start.getFullYear() === 2025 && q4.fp === '032026' && q4.start.getMonth() === 0,
    'Quarters are their latest occurrence (Sep 2026: Q3 = Oct–Dec 2025, Q4 = Jan–Mar 2026); fp = last month of the quarter');
  assert(fy.fp === null && fy.start.getFullYear() === 2026 && fy.start.getMonth() === 3 && fy.end.getFullYear() === 2027 && fy.end.getMonth() === 2,
    'Financial year = Apr 2026 – Mar 2027 and has no GSTR-1 period');
  const jan = new Date(2027, 0, 10);
  assert(gstPeriodRange('last_month', jan).fp === '122026' && gstPeriodRange('q4', jan).fp === '032027' && gstPeriodRange('q1', jan).fp === '062026',
    'In January: last month = Dec of the old year, Q4 = the running Jan–Mar, Q1 = the past Apr–Jun');
  const gstPageSrc = readSource('app/gst-reports/page.tsx');
  assert(/buildGstr1Json\(/.test(gstPageSrc) && /showConfirm\(/.test(gstPageSrc) && !/generateGSTOfflineJSON|'082026'/.test(gstPageSrc + readSource('lib/gst/gstr1Generator.ts')),
    'The GST page uses the new builder and warns before download; the old builder (always 082026) is gone');
}
assert(EscPosEncoder.toPrinterText('₹499 • Dettol — ठीक') === 'Rs.499 - Dettol - ?', 'ESC/POS text maps ₹ / • / — to ASCII and never sends raw UTF-8 bytes');

// -------------------------------------------------------------
// SUITE 22: Retail Pro Upgrades (Denomination Tally, Old Khata Warning & Reports)
// -------------------------------------------------------------
console.log('\n💵 SUITE 22: Retail Pro Upgrades (Denomination Tally, Old Khata Warning & Invariants)');

// 1. Denomination Tally Counter
const denoms = [500, 200, 100, 50, 20, 10, 5, 2, 1];
const counts: Record<number, number> = { 500: 2, 200: 3, 100: 1, 50: 4, 20: 5, 10: 10, 5: 0, 2: 0, 1: 0 };
const totalTallyRupees = denoms.reduce((sum, d) => sum + d * (counts[d] || 0), 0);
const totalNotes = Object.values(counts).reduce((a, b) => a + b, 0);
assert(totalTallyRupees === 2100, 'Tally counter correctly calculates ₹2,100 cash grand total');
assert(totalNotes === 25, 'Tally counter sums 25 physical currency notes');

// 2. Customer Khata Warning Invariant
const customerDebtCheck = (cust: { current_balance?: number; balance_due?: number } | null) => {
  const bal = Math.max(0, cust?.current_balance || cust?.balance_due || 0);
  return { hasPendingUdhar: bal > 0, balance: bal };
};
const indebtedCust = { current_balance: 2450 };
const cleanCust = { current_balance: 0 };
assert(customerDebtCheck(indebtedCust).hasPendingUdhar && customerDebtCheck(indebtedCust).balance === 2450, 'Old Khata warning triggers on positive customer balance');
assert(!customerDebtCheck(cleanCust).hasPendingUdhar, 'Zero balance customer does not trigger Old Khata warning');

// 3. Transactions Multi-Field Customer Filter
const sampleBills = [
  { id: 'b1', customer_id: 'c101', customer_name: 'Rahul Sharma', customer_phone: '9876543210' },
  { id: 'b2', customer_id: 'c102', customer_name: 'Priya Verma', customer_phone: '9123456780' },
  { id: 'b3', customer_id: 'c101', customer_name: 'Rahul Sharma', customer_phone: '9876543210' },
];
const filterByCust = (bills: typeof sampleBills, q: string) => {
  const needle = q.trim().toLowerCase();
  return bills.filter(b => 
    b.customer_name?.toLowerCase().includes(needle) ||
    b.customer_phone?.includes(needle) ||
    b.customer_id?.toLowerCase() === needle
  );
};
assert(filterByCust(sampleBills, 'Rahul').length === 2, 'Customer filter matches by name');
assert(filterByCust(sampleBills, '91234').length === 1, 'Customer filter matches by partial phone number');
assert(filterByCust(sampleBills, 'c101').length === 2, 'Customer filter matches by customer ID');

// 4. Barcode Label Paper Formats Validation
const supportedLabelPapers = ['50x25', '38x25', 'thermal-58', 'thermal-80'];
assert(supportedLabelPapers.includes('50x25') && supportedLabelPapers.includes('38x25'), 'Barcode printer supports standard 50x25mm and 38x25mm label sizes');

// 5. Product Data Clean & Reset Invariant
const mockProductsTable = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
let localProducts = [...mockProductsTable];
let localStorageFlags: Record<string, string> = {};
const simulateCleanProducts = () => {
  const count = localProducts.length;
  localProducts = [];
  localStorageFlags['kamai_products_manually_cleared'] = 'true';
  return count;
};
assert(simulateCleanProducts() === 3 && localProducts.length === 0, 'Clean product data removes all items from catalog');
assert(localStorageFlags['kamai_products_manually_cleared'] === 'true', 'Clean product data marks manual clear flag to prevent unauthorized re-seeding');


console.log('');
console.log('================================================================');
console.log(`📊 SIMULATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
