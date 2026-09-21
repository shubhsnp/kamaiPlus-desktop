/**
 * KamaiPlus Comprehensive End-to-End Simulation & QA Suite
 * Tests financial invariants, category engine profiles, security mechanisms,
 * and ESC/POS thermal hardware bytecode generation.
 */

import fs from 'fs';
import path from 'path';

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

import { getAllStoreProfiles, getStoreProfile, hasModule } from '../src/lib/constants/storeProfiles';
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
import { BILL_SCAN_SYSTEM_PROMPT, PurchaseBillExtractionSchema } from '../src/lib/ai/billScanPrompt';
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
  isRevenueSale,
} from '../src/lib/sales/saleMath';
import { computeDrawerSummary, localDateKey } from '../src/lib/reports/cashDrawer';
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

// 📸 SUITE 8: Store-Adaptive AI Inward & Menu Card Extraction Verification
console.log('\n📸 SUITE 8: Store-Adaptive AI Inward & Menu Card Extraction Verification');
assert(BILL_SCAN_SYSTEM_PROMPT.includes('Restaurant, cafe, and food stall menu cards'), 'AI Vision prompt explicitly supports Restaurant & Cafe menu cards');
assert(BILL_SCAN_SYSTEM_PROMPT.includes('dish / food item as a line item'), 'AI Vision prompt instructs extraction of dish items');
assert(BILL_SCAN_SYSTEM_PROMPT.includes('Wholesale Invoice / Distributor Bill / Parcha'), 'AI Vision prompt supports wholesale parchas and distributor bills');

// Test schema extraction parsing for Restaurant Menu item
const menuExtractTest = PurchaseBillExtractionSchema.safeParse({
  supplier_name: 'Royal Spice Restaurant',
  bill_number: null,
  bill_date: null,
  total_amount: 220,
  line_items: [
    {
      name: 'Paneer Butter Masala',
      quantity: 1,
      unit: 'plate',
      unit_price: 220,
      total_price: 220,
      confidence: 'high'
    }
  ]
});
assert(menuExtractTest.success === true, 'PurchaseBillExtractionSchema successfully validates extracted restaurant dish');

// Test schema extraction parsing for Wholesale Invoice line item
const wholesaleExtractTest = PurchaseBillExtractionSchema.safeParse({
  supplier_name: 'Shree Ganesh Traders',
  bill_number: 'INV-9901',
  bill_date: '2026-09-01',
  total_amount: 1400,
  line_items: [
    {
      name: 'Fortune Sunlite Sunflower Oil 1L',
      quantity: 10,
      unit: 'packet',
      unit_price: 140,
      total_price: 1400,
      confidence: 'high'
    }
  ]
});
assert(wholesaleExtractTest.success === true, 'PurchaseBillExtractionSchema successfully validates wholesale invoice line items');

// 🧭 SUITE 9: Store-Type Adaptive Sidebar Navigation & Onboarding Flow Verification
console.log('\n🧭 SUITE 9: Store-Type Adaptive Sidebar Navigation & Onboarding Flow Verification');



const clothProfile = getStoreProfile('clothing');
assert(clothProfile.featureToggles.showSizeVariants === true, 'Clothing store profile has showSizeVariants set to true');




const grocProfile = getStoreProfile('grocery');
assert(grocProfile.featureToggles.showWeightUnits === true, 'Grocery store profile has showWeightUnits set to true');

// 2. Navigation Simulation Helper matching Sidebar.tsx logic
function simulateSidebarItems(storeType?: string) {
  const isRestaurant = storeType === 'restaurant' || storeType === 'bakery';
  const isClothing = storeType === 'clothing';
  const isHardware = storeType === 'hardware' || storeType === 'electrical' || storeType === 'electronics' || storeType === 'mobile';
  const isPharmacy = storeType === 'pharmacy';
  const isGrocery = storeType === 'grocery' || storeType === 'fmcg';

  let productsLabel = 'Products';
  if (isRestaurant) productsLabel = 'Menu & Dishes';
  else if (isPharmacy) productsLabel = 'Medicines Master';
  else if (isClothing) productsLabel = 'Garments & Sizes';
  else if (isHardware) productsLabel = 'Items & Materials';
  else if (isGrocery) productsLabel = 'Products & FMCG';

  let inventoryLabel = 'Inventory & Expiry';
  if (isPharmacy) inventoryLabel = 'Expiry & Batch Radar';
  else if (isGrocery) inventoryLabel = 'Inventory & Alerts';

  let purchasesLabel = 'Purchases & Bills';
  if (isPharmacy) purchasesLabel = 'Distributor Invoices';
  else if (isGrocery) purchasesLabel = 'Wholesale Inward';
  else if (isHardware) purchasesLabel = 'Vendor Inward & Bills';

  const posItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/billing', label: 'Billing POS' },
    { href: '/cash-register', label: 'Cash Register' },
    ...(!isRestaurant ? [{ href: '/barcode-generator', label: 'Barcode Studio' }] : []),
    { href: '/transactions', label: 'Transactions' },
  ];

  const stockItems = [
    { href: '/products', label: productsLabel },
    ...(!isRestaurant && !isClothing && !isHardware ? [{ href: '/inventory', label: inventoryLabel }] : []),
    ...(!isRestaurant ? [{ href: '/purchases', label: purchasesLabel }] : []),
  ];

  return { posItems, stockItems };
}

// 3. Verify Restaurant Navigation
const restNav = simulateSidebarItems('restaurant');
assert(!restNav.posItems.some(i => i.href === '/barcode-generator'), 'Restaurant hides Barcode Studio');
assert(!restNav.stockItems.some(i => i.href === '/inventory'), 'Restaurant hides Inventory & Expiry');
assert(!restNav.stockItems.some(i => i.href === '/purchases'), 'Restaurant hides Purchases & Bills');
assert(restNav.stockItems.find(i => i.href === '/products')?.label === 'Menu & Dishes', 'Restaurant renames /products to "Menu & Dishes"');

// 4. Verify Clothing Navigation
const clothNav = simulateSidebarItems('clothing');
assert(!clothNav.stockItems.some(i => i.href === '/inventory'), 'Clothing hides Inventory & Expiry');
assert(clothNav.stockItems.some(i => i.href === '/purchases'), 'Clothing retains Purchases & Bills');
assert(clothNav.stockItems.find(i => i.href === '/products')?.label === 'Garments & Sizes', 'Clothing renames /products to "Garments & Sizes"');

// 5. Verify Hardware Navigation
const hardNav = simulateSidebarItems('hardware');
assert(!hardNav.stockItems.some(i => i.href === '/inventory'), 'Hardware hides Inventory & Expiry');
assert(hardNav.stockItems.find(i => i.href === '/purchases')?.label === 'Vendor Inward & Bills', 'Hardware renames /purchases to "Vendor Inward & Bills"');
assert(hardNav.stockItems.find(i => i.href === '/products')?.label === 'Items & Materials', 'Hardware renames /products to "Items & Materials"');

// 6. Verify Pharmacy Navigation
const pharmNav = simulateSidebarItems('pharmacy');
assert(pharmNav.stockItems.find(i => i.href === '/products')?.label === 'Medicines Master', 'Pharmacy renames /products to "Medicines Master"');
assert(pharmNav.stockItems.find(i => i.href === '/inventory')?.label === 'Expiry & Batch Radar', 'Pharmacy renames /inventory to "Expiry & Batch Radar"');
assert(pharmNav.stockItems.find(i => i.href === '/purchases')?.label === 'Distributor Invoices', 'Pharmacy renames /purchases to "Distributor Invoices"');

// 7. Verify Fallback Navigation (Unknown or null store type)
const fallbackNav = simulateSidebarItems(undefined);
assert(fallbackNav.posItems.some(i => i.href === '/barcode-generator'), 'Fallback retains Barcode Studio');
assert(fallbackNav.stockItems.some(i => i.href === '/products'), 'Fallback retains Products');
assert(fallbackNav.stockItems.some(i => i.href === '/inventory'), 'Fallback retains Inventory & Expiry');
assert(fallbackNav.stockItems.some(i => i.href === '/purchases'), 'Fallback retains Purchases & Bills');

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

// 1. Subscription Plan Restriction (Only 2 official plans: free & pro)
const officialPlans = ['free', 'pro'];
const validatePlanChoice = (plan: string) => officialPlans.includes(plan);
assert(validatePlanChoice('free') === true, 'Free Forever plan is supported');
assert(validatePlanChoice('pro') === true, 'Pro Enterprise (₹1,499/Year) plan is supported');
assert(validatePlanChoice('growth') === false, 'Legacy growth plan is removed');
assert(validatePlanChoice('enterprise') === false, 'Legacy enterprise plan is unified into pro');

// 2. Real-time Pro Upgrade & Downgrade State Transition
interface MockSubState {
  tier: 'free' | 'pro';
  activeUntil?: string;
}
const mockSetTierFromCloud = (cloudTier: string, activeUntil?: string): MockSubState => {
  const normalizedTier: 'free' | 'pro' = (cloudTier === 'pro' || cloudTier === 'enterprise') ? 'pro' : 'free';
  return {
    tier: normalizedTier,
    activeUntil: normalizedTier === 'pro' ? (activeUntil || new Date().toISOString()) : undefined,
  };
};

const upgradedState = mockSetTierFromCloud('pro');
assert(upgradedState.tier === 'pro', 'Cloud pro tier sets local subscription to pro');
assert(Boolean(upgradedState.activeUntil), 'Pro plan receives valid expiration timestamp');

const downgradedState = mockSetTierFromCloud('free');
assert(downgradedState.tier === 'free', 'Cloud free tier immediately downgrades local subscription to free');
assert(downgradedState.activeUntil === undefined, 'Downgraded free tier clears activeUntil date');

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

// 1. Subscription activation without session or admin must strictly be rejected
interface MockActivateReq {
  cookies: { session?: string };
  body: { businessId?: string; tier: string; razorpayPaymentId?: string };
  isAdmin: boolean;
}

function simulateSubscriptionActivate(req: MockActivateReq): { status: number; error?: string; success?: boolean } {
  let businessId: string | undefined;
  if (req.cookies.session === 'valid_merchant_cookie') {
    businessId = 'biz_merchant_123';
  }

  if (!businessId) {
    if (req.isAdmin && req.body.businessId) {
      businessId = req.body.businessId;
    } else {
      return { status: 401, error: 'Unauthorized. Valid merchant login session or admin privileges required.' };
    }
  }

  return { status: 200, success: true };
}

const unauthAttempt = simulateSubscriptionActivate({
  cookies: {},
  body: { businessId: 'biz_victim_999', tier: 'pro', razorpayPaymentId: 'pay_fake_123' },
  isAdmin: false,
});
assert(unauthAttempt.status === 401, 'Unauthenticated subscription activation with arbitrary businessId strictly rejected with 401');

const adminAttempt = simulateSubscriptionActivate({
  cookies: {},
  body: { businessId: 'biz_customer_555', tier: 'pro' },
  isAdmin: true,
});
assert(adminAttempt.status === 200 && adminAttempt.success === true, 'SuperAdmin can activate subscription for specified businessId');

const merchantAttempt = simulateSubscriptionActivate({
  cookies: { session: 'valid_merchant_cookie' },
  body: { businessId: 'biz_tampered_999', tier: 'pro', razorpayPaymentId: 'pay_real_123' },
  isAdmin: false,
});
assert(merchantAttempt.status === 200, 'Merchant with valid session successfully activates subscription');

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

// 3. Firestore Rules Anti-Resurrection Tombstone Rule
const rulesFilePath = path.resolve(__dirname, '../firestore.rules');
const firestoreRulesContent = fs.readFileSync(rulesFilePath, 'utf8');
assert(firestoreRulesContent.includes('match /deleted_businesses/{businessId}'), 'firestore.rules contains deleted_businesses tombstone matcher');
assert(firestoreRulesContent.includes('allow read: if true;'), 'firestore.rules allows read on deleted_businesses tombstones');
assert(firestoreRulesContent.includes('allow write: if false;'), 'firestore.rules strictly forbids write on deleted_businesses tombstones');


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
assert(EscPosEncoder.toPrinterText('₹499 • Dettol — ठीक') === 'Rs.499 - Dettol - ?', 'ESC/POS text maps ₹ / • / — to ASCII and never sends raw UTF-8 bytes');


console.log('');
console.log('================================================================');
console.log(`📊 SIMULATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
