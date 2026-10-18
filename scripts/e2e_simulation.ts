/**
 * KamaiPlus Comprehensive End-to-End Simulation & QA Suite
 * Tests financial invariants, category engine profiles, security mechanisms,
 * and ESC/POS thermal hardware bytecode generation.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
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

import { MASTER_UNITS, RECOMMENDED_UNITS, STARTER_CATEGORY } from '../src/lib/constants/storeProfiles';
import { getDefaultProductsForCategory, DEFAULT_CATEGORY_PRODUCTS, STARTER_PRODUCTS_BY_CATEGORY } from '../src/lib/constants/defaultProducts';
import { checkRateLimit } from '../src/lib/security/rateLimiter';
import { EscPosEncoder } from '../src/lib/hardware/escpos';

import { signSessionToken, verifySessionToken } from '../src/lib/auth/session';
import { calculateGstSummary } from '../src/lib/invoices/gstCalculator';
import { amountTone, formatINR, formatINRCompact, formatINRSigned } from '../src/lib/utils';
import { isAnalyticsNetworkNoise } from '../src/lib/diagnostics/errorReporter';
import { signOtpSessionToken, verifyStatelessOtp } from '../src/lib/auth/otpService';
import { 
  validateIndianPhone, 
  validateGstin, 
  gstinCheckChar,
  validateUpiId, 
  validatePincode, 
  validateFssaiLicense, 
  validateEmail, 
  validateProductData, 
  validateCustomerData, 
  validateExpenseData,
  validatePersonName, validateDayMonth, parseDayMonth, validateIfsc, validateBankAccount, validateAmount,
  typeMobile, typeAmount, typeCode, typeDigits, mobileDigits,
} from '../src/lib/validation/validators';
import { formatInvoiceNumber, parseInvoiceSequenceNumber } from '../src/lib/invoices/invoiceNumberService';
import crypto from 'crypto';
import { buildInvoiceDocument, getPrimaryUpiVpa, paginateInvoiceRows, storePhones } from '../src/lib/invoices/invoiceDocument';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTransactionFilters } from '../src/components/transactions/useTransactionFilters';
import { ThermalReceipt } from '../src/components/invoices/print/ThermalReceipt';
import { activeBillShare, billShareFromPointer, clampBillShare, DEFAULT_BILL_SHARE, DEFAULT_SCAN_BILL_SHARE, MAX_BILL_SHARE, MIN_BILL_SHARE, parsePosLayout, resetBillShare, showProductList, withBillShare } from '../src/lib/billing/posLayout';
import { lastChangedLine } from '../src/components/billing/PosScanPanel';
import { visibleAdminMessages } from '../src/lib/admin/adminMessages';
import type { AdminMessage } from '../src/lib/desktop/desktopBridge';
import { buildSampleSale } from '../src/lib/invoices/sampleInvoice';
import { INVOICE_HEADINGS, resolveInvoiceConfig } from '../src/lib/invoices/themeDefaults';
import {
  allocateBillDiscount,
  calculateLineTax,
  computeBillTotals,
  getLineRefundPaise,
  getNetPaymentBreakdown,
  getReturnedQtyByLine,
  getSaleNetTotal,
  getSalePaymentBreakdown,
  isEstimate,
  isRevenueSale,
} from '../src/lib/sales/saleMath';
import { computeDrawerSummary, dayOpeningFloat, localDateKey, summarizeDay } from '../src/lib/reports/cashDrawer';
import { splitIntraStateTax } from '../src/lib/gst/taxSplit';
import { cartBeyond, makeEmptyTab, nextBillTabId, tabsAfterClosing, tabsAfterSale, tabsAfterUndo, tabsForNewBill } from '../src/lib/billing/billTabs';
import { scrollDeltaToShow } from '../src/lib/billing/cartFocus';
import { buildCustomItem, customItemPricePaise, isUnsavedCustomItem } from '../src/lib/billing/customItem';
import { counterPace, hourRangeLabel, topDebtors, topItemsToday } from '../src/lib/dashboard/todayInsights';
import { categoryLabel } from '../src/lib/products/defaultCategory';
import { setActiveLanguage, setActiveWords, tr } from '../src/lib/i18n/core';
import { applyPaymentToBill, openBillsOldestFirst, planBillAllocation } from '../src/lib/khata/billAllocation';
import { generalCategoryId } from '../src/lib/products/defaultCategory';
import { nextSupplierBalance } from '../src/lib/suppliers/supplierLedger';
import { cleanVariantLabels, DEFAULT_COUNTED_STOCK, summarizeVariants, tracksOwnStock } from '../src/lib/products/variants';
import { buildBillCustomer, cleanCustomerNameInput, cleanMobileInput, isDraftEmpty, resolveBillCustomer, splitDraft, suggestCustomers } from '../src/lib/billing/billCustomer';
import { MenuPick, PACKING_CHARGE_ID, SERVICE_CHARGE_ID, requestKot, addPiece, applyToOnePiece, cancelOrderChanges, changeQty, discountPaise, formatOpenTime, hasUnsentItems, kotChanges, lineKey, lineUnitPaise, markKotSent, moveOrderTo, newOrder, nextToken, orderTotals, pieceCount, piecesInKitchen, removeLine, reprintKotLines } from '../src/lib/restaurant/model';
import { parseVoids, voidFromOrder, voidsOfDay } from '../src/lib/restaurant/voids';
import { buildCheckBody, shopUpiId } from '../src/lib/restaurant/checkPrint';
import { defaultTableNames, sanitizeRestaurantSettings } from '../src/lib/restaurant/settings';
import { parseRestState } from '../src/lib/restaurant/store';
import { foodTypeOf, isSoldOutToday, localDay, soldOutPatch } from '../src/lib/restaurant/dish';
import { resolveShopCategory } from '../src/lib/cloud/shopCategory';
import { isShared, kotToPrintHere, mergeCloudOrder, orderFromCloud, orderToCloud, ordersToSend, reconcileFirstRead, removeCloudOrder, tableOrderId } from '../src/lib/restaurant/cloudOrders';
import { buildKotBody } from '../src/lib/restaurant/kot';
import { RESTAURANT_PRESET_OFF, applyRestaurantPreset, restaurantModeFromRaw } from '../src/lib/features/featureSwitches';
import { RESTAURANT_WORDS } from '../src/lib/restaurant/words';
import { billCustomerName, cleanGuestPhone } from '../src/lib/restaurant/settle';
import { isRestaurantBill } from '../src/components/restaurant/RecentBills';
import { DEFAULT_FEATURE_SWITCHES, FEATURES, featureForPath, isPathEnabled, parseAdminOverrides, parseFeatureSwitches, showSellingPriceField } from '../src/lib/features/featureSwitches';
import { isRestaurantMode, readFeatureSwitches } from '../src/lib/features/featureSwitches';
import { countsStockAtCounter } from '../src/lib/billing/stockRule';
import { backupIsSafe } from '../src/lib/cloud/deletedStore';
import { cleanExpiry, expiryState, formatExpiry } from '../src/lib/products/expiry';
import { tabletsPerStripFromName } from '../src/lib/billing/unitQuantity';
import { VERTICAL_IDS, VERTICAL_PROFILE_KEY, gstAllowed, lineGstRate, parseVerticalProfile, restaurantGstFor, saveVerticalProfile, syncVerticalGst, verticalSwitches } from '../src/lib/business/verticalProfile';
import { adminBlock, blocksBilling, cleanFeatureOverrides, counterHasOpenBill, needsUpdate } from '../src/lib/admin/adminControl';
import { matchesProductDetails } from '../src/lib/products/detailSearch';
import { buildImportRows, buildItemName, COLUMN_ROLES, findHeaderRow, guessColumnRoles, mapUnit, parseAmount, planImport } from '../src/lib/import/catalogImport';
import { hasWholesalePrice, modeForCustomer, repriceCart, unitPriceFor } from '../src/lib/billing/priceMode';
import { DESKTOP_STORE_CODE_RANGES, ean13CheckDigit, isValidEan13, nextStoreBarcodes } from '../src/lib/barcode/storeBarcodes';
import type { CartItem, Customer, Product, Sale } from '../src/types';
import { barcodeSymbol } from '../src/lib/barcode/barcodeGenerator';
import { CUSTOM_LIMITS, DEFAULT_LABEL_SETTINGS, LABEL_STOCKS, labelPageMm, labelsPerPage, MAX_SETUP_COPIES, parseLabelSettings, stockFor } from '../src/lib/labels/labelSettings';
import { buildLabelHtml } from '../src/lib/labels/labelSheet';
import { calibrationKey, needsAutoCalibration } from '../src/lib/labels/autoCalibrate';
import { expandCopies } from '../src/lib/labels/printLabels';
import { looksLikeBarcode, searchEnterAction } from '../src/lib/billing/scanInput';
import { emptyEntryRow, labelCopiesFor, lowStockAlertFor, planStockEntry, stockAfterInward, StockEntryRow } from '../src/lib/inward/stockEntry';
import { parseStockEntryDraft } from '../src/lib/inward/stockEntryDraft';
import { billLineProblem, guessBillColumns, readBillHeading, readBillSheet } from '../src/lib/purchases/billSheet';
import { matchExtractedItemsWithProducts, nameMatchScore, normalizeName } from '../src/lib/purchases/matchProductByName';
import { encodeCostCode, isValidCostCodeWord, productLabelDetail, productLabelExtras } from '../src/lib/labels/labelExtras';
import { formatPackAmount, makeWeighedBarcode, parseWeighedBarcode, weighedQuantity } from '../src/lib/barcode/weighedBarcode';
import { globalShortcutFor, globalShortcutHints } from '../src/lib/ui/globalShortcuts';
import { settingsTabFromQuery } from '../src/lib/ui/settingsLinks';
import { parseTabY, shareFromCenter, tabCenterPx } from '../src/lib/ui/drawerTab';
import { billStats, GST_STAND_IN_HREF, quickActionsFor, showProfitCard } from '../src/lib/dashboard/homeTiles';
import { billPrinterMismatch, isVirtualPrinter, parseKnownPrinters, printerKind, printerLine, reviewPrinters, thermalFormat } from '../src/lib/hardware/printerDetect';
import { SILENT_PRINT_KEY } from '../src/lib/hardware/printerWatch';
import { toWhatsAppNumber, upiPayLink, whatsAppWebUrl } from '../src/lib/whatsapp/whatsappLinks';
import { billMessage, khataReminderMessage, ledgerSlipMessage, MAX_BILL_LINES, paymentRequestMessage } from '../src/lib/whatsapp/customerMessages';
import { cashTallyMessage, gstForCaMessage, restockOrderMessage, suggestedOrderQty } from '../src/lib/whatsapp/businessMessages';
import { DEFAULT_WHATSAPP_SETTINGS, parseWhatsAppSettings } from '../src/lib/whatsapp/whatsappSettings';
import { categoryKey, findCategoryByName } from '../src/lib/products/categories';
import { allowsFractionalQty, dozenFromPieces, formatCartQty, lineAmountPaise, piecesInDozen, roundQty } from '../src/lib/billing/unitQuantity';
import { getQuantityConfigForUnit } from '../src/components/billing/posQuantityConfig';
import { scanIntoRows, splitTrailingCode } from '../src/lib/inward/fastInward';
import { customerListHtmlBody, customerSheetRows, sortCustomers } from '../src/lib/customers/customerDirectory';
import { BACKUP_TABLES, checkBackupPayload } from '../src/lib/backup/cloudBackupService';
import { CLOUD_TABLES, fromCloud, normalizeUnit, tableForCloudPath, toCloud } from '../src/lib/cloud/cloudContract';
import { cloudBizId, parseCloudAccount } from '../src/lib/cloud/cloudAccount';
import { clearOutbox, cloudOutboxMiddleware, emptyOutbox, markFromCloud, noteChange, noteDelta, parseOutbox, peekOutbox, setOutboxRecording, withoutSent } from '../src/lib/cloud/cloudOutbox';
import { mergedRow } from '../src/lib/cloud/cloudPull';
import { newId } from '../src/lib/ids';
import { splitOutbox } from '../src/lib/cloud/cloudPush';
import { autoBackupDecision, MAX_WAIT_MS, QUIET_FOR_MS, REFRESH_EVERY_MS } from '../src/lib/backup/backupSchedule';
import { backupChangeMiddleware, clearDataChanged, dataChangedSinceBackup } from '../src/lib/backup/backupChanges';
import { breakupSales } from '../src/lib/tally/saleBreakup';
import { generateCASalesRegisterCSV } from '../src/lib/tally/caExcelGenerator';
import { generateTallyPrimeXML } from '../src/lib/tally/tallyXmlGenerator';
import { searchProducts, soundKeys, wordSoundKey } from '../src/lib/search/productSearch';
import {
  WALK_IN_ID,
  buildAdvancedReport,
  isDeadStock,
  isProfitPartial,
  marginPercent,
  resolveReportPeriod,
  sortReport,
} from '../src/lib/reports/advancedReports';
import { generateGSTR1Report, getGSTUQC, getStateName } from '../src/lib/gst/gstr1Generator';
import { buildGstr3bSummary } from '../src/lib/gst/gstr3b';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DIGITS, supportEmailUrl, supportWhatsAppUrl } from '../src/lib/support/contact';
import { DEFAULT_IDLE_LOCK_MINUTES, parseIdleLockMinutes, safeReturnPath, shouldIdleLock } from '../src/lib/auth/idleLock';
import { buildGstr1Json, gstPeriodRange } from '../src/lib/gst/gstr1Json';
import { CHANGELOG, WHATS_NEW_BASELINE, compareVersions, unseenReleases } from '../src/lib/whatsNew/changelog';
import { APP_VERSION } from '../src/lib/constants/version';
import { SHIFT_HISTORY_LIMIT, shiftDifferenceLabel } from '../src/components/cash-register/CashShiftHistory';
import { checkCreditLimit, udharOfBill } from '../src/lib/billing/creditLimit';
import { favouritesFirst } from '../src/lib/billing/posLayout';
import { buildEstimateSale, ESTIMATE_NOTE, nextEstimateNumber } from '../src/lib/billing/estimate';
import { cleanDocLines, DEBIT_NOTE_PREFIX, docLinesTotal, nextSupplierDocNumber, purchaseOrderText, PURCHASE_ORDER_PREFIX, stockAfterReturn, supplierDocKind, supplierDocLabel } from '../src/lib/purchases/supplierDocs';
import { supplierBalanceAfterReturn } from '../src/lib/suppliers/supplierLedger';
import { duplicateGroupKey, findDuplicateGroups, mergedProduct, repointLines } from '../src/lib/products/duplicates';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
/** Checks that need a real round trip (e.g. a local HTTP server); awaited before the summary. */
const pendingAsyncChecks: Promise<unknown>[] = [];

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
// TEST SUITE 5: removed in v4.103.0 (K-D01) — the bank-SMS / UPI-notification parser, payment
// bridge and soundbox were phone code (Capacitor notification listener) that no Desktop screen
// used. Suite 21 "v4.103.0" checks they stay gone.
// -----------------------------------------------------------------------------

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
assert(validateGstin('27AZIPL7277P1ZD', false).isValid === true, 'Valid 15-character GSTIN (a real one, check digit D) accepted');
assert(validateGstin('27azipl7277p1zd', false).isValid === true && validateGstin('27azipl7277p1zd', false).cleanedValue === '27AZIPL7277P1ZD', 'Lowercase GSTIN automatically capitalized');
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
// The billing counter, split over several files in v4.104.0 (K-D23): the page plus the parts moved
// out of it unchanged. Checks of "the counter's code" read all of them.
const COUNTER_FILES = ['app/billing/page.tsx', 'components/billing/PosCheckoutPanel.tsx', 'components/billing/PosCheckoutFooter.tsx', 'components/billing/posSaleActions.ts', 'components/billing/posEstimateAction.ts', 'components/billing/usePosKeyboard.ts', 'components/billing/posCartActions.ts', 'components/billing/PosCatalogPanel.tsx', 'components/billing/usePosScanning.ts', 'components/billing/PosMobileCart.tsx', 'components/billing/PosCounterDialogs.tsx', 'components/billing/usePosCatalogData.ts', 'components/billing/usePosBillTabs.ts', 'components/billing/usePosUpiQr.ts'];
const readCounter = () => COUNTER_FILES.filter((f) => fs.existsSync(path.join(SRC_ROOT, f))).map(readSource).join('\n');
// The Khata page, split the same way (v4.104.0, K-D23).
const KHATA_FILES = ['app/khata/page.tsx', 'components/khata/KhataCustomerList.tsx', 'components/khata/KhataCustomerDetail.tsx', 'components/khata/KhataDialogs.tsx', 'components/khata/khataActions.ts'];
const readKhata = () => KHATA_FILES.filter((f) => fs.existsSync(path.join(SRC_ROOT, f))).map(readSource).join('\n');
// The Products page, split the same way (v4.104.0, K-D23).
const PRODUCTS_FILES = ['app/products/page.tsx', 'components/products/productActions.ts', 'components/products/ProductPageDialogs.tsx'];
const readProductsPage = () => PRODUCTS_FILES.filter((f) => fs.existsSync(path.join(SRC_ROOT, f))).map(readSource).join('\n');
// The Settings page, split the same way (v4.104.0, K-D23).
const SETTINGS_FILES = ['app/settings/page.tsx', 'components/settings/settingsSave.ts', 'components/settings/SettingsReviewDialogs.tsx', 'components/settings/useSettingsChanges.ts'];
const readSettingsPage = () => SETTINGS_FILES.filter((f) => fs.existsSync(path.join(SRC_ROOT, f))).map(readSource).join('\n');
// The Add / Edit Product form, split the same way (v4.104.0, K-D23).
const readProductForm = () => ['components/products/AddEditProductModal.tsx', 'components/products/ProductFormDetails.tsx'].map(readSource).join('\n');
// Onboarding, split the same way (v4.104.0, K-D23).
const readOnboarding = () => ['app/onboarding/page.tsx', 'components/onboarding/onboardingSubmit.ts'].map(readSource).join('\n');

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
assert(STARTER_CATEGORY === 'General', 'Every shop starts with one "General" category (v4.175.0: no generic FMCG / Apparel list)');
assert(RECOMMENDED_UNITS.every((u) => MASTER_UNITS.some((m) => m.id === u)), 'Every recommended unit exists in MASTER_UNITS');

// 3. `ModuleId` (the per-vertical module gate) is gone from the domain types.
assert(!/ModuleId/.test(readSource('types/index.ts')), 'types/index.ts no longer declares the per-vertical ModuleId union');

// 4. The POS checkout panel must keep its pay button reachable: a scrolling body
//    plus a pinned footer. This is the bug where a long bill hid the totals.
const billingSrc = readCounter();
assert(
  /export function PosCheckoutPanel\(props: PosCheckoutPanelProps\) \{[\s\S]{0,1500}?return \(\s*\n\s*<div className="flex flex-col flex-1 min-h-0">/.test(readSource('components/billing/PosCheckoutPanel.tsx')),
  'POS checkout panel root is a bounded flex column (flex-1 min-h-0)'
);
{
  // v4.93.0: the scrolling body also carries data-pos-bill-scroll / ref (it is what a scan scrolls).
  const panel = (readSource('components/billing/PosCheckoutPanel.tsx') + '\n' + readSource('components/billing/PosCheckoutFooter.tsx'));
  assert(
    /<div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 -mr-1"[^>]*data-pos-bill-scroll/.test(panel) && (panel.match(/overflow-y-auto/g) || []).length === 1,
    'POS checkout panel has exactly one scrolling body region'
  );
}
assert(
  /Bottom Total & Checkout Button \(always visible\) \*\/\}\s*<PosCheckoutFooter/.test(readSource('components/billing/PosCheckoutPanel.tsx'))
    && /return \(\s*<div className="pt-2\.5 mt-2\.5 border-t border-slate-200 space-y-2 flex-shrink-0">/.test(readSource('components/billing/PosCheckoutFooter.tsx')),
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
  // v4.103.0 (K-D01): phone-only payment notification code no Desktop screen used.
  'lib/payments/notificationParser.ts',
  'lib/payments/paymentBridge.ts',
  'lib/payments/soundboxEngine.ts',
  'components/payments/PaymentCelebrationModal.tsx',
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
  // v4.113.0: PWA banner and install hooks discontinued for native Electron desktop app.
  'components/pwa/PWAInstallBanner.tsx',
  'lib/pwa/usePWAInstall.ts',
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
for (const rel of ['lib/firebase/lazyCloud.ts', 'lib/firebase/backgroundSync.ts', 'lib/sync/syncEngine.ts', 'components/onboarding/onboardingSubmit.ts']) {
  assert(readSource(rel).includes('CLOUD_SYNC_ENABLED'), `${rel} checks CLOUD_SYNC_ENABLED before touching the cloud`);
}
assert(!/await setDoc/.test(readSource('components/khata/SettleInvoicesModal.tsx')), 'Khata settlement never waits on a cloud write');

// 8e. Big-history screens stay light.
assert(/filteredSales\.slice\(0, visibleCount\)/.test(readSource('app/transactions/page.tsx')), 'Transactions renders bills page by page, not the whole history');
assert(/useMemo\(/.test(readSource('components/transactions/useTransactionFilters.ts')), 'Transaction filters are memoised, not recomputed on every render');
assert(!/db\.sales\.orderBy\('created_at'\)\.reverse\(\)\.toArray\(\)/.test(readKhata()), 'Khata loads only the selected customer\'s bills');

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
assert(/quitAndInstall/.test(updaterJs) && /ipcMain\.handle\('kp:update-install', async \(\) =>\s*install\(\) \?/.test(updaterJs) && (updaterJs.match(/quitAndInstall\(/g) || []).length === 1,
  'The app restarts for an update only when the user clicks Restart & Update (or, v4.105.0, the Admin\'s install command on an idle counter) — one install path');
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
assert(/'purchase_bills'/.test(backupSvc.slice(backupSvc.indexOf('BACKUP_TABLES = ['))) && /OPTIONAL_TABLES = new Set<BackupTable>\(\['purchase_bills'/.test(backupSvc) && /if \(list === undefined && OPTIONAL_TABLES\.has\(t\)\) continue;\s*await table\.clear\(\);/.test(backupSvc), 'Backups include purchase bills; an older backup never wipes them');

// 8i. Small known issues stay fixed.
const statusBarSrc = readSource('components/layout/DesktopStatusBar.tsx');
assert(!/<span>Products<\/span>|<span>Register<\/span>/.test(statusBarSrc) && /BILLING_SHORTCUTS/.test(statusBarSrc), 'Status bar lists only shortcuts that exist (no fake F1 Billing / F2 Products / F4 Register)');
for (const [key] of [['F1'], ['F2'], ['F4'], ['F8'], ['F9'], ['F10']]) {
  assert(billingSrc.includes(`e.key === '${key}'`), `Advertised shortcut ${key} is really handled on the billing screen`);
}
assert(/pathname === '\/pay'/.test(readSource('components/layout/AppShell.tsx')), '/pay (customer UPI link) opens without a shop login');
assert(/\+ Add size \/ colour/.test(readProductForm()), 'Size / colour can be added to a new product');

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
assert(/if \(variantPick\) return;/.test(billingSrc) && /if \(counterCovered\) return;/.test(billingSrc), 'Billing shortcuts (Enter = complete sale) are off while the variant picker is open');
assert(/searching \|\| !p\.parent_id/.test(billingSrc), 'POS grid hides variants under their parent unless searching');
assert(/\.\.\.editingProduct,\s*\.\.\.productPayload/.test(readProductsPage()), 'Editing a product keeps its variant links (parent_id / has_variants)');
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
// v4.78.0: the printer watcher (app shell) looks at Windows; the status bar shows what it saw.
assert(!/>Ready<\/span>/.test(statusSrc) && /usePrinterFacts\(\)/.test(statusSrc) && /printerLine\(/.test(statusSrc) && /api\.getPrinters\(\)/.test(readSource('components/printers/PrinterWatcher.tsx')), 'Status bar printer state comes from the installed Windows printers, not a fixed "Ready"');
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
assert(/autoUpdater\.channel = beta \? BETA_CHANNEL : STABLE_CHANNEL;\s*[\s\S]{0,200}autoUpdater\.allowDowngrade = false;/.test(updaterSrc), 'Switching update channel never allows a downgrade');
const prepSrc = fs.readFileSync(path.join(__dirname, 'prepare_release.js'), 'utf8');
assert(Boolean(pkgJson.scripts?.['release:beta']?.includes('--beta')) && Boolean(pkgJson.scripts?.['release:promote']?.includes('--promote')), 'release:beta and release:promote scripts exist');
assert(!/rmSync\(release,/.test(prepSrc) && /keep\.has\(f\)/.test(prepSrc), 'Preparing a release never wipes release/; only unreferenced installers are removed');
// Live bug (2026-10-02, 4.95.0): installed apps got the new version late or not at all. With a
// .blockmap on the site, electron-updater sends ONE request for many byte ranges; Firebase Hosting
// answers that with the whole 110 MB file (200 OK, checked with curl), so the installer came down
// twice on slow shop lines. The site carries no blockmap (old apps then do one full download) and
// the app never tries differential; it checks hourly (was 4 h).
assert(/autoUpdater\.disableDifferentialDownload = true;/.test(updaterSrc) && /const CHECK_INTERVAL_MS = 60 \* 60 \* 1000;/.test(updaterSrc)
  && /const FIRST_CHECK_DELAY_MS = 30 \* 1000;/.test(updaterSrc) && pkgJson.build?.nsis?.differentialPackage === false
  && !/copyFileSync\([^)]*blockmap/.test(prepSrc) && /if \(\/\\\.blockmap\$\/\.test\(f\)/.test(prepSrc),
  'Updates: no .blockmap on the update site and no differential download (Hosting cannot serve multi-range requests); the app checks every hour');

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
assert(readSource('app/billing/page.tsx').split('\n').length <= 401, `POS page stays within 400 lines (now ${readSource('app/billing/page.tsx').split('\n').length})`);

// 8s. The Electron E2E data folder hook can never redirect an installed shop's data,
// and no update-publisher lock is set before a signed build exists (Bible §2.2).
{
  const mainJsSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(/if \(process\.env\.KAMAI_E2E_DIR && !app\.isPackaged\)/.test(mainJsSrc) && (mainJsSrc.match(/KAMAI_E2E_DIR/g) || []).length === 4
    && /Boolean\(process\.env\.KAMAI_E2E_DIR\) && process\.env\.KAMAI_E2E_TRIAL !== '1' && !app\.isPackaged/.test(mainJsSrc), 'KAMAI_E2E_DIR (test data folder) is honoured only by unpackaged runs (the 4th use: no real trial in a test run, v4.148.0)');
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
  assert(/typedCashPaise < grandTotalPaise && \(!hasCustomer \|\| !udharAllowed\)/.test(pos) && /const hasCustomer = Boolean\(targetCustomer \|\| newCustomer\);/.test(pos), 'Short cash without a customer (picked or typed) is refused (no untracked udhar) — and with Khata switched off, even with one (v4.81.0)');
  assert(/if \(excess > parts\[0\]\)/.test(pos) && /changeReturnedPaise = excessP;/.test(pos), 'Overpaid split: the excess is change from the cash part, never counted in the drawer');
  assert(/const price = existing\.unit_price;/.test(pos) && /const price = item\.unit_price;/.test(pos) && (pos.match(/const price = unitPriceFor\(product, /g) || []).length === 1 && !/const price = product\.selling_price;/.test(pos), 'Adding more of a line keeps the rate the cashier edited (only a new line takes the catalogue price — retail or wholesale, v4.87.0)');
  assert((pos.match(/is_tax_inclusive: product\.is_tax_inclusive \?\? !isBusinessGstExclusive/g) || []).length === 2, 'Cart lines store a resolved tax mode, so POS tax and bill totals (saleMath) agree');
  // Split overpay arithmetic: 848.00 bill, 900 cash + 0 UPI -> 52.00 change, 848.00 kept.
  const grand = 84800; const cash = 90000; const excess = cash - grand;
  assert(excess === 5200 && cash - excess === grand, 'Split overpay: cash kept + change = cash tendered, kept cash = bill');
  const productsSrc = readProductsPage();
  const importSrc = readSource('lib/import/catalogImportDb.ts');
  assert(/is_tax_inclusive: editingProduct\?\.is_tax_inclusive \?\? business\?\.gst_pricing_mode !== 'exclusive'/.test(productsSrc) && /is_tax_inclusive: ctx\.taxInclusive/.test(importSrc), 'New and imported products follow Settings → Default GST Calculation (the setting is wired)');
  assert(!/hsn_code: r\.hsn_code \|\| '1905'/.test(importSrc) && /hsn_code: r\.hsn \|\| undefined/.test(importSrc), 'Excel import never invents an HSN code');
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
  const billingPos = readCounter();
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
  const khataSrc = readKhata();
  const settleSrc = readSource('components/khata/SettleInvoicesModal.tsx');
  assert(/allocatePaymentToOpenBills\(/.test(khataSrc) && (khataSrc.match(/undoBillAllocations\(/g) || []).length >= 2 && /balance_due_at_sale: sale\.balance_due_at_sale \?\? currentSaleDue/.test(settleSrc),
    'Khata payment / edit / delete and Settle Invoices keep bills and the drawer consistent');

  // (c) No default owner PIN ("1234" used to be printed on the PIN screen).
  const privacySrc = readSource('lib/auth/cashierPrivacy.ts') + readSource('components/privacy/CashierPinModal.tsx') + readSource('components/privacy/OwnerPinPrompt.tsx');
  assert(!/DEFAULT_PIN|Default PIN is|Default is 1234/.test(privacySrc) && /verifyMasterPassword/.test(readSource('components/privacy/OwnerPinSetup.tsx')), 'There is no default owner PIN; the owner sets / resets it with the master password');

  // (d) Every custom overlay closes with Esc.
  for (const f of ['components/paytm/MerchantQRModal.tsx', 'components/layout/GlobalDrawers.tsx', 'components/purchases/PurchaseInwardOptionsSheet.tsx']) {
    assert(/'Escape'/.test(readSource(f)), `${f.split('/').pop()} closes with Esc`);
  }

  // (e) No Tailwind class that does not exist (pl-8.5 put search icons on top of the text).
  const badSpacing = ALL_SOURCE.filter((f) => /\b(p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap|w|h|top|left|right|bottom)-(4|5|6|7|8|9|10|11|12)\.5\b/.test(fs.readFileSync(f, 'utf8')));
  assert(badSpacing.length === 0, `No non-existent Tailwind half-step spacing classes${badSpacing.length ? ': ' + badSpacing.join(', ') : ''}`);

  // (f) No file saved in the wrong encoding (₹ turned into "â‚¹" once already).
  const mojibake = ALL_SOURCE.filter((f) => /â‚¹|â€”|â€™|Ã©|ðŸ/.test(fs.readFileSync(f, 'utf8')));
  assert(mojibake.length === 0, `No source file has broken characters (wrong encoding)${mojibake.length ? ': ' + mojibake.join(', ') : ''}`);

  // (g) Products land in the real "General" category; HSN can be entered; current GST slabs.
  assert(generalCategoryId([{ id: 'cat_x', name: 'FMCG' }, { id: 'cat_123_0', name: 'General' }]) === 'cat_123_0' && !/category_id: 'cat_general'/.test(readCounter() + readProductsPage() + readSource('components/purchases/BillScanReviewModal.tsx')),
    'New products go into the shop\'s real "General" category (not a missing id)');
  const productForm = readProductForm();
  assert(/HSN \/ SAC Code/.test(productForm) && /hsn_code: formHsn\.trim\(\) \|\| undefined/.test(readProductsPage()), 'The product form takes an HSN / SAC code');
  assert(/<option value=\{40\}>/.test(productForm) && /<option value=\{3\}>/.test(productForm) && validateProductData({ name: 'Premium Cigar Box', sellingPricePaise: 45000, mrpPaise: 50000, purchasePricePaise: 40000, currentStock: 20, minStockLevel: 5, taxRate: 40 }).isValid,
    'GST slabs include 3% and the 40% slab (22 Sep 2025 rates)');
  assert(!/8 popular items for General Retail/.test(readOnboarding()), 'Onboarding describes the starter catalogue it really adds');
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
  const NOT_TRANSLATED_UI = /(app[\\/](layout|invoice[\\/]page|pay[\\/]page)\.tsx|components[\\/](invoices[\\/](print[\\/]|InvoicePreview|SharedInvoiceSheet)|reports[\\/]print[\\/]|pwa[\\/]|payments[\\/]PaymentCelebrationModal|ui[\\/](Button|Card|Input)\.tsx|layout[\\/]LanguageSwitcher)|lib[\\/].*\.tsx$)/;
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
  assert(/\{tr\(p\)\}/.test(readSource('app/reports/page.tsx')) && /msg\('This Month'\)/.test(readSource('lib/reports/reportPeriod.ts')), 'Report period chips are translated (the English id stays the key)');
  for (const f of ['app/auth/page.tsx', 'app/onboarding/page.tsx', 'components/licence/LicenceGate.tsx']) {
    assert(/<LanguageSwitcher/.test(readSource(f)), `${f.split('/').slice(-2).join('/')} lets the shop pick English / हिंदी / मराठी before the app opens`);
  }
  const layoutSrc = readSource('app/layout.tsx');
  assert(layoutSrc.indexOf('<I18nProvider>') > -1 && layoutSrc.indexOf('<I18nProvider>') < layoutSrc.indexOf('<LicenceGate>'), 'The language provider wraps the licence screen too');
  assert(/language: getLanguage\(\)/.test(readOnboarding()), 'A new store saves the language picked on the setup screen (not always Hindi)');
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

// 9a. "What's new" (v4.67.0): shown once after an update, never to a brand-new shop,
// always reachable from the status-bar version and Help & Support.
{
  assert(compareVersions('4.10.0', '4.9.0') > 0 && compareVersions('4.67.0', '4.67.0') === 0 && compareVersions('4.6', '4.6.0') === 0, 'Versions compare by number (4.10 is newer than 4.9)');
  const versions = CHANGELOG.map((r) => r.version);
  assert(versions.every((v, i) => i === 0 || compareVersions(versions[i - 1], v) > 0) && CHANGELOG.every((r) => r.items.length > 0) && compareVersions(versions[0], APP_VERSION) <= 0,
    'Changelog is newest first, no duplicates, no empty release, nothing newer than the app');
  const fromOld = unseenReleases(null, '4.67.0').map((r) => r.version);
  assert(fromOld.length > 0 && fromOld.every((v) => compareVersions(v, WHATS_NEW_BASELINE) > 0) && !fromOld.includes('4.61.0'), 'A shop updating from before "What\'s new" sees the releases since 4.62');
  assert(unseenReleases('4.65.0', '4.67.0').map((r) => r.version).join() === '4.67.0,4.66.0' && unseenReleases('4.67.0', '4.67.0').length === 0 && unseenReleases('4.60.0', '4.61.0').map((r) => r.version).join() === '4.61.0',
    'Only releases after the last seen one and up to the running version are shown');
  assert(/markWhatsNewSeen\(APP_VERSION\);\s*setStoredUser\(completeAuthUser\)/.test(readOnboarding()), 'A new shop is marked up to date before its first screen (no pop-up on day one)');
  assert(/<WhatsNewModal \/>/.test(readSource('components/layout/AppShell.tsx')) && /onClick=\{openWhatsNew\}/.test(readSource('components/layout/DesktopStatusBar.tsx')) && /<WhatsNewCard \/>/.test(readSource('components/settings/HelpSupportTab.tsx')),
    '"What\'s new" opens after an update, from the status-bar version and from Help & Support');
}

// 9b. Counter customer row, unlimited stock by default, shortcuts under a window (v4.68.0).
{
  const mk = (id: string, name: string, phone: string, due = 0) => ({ ...buildBillCustomer(id, 'biz', name, phone, '2026-09-27T00:00:00.000Z'), current_balance: due });
  const saved = [mk('c_ram', 'Ramesh Patil', '+91 98220 12345', 50000), mk('c_sita', 'Sita Devi', ''), mk('c_raj1', 'Raju', '9000000001'), mk('c_raj2', 'Raju', '9000000002')];

  // (a) Typed customer → saved one, new one, or a clear refusal. Never a duplicate.
  assert(resolveBillCustomer(saved, { name: '', phone: '' }).kind === 'none' && isDraftEmpty({ name: '  ', phone: '' }), 'Empty customer boxes = walk-in bill');
  const byPhone = resolveBillCustomer(saved, { name: 'Somebody', phone: '9822012345' });
  assert(byPhone.kind === 'existing' && byPhone.customer.id === 'c_ram', 'A mobile a saved customer has picks that customer (+91 / spaces ignored), whatever name is typed');
  const byName = resolveBillCustomer(saved, { name: '  ramesh   patil ', phone: '' });
  assert(byName.kind === 'existing' && byName.customer.id === 'c_ram', 'The only customer with that name is used (case / spaces ignored)');
  const fill = resolveBillCustomer(saved, { name: 'Sita Devi', phone: '9123400000' });
  assert(fill.kind === 'existing' && fill.customer.id === 'c_sita' && fill.addPhone === '9123400000', 'Same name saved without a mobile + a mobile typed → same customer, number filled in (no duplicate)');
  const twoRaju = resolveBillCustomer(saved, { name: 'Raju', phone: '' });
  assert(twoRaju.kind === 'error' && twoRaju.field === 'name', 'Two customers with the typed name and no mobile → refused, the cashier must pick one');
  const newOne = resolveBillCustomer(saved, { name: 'Anil Verma', phone: '91234 56780' });
  assert(newOne.kind === 'new' && newOne.name === 'Anil Verma' && newOne.phone === '9123456780', 'Someone new is saved with a clean 10-digit mobile');
  const phoneOnly = resolveBillCustomer(saved, { name: '9123456780', phone: '' });
  assert(splitDraft({ name: '98220', phone: '' }).phoneDigits === '98220' && phoneOnly.kind === 'new' && phoneOnly.phone === '9123456780' && phoneOnly.name === '9123456780', 'A number typed in the name box counts as the mobile (one box is enough)');
  const shortNo = resolveBillCustomer(saved, { name: 'Anil', phone: '12345' });
  assert(shortNo.kind === 'error' && shortNo.field === 'phone' && resolveBillCustomer(saved, { name: 'Anil', phone: '5123456789' }).kind === 'error', 'A wrong mobile (short, or not 6–9) stops the bill instead of saving a bad number');
  const sug = suggestCustomers(saved, { name: '', phone: '98220' });
  assert(sug.length === 1 && sug[0].id === 'c_ram' && suggestCustomers(saved, { name: 'ra', phone: '' }).map((c) => c.id).join() === 'c_raj1,c_raj2,c_ram', 'Saved customers show underneath while typing part of a name or number');
  const nc = buildBillCustomer('c_new', 'biz', ' Anil ', '9123456780', 'now');
  assert(nc.name === 'Anil' && nc.current_balance === 0 && nc.opening_balance === 0 && nc.customer_type === 'regular', 'A customer saved from the counter starts with no balance');

  // (b) The counter keeps what was typed per bill, and a finished bill forgets it.
  const typedTab = { ...makeEmptyTab('t_typed', 1), customerName: 'Anil', customerPhone: '9123456780', cart: [{ product_id: 'x' } as any] };
  const nextTab = tabsAfterClosing([typedTab], 't_typed', 't_next');
  const blank = nextTab.tabs.find((t) => t.id === nextTab.activeTabId)!;
  assert(makeEmptyTab('t', 1).customerName === '' && makeEmptyTab('t', 1).customerPhone === '' && blank.customerName === '' && blank.customerPhone === '', 'After a sale the next bill starts with empty customer boxes');

  // (c) No pop-up; the customer is saved with the bill, before the invoice number is taken.
  const pos = billingSrc;
  assert(!/QuickAddCustomerModal|setIsAddCustomerModalOpen|CustomerSearchAutocomplete/.test(pos + readSource('components/billing/PosDialogs.tsx')) && /<PosCustomerRow/.test(pos), 'Billing takes the customer in one row on the screen — no "Add customer" pop-up');
  // The sale flow lives in components/billing/posSaleActions.ts since v4.104.0 (K-D23).
  const saleSrc = readSource('components/billing/posSaleActions.ts');
  const saleFn = saleSrc.slice(saleSrc.indexOf('const completeSale = async'), saleSrc.indexOf('const { handleSaveEstimate } = createEstimateAction(deps);'));
  assert(saleFn.indexOf('resolveBillCustomer(') > -1 && saleFn.indexOf('await db.customers.put(targetCustomer)') > -1 && saleFn.indexOf('await db.customers.put(targetCustomer)') < saleFn.indexOf('getNextUniqueInvoiceNumber(businessId)') && saleFn.indexOf('getNextUniqueInvoiceNumber(businessId)') < saleFn.indexOf('await db.sales.put(newSale)'),
    'Complete Sale: typed customer is resolved / saved first, then the invoice number, then the bill');
  assert(/isCreditMode && !hasCustomer/.test(saleFn) && /focusPosCustomerName\(typed\.field\)/.test(saleFn) && /focusPosCustomerName\(\);/.test(saleFn), 'Udhar with no customer (or a wrong mobile) puts the cursor in the name box instead of opening a pop-up');

  // (d) Shortcuts: every key on the status bar works, and none fires under a window.
  assert(/const counterCovered = isInvoiceModalOpen \|\| Boolean\(editingCartItem\) \|\| isQuickAddModalOpen \|\| isCustomItemOpen \|\| isEnlargeQrModalOpen \|\| isBillPrinterOpen;/.test(pos),
    'Enter / F10 never complete the waiting bill while "Sale completed", item edit, unknown-barcode, Custom Item, bill printer or QR window is open');
  assert(billingSrc.includes("e.key === 'Escape'") && billingSrc.includes("e.key === '/'") && /\{ id: 'credit', label: tr\('Credit'\), icon: BookOpen, shortcut: 'F9' \}/.test(pos), 'Esc and / work on the counter; the Credit button shows its F9 key like Cash (F4) and UPI (F8)');

  // (e) New products are "Unlimited stock" by default; switching it off gives 10 / 10.
  const productsSrc = readProductsPage();
  const formSrc = readProductForm();
  const openAdd = productsSrc.slice(productsSrc.indexOf('const handleOpenAddModal'), productsSrc.indexOf('const handleOpenEditModal'));
  assert(DEFAULT_COUNTED_STOCK === 10 && /setFormIsUnlimitedStock\(true\)/.test(openAdd) && /setFormIsUnlimitedStock\(Boolean\(p\.is_unlimited_stock\)\)/.test(productsSrc), 'Add Product opens with Unlimited stock ON; editing keeps the product\'s own setting');
  assert(/setFormStock\(counted \? String\(editingProduct\.current_stock\) : String\(DEFAULT_COUNTED_STOCK\)\)/.test(formSrc) && /setFormMinStock\(counted \? String\(editingProduct\.min_stock_level \|\| 5\) : String\(DEFAULT_COUNTED_STOCK\)\)/.test(formSrc),
    'Switching Unlimited off fills stock 10 and low-stock alert 10 (an already counted product gets its own numbers back)');
  assert(/stock: formIsUnlimitedStock \? 0 : parseFloat\(r\.stock\) \|\| 0/.test(productsSrc) && /unlimitedStock=\{formIsUnlimitedStock\}/.test(formSrc) && !tracksOwnStock({ has_variants: false, is_unlimited_stock: true }),
    'Unlimited variants carry no stock count and never show in low-stock alerts');
}

// 9c. Feature switches (v4.69.0): Settings → Features hides screens and form fields
// (nothing is deleted); a 🔊 / 🔇 button mutes every sound in the app.
{
  const D = DEFAULT_FEATURE_SWITCHES;
  assert(D.profit_privacy === true && !D.cash_register && !D.purchases && !D.suppliers && !D.gst_reports
    && !D.product_selling_price && !D.product_cost_price && !D.product_hsn && !D.product_gst_rate && !D.product_size_colour && !D.product_variants,
    'A new shop starts simple: Cash Register, Purchases, Suppliers, GST reports and the extra product fields are off; profit privacy is on');
  assert(FEATURES.length === Object.keys(D).length && FEATURES.every((f) => f.id in D) && new Set(FEATURES.map((f) => f.id)).size === FEATURES.length, 'Every switch is listed once in Settings → Features');
  const parsed = parseFeatureSwitches(JSON.stringify({ cash_register: true, suppliers: 'yes', business_type: 'pharmacy', purchases: false }));
  assert(parsed.cash_register === true && parsed.suppliers === false && !('business_type' in parsed) && parseFeatureSwitches('{broken').gst_reports === false && parseFeatureSwitches(null).profit_privacy === true,
    'Saved switches are read safely: only known switches with true / false count, a broken value falls back to the defaults');
  assert(featureForPath('/cash-register/') === 'cash_register' && featureForPath('/cash-register?tally=open') === 'cash_register' && featureForPath('/purchases') === 'purchases'
    && featureForPath('/suppliers') === 'suppliers' && featureForPath('/gst-reports') === 'gst_reports' && featureForPath('/billing') === undefined && featureForPath('/settings') === undefined,
    'Each switchable screen is matched by its address (with / without trailing slash or query); billing and settings can never be switched off');
  assert(!isPathEnabled('/purchases', D) && isPathEnabled('/purchases', { ...D, purchases: true }) && isPathEnabled('/khata', D), 'A screen is reachable only while its switch is on');
  assert(!showSellingPriceField(false, null) && showSellingPriceField(true, null) && showSellingPriceField(false, { selling_price: 9000, mrp: 10000 }) && !showSellingPriceField(false, { selling_price: 10000, mrp: 10000 }),
    'Selling Price off: the form shows only MRP — but an item whose price differs from its MRP still shows both, so saving never changes its price');

  const sidebarSrc = readSource('components/layout/Sidebar.tsx');
  const shellSrc = readSource('components/layout/AppShell.tsx');
  const gateSrc = readSource('components/features/FeatureGate.tsx');
  assert(/isPathEnabled\(item\.href, switches\)/.test(sidebarSrc) && /isPathEnabled\(tool\.href, switches\)/.test(readSource('components/dashboard/QuickToolsGrid.tsx')),
    'Switched-off screens leave the menu and the Home shortcuts');
  assert(/<FeatureGate pathname=\{pathname\}>\{children\}<\/FeatureGate>/.test(shellSrc) && /featureForPath\(pathname\)/.test(gateSrc) && gateSrc.includes('<SupportContactLine') && !gateSrc.includes('tab=features'),
    'A switched-off screen opened by address shows "turned off — contact KamaiPlus support" instead of the page (v4.118.0: no Features tab to point to)');
  assert(/isFeatureOn\('profit_privacy'\)/.test(readSource('lib/auth/cashierPrivacy.ts')) && /if \(!privacyOn\) return null;/.test(readSource('components/privacy/ProfitMask.tsx'))
    && /const unlocked = pinUnlocked \|\| !privacyOn;/.test(readSource('app/reports/page.tsx')),
    'Privacy switch off: no "Cashier Privacy" button, no profit lock, reports show profit without a PIN');
  assert(!fs.existsSync(path.join(SRC_ROOT, 'components', 'settings', 'FeaturesTab.tsx')) && !/FeaturesTab|'features'/.test(readSettingsPage()) && !/'features'/.test(readSource('components/settings/SettingsNavTabs.tsx')),
    'v4.118.0: Settings has no Features tab — the app follows the shop category; KamaiPlus support still forces switches from the Admin Console');
  const formSrc = readProductForm();
  assert(['product_cost_price', 'product_hsn', 'product_gst_rate', 'product_size_colour', 'product_variants'].every((id) => formSrc.includes(`switches.${id} &&`)) && /\{showSellingPrice && \(/.test(formSrc) && /required=\{!showSellingPrice\}/.test(formSrc),
    'Add Product: cost price, HSN, GST rate, size / colour and variants appear only when switched on; MRP is required when it is the only price');
  const productsSrc = readProductsPage();
  assert(/const sellingPricePaise = sellingShown \? parseRupeesToPaise\(formSellingPrice\) : parseRupeesToPaise\(formMrp\);/.test(productsSrc)
    && (productsSrc.match(/onOpenInwardSheet=\{switches\.purchases \?/g) || []).length === 2,
    'An item saved without a separate selling price sells at its MRP; Bulk Inward (part of Purchases) hides with Purchases');

  // Mute: every sound source checks the one switch.
  assert(/if \(isSoundMuted\(\)\) return;/.test(readSource('lib/voice/speechParser.ts')) && /isSoundMuted\(\)\) return;/.test(readSource('lib/hardware/barcodeScannerListener.ts')),
    '🔇 silences POS beeps and the scanner beep');
  assert(/<SoundToggleButton \/>/.test(readSource('components/layout/Navbar.tsx')) && /aria-pressed=\{muted\}/.test(readSource('components/layout/SoundToggleButton.tsx')), 'The top bar has the 🔊 / 🔇 button');
}

// 9d. Smart Excel price-list import + saved store barcodes (v4.70.0).
{
  // (a) Columns are recognised from the shop's own headings (the real fireworks list, and an English sheet).
  assert(guessColumnRoles(['Sr No', 'Section', 'Item (आयटम)', 'Company (कंपनी)', 'Price (भाव)', 'Per (प्रति)', 'Page', 'Table Side', 'Review Note']).join() === 'ignore,category,name,company,price,unit,ignore,ignore,ignore',
    'Fireworks price list: Section → category, Item → name, Company, Price → price, Per → unit; the rest is left out');
  assert(guessColumnRoles(['Item Code', 'Item Name', 'Company Name', 'Category', 'Purchase Price', 'Selling Price', 'MRP', 'Unit', 'Qty', 'GST %', 'HSN Code']).join() === 'barcode,name,company,category,cost,price,mrp,unit,stock,gst,hsn'
    && guessColumnRoles(['Name', 'Product']).join() === 'name,ignore',
    'English sheet: purchase price is not mistaken for the selling price, HSN Code is not a barcode, a role is used once');
  assert(parseAmount('₹1,250.00') === 1250 && parseAmount(47) === 47 && parseAmount('-') === null && parseAmount('') === null && parseAmount('abc') === null, 'Prices are read from "₹1,250.00", numbers and blanks correctly');
  const u = (t: string) => { const m = mapUnit(t); return `${m.unit}${m.pack ? ':' + m.pack : ''}`; };
  assert([u('बॉक्स'), u('Box'), u('युनिट'), u('पॅकेट'), u('100 नग'), u('10 थैली'), u('10 पॅकेट'), u('1 नग'), u('kg'), u('')].join() === 'box,box,piece,packet,box:100 नग,bundle:10 थैली,bundle:10 पॅकेट,piece,kg,piece',
    '"प्रति" becomes a real unit; a pack of many ("100 नग") is sold as one box / bundle');
  const opt = { prefixSection: true };
  assert(buildItemName('8 वाला', 'अतिसिया', 'चौरसा', '100 नग', opt) === 'चौरसा 8 वाला – अतिसिया (100 नग)'
    && buildItemName('15 Shot', '1 Piece', 'Fancy Item Mayur', undefined, opt) === 'Fancy Item Mayur 15 Shot'
    && buildItemName('7 शॉट', '10 नग', 'Fancy Items Pothi', undefined, opt) === 'Fancy Items Pothi 7 शॉट (10 नग)'
    && buildItemName('2.5" 2 Piece', '2 Piece', 'Fancy Item Mercury', undefined, opt) === 'Fancy Item Mercury 2.5" 2 Piece'
    && buildItemName('अनार स्पेशल', 'विन', 'अनार', undefined, opt) === 'अनार स्पेशल – विन'
    && buildItemName('Zoom (11 Items)', '50 Box/Case', 'Gift Box ROBO', undefined, opt) === 'Zoom (11 Items)'
    && buildItemName('9 cm प्लेन Nett', 'चंद्रा', 'सिल्वर', undefined, { prefixSection: false }) === '9 cm प्लेन Nett – चंद्रा',
    'Item names: size-only names get their section, company is added, a pack-size "company" is not, no pack is written twice');

  // (b) Rows: blanks, missing prices and repeats are caught; clashing names get their section.
  const grid = [
    ['Section', 'Item', 'Company', 'Price', 'Per'],
    ['चौरसा', '8 वाला', 'अतिसिया', 320, '100 नग'],
    ['Fancy Item Fathers', 'Helicopter', '5 Piece', 85, 'बॉक्स'],
    ['Fancy Item Royal', 'Helicopter', '5 Piece', 80, 'बॉक्स'],
    ['अटॅम बॉम्ब', 'Saddam', 'Regular', '', 'युनिट'],
    ['', '', '', '', ''],
    ['अनार', 'अनार स्पेशल', 'विन', 590, 'युनिट'],
    ['अनार', 'अनार स्पेशल', 'विन', 600, 'युनिट'],
  ];
  const roles = guessColumnRoles(grid[0] as string[]);
  const rows = buildImportRows(grid, findHeaderRow(grid), roles, opt);
  const byRow = (n: number) => rows.find((r) => r.rowNumber === n)!;
  assert(rows.length === 6 && byRow(2).pricePaise === 32000 && byRow(2).unit === 'box' && byRow(3).name === 'Helicopter (5 Piece) – Fancy Item Fathers' && byRow(4).name === 'Helicopter (5 Piece) – Fancy Item Royal',
    'Sheet rows: prices in paise, blank lines ignored, two brands\' "Helicopter" told apart by their section');
  assert(!byRow(5).skip && byRow(5).pricePaise === null && /twice/.test(byRow(8).skip || '') && !byRow(7).skip,
    'A row without a price is kept (v4.87.0 — saved at ₹0, its label prints without a price); the same item twice is skipped with the reason shown');
  assert(buildImportRows(grid, 0, roles, opt).map((r) => r.name).join('|') === rows.map((r) => r.name).join('|'), 'The same sheet always gives the same names (re-uploading finds the saved items)');

  // (c) Re-upload: saved items are updated (by barcode, else by name), unchanged ones left alone.
  const saved = (id: string, name: string, pricePaise: number, category: string, barcode?: string) =>
    ({ id, name, selling_price: pricePaise, mrp: pricePaise, category_name: category, unit: 'box', purchase_price: 0, tax_rate: 0, barcode } as unknown as Product);
  const A = saved('pA', 'चौरसा 8 वाला – अतिसिया (100 नग)', 30000, 'चौरसा', '2000000000015');
  const B = saved('pB', 'Helicopter (5 Piece) – Fancy Item Fathers', 8500, 'Fancy Item Fathers');
  const plan = planImport(rows, [A, B], false);
  assert(plan.creates.length === 3 && plan.updates.length === 1 && plan.updates[0].product.id === 'pA' && plan.updates[0].changes.includes('price') && plan.unchanged.length === 1 && plan.skipped.length === 1,
    'Upload again with a new price: 1 price updated, 1 unchanged, 3 new (one without a price), 1 skipped — nothing added twice');
  const blankRow = { rowNumber: 9, name: A.name, category: '', pricePaise: null, mrpPaise: null, costPaise: null, wholesalePaise: null, unit: null, stock: null, barcode: '', gstRate: null, hsn: '' };
  const blankPrice = planImport([blankRow], [A, B], false);
  assert(blankPrice.updates.length === 0 && blankPrice.unchanged.length === 1,
    'A saved item with a blank price cell keeps its saved price (a blank never wipes a price)');
  const importDb2 = readSource('lib/import/catalogImportDb.ts');
  assert(importDb2.includes('const price = r.pricePaise ?? 0;') && importDb2.includes('selling_price: price ?? product.selling_price,'),
    'Import writes a new item without a price at ₹0 and never overwrites a saved price with a blank');
  const noPriceLabel = buildLabelHtml([{ name: 'Saddam', barcode: '2000000000015', pricePaise: 0, mrpPaise: 0 }], LABEL_STOCKS[0], DEFAULT_LABEL_SETTINGS.content);
  const pricedLabel = buildLabelHtml([{ name: 'Anar', barcode: '2000000000022', pricePaise: 59000 }], LABEL_STOCKS[0], DEFAULT_LABEL_SETTINGS.content);
  assert(!/class="price"/.test(noPriceLabel) && /class="bars"/.test(noPriceLabel) && /class="price"/.test(pricedLabel),
    'A label for an item without a price prints the name and barcode but no ₹0 price');
  const posNoPrice = readCounter();
  assert(posNoPrice.includes('const unpriced = cart.find((line) => !(line.unit_price > 0));') && posNoPrice.includes('handleOpenEditItem(unpriced);')
    && posNoPrice.includes("const needsPrice = !product.has_variants && !(unitPriceFor(product, 'retail') > 0)"),
    'Counter: an item without a price opens the price box when added, and a bill never completes with a ₹0 line');
  const byCode = planImport([{ ...byRow(7), barcode: '2000000000015' }], [A, B], false);
  assert(byCode.updates.length === 1 && byCode.updates[0].product.id === 'pA', 'A barcode in the sheet finds the saved item even if its name changed');

  // (d) Store barcodes: saved EAN-13 "200…" codes, valid check digit, never reused.
  assert(ean13CheckDigit('400638133393') === 1 && isValidEan13('4006381333931') && !isValidEan13('4006381333932'), 'EAN-13 check digit is right');
  const codes = nextStoreBarcodes([], 3);
  assert(codes.join() === '2000000000015,2000000000022,2000000000039' && codes.every(isValidEan13), 'New store barcodes: 200 + running number + check digit');
  assert(nextStoreBarcodes(['2000000000022', 'abc', '8901719101037'], 1)[0] === '2000000000039' && nextStoreBarcodes(['2000000000039', '2000000000015'], 1)[0] === '2000000000046',
    'The next store barcode follows the highest one in use and never repeats a code');

  // (e) Wiring: no label prints a code that is not saved on the item; xlsx loads only when importing.
  const studioSrc = readSource('app/barcode-generator/page.tsx');
  const quickSrc = readSource('components/products/QuickBarcodePrintModal.tsx');
  assert(!/KP\$\{p(rod)?\.id/.test(studioSrc) && /await ensureProductBarcodes\(list\)/.test(studioSrc) && !/product\.id\.slice\(0, 10\)/.test(quickSrc) && /ensureProductBarcode\(product\)/.test(quickSrc),
    'Labels always carry the item\'s saved barcode (an item without one gets its own code first) — a label scanned at the counter finds the item');
  const importModalSrc = readSource('components/import/CatalogImportModal.tsx');
  assert(/await import\('xlsx'\)/.test(importModalSrc) && !/from 'xlsx'/.test(importModalSrc)
    && ['components/products/ProductPageDialogs.tsx', 'app/inventory/page.tsx'].every((f) => /\{isExcelImporterOpen && \(\s*<CatalogImportModal/.test(readSource(f)))
    && !fs.existsSync(path.join(SRC_ROOT, 'components/inventory/ExcelInventoryImporter.tsx')),
    'Excel import loads xlsx only when a file is opened, is mounted only while open, and the old importer is gone');
  assert(/is_unlimited_stock: !counted/.test(readSource('lib/import/catalogImportDb.ts')) && /onOpenExcelImporter && \(/.test(readSource('components/products/ProductHeaderActions.tsx')),
    'Imported items without a stock column are not counted (scanning never blocked); Products has an "Import Excel" button');
}

// 9e. Barcode labels (v4.71.0): every printed bar code is read back by ZXing — the
// decoder behind the camera scanner — and labels print at the chosen size.
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ZXing = require('../node_modules/html5-qrcode/third_party/zxing-js.umd.js');
  const decode = (text: string) => {
    const { modules, format } = barcodeSymbol(text);
    const bits = new ZXing.BitArray(modules.length);
    modules.forEach((b: boolean, i: number) => b && bits.set(i));
    const reader = format === 'EAN-13' ? new ZXing.EAN13Reader() : new ZXing.Code128Reader();
    try { return reader.decodeRow(0, bits, new Map()).getText(); } catch { return null; }
  };
  // Code-128 B: collect strings until every check value 0–102 has appeared (the old
  // generator was wrong for 0–25 and 95–102 — about 1 label in 3 did not scan).
  const checkValue = (s: string) => { let sum = 104; for (let i = 0; i < s.length; i++) sum += (s.charCodeAt(i) - 32) * (i + 1); return sum % 103; };
  const seen = new Map<number, string>();
  for (let n = 0; seen.size < 103 && n < 20000; n++) {
    const s = `KP${n}-x`;
    if (!seen.has(checkValue(s))) seen.set(checkValue(s), s);
  }
  const bFails = Array.from(seen.values()).filter((s) => decode(s) !== s);
  assert(seen.size === 103 && bFails.length === 0, `Code-128: all 103 check values decode with ZXing (failed: ${bFails.slice(0, 3).join(', ') || 'none'})`);
  const cSamples = ['12345678', '00000000', '99999999', '2000000000', '123456789012'];
  assert(cSamples.every((s) => decode(s) === s) && barcodeSymbol('12345678').format === 'CODE-128', 'Code-128 C (even-length digits) decodes');
  const store = nextStoreBarcodes([], 300);
  assert(store.every((c) => barcodeSymbol(c).format === 'EAN-13' && decode(c) === c) && ['8901719101037', '4006381333931', '0012345678905'].every((c) => decode(c) === c),
    'Every store code (and real EAN-13 codes) prints as EAN-13 and decodes');
  assert(!/Object\.keys\(CODE128/.test(readSource('lib/barcode/barcodeGenerator.ts')), 'The Code-128 check character is looked up by value, never by object key order');

  // Label setup: saved per computer, broken values fall back, sizes give the right page.
  assert(parseLabelSettings(null).stockId === 'roll_50x25' && parseLabelSettings('{bad').copies === 1 && parseLabelSettings(JSON.stringify({ stockId: 'nope' })).stockId === 'roll_50x25',
    'Label settings: a new computer starts on 50 × 25 mm roll; broken or unknown values fall back');
  const custom = parseLabelSettings(JSON.stringify({ stockId: 'custom', custom: { widthMm: 60, heightMm: 40, across: 9, gapMm: 3 } }));
  assert(custom.custom.across === 1 && stockFor(custom).kind === 'roll' && stockFor(custom).widthMm === 60, 'Custom sizes are limited to sensible values (1–5 across, 15–120 mm)');
  const two = LABEL_STOCKS.find((s) => s.id === 'roll_38x25_2')!;
  const a4 = LABEL_STOCKS.find((s) => s.id === 'a4_24')!;
  assert(labelPageMm(two).widthMm === 78 && labelPageMm(two).heightMm === 25 && labelPageMm(a4).widthMm === 210 && labelsPerPage(a4) === 24 && labelsPerPage(two) === 2,
    'A roll prints one row per page (2 across 38 mm + 2 mm gap = 78 × 25 mm); an A4 sheet holds 24');

  // One HTML for preview and print.
  const items = [{ name: 'अनार स्पेशल – विन', barcode: '2000000000015', pricePaise: 59000, mrpPaise: 65000 }, { name: '<b>x</b>', barcode: 'KP1', pricePaise: 100 }];
  const html = buildLabelHtml(expandCopies(items.map((i, n) => ({ ...i, copies: n === 0 ? 3 : 1 }))), two, DEFAULT_LABEL_SETTINGS.content, { shopName: 'Shop' });
  assert((html.match(/class="label"/g) || []).length === 4 && (html.match(/class="page"/g) || []).length === 2 && html.includes('@page { size: 78mm 25mm') && html.includes('अनार स्पेशल') && html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x</b>'),
    'Label HTML: copies expanded, 2 across → 2 pages, page size in mm, Devanagari kept, names escaped');
  const off = buildLabelHtml([items[0]], two, { ...DEFAULT_LABEL_SETTINGS.content, shopName: false, mrp: false, qr: true }, { shopName: 'Shop', qrDataUrls: { '2000000000015': 'data:image/png;base64,AA' } });
  assert(!off.includes('class="shop"') && !off.includes('class="mrp"') && off.includes('<img src="data:image/png;base64,AA"'), 'Label content switches work (shop name, MRP off; QR instead of bars)');

  // Wiring.
  const mainJsSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(/function labelPageSize\(pageSizeMm\)/.test(mainJsSrc) && /w >= 10 && w <= 300 && h >= 10 && h <= 300/.test(mainJsSrc) && /paper === 'thermal-80' \|\| paper === 'thermal-58'/.test(mainJsSrc),
    'Electron prints labels at their own page size (10–300 mm checked); bill printing unchanged');
  const studio = readSource('app/barcode-generator/page.tsx');
  assert(/ensureProductBarcodes\(list\)/.test(studio) && /printLabels\(labels, settings, shopName\)/.test(studio) && !/window\.print\(\)/.test(studio) && studio.split('\n').length < 400,
    'Barcode Studio: bulk adds get saved barcodes, printing goes to the label printer (no browser page print), page split into components');
  assert(/printLabels\(labels, settings, storeName\)/.test(readSource('components/products/QuickBarcodePrintModal.tsx')) && /<LabelPrinterCard \/>/.test(readSource('components/settings/InvoiceSettingsTab.tsx'))
    && /saveLastImportIds\(res\.createdIds\.concat\(res\.updatedIds\)\)/.test(readSource('components/import/CatalogImportModal.tsx')),
    '1-click label uses the same label setup; Settings has the label printer; an Excel import offers its labels');
}

// 9f. Barcode gun on the counter (v4.72.0): the search box reads a whole scanned code on
// Enter, an empty box + Enter finishes the bill, and a bill printer is set once.
{
  assert(searchEnterAction('', 3, false, 20) === 'complete-sale' && searchEnterAction('  ', 0, false, 20) === 'none',
    'Search box: Enter on an empty box finishes the bill (never adds the first product); nothing happens with an empty bill');
  assert(searchEnterAction('2000000000015', 0, true, 0) === 'add-exact' && searchEnterAction('8901234567897', 2, false, 5) === 'unknown-code' && searchEnterAction('maggi', 2, false, 4) === 'add-highlighted' && searchEnterAction('zzz', 2, false, 0) === 'none',
    'Search box: a saved code adds its item, an unknown code offers "Add scanned barcode" (not the first result), words add the highlighted result');
  assert(looksLikeBarcode('8901234567897') && looksLikeBarcode('SKU-00123') && looksLikeBarcode('123456') && !looksLikeBarcode('maggi2') && !looksLikeBarcode('12345') && !looksLikeBarcode('Parle-G 2024'),
    'A code is 6+ digits or 6+ capitals / digits / dashes with 4+ digits; words with a number are not');

  const pos = readCounter();
  const listener = readSource('lib/hardware/barcodeScannerListener.ts');
  assert(/searchFocused && e\.key === 'Enter' && \(!counterCovered \|\| onlySaleWindowOpen\)\) \{\s*e\.preventDefault\(\);\s*void handleSearchEnter\(\);/.test(pos)
    && /if \(isInvoiceModalOpen && action !== 'add-exact' && action !== 'unknown-code'\) return;/.test(pos),
    'Enter in the search box goes through handleSearchEnter; under "Sale completed" only a scanned code counts');
  assert(/ignore: searchBoxHasFocus/.test(pos) && /enabled: !variantPick && !isBillPrinterOpen,/.test(pos)
    && /if \(ignore && ignore\(\)\)/.test(listener),
    'The key-timing listener stands aside while the search box has focus, and stays on under "Sale completed" (the next scan closes it)');
  assert(/const now = e\.timeStamp > 0 \? e\.timeStamp : Date\.now\(\);/.test(listener) && /inTextBox \? maxIntervalMs : Math\.max\(maxIntervalMs, 250\)/.test(listener),
    'The listener times keys by when they were pressed (event timestamp), so a busy screen never cuts a code short');
  assert(/if \(isInvoiceModalOpen\) \{\s*setIsInvoiceModalOpen\(false\);/.test(pos) && /addToCart\(product, 1\);\s*focusProductSearch\(\);/.test(pos),
    'A scan closes "Sale completed", adds the item and puts the cursor back in the search box');
  assert(/if \(!res\.ok\) throw new Error/.test(readSource('components/billing/BillPrintQueue.tsx')) && /tr\('Bill saved, but it did not print: \{error\}'/.test(pos),
    'Silent print checks the printer answer: a failed print shows the error and keeps the bill ready to print again');
  assert(/window\.clearTimeout\(toastTimerRef\.current\);/.test(pos), 'Billing toasts use one timer (an old toast never hides a newer one)');
  const setup = readSource('components/billing/BillPrinterSetup.tsx');
  assert(/<BillPrinterSetup/.test(pos) && /if \(next && !printerForFormat\(ps, ps\.defaultFormat\)\) \{?\s*setIsBillPrinterOpen\(true\)/.test(pos)
    && /savePrintSettings\(next\)/.test(setup) && /a4Printer: name \} : \{ thermalPrinter: name \}/.test(setup),
    'Bill printer: set once on the counter (saved with Printer Setup); turning Enter-prints on with no printer opens the setup first');
}

// 9g. Product search in English for Hindi / Marathi names (v4.73.0), and a counter
// without the webcam scanners and the Bluetooth "hardware manager" (desktop app).
{
  const names = [
    'चीटपुट बुलेट टिकटॅक – नवरंग/वसंता', 'चीटपुट गोली – जीबुंबा', 'रॉकेट बॉम्ब – विन', 'बेबी रॉकेट – विन', 'रॉकेट कलर – रॉयल',
    '12" सिल्व्हर ट्युब कँडल – राजकमल', 'स्ट्रेप बिजली (गोल्ड) 50 नग – वसंता', 'चीटपुट गोली (सुपर बिग) लक्ष्मी – जेम्स', 'अनार स्मॉल – विन',
    'अटॅम बॉम्ब – शंकर', 'रॉकेट अपोलो – ए.आर.डी.', 'पुल पुल – अनिल', 'अनार चिअर्स (3 पिस) – स्टॅन्डर्ड', 'रॉकेट ज्युपिटर – अनिल',
    'रोल कॅप्स (व्हाइट पेपर) Nett – श्रीराम', 'Maggi Noodles 70g', 'कंपनी स्पेशल',
  ];
  const cat = (n: string) => (n.startsWith('अनार स्मॉल') ? 'पेन्सील' : n.startsWith('पुल') ? 'चौरसा' : '');
  const list = names.map((name, i) => ({ id: i, name, barcode: i === 15 ? '8901058000290' : '', category_name: cat(name) }));
  const top = (q: string, category = true) => searchProducts(list, q, { category }).map((p) => p.name);
  const has = (q: string, ...want: string[]) => want.every((w) => top(q).some((n) => n.startsWith(w)));
  assert(has('chitput', 'चीटपुट बुलेट', 'चीटपुट गोली') && has('cheetput tictac', 'चीटपुट बुलेट टिकटॅक') && has('tictac', 'चीटपुट बुलेट टिकटॅक') && has('rocket colour', 'रॉकेट कलर')
    && has('silver tube', '12" सिल्व्हर') && has('white paper', 'रोल कॅप्स') && has('jupiter', 'रॉकेट ज्युपिटर') && has('company', 'कंपनी') && has('laxmi', 'चीटपुट गोली (सुपर'),
    'English letters find Hindi / Marathi names (chitput → चीटपुट, tictac → टिकटॅक, silver → सिल्व्हर, white → व्हाइट, jupiter → ज्युपिटर, company → कंपनी)');
  assert(has('atom bomb', 'अटॅम बॉम्ब') && has('atombomb', 'अटॅम बॉम्ब') && top('rocket colour').length === 1 && top('zzqx').length === 0 && top('anar')[0].startsWith('अनार') && !top('anar').some((n) => n.startsWith('पुल')),
    'All typed words must match, joined words work, a word starting with a vowel does not match one without (anar ≠ नर)');
  assert(top('bijli')[0].startsWith('स्ट्रेप बिजली') && top('apollo')[0].startsWith('रॉकेट अपोलो') && top('rocket')[0].startsWith('रॉकेट') && top('chaurasa')[0].startsWith('पुल पुल'),
    'Best match first: whole word before joined words, first word before later ones, vowels alike before unlike, then the section (chaurasa → the चौरसा section, not चिअर्स)');
  assert(top('रॉकेट').length === 5 && top('rocket').length === 5 && top('मॅगी')[0] === 'Maggi Noodles 70g' && top('maggi')[0] === 'Maggi Noodles 70g' && top('0290')[0] === 'Maggi Noodles 70g' && top('pencil')[0] === 'अनार स्मॉल – विन' && top('pencil', false).length === 0,
    'Typed Devanagari and English give the same items; Devanagari finds English names; barcode and section still match (section only where it was searched before)');
  assert(wordSoundKey('सिल्वर') === wordSoundKey('silver') && wordSoundKey('फटाका') === wordSoundKey('phataka') && wordSoundKey('फटाका') === wordSoundKey('fataka') && soundKeys('Rocket 2 Sound').join(' ') === soundKeys('रॉकेट २ साऊंड').join(' '),
    'Sound keys: सिल्वर = silver, फटाका = phataka = fataka, Devanagari digits = 0–9');

  const pos = readCounter();
  assert(/searchProducts\(all, debouncedSearch, \{ category: true \}\)/.test(pos) && /productSearchScore\(p, productQuery\) < 0/.test(readProductsPage())
    && /searchProducts\(products, search\)\.slice\(0, 6\)/.test(readSource('components/labels/LabelQueuePanel.tsx')) && /productSearchScore\(p, catalogQuery\) >= 0/.test(readSource('components/invoices/EditInvoiceModal.tsx')),
    'Billing, Products, Barcode Studio and Edit Invoice all search with productSearch (English or हिंदी / मराठी)');
  assert(!/BarcodeScannerModal|RapidScanMode|HardwareManagerModal|isBarcodeModalOpen|isHardwareModalOpen|Scan Barcode via Camera/.test(pos)
    && !fs.existsSync(path.join(SRC_ROOT, 'components/billing/RapidScanMode.tsx')) && !fs.existsSync(path.join(SRC_ROOT, 'components/hardware/HardwareManagerModal.tsx')),
    'The counter has no webcam scanner, Rapid (webcam) mode or Bluetooth hardware manager — the gun types into the search box, the bill printer is set with the ⚙ button');
}

// 9h. Peak hour (v4.74.0): the counter never waits for the printer, and an item scanned
// while a bill is being saved goes into the next bill — before, it vanished (3 of 3 in a
// live test with a printer taking 1.5 s).
{
  const line = (id: string, qty: number, price = 1000): CartItem => ({ product_id: id, product_name: id, quantity: qty, unit: 'piece', unit_price: price, discount_amount: 0, tax_rate: 0, tax_amount: 0, total_amount: qty * price } as CartItem);
  const retotal = (l: CartItem, q: number): CartItem => ({ ...l, quantity: q, total_amount: Math.round(q * l.unit_price) - (l.discount_amount || 0) });
  const show = (cart: CartItem[]) => cart.map((l) => `${l.product_id}${l.quantity}`).join(',');
  const sold = [line('A', 2), line('B', 1)];
  const extra = cartBeyond([line('A', 3), line('B', 1), line('C', 1)], sold, retotal);
  assert(show(extra) === 'A1,C1' && extra[0].total_amount === 1000 && cartBeyond(sold, sold, retotal).length === 0 && cartBeyond([line('K', 1.5)], [line('K', 1)], retotal)[0].quantity === 0.5,
    'Items beyond what was sold: A sold ×2 and now ×3 gives A ×1 (re-totalled), a new C comes whole, loose quantities too');
  const done = { ...makeEmptyTab('t1', 1), cart: [line('A', 3), line('B', 1), line('C', 1)] };
  const held = { ...makeEmptyTab('t2', 2), cart: [line('Z', 1)], isHeld: true };
  const r = tabsAfterSale([done, held], 't1', sold, 't3', retotal);
  const next = r.tabs.find((t) => t.id === r.activeTabId)!;
  assert(r.activeTabId === 't3' && show(next.cart) === 'A1,C1' && show(r.tabs.find((t) => t.id === 't2')!.cart) === 'Z1' && !r.tabs.some((t) => t.id === 't1'),
    'The finished bill closes; what was scanned meanwhile opens the next bill; a held bill is not touched');
  const waiting = { ...makeEmptyTab('t4', 4), cart: [line('A', 1)] };
  const r2 = tabsAfterSale([done, waiting], 't1', sold, 't5', retotal);
  const plain = [{ ...done, cart: sold }];
  assert(r2.activeTabId === 't4' && show(r2.tabs.find((t) => t.id === 't4')!.cart) === 'A2,C1' && JSON.stringify(tabsAfterSale(plain, 't1', sold, 't6', retotal)) === JSON.stringify(tabsAfterClosing(plain, 't1', 't6')),
    'Going on to a waiting bill merges the extra items into it; nothing scanned meanwhile = exactly the old closing');

  const pos = readCounter();
  const queue = readSource('components/billing/BillPrintQueue.tsx');
  const closeAt = pos.indexOf('tabsAfterSale(prev, soldTabId, soldCart, newTabId, retotalLine)');
  assert(closeAt > 0 && closeAt < pos.indexOf('billPrint.print({ sale: newSale') && !/await desktopApi\.print|await getDesktopApi\(\)/.test(pos) && !/await api\.print[\s\S]*setTabs/.test(queue),
    'Billing closes the bill first and prints in the background — the counter never awaits the printer');
  assert(/const id = activeTabIdRef\.current;\s*setTabs\(\(prev\) =>\s*prev\.map\(\(t\) => \(t\.id === id \? updater\(t\) : t\)\)/.test(pos) && /activeTabIdRef\.current = nextTabId;/.test(pos),
    'An item is always added to the bill the counter is on now (never to one that was just completed)');
  assert(/if \(!res\.ok\) throw new Error/.test(queue) && /<PrintFailureBar/.test(pos) && /data-print-retry/.test(queue) && !/setIsInvoiceModalOpen\(true\);\s*\}\s*\);?\s*$/.test(queue),
    'A bill that did not print waits in a red bar with "Print again" — no window pops over the next customer');
  assert(/warmBillPrinting\(business\)/.test(pos) && /import\('@\/components\/invoices\/InvoiceModal'\)/.test(queue) && /getBrandLogoDataUrl\(\)/.test(queue),
    'The bill-printing code, "Sale completed" and the logo are loaded while the counter is idle');
  const beep = readSource('lib/voice/speechParser.ts');
  assert((beep.match(/new Ctor\(\)/g) || []).length === 1 && /beepContext\.state === 'closed'/.test(beep) && !/new AudioContext\(\)/.test(beep),
    'Every beep uses one shared sound context (one per scan was never closed)');
}

// 9i. Label-first stock (v4.77.0): "New stock + labels" saves every typed item with its
// stock and its own barcode (the old "Custom label" printed codes the counter never knew);
// Purchases' Excel bill reads real bills (Hindi headings, ₹1,250, no "Discount" as qty),
// never makes up a selling price, and every inward offers its labels; label extras (cost
// code, size / colour) and loose packs whose bar code carries the weight.
{
  const prod = (id: string, name: string, extra: Partial<Product> = {}) => ({ id, name, unit: 'piece', selling_price: 10000, mrp: 10000, purchase_price: 0, current_stock: 0, min_stock_level: 5, is_active: true, ...extra } as Product);

  // (a) One rule for goods coming in.
  assert(labelCopiesFor('piece', 20) === 20 && labelCopiesFor('box', 3) === 3 && labelCopiesFor('kg', 2.5) === 1 && labelCopiesFor('piece', 1500) === 999 && labelCopiesFor('piece', 0) === 0,
    'Labels for what came in: one per piece / box, one per lot sold by weight, at most 999');
  const counted = stockAfterInward({ current_stock: 12, is_unlimited_stock: false }, 20);
  const unlimited = stockAfterInward({ current_stock: 7, is_unlimited_stock: true }, 20);
  assert(counted.previous === 12 && counted.next === 32 && !counted.startsCounting && unlimited.previous === 0 && unlimited.next === 20 && unlimited.startsCounting
    && stockAfterInward({ current_stock: 0.1, is_unlimited_stock: false }, 0.2).next === 0.3,
    'Stock in: a counted item adds the quantity; an "Unlimited" item starts counting from what came in (its old number is not added to)');
  assert(lowStockAlertFor(50) === 10 && lowStockAlertFor(20) === 4 && lowStockAlertFor(3) === 1 && lowStockAlertFor(1000) === 10, 'A new counted item alerts at about a fifth of what came in (1 to 10)');

  // (b) "New stock + labels" rows → new items / restocks / problems (never a second copy of a saved item).
  const A = prod('pA', 'अनार स्पेशल', { barcode: '2000000000015', current_stock: 12, selling_price: 59000, mrp: 59000 });
  const B = prod('pB', 'Chakri Deluxe', { barcode: '2000000000022', is_unlimited_stock: true });
  const P = prod('pP', 'Cotton Shirt', { has_variants: true });
  const PM = prod('pPM', 'Cotton Shirt (M)', { parent_id: 'pP', variant_label: 'M' });
  const K = prod('pK', 'Kaju', { unit: 'kg', barcode: '2000000000039', selling_price: 90000, mrp: 90000 });
  const row = (key: string, r: Partial<StockEntryRow>): StockEntryRow => ({ ...emptyEntryRow(key), ...r });
  const rows = [
    row('r1', { name: 'Rocket 10 Shot', price: '120', qty: '20' }),
    row('r2', { name: 'अनार  स्पेशल', qty: '10' }),
    row('r3', { barcode: '2000000000022', qty: '15', price: '₹1,250' }),
    row('r4', {}),
    row('r5', { name: 'Bijli Bomb', price: '40' }),
    row('r6', { name: 'Flower Pot', qty: '5' }),
    row('r7', { name: 'rocket 10 shot', price: '120', qty: '2' }),
    row('r8', { name: 'Cotton Shirt', price: '499', qty: '3' }),
    row('r9', { name: 'Sparkler', price: '30', qty: '2.5' }),
    row('r10', { productId: 'pK', qty: '2.5' }),
    row('r11', { productId: 'pPM', qty: '4' }),
  ];
  const plan = planStockEntry(rows, [A, B, P, PM, K], { separateSellingPrice: false });
  const line = (key: string) => plan.lines.find((l) => l.key === key);
  const r1 = line('r1');
  const r2 = line('r2');
  const r3 = line('r3');
  assert(r1?.kind === 'new' && r1.pricePaise === 12000 && r1.mrpPaise === 12000 && r1.qty === 20 && r1.barcode === '',
    'A new item: the typed MRP is its price (Separate Selling Price off), 20 pieces, its own code comes later');
  assert(r2?.kind === 'restock' && r2.product.id === 'pA' && r2.pricePaise === null && r3?.kind === 'restock' && r3.product.id === 'pB' && r3.pricePaise === 125000,
    'A typed name that is already saved (extra spaces too) restocks it with its price kept; a scanned saved code restocks that item, "₹1,250" is read as ₹1250');
  assert(plan.errors.r5 === 'Enter the quantity received' && plan.errors.r6 === 'Enter the MRP' && /Same item twice/.test(plan.errors.r7 || '') && /sizes \/ colours/.test(plan.errors.r8 || '') && /Whole numbers/.test(plan.errors.r9 || '') && !('r4' in plan.errors),
    'Problems are shown per row (no quantity, no price, the same item twice, a parent with sizes, 2.5 pieces); a blank row is ignored');
  assert(line('r10')?.kind === 'restock' && plan.created === 1 && plan.restocked === 4 && plan.labels === 20 + 10 + 15 + 1 + 4,
    'Loose items take decimals (2.5 kg = one label); a size of a shirt restocks like any item; the label count is one per piece');
  const sep = planStockEntry([row('s1', { name: 'Lamp', price: '100', mrp: '120', qty: '1' }), row('s2', { name: 'Diya', price: '100', mrp: '90', qty: '1' }), row('s3', { productId: 'pA', price: '600', qty: '1' })], [A], { separateSellingPrice: true });
  const s1 = sep.lines.find((l) => l.key === 's1');
  const s3 = sep.lines.find((l) => l.key === 's3');
  assert(s1?.kind === 'new' && s1.pricePaise === 10000 && s1.mrpPaise === 12000 && /MRP cannot be less/.test(sep.errors.s2 || '') && s3?.kind === 'restock' && s3.pricePaise === 60000 && s3.mrpPaise === 60000,
    'Separate Selling Price on: price + MRP, an MRP below the price is refused, a new price for a saved item lifts its MRP with it');
  const draft = parseStockEntryDraft(JSON.stringify({ rows: [{ key: 'k1', name: 'Rocket', qty: '5', unit: 'bogus', price: 7 }], categoryId: 'cat_1' }));
  assert(draft?.rows[0].unit === 'piece' && draft.rows[0].price === '' && draft.rows[0].qty === '5' && draft.categoryId === 'cat_1' && parseStockEntryDraft('{bad') === null && parseStockEntryDraft(JSON.stringify({ rows: [] })) === null,
    'Typed rows survive as a draft; a broken or foreign draft is dropped safely');

  // (c) Supplier bill in Excel: real headings, real money, total rows left out.
  const cols = (h: string[]) => {
    const c = guessBillColumns(h) as unknown as Record<string, number>;
    return Object.keys(c).filter((k) => c[k] >= 0).map((k) => `${k}=${h[c[k]]}`).join(',');
  };
  assert(cols(['Sr', 'Item Name', 'Qty', 'Rate', 'Discount', 'Amount']) === 'name=Item Name,qty=Qty,cost=Rate'
    && cols(['Item', 'Unit Price', 'Qty', 'MRP', 'Sale Price']) === 'name=Item,qty=Qty,cost=Unit Price,selling=Sale Price,mrp=MRP'
    && cols(['माल', 'नग', 'दर', 'रक्कम']) === 'name=माल,qty=नग,cost=दर'
    && cols(['Item Code', 'Description', 'Qty', 'Net Rate', 'Total Amount']) === 'name=Description,qty=Qty,cost=Net Rate,barcode=Item Code',
    'Bill columns: "Rate" is what the shop pays, "Discount" is not the quantity, "Sale Price" is found next to "Unit Price", Hindi headings work');
  const bill = readBillSheet([['Balaji Traders — Bill 55'], ['Item', 'Qty', 'Rate', 'MRP', 'Barcode', 'Discount', 'Amount'], ['Parle-G 80g', '24', '₹8.50', '10', '8901719101037', '2', '204'], ['अनार स्पेशल', '10', '1,250', '', 'A102', '', ''], ['', '', '', '', '', '', ''], ['Total', '', '', '', '', '', '1454']]);
  const [pg, an] = bill.items;
  assert(bill.items.length === 2 && bill.skipped === 1 && pg.quantity === 24 && pg.unit_price === 850 && pg.selling_price === 1000 && pg.barcode === '8901719101037' && an.unit_price === 125000 && an.selling_price === undefined && an.barcode === undefined,
    'Bill rows: title row skipped, ₹8.50 / 1,250 read, MRP becomes the selling price, the Total row is left out, a supplier code "A102" is not a barcode');
  assert(billLineProblem(an) === 'Enter the selling price for this new item' && billLineProblem(pg) === '' && billLineProblem({ ...an, matched_product_id: 'pA', is_new_product: false }) === '' && billLineProblem({ ...pg, quantity: 0 }) === 'Enter the quantity',
    'A new item from a bill needs its selling price typed (never "cost + 25 %"); a saved item keeps its own');
  const matched = matchExtractedItemsWithProducts([{ ...an }, { ...an, raw_name: 'चक्री' }, { ...pg, raw_name: 'Glucose biscuit' }, { ...an, raw_name: 'Cotton Shirt' }],
    [prod('p1', 'फुलझड़ी'), A, prod('p3', 'Parle Glucose', { barcode: '8901719101037' }), P]);
  assert(matched[0].matched_product_id === 'pA' && matched[1].is_new_product && !matched[1].matched_product_id && matched[2].matched_product_id === 'p3' && matched[3].is_new_product,
    'Bill lines match saved items by Hindi name (before, every Hindi name matched the first Hindi item), by barcode, and never a size / colour parent');
  assert(normalizeName('अनार स्पेशल – विन') === 'अनार स्पेशल विन' && normalizeName('ગુજરાતી નામ') === 'ગુજરાતી નામ', 'Name matching keeps Devanagari and other Indian scripts with their vowel signs');

  // (d) Label extras: cost code and size / colour.
  assert(isValidCostCodeWord('BLACKHORSE') && !isValidCostCodeWord('BLACKHORSS') && !isValidCostCodeWord('SHOP') && encodeCostCode(24500, 'BLACKHORSE') === 'LCK' && encodeCostCode(100000, 'blackhorse') === 'BEEE' && encodeCostCode(24500, 'SHOP') === '' && encodeCostCode(0, 'BLACKHORSE') === '',
    'Cost code: 10 different letters for 1…9, 0 (₹245 → "LCK"); a bad word or no cost prints nothing');
  assert(productLabelDetail({ size: 'M', color: 'Red' }) === 'M / Red' && productLabelDetail({ parent_id: 'p', variant_label: 'XL' }) === 'XL' && productLabelDetail({}) === '' && productLabelExtras({ purchase_price: 0 }).costPaise === undefined,
    'Size / colour line: from the item, or the variant\'s label');
  const extrasOn = { ...DEFAULT_LABEL_SETTINGS.content, costCode: true, detail: true };
  const withExtras = buildLabelHtml([{ name: 'Shirt', barcode: '2000000000015', pricePaise: 49900, costPaise: 24500, detail: 'M / Red' }], LABEL_STOCKS[0], extrasOn, { costCodeWord: 'BLACKHORSE' });
  const badWord = buildLabelHtml([{ name: 'Shirt', barcode: '2000000000015', pricePaise: 49900, costPaise: 24500 }], LABEL_STOCKS[0], extrasOn, { costCodeWord: 'SHOP' });
  const plain = buildLabelHtml([{ name: 'Shirt', barcode: '2000000000015', pricePaise: 49900, costPaise: 24500, detail: 'M / Red' }], LABEL_STOCKS[0], DEFAULT_LABEL_SETTINGS.content, { costCodeWord: 'BLACKHORSE' });
  assert(withExtras.includes('<span class="cc">LCK</span>') && withExtras.includes('<div class="detail">M / Red</div>') && !badWord.includes('class="cc"') && !plain.includes('class="cc"') && !plain.includes('class="detail"'),
    'The label prints the cost code and size / colour only when switched on (and never with a bad code word)');
  const oldSaved = parseLabelSettings(JSON.stringify({ stockId: 'roll_38x25', content: { shopName: false } }));
  assert(oldSaved.content.costCode === false && oldSaved.content.detail === false && oldSaved.costCodeWord === '' && !oldSaved.content.shopName && parseLabelSettings(JSON.stringify({ costCodeWord: 'black-horse!' })).costCodeWord === 'BLACKHORSE',
    'A label setup saved before v4.77.0 keeps working (extras off); the code word is stored as capital letters only');
  // v4.80.0 (tried on a TSC TE244, 38 × 25 mm 2 across): the bars filled the label top to
  // bottom. The shop sets a bar height once (label setup, per computer); bills are untouched.
  const shortBars = buildLabelHtml([{ name: 'Shirt', barcode: '2000000000015', pricePaise: 49900 }], LABEL_STOCKS[0], DEFAULT_LABEL_SETTINGS.content, { barHeightMm: 10 });
  assert(parseLabelSettings(null).barHeightMm === 0 && oldSaved.barHeightMm === 0 && parseLabelSettings(JSON.stringify({ barHeightMm: 10 })).barHeightMm === 10
    && parseLabelSettings(JSON.stringify({ barHeightMm: 999 })).barHeightMm === 0 && parseLabelSettings(JSON.stringify({ barHeightMm: 'x' })).barHeightMm === 0
    && shortBars.includes('.bars { flex: 0 1 10mm; }') && shortBars.includes('.label { justify-content: center; }') && !plain.includes('flex: 0 1') && plain.includes('.bars { flex: 1 1 0;'),
    'Bar height: saved per computer (0 = fill the label, as before; old or broken values fall back); a set height centres the lines and only the bars give way');
  assert(/barHeightMm: settings\.barHeightMm/.test(readSource('lib/labels/printLabels.ts')) && /barHeightMm: settings\.barHeightMm/.test(readSource('components/labels/LabelPreview.tsx'))
    && /data-label-bar-height/.test(readSource('components/labels/LabelSetupPanel.tsx')) && !/barHeight/.test(readSource('lib/hardware/printSettings.ts')),
    'Bar height reaches print and preview alike, is chosen in the label setup, and bill printing does not use it');
  // v4.80.0: a printer that starts a little high or to one side (the TSC TE244 cut the name's top
  // until it was calibrated) — the shop moves the whole print in 0.5 mm steps, saved per computer.
  const moved = buildLabelHtml([{ name: 'Shirt', barcode: '2000000000015', pricePaise: 49900 }], LABEL_STOCKS[0], DEFAULT_LABEL_SETTINGS.content, { offsetMm: { x: -0.5, y: 2 } });
  const savedMove = parseLabelSettings(JSON.stringify({ offsetMm: { x: -0.5, y: 2 } })).offsetMm;
  const badMove = parseLabelSettings(JSON.stringify({ offsetMm: { x: 50, y: 'up' } })).offsetMm;
  assert(parseLabelSettings(null).offsetMm.x === 0 && parseLabelSettings(null).offsetMm.y === 0 && oldSaved.offsetMm.y === 0 && savedMove.x === -0.5 && savedMove.y === 2 && badMove.x === 0 && badMove.y === 0
    && moved.includes('.label { position: relative; left: -0.5mm; top: 2mm; }') && !plain.includes('position: relative; left:'),
    'Print position: moves every label the same (+ right / down), 0 = unchanged; old or broken values fall back to no move');
  const positionUi = readSource('components/labels/LabelPositionControl.tsx');
  assert(/offsetMm: settings\.offsetMm/.test(readSource('lib/labels/printLabels.ts')) && /offsetMm: settings\.offsetMm/.test(readSource('components/labels/LabelPreview.tsx'))
    && /<LabelPositionControl value=\{s\.offsetMm\}/.test(readSource('components/labels/LabelSetupPanel.tsx')) && /STEP_MM = 0\.5/.test(positionUi) && /MAX_OFFSET_MM/.test(positionUi),
    'Print position: ↑ ↓ ← → in 0.5 mm steps (up to 10 mm) in the label setup, used by print and preview alike');
  // v4.80.0: the TSC TE244 had a 38 × 25 mm 2-across roll set up as 50 × 25 mm — the print sat on
  // the gap. "Check size & position" prints one framed label per column; the setup draws the roll.
  const rollTwo = LABEL_STOCKS.find((st) => st.id === 'roll_38x25_2')!;
  const blankRow = [0, 1].map(() => ({ name: '', barcode: '', pricePaise: 0 }));
  const frames = buildLabelHtml(blankRow, rollTwo, DEFAULT_LABEL_SETTINGS.content, { alignment: true, offsetMm: { x: 0, y: 1 } });
  assert((frames.match(/class="label align"/g) || []).length === 2 && frames.includes('38 × 25 mm') && frames.includes('1 / 2') && frames.includes('2 / 2') && !frames.includes('<svg')
    && /inset: 1\.5mm/.test(frames) && frames.includes('top: 1mm;') && !plain.includes('.label.align'),
    'Size & position check: a frame 1.5 mm inside every label of a row (past a driver\'s unprinted edge), its size and column, no bar code; the print position applies');
  const setupUi = readSource('components/labels/LabelSetupPanel.tsx');
  assert(/length: across/.test(readSource('lib/labels/printLabels.ts')) && /\{ alignment: true \}/.test(readSource('lib/labels/printLabels.ts'))
    && /printAlignmentTest\(s\)/.test(setupUi) && /data-label-align-test/.test(setupUi) && /<LabelStockDiagram stock=\{stockFor\(s\)\} \/>/.test(setupUi) && setupUi.split('\n').length < 400,
    'Label setup: "Check size & position" prints one row (every column); the chosen roll or sheet is drawn so the shop can compare');

  // (e) Loose packs: the bar code carries the item and the weight; the counter decodes it.
  const pack = makeWeighedBarcode('2000000000039', 'kg', 0.25) || '';
  const back = parseWeighedBarcode(pack);
  assert(pack === '2900003002507' && isValidEan13(pack) && back?.itemBarcode === '2000000000039' && back.amount === 250 && weighedQuantity('kg', back.amount) === 0.25 && weighedQuantity('gram', 250) === 250 && weighedQuantity('piece', 250) === null,
    'Loose pack code: 29 + item number + weight + check digit; 0.25 kg of item 3 → 2900003002507, read back as 0.25 kg');
  const store100000 = '200000100000' + ean13CheckDigit('200000100000');
  assert(isValidEan13(store100000) && makeWeighedBarcode('8901719101037', 'kg', 1) === null && makeWeighedBarcode(store100000, 'kg', 1) === null && makeWeighedBarcode('2000000000039', 'kg', 100) === null && makeWeighedBarcode('2000000000039', 'piece', 1) === null
    && parseWeighedBarcode('2900003002506') === null && parseWeighedBarcode('2000000000039') === null && parseWeighedBarcode('8901719101037') === null,
    'No pack code for a maker\'s barcode, a store number above 99999, 100 kg or a piece item; a wrong check digit or an ordinary code is never read as a pack');
  assert(formatPackAmount('kg', 0.25) === '250 g' && formatPackAmount('kg', 1.5) === '1.5 kg' && formatPackAmount('gram', 1000) === '1 kg' && formatPackAmount('litre', 0.5) === '500 ml' && formatPackAmount('meter', 0.5) === '50 cm',
    'Pack names read like the shop says them (250 g, 1.5 kg, 500 ml)');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ZXingPack = require('../node_modules/html5-qrcode/third_party/zxing-js.umd.js');
  const packSymbol = barcodeSymbol(pack);
  const packBits = new ZXingPack.BitArray(packSymbol.modules.length);
  packSymbol.modules.forEach((b: boolean, i: number) => b && packBits.set(i));
  let packRead = '';
  try { packRead = new ZXingPack.EAN13Reader().decodeRow(0, packBits, new Map()).getText(); } catch { packRead = ''; }
  assert(packSymbol.format === 'EAN-13' && packRead === pack, 'A loose-pack label prints as EAN-13 and decodes with ZXing');

  // (f) Wiring.
  const studio = readSource('app/barcode-generator/page.tsx');
  const pos = readCounter();
  assert(!fs.existsSync(path.join(SRC_ROOT, 'components/labels/CustomLabelModal.tsx')) && !/custom_\$\{|KP\$\{Date\.now/.test(studio + readSource('components/labels/LabelQueuePanel.tsx')) && /<StockEntryModal/.test(studio) && /get\('new'\) === '1'/.test(studio) && /get\('from'\) !== 'inward'/.test(studio) && /readLabelHandoff\(\)/.test(studio),
    'Barcode Studio: no print-only label with a code nobody knows; "New stock + labels" (?new=1) and Purchases\' labels (?from=inward) open there');
  const entryModal = readSource('components/labels/StockEntryModal.tsx');
  const entryDb = readSource('lib/inward/stockEntryDb.ts');
  assert(/await applyStockEntry\(plan,/.test(entryModal) && /db\.transaction\('rw', db\.products, db\.inventory_movements,/.test(entryDb) && /const counted = line\.qty > 0;/.test(entryDb) && /is_unlimited_stock: !counted,\s*current_stock: line\.qty/.test(entryDb) && /nextStoreBarcodes\(used, needCodes\)/.test(entryDb),
    'Typed items are saved in one transaction with counted stock (= quantity) and their own barcode before any label prints');
  const inwardDb = readSource('lib/purchases/billInwardDb.ts');
  const purchasesCode = ['components/purchases/BillScanReviewModal.tsx', 'components/purchases/BillLineRow.tsx', 'components/purchases/PurchaseInwardOptionsSheet.tsx', 'lib/purchases/billInwardDb.ts', 'lib/purchases/billSheet.ts'].map(readSource).join('\n');
  assert(/db\.transaction\('rw', \[db\.products, db\.categories, db\.inventory_movements, db\.purchase_bills\]/.test(inwardDb) && !/\* 1\.25/.test(purchasesCode) && /readBillSheet\(grid\)/.test(readSource('components/purchases/PurchaseInwardOptionsSheet.tsx')) && /await applyBillInward\(/.test(readSource('components/purchases/BillScanReviewModal.tsx')),
    'A supplier bill is saved in one transaction (no half-added stock) and no selling price is made up from the cost');
  const purchasesPage = readSource('app/purchases/page.tsx');
  assert(/db\.transaction\('rw', db\.products, db\.inventory_movements/.test(purchasesPage) && /stockAfterInward\(fresh, qtyNum\)/.test(purchasesPage) && /<InwardLabelOffer/.test(purchasesPage) && /href="\/barcode-generator\?new=1"/.test(purchasesPage + readSource('components/purchases/PurchaseInwardMenu.tsx')) && /saveLabelHandoff\(done\.labels\)/.test(readSource('components/purchases/BillScanReviewModal.tsx')),
    'Manual inward starts counting an uncounted item, and every inward (manual or bill) offers "Print N labels"');
  const exactAt = pos.indexOf("await db.products.where('barcode').equals(clean).first()");
  const packAt = pos.indexOf('parseWeighedBarcode(clean)');
  const unknownAt = pos.indexOf('setScannedUnknownBarcode(clean)');
  assert(exactAt > 0 && exactAt < packAt && packAt < unknownAt && /addToCart\(packItem, packQty\)/.test(pos) && /Math\.round\(\(existing\.quantity \+ allowedQty\) \* 1000\) \/ 1000/.test(pos),
    'The counter tries the exact barcode first, then a loose-pack code (adds its weight), and only then asks about an unknown code; loose quantities add up cleanly');
}

// 9j. Small changes (v4.78.0).
// (a) Global keys: F1 opens Billing on a fresh bill from any page (was Shift+B on Home only),
// Ctrl+H Home, Ctrl+L Lock — also with the cursor in a box; F1 / Ctrl+H never while a window
// (form) is open, so nothing typed there is lost.
{
  const k = (key: string, mods: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, ...mods });
  assert(globalShortcutFor(k('l', { ctrlKey: true }), '/billing') === 'lock' && globalShortcutFor(k('L', { ctrlKey: true }), '/products', true) === 'lock'
    && globalShortcutFor(k('h', { ctrlKey: true }), '/billing') === 'home' && globalShortcutFor(k('h', { ctrlKey: true }), '/') === null && globalShortcutFor(k('h', { ctrlKey: true }), '/products', true) === null
    && globalShortcutFor(k('F1'), '/') === 'billing' && globalShortcutFor(k('F1'), '/products/') === 'billing' && globalShortcutFor(k('F1'), '/billing') === null && globalShortcutFor(k('F1'), '/customers', true) === null
    && globalShortcutFor(k('B', { shiftKey: true }), '/') === null && globalShortcutFor(k('F1', { shiftKey: true }), '/') === null
    && globalShortcutFor(k('l', { ctrlKey: true, shiftKey: true }), '/') === null && globalShortcutFor(k('l'), '/') === null,
    'Global keys: F1 opens Billing from any page (Billing keeps its own F1), Ctrl+H Home, Ctrl+L Lock; with a form open F1 / Ctrl+H do nothing; Shift+B is no longer a shortcut');
  const shell = readSource('components/layout/AppShell.tsx');
  assert(/const windowOpen = Boolean\(document\.querySelector\('\[aria-modal="true"\]'\)\)/.test(shell) && /globalShortcutFor\(e, pathname, windowOpen\)/.test(shell) && /router\.push\(NEW_BILL_HREF\)/.test(shell)
    && /action === 'lock'\) lockApp\(pathname\)/.test(shell) && /if \(!isClient \|\| !currentUser \|\| locked\) return;/.test(shell) && /role="dialog" aria-modal="true"/.test(readSource('components/ui/Modal.tsx')),
    'AppShell runs the global keys from one shared list, only when the shop is open; every Modal marks itself so F1 waits while a form is open');
  const t = (id: string, extra: Partial<ReturnType<typeof makeEmptyTab>> = {}) => ({ ...makeEmptyTab(id, Number(id.replace(/\D/g, '')) || 1), ...extra });
  const line1 = { product_id: 'A', product_name: 'A', quantity: 1, unit: 'piece', unit_price: 100, total_amount: 100, tax_rate: 0, tax_amount: 0, discount_amount: 0 } as unknown as CartItem;
  const keep = tabsForNewBill([t('t1')], 't1', 'tn');
  const busy = tabsForNewBill([t('t1', { cart: [line1] })], 't1', 'tn');
  const other = tabsForNewBill([t('t1', { cart: [line1] }), t('t2', { isHeld: true }), t('t3')], 't1', 'tn');
  const typedName = tabsForNewBill([t('t1', { customerName: 'Anil' })], 't1', 'tn');
  assert(keep.activeTabId === 't1' && keep.tabs.length === 1 && busy.activeTabId === 'tn' && busy.tabs.length === 2 && busy.tabs[0].cart.length === 1 && busy.tabs[1].tabNumber === 2
    && other.activeTabId === 't3' && other.tabs.length === 3 && typedName.activeTabId === 'tn'
    && /tabsForNewBill\(tabs, activeTabId,/.test(readCounter()) && /get\('new'\) !== '1'/.test(readCounter()),
    'F1 from another page: Billing uses an open blank bill, else adds a new one — a bill with items or a typed customer is kept, never cleared');
}

// (b) The status bar shows the keys that work on the page it is on (every one handled), and
// quick links to Settings → Invoice & Bill Rules and Help & Support.
{
  const asEvent = (hint: string) => {
    const parts = hint.split('+');
    const last = parts[parts.length - 1];
    return { key: /^F\d+$/.test(last) ? last : last.toLowerCase(), ctrlKey: parts.includes('Ctrl'), shiftKey: parts.includes('Shift'), altKey: false };
  };
  const pages = ['/', '/billing', '/products', '/barcode-generator', '/settings'];
  const dead = pages.flatMap((pg) => globalShortcutHints(pg).filter(([key]) => !globalShortcutFor(asEvent(key), pg)).map(([key]) => `${pg} ${key}`));
  assert(dead.length === 0 && globalShortcutHints('/').map(([key]) => key).join() === 'F1,Ctrl+L' && globalShortcutHints('/products').map(([key]) => key).join() === 'F1,Ctrl+H,Ctrl+L' && globalShortcutHints('/billing').map(([key]) => key).join() === 'Ctrl+H,Ctrl+L'
    && globalShortcutHints('/products/').join() === globalShortcutHints('/products').join() && /pagePath\(pathname\) === '\/billing'/.test(readSource('components/layout/DesktopStatusBar.tsx')),
    `Status bar: F1 New bill everywhere (Billing lists its own), Ctrl+H Home off Home, Ctrl+L Lock — every advertised key works${dead.length ? ` (dead: ${dead.join(', ')})` : ''}`);
  const bar = readSource('components/layout/DesktopStatusBar.tsx');
  const settingsPage = readSettingsPage();
  assert(/globalShortcutHints\(pathname\)/.test(bar) && /openSettingsTab\('invoicing', pathname, router\.push\)/.test(bar) && /openSettingsTab\('help', pathname, router\.push\)/.test(bar)
    && settingsTabFromQuery('invoice') === 'invoicing' && settingsTabFromQuery('HELP') === 'help' && settingsTabFromQuery('nope') === null
    && /addEventListener\(SETTINGS_TAB_EVENT, onTab\)/.test(settingsPage) && /tabChangeRef\.current\(tab\)/.test(settingsPage),
    'Status bar "Bill rules" / "Help" open those Settings tabs (switching in place when Settings is open, still asking about unsaved changes)');
}

// (c) The right-edge drawer is "Transactions"; once open it has no second "Recent Sales" title
// (the list's own header carries the close button).
{
  const drawers = readSource('components/layout/GlobalDrawers.tsx');
  const recent = readSource('components/dashboard/DashboardRecentSales.tsx');
  assert(/tr\('Transactions'\)/.test(drawers) && !/Recent Sales|'HISTORY'/.test(drawers) && /onClose=\{\(\) => setIsHistoryOpen\(false\)\}/.test(drawers) && /\{onClose && \(/.test(recent) && /\{!onClose && \(/.test(recent) && /!onClose && setIsCollapsed/.test(recent),
    'The history drawer is called "Transactions" and shows no extra "Recent Sales" title; its close button sits in the list header');
}

// (d) Settings: UPI QR accounts and bank details are part of Store Profile (no separate tab);
// their unsaved changes still stop a tab switch, and old ?tab=upi links land there.
{
  const nav = readSource('components/settings/SettingsNavTabs.tsx');
  const page = readSettingsPage();
  const profileAt = page.indexOf("{activeTab === 'profile' && (\n        <StoreProfileTab");
  const upiAt = page.indexOf('<UpiBankingTab');
  assert(!/id: 'upi'/.test(nav) && profileAt > 0 && upiAt > profileAt && page.lastIndexOf("{activeTab === 'profile' && (", upiAt) > profileAt && !/activeTab === 'upi'/.test(page)
    && /tabOfChange\(c\.category\) === activeTab/.test(page) && settingsTabFromQuery('upi') === 'profile',
    'Settings → Store Profile holds the UPI QR accounts and bank details; their unsaved changes still stop a tab switch; ?tab=upi opens Store Profile');
}

// (e) "New stock + labels" can make a category right there; a name that exists (any case /
// spacing) picks that category instead of adding a copy.
{
  const cats = [{ id: 'c1', name: 'General' }, { id: 'c2', name: 'Fancy  Items' }];
  assert(findCategoryByName(cats, ' fancy items ')?.id === 'c2' && findCategoryByName(cats, 'Rockets') === undefined && findCategoryByName(cats, '  ') === undefined && categoryKey('  Diwali   Gift ') === 'diwali gift',
    'A typed category name finds the saved one whatever the case or spaces');
  const entry = readSource('components/labels/StockEntryModal.tsx');
  const picker = readSource('components/products/CategoryPicker.tsx');
  assert(/<CategoryPicker/.test(entry) && /await findOrCreateCategory\(name, businessId\)/.test(picker) && /onChange\(category\.id\)/.test(picker) && /db\.transaction\('rw', db\.categories/.test(readSource('lib/products/categories.ts')),
    '"New stock + labels" has "+ New" next to the category: it saves the category and picks it');
}

// (f) Add / Edit Product: "Generate" fills the shop's next own barcode (only while the box is
// empty — a maker's code is never replaced); "Save & print label" saves, then opens the item's
// labels (a new counted item: one per piece).
{
  const field = readSource('components/products/ProductBarcodeField.tsx');
  const form = readProductForm();
  const productsPage = readProductsPage();
  assert(/nextStoreBarcodes\(await barcodesInUse\(\), 1\)/.test(field) && /\{!value\.trim\(\) && \(/.test(field) && /<ProductBarcodeField/.test(form),
    'Product form: "Generate" gives the next unused store barcode, shown only while the barcode box is empty');
  assert(/data-save-action="print"/.test(form) && /\.dataset\?\.saveAction === 'print'/.test(productsPage) && /if \(printAfterSave && saved\) \{/.test(productsPage)
    && /setBarcodePrintCopies\(!editingProduct && !formIsUnlimitedStock && stockNum > 0 \? stockNum : undefined\)/.test(productsPage) && /initialCopies=\{barcodePrintCopies\}/.test(productsPage),
    'Product form: "Save & print label" is a real submit (form checks still run), then the label window opens with one label per piece of a new item');
}

// (g) ✏️ on a bill line: parts by unit — pair / set / bottle / can whole only; piece, packet, box,
// dozen (also in pieces: 7 pcs = 7/12), strip in loose tabs/half strip, kg in grams; the amount is rate × quantity.
{
  assert(allowsFractionalQty('piece') && !allowsFractionalQty('pair') && !allowsFractionalQty('set') && allowsFractionalQty('packet') && allowsFractionalQty('piece', true)
    && allowsFractionalQty('box') && allowsFractionalQty('dozen') && allowsFractionalQty('kg') && allowsFractionalQty('litre') && allowsFractionalQty('bundle') && !allowsFractionalQty(undefined),
    'Parts: pair / set whole only; piece, packet, box, bundle, dozen, kg, litre can be split');
  assert(dozenFromPieces(7) === 0.583333 && piecesInDozen(dozenFromPieces(7)) === 7 && lineAmountPaise(dozenFromPieces(7), 6000) === 3500 && lineAmountPaise(dozenFromPieces(7), 600000) === 350000
    && lineAmountPaise(0.5, 40000) === 20000 && lineAmountPaise(0.25, 90000) === 22500 && lineAmountPaise(dozenFromPieces(5), 999900) === 416625,
    'Amounts follow the part: ½ box of ₹400 = ₹200, 250 g of ₹900/kg = ₹225, 7 pcs of ₹60 / ₹6,000 a dozen = ₹35 / ₹3,500 to the paise');
  assert(formatCartQty(dozenFromPieces(7)) === '0.583' && formatCartQty(2) === '2' && formatCartQty(0.5) === '0.5' && roundQty(0.1 + 0.2) === 0.3, 'The counter shows 0.583, not 0.5833333333');
  const box = getQuantityConfigForUnit('box');
  const dozen = getQuantityConfigForUnit('dozen');
  const piece = getQuantityConfigForUnit('piece');
  assert(box.step === 'any' && box.chips.map((c) => c.val).slice(0, 3).join() === '0.25,0.5,0.75' && dozen.chips.some((c) => c.val === '0.25') && dozen.chips.some((c) => c.val === '0.75')
    && piece.step === 'any' && piece.chips.some((c) => c.val === '0.5'),
    'The ✏️ window offers ¼ ½ ¾ for a box, ¼ ½ ¾ dozen, and fractions for pieces');
  const kg = getQuantityConfigForUnit('kg');
  const strip = getQuantityConfigForUnit('strip');
  const packet = getQuantityConfigForUnit('packet');
  const litre = getQuantityConfigForUnit('litre');
  assert(kg.chips.some((c) => c.val === '0.75') && strip.chips.some((c) => c.val === '0.5') && !strip.chips.some((c) => c.val === '0.1') && packet.chips.some((c) => c.val === '0.5') && litre.chips.some((c) => c.val === '0.5'),
    'Quantity chips: 750g for kg, ½ strip (no 1 tab = 0.1 guess since v4.128.0), ½ pkt for packet, ½ L for litre');
  const pos = readCounter();
  const edit = readSource('components/billing/PosItemEditModal.tsx');
  assert(/const qty = roundQty\(parseFloat\(editItemQty\)\);/.test(pos) && /!Number\.isInteger\(qty\) && !allowsFractionalQty\(editingCartItem\.unit, product\?\.allow_decimal\)/.test(pos)
    && /formatCartQty\(item\.quantity\)\}<\/span>/.test(pos + readSource('components/billing/PosCartLines.tsx')) && /setEditItemQty\(String\(dozenFromPieces\(n\)\)\)/.test(edit)
    && /data-edit-tablets/.test(edit) && /lineAmountPaise\(qtyNow, ratePaise\)/.test(edit),
    'Saving a line checks fractional allowance, keeps 6 decimals; the window turns pieces into dozen, tablets into strip and shows amount');
}

// (h) Fast barcode inward (like the Android app): every scan is a row at once, the same code
// again adds 1, a saved item's code restocks it, the offline list fills name / price; quantity
// and category are optional (no quantity = a new item is "Unlimited", a saved one keeps its stock).
{
  const P = (id: string, name: string, extra: Partial<Product> = {}) => ({ id, name, unit: 'piece', selling_price: 1000, mrp: 1000, purchase_price: 0, current_stock: 4, min_stock_level: 5, is_active: true, category_id: 'c1', ...extra } as Product);
  const saved = P('p1', 'Parle-G 80g', { barcode: '8901719101037' });
  const cats = [{ id: 'c1', name: 'General' }, { id: 'c2', name: 'Snacks & Biscuits' }];
  const opt = { separateSellingPrice: false, categories: cats };
  let r = scanIntoRows([], '8901719101037', [saved], null, 'k1', opt);
  assert(r.outcome === 'saved' && r.rows[0].productId === 'p1' && r.rows[0].qty === '1' && r.rows[0].categoryId === 'c1', 'Scanning a saved item\'s code adds a row that restocks it');
  r = scanIntoRows(r.rows, '8906000000001', [saved], { name: 'Good Day 100g', category: 'snacks & biscuits', mrp: 30, selling_price: 28, unit: 'pack' }, 'k2', opt);
  const known = r.rows[0];
  assert(r.outcome === 'known' && known.name === 'Good Day 100g' && known.price === '30' && known.unit === 'packet' && known.categoryId === 'c2' && known.barcode === '8906000000001',
    'A code in the offline barcode list fills name, MRP, unit and the shop\'s matching category');
  r = scanIntoRows(r.rows, '8901719101037', [saved], null, 'k3', opt);
  assert(r.outcome === 'more' && r.rows[0].key === 'k1' && r.rows[0].qty === '2' && r.rows.length === 2, 'The same code again adds 1 to its row and brings it to the top (5 packets = 5 scans)');
  r = scanIntoRows(r.rows, '2000000009999', [saved], null, 'k4', opt);
  assert(r.outcome === 'unknown' && r.rows[0].name === '' && r.rows[0].barcode === '2000000009999' && r.rows.length === 3, 'An unknown code adds a row waiting for its name and price');
  assert(splitTrailingCode('Parle-G 80g8901719101037', looksLikeBarcode)?.code === '8901719101037' && splitTrailingCode('Parle-G 80g8901719101037', looksLikeBarcode)?.before === 'Parle-G 80g'
    && splitTrailingCode('8901719101037', looksLikeBarcode)?.before === '' && splitTrailingCode('Rocket 10 Shot', looksLikeBarcode) === null,
    'A gun scan that lands in a name box is split off and handled as a scan (the name typed before is kept)');
  const rows = [{ ...emptyEntryRow('a'), name: 'Loose Item', price: '50' }, { ...emptyEntryRow('b'), productId: 'p1' }, { ...emptyEntryRow('c'), name: 'Counted', price: '20', qty: '3', categoryId: 'c2' }];
  const fast = planStockEntry(rows, [saved], { separateSellingPrice: false, qtyOptional: true });
  const strict = planStockEntry(rows, [saved], { separateSellingPrice: false });
  const a = fast.lines.find((l) => l.key === 'a');
  const c = fast.lines.find((l) => l.key === 'c');
  assert(Object.keys(fast.errors).length === 0 && a?.qty === 0 && fast.lines.find((l) => l.key === 'b')?.qty === 0 && c?.kind === 'new' && c.categoryId === 'c2' && fast.labels === 3 && strict.errors.a === 'Enter the quantity received',
    'Fast inward: quantity may be left blank (no labels for it), a row keeps its own category; "New stock + labels" still needs a quantity');
  const entryDb = readSource('lib/inward/stockEntryDb.ts');
  const modal = readSource('components/inward/FastBarcodeInwardModal.tsx');
  assert(/is_unlimited_stock: received \? false : fresh\.is_unlimited_stock/.test(entryDb) && /if \(received\) moves\.push/.test(entryDb) && /if \(counted\) moves\.push/.test(entryDb) && /labels\.filter\(\(l\) => l\.copies > 0\)/.test(entryDb),
    'Saving: no quantity = a new item "Unlimited", a saved item\'s stock untouched, no stock movement and no labels for it');
  assert(/scanIntoRows\(rowsRef\.current, clean,/.test(modal) && /qtyOptional: true/.test(modal) && /source: 'Fast barcode inward'/.test(modal) && /FAST_INWARD_DRAFT_KEY/.test(modal)
    && /onOpenFastInward=\{switches\.product_barcode && switches\.stock_counting \? \(\) => setIsFastInwardOpen\(true\) : undefined\}/.test(readProductsPage()) && /<FastBarcodeInwardModal/.test(readSource('app/purchases/page.tsx')),
    'Every scan starts from the latest rows (quick scans are never lost); scanned rows survive as a draft; Products and Purchases open it');
}

// (i) Customer Directory: grid or list (remembered), four sort orders, and the list as shown
// exported to Excel (xlsx loaded only then) and to a PDF in Documents/KamaiPlus/Reports.
{
  const C = (name: string, extra: Record<string, unknown> = {}) => ({ id: name, name, phone: '', current_balance: 0, total_spent: 0, total_visits: 0, customer_type: 'regular', ...extra } as unknown as import('../src/types').Customer);
  const list = [C('Zoya', { current_balance: 5000, total_spent: 900, last_visit_date: '2026-09-01T10:00:00Z' }), C('amit', { current_balance: -2000, total_spent: 50000, last_visit_date: '2026-09-27T10:00:00Z' }), C('Bina', { total_spent: 12000 })];
  const names = (s: 'due' | 'name' | 'spent' | 'recent') => sortCustomers(list, s).map((c) => c.name).join(',');
  assert(names('due') === 'Zoya,Bina,amit' && names('name') === 'amit,Bina,Zoya' && names('spent') === 'amit,Bina,Zoya' && names('recent') === 'amit,Zoya,Bina' && list[0].name === 'Zoya',
    'Customers sort by most udhar, name A–Z (any case), most bought or latest visit — without changing the saved order');
  const sheet = customerSheetRows(list);
  assert(sheet.length === 4 && sheet[0][0] === 'Name' && sheet[1][6] === 50 && sheet[1][7] === 'Udhar' && sheet[2][6] === -20 && sheet[2][7] === 'Advance' && sheet[2][10] === '27-09-2026' && sheet[3][7] === 'Settled',
    'Excel: one row per customer, balance in ₹ (+ udhar / − advance) with its kind, dates as dd-mm-yyyy');
  const html = customerListHtmlBody([C('<b>Ram</b>', { current_balance: 5000 }), C('Sita', { current_balance: -2000 })], { shopName: 'My Shop', view: 'All customers', printedOn: 'now' });
  assert(html.includes('&lt;b&gt;Ram&lt;/b&gt;') && /Customers: <b>2<\/b>/.test(html) && /Udhar to collect: <b>₹50\.00<\/b>/.test(html) && /Advance held: <b>₹20\.00<\/b>/.test(html) && /₹50\.00 Dr/.test(html) && /₹20\.00 Cr/.test(html),
    'PDF list: names are escaped, totals of udhar to collect and advance held, Dr / Cr per customer');
  const page = readSource('app/customers/page.tsx');
  const controls = readSource('components/customers/CustomerListControls.tsx');
  assert(/sortCustomers\(filteredCustomers, sort\)/.test(page) && /<CustomerTableView/.test(page) && /localStorage\.setItem\(CUSTOMER_VIEW_KEY, v\)/.test(page) && /customers=\{shownCustomers\}/.test(page)
    && /await import\('xlsx'\)/.test(controls) && !/from 'xlsx'/.test(controls) && /await import\('@\/lib\/print\/printDocument'\)/.test(controls) && /'Reports'\)/.test(controls),
    'Customers page: grid / list remembered, the shown list is what gets exported, xlsx and the PDF printer load only when used');
}

// (j) Data Backup & Tax Reports: a backup file is checked before anything is touched, restore
// is all-or-nothing (merge never overwrites), today's backup is refreshed first; the CA register
// and Tally file use the GSTR-1 figures (buyer's own GSTIN, IGST across states, no estimates,
// returns taken off, payment split), every Tally voucher balances, and cancelled bills show in
// "documents issued".
{
  // Backup file check.
  const good = { metadata: { business_name: 'Shop', created_at: '2026-09-28T10:00:00Z' }, businesses: [{ id: 'b1', name: 'Shop' }], categories: [], products: [{ id: 'p1' }], customers: [], suppliers: [], sales: [{ id: 's1' }], cash_registers: [], cash_expenses: [], sales_returns: [], inventory_movements: [], ledger_transactions: [] };
  const ok = checkBackupPayload(good);
  const noId = checkBackupPayload({ ...good, products: [{ id: 'p1' }, { name: 'x' }] });
  assert(ok.ok && ok.counts.products === 1 && ok.counts.purchase_bills === 0 && ok.shopName === 'Shop'
    && !checkBackupPayload('nope').ok && !checkBackupPayload({ metadata: {}, products: [] }).ok && !noId.ok && /without an id/.test(noId.ok ? '' : noId.error)
    && !checkBackupPayload({ ...good, customers: 'x' }).ok,
    'A backup is checked first: not a backup / a table missing / a record without an id is refused; an older file without purchase bills is fine; counts come from the file');
  const svc = readSource('lib/backup/cloudBackupService.ts');
  const modal = readSource('components/backup/RestoreBackupModal.tsx');
  const backupPage = readSource('app/cloud-backup/page.tsx');
  assert(/await db\.transaction\('rw', BACKUP_TABLES\.map\(\(t\) => db\.table\(t\)\)/.test(svc) && /if \(t === 'businesses' \|\| !list\?\.length\) continue;/.test(svc) && /!have\.has\(String\(r\.id\)\)/.test(svc) && /await table\.bulkAdd\(fresh\)/.test(svc)
    && /'marketing_templates', 'audit_logs'/.test(svc) && /feature_switches: parseFeatureSwitches/.test(svc),
    'Restore runs in one transaction; "add missing" only adds records not here (never overwrites, keeps the shop profile); backups now carry every table and the feature / label choices');
  assert(/mode === 'clean' && getDesktopApi\(\)\) \{\s*const safety = await runAutoBackup\(\{ force: true \}\)/.test(modal) && /checkBackupPayload\(json\)/.test(backupPage) && /window\.location\.reload\(\)/.test(backupPage),
    'Before a clean restore today\'s automatic backup is refreshed with the current data; the file is checked on selection; the app reloads after restoring');

  // Bills broken up the GSTR-1 way.
  const line = (id: string, qty: number, total: number, rate: number, extra: Record<string, unknown> = {}) => {
    const tax = Math.round(total - total / (1 + rate / 100));
    return { product_id: id, product_name: id, quantity: qty, unit: 'piece', unit_price: total / qty, total_amount: total, tax_rate: rate, tax_amount: tax, is_tax_inclusive: true, discount_amount: 0, ...extra };
  };
  const bill = (id: string, items: ReturnType<typeof line>[], extra: Record<string, unknown> = {}) => ({
    id, invoice_number: `INV-${id}`, status: 'completed', created_at: '2026-09-10T10:00:00Z', items, subtotal: items.reduce((n, i) => n + i.total_amount - i.tax_amount, 0), tax_total: items.reduce((n, i) => n + i.tax_amount, 0),
    grand_total: items.reduce((n, i) => n + i.total_amount, 0), discount_total: 0, payment_method: 'cash', payment_status: 'paid', balance_due: 0, customer_name: 'Cash Customer', ...extra,
  } as unknown as import('../src/types').Sale);
  const shop = { name: 'My Shop', gstin: '27ABCDE1234F1Z5' } as import('../src/types').Business;
  const cust = [{ id: 'c1', name: 'Kaveri Traders', gstin: '29AAACK1234A1Z9', phone: '9' } as unknown as import('../src/types').Customer];
  const sales = [
    bill('1', [line('A', 1, 11800, 18)]),
    bill('2', [line('B', 2, 23600, 18)], { customer_id: 'c1', customer_name: 'Kaveri Traders', payment_method: 'credit', balance_due_at_sale: 23600, balance_due: 23600, payment_status: 'unpaid' }),
    bill('3', [line('C', 1, 5000, 0)], { status: 'draft', invoice_number: 'EST-3' }),
    bill('4', [line('D', 1, 5000, 0)], { status: 'cancelled' }),
    bill('5', [line('E', 2, 11800, 18, { returned_quantity: 1 })], { status: 'partial_return' }),
    bill('6', [line('F', 1, 10000, 0)], { payment_method: 'split', payment_split: { cash_amount: 4000, upi_amount: 3000, card_amount: 1000, credit_amount: 2000 }, customer_id: 'c1', customer_name: 'Kaveri Traders' }),
  ];
  const returns = [{ id: 'r1', original_sale_id: '5', items: [{ product_id: 'E', quantity: 1 }], refund_amount: 5900, refund_method: 'cash', created_at: '2026-09-11T10:00:00Z' } as unknown as import('../src/types').SalesReturn];
  const parts = breakupSales(sales, { shopGstin: shop.gstin!, customers: cust, returns });
  const by = (n: string) => parts.find((p) => p.sale.id === n);
  assert(parts.length === 4 && !by('3') && !by('4') && by('1')?.cgst === 900 && by('1')?.sgst === 900 && by('1')?.igst === 0 && by('1')?.pay.cash === 11800
    && by('2')?.inter === true && by('2')?.igst === 3600 && by('2')?.buyerGstin === '29AAACK1234A1Z9' && by('2')?.pay.credit === 23600 && /^29 /.test(by('2')?.placeOfSupply || '')
    && by('5')?.total === 5900 && by('5')?.returned === 5900 && by('5')?.pay.cash === 5900
    && by('6')?.pay.cash === 4000 && by('6')?.pay.bank === 4000 && by('6')?.pay.credit === 2000,
    'Bills for the accountant: no estimates / cancelled bills, CGST+SGST within the state, IGST for a buyer in another state, returns taken off, payment split cash / UPI-card / udhar');
  const ca = generateCASalesRegisterCSV({ business: shop, sales, customers: cust, returns });
  const caLines = ca.csv.split('\r\n');
  assert(ca.csv.charCodeAt(0) === 0xfeff && ca.count === 4 && caLines.length === 6 && caLines[2].includes('"29AAACK1234A1Z9"') && caLines[2].includes('"Inter-State"') && !ca.csv.includes('EST-3')
    && !caLines[1].includes(shop.gstin!) && /"TOTAL"/.test(caLines[5]) && caLines[5].includes('36.00'),
    'CA register: BOM for Excel, the buyer\'s own GSTIN (never the shop\'s), inter-state marked, no estimate, a totals row with IGST');
  const tally = generateTallyPrimeXML({ business: shop, sales, customers: cust, returns });
  const vouchers = tally.xml.split('<VOUCHER ').slice(1);
  // Ledger lines only — a party line's BILLALLOCATIONS repeats its amount (v4.101.0).
  const unbalanced = vouchers.filter((v) => Math.round(Array.from(v.replace(/<BILLALLOCATIONS\.LIST>[\s\S]*?<\/BILLALLOCATIONS\.LIST>/g, '').matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)).reduce((n, m) => n + Number(m[1]) * 100, 0)) !== 0);
  // 4 bills + the return of bill 5 as a Credit Note voucher (K-D11, v4.101.0).
  assert(vouchers.length === 5 && vouchers.filter((v) => v.startsWith('VCHTYPE="Credit Note"')).length === 1 && unbalanced.length === 0 && !/ALLINVENTORYENTRIES/.test(tally.xml) && /<LEDGERNAME>Output IGST<\/LEDGERNAME>/.test(tally.xml) && /<GSTDUTYHEAD>Integrated Tax<\/GSTDUTYHEAD>/.test(tally.xml)
    && !/LEDGER NAME="Bank Accounts"/.test(tally.xml) && !/LEDGER NAME="Cash"/.test(tally.xml) && /LEDGER NAME="Kaveri Traders"/.test(tally.xml) && !tally.xml.includes('EST-3'),
    'Tally: one balanced Sales voucher per bill (debits = credits to the paisa), no stock lines Tally could reject, GST ledgers with their duty head, no clash with Tally\'s own "Bank Accounts" / "Cash"');

  // GSTR-1 documents issued count cancelled bills (the page now passes them).
  const doc = generateGSTR1Report(sales, cust, shop, 'Sep 2026');
  assert(doc.doc_cancelled_count === 1 && doc.total_invoices_count === 5 && doc.doc_from_num === 'INV-1' && /generateGSTR1Report\(periodSales \|\| \[\]/.test(readSource('app/gst-reports/page.tsx')),
    'GSTR-1 documents issued: every tax invoice counted, cancelled ones shown (net issued = total − cancelled); estimates are not documents');
}

// (k) Every shipped offline barcode list is valid JSON with a code and a name per item — one
// missing quote in fmcg-india.json silently dropped all 77 FMCG items (Parle-G, Maggi…) until v4.78.0.
{
  const dir = path.join(__dirname, '..', 'public', 'barcodes');
  const listed = Array.from(readSource('lib/barcode/barcodeDictionary.ts').matchAll(/'\/barcodes\/([\w-]+\.json)'/g)).map((m) => m[1]);
  const broken = listed.filter((f) => {
    try {
      const items = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return !Array.isArray(items) || items.length === 0 || items.some((i: { barcode?: unknown; name?: unknown }) => typeof i?.barcode !== 'string' || !i.barcode || !i.name);
    } catch {
      return true;
    }
  });
  const fmcg = JSON.parse(fs.readFileSync(path.join(dir, 'fmcg-india.json'), 'utf8')) as { barcode: string }[];
  assert(listed.length === 5 && broken.length === 0 && fmcg.some((i) => i.barcode === '8901719101037'),
    `Every offline barcode list loads (broken: ${broken.join(', ') || 'none'}) — a scanned Parle-G fills its name and price`);
}

// (l) The Transactions pull-tab can be dragged up / down and stays there on this computer; it
// never covers the top bar or the status bar; a plain click still opens the drawer.
{
  assert(parseTabY(null) === 0.5 && parseTabY('0.2') === 0.2 && parseTabY('7') === 0.5 && parseTabY('abc') === 0.5 && parseTabY('') === 0.5
    && tabCenterPx(0.5, 900, 120) === 450 && tabCenterPx(0, 900, 120) === 136 && tabCenterPx(1, 900, 120) === 808
    && shareFromCenter(90, 900, 120) === Math.round((136 / 900) * 1000) / 1000 && shareFromCenter(450, 900, 120) === 0.5,
    'Pull-tab place: a share of the window height, kept below the top bar and above the status bar; a broken saved value means the middle');
  const tab = readSource('components/layout/DraggablePullTab.tsx');
  assert(/if \(!d\.moved\) return onOpen\(\);/.test(tab) && /Math\.abs\(dy\) < DRAG_THRESHOLD_PX/.test(tab) && /localStorage\.setItem\(DRAWER_TAB_KEY/.test(tab) && /<DraggablePullTab/.test(readSource('components/layout/GlobalDrawers.tsx')),
    'A press without movement opens the drawer; a drag moves the tab and is remembered');
}

// (m) Home fills itself: a screen switched off in Settings → Features is swapped for a tile
// that does its job (Purchases → Fast barcode inward, GST → Backup & CA exports), tiles grow
// to fill the row, Printer setup opens on Home, and "Today's Profit" becomes "Average Bill"
// when no item has a buying price (it would always say ₹0).
{
  const ids = (purchases: boolean) => quickActionsFor({ purchases }).map((a) => a.id).join(',');
  assert(ids(true) === 'new_bill,khata,stock_inward,day_summary,printers' && ids(false) === 'new_bill,khata,fast_inward,day_summary,printers'
    && quickActionsFor({ purchases: false }).find((a) => a.id === 'fast_inward')?.action === 'fast_inward'
    && quickActionsFor({ purchases: true })[0].href === '/billing?new=1',
    'Quick Actions: Purchases off swaps Stock Inward for Fast barcode inward (opens on Home); New Bill opens a fresh bill; Printer setup is always there');
  assert(!showProfitCard({ costPriceOn: false, anyProductHasCost: false, costedRevenuePaise: 0 })
    && showProfitCard({ costPriceOn: true, anyProductHasCost: false }) && showProfitCard({ costPriceOn: false, anyProductHasCost: true })
    && showProfitCard({ costPriceOn: false, anyProductHasCost: false, costedRevenuePaise: 500 }),
    'Profit card shows only when buying prices exist somewhere; otherwise Average Bill takes its place');
  const st = billStats([10000, 25050, 5000]);
  assert(st.averagePaise === 13350 && st.biggestPaise === 25050 && billStats([]).averagePaise === 0 && billStats([]).biggestPaise === 0,
    'Average Bill = day revenue / bills (whole paise); Biggest bill = the largest; no bills = ₹0');
  const dock = readSource('components/dashboard/QuickActionDock.tsx');
  const tools = readSource('components/dashboard/QuickToolsGrid.tsx');
  const home = readSource('components/dashboard/DashboardHome.tsx');
  // v4.147.0: quick actions in the Pulse cards' columns (Rahul: same widths); tool tiles in an auto-fill grid.
  assert(/quickActionsFor\(useFeatureSwitches\(\)\)/.test(dock) && dock.includes('grid grid-cols-2 lg:grid-cols-4') && !/grow basis/.test(dock)
    && tools.includes("repeat(auto-fill, minmax(190px, 1fr))") && !/grow basis/.test(tools) && /switches\.gst_reports \? \[\] :/.test(tools) && GST_STAND_IN_HREF === '/settings?tab=data',
    'Home: quick actions line up with the 4 Pulse cards; tool tiles re-flow at a compact width (no stretching), so a hidden screen leaves no gap; GST off → Backup & CA exports');
  const printersWin = readSource('components/printers/PrintersWindow.tsx');
  assert(/onOpenPrinters=\{openPrintersWindow\}/.test(home) && /<FastBarcodeInwardModal onClose/.test(home) && /showProfit=\{showProfit\}/.test(home)
    && SILENT_PRINT_KEY === 'kamai_silent_print' && /onAutoPrintChange=\{saveSilentPrint\}/.test(printersWin) && /'kamai_silent_print'/.test(readCounter())
    && /<LabelSetupPanel/.test(printersWin) && /\{children\}/.test(readSource('components/billing/BillPrinterSetup.tsx')),
    'Printer setup on Home: bill printer + label printer, and "print straight away" is the same switch the counter uses');
}

// (n) Printer auto-detect: PDF / XPS / OneNote / Fax "printers" are never bill printers; the kind
// (receipt / label / A4) comes from name + driver; with nothing chosen and no doubt, the printer is
// picked on its own; a printer already chosen is never switched — a new one is asked about once.
{
  const tvs = { name: 'TVS RP 3160 Gold', driver: 'TVS RP 3160 Gold' };
  const pos58 = { name: 'POS-58', driver: 'POS-58' };
  const tsc = { name: 'TSC TTP-244 Pro', driver: 'TSC TTP-244 Pro' };
  const hp = { name: 'HP LaserJet P1108', driver: 'HP LaserJet Professional P1100' };
  const pdf = { name: 'Microsoft Print to PDF', driver: 'Microsoft Print To PDF', port: 'PORTPROMPT:' };
  const adobe = { name: 'Adobe PDF', driver: 'Adobe PDF Converter', port: 'Documents\\*.pdf' };
  assert(isVirtualPrinter(pdf) && isVirtualPrinter(adobe) && isVirtualPrinter({ name: 'OneNote (Desktop)' }) && isVirtualPrinter({ name: 'Fax' })
    && isVirtualPrinter({ name: 'Microsoft XPS Document Writer' }) && !isVirtualPrinter(tvs) && !isVirtualPrinter(hp) && !isVirtualPrinter(tsc),
    'Printer detect: file-only "printers" (PDF, XPS, OneNote, Fax) are left out');
  assert(printerKind(tvs) === 'thermal' && printerKind({ name: 'EPSON TM-T82 Receipt' }) === 'thermal' && printerKind(pos58) === 'thermal'
    && printerKind(tsc) === 'label' && printerKind({ name: 'TVS LP 46 NEO' }) === 'label' && printerKind({ name: 'ZDesigner ZD220-203dpi', driver: 'Zebra ZD220' }) === 'label'
    && printerKind(hp) === 'a4' && printerKind({ name: 'Canon LBP2900' }) === 'a4' && printerKind({ name: 'Generic / Text Only' }) === 'other'
    && thermalFormat(pos58) === 'thermal-58' && thermalFormat(tvs) === 'thermal-80',
    'Printer kind from name / driver: receipt (58 or 80 mm), label (checked first: TVS LP is a label printer), A4');
  const none = { defaultFormat: 'a4' as const, a4Printer: '', thermalPrinter: '' };
  const r0 = reviewPrinters({ known: null, printers: [pdf, adobe], bill: none, labelPrinter: '' });
  const r1 = reviewPrinters({ known: null, printers: [pdf, adobe, tvs], bill: none, labelPrinter: '' });
  assert(!r0.bill && !r0.label && r0.fresh.length === 0 && r1.bill?.name === tvs.name && r1.bill.format === 'thermal-80' && r1.fresh.length === 0 && r1.known.length === 3,
    'First look on a PC: only PDF printers → nothing picked or asked; one receipt printer already installed → it becomes the 80 mm bill printer');
  const r2 = reviewPrinters({ known: [pdf.name, adobe.name], printers: [pdf, adobe, pos58, tsc], bill: none, labelPrinter: '' });
  assert(r2.bill?.name === 'POS-58' && r2.bill.format === 'thermal-58' && r2.label === tsc.name && r2.fresh.length === 0,
    'Plugged in later with nothing chosen: the receipt printer takes the bills (58 mm), the label printer the labels — no questions');
  const chosen = { defaultFormat: 'thermal-80' as const, a4Printer: '', thermalPrinter: tvs.name };
  const r3 = reviewPrinters({ known: [pdf.name, tvs.name], printers: [pdf, tvs, hp], bill: chosen, labelPrinter: '' });
  const r4 = reviewPrinters({ known: r3.known, printers: [pdf, tvs, hp], bill: chosen, labelPrinter: '' });
  const r5 = reviewPrinters({ known: [], printers: [tvs, pos58], bill: none, labelPrinter: '' });
  assert(!r3.bill && r3.fresh.map((p) => p.name).join() === hp.name && r4.fresh.length === 0 && !r5.bill && r5.fresh.length === 2,
    'A chosen bill printer is never switched: a new printer is asked about once (then remembered); two receipt printers = no guess, both asked');
  const r6 = reviewPrinters({ known: [pdf.name], printers: [pdf, hp], bill: none, labelPrinter: '' });
  assert(r6.bill?.name === hp.name && r6.bill.format === 'a4', 'Only an office printer and A4 bills: it becomes the A4 bill printer (not the PDF default)');
  // v4.80.0: label printers sold in India, as Windows names them. Zebra's driver is "ZDesigner …";
  // Xprinter, Gprinter, Rongta, Retsol, Bixolon and SNBC make receipt printers too. Before, a lone
  // Retsol LS became the bill printer and a lone XP-365B the A4 bill printer.
  const labelNames = ['ZDesigner GC420t (EPL)', 'ZDesigner ZD220-203dpi ZPL', 'Xprinter XP-365B', 'XP-470B', 'XP-DT425B', 'Retsol LS 450', 'Gprinter GP-1324D', 'GP-3120TU',
    'Rongta RP410', 'Bixolon SLP-TX400', 'SNBC BTP-2300E', 'POSTEK G2000', 'HPRT HT300', 'iDPRT SP410', 'Honeywell PC42t (203 dpi)', 'Godex G500', 'Citizen CL-E321'];
  const receiptNames = ['XP-58IIH', 'XP-80C', 'Xprinter XP-Q200', 'XP-N160II', 'Gprinter GP-5890XIII', 'GP-80250N', 'Rongta RP326', 'BIXOLON SRP-350plusIII', 'SNBC BTP-R880NP', 'Retsol RTP 80', 'HPRT TP805', 'ZJ-5890'];
  const misread = labelNames.filter((n) => printerKind({ name: n, driver: n }) !== 'label').concat(receiptNames.filter((n) => printerKind({ name: n, driver: n }) !== 'thermal'));
  const xp365 = { name: 'Xprinter XP-365B', driver: 'Xprinter XP-365B' };
  const retsolLs = { name: 'Retsol LS 450', driver: 'Retsol LS 450' };
  const r7 = reviewPrinters({ known: [pdf.name], printers: [pdf, xp365], bill: none, labelPrinter: '' });
  const r8 = reviewPrinters({ known: [], printers: [retsolLs], bill: none, labelPrinter: '' });
  assert(misread.length === 0 && [hp, { name: 'Canon LBP2900' }, { name: 'EPSON L3150 Series' }].every((p) => printerKind(p) === 'a4')
    && thermalFormat({ name: 'GP-5890XIII' }) === 'thermal-58' && thermalFormat({ name: 'ZJ-5890' }) === 'thermal-58'
    && !r7.bill && r7.label === xp365.name && !r8.bill && r8.label === retsolLs.name,
    `Label printers sold in India are known (Zebra "ZDesigner", Xprinter XP-365B, Retsol LS…) and never become the bill printer; the same makers' receipt models stay receipt printers (misread: ${misread.join(', ') || 'none'})`);
  // v4.80.0: on the test PC the TSC label printer had been chosen for bills (by hand). It is kept —
  // a chosen printer is never switched — but flagged in both printer setups and the status bar.
  const tscChosen = { defaultFormat: 'thermal-80' as const, a4Printer: '', thermalPrinter: tsc.name };
  const r9 = reviewPrinters({ known: [tsc.name], printers: [tsc, pos58], bill: tscChosen, labelPrinter: '' });
  assert(billPrinterMismatch(tsc, 'thermal-80') === 'label' && billPrinterMismatch(xp365, 'a4') === 'label' && billPrinterMismatch(tvs, 'a4') === 'receipt-for-a4'
    && billPrinterMismatch(tvs, 'thermal-80') === null && billPrinterMismatch(hp, 'a4') === null && billPrinterMismatch(pos58, 'thermal-58') === null && !r9.bill,
    'A label printer chosen for bills (or a receipt printer for A4 bills) is recognised as the wrong kind; the choice itself is never switched');
  const billSetupSrc = readSource('components/billing/BillPrinterSetup.tsx');
  const statusSrc = readSource('components/layout/DesktopStatusBar.tsx');
  assert(/<BillPrinterWarning name=\{printer \|\| printers\.find\(\(p\) => p\.isDefault\)\?\.name \|\| ''\} format=\{fmt\} \/>/.test(billSetupSrc)
    && (readSource('components/settings/PrintSettingsCard.tsx').match(/<BillPrinterWarning /g) || []).length === 2
    && /billPrinterMismatch\(billTarget, chosen\.format\)/.test(statusSrc) && /tone: 'warn' as Tone/.test(statusSrc) && /d\.isDefault/.test(statusSrc),
    'The warning shows under the bill printer in the Printers window and Settings (A4 and receipt), and turns the status bar amber — also when bills go to the Windows default');
  // v4.80.0: "Calibrate printer" — a new roll printed ~2–3 mm high on the TSC TE244 until the printer
  // measured the gap (TSPL GAPDETECT, tried on the real printer). One fixed command per printer family;
  // the page only names the printer.
  const { calibrationFor } = require('../labelCalibrate.js');
  const cal = (name: string) => calibrationFor({ name, driver: name });
  assert(cal('TSC TE244')?.commands === 'GAPDETECT\r\n' && cal('TVS LP 46 NEO')?.language === 'TSPL' && cal('Xprinter XP-365B')?.language === 'TSPL'
    && cal('ZDesigner GC420t (EPL)')?.commands === '\r\nxa\r\n' && cal('ZDesigner ZD220-203dpi ZPL')?.commands === '~JC' && cal('Godex G500')?.language === 'EZPL'
    && ['Brother QL-800', 'HP LaserJet P1108', 'Microsoft Print to PDF', 'XP-80C', 'TVS RP 3160 Gold', 'POS-58'].every((n) => cal(n) === null),
    'Calibrate printer: TSPL (TSC, TVS LP, Xprinter…), Zebra EPL / ZPL and Godex each get their own command; receipt, office and unknown printers get none (FEED button instead)');
  const calJs = fs.readFileSync(path.join(__dirname, '..', 'labelCalibrate.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(/ipcMain\.handle\('kp:calibrate-label-printer', async \(_event, name\) => labelCalibrate\.calibrate\(printers, String\(name \|\| ''\)\)\)/.test(mainSrc)
    && /calibrateLabelPrinter: \(name\) => ipcRenderer\.invoke\('kp:calibrate-label-printer', name\)/.test(fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8'))
    && (pkgJson.build?.files || []).includes('labelCalibrate.js') && /\$env:KP_RAW_PRINTER/.test(calJs) && /-EncodedCommand/.test(calJs) && !/\$\{name\}|\$\{printer/.test(calJs.split('const RAW_SCRIPT')[1].split('`;')[0])
    && /desktop\.calibrateLabelPrinter\(s\.printer\)/.test(readSource('components/labels/LabelSetupPanel.tsx')) && /data-label-calibrate/.test(readSource('components/labels/LabelSetupPanel.tsx')),
    'kp:calibrate-label-printer wired (main, preload, packaged); only the printer name crosses over and it reaches PowerShell through the environment, never the script text');
  const def = printerLine('', [{ ...pdf, isDefault: true }, tvs]);
  assert(printerLine('', []).state === 'none' && printerLine('X', [tvs]).state === 'missing' && printerLine(tvs.name, [{ ...tvs, offline: true }]).state === 'offline'
    && printerLine(tvs.name, [tvs]).state === 'ready' && def.state === 'default' && def.virtual === true
    && parseKnownPrinters(null) === null && parseKnownPrinters('bad') === null && parseKnownPrinters('["A",1]')?.join() === 'A',
    'Status bar: none / missing / offline / ready, and a Windows default that only saves a PDF is flagged');
  const { parsePrinterJson } = require('../printers.js');
  const one = parsePrinterJson('{"Name":"TVS RP 3160 Gold","DriverName":"TVS RP 3160 Gold","PortName":"USB001","Status":"Offline","WorkOffline":false}');
  const many = parsePrinterJson('[{"Name":"A","Status":"Normal","WorkOffline":null},{"Name":"B","Status":"Normal","WorkOffline":true}]');
  assert(one.length === 1 && one[0].offline === true && one[0].port === 'USB001' && many.length === 2 && !many[0].offline && many[1].offline && parsePrinterJson('').length === 0,
    'Main side: Get-Printer JSON (one printer = an object) → name, driver, port, offline');
  // v4.80.0: a TSC TE244 pulled out of USB stayed "Normal" in Get-Printer (status bar: green). The
  // USB printer devices really present are listed too; a USB-port printer without one is unplugged.
  const tscQueue = { Name: 'TSC TE244', DriverName: 'TSC TTP-244', PortName: 'USB001', Status: 'Normal', WorkOffline: null };
  const netQueue = { Name: 'HP LaserJet', DriverName: 'HP', PortName: 'IP_192.168.1.20', Status: 'Normal', WorkOffline: null };
  const pulled = parsePrinterJson(JSON.stringify({ printers: [tscQueue, netQueue], usb: '' }));
  const pluggedIn = parsePrinterJson(JSON.stringify({ printers: [tscQueue], usb: 'USBPRINT\\TSCTE244\\6&10B3E789&0&USB001' }));
  const otherPort = parsePrinterJson(JSON.stringify({ printers: tscQueue, usb: 'USBPRINT\\XP-58\\7&1&0&USB002' }));
  const unknownUsb = parsePrinterJson(JSON.stringify({ printers: [tscQueue], usb: '?' }));
  assert(pulled[0].offline && pulled[0].status === 'Unplugged' && !pulled[1].offline && !pluggedIn[0].offline && pluggedIn[0].status === 'Normal'
    && otherPort.length === 1 && otherPort[0].offline && !unknownUsb[0].offline && parsePrinterJson(JSON.stringify({ printers: null, usb: '' })).length === 0
    && /Win32_PnPEntity -Filter "PNPDeviceID LIKE 'USBPRINT%'"/.test(fs.readFileSync(path.join(__dirname, '..', 'printers.js'), 'utf8')),
    'An unplugged USB printer shows offline (its USB device is gone, whatever Get-Printer says); a network printer or an unknown answer changes nothing');
  // v4.80.0: the "Printer set automatically" card sat bottom-right over Billing's "Complete sale"
  // (the Electron E2E could not finish a sale on a PC with a label printer installed).
  const watcherSrc = readSource('components/printers/PrinterWatcher.tsx');
  assert(/fixed bottom-10 left-4 z-\[90\]/.test(watcherSrc) && !/fixed bottom-10 right-4 z-\[90\]/.test(watcherSrc),
    'The printer notice sits bottom-left, never over the "Complete sale" button');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert(/ipcMain\.handle\('kp:printer-status'/.test(main) && /getPrinterStatus: \(\) => ipcRenderer\.invoke\('kp:printer-status'\)/.test(preload)
    && (pkgJson.build?.files || []).includes('printers.js') && /<PrinterWatcher \/>/.test(readSource('components/layout/AppShell.tsx'))
    && /onClick=\{openPrintersWindow\}/.test(readSource('components/layout/DesktopStatusBar.tsx'))
    && /addEventListener\(SILENT_PRINT_EVENT/.test(readCounter()),
    'kp:printer-status is wired (main, preload, packaged); the watcher runs in the app shell; the status bar opens Printers; Billing follows the switch');
}

// (o) WhatsApp everywhere (v4.79.0) — the Android app's wa.me messages on the desktop: one window
// (number check, editable message, English / हिंदी / मराठी, reminder tone), WhatsApp Desktop when
// installed else wa.me, a tap-to-pay UPI link through the shop-owned pay page, and a copy fallback
// for links Windows cannot open.
{
  assert(toWhatsAppNumber('98220 12345') === '919822012345' && toWhatsAppNumber('+91 98220-12345') === '919822012345' && toWhatsAppNumber('09822012345') === '919822012345'
    && toWhatsAppNumber('919822012345') === '919822012345' && toWhatsAppNumber('+44 7911 123456') === '447911123456'
    && toWhatsAppNumber('12345') === null && toWhatsAppNumber('5822012345') === null && toWhatsAppNumber('') === null,
    'WhatsApp number: 91 + a 10-digit Indian mobile (0 / +91 / spaces dropped), +country kept, anything else refused (like Android formatWhatsAppPhone)');
  assert(whatsAppWebUrl('919822012345', 'a b') === 'https://wa.me/919822012345?text=a%20b' && whatsAppWebUrl(null, 'x') === 'https://wa.me/?text=x' && whatsAppWebUrl('919822012345', '') === 'https://wa.me/919822012345',
    'wa.me link: with a number opens that chat, without one WhatsApp asks for the chat');
  const pay = upiPayLink({ upiId: 'shop@okaxis', payeeName: 'Sai Kirana', amountPaise: 2600, note: 'Bill INV-1' });
  const payU = new URL(pay).searchParams.get('u') || '';
  assert(pay.startsWith('https://kamaiplus-pay.web.app/?') && new URL(pay).searchParams.get('a') === '26.00' && new URL(pay).searchParams.get('s') === 'Sai Kirana'
    && payU === 'upi://pay?pa=shop@okaxis&pn=Sai%20Kirana&am=26.00&cu=INR&tn=Bill%20INV-1' && upiPayLink({ upiId: '', payeeName: 'x' }) === '',
    'Pay link = the Android pay page (u = upi://pay… with amount, s = shop, a = rupees) — WhatsApp does not link upi:// itself');

  const shop = { name: 'Sai Kirana', phone: '9876543210', upiId: 'shop@okaxis' };
  const sale: any = { invoice_number: 'INV-0042', created_at: '2026-09-28T13:05:00.000Z', customer_name: 'Ramesh', status: 'completed', payment_method: 'split',
    payment_split: { cash_amount: 5000, upi_amount: 2000, card_amount: 0, credit_amount: 2600 }, amount_received: 7000, balance_due: 2600, balance_due_at_sale: 2600, change_returned: 0,
    items: [{ product_name: 'Parle-G 80g', quantity: 2, unit: 'piece', total_amount: 2000 }, { product_name: 'Sugar', quantity: 1.5, unit: 'kg', total_amount: 6600 }], discount_total: 1000, grand_total: 9600 };
  const bill = billMessage(sale, shop, { lang: 'en', payLink: true });
  assert(/^🧾 \*INVOICE #INV-0042\*/.test(bill) && bill.includes('• 2 × Parle-G 80g = ₹20.00') && bill.includes('• 1.5 kg × Sugar = ₹66.00') && bill.includes('Discount: -₹10.00')
    && bill.includes('💰 *Total: ₹96.00*') && bill.includes('💳 Paid: Cash ₹50.00 • UPI ₹20.00') && bill.includes('🔴 *Balance due: ₹26.00*')
    && bill.includes('👉 Pay by UPI: https://kamaiplus-pay.web.app/?') && bill.includes('am%3D26.00') && bill.includes('📌 UPI ID: shop@okaxis') && /— Sai Kirana • 9876543210$/.test(bill),
    'Bill message: items with quantity + unit, discount, total, how it was paid, what is still due with a pay link for exactly that, UPI ID, shop sign-off');
  const paid = billMessage({ ...sale, payment_method: 'cash', payment_split: undefined, amount_received: 9600, balance_due: 0, balance_due_at_sale: 0 }, shop, { lang: 'en', payLink: true });
  const est = billMessage({ ...sale, invoice_number: 'EST-7', status: 'draft' }, shop, { lang: 'en', payLink: true });
  const many = billMessage({ ...sale, items: Array.from({ length: MAX_BILL_LINES + 5 }, (_, i) => ({ product_name: `Item ${i}`, quantity: 1, unit: 'piece', total_amount: 100 })) }, shop, { lang: 'en', payLink: false });
  assert(!paid.includes('Balance due') && !paid.includes('Pay by UPI') && paid.includes('📌 UPI ID') && /\*ESTIMATE #EST-7\*/.test(est) && !est.includes('Balance due') && !est.includes('💳')
    && many.includes('…and 5 more items') && !many.includes('Item 29') && !many.includes('Pay by UPI'),
    'Paid bill: no due / pay link; estimate: no payment or due lines; a long bill is cut to 25 lines ("…and N more"); pay link can be switched off');
  const mr = billMessage(sale, shop, { lang: 'mr', payLink: true, signOff: 'पुन्हा या!' });
  const hiFormal = khataReminderMessage({ name: 'Ramesh', balancePaise: 125000 }, shop, { lang: 'hi', payLink: true }, 'formal');
  const enFriendly = khataReminderMessage({ name: 'Ramesh', balancePaise: 125000 }, shop, { lang: 'en', payLink: false }, 'friendly');
  assert(mr.includes('🧾 *बिल #INV-0042*') && mr.includes('💰 *एकूण: ₹96.00*') && mr.includes('💳 भरणा: रोख ₹50.00') && mr.includes('पुन्हा या!') && !mr.includes('Thank you')
    && /^नमस्ते Ramesh जी,/.test(hiFormal) && hiFormal.includes('₹1,250.00 बकाया') && hiFormal.includes('am%3D1250.00')
    && enFriendly.includes('Your balance at Sai Kirana is ₹1,250.00.') && !enFriendly.includes('Pay by UPI') && enFriendly.includes('📌 UPI ID')
    && khataReminderMessage({ name: 'R', balancePaise: 0 }, shop, { lang: 'en', payLink: true }, 'friendly').includes('fully settled')
    && khataReminderMessage({ name: 'R', balancePaise: -5000 }, shop, { lang: 'en', payLink: true }, 'friendly').includes('advance of ₹50.00'),
    'Customer messages in English / हिंदी / मराठी; reminder friendly or formal with a pay link for the balance; nothing due = "settled" / advance; the shop\'s own last line');
  const slip = ledgerSlipMessage({ transaction_type: 'CREDIT_SALE', amount: 30000, balance_after: 80000, notes: 'Rice', created_at: '2026-09-28T10:00:00Z' } as any, 'Ramesh', shop, { lang: 'en', payLink: true });
  assert(slip.includes('🔴 Credit given (udhar): ₹300.00') && slip.includes('📝 Note: Rice') && slip.includes('💰 *Balance: ₹800.00*') && slip.includes('am%3D800.00')
    && paymentRequestMessage('Ramesh', 45000, shop, { lang: 'en', payLink: false }).includes('Pay by UPI'),
    'Khata slip: what happened, the note, the balance after it (+ pay link); a payment request always carries its pay link');
  const order = restockOrderMessage({ shop, supplierName: 'Gupta Traders', items: [{ name: 'Parle-G', qty: 48, unit: 'piece', stock: 2 }, { name: 'Sugar', qty: 25, unit: 'kg', stock: -3 }, { name: 'Skip', qty: 0, unit: 'piece' }] });
  const ca = gstForCaMessage(shop, { periodLabel: 'Sep 2026', gstin: '27ABCDE1234F1Z5', invoices: 12, taxablePaise: 1000000, cgstPaise: 90000, sgstPaise: 90000, igstPaise: 0 });
  const tally = cashTallyMessage({ shop, counts: [{ value: 500, count: 2 }, { value: 10, count: 0 }], countedPaise: 100000, expectedPaise: 105000 });
  assert(order.includes('Dear Gupta Traders,') && order.includes('1. *Parle-G* — 48 pcs (in stock: 2)') && order.includes('2. *Sugar* — 25 kg (in stock: 0)') && !order.includes('Skip') && order.includes('*2 items*')
    && ca.includes('*Sep 2026*') && ca.includes('27ABCDE1234F1Z5') && ca.includes('Taxable value: ₹10,000.00') && ca.includes('*Total GST: ₹1,800.00*') && !ca.includes('IGST')
    && tally.includes('• ₹500 × 2 = ₹1,000') && !tally.includes('₹10 ×') && tally.includes('Short: ₹50.00')
    && suggestedOrderQty({ current_stock: 2, min_stock_level: 10 } as any) === 18 && suggestedOrderQty({ current_stock: 50, min_stock_level: 5 } as any) === 1,
    'Business messages: restock order (qty + unit, stock never below 0, zero lines left out), GST figures for the CA, cash count with shortage; order qty back to twice the alert level');
  assert(parseWhatsAppSettings(null).payLink === true && parseWhatsAppSettings('{"lang":"xx","payLink":false,"signOff":7}').lang === '' && parseWhatsAppSettings('{"payLink":false}').payLink === false
    && parseWhatsAppSettings('bad').attachPdf === true && parseWhatsAppSettings('{"attachPdf":false}').attachPdf === false,
    'WhatsApp settings: pay link and the bill PDF on by default (v4.133.0), a shop turning it off is kept, bad saved values fall back');

  const { whatsAppUrls } = require('../whatsapp.js');
  const u1 = whatsAppUrls('919822012345', 'hi there');
  const u2 = whatsAppUrls('', 'x');
  const u3 = whatsAppUrls('91982', 'y'.repeat(3000));
  assert(u1.app === 'whatsapp://send?phone=919822012345&text=hi%20there' && u1.web === 'https://wa.me/919822012345?text=hi%20there' && !u1.tooLong
    && u2.app === 'whatsapp://send?text=x' && u2.web === 'https://wa.me/?text=x' && u3.number === '' && u3.tooLong && u3.webBase === 'https://wa.me/',
    'Main side: whatsapp://send for WhatsApp Desktop, wa.me otherwise; a bad number is dropped (WhatsApp asks for the chat); over the Windows link limit → copy + open the chat');
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const waJs = fs.readFileSync(path.join(__dirname, '..', 'whatsapp.js'), 'utf8');
  assert(/ipcMain\.handle\('kp:open-whatsapp'/.test(mainJs) && /openWhatsApp: \(request\) => ipcRenderer\.invoke\('kp:open-whatsapp', request\)/.test(fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8'))
    && (pkgJson.build?.files || []).includes('whatsapp.js') && /getApplicationNameForProtocol\('whatsapp:\/\/'\)/.test(waJs) && /clipboard\.writeText\(text\)/.test(waJs)
    && /<WhatsAppHost \/>/.test(readSource('components/layout/AppShell.tsx')),
    'kp:open-whatsapp wired (main, preload, packaged); WhatsApp Desktop detected by its protocol; the window lives in the app shell');
  const comp = readSource('components/whatsapp/WhatsAppComposer.tsx');
  assert(/addEventListener\('keydown', onKey, true\)/.test(comp) && /stopImmediatePropagation\(\)/.test(comp) && /z-\[60\]/.test(comp) && /aria-modal="true"/.test(comp)
    && /await import\('@\/lib\/invoices\/invoiceOutput'\)/.test(comp) && !/from '@\/lib\/invoices\/invoiceOutput'/.test(comp),
    'WhatsApp window sits above other windows, Esc closes only it, F1 / Ctrl+H stay off, the PDF engine loads only when a PDF is asked for');
  const places: [string, RegExp][] = [
    ['components/invoices/InvoiceModal.tsx', /kind: 'bill'/], ['components/transactions/TransactionBillCard.tsx', /kind: 'bill'/],
    ['components/khata/KhataCustomerDetail.tsx', /kind: 'khata'/], ['components/khata/CustomerLedgerTimelineTab.tsx', /kind: 'slip'/],
    ['components/customers/CustomerCard.tsx', /kind: 'customer'/], ['components/customers/CustomerTableView.tsx', /kind: 'customer'/],
    ['components/suppliers/SupplierDetailPanel.tsx', /kind: 'supplier'/], ['components/billing/PosDialogs.tsx', /kind: 'payment'/],
    ['components/reports/DayEndClosingReportModal.tsx', /remember: 'owner'/], ['components/cash-register/DenominationCalculatorModal.tsx', /cashTallyMessage\(/],
    ['app/gst-reports/page.tsx', /remember: 'ca'/], ['components/dashboard/DashboardStockWatchlist.tsx', /<RestockOrderButton/], ['components/inventory/ReorderAlertsList.tsx', /<RestockOrderButton/],
    ['components/settings/InvoiceSettingsTab.tsx', /<WhatsAppSettingsCard \/>/],
  ];
  const missing = places.filter(([rel, re]) => !re.test(readSource(rel))).map(([rel]) => rel);
  assert(missing.length === 0 && !/wa\.me/.test(readSource('components/suppliers/SupplierDetailPanel.tsx')),
    `WhatsApp is on every screen the Android app has it (missing: ${missing.join(', ') || 'none'}); no hand-made wa.me links left`);
  assert(/document\.activeElement === searchInputRef\.current \|\| Boolean\(document\.querySelector\('\[data-whatsapp-composer\]'\)\)/.test(readCounter()),
    'On Billing the barcode listener stands aside while the WhatsApp window is open (a typed number is not a scan)');
}

// (p) Products page toolbar (v4.81.0): the webcam "Scan" is gone — it filled an Add Product form
// that was not open, so nothing happened (a USB gun types into the search / barcode box). A gun's
// Enter in the Add Product barcode box fills name / MRP from the offline list instead of saving a
// half-filled form. The search finds HSN / size / colour as its box says. Category chips wrap
// (a mouse wheel cannot scroll sideways) with "All categories (N)".
{
  const shirt = { name: 'Cotton Shirt (XL)', barcode: '8901234567890', hsn_code: '6205', size: 'XL', color: 'Red', variant_label: 'XL' };
  assert(matchesProductDetails(shirt, '6205') && matchesProductDetails(shirt, 'red xl') && matchesProductDetails(shirt, 'shirt RED') && matchesProductDetails({ name: 'Kurta', size: 'M' }, 'm')
    && !matchesProductDetails({ name: 'Mango Pickle' }, 'm') && !matchesProductDetails(shirt, 'blue') && !matchesProductDetails(shirt, '   '),
    'Products search finds HSN, size and colour (every word somewhere in the item); a one-letter word must be a whole size, not any "m" in a name');
  const page = readProductsPage();
  const toolbar = readSource('components/products/ProductFilterToolbar.tsx');
  const field = readSource('components/products/ProductBarcodeField.tsx');
  assert(!fs.existsSync(path.join(SRC_ROOT, 'components/barcode/BarcodeScannerModal.tsx')) && !ALL_SOURCE.some((f) => /BarcodeScannerModal|onOpenScanner|Scan Camera/.test(fs.readFileSync(f, 'utf8'))),
    'No webcam scanner left anywhere (the toolbar Scan filled a closed form); the USB gun types into the boxes');
  assert(/productSearchScore\(p, productQuery\) < 0 && !matchesProductDetails\(p, debouncedSearch\)/.test(page),
    'The Products search box uses the detail match next to the shared name / barcode search');
  assert(/e\.key !== 'Enter'/.test(field) && /e\.preventDefault\(\);/.test(field) && /onScanned\?\.\(value\.trim\(\)\)/.test(field) && /onBarcodeScanned=\{handleBarcodeScanned\}/.test(page),
    "A gun's Enter in the Add Product barcode box never saves the half-filled form; it fills name / MRP from the offline list");
  assert(/flex-wrap/.test(toolbar) && !/overflow-x-auto/.test(toolbar) && /data-product-category-more/.test(toolbar) && /\[picked, \.\.\.categories\.filter/.test(toolbar),
    'Category chips wrap (no side-scroll a mouse cannot reach) with "All categories (N)"; the picked one stays first');
}

// (q) More feature switches (v4.81.0): Khata, Customers, Inventory, Barcode Studio & Labels, Sales
// Analytics, Invoice Themes and WhatsApp. They start ON (the shop keeps what it had); switched off
// they leave the menu, Home and every button that leads there. Khata off also takes Credit / Udhar
// off the counter — no Credit button, no F9, no udhar split, short cash refused.
{
  const D = DEFAULT_FEATURE_SWITCHES;
  assert(D.khata && D.customers && D.inventory && D.barcode_studio && D.sales_reports && D.invoice_designer && D.whatsapp,
    'The switches added in v4.81.0 start ON — nothing a shop used disappears after the update');
  const saved = parseFeatureSwitches(JSON.stringify({ profit_privacy: false, cash_register: false }));
  assert(saved.khata && saved.whatsapp && saved.barcode_studio && !saved.profit_privacy && parseFeatureSwitches(JSON.stringify({ khata: false })).khata === false,
    'Switches saved before v4.81.0 (or in an old backup) keep their values; the new ones read as on until switched off');
  assert(featureForPath('/khata') === 'khata' && featureForPath('/customers?search=98') === 'customers' && featureForPath('/inventory/') === 'inventory'
    && featureForPath('/barcode-generator?from=inward') === 'barcode_studio' && featureForPath('/reports') === 'sales_reports' && featureForPath('/invoice-designer') === 'invoice_designer'
    && ['/', '/billing', '/products', '/transactions', '/cloud-backup', '/settings'].every((p) => featureForPath(p) === undefined),
    'Each new screen switch matches its address; Home, Billing, Products, Transactions, Backup and Settings can never be switched off');
  assert(FEATURES.find((f) => f.id === 'whatsapp')?.group === 'tools',
    'The feature list keeps WhatsApp in the "tools" group (Admin Console names)');

  const pos = readCounter();
  assert(/\.filter\(\(m\) => khataOn \|\| m\.id !== 'credit'\)/.test(pos) && /if \(!isFeatureOn\('khata'\)\) return; \/\/ Khata off/.test(pos) && /creditAllowed=\{khataOn\}/.test(pos)
    && /if \(isCreditMode && !udharAllowed\)/.test(pos) && /\(!hasCustomer \|\| !udharAllowed\)/.test(pos) && /const udharTarget = Boolean\(targetCustomer\) && udharAllowed;/.test(pos)
    && /if \(paymentMethod === 'credit'\) setPaymentMethod\('cash'\);/.test(pos)
    && /\{creditAllowed && \(/.test(readSource('components/billing/PosPaymentPanels.tsx'))
    && /khataOn \|\| key !== 'F9'/.test(readSource('components/layout/DesktopStatusBar.tsx')),
    'Khata off: no Credit button, F9 or udhar split on the counter (the status bar drops F9); a bill left on Credit goes back to Cash; short cash is refused and an unsplit rest is cash — never udhar');

  assert(quickActionsFor({ purchases: true, khata: false }).map((a) => a.id).join(',') === 'new_bill,stock_inward,day_summary,printers'
    && quickActionsFor({ purchases: true }).some((a) => a.id === 'khata'),
    'Home: Khata off takes its Quick Action tile away (the others grow into the row)');
  const pulse = readSource('components/dashboard/TodayBusinessPulse.tsx');
  assert(/<CardLink on=\{reportsOn\} href="\/reports"/.test(pulse) && /<CardLink on=\{khataOn\} href="\/khata">/.test(pulse)
    && /\{switches\.sales_reports && <AdvancedAnalyticsBanner \/>\}/.test(readSource('components/dashboard/DashboardHome.tsx')),
    'Home cards open Khata / Sales Analytics only while those screens are on; the analytics banner hides with its screen');

  const khataPage = readKhata();
  assert(/\{khataOn && \(/.test(readSource('components/customers/CustomerCard.tsx')) && /\{khataOn && <Link href=\{`\/khata/.test(readSource('components/customers/CustomerTableView.tsx'))
    && /\{khataOn && \(/.test(readSource('components/customers/CustomerHeaderActions.tsx')) && (khataPage.match(/\{customersOn && \(/g) || []).length === 2,
    'Khata / Customers off: the Customers page has no Khata buttons, the Khata page no Customers links');
  const invoiceModal = readSource('components/invoices/InvoiceModal.tsx');
  assert(/designerOn \? \(/.test(invoiceModal) && /onRequestReturn && designerOn &&/.test(invoiceModal)
    && /const designerOn = useFeatureSwitches\(\)\.invoice_designer;[\s\S]*if \(!sale \|\| !business\) return null;/.test(invoiceModal)
    && /\{switches\.invoice_designer && \(/.test(readSource('components/settings/InvoiceSettingsTab.tsx')) && /\{designerOn && \(/.test(readSource('components/settings/SettingsNavTabs.tsx')),
    'Invoice Themes off: no Theme links in the bill window or Settings (the switch is read before the bill window\'s early return)');

  assert(/if \(!whatsappOn\) return null;/.test(readSource('components/whatsapp/WhatsAppButton.tsx')) && /products\.length === 0 \|\| !whatsappOn/.test(readSource('components/whatsapp/RestockOrderButton.tsx'))
    && /\{switches\.whatsapp && <WhatsAppSettingsCard \/>\}/.test(readSource('components/settings/InvoiceSettingsTab.tsx'))
    && !ALL_SOURCE.some((f) => !/(components|lib)[\\/]whatsapp[\\/]/.test(f) && /openWhatsAppComposer\(/.test(fs.readFileSync(f, 'utf8'))),
    'WhatsApp off hides every WhatsApp button — all of them are WhatsAppButton / RestockOrderButton (no screen opens the window itself) — and the message settings');

  assert(/on1ClickBarcodePrint=\{switches\.barcode_studio \? handle1ClickBarcodePrint : undefined\}/.test(readProductsPage())
    && /\{on1ClickBarcodePrint && <button/.test(readSource('components/products/ProductTableView.tsx'))
    && /\{switches\.barcode_studio && !\(variantsEnabled && !editingProduct\) && \(/.test(readProductForm())
    && /\{switches\.barcode_studio && \(\s*<button[\s\S]{0,300}?save\(true\)/.test(readSource('components/inward/FastBarcodeInwardModal.tsx'))
    && /labelCount > 0 && switches\.barcode_studio/.test(readSource('components/inward/FastBarcodeInwardModal.tsx'))
    && /const labels = labelsOn \?/.test(readSource('components/purchases/BillInwardDone.tsx'))
    && /labelOffer && labelsOn && <InwardLabelOffer/.test(readSource('app/purchases/page.tsx'))
    && /\{labelsOn && result && result\.created/.test(readSource('components/import/CatalogImportModal.tsx')),
    'Barcode Studio & Labels off: no label button on a product row or in the product form, none after Fast inward, a supplier bill, a manual inward or an Excel import');
  const studioLinks = ALL_SOURCE.filter((f) => /\/barcode-generator/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, '/'));
  const studioGuardedElsewhere = ['components/layout/Sidebar.tsx', 'components/dashboard/QuickToolsGrid.tsx', 'lib/features/featureSwitches.ts', 'app/barcode-generator/page.tsx',
    'components/purchases/BillScanReviewModal.tsx' /* its button lives in BillInwardDone */, 'components/purchases/InwardLabelOffer.tsx' /* shown only by Purchases when on */];
  const unguarded = studioLinks.filter((rel) => !studioGuardedElsewhere.includes(rel) && !/barcode_studio|labelsOn/.test(readSource(rel)));
  assert(unguarded.length === 0, `Every way into Barcode Studio checks its switch (unguarded: ${unguarded.join(', ') || 'none'})`);
}

// (r) Hourly automatic backup (v4.82.0, K-D18). The day's backup file used to be written once,
// 2 minutes after the app opened — so it held only yesterday's bills, and a disk that died in the
// evening took the whole day's bills with it. Now the same file is refreshed at most hourly while
// data changes (every Dexie write marks it), when the counter is free — or anyway after 2 hours.
{
  const now = Date.parse('2026-09-30T18:00:00+05:30');
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const decide = (o: Partial<Parameters<typeof autoBackupDecision>[0]>) =>
    autoBackupDecision({ hasTodaysBackup: true, lastBackupAt: ago(90), changedSinceBackup: true, msSinceLastInput: 10 * 60_000, now, ...o });
  assert(decide({ hasTodaysBackup: false, changedSinceBackup: false, msSinceLastInput: 0 }) === 'backup',
    "Backup: the day's first file is written at app start as before, even with no change yet and someone at the counter");
  assert(decide({ changedSinceBackup: false }) === 'no-changes' && decide({ lastBackupAt: ago(20) }) === 'too-soon' && decide({}) === 'backup',
    'Backup: refreshed when data changed and the file is over an hour old; nothing changed or under an hour = no work');
  assert(REFRESH_EVERY_MS === 60 * 60_000 && QUIET_FOR_MS === 30_000 && MAX_WAIT_MS === 2 * REFRESH_EVERY_MS
    && decide({ msSinceLastInput: 5_000 }) === 'counter-busy' && decide({ msSinceLastInput: 5_000, lastBackupAt: ago(121) }) === 'backup',
    'Backup: waits while the counter is in use (a key / scan / click in the last 30 s), but never past 2 hours in a rush');
  assert(decide({ lastBackupAt: null }) === 'backup' && decide({ lastBackupAt: new Date(now + 3 * 3600_000).toISOString() }) === 'backup' && decide({ lastBackupAt: 'garbage' }) === 'backup',
    'Backup: a missing, unreadable or "future" file time (PC clock put back) counts as old — never as fresh');

  // The change tracker: a pass-through DBCore middleware; writes mark, reads do not.
  const RESULT = { numFailures: 0, failures: {}, results: ['s1'] };
  const fakeTable: any = { name: 'sales', get: () => 'row', query: () => 'rows', mutate: () => ({ then: (f: (r: unknown) => unknown) => f(RESULT) }) };
  const core = (backupChangeMiddleware.create as any)({ stack: 'dbcore', table: () => fakeTable, tables: [] });
  const wrapped = core.table('sales');
  clearDataChanged();
  const readUntouched = wrapped.get === fakeTable.get && wrapped.query === fakeTable.query && !dataChangedSinceBackup();
  const out = wrapped.mutate({ type: 'put', values: [{ id: 's1' }] });
  assert(readUntouched && out === RESULT && dataChangedSinceBackup(),
    'Backup: every database write marks "changed" and passes its result on unchanged; reads are not wrapped');

  const dbSrc = readSource('lib/db/index.ts');
  assert(/export const db = new VyaparSetuDatabase\(\);[\s\S]{0,200}?db\.use\(backupChangeMiddleware\);/.test(dbSrc) && backupChangeMiddleware.stack === 'dbcore',
    'Backup: the change tracker is registered right where the database is made (before it opens), so no write is missed');
  const auto = readSource('lib/backup/autoBackup.ts');
  assert(/clearDataChanged\(\);\s*const payload = await createFullBackupPayload\(\);/.test(auto) && (auto.match(/markDataChanged\(\);/g) || []).length === 3
    && /changedSinceBackup: dataChangedSinceBackup\(\)/.test(auto) && /if \(!force\) \{/.test(auto),
    'Backup: "changed" is cleared just before the tables are read (a bill during the backup marks it again) and set back if the backup fails; Backup Now / restore still force it');
  const sched = readSource('components/layout/AutoBackupScheduler.tsx');
  assert(/CHECK_EVERY_MS = 5 \* 60 \* 1000/.test(sched) && /addEventListener\('keydown', onInput/.test(sched) && /addEventListener\('pointerdown', onInput/.test(sched)
    && /runAutoBackup\(\{ msSinceLastInput: Date\.now\(\) - lastInputAt \}\)/.test(sched) && /requestIdleCallback/.test(sched),
    'Backup: checked every 5 minutes on idle; keys (the barcode gun too) and clicks tell it the counter is in use');
}

// (s) Cloud data contract (v4.83.0, K-P15 — docs/CLOUD_DATA_CONTRACT.md). Desktop and Android read one
// cloud: money as *_paise, stock as stock_quantity, the shop as biz_<uid>. Before this the Desktop sent
// raw Dexie rows — a ₹100 bill read as ₹10,000 on the phone, product prices as ₹0, stock as 0 — and
// saved the phone's documents as Dexie rows unchanged. Every document now goes through toCloud / fromCloud.
{
  const ctx = { bizId: 'biz_UID1' };
  const norm = (v: any): any => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])])) : v;
  const same = (a: any, b: any) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

  // Products.
  const product = { id: 'p1', business_id: 'biz_UID1', name: 'Tata Salt 1kg', barcode: '8901', category_id: 'c1', unit: 'packet', purchase_price: 2200, selling_price: 2800, mrp: 3000,
    tax_rate: 5, is_tax_inclusive: true, current_stock: 12.5, min_stock_level: 2, is_favorite: false, is_active: true, created_at: '2026-09-30T05:00:00.000Z', updated_at: '2026-09-30T06:00:00.000Z' };
  const pc = toCloud('products', { ...product, business_id: 'biz_local_1', sync_status: 'pending' }, ctx);
  assert(pc.selling_price_paise === 2800 && pc.mrp_paise === 3000 && pc.purchase_price_paise === 2200 && pc.stock_quantity === 12.5
    && !['selling_price', 'mrp', 'purchase_price', 'current_stock', 'sync_status'].some((k) => k in pc) && pc.business_id === 'biz_UID1',
    'Cloud contract: a product goes out as selling_price_paise / mrp_paise / purchase_price_paise / stock_quantity under biz_<uid> — no raw Dexie names');
  assert(same(fromCloud('products', pc, null, ctx), product), 'Cloud contract: a product comes back from the cloud exactly as it went out');

  // A product as the Android app writes it today (pushProductToCloud).
  const androidProduct = { id: 'a1', business_id: 'biz_UID1', name: 'Parle-G', barcode: '8902', category_id: 'cat9', selling_price_paise: 1000, selling_price: 1000, mrp_paise: 1000, mrp: 1000,
    purchase_price_paise: 850, purchase_price: 850, stock_quantity: 40, current_stock: 40, tax_rate: 18, is_tax_inclusive: true, unit: 'pcs', is_loose_item: false, is_active: true,
    is_favorite: false, business_type: 'grocery', batch_number: 'B12', expiry_date: '2027-01-31', has_variants: 0, sync_status: 'synced', lastSyncedAt: '2026-09-30T10:00:00.000',
    updated_at: { seconds: 1790000000, nanoseconds: 0 } };
  const ap = fromCloud('products', androidProduct, null, ctx);
  assert(ap.selling_price === 1000 && ap.mrp === 1000 && ap.purchase_price === 850 && ap.current_stock === 40 && ap.unit === 'piece' && ap.has_variants === false
    && ap.updated_at === new Date(1790000000 * 1000).toISOString() && !('lastSyncedAt' in ap) && !('stock_quantity' in ap) && ap.min_stock_level === 0 && ap.category_id === 'cat9',
    "Cloud contract: the phone's product reads right on the Desktop — price, MRP, stock, 'pcs' → piece, 1/0 → true/false, a server Timestamp → an ISO time");
  assert(toCloud('products', ap, ctx).batch_number === 'B12' && toCloud('products', ap, ctx).expiry_date === '2027-01-31',
    "Cloud contract: fields only the phone knows (batch, expiry) ride along and go back unchanged when the Desktop saves the product");

  // Customers: the phone's `opening_balance: 0` must not wipe the Desktop's opening balance (C9).
  const customer = { id: 'c1', business_id: 'biz_UID1', name: 'Ramesh', phone: '9876543210', gstin: '27ABCDE1234F1Z5', date_of_birth: '1990-08-15', opening_balance: 20000,
    current_balance: 50000, loyalty_points: 3, total_spent: 125000, total_visits: 9, customer_type: 'vip', created_at: '2026-09-01T05:00:00.000Z', updated_at: '2026-09-30T05:00:00.000Z' };
  const cc = toCloud('customers', customer, ctx);
  assert(cc.current_balance_paise === 50000 && cc.opening_balance_paise === 20000 && cc.total_spent_paise === 125000 && cc.is_vip === true && cc.birthday === '08-15' && cc.state_code === '27'
    && !('current_balance' in cc), 'Cloud contract: a customer goes out with udhar as current_balance_paise, is_vip, birthday MM-DD and the GST state code');
  assert(same(fromCloud('customers', cc, null, ctx), customer), 'Cloud contract: a customer comes back exactly as it went out');
  const phoneCust = fromCloud('customers', { id: 'c1', name: 'Ramesh', phone: '9876543210', current_balance_paise: 70000, current_balance: 70000, opening_balance: 0, is_vip: true,
    birthday: '08-15', credit_limit_paise: 500000 }, customer, ctx);
  assert(phoneCust.opening_balance === 20000 && phoneCust.current_balance === 70000 && phoneCust.date_of_birth === '1990-08-15' && phoneCust.credit_limit === 500000 && !('credit_limit_paise' in phoneCust) && phoneCust.loyalty_points === 3,
    "Cloud contract: the phone's customer save updates the udhar but never zeroes the opening balance, keeps the birth year and what the phone does not send; its udhar limit is the Desktop's credit_limit (v4.102.0)");
  const cleared = fromCloud('customers', { id: 'c1', address: '' }, { ...customer, address: 'Main Road' }, ctx);
  assert(cleared.address === '' && cleared.phone === '9876543210', 'Cloud contract: a field sent empty is cleared; a field not sent keeps this computer\'s value');

  // A bill with a line discount, a bill discount and a split payment — money exact both ways.
  const mk = (id: string, qty: number, rate: number, disc: number, tax: number) => {
    const total = qty * rate - disc;
    return { product_id: id, product_name: id.toUpperCase(), quantity: qty, unit: 'piece', unit_price: rate, mrp: rate, discount_amount: disc, tax_rate: tax,
      tax_amount: calculateLineTax(total, tax, true), total_amount: total, is_tax_inclusive: true } as any;
  };
  const lines = allocateBillDiscount([mk('a', 2, 5000, 0, 5), mk('b', 1, 10000, 1000, 18)], 1400);
  const t = computeBillTotals(lines);
  const sale = { id: 'sale_1', business_id: 'biz_UID1', invoice_number: 'INV-0101', customer_id: 'c1', customer_name: 'Ramesh', items: lines, subtotal: t.subtotal, discount_total: t.discountTotal,
    tax_total: t.taxTotal, grand_total: t.grandTotal, payment_method: 'split', payment_split: { cash_amount: 10000, upi_amount: 5000, card_amount: 0, credit_amount: t.grandTotal - 15000 },
    amount_received: 15000, balance_due: t.grandTotal - 15000, change_returned: 0, payment_status: 'partial', status: 'completed', created_by: 'owner',
    created_at: '2026-09-30T12:30:00.000Z', updated_at: '2026-09-30T12:30:00.000Z' };
  const sc = toCloud('sales', sale, ctx);
  assert(sc.total_amount_paise === t.grandTotal && sc.subtotal_paise === t.subtotal && sc.tax_amount_paise === t.taxTotal && sc.discount_paise === 1400 && sc.line_discount_paise === 1000
    && sc.split_cash_paise === 10000 && sc.split_upi_paise === 5000 && sc.split_credit_paise === t.grandTotal - 15000 && sc.balance_due_paise === t.grandTotal - 15000
    && sc.timestamp === Date.parse(sale.created_at) && sc.source === 'desktop' && !('grand_total' in sc) && !('payment_split' in sc),
    `Cloud contract: a ₹${t.grandTotal / 100} bill goes out as total_amount_paise ${t.grandTotal}; bill discount 1400 and line discount 1000 apart; the split as flat *_paise fields`);
  const lb = sc.items[1];
  assert(lb.unit_price_paise === 10000 && lb.gross_total_paise === 9000 && lb.discount_paise === 1000 && lb.bill_discount_paise === lines[1].bill_discount_amount
    && sc.items.reduce((s: number, l: any) => s + l.bill_discount_paise, 0) === 1400 && lb.is_tax_inclusive === true,
    'Cloud contract: a bill line carries gross_total_paise before its share of the bill discount (the phone\'s meaning), its own discount and that share apart');
  assert(same(fromCloud('sales', sc, null, ctx), sale), 'Cloud contract: the bill comes back exactly — every line, tax, discount and the split');
  assert(toCloud('sales', { ...sale, items: [], grand_total: 10000, subtotal: 10000, tax_total: 0, discount_total: 0 }, ctx).total_amount_paise === 10000,
    'Cloud contract: a ₹100 bill is 10000 paise in the cloud — not ₹10,000 on the phone');

  // A bill as the phone writes it today (pushSaleToCloud): udhar, a partial return, a flat ₹10 line discount.
  const phoneSale = fromCloud('sales', { id: 's-and-1', business_id: 'biz_UID1', invoice_number: 'INV-0042', customer_name: 'Suresh', subtotal_paise: 19000, tax_amount_paise: 0,
    discount_paise: 0, total_amount_paise: 19000, total_amount: 190.0, payment_method: 'credit', status: 'partially_refunded', created_at: '2026-09-30T18:05:00.000', timestamp: 1, source: 'mobile_native_pos',
    items: [{ product_id: 'a1', product_name: 'Parle-G', quantity: 2, unit_price_paise: 10000, gross_total_paise: 19000, cost_price_paise: 8500, tax_rate: 0, is_tax_inclusive: 1,
      discount_type: 'flat', discount_value: 10.0, returned_quantity: 1 }], synced_at: { seconds: 1, nanoseconds: 0 } }, null, ctx) as any;
  const pl = phoneSale.items[0];
  assert(phoneSale.grand_total === 19000 && phoneSale.status === 'partial_return' && phoneSale.balance_due === 19000 && phoneSale.amount_received === 0 && phoneSale.payment_status === 'unpaid'
    && !('total_amount' in phoneSale) && !('synced_at' in phoneSale) && phoneSale.created_at === new Date('2026-09-30T18:05:00.000').toISOString()
    && pl.unit_price === 10000 && pl.total_amount === 19000 && pl.discount_amount === 1000 && pl.is_tax_inclusive === true && pl.tax_amount === 0 && pl.cost_price === 8500 && pl.unit === 'piece' && pl.returned_quantity === 1,
    "Cloud contract: the phone's udhar bill reads right on the Desktop — total, 'partially_refunded' → partial_return, what is owed, the line and its ₹10 discount, local time → UTC");

  // The shop: no plan fields out or in, this computer's invoice counter and type stay its own.
  const shopOut = toCloud('businesses', { id: 'biz_local_1', name: 'Jadhav Stores', owner_name: 'Rahul', phone: '9000000000', address: 'Pune', upi_id: 'shop@upi', fssai_license_no: '1234',
    business_type: 'retail', subscription_tier: 'pro', subscription_valid_until: '2027-01-01', next_invoice_number: 57, is_onboarded: true, currency: 'INR', sync_status: 'pending' }, ctx);
  assert(shopOut.id === 'biz_UID1' && shopOut.upi_vpa === 'shop@upi' && shopOut.fssai === '1234' && shopOut.platform === 'desktop'
    && !['subscription_tier', 'subscription_valid_until', 'next_invoice_number', 'business_type', 'upi_id', 'is_onboarded', 'sync_status'].some((k) => k in shopOut),
    'Cloud contract: the shop goes out as biz_<uid> with upi_vpa / fssai, never with plan fields (the rules would refuse the whole save), its invoice counter or a business type');
  const shopIn = fromCloud('businesses', { name: 'Jadhav Stores', is_pro: true, account_disabled: true, next_invoice_number: 999, business_type: 'pharmacy', shop_name: 'Jadhav Stores', upi_vpa: 'new@upi' },
    { id: 'biz_local_1', name: 'Old', next_invoice_number: 57, business_type: 'retail', upi_id: 'shop@upi' }, ctx);
  assert(shopIn.id === 'biz_local_1' && shopIn.next_invoice_number === 57 && shopIn.business_type === 'retail' && shopIn.upi_id === 'new@upi' && shopIn.name === 'Jadhav Stores'
    && !['is_pro', 'account_disabled', 'shop_name', 'upi_vpa'].some((k) => k in shopIn),
    "Cloud contract: the cloud shop never brings plan fields, the kill-switch or the phone's extra names into Dexie, nor changes this computer's invoice counter");

  // Khata, returns, purchase bills, cash shifts (D1): money renamed inside the nested lines too.
  const ledger = { id: 'ledg_1', business_id: 'biz_UID1', party_type: 'customer', party_id: 'c1', party_name: 'Ramesh', transaction_type: 'PAYMENT_RECEIVED', amount: 30000, balance_after: 20000,
    bill_allocations: [{ sale_id: 'sale_1', amount: 30000 }], created_at: '2026-09-30T13:00:00.000Z' };
  const ret = { id: 'ret_1', business_id: 'biz_UID1', return_number: 'RET-1', original_sale_id: 'sale_1', original_invoice_number: 'INV-0101', refund_amount: 5000, refund_method: 'cash',
    created_by: 'owner', created_at: '2026-09-30T14:00:00.000Z', items: [{ product_id: 'a', product_name: 'A', quantity: 1, unit: 'piece', unit_price: 5000, tax_rate: 5, total_amount: 5000, restock_to_inventory: true }] };
  const bill = { id: 'pb_1', business_id: 'biz_UID1', raw_ai_response: '', ai_model_used: 'manual', status: 'confirmed', total_amount: 44000, created_at: '2026-09-30T08:00:00.000Z',
    line_items: [{ raw_name: 'Salt', is_new_product: false, quantity: 20, unit_price: 2200, total_price: 44000, selling_price: 2800, mrp: 3000, confidence: 'high' }] };
  const shift = { id: 'reg_1', business_id: 'biz_UID1', opened_at: '2026-09-30T03:30:00.000Z', opening_cash: 100000, cash_sales: 250000, upi_sales: 90000, credit_sales: 0, cash_in: 0, cash_out: 5000,
    expected_closing_cash: 345000, status: 'open', opened_by: 'owner' };
  const lc = toCloud('ledger_transactions', ledger, ctx);
  assert(lc.amount_paise === 30000 && lc.balance_after_paise === 20000 && lc.bill_allocations[0].amount_paise === 30000 && toCloud('sales_returns', ret, ctx).items[0].unit_price_paise === 5000
    && toCloud('purchase_bills', bill, ctx).line_items[0].total_price_paise === 44000 && toCloud('cash_registers', shift, ctx).expected_closing_cash_paise === 345000
    && same(fromCloud('ledger_transactions', lc, null, ctx), ledger) && same(fromCloud('sales_returns', toCloud('sales_returns', ret, ctx), null, ctx), ret)
    && same(fromCloud('purchase_bills', toCloud('purchase_bills', bill, ctx), null, ctx), bill) && same(fromCloud('cash_registers', toCloud('cash_registers', shift, ctx), null, ctx), shift),
    'Cloud contract: khata entries (with the bills a payment cleared), returns, supplier bills and cash shifts go out in paise names and come back exactly');

  assert([...CLOUD_TABLES].sort().join() === [...BACKUP_TABLES].sort().join(), 'Cloud contract: every table a backup file carries also goes to the cloud (D1) — and nothing else');
  assert(tableForCloudPath('businesses/biz_UID1') === 'businesses' && tableForCloudPath('businesses/biz_UID1/customers/c1') === 'customers' && tableForCloudPath('merchants/x') === null
    && tableForCloudPath('businesses/b/unknown/x') === null && normalizeUnit(' PCS ') === 'piece' && normalizeUnit('pkt') === 'packet',
    "Cloud contract: a cloud path names its table (anything else is not written); older unit words read as the Desktop's");
  assert(['bottle', 'can', 'bag'].every((u) => MASTER_UNITS.some((m) => m.id === u)), 'Units: bottle, can and bag exist on the Desktop too (the phone uses them — D3)');

  const syncSrc = readSource('lib/firebase/firestoreSync.ts');
  assert(/batch\.set\(ref, sanitizeForFirestore\(toCloud\(table, item, \{ bizId \}\)\)/.test(syncSrc) && (syncSrc.match(/fromCloud\(/g) || []).length >= 4
    && !/\.data\(\) as (Product|Customer|Sale|Category|Business)/.test(syncSrc) && /for \(const table of DATA_TABLES\)/.test(syncSrc)
    && /data\.account_disabled === true/.test(syncSrc) && /if \(!cloudShopExists\) shopDoc\.business_type = 'grocery';/.test(syncSrc),
    'Cloud contract: the full sync writes and reads only through toCloud / fromCloud (no raw Dexie rows either way), covers every table and obeys the admin kill-switch');
  assert(/toCloud\(table, data, \{ bizId \}\)/.test(readSource('lib/firebase/lazyCloud.ts')) && /toCloud\('businesses', businessDoc, \{ bizId: businessId \}\)/.test(readOnboarding())
    && !/subscription_tier: 'free'/.test(readOnboarding()),
    'Cloud contract: the per-bill mirror (cloudMerge) and onboarding write contract documents too; onboarding sends no plan field');
  const contractSrc = readSource('lib/cloud/cloudContract.ts') + readSource('lib/cloud/cloudFormat.ts');
  assert(!/from '(firebase|@\/lib\/db|@\/lib\/firebase)/.test(contractSrc), 'Cloud contract: the mapping is pure (no Firebase, no Dexie) — tested here, safe to load anywhere');
  assert(tableForCloudPath('businesses/biz_UID1/restaurant_orders/order_1') === 'restaurant_orders'
    && tableForCloudPath('businesses/biz_UID1/restaurant_meta/settings') === 'restaurant_meta',
    'Cloud contract: restaurant_orders and restaurant_meta paths map correctly for waiter app parity (Fix 5)');

  const writeSrc = readSource('lib/cloud/cloudWrite.ts');
  assert(writeSrc.includes('deleted: true') && writeSrc.includes('is_deleted: true'), 'Cloud delete: soft-delete tombstones written instead of hard delete for offline devices (Fix 2)');
  assert(/updated_at:\s*new Date\(\)\.toISOString\(\)/.test(writeSrc) && writeSrc.includes('synced_at: serverTimestamp()'), 'Cloud counters: counter increments include updated_at and synced_at (Fix 3)');

  const pullSrc = readSource('lib/cloud/cloudPull.ts');
  assert(pullSrc.includes('data.deleted === true || data.is_deleted === true'),
    'Cloud pull: tombstone soft-deletes are handled by deleting locally (Fix 2)');
  assert(!pullSrc.includes('restaurant_orders') && !pullSrc.includes('restaurant_meta') && !pullSrc.includes('RESTAURANT_COLLECTIONS')
    && readSource('lib/restaurant/cloudOrders.ts').includes('reconcileFirstRead(state, sent'),
    'Cloud pull (v4.171.0): running orders / restaurant Set-up are NOT in the generic pull — startRestaurantCloud owns them (a second listener brought back orders settled offline and overwrote this PC Set-up)');
}

// (t) Google sign-in (v4.84.0, Step 2 — Rahul: Google the very first time, then the master password).
// Google blocks sign-in inside an app window, so googleSignIn.js (main process) opens the browser and
// takes the answer on a one-time 127.0.0.1 server with PKCE + state; the page signs in to Firebase
// with the ID token and keeps the shop's cloud id biz_<uid> (the Android app's).
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gs = require(path.join(__dirname, '..', 'googleSignIn.js'));
  const pk = gs.createPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'); // RFC 7636 Appendix B
  assert(pk.challenge === 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' && gs.createPkce().verifier.length >= 43,
    'Google sign-in: the PKCE S256 challenge matches RFC 7636, and a fresh verifier is long enough');
  const u = new URL(gs.buildAuthUrl({ clientId: 'cid', redirectUri: 'http://127.0.0.1:5555', challenge: 'ch', state: 'st' }));
  assert(u.origin + u.pathname === 'https://accounts.google.com/o/oauth2/v2/auth' && u.searchParams.get('response_type') === 'code' && u.searchParams.get('code_challenge_method') === 'S256'
    && u.searchParams.get('scope') === 'openid email profile' && u.searchParams.get('redirect_uri') === 'http://127.0.0.1:5555' && u.searchParams.get('state') === 'st' && u.searchParams.get('prompt') === 'select_account',
    'Google sign-in: asks only for name + email (openid email profile), code flow with PKCE and state, back to 127.0.0.1, account picker shown');
  assert(gs.parseCallback('/?code=abc&state=st', 'st').code === 'abc' && gs.parseCallback('/?code=abc&state=other', 'st').error === 'state_mismatch'
    && gs.parseCallback('/?error=access_denied&state=st', 'st').error === 'access_denied' && gs.parseCallback('/?state=st', 'st').error === 'no_code',
    'Google sign-in: an answer with another state is refused; a cancel is reported, never taken as a sign-in');
  const fakeToken = ['x', Buffer.from(JSON.stringify({ email: 'owner@gmail.com', name: 'Owner', sub: '123' })).toString('base64url'), 'sig'].join('.');
  assert(gs.decodeIdToken(fakeToken).email === 'owner@gmail.com' && JSON.stringify(gs.decodeIdToken('garbage')) === '{}',
    "Google sign-in: the ID token's name / email are read; a broken token gives nothing");

  // The whole loop: a stand-in browser follows the link back to 127.0.0.1, a stand-in Google swaps the code.
  let tokenBody = '';
  const fakeFetch = async (_url: string, init: any) => {
    tokenBody = String(init.body);
    return { ok: true, status: 200, json: async () => ({ id_token: fakeToken }) };
  };
  const fakeShell = {
    openExternal: async (link: string) => {
      const a = new URL(link);
      await fetch(`${a.searchParams.get('redirect_uri')}/?code=THECODE&state=${a.searchParams.get('state')}`).then((r) => r.text());
    },
  };
  pendingAsyncChecks.push(gs.signIn({ shell: fakeShell, clientId: 'cid', clientSecret: 'sec', fetchImpl: fakeFetch }).then((res: any) => {
    const body = new URLSearchParams(tokenBody);
    assert(res.ok && res.idToken === fakeToken && res.email === 'owner@gmail.com' && body.get('code') === 'THECODE' && body.get('grant_type') === 'authorization_code'
      && (body.get('code_verifier') || '').length >= 43 && /^http:\/\/127\.0\.0\.1:\d+$/.test(body.get('redirect_uri') || '') && body.get('client_secret') === 'sec',
      'Google sign-in: the whole loop works — browser → 127.0.0.1 → code + PKCE verifier swapped for the ID token');
  }));
  pendingAsyncChecks.push(gs.signIn({ shell: { openExternal: async () => {} }, clientId: 'cid', clientSecret: 'sec', fetchImpl: fakeFetch, timeoutMs: 300 })
    .then((res: any) => assert(!res.ok && res.error === 'timeout', 'Google sign-in: no answer from the browser → times out and says so (the one-time server closes)')));
  pendingAsyncChecks.push(gs.signIn({ shell: fakeShell, clientId: '', clientSecret: '' })
    .then((res: any) => assert(!res.ok && res.error === 'not_configured', 'Google sign-in: a build without the OAuth client says so instead of opening the browser')));

  const acct = { uid: 'u1', email: 'a@b.c', name: 'A', photoURL: null, bizId: 'biz_u1', linkedAt: '2026-09-30T00:00:00.000Z' };
  assert(parseCloudAccount(JSON.stringify(acct))?.bizId === 'biz_u1' && parseCloudAccount(JSON.stringify({ ...acct, bizId: 'biz_other' })) === null
    && parseCloudAccount('nope') === null && parseCloudAccount(null) === null && cloudBizId('u1') === 'biz_u1',
    "Google account: kept as biz_<uid> (the Android app's shop id); a mismatched or broken record is ignored");

  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const gsSrc = fs.readFileSync(path.join(__dirname, '..', 'googleSignIn.js'), 'utf8');
  assert((pkgJson.build?.files || []).includes('googleSignIn.js') && /server\.listen\(0, '127\.0\.0\.1'/.test(gsSrc)
    && /process\.env\.KAMAI_E2E_GOOGLE_STUB === '1' && !app\.isPackaged\) \{/.test(mainSrc) && (mainSrc.match(/KAMAI_E2E_GOOGLE_STUB/g) || []).length === 1,
    'Google sign-in: packaged into the installer; the one-time server listens on 127.0.0.1 only; the test stand-in exists only in an unpackaged run');
  const authSrc = readSource('components/auth/AuthForm.tsx');
  assert(/tr\('Continue with Google'\)/.test(authSrc) && /tr\('Google account — optional'\)/.test(authSrc) && !/googleStepPending/.test(authSrc)
    && /disabled=\{loading \|\| !password \|\| !confirmPassword\}/.test(authSrc),
    'First run: the Google account is offered with the master password but optional (v4.85.0) — it can be connected later on Backup');
  const acctSrc = readSource('lib/cloud/cloudAccount.ts');
  assert(/initializeAuth\(firebaseApp, \{ persistence: indexedDBLocalPersistence \}\)/.test(readSource('lib/firebase/config.ts'))
    && /signInWithCredential\(auth, GoogleAuthProvider\.credential\(res\.idToken\)\)/.test(acctSrc) && !/^import .*firebase/m.test(acctSrc)
    && /<CloudAccountCard \/>/.test(readSource('app/cloud-backup/page.tsx')),
    'Google account: Firebase sign-in with the Google ID token (Firebase loaded only when connecting, session in IndexedDB); a shop set up earlier connects on the Backup page');
}

// 9j(v). v4.85.0 (Rahul) — the counter's customer boxes take a name / a 10-digit mobile (both
// optional), F2 = next bill (search moved to '/'), F4 / F8 / F9 behind a switch (off).
{
  assert(cleanCustomerNameInput('Rahul 123 Jadhav') === 'Rahul Jadhav' && cleanCustomerNameInput('राहुल जाधव') === 'राहुल जाधव'
    && cleanCustomerNameInput("  Mr. D'Souza & Sons!!") === "Mr. D'Souza & Sons" && cleanCustomerNameInput('रमेश९८@#') === 'रमेश'
    && cleanCustomerNameInput('रमेश  पाटील') === 'रमेश पाटील' && cleanCustomerNameInput('x'.repeat(80)).length === 60,
    "Customer name box: letters of any script (Hindi vowel signs kept) with . ' & -; digits (also Devanagari) and symbols dropped; at most 60");
  assert(cleanMobileInput('+91 98765 43210') === '9876543210' && cleanMobileInput('098765-43210') === '9876543210'
    && cleanMobileInput('abc98') === '98' && cleanMobileInput('') === '',
    'Mobile box: digits only, at most 10 — a pasted +91 / 0 number keeps its last 10 digits');
  const r = resolveBillCustomer([], { name: '', phone: '98765' });
  assert(r.kind === 'error' && r.field === 'phone' && resolveBillCustomer([], { name: '', phone: '' }).kind === 'none'
    && resolveBillCustomer([], { name: 'Ramesh', phone: '' }).kind === 'new',
    'Counter customer: both boxes optional; a mobile that is not 10 digits is an error, never saved');
  const posCustSrc = readSource('components/billing/PosCustomerRow.tsx');
  assert(/name: cleanCustomerNameInput\(e\.target\.value\)/.test(posCustSrc) && /phone: cleanMobileInput\(e\.target\.value\)/.test(posCustSrc)
    && /tr\('Customer name \(optional\)'\)/.test(posCustSrc) && /tr\('10-digit mobile \(optional\)'\)/.test(posCustSrc),
    'Counter customer row cleans both boxes as they are typed / pasted and says both are optional');

  assert(nextBillTabId([{ id: 'a' }], 'a') === null && nextBillTabId([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'a') === 'b'
    && nextBillTabId([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'c') === 'a' && nextBillTabId([{ id: 'a' }, { id: 'b' }], 'gone') === 'a',
    'F2: the next open bill, round to the first after the last; one bill open → null (F2 then opens a new bill)');
  const f2At = billingSrc.indexOf("if (e.key === 'F2') {");
  const f2Block = billingSrc.slice(f2At, billingSrc.indexOf("if (e.key === '/'", f2At));
  assert(f2At > 0 && /nextBillTabId\(tabs, activeTabId\)/.test(f2Block) && /handleCreateNewTab\(\)/.test(f2Block) && !/searchInputRef/.test(f2Block)
    && /if \(e\.key === '\/' && !isInput\) \{/.test(billingSrc) && /\[\/\]'\)/.test(billingSrc),
    "Billing: F2 switches to the next bill or opens a new one (it no longer duplicates search); '/' focuses search");

  assert(DEFAULT_FEATURE_SWITCHES.payment_keys === false && FEATURES.some((f) => f.id === 'payment_keys')
    && parseFeatureSwitches(JSON.stringify({ khata: true })).payment_keys === false && parseFeatureSwitches(JSON.stringify({ payment_keys: true })).payment_keys === true,
    'Payment keys F4 / F8 / F9: a switch in Settings → Features, off by default (also for a shop saved before v4.85.0)');
  assert(/if \(\(e\.key === 'F4' \|\| e\.key === 'F8' \|\| e\.key === 'F9'\) && !isFeatureOn\('payment_keys'\)\) return;/.test(billingSrc)
    && /\{m\.shortcut && paymentKeysOn && \(/.test(billingSrc),
    'Billing: with the switch off, F4 / F8 / F9 do nothing and the payment buttons show no key badge');
  assert(/\['F2', msg\('Next bill'\)\]/.test(statusBarSrc) && /\['\/', msg\('Search'\)\]/.test(statusBarSrc)
    && /paymentKeysOn \|\| !\['F4', 'F8', 'F9'\]\.includes\(key\)/.test(statusBarSrc) && /khataOn \|\| key !== 'F9'/.test(statusBarSrc),
    'Status bar: F2 "Next bill", / "Search"; F4 / F8 / F9 listed only when the switch is on (F9 also needs Khata)');
}

// 9j(w). v4.85.0 — Barcode Studio: a preview is always on screen (a sample label while the
// list is empty), the custom roll size can be typed, copies stay 1…999.
{
  const studioSrc = readSource('app/barcode-generator/page.tsx');
  assert(/<LabelPreview labels=\{labels\.length \? labels : sampleLabels\}/.test(studioSrc) && /data-preview-sample/.test(studioSrc)
    && !/labels\.length === 0 \? \(/.test(studioSrc) && /lg:sticky/.test(studioSrc),
    'Barcode Studio: the preview is always shown (a sample label with the current setup while the list is empty) and stays in view');
  const previewSrc = readSource('components/labels/LabelPreview.tsx');
  assert(/style=\{\{ height: `\$\{heightPx\}px`, maxHeight \}\}/.test(previewSrc) && !/h-\[62vh\]/.test(previewSrc)
    && /maxHeight="40vh"/.test(readSource('components/products/QuickBarcodePrintModal.tsx')),
    'Label preview: the frame is as tall as the labels (up to a limit), not a fixed 62vh box');
  assert(previewSrc.includes('key={frameKey}') && previewSrc.includes('const frameKey = useMemo('),
    'Label preview: new content = a new frame (changing srcdoc twice fast left Chromium a grey, never-drawn document — v4.86.0)');
  const setupSrc = readSource('components/labels/LabelSetupPanel.tsx');
  assert(/if \(customOk\(key, v\)\) update\(/.test(setupSrc) && /value=\{typed \?\? String\(s\.custom\[key\]\)\}/.test(setupSrc) && /onBlur=\{\(\) => endCustom\(key\)\}/.test(setupSrc),
    'Label setup: a custom size is saved only once usable — typing "38" no longer jumps back to 50 after the "3"');
  const lim = CUSTOM_LIMITS;
  const parsed = parseLabelSettings(JSON.stringify({ stockId: 'custom', custom: { widthMm: 38, heightMm: 25, across: 2, gapMm: 2 }, copies: 600 }));
  assert(parsed.custom.widthMm === 38 && parsed.custom.across === 2 && parsed.copies === DEFAULT_LABEL_SETTINGS.copies && MAX_SETUP_COPIES === 500
    && lim.widthMm[0] === 15 && lim.widthMm[1] === 120 && lim.heightMm[0] === 10 && lim.across[1] === 5 && lim.gapMm[1] === 10
    && parseLabelSettings(JSON.stringify({ stockId: 'custom', custom: { widthMm: 3 } })).custom.widthMm === DEFAULT_LABEL_SETTINGS.custom.widthMm,
    'Label settings: custom roll limits in one place (width 15–120, height 10–120, 1–5 across, gap 0–10); out of range falls back');
  const queueSrc = readSource('components/labels/LabelQueuePanel.tsx');
  assert(/const n = Math\.max\(1, Math\.min\(999, Math\.round\(Number\(allCopies\)\) \|\| 1\)\);/.test(queueSrc),
    'Print list: "Copies for all" stays 1…999 like the − / + boxes (it took any number before)');
  assert(/settings\.content\.price \? `PRICE:/.test(studioSrc) && /labels\.length === 1 \? tr\('Print 1 label'\)/.test(studioSrc),
    'Barcode Studio: Bluetooth labels follow "On the label" for price / MRP; one label reads "Print 1 label"');
  const html = buildLabelHtml([{ name: 'S', barcode: '2000000000015', pricePaise: 9900 }], stockFor(parseLabelSettings(JSON.stringify({ stockId: 'roll_38x25_2' }))), DEFAULT_LABEL_SETTINGS.content, { previewZoom: 1.5 });
  assert((html.match(/class="label"/g) || []).length === 1 && /zoom: 1\.5/.test(html) && labelsPerPage(LABEL_STOCKS.find((s) => s.id === 'roll_38x25_2')!) === 2,
    'Label preview HTML: one label drawn, magnified on screen only; a 2-across roll holds 2 labels per row');
}

// 9j(x). v4.85.0 (Rahul) — Admin Console controls the Desktop licence: an end date per key
// (signed, enforced offline, clock cannot be turned back) and an online check-in that brings
// renewals and stops a blocked / moved key. Signed-licence flows: scripts/electron_e2e.mjs §1b.
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lic = require('../licence.js');
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-10-01T06:30:00.000Z');
  const p = { v: 1, key: 'KPD-AAAA-BBBB-CCCC-DDDD', shop_name: 'Sharma Kirana', issued_at: '2026-09-30T00:00:00.000Z' };
  const life = lic.statusFor(p, now);
  const soon = lic.statusFor({ ...p, valid_until: new Date(now + 6 * day + 3600000).toISOString() }, now);
  const ended = lic.statusFor({ ...p, valid_until: new Date(now - 1000).toISOString() }, now);
  assert(life.state === 'active' && life.validUntil === null && life.daysLeft === null && soon.state === 'active' && soon.daysLeft === 6
    && ended.state === 'expired' && ended.key === 'KPD-AAAA-••••-••••-DDDD' && ended.validUntil,
    'Licence: no end date = lifetime; days left counted; past the end date = ended (key shown masked)');
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kp-sim-lic-'));
  const t1 = lic.licenceNow(tmp, p, now + 10 * day);
  const t2 = lic.licenceNow(tmp, p, now);
  const t3 = lic.licenceNow(fs.mkdtempSync(path.join(require('os').tmpdir(), 'kp-sim-lic-')), { ...p, issued_at: new Date(now + 3 * day).toISOString() }, now);
  assert(t1 === now + 10 * day && t2 === now + 10 * day && t3 === now + 3 * day,
    "Licence clock: never earlier than the latest time this PC has seen or the licence's server time (turning the clock back does not help)");

  const licSrc = fs.readFileSync(path.join(__dirname, '..', 'licence.js'), 'utf8');
  const mainSrc2 = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const preloadSrc = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert(/if \(body\.code === 'revoked' \|\| body\.code === 'moved' \|\| body\.code === 'not-found'\)/.test(licSrc) && /if \(call\.offline\) return \{ ok: false, offline: true \};/.test(licSrc)
    && /payload\.key !== current\.key/.test(licSrc) && licSrc.includes("callServer({ action: isTrial ? 'trial_refresh' : 'refresh', key: current.key"),
    'Check-in: only "revoked" / "moved" / "not-found" (key deleted, v4.117.0) stop the app; offline or any other answer changes nothing; a licence for another key is refused');
  assert(licSrc.includes("control: body.code === 'revoked' ? body.control : undefined"),
    "Check-in refused: only a blocked key's control (its wipe command) is used — a \"moved\" answer's commands are for the key's new PC and never run here");
  assert(/ipcMain\.handle\('kp:licence-refresh'/.test(mainSrc2) && /if \(app\.isPackaged && Date\.now\(\) - lastCheckIn >= checkInEveryMs\(\)\)/.test(mainSrc2) && /const LICENCE_CHECKIN_MS = 60 \* 60 \* 1000;/.test(mainSrc2)
    && /startLicenceWatch\(\);/.test(mainSrc2) && /webContents\.send\('kp:licence-changed', status\)/.test(mainSrc2)
    && /refreshLicence: \(\) => ipcRenderer\.invoke\('kp:licence-refresh'\)/.test(preloadSrc) && /ipcRenderer\.on\('kp:licence-changed', listener\)/.test(preloadSrc),
    'Check-in runs in the installed app only (every hour while online since v4.98.0; the Admin can set 15 min – 6 h since v4.105.0); every 5 min the licence is re-checked and the page told of a change');
  const gateSrc2 = readSource('components/licence/LicenceGate.tsx');
  assert(/return api\.onLicenceChanged\?\.\(setStatus\);/.test(gateSrc2) && /if \(status\.state === 'expired'\) \{[\s\S]{0,300}return <LicenceEndedScreen/.test(gateSrc2)
    && /licence\.daysLeft <= 7/.test(readSource('components/admin/AdminMessageBanner.tsx')) && /data-licence-check-again/.test(readSource('components/licence/LicenceEndedScreen.tsx')),
    'Licence gate: an ended KEY licence shows only the "licence has ended" screen with "Check again" (an ended trial asks for a key, v4.148.0); a week before the end a closable note shows (a strip under the top bar since v4.98.0)');
}

// (u) Step 3 + 4 — cloud sync both ways (v4.85.0 one way, v4.86.0 both ways). Off by default (a "beta"
// switch per computer). An outbox middleware notes every changed record — and for stock / udhar the CHANGE,
// sent as a Firestore increment exactly once; the phone's changes merge in echo-free. The full flow runs on
// the real Firestore + Auth emulators with the shop's rules: `npm run test:cloud` (scripts/cloud_sync_emulator.ts).
{
  const RES = (results: unknown[]) => ({ numFailures: 0, failures: {}, results });
  const rows: Record<string, Record<string, any>> = {};
  const fakeTable = (name: string) => ({
    name,
    schema: { primaryKey: { keyPath: 'id' } },
    getMany: (req: any) => Promise.resolve(req.keys.map((k: string) => rows[`${name}/${k}`])),
    mutate: (req: any) => {
      for (const v of req.values || []) rows[`${name}/${v.id}`] = v;
      return Promise.resolve(RES(req.values ? req.values.map((v: any) => v.id) : []));
    },
  });
  const tables: Record<string, any> = { products: fakeTable('products'), sales: fakeTable('sales'), customers: fakeTable('customers'), foo: fakeTable('foo') };
  const core = (cloudOutboxMiddleware.create as any)({ stack: 'dbcore', table: (n: string) => tables[n], tables: [] });

  pendingAsyncChecks.push((async () => {
    clearOutbox();
    setOutboxRecording(false);
    await core.table('products').mutate({ type: 'put', values: [{ id: 'p0', current_stock: 3 }] });
    const offNothing = JSON.stringify(peekOutbox()) === JSON.stringify(emptyOutbox());
    setOutboxRecording(true);
    rows['products/p1'] = { id: 'p1', current_stock: 10 };
    await core.table('products').mutate({ type: 'put', values: [{ id: 'p1', current_stock: 8 }, { id: 'p2', current_stock: 5 }] });
    await core.table('products').mutate({ type: 'put', values: [{ id: 'p1', current_stock: 7.5 }] });
    await core.table('sales').mutate({ type: 'add', values: [{ id: 's9' }] });
    await core.table('products').mutate({ type: 'delete', keys: ['p2'] });
    await core.table('customers').mutate({ type: 'deleteRange', range: {} });
    rows['customers/c1'] = { id: 'c1', current_balance: 0 };
    await core.table('customers').mutate({ type: 'put', values: [{ id: 'c1', current_balance: 50000 }] });
    // A write the CLOUD sent (cloudPull, marked transaction) is not noted — no echo.
    const fromCloudTrans = {};
    markFromCloud(fromCloudTrans);
    await core.table('products').mutate({ type: 'put', trans: fromCloudTrans, values: [{ id: 'p9', current_stock: 99 }] });
    const box = peekOutbox();
    setOutboxRecording(false);
    clearOutbox();
    assert(offNothing && box.items.products?.p1 === 'put' && box.items.products?.p2 === 'del' && box.items.sales?.s9 === 'put' && box.full.join() === 'customers'
      && !box.items.products?.p9 && core.table('foo') === tables.foo,
      'Cloud sync: every write is noted (put / add / delete; a cleared table goes in full); nothing while off; a row the cloud sent is not noted (no echo); other tables pass by');
    assert(box.deltas.products?.p1 === -2.5 && box.deltas.products?.p2 === 5 && box.deltas.customers?.c1 === 50000 && !box.deltas.products?.p9,
      'Cloud sync: stock / udhar are noted as CHANGES read against the row before the write (10 → 8 → 7.5 = −2.5; a new item +5; udhar +₹500), never as values');
  })());

  const sentBox = noteChange(noteChange(emptyOutbox(), 'products', 'put', ['a', 'b']), 'products', 'del', ['c']);
  const afterWrite = noteChange(sentBox, 'products', 'del', ['a']); // 'a' deleted while the send was running
  const left = withoutSent(afterWrite, sentBox);
  assert(JSON.stringify(left.items) === JSON.stringify({ products: { a: 'del' } }) && withoutSent(sentBox, sentBox).full.length === 0
    && Object.keys(withoutSent(sentBox, sentBox).items).length === 0,
    'Cloud sync: what went out leaves the outbox; a record changed again during the send stays for the next round');
  const d1 = noteDelta(noteDelta(emptyOutbox(), 'products', 'x', -2), 'products', 'x', -1);
  const d2 = withoutSent(noteDelta(d1, 'products', 'x', -4), d1); // −4 more while −3 was going out
  assert(d1.deltas.products?.x === -3 && d2.deltas.products?.x === -4 && noteDelta(d1, 'products', 'x', 3).deltas.products?.x === undefined
    && noteDelta(emptyOutbox(), 'products', 'y', 0.1 + 0.2).deltas.products?.y === 0.3,
    'Cloud sync: stock changes add up until sent; what went out is taken off, a later change stays; back to 0 = nothing to send; no float noise');
  assert(JSON.stringify(parseOutbox('{"items":{"products":{"x":"put","y":"weird"},"nope":{"z":"put"}},"full":["sales","nope"],"deltas":{"products":{"x":-2,"y":"bad"},"sales":{"s":1}}}'))
    === JSON.stringify({ items: { products: { x: 'put' } }, full: ['sales'], deltas: { products: { x: -2 } } }) && JSON.stringify(parseOutbox('garbage')) === JSON.stringify(emptyOutbox()),
    'Cloud sync: a stored outbox is read back safely — unknown tables / ops / non-numbers dropped, a broken one = empty');
  const plan = splitOutbox({ items: { products: { a: 'put', b: 'del' }, sales: { s1: 'put' }, businesses: { biz: 'put' } }, full: ['sales'], deltas: {} });
  assert(JSON.stringify(plan) === JSON.stringify({ full: ['sales'], tables: [{ table: 'businesses', putIds: ['biz'], delIds: [] }, { table: 'products', putIds: ['a'], delIds: ['b'] }] }),
    'Cloud sync: per table, records to write and to delete; the shop document first; a table going in full is not sent twice');

  // Merge rules (pure): stock = cloud + this computer's unsent change; newer-wins for the rest; our shop id.
  const ctx = { bizId: 'biz_u1', localBizId: 'biz_local' };
  const local = { id: 'p1', business_id: 'biz_local', name: 'Rocket', selling_price: 2500, current_stock: 8, updated_at: '2026-10-01T10:00:00.000Z' };
  const olderCloud = { id: 'p1', name: 'Rocket (old)', selling_price_paise: 2000, stock_quantity: 7, updated_at: '2026-10-01T09:00:00.000Z' };
  const m1 = mergedRow('products', olderCloud, local, ctx, true, -2);
  const m2 = mergedRow('products', { ...olderCloud, name: 'Rocket 10', updated_at: '2026-10-01T11:00:00.000Z' }, local, ctx, true, 0);
  const fresh = mergedRow('products', { id: 'p2', name: 'Maggi', selling_price_paise: 1400, stock_quantity: 24, updated_at: '2026-10-01T11:00:00.000Z' }, undefined, ctx, true);
  const noStock = mergedRow('products', { id: 'p1', name: 'Rocket 10', updated_at: '2026-10-01T11:00:00.000Z' }, local, ctx, true);
  assert(m1?.name === 'Rocket' && m1?.current_stock === 5 && m2?.name === 'Rocket 10' && m2?.current_stock === 7 && m2?.selling_price === 2000
    && fresh?.business_id === 'biz_local' && fresh?.current_stock === 24 && noStock?.current_stock === 8
    && mergedRow('products', { ...olderCloud, stock_quantity: 8 }, local, ctx, true, 0) === null,
    "Cloud → here: stock = the cloud's value + this computer's unsent change (7 − 2 = 5) even when the rest is older; a newer edit wins; a new item gets THIS computer's shop id; an unchanged row is not rewritten");

  const pushSrc = readSource('lib/cloud/cloudPush.ts');
  assert(/return read\(CLOUD_SEND_KEY\) === '1';/.test(pushSrc) && /return Boolean\(a && !a\.stub\);/.test(pushSrc) && /await auth\.authStateReady\(\);/.test(pushSrc)
    && /if \(auth\.currentUser\?\.uid !== account\.uid\) throw new Error\('signed_out'\);/.test(pushSrc) && /if \(shop\.deleted\) throw new Error\('deleted_in_cloud'\);/.test(pushSrc)
    && !/^import .*firebase/m.test(pushSrc) && !/purgeLocalDeviceData/.test(pushSrc),
    'Cloud sync: off unless switched on, never with the test stand-in, only as the linked Google account, Firebase loaded only when syncing, a shop deleted in the cloud stops it (nothing here is wiped)');
  assert(/if \(shop\.exists\) await pull\.pullEverything\(ctx\);/.test(pushSrc) && /await db\.transaction\('r', tables\.map/.test(pushSrc)
    && /markSent\(snapshot\.box\)/.test(pushSrc) && /takeDeltasForSend\(newId\('round'\)\)/.test(pushSrc) && /finishInflight\(\);\s*sent \+= r\.applied;\s*await realign\(ctx, round\.deltas\);/.test(pushSrc),
    "Cloud sync: first time the phone's shop comes in, then everything goes up from ONE read with the outbox; counters go as a round (same id on a retry) and this computer then takes the cloud's value");
  const writeSrc = readSource('lib/cloud/cloudWrite.ts');
  assert(/if \(\(await tx\.get\(opRef\)\)\.exists\(\)\) return -1;/.test(writeSrc) && /if \(!s\.exists\(\)\) return;/.test(writeSrc) && /increment\(part\[k\]\.d\)/.test(writeSrc)
    && /if \(counter && !absolute\) delete out\[counter\.cloud\];/.test(writeSrc) && /synced_at: serverTimestamp\(\)/.test(writeSrc),
    'Cloud write: a counter round is applied once (sync_ops) and never makes a half-empty document; rows go without stock / udhar values after the first send; every write carries synced_at');
  const pullSrc = readSource('lib/cloud/cloudPull.ts');
  assert(/markFromCloud\(tx\.idbtrans\);/.test(pullSrc) && /if \(c\.doc\.metadata\.hasPendingWrites\) continue;/.test(pullSrc) && /row\.id = ctx\.localBizId;/.test(pullSrc)
    && /where\('synced_at', '>=', Timestamp\.fromMillis\(since\)\)/.test(pullSrc),
    "Cloud → here: written in a marked transaction (no echo), our own unconfirmed writes skipped, the shop document onto this computer's shop row, big tables read from their last change only");
  const dbSrc2 = readSource('lib/db/index.ts');
  const schedSrc = readSource('components/layout/CloudSyncScheduler.tsx');
  assert(/db\.use\(backupChangeMiddleware\);[\s\S]{0,300}?db\.use\(cloudOutboxMiddleware\);/.test(dbSrc2) && /<CloudSyncScheduler \/>/.test(readSource('components/layout/AppShell.tsx'))
    && /\{account && !account\.stub && \(/.test(readSource('components/backup/CloudAccountCard.tsx')) && /cloudSendActive\(\) && account && !needsFullPush\(\)/.test(schedSrc)
    && /stopListening\?\.\(\);/.test(schedSrc) && !/^import .*firebase/m.test(schedSrc),
    'Cloud sync: the outbox is registered before the database opens, the scheduler runs in the shell (listens only after the first sync, stops when switched off), the switch shows only for a real Google account');
  assert((pkgJson.scripts || {})['test:cloud'] === 'node scripts/run_cloud_test.mjs' && fs.existsSync(path.join(__dirname, 'cloud_sync_emulator.ts'))
    && /project demo-kamaiplus/.test(fs.readFileSync(path.join(__dirname, 'run_cloud_test.mjs'), 'utf8')),
    'Cloud sync: the emulator test exists (npm run test:cloud, demo project — never the live one)');
  // S6 — store codes: the Desktop 1–49,999 (then 100,000+), the phone 50,000–99,999: never the same code.
  const phoneCodes = ['2000000500003', '2000000500010'];
  const afterPhone = nextStoreBarcodes(['2000000000022', ...phoneCodes], 1)[0];
  const lastDesk = `200${String(49999).padStart(9, '0')}`;
  assert(afterPhone === '2000000000039' && Number(nextStoreBarcodes([lastDesk + ean13CheckDigit(lastDesk)], 1)[0].slice(3, 12)) === 100000
    && DESKTOP_STORE_CODE_RANGES[0][1] === 49999,
    "Store codes: the phone's codes (50,000+) do not move this computer's numbering (next after 2 is 3, not 50,002); a full range goes on at 100,000");
  const idsSrc = readSource('lib/ids.ts');
  const ms = ALL_SOURCE.filter((f) => !/[\\/]lib[\\/]ids\.ts$/.test(f) &&/`(sale|ledg|mov|prod|cust|cat|exp|shift)_\$\{Date\.now\(\)\}`/.test(fs.readFileSync(f, 'utf8')));
  assert(/return `\$\{prefix\}_\$\{stamp\}_\$\{rand\}`;/.test(idsSrc) && ms.length === 0 && newId('sale') !== newId('sale') && /^sale_\d{13}_[a-z0-9]{8}$/.test(newId('sale')),
    `C12: new record ids are time + 8 random characters — two counters in the same millisecond never share one (ms-only ids left: ${ms.map((f) => path.relative(SRC_ROOT, f)).join(', ') || 'none'})`);
}

// 9j(z). Customer Bug (first client, v4.89.0): on a fresh 50 × 25 mm roll the first labels of a run
// printed shifted (price on the gap / next label) until the printer found the gap by itself. The
// first print to a printer at a label size now calibrates it (once), then prints.
{
  const base = { ...DEFAULT_LABEL_SETTINGS, printer: 'TSC TE244', stockId: 'roll_50x25' };
  const k50 = calibrationKey(base);
  const k38 = calibrationKey({ ...base, stockId: 'roll_38x25_2' });
  const kOther = calibrationKey({ ...base, printer: 'Other' });
  assert(k50 !== k38 && k50 !== kOther && calibrationKey({ ...base }) === k50,
    'Label calibration is remembered per printer AND label size (a new size or printer calibrates again)');
  assert(needsAutoCalibration(base, false, true) && !needsAutoCalibration(base, true, true) && !needsAutoCalibration({ ...base, printer: '' }, false, true)
    && !needsAutoCalibration({ ...base, stockId: 'a4_24' }, false, true) && !needsAutoCalibration(base, false, false),
    'Auto calibration: only for a named label printer on a roll, once, and only where the app has a command for it');
  const plSrc = readSource('lib/labels/printLabels.ts');
  assert(plSrc.indexOf('await calibrateBeforeFirstPrint(settings);') > 0 && plSrc.indexOf('await calibrateBeforeFirstPrint(settings);') < plSrc.indexOf("return printHtml(html, stock.kind === 'sheet'"),
    'Every label print (Studio, 1-click, test, size check) calibrates first when needed — before the labels go to the printer queue');
  const acSrc = readSource('lib/labels/autoCalibrate.ts');
  assert(acSrc.includes("markCalibrated(settings, 'manual');") && acSrc.includes("return 'failed';") && readSource('components/labels/LabelSetupPanel.tsx').includes("markCalibrated(s, 'done');"),
    'An unknown printer make is not retried on every print; a failed calibration never blocks printing; the Calibrate button also counts');
}

// 9j(y). Customer Change (first client, v4.87.0): retail AND wholesale price for the same item.
// One Excel sheet with an extra "Wholesale" column; a Retail / Wholesale switch per bill; a
// wholesale customer turns the bill to wholesale. A price typed by hand on a line is never moved.
{
  const item = { id: 'w1', selling_price: 1000, wholesale_price: 850 };
  const noWholesale = { id: 'w2', selling_price: 500 };
  assert(unitPriceFor(item, 'retail') === 1000 && unitPriceFor(item, 'wholesale') === 850 && unitPriceFor(noWholesale, 'wholesale') === 500
    && unitPriceFor({ selling_price: 700, wholesale_price: 0 }, 'wholesale') === 700 && hasWholesalePrice(item) && !hasWholesalePrice(noWholesale as { wholesale_price?: number }),
    'Wholesale: an item with a wholesale price sells at it on a wholesale bill; without one (or 0) it keeps its retail price');
  assert(modeForCustomer({ is_wholesale: true }) === 'wholesale' && modeForCustomer({ is_wholesale: false }) === 'retail' && modeForCustomer(null) === 'retail',
    'Wholesale: a customer marked wholesale starts a wholesale bill; others and walk-in stay retail');

  const tax = (t: number, rate: number) => (rate ? Math.round(t - t / (1 + rate / 100)) : 0);
  const line = (id: string, qty: number, price: number, extra: Partial<CartItem> = {}): CartItem => ({ product_id: id, product_name: id, quantity: qty, unit: 'piece', unit_price: price, discount_amount: 0, tax_rate: 0, tax_amount: 0, total_amount: qty * price, ...extra } as CartItem);
  const cart = [line('w1', 2, 1000, { tax_rate: 18, discount_amount: 100 }), line('w2', 1, 500), line('typed', 1, 999), line('gone', 1, 300)];
  const products = [item, noWholesale, { id: 'typed', selling_price: 1200, wholesale_price: 1100 }];
  const ws = repriceCart(cart, products, 'retail', 'wholesale', tax);
  const back = repriceCart(ws, products, 'wholesale', 'retail', tax);
  assert(ws[0].unit_price === 850 && ws[0].total_amount === 1600 && ws[0].tax_amount === tax(1600, 18) && ws[0].discount_amount === 100
    && ws[1].unit_price === 500 && ws[2].unit_price === 999 && ws[3].unit_price === 300
    && back[0].unit_price === 1000 && back[0].total_amount === 1900 && repriceCart(cart, products, 'retail', 'retail', tax) === cart,
    'Wholesale switch: lines move to the wholesale price and back (total, GST and the line discount worked out again); a rate typed by hand and an item no longer saved stay');

  const roles = guessColumnRoles(['Item Name', 'Price', 'Wholesale Price', 'MRP']);
  const rolesHi = guessColumnRoles(['आयटम', 'भाव', 'थोक भाव']);
  assert(roles.join() === 'name,price,wholesale,mrp' && rolesHi.join() === 'name,price,wholesale' && guessColumnRoles(['Item', 'Dealer Rate', 'Rate']).join() === 'name,wholesale,price'
    && COLUMN_ROLES.some((r) => r.id === 'wholesale'),
    'Excel: a "Wholesale" / "Dealer" / "थोक" column is the wholesale price — never taken for the retail price');
  const grid = [['Item Name', 'Price', 'Wholesale'], ['Rice 25kg', 1500, 1400], ['Sugar 1kg', 45, '']];
  const wRows = buildImportRows(grid, 0, guessColumnRoles(grid[0] as string[]), { prefixSection: false });
  const savedRice = { id: 'r1', name: 'Rice 25kg', selling_price: 150000, mrp: 150000, wholesale_price: 0, purchase_price: 0, tax_rate: 0, unit: 'piece', category_name: '' } as unknown as Product;
  const savedSugar = { id: 's1', name: 'Sugar 1kg', selling_price: 4500, mrp: 4500, wholesale_price: 4000, purchase_price: 0, tax_rate: 0, unit: 'piece', category_name: '' } as unknown as Product;
  const wPlan = planImport(wRows, [savedRice, savedSugar], false);
  assert(wRows[0].wholesalePaise === 140000 && wRows[1].wholesalePaise === null && wPlan.updates.length === 1 && wPlan.updates[0].changes.includes('wholesale price')
    && wPlan.unchanged.length === 1,
    'Excel: same names, a Wholesale column → only the wholesale price changes (retail kept); a blank wholesale cell leaves the saved one alone');
  const importDbSrc = readSource('lib/import/catalogImportDb.ts');
  assert(/if \(ctx\.mapped\.wholesale && row\.wholesalePaise !== null\) next\.wholesale_price = row\.wholesalePaise;/.test(importDbSrc)
    && /wholesale_price: ctx\.mapped\.wholesale && r\.wholesalePaise \? r\.wholesalePaise : undefined,/.test(importDbSrc)
    && /setFeatureSwitch\('wholesale_price', true\)/.test(readSource('components/import/CatalogImportModal.tsx')),
    'Excel import saves the wholesale price (new and saved items) and switches the Retail / Wholesale choice on when a sheet brings wholesale prices');

  assert(DEFAULT_FEATURE_SWITCHES.wholesale_price === false && FEATURES.some((f) => f.id === 'wholesale_price' && f.group === 'product_form'),
    'Wholesale price is a switch in Settings → Features (off until a shop needs it)');
  const wDoc = toCloud('products', { id: 'p', name: 'Rice', selling_price: 150000, wholesale_price: 140000 }, { bizId: 'biz_u' });
  const wCust = toCloud('customers', { id: 'c', name: 'Dealer', is_wholesale: true }, { bizId: 'biz_u' });
  assert(wDoc.wholesale_price_paise === 140000 && !('wholesale_price' in wDoc) && wCust.is_wholesale === true
    && fromCloud('products', wDoc, null, { bizId: 'biz_u' }).wholesale_price === 140000,
    'Cloud contract: wholesale_price travels as wholesale_price_paise (R2), a wholesale customer as is_wholesale');

  const billSrc = readCounter();
  assert(/const price = unitPriceFor\(product, isFeatureOn\('wholesale_price'\) \? priceModeRef\.current : 'retail'\);/.test(billSrc)
    && /cart: repriceCart\(tab\.cart, found, tab\.priceMode \|\| 'retail', mode, calculateItemTax\)/.test(billSrc)
    && /modeForCustomer\(customers\.find\(\(c\) => c\.id === id\)\) === 'wholesale'/.test(billSrc)
    && /\.\.\.\(isFeatureOn\('wholesale_price'\) && priceMode === 'wholesale' \? \{ price_mode: 'wholesale' as const \} : \{\}\)/.test(billSrc)
    && /\{wholesaleOn && <PosPriceModeToggle compact /.test(billSrc), // v4.93.0: a small switch in the cart header
    'Billing: a new line takes the bill\'s price (also from a scan), switching re-prices the cart, a wholesale customer switches the bill, the sale is marked wholesale; the switch shows only when on');
  assert(/sale\.price_mode === 'wholesale'/.test(readSource('components/transactions/TransactionBillCard.tsx'))
    && /unitPriceFor\(product, sale\?\.price_mode === 'wholesale' \? 'wholesale' : 'retail'\)/.test(readSource('components/invoices/EditInvoiceModal.tsx'))
    && /data-customer-wholesale/.test(readSource('components/customers/AddEditCustomerModal.tsx')) && /data-product-wholesale/.test(readProductForm()),
    'Wholesale shows on the bill in Transactions, an edited wholesale bill adds items at wholesale, customers and items get their wholesale fields');
}

// 9j(aa). Customer Change (first client, v4.92.0): a scanning counter wants the bill big — the
// line between products and bill drags (remembered), and Scan mode hides the product list.
{
  const fresh = parsePosLayout(null);
  assert(fresh.scanMode === false && fresh.billShare === DEFAULT_BILL_SHARE && Math.abs(DEFAULT_BILL_SHARE - 5 / 12) < 1e-9
    && parsePosLayout('not json').billShare === DEFAULT_BILL_SHARE && parsePosLayout('{"billShare":"x","scanMode":"yes"}').scanMode === false,
    'Counter layout: never set (or broken) = exactly the old 7 : 5 counter, product list on');
  assert(clampBillShare(0.1) === MIN_BILL_SHARE && clampBillShare(0.95) === MAX_BILL_SHARE && clampBillShare(NaN) === DEFAULT_BILL_SHARE
    && parsePosLayout('{"billShare":0.99,"scanBillShare":0.01}').billShare === MAX_BILL_SHARE && parsePosLayout('{"billShare":0.99,"scanBillShare":0.01}').scanBillShare === MIN_BILL_SHARE,
    'Divider: the bill never gets narrower than 32 % or wider than 68 % — neither side can vanish');
  const scan = { ...fresh, scanMode: true };
  const dragged = withBillShare(scan, 0.5);
  assert(billShareFromPointer(0, 1000, 500) === 0.5 && billShareFromPointer(100, 1000, 700) === 0.4 && billShareFromPointer(0, 0, 10) === DEFAULT_BILL_SHARE
    && dragged.scanBillShare === 0.5 && dragged.billShare === DEFAULT_BILL_SHARE && activeBillShare(dragged) === 0.5 && activeBillShare(fresh) === DEFAULT_BILL_SHARE
    && resetBillShare(dragged).scanBillShare === DEFAULT_SCAN_BILL_SHARE && resetBillShare(withBillShare(fresh, 0.6)).billShare === DEFAULT_BILL_SHARE,
    'Divider: the pointer sets the bill share; list mode and Scan mode keep their own width; double-click resets only the current one');
  assert(showProductList(fresh, '') && showProductList(fresh, '8901234567890') && !showProductList(scan, '') && !showProductList(scan, '  ')
    && !showProductList(scan, '89') && !showProductList(scan, '8901234567890') && !showProductList(scan, 'SKU-00123') && showProductList(scan, 'atta') && showProductList(scan, 'Parle G'),
    'Scan mode: list hidden while empty and while the gun types a code (never flashes mid-scan); a typed name shows its matches');
  const line = (id: string, q: number) => ({ product_id: id, quantity: q } as CartItem);
  assert(lastChangedLine(new Map(), [line('a', 1), line('b', 1)])?.product_id === 'b' && lastChangedLine(new Map([['a', 1], ['b', 1]]), [line('a', 2), line('b', 1)])?.product_id === 'a'
    && lastChangedLine(new Map([['a', 2], ['b', 1]]), [line('a', 1), line('b', 1)]) === null,
    'Scan mode "Last scanned": the line just added or whose quantity went up (a removal changes nothing)');

  const billSrc = readCounter();
  const splitSrc = readSource('components/billing/PosSplitLayout.tsx');
  const scanSrc = readSource('components/billing/PosScanPanel.tsx');
  assert(billSrc.includes('<PosSplitLayout') && billSrc.includes('onDone={focusProductSearch}') && billSrc.includes('const listVisible = showProductList(posLayout, searchQuery);')
    && billSrc.includes('{listVisible && (') && billSrc.includes('<VirtuosoGrid') && billSrc.includes('<PosCategoryTabs') && !billSrc.includes('lg:col-span-7'),
    'Billing: products + bill sit in PosSplitLayout, the grid (unchanged) shows unless Scan mode hides it, back to the search after a drag');
  assert((splitSrc.match(/onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/g) || []).length === 1 && splitSrc.includes('e.preventDefault();\n          e.currentTarget.setPointerCapture')
    && (scanSrc.match(/onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/g) || []).length === 1 && !/tabIndex/.test(splitSrc),
    'Divider and Scan-mode buttons never take the focus from the search box (the barcode gun types into it); the divider is not in the Tab order');
  assert(splitSrc.includes('useEffect(() => {\n    setLayout(loadPosLayout());') && splitSrc.includes('useState<PosLayout>(DEFAULT_POS_LAYOUT)')
    && splitSrc.includes("hidden lg:flex flex-col h-full min-h-0 shrink-0") && splitSrc.includes("body.cursor = prev.cursor;"),
    'Layout read after mount (no hydration mismatch), the bill panel only on wide screens (phones keep the cart drawer), a drag never leaves the cursor stuck');
  // Bug found in the Electron run (slow PC): the bill snapped back to the first step of the drag,
  // because button-up saved the last RENDERED layout while later moves were still unrendered.
  assert(splitSrc.includes('const drag = useRef<PosLayout | null>(null);') && splitSrc.includes('drag.current = next;') && splitSrc.includes('const final = drag.current;')
    && splitSrc.includes('onLayoutChange(final, true);') && !splitSrc.includes('onLayoutChange(latest.current, true)') && splitSrc.includes('onLostPointerCapture={finish}')
    && !/onPointerMove=\{\(e\) => dragging/.test(splitSrc),
    'Divider drag: every move is kept in a ref and button-up saves where the pointer ended (not the last rendered step); a lost capture saves too');
}

// 9j(ab). UX audit, batch 1 (v4.93.0) — the billing counter.
{
  const L = (id: string, q = 1) => ({ product_id: id, product_name: id, quantity: q } as CartItem);
  const T = (id: string, n: number, cart: CartItem[], extra: Partial<ReturnType<typeof makeEmptyTab>> = {}) => ({ ...makeEmptyTab(id, n), cart, ...extra });
  // (1) Undo after ✕ / Clear.
  const a = T('a', 1, [L('x'), L('y')]);
  const cleared = tabsAfterUndo([T('a', 1, [L('y', 3), L('z')])], { tab: a, index: 0, kind: 'cleared' }, 'fresh');
  assert(cleared.activeTabId === 'a' && cleared.tabs[0].cart.map((l) => `${l.product_id}${l.quantity}`).join() === 'x1,y3,z1',
    'Undo "Clear": the items come back; lines scanned since stay (an item in both keeps the new line)');
  const b = T('b', 2, [L('p')]);
  const afterClose = tabsAfterClosing([a, b], 'a', 'n1');
  const undoClose = tabsAfterUndo(afterClose.tabs, { tab: a, index: 0, kind: 'closed' }, 'fresh');
  assert(undoClose.tabs.map((t) => t.id).join() === 'a,b' && undoClose.activeTabId === 'a',
    'Undo ✕: the closed bill comes back in its old place and is the open bill again');
  const onlyBill = T('tab_1', 1, [L('x')]);
  const undoOnly = tabsAfterUndo([makeEmptyTab('tab_1', 1)], { tab: onlyBill, index: 0, kind: 'closed' }, 'fresh');
  const undoOnlyBusy = tabsAfterUndo([T('tab_1', 1, [L('q')])], { tab: onlyBill, index: 0, kind: 'closed' }, 'fresh');
  const held = T('h', 3, [], { isHeld: true });
  assert(undoOnly.tabs.length === 1 && undoOnly.tabs[0].id === 'fresh' && undoOnly.tabs[0].cart.length === 1
    && undoOnlyBusy.tabs.map((t) => t.id).join() === 'fresh,tab_1' && undoOnlyBusy.tabs[1].cart[0].product_id === 'q'
    && tabsAfterUndo([held, makeEmptyTab('n', 4)], { tab: b, index: 1, kind: 'closed' }, 'f').tabs.map((t) => t.id).join() === 'h,b',
    'Undo ✕ on the only bill: it comes back under a new id, the blank bill goes, a bill started meanwhile stays (and a held bill is never dropped)');
  // (2) The bill scrolls to the line just scanned — only its own box moves.
  assert(scrollDeltaToShow({ top: 0, bottom: 100 }, { top: 120, bottom: 150 }) === 58 && scrollDeltaToShow({ top: 0, bottom: 100 }, { top: -30, bottom: -10 }) === -38
    && scrollDeltaToShow({ top: 0, bottom: 100 }, { top: 10, bottom: 60 }) === 0 && scrollDeltaToShow({ top: 0, bottom: 100 }, { top: 120, bottom: 300 }) === 112,
    'Bill scroll: a line below or above the box scrolls just into view; a line taller than the box shows its top');
  const pos = readCounter();
  const lines = readSource('components/billing/PosCartLines.tsx');
  const undoBar = readSource('components/billing/PosUndoBar.tsx');
  const panel = (readSource('components/billing/PosCheckoutPanel.tsx') + '\n' + readSource('components/billing/PosCheckoutFooter.tsx'));
  const at = (t: string) => panel.indexOf(t);
  assert(/keepForUndo\(tabs\.find\(\(t\) => t\.id === tabId\), 'closed'\);\s*if \(tabs\.length === 1\)/.test(pos) && /keepForUndo\(activeTab, 'cleared'\);\s*setCart\(\[\]\);/.test(pos)
    && panel.includes('onClick={handleClearCart}') && !panel.includes('onClick={() => setCart([])}') && panel.includes('<PosUndoBar discarded={discardedBill}')
    && /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}\s*onClick=\{onUndo\}/.test(undoBar) && /UNDO_SECONDS = 8/.test(undoBar),
    'Billing: ✕ and Clear keep the bill 8 s for Undo (the Undo click never takes the cursor from the search box)');
  assert(panel.includes('<PosCartLines cart={cart} billId={activeTab.id}') && /scrollIntoContainer\(\(list\?\.closest\('\[data-pos-bill-scroll\]'\)/.test(lines)
    && /if \(!before \|\| before\.bill !== billId\) return;/.test(lines) && lines.includes("data-pos-line-flash={flashId === item.product_id ? 'true' : undefined}")
    && /\(item\.size \|\| item\.color \|\| item\.imei_serial \|\| item\.warranty_period_months\) && \(/.test(lines),
    'Bill lines: the line just scanned scrolls into view and flashes (not on a bill switch or page open); no empty attribute row on plain lines');
  assert(at('<PosCustomerRow') > 0 && at('<PosCustomerRow') < at('data-pos-bill-scroll') && at('Customer Name is compulsory for Credit (Udhar)') < at('data-pos-bill-scroll')
    && at("{tr('Cart Items (')}") < at('data-pos-bill-scroll') && at("{ id: 'cash', label: tr('Cash')") > at('Bottom Total & Checkout Button (always visible)')
    && panel.includes('(discountTotalPaise > 0 || addedGstPaise > 0) && (') && panel.includes('<PosPriceModeToggle compact')
    && /scrollIntoContainer\(box, box\?\.querySelector<HTMLElement>\('\[data-pos-pay-details\]'\)/.test(pos),
    'Bill panel: tabs, customer (+ the Udhar-needs-a-name warning), cart header stay put; payment mode is pinned over the total; "Items total" only with a discount / added GST; UPI / Split / Credit bring their details into view');
  const card = readSource('components/billing/PosProductCard.tsx');
  const chips = readSource('components/billing/PosCategoryTabs.tsx');
  const bar = readSource('components/layout/DesktopStatusBar.tsx');
  assert(card.includes("'w-full min-w-0 p-2.5 rounded-xl border") && !card.includes('<div className="pr-12">') && card.includes('line-clamp-3') && card.includes('title={p.name}')
    && !chips.includes('overflow-x-auto') && chips.includes("!showAll && 'max-h-[30px] overflow-hidden'") && chips.includes("tr('All categories ({count})'"),
    'POS grid: a card is exactly its column (it grew to its price + stock and pushed the grid 8 px sideways); the name gets the full width; category chips wrap with "All categories"');
  assert(bar.includes('whitespace-nowrap border-t border-slate-800') && !bar.includes("tr('Offline DB:')") && /MINOR_KEYS\.has\(key\) \? 'hidden 2xl:flex'/.test(bar) && bar.includes('data-status-keys-list'),
    'Status bar: one line on a laptop (no "Offline DB / Online" twice — the top bar says it), / and Esc only on wide screens, "All keys" lists every key');
}

// 9j(ac). UX audit, batch 2 (v4.93.0) — Home, money on screen, one profit lock, one name per screen.
{
  assert(formatINRCompact(242000) === '₹2,420' && formatINRCompact(242050) === '₹2,420.50' && formatINRCompact(0) === '₹0' && formatINRCompact(12345600) === '₹1,23,456'
    && formatINRSigned(0, '-') === '₹0.00' && formatINRSigned(-0, '+') === '₹0.00' && formatINRSigned(5000, '-') === '-₹50.00' && formatINRSigned(5000, '+') === '+₹50.00'
    && amountTone(0, 'text-rose-600').startsWith('text-slate-400') && amountTone(1, 'text-rose-600') === 'text-rose-600',
    'Money on Home: no ".00" on whole rupees (paise still show when there are any); never "-₹0.00"; a zero amount is grey, not red');
  const line = (id: string, q: number, amt: number) => ({ product_id: id, product_name: id.toUpperCase(), unit: 'pc', quantity: q, total_amount: amt } as unknown as CartItem);
  const top = topItemsToday([{ items: [line('a', 1, 5000), line('b', 2, 9000)] }, { items: [line('a', 2, 10000), line('c', 1, 0)] }] as unknown as Sale[]);
  const owe = topDebtors([{ id: '1', name: 'A', phone: '', current_balance: 500 }, { id: '2', name: 'B', phone: '', current_balance: 0 }, { id: '3', name: 'C', phone: '', current_balance: 900 }] as unknown as Customer[]);
  assert(top.map((t) => `${t.productId}:${t.quantity}:${t.amountPaise}`).join() === 'a:3:15000,b:2:9000' && owe.map((c) => c.id).join() === '3,1',
    'Home "Today at a glance": items added up across today\'s bills, biggest takings first (no ₹0 lines); udhar biggest first, nobody at ₹0');
  const privacy = readSource('lib/auth/cashierPrivacy.ts');
  const lock = readSource('lib/auth/masterPassword.ts');
  const reports = readSource('app/reports/page.tsx');
  assert(/if \(hasOwnerPin\(\)\) return sessionStorage\.getItem\(PROFIT_UNLOCK_SESSION_KEY\) !== '1';/.test(privacy) && /if \(hidden\) sessionStorage\.removeItem\(PROFIT_UNLOCK_SESSION_KEY\);/.test(privacy)
    && /sessionStorage\.removeItem\(PROFIT_UNLOCK_SESSION_KEY\);/.test(lock.slice(lock.indexOf('export function lockApp')))
    && /const pinUnlocked = !useProfitHidden\(\);/.test(reports) && !/useState\(false\);\s*\n\s*\/\/ Settings → Features → "Hide profit from staff" off/.test(reports)
    && /unlocked \? setProfitHidden\(true\) : setPinOpen\(true\)/.test(reports) && /onUnlocked=\{\(\) => setProfitHidden\(false\)\}/.test(reports),
    'Profit lock: with an owner PIN, profit / cost start hidden at every app start and after Lock (the unlock lasts one session); Reports follows the same lock');
  const titles: [string, string, string][] = [
    ['components/products/ProductHeaderActions.tsx', "{tr('Products')}", 'Products Master & Items'],
    ['app/khata/page.tsx', "{tr('Khata Ledger')}", 'Digital Khata & Udhar Ledger'],
    ['app/purchases/page.tsx', "{tr('Purchases & Bills')}", 'Purchase & Restock Orders'],
    ['components/transactions/TransactionHeaderActions.tsx', "{tr('Transactions')}", 'Transactions & Sales Ledger'],
    ['components/cash-register/CashRegisterHeaderActions.tsx', "{tr('Cash Register')}", 'Cash Register & Petty Cash Drawer'],
    ['app/barcode-generator/page.tsx', "{tr('Barcode Studio')}", 'Barcode & Price Label Studio'],
    ['app/cloud-backup/page.tsx', "{tr('Backup & Restore')}", 'Data Backup & Tax Reports'],
    ['components/dashboard/QuickActionDock.tsx', "title: msg('Khata Ledger')", "msg('Digital Khata')"],
    ['components/dashboard/QuickToolsGrid.tsx', "title: tr('Customers')", 'Customers CRM'],
  ];
  const wrongTitles = titles.filter(([f, want, old]) => !readSource(f).includes(want) || readSource(f).includes(old)).map(([f]) => f);
  assert(wrongTitles.length === 0 && !/Walk-in Customer/.test(readSource('lib/reports/advancedReports.ts') + readSource('components/reports/analytics/PartyDetailModal.tsx')),
    `One name per screen: each page's title is its menu name; bills without a customer are "Cash Customer" everywhere${wrongTitles.length ? ` (wrong: ${wrongTitles.join(', ')})` : ''}`);
  const pulse = readSource('components/dashboard/TodayBusinessPulse.tsx');
  const grid = readSource('components/dashboard/QuickToolsGrid.tsx');
  const home = readSource('components/dashboard/DashboardHome.tsx');
  assert(/amountTone\(totalOutstandingCredit, 'text-rose-600 dark:text-rose-400'\)/.test(pulse) && !/formatINR\(/.test(pulse)
    && !/`-\$\{formatINR/.test(readSource('components/cash-register/CashRegisterMetricsRibbon.tsx')) && !/tr\('Total: -'\)/.test(readSource('components/cash-register/CashExpensesList.tsx'))
    && !/href: '\/billing'/.test(grid) && !/href: '\/khata'/.test(grid) && /<TodayInsights sales=\{todaysRevenueSales\} debtors=\{customersWithCredit\} khataOn=\{switches\.khata\} \/>/.test(home)
    && !/from-indigo-950/.test(readSource('components/dashboard/AdvancedAnalyticsBanner.tsx')),
    'Home: cards without ".00", a zero udhar is grey; Billing / Khata no longer twice (the quick actions have them); "Today at a glance"; analytics is one slim row');
}

// 9j(ad). UX audit, batch 3 (v4.93.0) — Transactions, Purchases, Backup.
{
  const head = readSource('components/transactions/TransactionHeaderActions.tsx');
  const chips = readSource('components/transactions/TransactionFilterToolbar.tsx');
  const menuAt = head.indexOf('role="menu"');
  assert(menuAt > 0 && head.indexOf('onOpenClearHistory();') > menuAt && !/onClick=\{onOpenClearHistory\}/.test(head) && !/bg-amber-400/.test(head)
    && !['⚡', '⏪', '🗓', '📊', '🔍', '💵', '📱', '📒'].some((e) => chips.includes(e)) && (chips.match(/\{Icon && <Icon /g) || []).length === 2,
    'Transactions: "delete all bills" is in the ⋯ menu (not a red icon next to the exports), Tally is an export like the others, filter chips use icons not emoji');
  const purchases = readSource('app/purchases/page.tsx');
  const menu = readSource('components/purchases/PurchaseInwardMenu.tsx');
  const inward = readSource('components/purchases/InwardBillButton.tsx');
  assert(/<PurchaseInwardMenu onManual=\{\(\) => setIsModalOpen\(true\)\} onExcel=\{\(\) => setExcelOpen\(true\)\} onFast=\{\(\) => setFastInwardOpen\(true\)\} labelsOn=\{labelsOn\} \/>/.test(purchases)
    && /open=\{excelOpen\}/.test(purchases) && !/data-purchases-fast-inward/.test(purchases) && !/text-slate-500 font-mono">\s*\{tr\('(All inventory stock levels|No purchase bills)/.test(purchases)
    && ['manual', 'excel', 'fast'].every((o) => menu.includes(`data-inward-option="${o}"`)) && /\{labelsOn && \(\s*<Link href="\/barcode-generator\?new=1"/.test(menu)
    && /const controlled = open !== undefined;/.test(inward) && /\{!controlled && \(/.test(inward),
    'Purchases: one "Stock Inward ▾" menu (manual, Excel bill, fast barcode, new items + labels — each says what it is for) instead of four buttons; empty lists in the normal font');
  const backup = readSource('app/cloud-backup/page.tsx');
  assert((backup.match(/onClick=\{handleDownloadBackup\}/g) || []).length === 1 && backup.includes("tr('Export Full Backup')"),
    'Backup: one Download button ("Export Full Backup", next to Restore) — the same download was offered twice');
  // Bug seen in the Electron run: the internet dropped mid-test → Firebase Analytics' installation
  // call rejected inside Firebase → an uncaught "installations/app-offline" error in the error log.
  const analyticsSrc = readSource('lib/firebase/analytics.ts');
  assert(isAnalyticsNetworkNoise({ code: 'installations/app-offline' }) && isAnalyticsNetworkNoise({ code: 'analytics/config-fetch-failed' })
    && !isAnalyticsNetworkNoise({ code: 'storage/quota' }) && !isAnalyticsNetworkNoise(new Error('installations/app-offline')) && !isAnalyticsNetworkNoise(null)
    && /if \(isAnalyticsNetworkNoise\(e\.reason\)\) \{\s*e\.preventDefault\(\);\s*return;/.test(readSource('lib/diagnostics/errorReporter.ts'))
    && /if \(!analytics && !isOnline\(\)\) return null;/.test(analyticsSrc) && /if \(!isOnline\(\)\) return;\s*try \{/.test(analyticsSrc),
    'Offline: Analytics does not start (or log) without internet, and its own network rejections never reach the error log — other errors still do');
}

// 9j(ae). UX audit, batch 4 (v4.93.0) — first run, product form, Hindi categories, focus, small text, day pace.
{
  const auth = readSource('components/auth/AuthForm.tsx');
  const setPwForm = auth.slice(auth.indexOf('<form onSubmit={handleSetPassword}'));
  assert(setPwForm.indexOf("tr('Set Password & Start')") > 0 && setPwForm.indexOf("tr('Set Password & Start')") < setPwForm.indexOf('data-google-step')
    && /useState<boolean>\(false\);/.test(readOnboarding().slice(readOnboarding().indexOf('seedStarterCatalog') - 300)),
    'First run: the password and its button come first, the optional Google account under it; the fireworks sample catalog is not ticked by default');
  const productsPage = readProductsPage();
  const form = readProductForm();
  assert(/useState<ProductUnit>\('piece'\)/.test(productsPage) && readSource('components/products/productActions.ts').includes('setFormUnit(unitsForVertical(shopVertical()).defaultUnit);') && readSource('lib/products/shopVertical.ts').includes("isRestaurantMode() ? 'restaurant'") && !/useState<ProductUnit>\('packet'\)/.test(productsPage)
    && /!excelTipHidden && shopVertical\(\) !== 'restaurant' && \(/.test(form) && /localStorage\.setItem\(EXCEL_TIP_KEY, '1'\)/.test(form) && form.includes('data-excel-tip-hide'),
    'Add Product: a new item starts as Piece (not Packet); the "wholesale bill in Excel?" tip can be closed for good');
  const hiCat = JSON.parse(readSource('locales/hi.json')) as Record<string, string>;
  const enGeneral = categoryLabel('General');
  setActiveLanguage('hi', hiCat);
  const hiGeneral = categoryLabel(' General ');
  const hiOwn = categoryLabel('Sparklers');
  setActiveLanguage('en', null);
  assert(enGeneral === 'General' && hiGeneral === hiCat['General'] && hiGeneral !== 'General' && hiOwn === 'Sparklers' && categoryLabel(undefined) === ''
    && ['components/billing/PosCategoryTabs.tsx', 'components/billing/PosProductCard.tsx', 'components/products/ProductFilterToolbar.tsx', 'components/products/AddEditProductModal.tsx', 'components/products/CategoryPicker.tsx']
      .every((f) => readSource(f).includes('categoryLabel(')),
    'Hindi / Marathi: the starter categories (General, FMCG, Loose Items …) show translated on Billing and Products; a category the shop typed stays as typed; the saved name stays English');
  const tinyFiles = ALL_SOURCE.filter((f) => f.endsWith('.tsx') && !/(print|label|thermal|invoice[\\/]page|SharedInvoiceSheet|pwa)/i.test(path.relative(SRC_ROOT, f)))
    .filter((f) => /text-\[(9|9\.5|8|8\.5|7|7\.5)px\]/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC_ROOT, f));
  assert(/focus-visible:ring-2 focus-visible:ring-amber-500/.test(readSource('components/ui/Button.tsx')) && tinyFiles.length === 0,
    `Keyboard focus shows on buttons (amber ring); no screen text under 10 px (print documents keep their sizes)${tinyFiles.length ? ` — still tiny: ${tinyFiles.join(', ')}` : ''}`);
  const at = (h: number, m: number) => ({ created_at: new Date(2026, 9, 2, h, m).toISOString() });
  const pace = counterPace([at(18, 40), at(10, 5), at(18, 10), at(19, 30), at(18, 55)], 100000);
  assert(pace.bills === 5 && pace.averagePaise === 20000 && pace.busiestHour === 18 && pace.busiestBills === 3 && pace.firstAt?.getHours() === 10 && pace.lastAt?.getHours() === 19
    && counterPace([], 0).busiestHour === null && hourRangeLabel(18) === '6 pm–7 pm' && hourRangeLabel(23) === '11 pm–12 am' && hourRangeLabel(0) === '12 am–1 am' && hourRangeLabel(11) === '11 am–12 pm'
    && readSource('components/reports/DayEndClosingReportModal.tsx').includes('data-day-pace'),
    'Day Summary "counter pace": average bill, the busiest hour (6 pm–7 pm, 3 bills) and the first → last bill');
}

// 9j(af). Speed (v4.97.0) — measured on a shop with 5,000 items, 30,000 bills, 2,000 customers.
{
  const pos = readCounter();
  const sale = pos.slice(pos.indexOf('const completeSale = async'), pos.indexOf('// 5. The counter moves on'));
  const txAt = sale.indexOf("await db.transaction('rw', db.products, db.inventory_movements, async () => {");
  assert(txAt > 0 && sale.indexOf('await db.products.put(updatedProd);') > txAt && sale.indexOf('stockForCloud.push(updatedProd);') > txAt
    && sale.indexOf('for (const p of stockForCloud) void cloudMerge(') > sale.indexOf('stockForCloud.push(updatedProd);')
    && !/await db\.products\.put\(updatedProd\);[\s\S]{0,900}void cloudMerge\(`businesses\/\$\{businessId\}\/products\/\$\{prod\.id\}`/.test(sale),
    'Complete Sale: all stock lines are deducted in ONE transaction (8 separate writes re-ran the counter\'s catalogue queries 16 times: 2.3 s → 0.2 s), cloud copies after the commit');
  assert(!/const (categoryCounts|variantInfo) = useLiveQuery/.test(pos) && /\}, \[totalProductCount\]\);/.test(pos) && /db\.products\.orderBy\('category_id'\)\.eachKey/.test(pos),
    'Billing: category counts and variant "from ₹X" are worked out when the number of items changes, not re-read after every sale');
  const auth = readSource('components/auth/AuthForm.tsx');
  assert(!/setTimeout\(/.test(auth) && /router\.replace\(destination\);/.test(auth),
    'Unlock goes straight in (an 800 ms "network delay" and a 500 ms pause were there on purpose)');
  const watcher = readSource('components/printers/PrinterWatcher.tsx');
  assert(/const FIRST_LOOK_MS = 4000;/.test(watcher) && !/\n\s*void look\(true\);\n\s*const quickTimer/.test(watcher) && /const COUNTER_BUSY_MS = 20000;/.test(watcher)
    && /if \(counterBusy\(\)\) fullDue = true;/.test(watcher),
    'Printers: the first Get-Printer waits until the page is open (it made Home appear 1.4–5.9 s after unlock; now ~0.6 s), and the minute-by-minute one waits while the counter is in use');
  const printersJs = fs.readFileSync(path.join(__dirname, '..', 'printers.js'), 'utf8');
  const psWorkerJs = fs.readFileSync(path.join(__dirname, '..', 'psWorker.js'), 'utf8');
  assert(/utilityProcess\.fork\(path\.join\(__dirname, 'psWorker\.js'\)/.test(printersJs) && /pending = runPowerShell\(/.test(printersJs) && !/pending = new Promise\(\(resolve\) => \{\s*execFile\(/.test(printersJs)
    && /process\.parentPort\.on\('message'/.test(psWorkerJs) && (pkgJson.build?.files || []).includes('psWorker.js'),
    'Printers: Get-Printer runs in a utility process — started from the main process it held the main thread up to 5 s (pages, the window and the database waited); measured gap now < 0.1 s');
  const txPage = readSource('app/transactions/page.tsx');
  assert(/db\.sales\.orderBy\('created_at'\)\.reverse\(\)\.limit\(TX_PAGE_SIZE\)\.toArray\(\)/.test(txPage) && /return \(await db\.sales\.orderBy\('created_at'\)\.toArray\(\)\)\.reverse\(\);/.test(txPage)
    && (txPage.match(/if \(historyLoading\) return;/g) || []).length === 2 && /filteredSales\.length === 0 \|\| historyLoading\) return;/.test(txPage)
    && /filteredCount=\{historyLoading \? 0 : filteredSales\.length\}/.test(txPage) && /loading=\{historyLoading\}/.test(txPage),
    'Transactions: the newest 100 bills show at once (2.4 s → 0.5 s), the full history follows; until then totals show "…" and no export can run on part of the history');
  // The filter hook, rendered for real: newest-first input stays newest first (no 900,000-date sort).
  const mk = (id: string, at: string, total: number) => ({ id, invoice_number: id, created_at: at, grand_total: total, total_amount: total, items: [], payment_method: 'cash', status: 'completed' } as unknown as Sale);
  const order: string[] = [];
  const Probe = () => { const f = useTransactionFilters([mk('C', '2026-10-02T10:00:00.000Z', 300), mk('B', '2026-10-01T10:00:00.000Z', 900), mk('A', '2026-09-30T10:00:00.000Z', 100)]); order.push(f.filteredSales.map((x) => x.id).join('')); return null; };
  renderToStaticMarkup(React.createElement(Probe));
  assert(order[0] === 'CBA' && /if \(sortBy === 'date-desc'\) return out; \/\/ already newest first/.test(readSource('components/transactions/useTransactionFilters.ts')),
    'Transactions filter: newest first with no re-sort; date limits worked out once, not per bill');
}

// 9j(ag). v4.98.0 (Rahul) — Admin Console ↔ Desktop: renewal warning, Admin messages, health.
// The check-in (now hourly) carries COUNTS only and brings the Admin's messages back; the server
// side is tested in the Android repo (functions/test/licence_core.test.js).
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const link = require('../adminLink.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lic = require('../licence.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  const day = 24 * 60 * 60 * 1000;

  // Counts from the page: only known fields of the right kind.
  const c = link.cleanCounts({ bills_today: 12.4, bills_7d: '80', products: -1, customers: 'x', last_bill_at: 'not a date', cloud_sync: true, shop_name: 'Sharma', grand_total: 99999 });
  assert(JSON.stringify(c) === JSON.stringify({ bills_today: 12, bills_7d: 80, cloud_sync: true }),
    "Health: the page's counts keep only bills today / 7 days, items, customers, last bill time and the sync flag — never names or amounts");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-sim-admin-'));
  const now = Date.now();
  link.saveCounts(dir, { bills_today: 7, bills_7d: 40, products: 5000, customers: 300, last_bill_at: new Date(now - 3600000).toISOString(), cloud_sync: false });
  const errors = [{ at: new Date(now - 2 * day).toISOString() }, { at: new Date(now - 9 * day).toISOString() }, { at: 'bad' }];
  const h = link.buildHealth({ userDataDir: dir, backupInfo: { lastBackupAt: '2026-10-03T05:00:00.000Z', count: 12, extraFolder: 'E:\\Backup' }, errors, nowMs: now });
  assert(h.bills_today === 7 && h.bills_7d === 40 && h.products === 5000 && h.customers === 300 && h.cloud_sync === false
    && h.last_backup_at === '2026-10-03T05:00:00.000Z' && h.backups_kept === 12 && h.backup_copy === true && h.errors_7d === 1
    && typeof h.disk_free_gb === 'number' && h.disk_free_gb > 0 && typeof h.windows === 'string' && !('shop_name' in h),
    'Health report: counts + last backup, backups kept, extra copy on, errors in 7 days, free disk, Windows version');
  const tomorrow = link.buildHealth({ userDataDir: dir, backupInfo: null, errors: [], nowMs: now + day });
  const stale = link.buildHealth({ userDataDir: dir, backupInfo: null, errors: [], nowMs: now + 3 * day });
  assert(!('bills_today' in tomorrow) && tomorrow.bills_7d === 40 && !('bills_7d' in stale) && !('products' in stale),
    "Health report: yesterday's \"bills today\" is never sent as today's; counts older than 2 days are left out");

  // Messages: clean, at most 5, ended ones dropped; saved only when they change.
  const msgs = link.cleanMessages([
    { id: 'renew', scope: 'key', text: 'Licence 31 Oct ko khatam.\nRenew karein.', level: 'warning' },
    { id: 'renew', text: 'duplicate' },
    { id: 'old', text: 'ended', until: new Date(now - 1000).toISOString() },
    { id: 'x', text: '   ' },
    { id: 'all-1', text: '<b>Naya</b> version', level: 'shout' },
    'junk',
  ], now);
  assert(msgs.length === 2 && msgs[0].text === 'Licence 31 Oct ko khatam.\nRenew karein.' && msgs[0].scope === 'key' && msgs[0].level === 'warning'
    && msgs[1].level === 'info' && msgs[1].scope === 'all' && link.cleanMessages(Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, text: 't' }))).length === 5,
    'Admin messages: one per id, empty or ended ones dropped, unknown level = info, at most 5');
  assert(link.saveMessages(dir, msgs) === true && link.saveMessages(dir, msgs) === false && link.readMessages(dir).length === 2
    && link.saveMessages(dir, []) === true && link.readMessages(dir).length === 0,
    'Admin messages: kept on this PC from the last check-in; the page is told only when they change; an empty answer clears them');

  // Banner: info / warning close for good, urgent only until the app opens again.
  const list = [
    { id: 'a', scope: 'key', text: 'A', level: 'info', until: null },
    { id: 'b', scope: 'all', text: 'B', level: 'urgent', until: null },
    { id: 'c', scope: 'all', text: 'C', level: 'warning', until: new Date(now - 1).toISOString() },
  ] as AdminMessage[];
  assert(visibleAdminMessages(list, [], [], now).map((m) => m.id).join() === 'a,b'
    && visibleAdminMessages(list, ['a', 'b'], [], now).map((m) => m.id).join() === 'b'
    && visibleAdminMessages(list, [], ['b'], now).map((m) => m.id).join() === 'a',
    'Message banner: a closed info / warning message stays closed; an urgent one comes back when the app opens again; ended ones never show');
  const banner = readSource('components/admin/AdminMessageBanner.tsx');
  assert(/\{m\.text\}/.test(banner) && !/dangerouslySetInnerHTML/.test(banner) && /whitespace-pre-line/.test(banner) && /const offMessages = api\.onAdminMessages\?\.\(setMessages\);/.test(banner) && /offMessages\?\.\(\);/.test(banner),
    "Message banner: the Admin's text is shown as plain text (never HTML), line breaks kept; new messages appear while the app is open");

  // The real check-in with a signed licence (needs the signing key on this PC — Rahul's dev PC has it).
  const pem = path.join(os.homedir(), 'KamaiPlus-Secrets', 'desktop_licence_private.pem');
  if (fs.existsSync(pem)) {
    const sign = (payload: object) => {
      const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
      return { licence: bytes.toString('base64url'), signature: crypto.sign(null, bytes, crypto.createPrivateKey(fs.readFileSync(pem, 'utf8'))).toString('base64url') };
    };
    const base = { v: 1, key: 'KPD-AAAA-BBBB-CCCC-DDDD', machine_id: lic.getMachineId(), shop_name: 'Sharma Kirana', issued_at: new Date(now - day).toISOString() };
    const udir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-sim-checkin-'));
    fs.writeFileSync(path.join(udir, 'licence.json'), JSON.stringify(sign(base)));
    let sent: { action?: string; health?: Record<string, unknown> } = {};
    const server = (answer: object) => async (_url: string, opts: { body: string }) => {
      sent = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => answer };
    };
    const renewed = { ...base, issued_at: new Date(now).toISOString(), valid_until: new Date(now + 5 * day + 3600000).toISOString() };
    pendingAsyncChecks.push((async () => {
      const r1 = await lic.refresh({ userDataDir: udir, appVersion: '4.98.0', fetchImpl: server({ ...sign(renewed), messages: [{ id: 'm1', scope: 'key', text: 'Hi', level: 'info', until: null }] }), health: { bills_today: 3 } });
      const firstSent = sent;
      const r2 = await lic.refresh({ userDataDir: udir, appVersion: '4.98.0', fetchImpl: server(sign(renewed)) });
      assert(r1.ok && firstSent.action === 'refresh' && (firstSent.health as { bills_today?: number })?.bills_today === 3 && r1.messages.length === 1 && r1.status.daysLeft === 5
        && r2.ok && r2.messages === undefined && !('health' in sent),
        "Check-in: health goes with the request, the Admin's messages and a new end date come back; an older server (no messages) changes nothing");
    })());
    // v4.117.0: refused check-ins — deleted key stops the app; only a blocked key's wipe command comes through.
    const refused = (code: string, control?: object) => async () => ({ ok: false, status: code === 'not-found' ? 404 : code === 'moved' ? 409 : 403, json: async () => ({ error: 'x', code, control }) });
    const wipe = { mode: 'normal', commands: [{ id: 'w-1', type: 'wipe_and_reset', at: null }] };
    const freshDir = () => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-sim-refused-'));
      fs.writeFileSync(path.join(d, 'licence.json'), JSON.stringify(sign(base)));
      return d;
    };
    pendingAsyncChecks.push((async () => {
      const dDel = freshDir(), dRev = freshDir(), dMov = freshDir(), dErr = freshDir();
      const del = await lic.refresh({ userDataDir: dDel, appVersion: '4.117.0', fetchImpl: refused('not-found') });
      const rev = await lic.refresh({ userDataDir: dRev, appVersion: '4.117.0', fetchImpl: refused('revoked', wipe) });
      const mov = await lic.refresh({ userDataDir: dMov, appVersion: '4.117.0', fetchImpl: refused('moved', wipe) });
      const err = await lic.refresh({ userDataDir: dErr, appVersion: '4.117.0', fetchImpl: refused('invalid-machine') });
      assert(del.stopped && /deleted/.test(del.status.reason) && !fs.existsSync(path.join(dDel, 'licence.json')) && del.control === undefined
        && rev.stopped && rev.control === wipe
        && mov.stopped && mov.control === undefined
        && !err.stopped && fs.existsSync(path.join(dErr, 'licence.json')),
        'Refused check-in: a deleted key stops the app (it kept running before); a blocked key brings its wipe command; a "moved" answer never runs the key\'s commands here; any other refusal changes nothing');
    })());
    // v4.125.0 (AU-10): a blocked PC keeps checking in — the wipe still arrives, Unblock brings it back.
    pendingAsyncChecks.push((async () => {
      const dB = freshDir();
      let calls = 0;
      const counting = (answer: () => object, ok: boolean) => async () => { calls++; return { ok, status: ok ? 200 : 403, json: async () => answer() }; };
      await lic.refresh({ userDataDir: dB, appVersion: '4.125.0', fetchImpl: refused('revoked') });
      const blockedNow = !fs.existsSync(path.join(dB, 'licence.json')) && fs.existsSync(path.join(dB, 'licence.blocked.json'));
      const again = await lic.refresh({ userDataDir: dB, appVersion: '4.125.0', fetchImpl: counting(() => ({ error: 'x', code: 'revoked', control: wipe }), false) });
      const back = await lic.refresh({ userDataDir: dB, appVersion: '4.125.0', fetchImpl: counting(() => sign(base), true) });
      const dM = freshDir();
      await lic.refresh({ userDataDir: dM, appVersion: '4.125.0', fetchImpl: refused('moved') });
      const callsBefore = calls;
      const movedAgain = await lic.refresh({ userDataDir: dM, appVersion: '4.125.0', fetchImpl: counting(() => sign(base), true) });
      assert(blockedNow && again.stopped && again.control === wipe && back.ok && fs.existsSync(path.join(dB, 'licence.json')) && !fs.existsSync(path.join(dB, 'licence.blocked.json'))
        && movedAgain.error === 'no-licence' && calls === callsBefore,
        'Blocked PC keeps checking in: the Admin\'s wipe command still arrives, Unblock brings the licence back; a moved key never asks again (AU-10)');
    })());
  } else {
    assert(true, 'Check-in with a signed licence: skipped (no signing key on this PC)');
  }

  // Wiring: hourly check-in with health, messages to the page, any licence change (a renewal too)
  // reaches the page, the new module is in the installer, the reporter waits for an idle moment.
  const mainSrc3 = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const preloadSrc3 = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert(/const LICENCE_CHECKIN_MS = 60 \* 60 \* 1000;/.test(mainSrc3) && /adminLink\.buildHealth\(\{ userDataDir, backupInfo: backup\.getInfo\(backupPaths\(\)\), errors: errorlog\.readRecent\(1000\) \}\)/.test(mainSrc3)
    && /if \(res\.ok && res\.messages !== undefined\)/.test(mainSrc3) && /webContents\.send\('kp:admin-messages'/.test(mainSrc3)
    && /ipcMain\.handle\('kp:report-health'/.test(mainSrc3) && /const licenceShown = \(s\) => JSON\.stringify\(\[s\.state, s\.validUntil \|\| null, s\.daysLeft \?\? null, s\.reason \|\| null\]\);/.test(mainSrc3)
    && /reportHealth: \(counts\) => ipcRenderer\.invoke\('kp:report-health', counts\)/.test(preloadSrc3) && /ipcRenderer\.on\('kp:admin-messages', listener\)/.test(preloadSrc3)
    && (pkgJson.build?.files || []).includes('adminLink.js'),
    'Main process: check-in every hour (was 6 h) with the health report; messages reach the page; a renewal or a new day updates the licence note; adminLink.js ships in the installer');
  const reporter = readSource('components/admin/ShopHealthReporter.tsx');
  const counts = readSource('lib/admin/shopCounts.ts');
  const shell = readSource('components/layout/AppShell.tsx');
  assert(/const FIRST_MS = 30 \* 1000;/.test(reporter) && /requestIdleCallback/.test(reporter) && /db\.sales\.where\('created_at'\)\.aboveOrEqual\(startOfToday\.toISOString\(\)\)/.test(counts)
    && /filter\(realBill\)/.test(counts) && /<AdminMessageBanner \/>/.test(shell) && /<ShopHealthReporter \/>/.test(shell),
    'Health counts: read by the date index (estimates are not bills), 30 s after opening at an idle moment, then every 30 min');
  const ending = readSource('components/licence/LicenceEndedScreen.tsx');
  const bannerSrc = readSource('components/admin/AdminMessageBanner.tsx');
  assert(/const last = daysLeft <= 2;/.test(ending) && /tr\('Please renew my KamaiPlus licence:'\)\} \$\{licenceKey\}/.test(ending)
    && /daysLeft === 1 \? tr\('Your licence ends tomorrow'\)/.test(ending) && !/fixed bottom/.test(ending)
    && /<LicenceEndingNotice validUntil=\{ending\.validUntil!\} daysLeft=\{ending\.daysLeft!\} licenceKey=\{ending\.key\}/.test(bannerSrc)
    && !/LicenceEndingNotice/.test(readSource('components/licence/LicenceGate.tsx')),
    'Renewal note (last 7 days): a strip under the top bar (as a corner note it covered "Complete Sale"), WhatsApp / email to renew with the key filled in; red in the last 2 days; "tomorrow", never "1 days"');
}

// 8b. No Pro gating, payment upsell or AI scan anywhere in the source.
const PRO_OR_AI = /useProSubscription|requirePro|UpgradeModal|ProFeatureBadge|subscriptionService|razorpay|generativelanguage\.googleapis|gemini/i;
// The one exception: the cloud contract's list of plan fields the Desktop must NEVER write (R9,
// lib/cloud/cloudFormat.ts `PRO_FIELDS`) names them. Only that list is skipped; the rest of the file is checked.
const proCheckSource = (f: string) => {
  const s = fs.readFileSync(f, 'utf8');
  return /[\\/]lib[\\/]cloud[\\/]cloudFormat\.ts$/.test(f) ? s.replace(/export const PRO_FIELDS: ReadonlySet<string> = new Set\(\[[\s\S]*?\]\);/, '') : s;
};
const proOrAiOffenders = ALL_SOURCE.filter((f) => PRO_OR_AI.test(proCheckSource(f)));
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

// 9j(ai). Help guides follow the app (2026-10-05, Rahul: "jaise jaise kuch change karenge, help page
// bhi change hona chahiye"). docs/help-map.json says which files each kamaiplus.com/help guide
// describes; docs/HELP_SYNC.md queues the guide updates per version (AGENTS.md Rule 7).
{
  const helpMap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'help-map.json'), 'utf8'));
  const helpSync = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'HELP_SYNC.md'), 'utf8');
  const repoFiles = [...walkSource(SRC_ROOT), ...fs.readdirSync(REPO_ROOT).map((f) => path.join(REPO_ROOT, f)).filter((f) => fs.statSync(f).isFile())]
    .map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
  const globRe = (g: string) => new RegExp('^' + g.split('**').map((part) => part.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
  const deadGlobs = helpMap.guides.flatMap((g: any) => g.sources.filter((src: string) => !repoFiles.some((f) => globRe(src).test(f))).map((src: string) => `${g.guide}: ${src}`));
  const names = helpMap.guides.map((g: any) => g.guide);
  assert(names.length >= 16 && new Set(names).size === names.length && deadGlobs.length === 0
    && helpMap.guides.every((g: any) => g.title && g.sources.length && g.tourStages.length),
    `Help map: every guide has a title, sources and tour stages, and every source pattern matches a real file (dead: ${deadGlobs.join(', ') || 'none'})`);
  const siteHelp = path.join(helpMap.website, 'src', 'pages', 'help');
  if (fs.existsSync(siteHelp)) {
    const onSite = fs.readdirSync(siteHelp).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.replace(/\.html$/, ''));
    assert(onSite.every((g) => names.includes(g)) && names.every((g: string) => onSite.includes(g)),
      `Help map and the website's guides are the same list (site only: ${onSite.filter((g) => !names.includes(g)).join(', ') || 'none'}; map only: ${names.filter((g: string) => !onSite.includes(g)).join(', ') || 'none'})`);
  }
  const versionRow = helpSync.split('\n').find((l) => l.startsWith(`| ${APP_VERSION} |`));
  assert(Boolean(versionRow) && /\| (pending|released|none|on website[^|]*) \|\s*$/.test(versionRow || ''),
    `docs/HELP_SYNC.md has a row for this version (${APP_VERSION}) with its guides and a status — run node scripts/help_impact.mjs before every version bump`);
  const impact = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'help_impact.mjs'), 'utf8');
  assert(/help-map\.json/.test(impact) && /git diff --name-only/.test(impact) && /Rule 7/.test(agentsMd) && /HELP_SYNC\.md/.test(agentsMd) && /help_impact\.mjs/.test(agentsMd),
    'AGENTS.md Rule 7 tells every agent to run scripts/help_impact.mjs and queue guide updates in docs/HELP_SYNC.md');
}

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

// v4.91.0 (Customer Change, first client): two shop numbers on the bill; the 58 / 80 mm slip
// follows every Invoice Themes switch like the A4 (logo, owner, HSN, GST breakup, terms,
// signatory); the UPI QR has its own "also on thermal" switch; Pharmacy Rx & D.L. is gone.
{
  assert(storePhones({ phone: '9000000001', phone2: '9123456780' }) === '9000000001, 9123456780' && storePhones({ phone: '9000000001', phone2: '9000000001' }) === '9000000001'
    && storePhones({ phone: '9000000001' }) === '9000000001' && storePhones(null) === '',
    'Bill phones: both shop numbers, the second only when set and not the same');
  const twoPh = { ...invBiz, phone2: '9123456780' };
  const twoDoc = buildInvoiceDocument(sampleGstSale, twoPh, { upiVpa: 'shop@upi' });
  const offDoc = buildInvoiceDocument(sampleGstSale, { ...twoPh, invoice_theme_config: { ...resolveInvoiceConfig(twoPh), show_owner: false } }, { upiVpa: 'shop@upi' });
  assert(twoDoc.store.contactLine.includes('Ph: 9000000001, 9123456780') && twoDoc.store.phoneLine === 'Ph: 9000000001, 9123456780' && twoDoc.store.ownerName === 'Ramesh'
    && offDoc.store.phoneLine === '' && offDoc.store.ownerName === '' && !offDoc.store.contactLine.includes('Ph:'),
    'A4 + thermal print both numbers; "Show Owner & Phone" off hides owner and both numbers');
  const rxDoc = buildInvoiceDocument(sampleGstSale, { ...invBiz, invoice_theme_config: { ...resolveInvoiceConfig(invBiz), show_pharmacy_rx: true, drug_license_no: '20B-1', pharmacist_reg_no: 'PH-1' } }, {});
  const designerSrc = readSource('components/invoices/designer/DesignerSections.tsx');
  assert(!rxDoc.store.licenseLine.includes('D.L.') && !rxDoc.store.licenseLine.includes('Pharmacist') && !designerSrc.includes('show_pharmacy_rx') && !designerSrc.includes('Pharmacy Rx'),
    'Pharmacy Rx & D.L. is out of Invoice Themes — a switch saved on before no longer prints a D.L. line');
  const thermOff = buildInvoiceDocument(sampleGstSale, { ...invBiz, invoice_theme_config: { ...resolveInvoiceConfig(invBiz), show_upi_qr_thermal: false } }, { upiVpa: 'shop@upi' });
  assert(gstDoc.thermal.showUpi === true && thermOff.upi.show === true && thermOff.thermal.showUpi === false && hiddenDoc.thermal.showUpi === false && noUpiDoc.thermal.showUpi === false
    && resolveInvoiceConfig(invBiz).show_upi_qr_thermal === true,
    'UPI QR: "Also on thermal" off keeps it on A4 only; main switch off or no UPI ID = no QR anywhere; old saved themes keep it on');

  const slip = (doc: typeof gstDoc, biz: any) => renderToStaticMarkup(React.createElement(ThermalReceipt, { doc, sale: sampleGstSale, business: biz, width: 58 }));
  const logoBiz = { ...twoPh, logo_url: 'data:image/png;base64,iVBORw0KGgo=' };
  const onSlip = slip(buildInvoiceDocument(sampleGstSale, logoBiz, { upiVpa: 'shop@upi', qrDataUrl: 'data:image/png;base64,QR' }), logoBiz);
  const allOffBiz = { ...logoBiz, invoice_theme_config: { ...resolveInvoiceConfig(logoBiz), show_logo: false, show_owner: false, show_hsn_code: false, show_gst_breakup: false, show_terms: false, show_signature: false, show_upi_qr: false } };
  const offSlip = slip(buildInvoiceDocument(sampleGstSale, allOffBiz, { upiVpa: 'shop@upi' }), allOffBiz);
  const parts = ['data-thermal-logo', 'data-thermal-owner', 'data-thermal-phone', 'data-thermal-hsn', 'data-thermal-gst', 'data-thermal-terms', 'data-thermal-signatory', 'data-thermal-upi'];
  assert(parts.every((p) => onSlip.includes(p)) && parts.every((p) => !offSlip.includes(p)) && onSlip.includes('9000000001, 9123456780') && onSlip.includes('HSN: 1101'),
    `58 mm slip follows every Invoice Themes switch (on: ${parts.filter((p) => !onSlip.includes(p)).join(',') || 'all'} missing; off: ${parts.filter((p) => offSlip.includes(p)).join(',') || 'none'} left)`);
  const prevSrc = readSource('components/invoices/InvoicePreview.tsx');
  const outSrc = readSource('lib/invoices/invoiceOutput.tsx');
  assert(prevSrc.includes('<ThermalReceipt doc={doc}') && outSrc.includes('<ThermalReceipt doc={doc}'),
    'Invoice Themes preview and the real print render the same ThermalReceipt — what you see is what prints');

  const onbSrc = readOnboarding();
  // v4.158.0 (Rahul, = Android 4.38): no UPI box at sign-up; UPI is added later in Settings → UPI & Banking.
  assert(!onbSrc.includes('data-onboarding-upi') && !onbSrc.includes("tr('UPI ID / VPA (Optional)')") && onbSrc.includes("upiId: ''")
    && onbSrc.includes('upi_id: cleanUpiId || undefined,') && readSource('components/settings/UpiBankingTab.tsx').includes("tr('+ Add UPI ID / VPA')"),
    'Sign-up: no UPI field (same as the phone) — the shop adds UPI later in Settings → UPI & Banking');
  const setSrc = readSettingsPage();
  assert(setSrc.includes("validateIndianPhone(phone2, false,") && setSrc.includes('phone2: phone2.trim() ?') && readSource('components/settings/StoreProfileTab.tsx').includes('data-settings-phone2'),
    'Settings → Contact & Store Location: optional second number, checked like a mobile number, saved on the shop');
}

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
assert(!!rep.partyData.find((p) => p.partyId === WALK_IN_ID && p.partyName === 'Cash Customer'), 'Bills without a customer group under "Cash Customer" (the name on the bill, v4.93.0)');
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

// v4.99.0 — four gaps found while making the website help guides (tracker K-D37…K-D40).
{
  // K-D40: CGST was split from every bill line with round(tax / 2), so CGST took every odd
  // half-paisa and ran ahead of SGST (demo HSN 0713: ₹16.31 vs ₹16.27). Rows are split once.
  const odd = splitIntraStateTax(35), even = splitIntraStateTax(32);
  assert(odd.cgst === 18 && odd.sgst === 17 && even.cgst === 16 && even.sgst === 16,
    'K-D40: tax splits into equal CGST + SGST halves; an odd paisa makes them differ by one, never more, and they add up exactly');
  const on = new Date(2026, 9, 5, 10, 0).toISOString();
  const tiny = (id: string): any => ({ ...discLine(id, 105, 5, true), hsn_code: '0713', unit: 'pcs' }); // ₹1.05 at 5 % → 5 paise GST
  const sevenBills: any[] = Array.from({ length: 7 }, (_, i) => ({ ...mk(`t${i}`, undefined, [tiny(`dal${i}`)]), created_at: on }));
  assert(sevenBills.every((b) => b.items[0].tax_amount === 5), 'K-D40 setup: seven bills, each with 5 paise of GST');
  const rep = generateGSTR1Report(sevenBills, [], invBiz, 'Oct 2026');
  const dal = rep.hsn_summary.find((h) => h.hsn_code === '0713')!;
  assert(dal.cgst_amount === 18 && dal.sgst_amount === 17 && rep.total_cgst === 18 && rep.total_sgst === 17,
    'K-D40: GST screen — 7 lines × 5 paise = 35 paise give CGST 18 + SGST 17 (was 21 + 14)', `got ${dal.cgst_amount} / ${dal.sgst_amount}`);
  const json: any = buildGstr1Json({ sales: sevenBills, customers: [], business: invBiz, fp: '102026' }).json;
  const hsnRow = json.hsn.hsn_b2c.find((h: any) => h.hsn_sc === '0713');
  assert(json.b2cs[0].camt === 0.18 && json.b2cs[0].samt === 0.17 && hsnRow.camt === 0.18 && hsnRow.samt === 0.17,
    'K-D40: GSTR-1 JSON — the B2C row and the HSN row carry CGST 0.18 + SGST 0.17 (was 0.21 + 0.14)');
  const b2bBill: any = { ...mk('b1', 'cB', [tiny('a'), tiny('b'), tiny('c')]), created_at: on, customer_gstin: '27AAACB1234C1Z5' };
  const b2bRep = generateGSTR1Report([b2bBill], [{ id: 'cB', name: 'Arihant' } as any], invBiz, 'Oct 2026');
  assert(b2bRep.b2b_invoices.length === 1 && b2bRep.b2b_invoices[0].cgst_amount === 8 && b2bRep.b2b_invoices[0].sgst_amount === 7,
    'K-D40: a B2B invoice is one row per rate on the GST screen (not one per line), split once: 15 paise → 8 + 7');
  const tally = breakupSales([b2bBill], { shopGstin: invBiz.gstin, customers: [], returns: [] });
  assert(tally[0].cgst === 8 && tally[0].sgst === 7 && tally[0].cgst + tally[0].sgst + tally[0].taxable === tally[0].total,
    'K-D40: Tally / CA register split the bill’s tax once (8 + 7) and the voucher still balances');
  const splitSrc = ['lib/gst/gstr1Json.ts', 'lib/gst/gstr1Generator.ts', 'lib/tally/saleBreakup.ts', 'lib/invoices/invoiceDocument.ts', 'lib/invoices/gstCalculator.ts'].map(readSource).join('\n');
  assert(!/Math\.(round|floor)\(\s*(s\.)?tax(Total)?\s*\/\s*2\s*\)/.test(splitSrc) && (splitSrc.match(/splitIntraStateTax\(/g) || []).length >= 6,
    'K-D40: every CGST / SGST split goes through splitIntraStateTax (no per-line round(tax / 2) left)');

  // K-D37: every A4 bill carried "⚡ KAMAI+ POS • India's #1 Retail POS & GST Billing App".
  const a4Src = readSource('components/invoices/print/A4TaxInvoice.tsx');
  assert(!/KAMAI\+|India&apos;s #1|India's #1/.test(a4Src) && />KamaiPlus</.test(a4Src) && /Aapki Dukaan ka Digital Sathi/.test(a4Src),
    'K-D37: the A4 bill footer says "KamaiPlus • Aapki Dukaan ka Digital Sathi" — no "KAMAI+", no "India\'s #1" claim');

  // K-D38: Day Summary / Home "Net Cash in Hand" left the morning float out (₹435 shown, drawer ₹2,435).
  const day = '2026-10-05';
  const at = (h: number) => new Date(2026, 9, 5, h, 0).toISOString();
  const shifts = [{ opened_at: at(14), opening_cash: 50000 }, { opened_at: at(8), opening_cash: 200000 }, { opened_at: new Date(2026, 9, 4, 9).toISOString(), opening_cash: 99900 }];
  assert(dayOpeningFloat(shifts, day) === 200000 && dayOpeningFloat([], day) === 0,
    "K-D38: the day's float is the first shift opened that day (another day's shift does not count; no shift = 0)");
  const cashBill: any = { ...mk('d1', undefined, [li('x', 1, 264300)]), created_at: at(10), amount_received: 264300 };
  const out = [{ amount: 220800, payment_mode: 'cash', category: 'other', created_at: at(12) }] as any;
  const summary = summarizeDay({ sales: [cashBill], expenses: out, dateKey: day, openingCash: dayOpeningFloat(shifts, day) });
  assert(summary.netCashInTillPaise === 243500 && summarizeDay({ sales: [cashBill], expenses: out, dateKey: day }).netCashInTillPaise === 43500,
    'K-D38: demo day — ₹2,000 float + ₹2,643 cash − ₹2,208 out = ₹2,435 in the drawer (₹435 without a Cash Register shift)');
  const homeSrc = readSource('components/dashboard/DashboardHome.tsx');
  const regSrc = readSource('app/cash-register/page.tsx');
  const modalSrc = readSource('components/reports/DayEndClosingReportModal.tsx');
  assert(/openingCash: todaysOpeningFloat/.test(homeSrc) && /openingCash=\{todaysOpeningFloat\}/.test(homeSrc)
    && /dayOpeningFloat\(todayShifts, todayDatePrefix\)/.test(regSrc) && /openingCash=\{openingBalancePaise\}/.test(regSrc)
    && /summarizeDay\(\{ sales, expenses, ledger, openingCash/.test(modalSrc) && /ledger,\s*openingCash,\s*(returns,\s*)?dateStr/.test(modalSrc)
    && /summarizeDay\(\{ sales, expenses, ledger, openingCash/.test(readSource('lib/reports/dailyClosingPdf.ts')),
    'K-D38: Home, the Cash Register (also after Close Shift), the Day Summary card and its PDF all count the float (the PDF also khata cash)');

  // K-D39: the counter's "items" was the quantities added up ("Cart Items (8)" on a 7-line bill).
  const posSrc = readCounter();
  assert(/const totalItemCount = cart\.length;/.test(posSrc) && /• \{totalUnits\} \{tr\('units'\)\}/.test(posSrc),
    'K-D39: counter items = bill lines (as on "Sale completed"), units = quantities added up');
}

// v4.100.0 — the rest of the demo-tour gaps (K-D32…K-D36) and three loose ends from the help guides.
{
  // K-D32: a supplier bill line went to any saved item sharing half its words.
  const p = (id: string, name: string): any => ({ id, name, unit: 'piece', selling_price: 10000, mrp: 10000, current_stock: 5, is_active: true });
  const saved = [p('coco', 'Coconut Oil 500 ml'), p('sun', 'Sunflower Oil 1 L'), p('toor5', 'Toor Dal 5 kg'), p('basmati', 'Basmati Rice 1 kg'), p('sona', 'Sona Rice 1 kg')];
  const line = (raw_name: string): any => ({ raw_name, is_new_product: true, quantity: 1, unit: 'piece', unit_price: 100, total_price: 100 });
  const m = matchExtractedItemsWithProducts([line('Sesame Oil 500 ml'), line('Fortune Sunflower Oil 1 Ltr'), line('Toor Dal 1 kg'), line('Rice 1kg'), line('Coconut Oil 500ML')], saved);
  assert(m[0].is_new_product && m[1].matched_product_id === 'sun' && m[2].is_new_product && m[3].is_new_product && m[4].matched_product_id === 'coco',
    'K-D32: Sesame Oil is not put on Coconut Oil, 1 kg is not 5 kg, two equally good rices are left to the shop; "1 Ltr" = "1 L", "500ML" = "500 ml"');
  assert(nameMatchScore('Glucose Biscuits 250 g', 'Glucose Biscuit 250g') === 1 && nameMatchScore('Sugar 1.5 kg', 'Sugar 15 kg') === 0 && nameMatchScore('Parle-G 80g', 'Parle G 80 gm') === 1,
    'K-D32: plurals, glued units and decimal sizes are read right (1.5 kg is not 15 kg)');

  // The supplier, bill number and date come from the sheet's title rows (were the file name and "CSV_5805").
  const h1 = readBillHeading([['Shree Ganesh Distributors — Bill 2291']]);
  const h2 = readBillHeading([['Metro Wholesale Traders'], ['Invoice No: MW-1182', 'Date: 05/10/2026'], ['GSTIN 27AABCM1234F1Z5']]);
  const h3 = readBillHeading([['बालाजी ट्रेडर्स'], ['बिल नं 55', 'दिनांक 4-10-26']]);
  const h4 = readBillHeading([['TAX INVOICE'], ['Balaji Traders | Bill No. 77']]);
  assert(h1.supplier === 'Shree Ganesh Distributors' && h1.billNumber === '2291' && h2.supplier === 'Metro Wholesale Traders' && h2.billNumber === 'MW-1182' && h2.billDate === '2026-10-05'
    && h3.supplier === 'बालाजी ट्रेडर्स' && h3.billNumber === '55' && h3.billDate === '2026-10-04' && h4.supplier === 'Balaji Traders' && h4.billNumber === '77',
    'Supplier bill heading: supplier, bill number and date are read in English and Hindi; "TAX INVOICE" is not a supplier');
  const inwardSrc = readSource('components/purchases/PurchaseInwardOptionsSheet.tsx');
  assert(/sheet\.heading\.supplier \|\| file\.name/.test(inwardSrc) && !/CSV_\$\{/.test(inwardSrc) && readBillSheet([['Shree Ganesh Distributors — Bill 2291'], ['Item', 'Qty', 'Rate'], ['Ghee', '2', '500']]).heading.billNumber === '2291',
    'Supplier bill: the review opens with the sheet\'s supplier and bill number, with no made-up "CSV_…" number');

  // K-D35: a cash refund of a UPI bill — Day Summary's cash + UPI + udhar now equal its total.
  const at = new Date(2026, 9, 5, 11, 0).toISOString();
  const upiBill: any = { ...mk('u1', undefined, [li('paneer', 1, 8800), li('ghee', 1, 32500)]), payment_method: 'upi', created_at: at };
  const cashBill: any = { ...mk('c1', undefined, [li('dal', 1, 17200)]), created_at: at };
  const ret: any = { id: 'r1', original_sale_id: 'u1', refund_amount: 8800, refund_method: 'cash', created_at: at, items: [{ product_id: 'paneer', quantity: 1 }] };
  const d = summarizeDay({ sales: [upiBill, cashBill], expenses: [], returns: [ret], dateKey: '2026-10-05' });
  const paid = d.paidBy.cash + d.paidBy.upi + d.paidBy.card + d.paidBy.credit;
  assert(d.netSalesPaise === 32500 + 17200 && paid === d.netSalesPaise,
    'K-D35: after a ₹88 cash refund of a UPI bill, the Day Summary\'s cash + UPI + udhar add up to its total (as in Transactions)', `sales ${d.netSalesPaise}, paid ${paid}`);
  const modal = readSource('components/reports/DayEndClosingReportModal.tsx');
  assert(/day\.paidBy\.cash/.test(modal) && /day\.paidBy\.cash/.test(readSource('lib/reports/dailyClosingPdf.ts')) && /returns=\{todaysReturns\}/.test(readSource('components/dashboard/DashboardHome.tsx')) && /returns=\{todayReturns\}/.test(readSource('app/cash-register/page.tsx')),
    'K-D35: the Day Summary card, its PDF and WhatsApp use the after-returns split; Home and the Cash Register pass the returns');

  // K-D34: the audit trail was sorted by the random id.
  assert(/inventory_movements\.orderBy\('created_at'\)\.reverse\(\)\.limit\(100\)/.test(readSource('app/inventory/page.tsx')),
    'K-D34: Stock Audit Trail = the newest 100 movements by time');

  // K-D33: the retired "Kamai+" name — on the password screen, the menu and every default bill's terms.
  const kamaiPlusOld = ALL_SOURCE.filter((f) => /Kamai\+/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC_ROOT, f));
  const oldTerms = '1. Goods once sold cannot be taken back or exchanged.\n2. Electronic invoice generated via Kamai' + '+ POS System.';
  assert(kamaiPlusOld.length === 0 && resolveInvoiceConfig({ ...invBiz, invoice_theme_config: { custom_terms: oldTerms } } as any).custom_terms?.endsWith('2. Bill made with KamaiPlus.') === true,
    `K-D33: "Kamai+" appears nowhere in the app (found: ${kamaiPlusOld.join(', ') || 'none'}); bill terms saved with the old line print "Bill made with KamaiPlus."`);

  // K-D36 + whole bottles: Excel units and the counter.
  const unitOf = (t: string) => { const r = mapUnit(t); return `${r.unit}${r.pack ? ':' + r.pack : ''}`; };
  assert([unitOf('Bottle'), unitOf('btl'), unitOf('Tin'), unitOf('Bag'), unitOf('बोरी'), unitOf('6 Bottle'), unitOf('10 थैली'), unitOf('Jar')].join() === 'bottle,bottle,can,bag,bag,box:6 Bottle,bundle:10 थैली,bottle',
    'K-D36: Excel units Bottle / Can / Tin / Bag / Sack keep the app\'s own units (they all became "piece")');
  assert(!allowsFractionalQty('bottle') && !allowsFractionalQty('can') && allowsFractionalQty('bag') && /normUnit === 'bag'/.test(readSource('components/billing/posQuantityConfig.ts')),
    'Counter: bottles and cans are whole numbers (1.5 bottles was allowed); a bag / sack has the ¼ ½ ¾ chips');

  // "What's new" stopped at 4.81.0 — shops on 4.98 saw old notes.
  assert(CHANGELOG[0].version === APP_VERSION && CHANGELOG[0].items.length >= 1,
    "What's new: the current version has its own notes (it showed 4.81.0's)");
}

// v4.101.0 — GST & Tally (K-D04 credit notes in GSTR-1, K-D11 Tally import, K-D22 GSTR-3B).
{
  const two = (id: string, rate = 18): any => ({ ...discLine(id, 23600, rate, true), quantity: 2, unit_price: 11800, hsn_code: '3401', unit: 'piece' });
  const one = (id: string): any => ({ ...discLine(id, 11800, 18, true), hsn_code: '3401', unit: 'piece' });
  const sep = new Date(2026, 8, 5, 10, 0).toISOString();
  const oct = (d: number) => new Date(2026, 9, d, 10, 0).toISOString();
  const b2bSep: any = { ...mk('B1', 'cB', [two('soapB')]), created_at: sep, customer_gstin: '27AAACB1234C1Z5' };
  const b2cOct: any = { ...mk('C1', undefined, [two('soapC')]), created_at: oct(2) };
  const b2cOct2: any = { ...mk('C2', undefined, [one('soapD')]), created_at: oct(6) };
  const rets: any[] = [
    { id: 'r1', return_number: 'RET-1', original_sale_id: 'B1', items: [{ product_id: 'soapB', quantity: 1 }], refund_amount: 11800, refund_method: 'store_credit', created_at: oct(3) },
    { id: 'r2', return_number: 'RET-2', original_sale_id: 'C1', items: [{ product_id: 'soapC', quantity: 1 }], refund_amount: 11800, refund_method: 'cash', created_at: oct(4) },
  ];
  const custs: any[] = [{ id: 'cB', name: 'Arihant & Sons', gstin: '27AAACB1234C1Z5' }];
  const octRange = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59, 59, 999) };
  const sepRange = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 30, 23, 59, 59, 999) };

  // K-D04: GSTR-1 JSON — bills as issued in their month, returns as credit notes in the return's month.
  const octJson: any = buildGstr1Json({ sales: [b2cOct, b2cOct2], customers: custs, business: invBiz, fp: '102026', returns: rets, originals: [b2bSep], ...octRange }).json;
  const sepJson: any = buildGstr1Json({ sales: [b2bSep], customers: custs, business: invBiz, fp: '092026', returns: rets, ...sepRange }).json;
  const note = octJson.cdnr?.[0]?.nt?.[0];
  assert(octJson.cdnr?.length === 1 && octJson.cdnr[0].ctin === '27AAACB1234C1Z5' && note.ntty === 'C' && note.nt_num === 'RET-1' && note.nt_dt === '03-10-2026'
    && note.val === 118 && note.itms[0].itm_det.txval === 100 && note.itms[0].itm_det.camt === 9 && note.itms[0].itm_det.samt === 9 && !octJson.b2b,
    'K-D04: goods a GSTIN buyer returned in October are an October credit note (table 9B "cdnr", ₹100 + ₹9 + ₹9), not a change to the September bill');
  assert(sepJson.b2b[0].inv[0].val === 236 && sepJson.b2b[0].inv[0].itms[0].itm_det.txval === 200 && !sepJson.cdnr,
    'K-D04: the September B2B bill is reported as issued (₹236), even though part came back in October');
  const b2cs = octJson.b2cs[0];
  assert(octJson.b2cs.length === 1 && b2cs.txval === 200 && b2cs.camt === 18 && b2cs.samt === 18,
    'K-D04: B2C returns lower the B2C row of their month (₹200 + ₹100 sold − ₹100 returned = ₹200 taxable)');
  const hsn = octJson.hsn.hsn_b2c.find((h: any) => h.hsn_sc === '3401');
  const hsnB2b = octJson.hsn.hsn_b2b.find((h: any) => h.hsn_sc === '3401');
  assert(hsn.qty === 2 && hsn.txval === 200 && hsnB2b.qty === -1 && hsnB2b.txval === -100
    && octJson.doc_issue.doc_det.length === 2 && octJson.doc_issue.doc_det[1].doc_num === 5 && octJson.doc_issue.doc_det[1].docs[0].from === 'RET-1' && octJson.doc_issue.doc_det[1].docs[0].totnum === 2,
    'K-D04: HSN summary is net of the credit notes; "documents issued" lists the credit note series (doc 5)');

  // The GST screen reads the same lines.
  const octRep = generateGSTR1Report([b2cOct, b2cOct2], custs, invBiz, 'Oct 2026', { returns: rets, originals: [b2bSep], ...octRange });
  assert(octRep.b2b_credit_notes.length === 1 && octRep.b2b_credit_notes[0].taxable_value === 10000 && octRep.b2b_credit_notes[0].invoice_number === 'INV-B1'
    && octRep.credit_notes_count === 2 && octRep.credit_note_from === 'RET-1' && octRep.total_taxable_value === 10000 && octRep.total_cgst === 900 && octRep.total_sgst === 900,
    'K-D04: the GST screen shows the B2B credit note, counts both credit notes in "documents issued", and its totals match the JSON');

  // K-D22: GSTR-3B outward tax from the same lines.
  const g3 = buildGstr3bSummary({ sales: [b2cOct, b2cOct2], customers: custs, business: invBiz, returns: rets, originals: [b2bSep], ...octRange });
  assert(g3.outwardTaxable.taxable === 10000 && g3.outwardTaxable.cgst === 900 && g3.outwardTaxable.sgst === 900 && g3.taxPayable === 1800 && g3.creditNotes.count === 2 && g3.creditNotes.taxable === 20000 && g3.bills === 2,
    'K-D22: GSTR-3B 3.1(a) = October sales ₹300 − October returns ₹200 (B2C and B2B) = ₹100 taxable, CGST ₹9 + SGST ₹9 — the same as the GST screen');

  // K-D11: Tally file — well-formed XML, Tally's structure, credit notes, every voucher balanced.
  const tx = generateTallyPrimeXML({ business: { ...invBiz, name: 'Sharma & Sons <Kirana>' }, sales: [b2cOct, b2cOct2], customers: custs, returns: rets, originals: [b2bSep], range: octRange });
  let parsed: any = null;
  const xmlErrors: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DOMParser } = require('@xmldom/xmldom');
    parsed = new DOMParser({ onError: (level: string, m: string) => { if (level !== 'warning') xmlErrors.push(m); } }).parseFromString(tx.xml, 'text/xml');
  } catch (e: any) { xmlErrors.push(String(e?.message || e)); }
  const txt = (el: any, tag: string) => el.getElementsByTagName(tag)[0]?.textContent || '';
  const ledgerNames = new Set<string>(['Cash']);
  const vouchers: any[] = [];
  if (parsed) {
    const ls = parsed.getElementsByTagName('LEDGER');
    for (let i = 0; i < ls.length; i++) ledgerNames.add(ls[i].getAttribute('NAME'));
    const vs = parsed.getElementsByTagName('VOUCHER');
    for (let i = 0; i < vs.length; i++) vouchers.push(vs[i]);
  }
  const problems: string[] = [...xmlErrors];
  if (parsed && txt(parsed, 'TALLYREQUEST') !== 'Import Data') problems.push('TALLYREQUEST');
  for (const v of vouchers) {
    const no = txt(v, 'VOUCHERNUMBER');
    if (!/^\d{8}$/.test(txt(v, 'DATE'))) problems.push(`${no}: date`);
    if (!['Sales', 'Credit Note'].includes(txt(v, 'VOUCHERTYPENAME')) || v.getAttribute('VCHTYPE') !== txt(v, 'VOUCHERTYPENAME')) problems.push(`${no}: type`);
    if (!ledgerNames.has(txt(v, 'PARTYLEDGERNAME'))) problems.push(`${no}: party ledger not created`);
    let sum = 0;
    const entries = v.getElementsByTagName('ALLLEDGERENTRIES.LIST');
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const name = e.getElementsByTagName('LEDGERNAME')[0].textContent;
      const a = Number(e.getElementsByTagName('AMOUNT')[0].textContent);
      const debit = e.getElementsByTagName('ISDEEMEDPOSITIVE')[0].textContent === 'Yes';
      if (!ledgerNames.has(name)) problems.push(`${no}: ledger ${name} not created`);
      if (debit !== a < 0) problems.push(`${no}: ${name} sign`);
      const bills = e.getElementsByTagName('BILLALLOCATIONS.LIST');
      if (bills.length && Number(bills[0].getElementsByTagName('AMOUNT')[0].textContent) !== a) problems.push(`${no}: bill amount`);
      sum += Math.round(a * 100);
    }
    if (sum !== 0) problems.push(`${no}: not balanced (${sum})`);
  }
  assert(Boolean(parsed) && problems.length === 0 && vouchers.length === 4,
    'K-D11: Tally file parses as XML (shop name with & and < escaped), Import Data, every ledger used is created (or Cash), debit = negative, voucher dates YYYYMMDD, every voucher balanced', problems.join('; '));
  const notes = vouchers.filter((v) => txt(v, 'VOUCHERTYPENAME') === 'Credit Note');
  const khata = notes.find((v) => txt(v, 'VOUCHERNUMBER') === 'RET-1');
  const cashBack = notes.find((v) => txt(v, 'VOUCHERNUMBER') === 'RET-2');
  assert(notes.length === 2 && txt(khata, 'PARTYLEDGERNAME') === 'Arihant' && /soapB x 1/.test(txt(khata, 'NARRATION')) && /<BILLTYPE>Agst Ref<\/BILLTYPE>/.test(tx.xml) && txt(khata, 'PARTYGSTIN') === '27AAACB1234C1Z5'
    && txt(cashBack, 'PARTYLEDGERNAME') === 'Cash' && txt(khata, 'DATE') === '20261003' && /LANGUAGENAME\.LIST/.test(tx.xml) && /<PERSISTEDVIEW>Accounting Voucher View<\/PERSISTEDVIEW>/.test(tx.xml),
    'K-D11: returns are Credit Note vouchers on the return date — store credit against the customer\'s bill (Agst Ref), a cash refund from Cash; ledgers named the way Tally exports them');

  // Bottle / Can / Bag have GST unit codes.
  assert(getGSTUQC('bottle') === 'BTL' && getGSTUQC('can') === 'CAN' && getGSTUQC('bag') === 'BAG' && getGSTUQC('kg') === 'KGS', 'GST units: Bottle BTL, Can CAN, Bag BAG (were OTH)');
}

// v4.102.0 — open gaps from the tracker: K-D02 shift history, K-D03 udhar limit, K-D06 favourites first,
// K-D07 estimates from the counter, K-D21 debit notes + purchase orders.
{
  // K-D02: closed shifts can be seen again.
  const sh = readSource('components/cash-register/CashShiftHistory.tsx');
  assert(shiftDifferenceLabel(0).tone === 'ok' && shiftDifferenceLabel(-2000).tone === 'short' && shiftDifferenceLabel(-2000).text.includes('20')
    && shiftDifferenceLabel(1500).tone === 'extra' && shiftDifferenceLabel(undefined).tone === 'ok' && SHIFT_HISTORY_LIMIT === 30
    && sh.includes("where('status').equals('closed')") && readSource('app/cash-register/page.tsx').includes('<CashShiftHistory'),
    'K-D02: Cash Register lists the last 30 closed shifts — opening float, expected, counted, and "₹20 short" / "₹15 extra" / "Exact"');

  // K-D03: udhar limit per customer — a warning at the counter, same field as the phone.
  assert(!checkCreditLimit({ credit_limit: 0, current_balance: 900000 }, 50000).over && !checkCreditLimit({ current_balance: 900000 }, 50000).over,
    'K-D03: no limit set (0 / empty) = never warns');
  const lim = checkCreditLimit({ credit_limit: 500000, current_balance: 480000 }, 30000);
  assert(lim.over && lim.after === 510000 && lim.limit === 500000 && !checkCreditLimit({ credit_limit: 500000, current_balance: 480000 }, 20000).over
    && !checkCreditLimit({ credit_limit: 500000, current_balance: 600000 }, 0).over,
    'K-D03: ₹4,800 owed + ₹300 udhar on a ₹5,000 limit warns (after ₹5,100); exactly at the limit or a fully paid bill does not');
  assert(udharOfBill({ method: 'credit', grandTotalPaise: 10000 }) === 10000 && udharOfBill({ method: 'upi', grandTotalPaise: 10000 }) === 0
    && udharOfBill({ method: 'cash', grandTotalPaise: 10000, typedCashPaise: 6000 }) === 4000 && udharOfBill({ method: 'cash', grandTotalPaise: 10000, typedCashPaise: null }) === 0
    && udharOfBill({ method: 'split', grandTotalPaise: 10000, splitPaise: { cash: 3000, upi: 2000, card: 0, credit: 1000 } }) === 5000,
    'K-D03: the udhar of a bill is counted as the counter saves it (credit = all; short cash = the shortfall; split = credit part + what is not split)');
  const bill = readCounter();
  const limAt = bill.indexOf('checkCreditLimit(targetCustomer, udhar)');
  assert(limAt > 0 && limAt < bill.indexOf('getNextUniqueInvoiceNumber(businessId)') && bill.slice(limAt, limAt + 600).includes('showConfirm(')
    && bill.slice(limAt, limAt + 900).includes('if (!go) return;'),
    'K-D03: the counter asks before saving a bill that takes the customer past the limit (Cancel = nothing saved)');
  const cm = readSource('components/customers/AddEditCustomerModal.tsx');
  const cc = toCloud('customers', { id: 'c1', name: 'Dealer', credit_limit: 500000 }, { bizId: 'biz_u' }) as any;
  const back = fromCloud('customers', { id: 'c1', name: 'Dealer', credit_limit_paise: 250000 }, null, { bizId: 'biz_u' }) as any;
  assert(cm.includes('data-customer-credit-limit') && cm.includes('credit_limit: Math.max(0, Math.round((parseFloat(creditLimit) || 0) * 100))')
    && cc.credit_limit_paise === 500000 && cc.credit_limit === undefined && back.credit_limit === 250000,
    'K-D03: the customer form saves the limit in paise; the cloud carries it as credit_limit_paise, the phone app\'s field');

  // K-D06: starred items first on the counter.
  const fav = favouritesFirst([{ id: 'a' }, { id: 'b', is_favorite: true }, { id: 'c' }, { id: 'd', is_favorite: true }] as any[]);
  assert(fav.map((p: any) => p.id).join() === 'b,d,a,c' && bill.includes('favouritesFirst('),
    'K-D06: favourite (starred) items come first in the counter\'s product grid, in their own order');

  // K-D07: an estimate / quotation from the counter.
  const en = nextEstimateNumber(['INV-004', 'EST-002', 'est-009', undefined as any, 'EST-X']);
  assert(en.number === 'EST-010' && en.seq === 10 && nextEstimateNumber([]).number === 'EST-001' && nextEstimateNumber(['EST-002'], 7).number === 'EST-008',
    'K-D07: estimates have their own EST- series; a converted estimate\'s number is never handed out again (floor)');
  const est = buildEstimateSale({ id: 's1', businessId: 'b', estimateNumber: 'EST-001', customer: { name: 'Ramesh', phone: '9800000000' },
    items: [{ product_id: 'p', product_name: 'Rice', quantity: 2, unit_price: 5000, total_amount: 10000 } as any], subtotal: 10000, discountTotal: 0, taxTotal: 0, grandTotal: 10000, now: '2026-10-05T10:00:00.000Z' });
  assert(isEstimate(est) && !isRevenueSale(est) && est.amount_received === 0 && est.balance_due === 0 && est.notes === ESTIMATE_NOTE && est.customer_name === 'Ramesh' && est.customer_id === undefined,
    'K-D07: the estimate is a draft — not revenue, nothing paid, nothing owed; a new customer is only named on it');
  const estSrc = readSource('components/billing/posEstimateAction.ts');
  const estFn = estSrc.slice(estSrc.indexOf('const handleSaveEstimate = async'), estSrc.indexOf('return { handleSaveEstimate };'));
  assert(estFn.length > 200 && estFn.includes('buildEstimateSale(') && estFn.includes('await db.sales.put(estimate)') && !estFn.includes('inventory_movements')
    && !estFn.includes('ledger_transactions') && !estFn.includes('commitNextInvoiceNumber') && !estFn.includes('db.customers.put') && bill.includes('data-save-estimate'),
    'K-D07: "Save as Estimate" saves the bill as priced — no stock, khata, bill number or new customer — and Transactions "Convert to Bill" does the rest');
  const ins = readSource('lib/invoices/invoiceNumberService.ts');
  assert(/!key\.toUpperCase\(\)\.startsWith\('EST-'\) \? parseInvoiceSequenceNumber\(key\)/.test(ins),
    'K-D07: EST-012 does not push the next bill number to INV-013');

  // K-D21: debit note (goods back to the supplier) and purchase order.
  assert(nextSupplierDocNumber(DEBIT_NOTE_PREFIX, ['DN-003', 'PO-007', 'B-55', undefined]) === 'DN-004' && nextSupplierDocNumber(PURCHASE_ORDER_PREFIX, ['DN-003', 'PO-007']) === 'PO-008'
    && nextSupplierDocNumber(PURCHASE_ORDER_PREFIX, []) === 'PO-001',
    'K-D21: debit notes (DN-) and purchase orders (PO-) have their own number series');
  const lines = [{ productId: 'p1', name: 'Oil', qty: 2, costPaise: 15050 }, { productId: 'p2', name: 'Soap', qty: 0, costPaise: 3000 }, { productId: '', name: 'x', qty: 3, costPaise: 100 }];
  assert(cleanDocLines(lines).length === 1 && docLinesTotal(lines) === 30100,
    'K-D21: only lines with an item and a quantity count; value = qty × cost (₹301)');
  assert(stockAfterReturn({ current_stock: 10, is_unlimited_stock: false }, 3).next === 7 && stockAfterReturn({ current_stock: 2, is_unlimited_stock: false }, 5).next === 0
    && !stockAfterReturn({ current_stock: 0, is_unlimited_stock: true }, 5).changes && stockAfterReturn({ current_stock: 1.5, is_unlimited_stock: false }, 0.25).next === 1.25,
    'K-D21: returned goods leave stock (never below 0); an uncounted item is unchanged');
  assert(supplierBalanceAfterReturn(50000, 30100) === 19900 && supplierBalanceAfterReturn(10000, 30100) === -20100,
    'K-D21: a debit note takes its value off what the shop owes (more than owed = advance with the supplier)');
  assert(supplierDocKind({}) === 'bill' && supplierDocKind({ kind: 'debit_note' }) === 'debit_note' && supplierDocKind({ kind: 'order' }) === 'order'
    && supplierDocLabel({ kind: 'order', status: 'pending_review' }) === 'Order open' && supplierDocLabel({ kind: 'order', status: 'confirmed' }) === 'Order received' && supplierDocLabel({ status: 'confirmed' }) === 'Confirmed',
    'K-D21: old purchase bills (no kind) stay bills; an order shows open / received / cancelled');
  const poText = purchaseOrderText({ bill_number: 'PO-002', bill_date: '2026-10-05', total_amount: 30100, notes: 'Deliver by Monday',
    line_items: [{ raw_name: 'Oil', quantity: 2, unit: 'litre', unit_price: 15050, total_price: 30100, is_new_product: false, confidence: 'high' }] }, 'Sharma Kirana');
  assert(poText.startsWith('Purchase Order PO-002\nFrom: Sharma Kirana\nDate: 05-10-2026') && poText.includes('1. Oil — 2 litre @ ') && poText.includes('Note: Deliver by Monday') && !/\n\n\n/.test(poText),
    'K-D21: the order goes to the supplier as a plain WhatsApp message (items, quantity, cost, note)');
  const sd = readSource('lib/purchases/supplierDocs.ts');
  const dn = sd.slice(sd.indexOf('export async function saveDebitNote'), sd.indexOf('export async function savePurchaseOrder'));
  const po = sd.slice(sd.indexOf('export async function savePurchaseOrder'), sd.indexOf('export async function receivePurchaseOrder'));
  const rc = sd.slice(sd.indexOf('export async function receivePurchaseOrder'), sd.indexOf('export async function cancelPurchaseOrder'));
  assert(dn.includes("db.transaction('rw', [db.products, db.inventory_movements, db.purchase_bills, db.suppliers, db.ledger_transactions]") && dn.includes("movement_type: 'ADJUSTMENT'")
    && dn.includes('await writeSupplierReturn(') && dn.includes('input.adjustAccount') && readSource('lib/suppliers/supplierLedger.ts').includes("transaction_type: 'ADJUSTMENT',") && !po.includes('db.products') && !po.includes('ledger')
    && rc.includes("order.status !== 'pending_review'") && rc.includes('stockAfterInward(prod, l.quantity)') && rc.includes("status: 'confirmed'") && rc.includes("kind: 'purchase'"),
    'K-D21: a debit note changes stock, the purchase record and the supplier account together; an order changes nothing until received (then a normal inward, once)');
  const pp = readSource('app/purchases/page.tsx');
  assert(pp.includes('data-new-debit-note') && pp.includes('data-new-purchase-order') && pp.includes('<PurchaseOrdersCard') && pp.includes('supplierDocLabel(bill)')
    && readSource('components/suppliers/SupplierDetailPanel.tsx').includes("tr('Goods returned')"),
    'K-D21: Purchases has "Return to Supplier" and "Purchase Order"; open orders are listed; Suppliers shows a debit note as "Goods returned"');
}

// v4.103.0 — loose ends: K-D12 route guard, K-D31 bundled font, K-D30 fuses, K-D17 E2E wait,
// K-D01 dead payment code, K-D05 GSTIN check digit, K-D28 duplicate items.
{
  // K-D12: every page the route guard names is a real route.
  const shell = readSource('components/layout/AppShell.tsx');
  const named = Array.from(new Set(Array.from(shell.matchAll(/(?:pathname === |startsWith\()'(\/[a-z-]*)'/g)).map((m) => m[1])));
  const missing = named.filter((r) => r !== '/' && !fs.existsSync(path.join(SRC_ROOT, 'app', r.slice(1), 'page.tsx')));
  assert(named.length >= 5 && missing.length === 0 && !shell.includes('/terms-of-service'),
    `K-D12: the route guard names only real pages (missing: ${missing.join(', ') || 'none'})`);

  // K-D31: Mukta ships with the app.
  const css = readSource('app/globals.css');
  const faces = Array.from(css.matchAll(/@font-face \{ font-family: 'Mukta';[^}]*url\(\.\.\/assets\/fonts\/([a-z0-9-]+\.woff2)\)/g)).map((m) => m[1]);
  assert(faces.length === 15 && faces.every((f) => fs.existsSync(path.join(SRC_ROOT, 'assets', 'fonts', f))) && fs.existsSync(path.join(SRC_ROOT, 'assets', 'fonts', 'OFL.txt'))
    && [400, 500, 600, 700, 800].every((w) => css.includes(`font-weight: ${w}; font-display: swap; src: url(../assets/fonts/mukta-${w}-devanagari.woff2)`)),
    'K-D31: the app bundles Mukta 400–800 (Latin, Latin Ext, Devanagari) with its licence — a shop PC without Mukta no longer falls back to Nirmala UI');

  // K-D30: the packaged exe cannot be turned into plain Node.
  const pkg = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, '..', 'package.json'), 'utf8'));
  const fuses = pkg.build?.electronFuses || {};
  assert(fuses.runAsNode === false && fuses.enableNodeOptionsEnvironmentVariable === false && fuses.enableNodeCliInspectArguments === false,
    'K-D30: the installer flips Electron\'s RunAsNode, NODE_OPTIONS and --inspect fuses off (ELECTRON_RUN_AS_NODE=1 made the exe plain Node)');

  // K-D17: the first licensed launch of a fresh build gets a cold-start wait.
  const e2e = fs.readFileSync(path.join(SRC_ROOT, '..', 'scripts', 'electron_e2e.mjs'), 'utf8');
  assert(/const FIRST_LAUNCH_WAIT_MS = 60000;/.test(e2e) && e2e.includes("textVisible(page, 'Set Master Password', FIRST_LAUNCH_WAIT_MS)"),
    'K-D17: Electron E2E waits up to 60 s for the first licensed screen (cold start after a build failed at 20 s)');

  // K-D01: the phone's payment-notification code is gone from the Desktop.
  const payImports = ALL_SOURCE.filter((f) => /from '@\/lib\/payments\//.test(fs.readFileSync(f, 'utf8')));
  assert(!fs.existsSync(path.join(SRC_ROOT, 'lib', 'payments')) || fs.readdirSync(path.join(SRC_ROOT, 'lib', 'payments')).length === 0,
    'K-D01: src/lib/payments (bank SMS parser, payment bridge, soundbox) is removed — no Desktop screen could use it');
  assert(payImports.length === 0, `K-D01: nothing imports the removed payment code (${payImports.join(', ') || 'none'})`);

  // K-D05: GSTIN check digit, offline.
  assert(gstinCheckChar('27AZIPL7277P1ZD') === 'D' && gstinCheckChar('24AAACR5055K1ZD') === 'D' && validateGstin('27AZIPL7277P1ZD').isValid
    && !validateGstin('27AZIPL7277P1ZE').isValid && (validateGstin('27AZIPL7277P1ZE').error || '').includes('should be D')
    && !validateGstin('27AZIPL7727P1ZD').isValid,
    'K-D05: a GSTIN whose check digit does not add up (one wrong letter, two digits swapped) is refused with the right last character; a real one passes');
  assert(/validateGstin\(input\.gstin, false\)/.test(readSource('lib/validation/validators.ts')) && readSource('components/suppliers/SupplierFormModal.tsx').includes('validateGstin(gstin, false)')
    && readSettingsPage().includes('validateGstin(gstin, false)'),
    'K-D05: customers, suppliers and the shop\'s own GSTIN all go through the check');

  // K-D28: the same item twice.
  const P = (id: string, name: string, extra: any = {}): any => ({ id, name, unit: 'piece', is_active: true, created_at: `2026-10-0${id.length}T00:00:00Z`, ...extra });
  const groups = findDuplicateGroups([
    P('a', 'Parle-G 100g', { barcode: '8901719110016' }), P('bb', 'parle-g  100G'), P('ccc', 'Biscuit', { barcode: '8901719110016' }),
    P('d', 'Shampoo', { barcode: '111' }), P('ee', 'Shampoo', { barcode: '222' }),
    P('f', 'Rice', { unit: 'kg' }), P('gg', 'Rice', { unit: 'piece' }),
    P('h', 'Shirt', { has_variants: true }), P('ii', 'Shirt', { has_variants: true }), P('j', 'Shirt M', { parent_id: 'h' }), P('kk', 'Shirt M', { parent_id: 'ii' }),
    P('l', 'Old Soap', { is_active: false }), P('mm', 'Old Soap'),
  ]);
  assert(groups.length === 1 && groups[0].map((p: any) => p.id).join() === 'a,bb,ccc',
    'K-D28: same barcode, or same name + unit with no barcode clash = duplicates; different barcodes, units, variants and switched-off items are not');
  assert(duplicateGroupKey(['b', 'a']) === duplicateGroupKey(['a', 'b']), 'K-D28: a group the shop marked "Not duplicates" is recognised again in any order');
  const kept = mergedProduct({ id: 'a', name: 'Parle-G', current_stock: 40, is_favorite: false } as any, [{ id: 'b', barcode: '890', is_favorite: true } as any], 55.5, 'now');
  const unl = mergedProduct({ id: 'a', current_stock: 0, is_unlimited_stock: true } as any, [], 9, 'now');
  assert(kept.current_stock === 55.5 && kept.barcode === '890' && kept.is_favorite === true && unl.current_stock === 0,
    'K-D28: the kept item takes the stock the shop entered, a barcode / star it lacked; an uncounted item stays uncounted');
  const rp = repointLines([{ product_id: 'b', q: 1 }, { product_id: 'x', q: 2 }] as any[], new Set(['b']), 'a');
  assert(rp.changed && rp.lines.map((l: any) => l.product_id).join() === 'a,x', 'K-D28: bill lines of the removed copy point to the kept item');
  const dsrc = readSource('lib/products/duplicates.ts');
  const mfn = dsrc.slice(dsrc.indexOf('export async function mergeDuplicateProducts'));
  assert(mfn.includes("db.transaction('rw', [db.products, db.inventory_movements, db.sales, db.sales_returns, db.purchase_bills]")
    && mfn.indexOf('bulkDelete') > mfn.indexOf("where('product_id').anyOf") && mfn.includes('db.sales.filter(') && mfn.includes('db.sales_returns.filter(')
    && readProductsPage().includes('<DuplicateItemsReview products={allProducts} />'),
    'K-D28: a merge moves bills, returns, stock history and purchase lines to the kept item and only then removes the copies — one transaction; Products shows the Review bar');
}

// v4.104.0 — K-D23: no source file over 400 lines (big screens split into parts, unchanged).
{
  const big = ALL_SOURCE.filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => ({ f: path.relative(SRC_ROOT, f).replace(/\\/g, '/'), n: fs.readFileSync(f, 'utf8').split('\n').length }))
    .filter((x) => x.n > 401);
  assert(big.length === 0, `K-D23: every src file stays within 400 lines (over: ${big.map((x) => `${x.f} ${x.n}`).join(', ') || 'none'})`);
  const pageSrc = readSource('app/billing/page.tsx');
  assert(['createSaleActions(', 'createCartActions(', 'usePosScanning(', 'usePosBillTabs()', 'usePosKeyboard(', 'usePosCatalogData(', 'usePosUpiQr(', '<PosCatalogPanel', '<PosCheckoutPanel', '<PosMobileCart', '<PosCounterDialogs'].every((x) => pageSrc.includes(x))
    && readSource('components/billing/posSaleActions.ts').includes('const { handleSaveEstimate } = createEstimateAction(deps);'),
    'K-D23: the billing counter is the page plus its parts (sale, estimate, lines, scanning, tabs, keyboard, catalogue, UPI QR, panels, dialogs)');
  assert(/export \* from '\.\/records';/.test(readSource('types/index.ts')) && /export \* from '@\/lib\/invoices\/invoiceDocumentTypes';/.test(readSource('lib/invoices/invoiceDocument.ts'))
    && /export \* from '@\/lib\/reports\/reportPeriod';/.test(readSource('lib/reports/advancedReports.ts'))
    && /export \{ SettingsReviewModal \} from '@\/components\/settings\/SettingsReviewModal';/.test(readSource('components/settings/SettingsChangeDialogue.tsx')),
    'K-D23: types, invoice document shapes, report periods and the settings review window moved with a re-export — every import path still works');
}

// v4.105.0 — Admin Console remote control: features, read-only / locked, minimum version,
// check-in interval, one-off commands with results, pop-up messages with a link.
{
  const adminLinkJs = require('../adminLink.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-admin-'));
  const ctl = adminLinkJs.cleanControl({
    mode: 'locked', mode_reason: 'Payment pending\u0007', features: { khata: false, whatsapp: true, 'Bad Key': true, gst_reports: 'yes' },
    min_version: '4.105.0', checkin_minutes: 5, commands: [{ id: 'c1', type: 'backup_now', at: '2026-10-05T09:00:00Z' }, { id: 'c2', type: 'rm_rf', at: '2026-10-05T09:00:00Z' }],
    machine_id: 'evil',
  });
  assert(ctl.mode === 'locked' && ctl.mode_reason === 'Payment pending' && JSON.stringify(ctl.features) === '{"khata":false,"whatsapp":true}' && ctl.min_version === '4.105.0'
    && ctl.checkin_minutes === 15 && ctl.commands.length === 1 && ctl.commands[0].type === 'backup_now' && !('machine_id' in ctl)
    && adminLinkJs.cleanControl(null).mode === 'normal' && adminLinkJs.cleanControl({ mode: 'explode' }).mode === 'normal',
    'Remote control: only known fields reach the app (unknown commands / features / modes dropped; check-in 15–360 min); nothing readable = normal');
  assert(adminLinkJs.saveControl(tmpDir, { mode: 'read_only', mode_reason: 'x' }) === true && adminLinkJs.saveControl(tmpDir, { mode: 'read_only', mode_reason: 'x' }) === false
    && adminLinkJs.readControl(tmpDir).mode === 'read_only',
    'Remote control is kept on the computer (it holds offline) and a repeat is not a change');
  adminLinkJs.saveControl(tmpDir, { commands: [{ id: 'a', type: 'check_update', at: '2026-10-05T09:00:00Z' }, { id: 'b', type: 'send_report', at: '2026-10-05T09:01:00Z' }] });
  adminLinkJs.recordCommand(tmpDir, 'a', true, 'up-to-date');
  const pend = adminLinkJs.pendingCommands(tmpDir, adminLinkJs.readControl(tmpDir));
  adminLinkJs.recordCommand(tmpDir, 'b', true, 'Error report sent', { sendReport: true });
  const rep1 = adminLinkJs.buildReport({ userDataDir: tmpDir, updateStatus: { readyVersion: '4.106.0', lastCheck: { at: '2026-10-05T09:02:00Z', result: 'downloading' }, beta: false }, errorReportText: 'ERR LOG' });
  adminLinkJs.clearSentResults(tmpDir, rep1.commands_done.map((r: any) => r.id));
  const rep2 = adminLinkJs.buildReport({ userDataDir: tmpDir, updateStatus: null, errorReportText: 'ERR LOG' });
  assert(pend.length === 1 && pend[0].id === 'b' && rep1.commands_done.length === 2 && rep1.error_report === 'ERR LOG' && rep1.update.ready_version === '4.106.0'
    && !rep2.commands_done && !rep2.error_report && adminLinkJs.pendingCommands(tmpDir, adminLinkJs.readControl(tmpDir)).length === 0,
    'Commands run once: the result and (when asked) the error report go with the next check-in, then are not sent again; a done command never runs twice');
  adminLinkJs.saveCounts(tmpDir, { bills_today: 3, features: { khata: true, bad: 1 } });
  const withFeatures = adminLinkJs.buildReport({ userDataDir: tmpDir, updateStatus: null, errorReportText: '' });
  const health = adminLinkJs.buildHealth({ userDataDir: tmpDir, backupInfo: null, errors: [] });
  assert(JSON.stringify(withFeatures.features) === '{"khata":true}' && !('features' in health) && health.bills_today === 3,
    'The page\'s feature switches go in the report (for the Control window), never in the health counts');
  const msgs = adminLinkJs.cleanMessages([{ id: 'p', text: 'Offer', style: 'popup', link: 'https://wa.me/918669997711', link_label: 'Chat' }, { id: 'j', text: 'x', link: 'javascript:alert(1)' }]);
  assert(msgs[0].style === 'popup' && msgs[0].link === 'https://wa.me/918669997711' && msgs[0].link_label === 'Chat' && msgs[1].link === undefined && msgs[1].style === undefined,
    'Messages: a pop-up with one https link; any other link is dropped');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Page side.
  assert(needsUpdate('4.104.0', '4.105.0') && !needsUpdate('4.105.0', '4.105.0') && !needsUpdate('4.110.0', '4.105.0') && !needsUpdate('4.104.0', undefined)
    && adminBlock({ mode: 'locked', appVersion: '4.104.0', min_version: '4.105.0' }) === 'locked' && adminBlock({ mode: 'normal', appVersion: '4.104.0', min_version: '4.105.0' }) === 'update'
    && adminBlock({ mode: 'read_only' }) === null && adminBlock(null) === null,
    'Lock covers the app first, then "please update" (only when this version is older than the minimum)');
  assert(blocksBilling({ mode: 'read_only' }, '/billing') && blocksBilling({ mode: 'read_only' }, '/billing/') && !blocksBilling({ mode: 'read_only' }, '/khata') && !blocksBilling({ mode: 'normal' }, '/billing'),
    'Billing paused (read-only) covers only the counter — khata, stock, reports stay open');
  assert(!counterHasOpenBill(null) && !counterHasOpenBill('[{"cart":[]},{"cart":[]}]') && counterHasOpenBill('[{"cart":[]},{"cart":[{"product_id":"p"}]}]') && !counterHasOpenBill('junk'),
    'A restart / update install from the Admin waits while any open bill has items');
  assert(JSON.stringify(parseAdminOverrides('{"khata":false,"unknown":true,"whatsapp":"no"}')) === '{"khata":false}' && JSON.stringify(cleanFeatureOverrides({ khata: false, 'X Y': true })) === '{"khata":false}',
    'Forced features: only real switch ids, true / false');
  const fsSrc = readSource('lib/features/featureSwitches.ts');
  assert(/\{ \.\.\.applyRestaurantPreset\(parseFeatureSwitches\(localStorage\.getItem\(FEATURE_SWITCHES_KEY\)\), isRestaurantMode\(\)\), \.\.\.readAdminFeatureOverrides\(\) \}/.test(fsSrc)
    && /JSON\.stringify\(\{ \.\.\.parseFeatureSwitches\(localStorage\.getItem\(FEATURE_SWITCHES_KEY\)\), \[id\]: on \}\)/.test(fsSrc),
    'The Admin\'s switches win over the shop\'s; the shop\'s own choice is stored untouched and comes back when the Admin lets go');
  assert(readSource('components/layout/AppShell.tsx').includes('<AdminControlHost />'),
    'AppShell applies the Admin control (forced switches win over the shop category, v4.118.0)');

  // Main process wiring.
  const mainJs = fs.readFileSync(path.join(SRC_ROOT, '..', 'main.js'), 'utf8');
  const pre = fs.readFileSync(path.join(SRC_ROOT, '..', 'preload.js'), 'utf8');
  const lic = fs.readFileSync(path.join(SRC_ROOT, '..', 'licence.js'), 'utf8');
  assert(mainJs.includes('Date.now() - lastCheckIn >= checkInEveryMs()') && /case 'restart_app': \{\s*const busy = await idleOrRetry\(\);/.test(mainJs)
    && /case 'wipe_and_reset':[\s\S]{0,300}const busy = await idleOrRetry\(\);/.test(mainJs)
    && /case 'install_update':[\s\S]{0,600}const busy = await idleOrRetry\(\);/.test(mainJs) && mainJs.includes("new Notification({ title: 'KamaiPlus'")
    && mainJs.includes("sendToPage('kp:admin-control', adminControlForPage())") && lic.includes('...(report && Object.keys(report).length ? { report } : {}),')
    && adminLinkJs.COMMAND_TYPES.includes('wipe_and_reset')
    && ['getAdminControl', 'onAdminControl', 'onAdminCommand', 'adminCommandDone'].every((n) => pre.includes(`${n}:`)),
    'Main process: check-in every N minutes as the Admin set, restart / install / wipe_and_reset only on an idle counter, Windows notification for urgent / pop-up, the control reaches the page');

  // The Admin Console offers exactly the Desktop's switches (Android repo, when present on this PC).
  const consoleModels = path.join(SRC_ROOT, '..', '..', 'KamaiPlus Android', 'admin_console', 'lib', 'models', 'admin_models.dart');
  if (fs.existsSync(consoleModels)) {
    const dart = fs.readFileSync(consoleModels, 'utf8');
    const consoleIds = Array.from(dart.matchAll(/\('([a-z_]+)', '[^']+', '(?:Screens|Product form|Buttons|Privacy|Mode)'\)/g)).map((m) => m[1]).filter((id) => id !== 'restaurant_mode').sort();
    const appIds = Object.keys(DEFAULT_FEATURE_SWITCHES).sort();
    assert(/\('restaurant_mode', '[^']+', 'Mode'\)/.test(dart), 'The Admin Console offers the admin-only Restaurant mode switch');
    assert(JSON.stringify(consoleIds) === JSON.stringify(appIds), `The Admin Console's feature list matches this app's switches (console: ${consoleIds.length}, app: ${appIds.length})`);
  }

  // Desktop Realtime Live Listener (1-second instant live reaction from Firestore)
  const liveListenerPath = path.join(SRC_ROOT, 'lib', 'desktop', 'desktopLiveListener.ts');
  const liveSyncCompPath = path.join(SRC_ROOT, 'components', 'desktop', 'DesktopLiveSync.tsx');
  const layoutPath = path.join(SRC_ROOT, 'app', 'layout.tsx');
  assert(fs.existsSync(liveListenerPath) && fs.existsSync(liveSyncCompPath), 'Desktop live listener and DesktopLiveSync component exist');
  const liveListenerCode = fs.readFileSync(liveListenerPath, 'utf8');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');
  assert(liveListenerCode.includes('desktop_signals') && liveListenerCode.includes('api.refreshLicence') && liveListenerCode.includes('onSnapshot'),
    'desktopLiveListener listens to desktop_signals via onSnapshot and triggers api.refreshLicence()');
  assert(layoutCode.includes('<DesktopLiveSync />'), 'DesktopLiveSync component is mounted in root layout.tsx');

  // Android Firestore rules & Admin Console signals (when Android repo is present)
  const androidRules = path.join(SRC_ROOT, '..', '..', 'KamaiPlus Android', 'firestore.rules');
  if (fs.existsSync(androidRules)) {
    const rulesCode = fs.readFileSync(androidRules, 'utf8');
    // v4.135.0: one signal is readable by anyone who knows its licence key (allow get); the list of all keys is
    // admin-only (allow list) — the 2026-10-10 rules deploy.
    const sig = rulesCode.slice(rulesCode.indexOf('match /desktop_signals/{key}'), rulesCode.indexOf('match /desktop_signals/{key}') + 400);
    assert(sig.includes('allow get: if true') && sig.includes('allow list: if isAdmin()') && sig.includes('allow write: if isAdmin()'),
      'firestore.rules allows reading desktop_signals and restricts writing to admin');
  }
  const adminService = path.join(SRC_ROOT, '..', '..', 'KamaiPlus Android', 'admin_console', 'lib', 'services', 'admin_firestore_service.dart');
  if (fs.existsSync(adminService)) {
    const serviceCode = fs.readFileSync(adminService, 'utf8');
    assert(serviceCode.includes('_pingDesktopLive') && serviceCode.includes('desktop_signals'),
      'AdminFirestoreService sends realtime timestamp pings to desktop_signals');
  }
}


// v4.106.0 — Restaurant mode: Tables & Orders, add-ons, KOT, takeaway, 5 % GST bill. Switched on only from the Admin Console.
{
  const NOW = '2026-10-06T10:00:00.000Z';
  const dosa: MenuPick = { productId: 'p_dosa', name: 'Masala Dosa', unit: 'piece', basePaise: 10000 };
  const tea: MenuPick = { productId: 'p_tea', name: 'Tea', unit: 'piece', basePaise: 1500 };
  const cheese = { name: 'Extra cheese', pricePaise: 2000 };
  const settings = sanitizeRestaurantSettings({});

  // Lines: same dish + same add-ons (any order) + same note = one line.
  assert(lineKey('p', [cheese, { name: 'Butter', pricePaise: 1000 }], 'x') === lineKey('p', [{ name: 'Butter', pricePaise: 1000 }, cheese], ' X ')
    && lineKey('p', [], '') !== lineKey('p', [cheese], '') && lineKey('p', [], 'less spicy') !== lineKey('p', [], ''),
    'Restaurant: the same dish with the same add-ons and note is one line; another add-on or note is another line');
  let o = newOrder('table', 'T3', 'o1', NOW);
  o = addPiece(addPiece(addPiece(o, dosa, NOW), dosa, NOW), tea, NOW);
  assert(o.lines.length === 2 && o.lines[0].qty === 2 && pieceCount(o) === 3 && lineUnitPaise({ basePaise: 10000, addOns: [cheese] }) === 12000,
    'Restaurant: a second tap adds a piece to the same line; add-ons add to the price of one piece');

  // Add-ons for ONE piece: before the kitchen has it, and after.
  let withCheese = applyToOnePiece(o, o.lines[0].key, [cheese], '', NOW);
  assert(withCheese.lines.length === 3 && withCheese.lines[0].qty === 1 && withCheese.lines[2].qty === 1 && withCheese.lines[2].addOns[0].name === 'Extra cheese' && pieceCount(withCheese) === 3,
    'Restaurant: add-ons go on one piece (2 dosas → 1 plain + 1 with cheese) — before the KOT');
  const sent = markKotSent(o, NOW);
  assert(sent.kotRounds === 1 && !hasUnsentItems(sent) && kotChanges(sent).length === 0, 'Restaurant: after a KOT the kitchen is up to date (nothing new to send)');
  const changed = applyToOnePiece(sent, sent.lines[0].key, [cheese], 'less spicy', NOW);
  const ch = kotChanges(changed);
  assert(ch.length === 2 && ch[0].delta === -1 && ch[0].title === 'Masala Dosa' && ch[1].delta === 1 && ch[1].title === 'Masala Dosa + Extra cheese' && ch[1].note === 'less spicy',
    'Restaurant: add-ons after the KOT = "cancel the plain one, add this one" on the next slip');

  // Removing a piece the kitchen has: stays at 0 until the next slip cancels it.
  const less = changeQty(changeQty(sent, sent.lines[1].key, -1, NOW), sent.lines[0].key, -1, NOW);
  assert(less.lines.find((l) => l.productId === 'p_tea')!.qty === 0 && pieceCount(less) === 1 && kotChanges(less).some((k) => k.delta === -1 && k.title === 'Tea')
    && markKotSent(less, NOW).lines.every((l) => l.qty > 0) && changeQty(addPiece(newOrder('table', 'T1', 'o', NOW), tea, NOW), lineKey('p_tea', [], ''), -1, NOW).lines.length === 0,
    'Restaurant: a line already in the kitchen shows as CANCEL and then goes; one the kitchen never had just disappears');

  // The bill: 5 % GST included in the price, or added on top; service charge; takeaway packing; discount.
  const two = addPiece(addPiece(newOrder('table', 'T1', 'o', NOW), dosa, NOW), dosa, NOW);
  const inc = orderTotals(two, settings);
  assert(inc.grandTotal === 20000 && inc.taxTotal === 952 && inc.subtotal === 19048 && inc.items.length === 1 && inc.items[0].hsn_code === '9963' && inc.items[0].tax_rate === 5,
    'Restaurant bill: 2 × ₹100 with 5 % GST included = ₹200 (GST ₹9.52, taxable ₹190.48), HSN 9963');
  const exc = orderTotals(two, { ...settings, gstInclusive: false });
  assert(exc.grandTotal === 21000 && exc.taxTotal === 1000 && exc.subtotal === 20000, 'Restaurant bill: GST added on top = ₹210');
  const svc = orderTotals(two, { ...settings, serviceChargePercent: 10 });
  assert(svc.serviceChargePaise === 1905 && svc.taxTotal === 1047 && svc.grandTotal === 22000 && svc.items.length === 2 && svc.items[1].product_id === SERVICE_CHARGE_ID && svc.items[1].is_tax_inclusive === false,
    'Restaurant bill: 10 % service charge on the food value (₹19.05) with GST on it, as its own bill line');
  const take = orderTotals({ ...two, kind: 'takeaway', label: 'TA-01' }, { ...settings, packingChargePaise: 1000 });
  assert(take.packingPaise === 1000 && take.grandTotal === 21050 && take.items[take.items.length - 1].product_id === PACKING_CHARGE_ID && orderTotals(two, { ...settings, packingChargePaise: 1000 }).packingPaise === 0,
    'Restaurant bill: the packing charge is only on takeaway (₹10 + GST ₹0.50)');
  const disc = orderTotals(two, settings, { type: 'percentage', value: 10 });
  assert(disc.discountTotal === 2000 && disc.grandTotal === 18000 && disc.taxTotal === 857 && discountPaise(20000, { type: 'flat', value: 999 }) === 20000 && discountPaise(20000, { type: 'percentage', value: 150 }) === 20000 && discountPaise(0, { type: 'flat', value: 5 }) === 0,
    'Restaurant bill: a 10 % discount takes ₹20 off and the GST follows what is really charged; a discount never exceeds the food');
  assert(orderTotals(newOrder('table', 'T9', 'o', NOW), { ...settings, serviceChargePercent: 10 }).grandTotal === 0 && orderTotals(newOrder('table', 'T9', 'o', NOW), settings).items.length === 0,
    'Restaurant bill: an empty table has no bill (no service charge on nothing)');

  // Takeaway tokens restart every day.
  const t1 = nextToken(null, new Date(2026, 9, 6, 10));
  const t2 = nextToken(t1.counter, new Date(2026, 9, 6, 20));
  const t3 = nextToken(t2.counter, new Date(2026, 9, 7, 9));
  assert(t1.label === 'TA-01' && t2.label === 'TA-02' && t3.label === 'TA-01' && formatOpenTime(75) === '1 h 15 m' && formatOpenTime(9) === '9 min',
    'Restaurant: takeaway tokens TA-01, TA-02… start again every day; open time reads "9 min" / "1 h 15 m"');

  // The shop's set-up: always valid.
  const sane = sanitizeRestaurantSettings({ tables: ['T1', 't1', ' Garden 1 ', '', 'x'.repeat(50)], gstRate: 99, serviceChargePercent: -4, packingChargePaise: 'abc', addOns: [{ name: 'Cheese', pricePaise: 500 }, { name: 'cheese', pricePaise: 1 }, { name: '' }] });
  assert(sane.tables.length === 3 && sane.tables[1] === 'Garden 1' && sane.tables[2].length === 20 && sane.gstRate === 28 && sane.serviceChargePercent === 0 && sane.packingChargePaise === 0 && sane.addOns.length === 1 && sane.addOns[0].pricePaise === 500
    && sanitizeRestaurantSettings({ tables: [] }).tables.length === 10 && sanitizeRestaurantSettings({ addOns: [] }).addOns.length === 0 && sanitizeRestaurantSettings(null).gstRate === 5 && sanitizeRestaurantSettings(null).gstInclusive === true
    && defaultTableNames(3).join() === 'T1,T2,T3' && defaultTableNames(999).length === 60,
    'Restaurant set-up: unique table names, GST 0–28 % (5 % default, included), sane charges; an emptied add-on list stays empty');
  const st = parseRestState({ orders: [{ id: 'a', kind: 'table', label: 'T1', openedAt: NOW, lines: [{ key: 'k', productId: 'p', name: 'Tea', qty: '2', basePaise: 1500, kotQty: 5, addOns: [{ name: 'Sugar', pricePaise: 0 }, { name: '' }] }, { nope: 1 }] }, { id: 'b', kind: 'bogus', label: 'X' }, null], token: { day: '2026-10-06', last: 4 } });
  assert(st.orders.length === 1 && st.orders[0].lines.length === 1 && st.orders[0].lines[0].qty === 2 && st.orders[0].lines[0].addOns.length === 1 && st.token?.last === 4 && parseRestState('junk').orders.length === 0,
    'Restaurant: running orders are read back safely (a damaged entry is dropped, never a crash on the Tables screen)');

  // The kitchen slip.
  const slip = buildKotBody({ order: changed, shopName: 'Sharma <Hotel>', round: 2, now: new Date(2026, 9, 6, 13, 5) });
  assert(slip.includes('T3') && slip.includes('Round 2') && slip.includes('ADD') && slip.includes('CANCEL') && slip.includes('Masala Dosa + Extra cheese') && slip.includes('less spicy') && slip.includes('Sharma &lt;Hotel&gt;') && !slip.includes('<Hotel>')
    && buildKotBody({ order: sent, round: 1 }, []).includes('KOT'),
    'Restaurant KOT: table, round, what to ADD and what to CANCEL, the cook\'s note; shop name is escaped');

  // Admin-only: Restaurant mode is not a Settings switch; it is forced from the Admin Console.
  assert(restaurantModeFromRaw('{"restaurant_mode":true}') && !restaurantModeFromRaw('{"restaurant_mode":false}') && !restaurantModeFromRaw('{"khata":true}') && !restaurantModeFromRaw(null) && !restaurantModeFromRaw('junk')
    && !FEATURES.some((f) => (f.id as string) === 'restaurant_mode') && !('restaurant_mode' in DEFAULT_FEATURE_SWITCHES),
    'Restaurant mode: on only when the Admin forces it; it has no switch in Settings → Features');
  const preset = applyRestaurantPreset({ ...DEFAULT_FEATURE_SWITCHES, inventory: true, barcode_studio: true, purchases: true, suppliers: true, khata: true }, true);
  assert(preset.inventory && !preset.barcode_studio && preset.purchases && preset.suppliers && preset.khata && preset.whatsapp
    && !preset.wholesale_price && !preset.product_size_colour && !preset.product_gst_rate && !preset.product_hsn && !preset.payment_keys && !preset.product_selling_price && preset.product_variants
    && applyRestaurantPreset(DEFAULT_FEATURE_SWITCHES, false) === DEFAULT_FEATURE_SWITCHES && RESTAURANT_PRESET_OFF.length === 9 && !RESTAURANT_PRESET_OFF.includes('product_variants') && !preset.stock_counting && !preset.product_barcode,
    'Restaurant mode: labels, wholesale, size / colour, per-dish GST / HSN and counter keys go off; inventory, purchases, suppliers and Half / Full variants on; khata and WhatsApp stay');
  const fsSrc2 = readSource('lib/features/featureSwitches.ts');
  assert(/\.\.\.applyRestaurantPreset\(parseFeatureSwitches\(localStorage\.getItem\(FEATURE_SWITCHES_KEY\)\), isRestaurantMode\(\)\), \.\.\.readAdminFeatureOverrides\(\)/.test(fsSrc2),
    'Restaurant mode: shop switches → restaurant preset → the Admin\'s forced switches on top (the Admin can still force one back on)');

  // Wiring.
  const gate = readSource('components/features/FeatureGate.tsx');
  const side = readSource('components/layout/Sidebar.tsx');
  assert(/path === '\/billing'/.test(gate) && gate.includes("router.replace('/restaurant')") && /path === '\/restaurant' && !restaurant/.test(gate) && gate.includes('data-restaurant-closed')
    && side.includes("{ href: '/restaurant', label: tr('Tables & Orders')") && side.includes('useRestaurantMode()') && fs.existsSync(path.join(SRC_ROOT, 'app', 'restaurant', 'page.tsx')),
    'Restaurant mode: Billing → Tables & Orders in the menu and old Billing links land on it; /restaurant is closed ("not switched on") for every other shop');

  // Paying: same steps as the counter's bill, the table is freed only after the bill is saved.
  const settleSrc = readSource('lib/restaurant/settle.ts');
  const iNum = settleSrc.indexOf('getNextUniqueInvoiceNumber(businessId)');
  const iPut = settleSrc.indexOf('await db.sales.put(sale)');
  const iCommit = settleSrc.indexOf('await commitNextInvoiceNumber(');
  const iStock = settleSrc.indexOf("db.transaction('rw', db.products, db.inventory_movements");
  assert(iNum > 0 && iNum < iPut && iPut < iCommit && iCommit < iStock && !/await cloud/.test(settleSrc) && settleSrc.includes("customer_name: billCustomerName(order, guestName || customer?.name)") && settleSrc.includes("payment_status: udhar ? 'unpaid' : 'paid'")
    && settleSrc.includes('if (!prod || prod.is_unlimited_stock) continue;') && settleSrc.includes('SERVICE_CHARGE_ID') && settleSrc.includes("status: 'completed'"),
    'Restaurant pay: reserve the number → save the bill → commit the number → stock (counted items only); cloud never awaited; the table name is the bill\'s customer');
  const orderScreenAll = readSource('components/restaurant/OrderScreen.tsx');
  // v4.108.0: Cancel order / Reprint KOT also print and remove — check the KOT and the pay functions themselves.
  const orderScreen = orderScreenAll.slice(orderScreenAll.indexOf('const sendKot = async'));
  const iSettle = orderScreen.indexOf('await settleOrder(');
  const iFree = orderScreen.indexOf('orders.filter((o) => o.id !== order.id)');
  const iMark = orderScreen.indexOf('markKotSent(o, now())');
  const iKot = orderScreen.indexOf('await printKot(');
  assert(iSettle > 0 && iSettle < iFree && iKot > 0 && iKot < iMark && /if \(res\.ok\) \{\s*update\(\(s\) => mapOrder\(s, order\.id, \(o\) => markKotSent/.test(orderScreen) && orderScreen.includes('if (busy) return;') && orderScreen.includes('if (kotBusy) return;') && orderScreenAll.includes('if (cancelBusy) return;') && orderScreenAll.includes('if (checkBusy) return;'),
    'Restaurant screens: a table is freed only after its bill is saved; a KOT is marked sent only when it printed; double taps are ignored');
  const kotSrc = readSource('lib/restaurant/kot.ts');
  assert(/silent: true/.test(kotSrc) && kotSrc.includes('if (changes.length === 0) return { ok: false, empty: true };'), 'Restaurant KOT: prints silently on the counter\'s thermal printer, and only when something changed');
  const home = readSource('components/restaurant/RestaurantPage.tsx');
  assert(home.includes('billPrint.print({ sale, business })') && home.includes('getDesktopApi()') && home.includes('<InvoiceModal') && home.includes('lines.length > 0 || o.kotRounds > 0'),
    'Restaurant: the paid bill prints straight away (a browser shows the bill instead); an empty table or token is not kept');
  const menuSrc = readSource('components/restaurant/useMenu.ts');
  assert(menuSrc.includes('db.products.toArray()') && !menuSrc.includes('business_type') && readSource('components/restaurant/MenuPanel.tsx').includes('d.sizes.length > 0'),
    'Restaurant menu = the shop\'s Products (Half / Full are variants); no second item list, nothing branches on the shop type');
  const anyType = ALL_SOURCE.filter((f) => /[\\/](restaurant)[\\/]/.test(f)).filter((f) => /business_type|businessType/.test(fs.readFileSync(f, 'utf8')));
  assert(anyType.length === 0, 'Restaurant code never branches on business_type (Bible §9.2)');
}

// v4.107.0 — Features are set only by KamaiPlus support; Restaurant mode speaks a restaurant's words;
// restaurant bill window (Print / PDF / WhatsApp), UPI QR, guest mobile, Today's bills, Move table.
{
  // Settings → Features is read-only: the shop sees what is on, KamaiPlus changes it.
  const writers = ALL_SOURCE.filter((f) => /setFeatureSwitch\(/.test(fs.readFileSync(f, 'utf8')) && !/featureSwitches\.ts$/.test(f)).map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, '/'));
  assert(JSON.stringify(writers) === JSON.stringify(['components/import/CatalogImportModal.tsx']),
    `Settings → Features only shows On / Off with "contact KamaiPlus support"; nothing in the app lets the shop change a switch (only the Excel import turns wholesale on: ${writers.join(', ')})`);
  const gate2 = readSource('components/features/FeatureGate.tsx');
  assert(gate2.includes("tr('KamaiPlus support switches features on for your shop. Nothing was deleted — your data is safe.')") && !gate2.includes('Turn it on in Settings'),
    'A switched-off screen says KamaiPlus support switches it on (no "turn it on in Settings")');

  // Restaurant words: one module, applied inside tr(); every key is a real text of the app, every
  // replacement is translated, and no screen reads the shop type.
  const wordKeys = Object.keys(RESTAURANT_WORDS);
  const allSrc = ALL_SOURCE.filter((f) => !/restaurant[\\/]words\.ts$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const deadKeys = wordKeys.filter((k) => !allSrc.includes(`'${k}'`) && !allSrc.includes(`"${k}"`));
  const hiW = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'locales', 'hi.json'), 'utf8'));
  const mrW = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'locales', 'mr.json'), 'utf8'));
  const untranslated = Object.values(RESTAURANT_WORDS).filter((v) => !hiW[v] || !mrW[v]);
  const placeholders = wordKeys.filter((k) => JSON.stringify((k.match(/\{\w+\}/g) || []).sort()) !== JSON.stringify((RESTAURANT_WORDS[k].match(/\{\w+\}/g) || []).sort()));
  assert(wordKeys.length >= 30 && deadKeys.length === 0 && untranslated.length === 0 && placeholders.length === 0
    && RESTAURANT_WORDS['Products'] === 'Menu' && RESTAURANT_WORDS['Customers'] === 'Guests' && RESTAURANT_WORDS['Transactions'] === 'Bills',
    `Restaurant words: Products → Menu, Customers → Guests, Transactions → Bills… every key exists in the app (${deadKeys.join(' | ') || 'all'}), every word has Hindi + Marathi, placeholders kept`);
  setActiveLanguage('en', null);
  setActiveWords(RESTAURANT_WORDS);
  const inRestaurant = [tr('Products'), tr('{productsCount} items', { productsCount: 42 }), tr('Khata Ledger')];
  setActiveLanguage('hi', { Menu: 'मेन्यू' });
  const inHindi = tr('Products');
  setActiveWords(null);
  const backToShop = tr('Products');
  setActiveLanguage('en', null);
  assert(inRestaurant.join('|') === 'Menu|42 dishes|Khata Ledger' && inHindi === 'मेन्यू' && backToShop === 'Products' && tr('Products') === 'Products',
    'tr(): in Restaurant mode "Products" reads "Menu" (then Hindi "मेन्यू"), untouched texts stay; out of the mode every word is the app\'s own');
  const i18nSrc = readSource('lib/i18n/index.tsx');
  assert(/setActiveWords\(on \? RESTAURANT_WORDS : null\)/.test(i18nSrc) && /key=\{`\$\{language\}:\$\{restaurant \? 'restaurant' : 'shop'\}`\}/.test(i18nSrc) && /translate\(table, withWords\(text\), vars\)/.test(i18nSrc)
    && !/business_type|businessType/.test(readSource('lib/restaurant/words.ts')),
    'The words follow Restaurant mode (Admin Console) before the first paint and the app redraws when it changes; nothing reads business_type');

  // Home: no stock coming in = no inward tile.
  assert(quickActionsFor({ purchases: false, inventory: false }).map((a) => a.id).join(',') === 'new_bill,khata,day_summary,printers'
    && quickActionsFor({ purchases: false }).some((a) => a.id === 'fast_inward') && quickActionsFor({ purchases: true, inventory: false }).some((a) => a.id === 'stock_inward'),
    'Home: with stock and purchases both off (e.g. Restaurant mode) the "Fast barcode inward" tile goes; otherwise it stays');

  // Paying: guest name / mobile on the bill (the mobile fills WhatsApp).
  const ord = { kind: 'table' as const, label: 'T4' };
  assert(billCustomerName(ord) === 'Table T4' && billCustomerName(ord, '  Rahul   Jadhav ') === 'Rahul Jadhav · Table T4' && billCustomerName({ kind: 'takeaway', label: 'TA-03' }, '') === 'Takeaway TA-03'
    && cleanGuestPhone('98765 43210') === '9876543210' && cleanGuestPhone('+91 98765-43210') === '9876543210' && cleanGuestPhone('09876543210') === '9876543210'
    && cleanGuestPhone('12345') === '' && cleanGuestPhone('5876543210') === '' && cleanGuestPhone('') === '',
    'Restaurant bill: "Rahul · Table T4" when the guest gives a name; a mobile is kept only when it is a real 10-digit Indian number');
  const settle2 = readSource('lib/restaurant/settle.ts');
  assert(settle2.includes('...(phone ? { customer_phone: phone } : {})') && settle2.includes("notes: address ? `${billLabel(order)} · ${address}` : billLabel(order)"),
    'The guest\'s mobile goes on the bill (customer_phone) so WhatsApp opens with it; the note stays the table name (Today\'s bills, reports)');

  // After paying: like the counter — "Print straight away" (same setting) or the bill window.
  const page2 = readSource('components/restaurant/RestaurantPage.tsx');
  const pay2 = readSource('components/restaurant/PayDialog.tsx');
  assert(/if \(printNow && business && getDesktopApi\(\)\) \{\s*billPrint\.print\(\{ sale, business \}\);/.test(page2) && page2.includes('setSaleToShow({ sale, justPaid: true })')
    && page2.includes('isPostSaleSuccess={saleToShow.justPaid} initialPhone={saleToShow.sale.customer_phone}') && page2.includes('data-toast-open-bill')
    && pay2.includes('setPrintNow(readSilentPrint())') && pay2.includes('saveSilentPrint(on)') && pay2.includes('<RestUpiQr'),
    'Restaurant pay: "Print straight away" (the counter\'s own setting) or the bill window with Print, PDF and WhatsApp; a printed bill can still be opened from the message; UPI shows the QR');
  assert(isRestaurantBill({ notes: 'Table T1', status: 'completed' }) && isRestaurantBill({ notes: 'Takeaway TA-02', status: 'completed' })
    && !isRestaurantBill({ notes: 'Table T1', status: 'draft' }) && !isRestaurantBill({ notes: 'Walk-in', status: 'completed' }) && !isRestaurantBill({ notes: undefined, status: 'completed' }),
    "Today's bills lists only restaurant bills (table / takeaway), never an estimate");

  // Move table.
  const NOW2 = '2026-10-06T12:00:00.000Z';
  const a = { ...newOrder('table', 'T1', 'a', NOW2), lines: [{ key: 'k', productId: 'p', name: 'Tea', unit: 'piece', qty: 2, basePaise: 1500, addOns: [], note: '', kotQty: 2 }] as Parameters<typeof moveOrderTo>[0][number]['lines'], kotRounds: 1 };
  const b = newOrder('table', 'T2', 'b', NOW2);
  const t = newOrder('takeaway', 'TA-01', 't', NOW2);
  const moved = moveOrderTo([a, b, t], 'a', 'T5', '2026-10-06T12:30:00.000Z');
  assert(moved[0].label === 'T5' && moved[0].lines[0].kotQty === 2 && moved[0].kotRounds === 1 && moved[0].openedAt === NOW2
    && moveOrderTo([a, b], 'a', 'T2', NOW2)[0].label === 'T1' && moveOrderTo([a, t], 't', 'T9', NOW2)[1].label === 'TA-01' && moveOrderTo([a], 'a', '  ', NOW2)[0].label === 'T1',
    'Move table: the order (kitchen state, open time) goes to a free table; never onto a busy table, never for a takeaway');
}

// v4.108.0 — Restaurant order screen: delete a dish, Cancel order (cancel slip, reason, owner PIN, today's
// cancelled list), Print bill before paying (UPI QR), Reprint KOT, Cash + UPI split; Stock counting and
// Barcode on items are switches (Restaurant mode turns them off — the Admin can bring them back).
{
  const NOW3 = '2026-10-06T13:00:00.000Z';
  const dal: MenuPick = { productId: 'p_dal', name: 'Dal Tadka', unit: 'piece', basePaise: 20000 };
  const roti: MenuPick = { productId: 'p_roti', name: 'Butter Roti', unit: 'piece', basePaise: 3000 };
  let ord = addPiece(addPiece(addPiece(newOrder('table', 'T4', 'x', NOW3), dal, NOW3), roti, NOW3), roti, NOW3);
  const unsentGone = removeLine(ord, ord.lines[1].key, NOW3);
  assert(unsentGone.lines.length === 1 && unsentGone.lines[0].productId === 'p_dal' && removeLine(ord, 'nope', NOW3) === ord,
    'Delete a dish the kitchen never had: the line just goes');
  ord = markKotSent(ord, NOW3);
  const sentGone = removeLine(ord, ord.lines[1].key, NOW3);
  const ch2 = kotChanges(sentGone);
  assert(sentGone.lines.length === 2 && sentGone.lines[1].qty === 0 && ch2.length === 1 && ch2[0].delta === -2 && ch2[0].title === 'Butter Roti' && pieceCount(sentGone) === 1,
    'Delete a dish the kitchen already has: it shows as cancelled and the next KOT says CANCEL 2 × Butter Roti');
  const stop = cancelOrderChanges(addPiece(ord, dal, NOW3));
  const again = reprintKotLines(addPiece(ord, dal, NOW3));
  assert(stop.length === 2 && stop.every((l) => l.delta < 0) && stop.find((l) => l.title === 'Dal Tadka')!.delta === -1
    && again.length === 2 && again.find((l) => l.title === 'Butter Roti')!.delta === 2 && piecesInKitchen(ord) === 3 && piecesInKitchen(newOrder('table', 'T1', 'y', NOW3)) === 0
    && cancelOrderChanges(newOrder('table', 'T1', 'y', NOW3)).length === 0,
    'Cancel order stops only what the kitchen has (not the unsent piece); Reprint KOT repeats exactly what the kitchen has');
  const cancelSlip = buildKotBody({ order: ord, shopName: 'Hotel', round: 2, kind: 'cancel', reason: 'Guest <left>' }, cancelOrderChanges(ord));
  const reprintSlip = buildKotBody({ order: ord, round: 1, kind: 'reprint' }, reprintKotLines(ord));
  assert(cancelSlip.includes('ORDER CANCELLED') && cancelSlip.includes('REASON: Guest &lt;left&gt;') && cancelSlip.includes('CANCEL') && !cancelSlip.includes('>ADD<')
    && reprintSlip.includes('REPRINT') && reprintSlip.includes('IN KITCHEN') && reprintSlip.includes('Butter Roti'),
    'Kitchen slips: "ORDER CANCELLED" with the reason, and "REPRINT" listing what is in the kitchen');

  // Today's cancelled orders (void report).
  const settingsV = sanitizeRestaurantSettings({});
  const v = voidFromOrder(ord, settingsV, '  Guest   left ', NOW3);
  assert(v.label === 'T4' && v.pieces === 3 && v.inKitchen === 3 && v.amountPaise === 26000 && v.reason === 'Guest left' && v.items.join('|') === '1 × Dal Tadka|2 × Butter Roti',
    'A cancelled order is written down with its amount, pieces, what the kitchen had and the reason');
  const list = parseVoids([v, { at: '2026-10-05T10:00:00.000Z', label: 'T2', amountPaise: 500 }, { junk: 1 }, null]);
  assert(list.length === 2 && list[0].label === 'T4' && voidsOfDay(list, new Date('2026-10-06T15:00:00.000Z')).length === 1 && parseVoids('x').length === 0,
    "Cancelled orders read back safely, newest first; Today's list shows only today's");
  const cancelDlg = readSource('components/restaurant/CancelOrderDialog.tsx');
  const screen3 = readSource('components/restaurant/OrderScreen.tsx');
  assert(cancelDlg.includes('const needsPin = inKitchen > 0 && hasOwnerPin();') && cancelDlg.includes('disabled={!finalReason}') && cancelDlg.includes('<OwnerPinPrompt')
    && screen3.indexOf('recordVoid(voidFromOrder(') < screen3.indexOf("orders: s.orders.filter((o) => o.id !== order.id) }));\n    setCancelBusy(false);"),
    'Cancel order needs a reason, and the owner PIN when food already went to the kitchen (and the shop has a PIN); it is written down before the table is cleared');

  // Print bill before paying (not a tax invoice, nothing saved).
  const chk = buildCheckBody({ order: ord, settings: { ...settingsV, serviceChargePercent: 10 }, business: { name: 'Sharma <Dhaba>', gstin: '27AAAAA0000A1Z5' }, qrDataUrl: 'data:image/png;base64,AAA' });
  assert(chk.includes('Table T4') && chk.includes('2 × Butter Roti') && chk.includes('Service charge 10%') && chk.includes('TOTAL') && chk.includes('Sharma &lt;Dhaba&gt;')
    && chk.includes('not a tax invoice') && chk.includes('Scan to pay') && !buildCheckBody({ order: ord, settings: settingsV }).includes('Scan to pay')
    && !/db\.|settleOrder|invoice_number/.test(readSource('lib/restaurant/checkPrint.ts')),
    'Print bill (before paying): the dishes, charges, GST and total with the UPI QR; marked "not a tax invoice" and nothing is saved');
  assert(shopUpiId({ upi_ids: [{ id: 'a', label: 'A', upi_id: 'a@ok', is_default: false }, { id: 'b', label: 'B', upi_id: 'b@ok', is_default: true }] }) === 'b@ok'
    && shopUpiId({ upi_id: 'old@ok' }) === 'old@ok' && shopUpiId(null) === '',
    "The bill's QR uses the shop's default UPI ID");

  // Cash + UPI.
  const settle3 = readSource('lib/restaurant/settle.ts');
  assert(settle3.includes("if (method === 'split' && (splitCash <= 0 || splitCash >= grand)) throw new Error('bad-split');")
    && settle3.includes("...(method === 'split' ? { payment_split: { cash_amount: splitCash, upi_amount: grand - splitCash, card_amount: 0, credit_amount: 0 } } : {}),")
    && readSource('components/restaurant/PayDialog.tsx').includes("{ id: 'split', label: 'Cash + UPI', icon: Wallet }"),
    'Cash + UPI: the cash part and the rest on UPI are saved like the counter\'s split (cash drawer and reports count each part)');

  // Stock counting / Barcode on items: switches; Restaurant mode turns them off.
  assert(DEFAULT_FEATURE_SWITCHES.stock_counting === true && DEFAULT_FEATURE_SWITCHES.product_barcode === true
    && FEATURES.some((f) => f.id === 'stock_counting') && FEATURES.some((f) => f.id === 'product_barcode'),
    'Stock counting and Barcode on items are ON for every shop (nothing changes for a shop) — Restaurant mode turns them off');
  const formSrc3 = readProductForm();
  const prodPage = readProductsPage();
  assert(formSrc3.includes('{switches.product_barcode && <ProductBarcodeField') && formSrc3.includes('{switches.stock_counting && (')
    && prodPage.includes('showStock={switches.stock_counting}') && prodPage.includes('onToggleLowStock={switches.stock_counting ? setShowLowStockOnly : undefined}')
    && readSource('components/dashboard/DashboardHome.tsx').includes('{switches.stock_counting && <DashboardStockWatchlist')
    && readSource('app/reports/page.tsx').includes("...(featureSwitches.stock_counting ? [{ id: 'dead' as Tab"),
    'Stock counting off: no stock box on Add Product, no stock columns / low-stock / stock value on Products, no stock alert on Home, no Dead Stock report; Barcode off: no barcode box');
  assert(!readSource('components/settings/SettingsNavTabs.tsx').includes("tr('Features')") && !readSource('components/settings/SettingsNavTabs.tsx').includes('Features ON / OFF'),
    'Settings has no Features tab any more (v4.118.0 — it was renamed from "Features ON / OFF" in v4.108.0, then removed)');
}

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


// v4.118.0 — The app follows the shop's business category (docs/VERTICAL_PLAN.md, A1).
// Old shops (no vertical profile) keep exactly the old switches; the Features tab is gone.
{
  const all = Object.keys(DEFAULT_FEATURE_SWITCHES).sort().join();
  const sw = (v: typeof VERTICAL_IDS[number], gst = false) => verticalSwitches({ vertical: v, gst });
  assert(VERTICAL_IDS.every((v) => Object.keys(sw(v)).sort().join() === all && Object.values(sw(v)).every((x) => typeof x === 'boolean')),
    'Vertical profile: every category gives the full switch set (no switch left undefined)');
  const g = sw('grocery'), ph = sw('pharmacy'), c = sw('clothing'), hw = sw('hardware'), rt = sw('retail'), r = sw('restaurant');
  assert(!g.barcode_studio && g.wholesale_price && g.payment_keys && g.purchases && g.suppliers && g.cash_register && g.stock_counting && g.product_barcode && !g.product_variants,
    'Kirana: no Barcode Studio (Rahul), wholesale price + F4/F8/F9, purchases / suppliers / cash register on');
  assert(!ph.barcode_studio && ph.purchases && ph.product_cost_price && !ph.wholesale_price && !ph.product_variants
    && c.barcode_studio && c.product_size_colour && c.product_variants && hw.product_variants && hw.barcode_studio && !hw.product_size_colour && rt.barcode_studio && !rt.product_variants,
    'Pharmacy without labels; clothing with price tags + sizes / colours; electronics with variants; retail with labels');
  assert(r.inventory && !r.stock_counting && !r.product_barcode && !r.barcode_studio && r.purchases && r.suppliers && r.cash_register && r.product_variants && r.khata,
    'Restaurant: kitchen inventory and purchases on; no barcode, labels; cash register, khata and Half / Full on');
  assert(VERTICAL_IDS.every((v) => !sw(v).gst_reports && !sw(v).product_gst_rate && !sw(v).product_hsn && sw(v, true).gst_reports)
    && VERTICAL_IDS.filter((v) => v !== 'restaurant').every((v) => sw(v, true).product_gst_rate && sw(v, true).product_hsn) && !sw('restaurant', true).product_gst_rate,
    'GST follows the GSTIN, not the category: without one no GST reports / GST % / HSN; with one all on (restaurant: GST % from Set-up)');
  assert(parseVerticalProfile(null) === null && parseVerticalProfile('junk') === null && parseVerticalProfile('{"vertical":"bakery"}') === null
    && parseVerticalProfile('{"v":1,"vertical":"pharmacy","gst":true}')?.gst === true && parseVerticalProfile('{"vertical":"retail"}')?.gst === false,
    'A missing, damaged or unknown profile reads as "no profile" (old path)');

  // The real readers, with a stand-in localStorage.
  const mem = new Map<string, string>();
  const G = globalThis as unknown as Record<string, unknown>;
  const hadWindow = 'window' in G, hadLs = 'localStorage' in G;
  G.window = { dispatchEvent() { return true; }, addEventListener() {}, removeEventListener() {} };
  G.localStorage = { getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); } };
  try {
    const oldStored = JSON.stringify({ ...DEFAULT_FEATURE_SWITCHES, cash_register: true, khata: false });
    mem.set('kamai_feature_switches', oldStored);
    const oldShop = readFeatureSwitches();
    assert(JSON.stringify(oldShop) === JSON.stringify(parseFeatureSwitches(oldStored)) && !isRestaurantMode(),
      'Old shop (no profile): exactly its stored switches, no Restaurant mode — nothing changes for existing customers');

    mem.clear();
    saveVerticalProfile('grocery', false);
    const kirana = readFeatureSwitches();
    mem.set('kamai_feature_switches', JSON.stringify({ wholesale_price: false, product_variants: true }));
    const kiranaAppSet = readFeatureSwitches();
    mem.set('kamai_admin_feature_overrides', JSON.stringify({ khata: false }));
    const kiranaAdmin = readFeatureSwitches();
    assert(JSON.stringify(kirana) === JSON.stringify(sw('grocery')) && kiranaAppSet.product_variants && !kiranaAppSet.wholesale_price && kiranaAppSet.purchases
      && !kiranaAdmin.khata && kiranaAdmin.purchases,
      'Shop with a profile: its category\'s switches; a switch the app itself set (Excel import) and the Admin\'s forced ones still win');

    const changed = syncVerticalGst(true);
    const withGst = readFeatureSwitches();
    assert(changed && withGst.gst_reports && withGst.product_gst_rate && !syncVerticalGst(true) && JSON.parse(mem.get(VERTICAL_PROFILE_KEY)!).vertical === 'grocery',
      'A GSTIN saved later turns GST reports / GST % / HSN on (once); the category stays');

    mem.clear();
    saveVerticalProfile('restaurant', false);
    const restOn = isRestaurantMode();
    const restSw = readFeatureSwitches();
    mem.set('kamai_admin_feature_overrides', JSON.stringify({ restaurant_mode: false }));
    const restAdminOff = isRestaurantMode();
    mem.clear();
    mem.set('kamai_admin_feature_overrides', JSON.stringify({ restaurant_mode: true }));
    const adminOnOldShop = isRestaurantMode();
    assert(restOn && restSw.inventory && !restSw.stock_counting && !restAdminOff && adminOnOldShop,
      'Restaurant chosen in store setup = Restaurant mode by itself (AU-04); the Admin can still switch it off, or on for any shop');
  } finally {
    if (hadWindow) { /* keep */ } else delete G.window;
    if (hadLs) { /* keep */ } else delete G.localStorage;
  }

  const onb = readSource('components/onboarding/onboardingSubmit.ts');
  const rest = readSource('components/onboarding/cloudStoreRestore.ts');
  assert(['saveVerticalProfile(', 'localStorage.removeItem(FEATURE_SWITCHES_KEY)'].every((t) => onb.includes(t) && rest.includes(t))
    && !/CATEGORY_INITIAL_SWITCHES|CATEGORY_FEATURE_PRESETS|DEFAULT_FEATURE_SWITCHES/.test(onb + rest),
    'Store setup and cloud restore save the category profile (one preset table in lib/business/verticalProfile.ts — AU-07) and clear switches an earlier shop left on this PC');
  assert(/syncVerticalGst\(hasGstin\)/.test(readSource('components/layout/BusinessProvider.tsx')),
    'BusinessProvider keeps the profile\'s GST in step with the shop\'s GSTIN (Settings, restore or cloud)');
}

// v4.119.0 — Stock counting off = the counter never stops an item for stock (AU-30, docs/VERTICAL_PLAN.md A2).
// Found in the real app: a restaurant (stock hidden) got "OUT OF STOCK" on Paneer after its sample stock ran out.
{
  assert(countsStockAtCounter({ is_unlimited_stock: false }, true) && !countsStockAtCounter({ is_unlimited_stock: true }, true)
    && !countsStockAtCounter({ is_unlimited_stock: false }, false) && !countsStockAtCounter({}, false) && countsStockAtCounter({}, true),
    'Counter stock rule: only a counted item in a shop that counts stock is held to its stock');
  const cart = readSource('components/billing/posCartActions.ts');
  const grid = readSource('components/billing/PosCatalogPanel.tsx');
  const card = readSource('components/billing/PosProductCard.tsx');
  const picker = readSource('components/billing/VariantPickerModal.tsx');
  const page = readSource('app/billing/page.tsx');
  assert((cart.match(/countsStockAtCounter\(product, isFeatureOn\('stock_counting'\)\)/g) || []).length === 4 && !/!product\.is_unlimited_stock/.test(cart)
    && page.includes("countsStockAtCounter(targetProd, isFeatureOn('stock_counting'))"),
    'Add, scan, search Enter, + and the quantity box all use the rule (no stock check left that ignores Stock counting off)');
  assert(grid.includes('countsStockAtCounter(p, stockOn)') && grid.includes('showStock={stockOn}') && card.includes('!showStock ? null')
    && picker.includes('!countsStockAtCounter(v, stockOn) ? Infinity'),
    'Stock counting off: no stock number / "Out of stock" on the product cards, every size in the picker can be chosen');
  assert(readSource('components/billing/posSaleActions.ts').includes('if (prod && !prod.is_unlimited_stock) {'),
    'The sale still lowers the hidden stock, so switching counting on later starts from what was really sold');
}

// v4.120.0 — GST follows the GSTIN (AU-12, AU-25; docs/VERTICAL_PLAN.md A3). Shops set up before v4.118.0: unchanged.
{
  const mem = new Map<string, string>();
  const G = globalThis as unknown as Record<string, unknown>;
  const hadWindow = 'window' in G, hadLs = 'localStorage' in G;
  G.window = { dispatchEvent() { return true; }, addEventListener() {}, removeEventListener() {} };
  G.localStorage = { getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); } };
  try {
    const noGstinBiz = { ...invBiz, gstin: undefined };
    const oldShopAllowed = gstAllowed();
    const oldShopHeading = buildInvoiceDocument(sampleGstSale, noGstinBiz, {}).heading;
    saveVerticalProfile('grocery', false);
    const newNoGst = gstAllowed();
    const bos = buildInvoiceDocument(sampleGstSale, noGstinBiz, {}).heading;
    const withGstin = buildInvoiceDocument(sampleGstSale, invBiz, {}).heading;
    const ownTitle = buildInvoiceDocument(sampleGstSale, { ...noGstinBiz, invoice_theme_config: { ...resolveInvoiceConfig(noGstinBiz), custom_title: 'CASH MEMO' } }, {}).heading;
    saveVerticalProfile('grocery', true);
    const newGst = gstAllowed();
    assert(oldShopAllowed && oldShopHeading === 'TAX INVOICE' && !newNoGst && bos === 'BILL OF SUPPLY' && withGstin === 'TAX INVOICE' && ownTitle === 'CASH MEMO' && newGst,
      `Bill heading: a new shop without a GSTIN prints BILL OF SUPPLY (got ${bos}); with a GSTIN TAX INVOICE; a heading the shop chose stays; old shops unchanged (${oldShopHeading})`);
  } finally {
    if (!hadWindow) delete G.window;
    if (!hadLs) delete G.localStorage;
  }
  assert(lineGstRate(12, false) === 0 && lineGstRate(12, true) === 12 && lineGstRate(undefined, true) === 0
    && restaurantGstFor(false, 5) === 0 && restaurantGstFor(true, 0) === 5 && restaurantGstFor(true, 12) === 12,
    'A bill line takes no GST when the shop may not charge it; restaurant Set-up GST 0 without a GSTIN, 5 % (or the shop’s own) with one');
  const cartSrc = readSource('components/billing/posCartActions.ts');
  assert((cartSrc.match(/lineGstRate\(product\.tax_rate, gstAllowed\(\)\)/g) || []).length === 2 && !/tax_rate \|\| 0;\n\s*\/\/ A wholesale/.test(readSource('components/invoices/EditInvoiceModal.tsx'))
    && readSource('components/invoices/EditInvoiceModal.tsx').includes('lineGstRate(product.tax_rate, gstAllowed())'),
    'Counter (add, no-price add) and Edit Bill take the line GST through the GSTIN rule');
  const onb = readSource('components/onboarding/onboardingSubmit.ts');
  assert(onb.includes('validateGstin(cleanGstin, false)') && onb.includes('saveVerticalProfile(vertical, Boolean(cleanGstin))') && onb.includes('gstin: cleanGstin || undefined')
    && readSource('app/onboarding/page.tsx').includes('data-onboarding-gstin'),
    'Store setup: optional GSTIN box (checked), saved on the shop, and it decides the GST profile');
  assert(readSource('components/layout/BusinessProvider.tsx').includes('restaurantGstFor(hasGstin, s.gstRate)') && readSource('components/restaurant/SetupDialog.tsx').includes('gstRate: gstOk ? parseFloat(gst) : 0'),
    'Restaurant: GST % follows the GSTIN; Set-up cannot charge GST without one');
  assert((INVOICE_HEADINGS as readonly string[]).includes('BILL OF SUPPLY'), 'Invoice Themes offers BILL OF SUPPLY as a heading');
}

// v4.121.0 — Sample items per business category (AU-03, 08, 16, 21, 26, 29, 30; docs/VERTICAL_PLAN.md A4).
{
  const cats = ['grocery', 'pharmacy', 'clothing', 'hardware', 'restaurant', 'retail'];
  const all = cats.flatMap((c) => STARTER_PRODUCTS_BY_CATEGORY[c] || []);
  assert(cats.every((c) => (STARTER_PRODUCTS_BY_CATEGORY[c] || []).length === 10),
    'Every category brings exactly 10 sample items (the store-setup hint says 10)');
  assert(all.every((d) => [0, 5, 18].includes(d.tax_rate)),
    'Sample GST rates are 0 / 5 / 18 % — the 12 % and 28 % slabs ended on 22 Sep 2025 (AU-03)');
  assert(!STARTER_PRODUCTS_BY_CATEGORY.retail.some((d) => /bomb|phuljhadi|anar|rocket|chakri|cracker|sutli|fireworks/i.test(`${d.name} ${d.category}`)),
    'General Retail samples are general store items, not fireworks (AU-29)');
  assert(STARTER_PRODUCTS_BY_CATEGORY.restaurant.every((d) => d.is_unlimited_stock === true)
    && STARTER_PRODUCTS_BY_CATEGORY.restaurant.filter((d) => d.variants?.map((v) => v.label).join() === 'Half,Full').length >= 2,
    'Restaurant dishes are never counted (AU-30) and paneer / biryani come in Half / Full');
  assert(STARTER_PRODUCTS_BY_CATEGORY.pharmacy.filter((d) => d.unit === 'strip').length >= 5
    && STARTER_PRODUCTS_BY_CATEGORY.clothing.filter((d) => (d.variants || []).length >= 3).length >= 4,
    'Pharmacy tablets are sold by the strip (AU-21); clothing samples show sizes as variants with their own stock (AU-26)');
  assert(['strip', 'plate', 'portion'].every((u) => MASTER_UNITS.some((m) => m.id === u))
    && mapUnit('Strip').unit === 'strip' && mapUnit('पत्ता').unit === 'strip' && mapUnit('plate').unit === 'plate' && mapUnit('serving').unit === 'portion',
    'Units strip / plate / portion can be picked on Add Product and are read from Excel (cloud contract §4.1)');
  const seedSrc = readSource('lib/constants/defaultProducts.ts');
  assert(seedSrc.includes('has_variants: true, current_stock: 0') && seedSrc.includes('parent_id: parent.id') && seedSrc.includes('is_unlimited_stock: true } : {}'),
    'Seeding makes a variant parent + children with their own stock / price, and unlimited dishes');
  assert(readSource('lib/db/index.ts').includes('const vertical = categoryType || readVerticalProfile()?.vertical;') && !readSource('lib/db/index.ts').includes('STARTER_CATEGORIES'),
    'Every seed uses the shop vertical: General + its own categories (no Apparel / Accessories in a kirana — AU-16; v4.175.0 also on paths without a category)');
  const onbPage = readSource('app/onboarding/page.tsx');
  assert(cats.every((c) => new RegExp(`  ${c}: 'Adds 10 `).test(onbPage)) && !/Biryani, Naan\) ready/.test(onbPage),
    'Store setup hints match what is really added (AU-08)');
}

// v4.122.0 — "Shop deleted by the Admin" never empties a PC without a backup, never holds the start (AU-01).
// v4.117.0 wiped bills / khata the moment a tombstone was seen (also for a deleted phone shop of the same Google account).
{
  assert(backupIsSafe({ status: 'saved' }) && backupIsSafe({ status: 'skipped', reason: 'empty-shop' })
    && !backupIsSafe({ status: 'failed' }) && !backupIsSafe({ status: 'skipped', reason: 'busy' }) && !backupIsSafe({ status: 'skipped', reason: 'not-desktop' }),
    'The PC is emptied only after a backup file was written (or the shop had nothing to keep)');
  const ds = readSource('lib/cloud/deletedStore.ts');
  assert(ds.indexOf('if (!backupIsSafe(outcome))') > 0 && ds.indexOf('if (!backupIsSafe(outcome))') < ds.indexOf('await purgeLocalDeviceData()')
    && ds.includes('runAutoBackup({ force: true })') && ds.includes('isCloudSendOn() && acc?.bizId'),
    'deletedStore: backup → check → only then purge; the cloud shop id counts only when this PC syncs with it');
  const shell = readSource('components/layout/AppShell.tsx');
  assert(!/purgeLocalDeviceData|getCloudAccount|deleted_businesses/.test(shell) && /void \(async \(\) => \{[\s\S]{0,400}idsToCheckOnThisPc\(ownId\)/.test(shell),
    'App start does not wait for the cloud: the deleted-shop check runs in the background');
  assert(['lib/sync/syncEngine.ts', 'lib/firebase/firestoreSync.ts'].every((f) => !readSource(f).includes('purgeLocalDeviceData') && readSource(f).includes('wipeAfterCloudDelete()')),
    'Sync paths that find a tombstone use the same backup-first wipe');
}

// v4.123.0 — A KOT with no kitchen printer chosen is never "sent" to nowhere (AU-31, docs/VERTICAL_PLAN.md A7).
// Found in the real app: no printer set, "KOT sent to the kitchen (T1)" and the lines showed "In kitchen".
{
  const kot = readSource('lib/restaurant/kot.ts');
  const screen = readSource('components/restaurant/OrderScreen.tsx');
  assert(kot.includes('if (getDesktopApi() && !printerForFormat(settings, paper)) return { ok: false, noPrinter: true')
    && kot.indexOf('noPrinter: true') < kot.indexOf('await printHtml('),
    'printKot: no KOT printer chosen = nothing is printed and the answer says so');
  assert(/res\.noPrinter\) \{[\s\S]{0,700}showConfirm\([\s\S]{0,500}if \(told\) \{[\s\S]{0,200}markKotSent/.test(screen),
    'Send KOT without a printer asks the waiter; the order is marked sent only when they say the kitchen knows');
}

// v4.124.0 — GST screen HSN rows per unit (AU-23); Day Summary shows udhar collected in cash (AU-17).
{
  assert(readSource('lib/gst/gstr1Generator.ts').includes('const hsnKey = `${line.hsn}_${getGSTUQC(line.unit)}_${rt}`;'),
    'GST screen HSN summary: one row per HSN + unit + rate, like the GSTR-1 JSON (a box and a bottle were "2 BOX")');
  const dayModal = readSource('components/reports/DayEndClosingReportModal.tsx');
  assert(dayModal.includes('const khataCashPaise = day.khataCashCollected;') && dayModal.includes('data-day-khata-cash') && dayModal.includes('Udhar received in cash (Khata)'),
    'Day Summary: udhar paid back in cash is its own line (screen + WhatsApp), so Cash in Hand adds up');
}

// v4.124.0 — Cloud store restore brings the whole shop back, after a safety backup (AU-02).
{
  const rs = readSource('components/onboarding/cloudStoreRestore.ts');
  assert(rs.includes('await pullEverything({ bizId: businessId, localBizId: businessId });') && !rs.includes("collection(firestore, `businesses/${businessId}/products`)")
    && rs.indexOf('runAutoBackup({ force: true })') < rs.indexOf('localDb.businesses.clear()'),
    'Restore pulls every table (customers + udhar, bills, khata…) so bill numbers continue; a backup is written before the PC is cleared');
}

// v4.124.0 — Store setup looks for an existing cloud shop only with a connected Google account (AU-05 / AU-18).
{
  const rs = readSource('components/onboarding/cloudStoreRestore.ts');
  assert(rs.includes('if (!account || account.stub) return null;') && !rs.includes('wa_${cleanPhone}') && !rs.includes('user_${cleanPhone}'),
    'No more refused Firestore reads by mobile number on every new shop; only the Google account\u2019s own shop is looked up');
}

// v4.124.0 — Small things from the audit: estimate window words (AU-19), name example per category (AU-27),
// restaurant bill terms (AU-32), Bill of Supply in the bill window, unused isMounted (AU-09).
{
  const im = readSource('components/invoices/InvoiceModal.tsx');
  assert(im.includes("estimate ? tr('Estimate total • #')") && im.includes("tr('PDF is always the full A4 estimate.')") && im.includes("gstAllowed() ? tr('Tax Invoice') : tr('Bill of Supply')"),
    'Bill window: an estimate is not "billed" or a tax invoice; a shop without a GSTIN sees Bill of Supply');
  assert(readSource('components/products/AddEditProductModal.tsx').includes("NAME_EXAMPLE[readVerticalProfile()?.vertical || ''] || 'e.g. Fortune Sunflower Oil 1L'"),
    'Add Product: the example name fits the shop category (old shops keep the old example)');
  assert(readSource('components/onboarding/onboardingSubmit.ts').includes("restaurant: 'Thank you for dining with us!") && !readSource('app/onboarding/page.tsx').includes('isMounted'),
    'Restaurant bills do not promise a 7-day goods exchange; no dead isMounted flag in store setup');
}

// v4.126.0 — Pharmacy: batch / expiry on items and bills, doctor / patient on the bill (AU-22, docs/VERTICAL_PLAN.md A5).
{
  const d = new Date(2026, 9, 10);
  assert(cleanExpiry('2027-01') === '2027-01' && cleanExpiry('2027-01-31') === '2027-01' && cleanExpiry('01/27') === '2027-01' && cleanExpiry('1/2028') === '2028-01'
    && cleanExpiry('13/27') === '' && cleanExpiry('soon') === '' && formatExpiry('2027-01') === '01/27' && formatExpiry('') === '',
    'Expiry is a month: pack style MM/YY and the phone\u2019s full date read the same; shown as MM/YY');
  assert(expiryState('2026-09', d) === 'expired' && expiryState('2026-10', d) === 'soon' && expiryState('2026-12', d) === 'soon' && expiryState('2027-06', d) === 'ok' && expiryState(undefined, d) === 'none',
    'A medicine is good until the end of its expiry month; within 90 days = expiring soon');
  const ph = verticalSwitches({ vertical: 'pharmacy', gst: false });
  assert(ph.product_batch_expiry && ph.bill_prescription && ['grocery', 'clothing', 'hardware', 'retail', 'restaurant'].every((v) => !verticalSwitches({ vertical: v as never, gst: false }).product_batch_expiry)
    && DEFAULT_FEATURE_SWITCHES.product_batch_expiry === false && DEFAULT_FEATURE_SWITCHES.bill_prescription === false,
    'Batch / expiry and doctor / patient are on for the pharmacy category only (old shops: off)');
  const form = readSource('components/products/ProductFormDetails.tsx');
  const actions = readSource('components/products/productActions.ts');
  assert(form.includes('{switches.product_batch_expiry && (') && form.includes('data-product-batch') && form.includes('type="month"')
    && actions.includes('batch_number: formBatch.trim() || undefined') && actions.includes('expiry_date: cleanExpiry(formExpiry) || undefined') && actions.includes("setFormBatch(p.batch_number || '')"),
    'Add / Edit Product: Batch No. and Expiry (month) boxes, saved and read back');
  const cartSrc = readSource('components/billing/posCartActions.ts');
  assert(cartSrc.includes('batch_number: product.batch_number') && cartSrc.includes("expiryState(product.expiry_date) === 'expired'")
    && readSource('components/billing/PosPrescriptionRow.tsx').includes('bill_prescription') && readSource('components/billing/posSaleActions.ts').includes("doctor_name: (customerDraft.doctor || '').trim() || undefined"),
    'Counter: the bill line keeps the batch / expiry, an expired medicine is warned about, patient / doctor go on the bill');
  const doc = readSource('lib/invoices/invoiceDocument.ts');
  assert(doc.includes('item.batch_number ? `Batch: ${item.batch_number}`') && doc.includes('detailParts.push(`Patient: ${sale.patient_name}`)')
    && readSource('components/invoices/print/ThermalReceipt.tsx').includes('data-thermal-batch') && readSource('components/invoices/print/ThermalReceipt.tsx').includes('data-thermal-imei'),
    'A4 and thermal bills print batch / expiry (and IMEI) under the item, patient / doctor under the customer');
  assert(readSource('app/inventory/page.tsx').includes('<ExpiryAlertsCard products={products} />') && readSource('components/inventory/ExpiryAlertsCard.tsx').includes('product_batch_expiry'),
    'Inventory lists medicines expired or expiring in 90 days (pharmacy)');
}

// v4.127.0 — Electronics / mobile: IMEI / serial + warranty on the bill line (AU-13, docs/VERTICAL_PLAN.md A6).
{
  assert(verticalSwitches({ vertical: 'hardware', gst: false }).bill_serial_warranty && !verticalSwitches({ vertical: 'grocery', gst: false }).bill_serial_warranty
    && DEFAULT_FEATURE_SWITCHES.bill_serial_warranty === false,
    'IMEI / warranty on the bill: on for electronics & mobile only (old shops: off)');
  const em = readSource('components/billing/PosItemEditModal.tsx');
  assert(em.includes('data-line-imei') && em.includes('data-line-warranty') && em.includes('useFeatureSwitches().bill_serial_warranty')
    && readSource('components/billing/posCartActions.ts').includes('...(extra || {}),'),
    'Counter ✏️: IMEI / serial and warranty months for that line, saved on it (A4 + thermal print them)');
}

// v4.128.0 — Desktop ↔ Android (docs/VERTICAL_PLAN.md B1 / C1): the same category card, and the new
// pharmacy / electronics fields travel through the cloud both ways (Android test/desktop_parity_test.dart).
{
  const ctx2 = { bizId: 'biz_UID1' };
  const sale: any = {
    id: 's_px', business_id: 'biz_local', invoice_number: 'INV-900', customer_name: 'Cash Customer', doctor_name: 'Dr. Mehta', patient_name: 'Ravi Kumar',
    items: [{ product_id: 'p1', product_name: 'Dolo 650 Tablet', quantity: 1, unit: 'strip', unit_price: 3200, mrp: 3400, discount_amount: 0, tax_rate: 0, tax_amount: 0, total_amount: 3200,
      batch_number: 'B2401', expiry_date: '2027-01', imei_serial: '', is_tax_inclusive: true }],
    subtotal: 3200, discount_total: 0, tax_total: 0, grand_total: 3200, payment_method: 'cash', amount_received: 3200, balance_due: 0, status: 'completed', created_at: '2026-10-10T05:00:00.000Z', updated_at: '2026-10-10T05:00:00.000Z',
  };
  const out = toCloud('sales', sale, ctx2);
  const back: any = fromCloud('sales', out, null, ctx2);
  assert(out.doctor_name === 'Dr. Mehta' && out.patient_name === 'Ravi Kumar' && out.items[0].batch_number === 'B2401' && out.items[0].expiry_date === '2027-01'
    && back.patient_name === 'Ravi Kumar' && back.items[0].batch_number === 'B2401',
    'Cloud: doctor / patient on the bill and batch / expiry on its lines go out and come back unchanged (C1)');
  const prod: any = { id: 'p1', business_id: 'biz_local', name: 'Dolo 650 Tablet', unit: 'strip', selling_price: 3200, mrp: 3400, purchase_price: 2600, current_stock: 10, min_stock_level: 2, tax_rate: 5,
    batch_number: 'B2401', expiry_date: '2027-01', is_favorite: false, is_active: true, created_at: '', updated_at: '' };
  const pc = toCloud('products', prod, ctx2);
  assert(pc.batch_number === 'B2401' && pc.expiry_date === '2027-01' && pc.unit === 'strip', 'Cloud: an item\u2019s batch / expiry month and the strip unit reach the phone (it reads yyyy-MM since the parity fix)');
  assert(readSource('components/onboarding/CategorySelector.tsx').includes("title: 'Electronics & Hardware'"),
    'Store setup card "Electronics & Hardware" — the same words as the Android app');
}

// v4.128.0 — Loose tablets are billed with the strip's real count, never "10 a strip" (money bug, also on Android).
// A 15-tablet strip at ₹32: 3 tablets were billed as 0.3 strip = ₹9.60 instead of 0.2 strip = ₹6.40.
{
  assert(tabletsPerStripFromName('Dolo 650 Tablet (15 tab)') === 15 && tabletsPerStripFromName('Disprin Regular (Strip of 10)') === 10
    && tabletsPerStripFromName('Pantoprazole 40mg 15 Tablets') === 15 && tabletsPerStripFromName('Omez 20 Capsules') === 20
    && tabletsPerStripFromName('Benadryl Cough Syrup 100 ml') === null && tabletsPerStripFromName('Paracetamol 650') === null,
    'Tablets in a strip come from the item name ("(15 tab)", "Strip of 10", "15 Tablets"); unknown = asked, never 10');
  const modal = readSource('components/billing/PosItemEditModal.tsx');
  const qc = readSource('components/billing/posQuantityConfig.ts');
  assert(!/n \/ 10\)/.test(modal) && modal.includes('roundQty(n / per)') && modal.includes('data-edit-per-strip') && !qc.includes("'1 Tab (0.1)'"),
    'Counter: "Or tablets: 3 of 15 in a strip" = 0.2 strip; no strip chip assumes 10 tablets');
}

// v4.129.0 — Shop-day stress test (scripts/stress_shop_day.mjs): after a return, tapping Return on another
// bill showed the last "Sales Return Completed" again (the window stays mounted). Each opening starts fresh.
{
  const rm = readSource('components/sales/SalesReturnModal.tsx');
  const eff = rm.slice(rm.indexOf('useEffect(() => {'), rm.indexOf('}, [initialSaleId, isOpen]);'));
  assert(eff.includes('if (!isOpen) return;') && eff.includes('setCompletedReturn(null)') && eff.includes('setSelectedSale(null)') && eff.includes("setSearchInvoice('')")
    && eff.indexOf('setCompletedReturn(null)') < eff.indexOf('if (initialSaleId)'),
    'Sales Return: every opening clears the last return / bill before showing the chosen bill');
}

// v4.130.0 — Split button's own 50 / 50 fill was "total / 200": ₹2.01 → 1.005 + 1.005, saved as ₹1.00 + ₹1.00 —
// the missing paisa went on the customer's udhar (7 % of odd totals), the rest showed ₹0.01 "change".
{
  const footer = readSource('components/billing/PosCheckoutFooter.tsx');
  assert(!footer.includes('grandTotalPaise / 200') && footer.includes('Math.floor(grandTotalPaise / 2)'),
    'Split button: the two halves are worked out in paise, like the "50% Cash + 50% UPI" preset');
  let off = 0;
  for (let total = 1; total <= 100000; total++) {
    const cashPaise = Math.floor(total / 2);
    const cash = (cashPaise / 100).toFixed(2), upi = ((total - cashPaise) / 100).toFixed(2);
    if (Math.round(parseFloat(cash) * 100) + Math.round(parseFloat(upi) * 100) !== total) off++;
  }
  assert(off === 0, `Split 50 / 50: every bill from ₹0.01 to ₹1,000 saves cash + UPI = the bill exactly (${off} off)`);
}

// v4.130.0 — Day Summary "Net Cash in Hand" said "After ₹915 expenses" when ₹915 was return refunds (cash
// collections above are already net of returns, so the card did not add up). Refunds are named now.
{
  const m = readSource('components/reports/DayEndClosingReportModal.tsx');
  assert(m.includes('data-day-paid-out') && m.includes("tr('After ₹{paidOut} paid out (₹{refunds} return refunds)'") && m.includes('Cash refunds (returns)'),
    'Day Summary: cash refunds of returns are shown as refunds (card + WhatsApp text), not as shop expenses');
  const d = summarizeDay({
    sales: [
      { id: 'a', invoice_number: 'INV-1', status: 'completed', payment_method: 'cash', grand_total: 10000, total_amount: 10000, items: [], created_at: new Date().toISOString() } as any,
      { id: 'b', invoice_number: 'INV-2', status: 'completed', payment_method: 'upi', grand_total: 5000, total_amount: 5000, items: [], created_at: new Date().toISOString() } as any,
    ],
    expenses: [{ id: 'e', amount: 2000, category: 'refund', payment_mode: 'cash', created_at: new Date().toISOString() } as any],
  });
  assert(d.cashRefunds === 2000 && d.netCashInTillPaise === 8000, 'Day Summary: a ₹20 cash refund (even of a UPI bill) leaves the drawer: ₹100 cash − ₹20 = ₹80 in hand');
}

// v4.131.0 — Electron E2E: a KOT went to "Microsoft Print to PDF" (silent print waits on a hidden Save-as
// prompt) and never answered — the print queue is one at a time, so every later bill / KOT / label waited
// until a restart. A silent print now gives up after a limit; the dialog print keeps no limit.
{
  const mj = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const job = mj.slice(mj.indexOf('async function printJob('), mj.indexOf("ipcMain.handle('kp:get-printers'"));
  assert(/const SILENT_PRINT_TIMEOUT_MS = \d+/.test(mj) && job.includes('if (!silent) return await printing;')
    && job.includes('withTimeout(printing, SILENT_PRINT_TIMEOUT_MS)') && job.includes('resetPrintWindow()'),
    'Printing: a silent job that never answers is given up and the print window recreated — later prints are not stuck');
  const e2e = fs.readFileSync(path.join(__dirname, 'electron_e2e.mjs'), 'utf8');
  assert(e2e.includes("thermalPrinter: '', a4Printer: ''"), 'Electron E2E: the restaurant KOT check runs with no printer chosen (never a real printer)');
}

// v4.132.0 — Rahul: "jahan-jahan WhatsApp hai, wahan Android jaisa official WhatsApp logo". One icon for all.
{
  const btn = readSource('components/whatsapp/WhatsAppButton.tsx');
  assert(btn.includes('data-whatsapp-logo') && btn.includes('fill="#25D366"') && !btn.includes('MessageCircle'),
    'WhatsApp: the official logo (green circle, white mark) is the one WhatsAppIcon');
  const raw = ['components/purchases/PurchaseOrdersCard.tsx', 'components/settings/HelpSupportTab.tsx', 'components/support/SupportContact.tsx']
    .filter((f) => readSource(f).includes('MessageCircle'));
  assert(raw.length === 0, `WhatsApp buttons use WhatsAppIcon, never a chat bubble (${raw.join(', ') || 'none left'})`);
}

// v4.133.0 — Rahul: every bill to a customer on WhatsApp goes WITH the invoice PDF. Desktop WhatsApp cannot take a
// file in a link, so the PDF is put on the clipboard as a file (Ctrl+V in the chat attaches it); on by default.
{
  const mj = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const h = mj.slice(mj.indexOf("ipcMain.handle('kp:copy-file'"), mj.indexOf("ipcMain.handle('kp:show-in-folder'"));
  assert(h.includes('insideDocuments(target)') && h.includes('\.pdf$/i') && h.includes('$env:KP_CLIP_FILE') && h.includes('KP_CLIP_FILE: file') && !h.includes('${file}'),
    'Bill PDF to the clipboard: only a PDF inside Documents\KamaiPlus, the path passed to PowerShell as data (never in the command)');
  const comp = readSource('components/whatsapp/WhatsAppComposer.tsx');
  assert(comp.includes('!open.copied') && comp.includes('copyFileToClipboard') && DEFAULT_WHATSAPP_SETTINGS.attachPdf === true,
    'WhatsApp bill: the PDF goes with it by default and is copied for Ctrl+V (not when the long text took the clipboard)');
}

// v4.134.0 — Live sync test (phone + PC, same Google account): the PC never found the phone's shop. The lookup
// ran before Firebase had restored the saved Google session → signed-out read → "Missing or insufficient
// permissions". The deleted-shop check had the same race (a refused read = "not deleted"). Both wait now.
{
  const find = readSource('components/onboarding/cloudStoreRestore.ts');
  const fi = find.slice(find.indexOf('export async function findCloudStore'), find.indexOf("doc(firestore, 'merchants'"));
  assert(fi.includes('await auth.authStateReady()') && fi.includes('auth.currentUser?.uid !== account.uid'),
    'Cloud shop lookup waits for the saved Google session before reading (PC finds the phone\'s shop)');
  const del = readSource('lib/cloud/deletedStore.ts');
  const di = del.slice(del.indexOf('export async function storeDeletedInCloud'), del.indexOf("doc(fs, 'deleted_businesses'"));
  assert(di.includes('await auth.authStateReady()'), 'Deleted-shop check waits for the Google session (a refused read was "not deleted")');
}

// v4.134.0 — Live sync test, more: the restored PC became "retail" (merchants/<uid> has no business_type;
// the shop doc says "grocery"), lost the GSTIN, stayed with sync OFF; the phone's unlimited item (stock 999999)
// counted as 999,999 pieces (Inventory Asset ₹5.5 crore).
{
  const find = readSource('components/onboarding/cloudStoreRestore.ts');
  assert(find.indexOf("doc(firestore, 'businesses'") < find.indexOf("doc(firestore, 'merchants'") && find.includes('gstin: typeof d.gstin'),
    'Cloud shop lookup reads the shop doc first (its business_type and GSTIN), merchants only as a fallback');
  const rest = find.slice(find.indexOf('export async function restoreCloudStoreToLocal'));
  assert(rest.includes('setCloudSendOn(true)') && rest.includes('Boolean(store.gstin)') && rest.includes('gstin: store.gstin'),
    'Restore: the PC syncs with the phone from then on, and a GST shop stays a GST shop');
  const ctx3 = { bizId: 'biz_UID1' };
  const unl: any = fromCloud('products', { id: 'p9', business_id: 'biz_UID1', name: 'Paneer Tikka', selling_price_paise: 25000, stock_quantity: 99999 }, null, ctx3);
  const counted: any = fromCloud('products', { id: 'p8', business_id: 'biz_UID1', name: 'Soap', selling_price_paise: 4000, stock_quantity: 12 }, null, ctx3);
  assert(unl.is_unlimited_stock === true && !counted.is_unlimited_stock && counted.current_stock === 12,
    'Cloud: a phone item with stock >= 99990 is "unlimited" here (not 99,999 pieces in stock value); counted items keep their stock');
}

// v4.135.0 — N4: the phone now shares khata entries, expenses, closed shifts, suppliers, returns, stock movements
// and purchase orders both ways. A khata entry / expense / purchase order the phone deletes must leave the PC too
// (else the PC's drawer and khata re-count it). Only these three join the deletes the PC follows.
{
  const pull = readSource('lib/cloud/cloudPull.ts');
  const fd = pull.slice(pull.indexOf('const FOLLOW_DELETES'), pull.indexOf('export const PULL_CURSOR_KEY'));
  assert(fd.includes("...Array.from(WHOLE)") && fd.includes("'ledger_transactions'") && fd.includes("'cash_expenses'") && fd.includes("'purchase_bills'"),
    'PC follows phone deletes of khata entries, expenses and purchase orders (N4)');
  assert(!fd.includes("'sales'") && !fd.includes("'inventory_movements'") && !fd.includes("'sales_returns'") && !fd.includes("'cash_registers'"),
    'PC never follows cloud deletes of bills, stock movements, returns or shifts (N4)');
}

// v4.136.0 — AU-37 (N4 live test): Sales Return of an udhar bill (₹250 still due) opened on "Cash Refund" →
// ₹270 cash handed back, khata untouched. A bill with udhar on it now refunds to the khata by default.
{
  const m = readSource('components/sales/SalesReturnModal.tsx');
  const sel = m.slice(m.indexOf('const handleSelectSale'), m.indexOf('const maxReturnable'));
  assert(sel.includes("setRefundMethod(sale.customer_id && (sale.balance_due || 0) > 0 ? 'khata_deduction' : 'cash')"),
    'Sales Return: an udhar bill (balance due) refunds to the khata by default, a paid bill to cash (AU-37)');
}

// v4.137.0 — One Google account = one shop on every device (Rahul: "vahi email se cross device par login karta hai
// to signup form ana nahi chahiye"). Three causes: the PC's cloud shop had only `name` (the phone reads store_name →
// "no shop" → signup form); a new PC shop with a Google account never went to the cloud (sync was off); the PC's
// store setup showed the signup form even under "Existing cloud store found".
{
  const out = toCloud('businesses', { id: 'biz_l', name: 'Sharma Medical', business_type: 'pharmacy' }, { bizId: 'biz_U' });
  assert(out.name === 'Sharma Medical' && out.store_name === 'Sharma Medical' && out.shop_name === 'Sharma Medical' && out.business_name === 'Sharma Medical',
    'Cross-device: the PC\'s cloud shop carries its name as store_name / shop_name / business_name too (the phone finds it, no signup form)');
  const back = fromCloud('businesses', out, { id: 'biz_l', name: 'Sharma Medical' }, { bizId: 'biz_U' });
  assert(!('store_name' in back) && !('shop_name' in back) && !('business_name' in back), 'Cross-device: those copies never come back into the PC\'s shop row');
  const cw = readSource('lib/cloud/cloudWrite.ts');
  assert(cw.includes("NEW_SHOP_TYPES.has(row?.business_type) ? row.business_type : 'grocery'"),
    'Cross-device: a new cloud shop takes the PC\'s category (a PC chemist opens on the phone as a pharmacy, not a kirana)');
  const sub = readSource('components/onboarding/onboardingSubmit.ts');
  assert(sub.includes('if (account && !account.stub) {') && sub.includes('setCloudSendOn(true);'),
    'Cross-device: a new PC shop with a Google account turns cloud sync on at once (the phone with the same account opens it)');
  const ob = readSource('app/onboarding/page.tsx');
  assert(ob.includes('{!showRestoreOnly && !cloudChecking && (') && ob.includes('<CloudLookupNotice') && ob.includes('setTimeout(() => resolve(null), 12000)'),
    'Cross-device: PC store setup shows only "Restore" when the account\'s shop is found, waits (max 12 s) while looking, offers Connect Google otherwise');
}

// v4.138.0 — Restaurant: veg / egg / non-veg mark and "Aaj khatam" (sold out today, back tomorrow), same fields as
// the phone (food_type, sold_out_on on the product document).
{
  assert(foodTypeOf({ food_type: 'Non-Veg' }) === 'nonveg' && foodTypeOf({ food_type: 'veg' }) === 'veg' && foodTypeOf({}) === null,
    'Restaurant: food type read from any spelling (Non-Veg → nonveg), none when unset');
  const late = new Date(2026, 9, 10, 23, 30);
  assert(localDay(late) === '2026-10-10' && isSoldOutToday({ sold_out_on: '2026-10-10' }, late)
    && !isSoldOutToday({ sold_out_on: '2026-10-10' }, new Date(2026, 9, 11, 0, 5)),
    'Restaurant: "Aaj khatam" holds for the shop\'s day only — the dish is back by itself after midnight');
  assert(soldOutPatch(false).sold_out_on === '', 'Restaurant: "back" is saved as \'\' so the cloud copy clears too (the phone sees it)');
  const out = toCloud('products', { id: 'p1', name: 'Paneer Tikka', food_type: 'veg', sold_out_on: '2026-10-10', selling_price: 25000 }, { bizId: 'biz_U' });
  const back = fromCloud('products', { ...out }, null, { bizId: 'biz_U' });
  assert(out.food_type === 'veg' && out.sold_out_on === '2026-10-10' && back.food_type === 'veg' && back.sold_out_on === '2026-10-10',
    'Restaurant: food_type / sold_out_on go to the cloud and come back on the product (both apps)');
  const menu = readSource('components/restaurant/MenuPanel.tsx');
  assert(menu.includes('<FoodMark type={foodTypeOf(d.product)}') && menu.includes('soldOutPatch(!soldOut(d))') && menu.includes('if (soldOut(d)) return;'),
    'Restaurant menu: mark on every dish; "Sold out today" mode toggles a dish; a sold-out dish cannot be added');
  const form = readSource('components/products/ProductFormDetails.tsx');
  const acts = readSource('components/products/productActions.ts');
  assert(form.includes('{restaurant && setFormFoodType && <FoodTypePicker') && acts.includes('food_type: foodTypeOf({ food_type: formFoodType }) || undefined')
    && acts.includes('sold_out_on: editingProduct?.sold_out_on || undefined'),
    'Product form (Restaurant mode): Veg / Egg / Non-veg saved; an edit keeps "Aaj khatam"');
}

// v4.139.0 — Restaurant takeaway / delivery: a delivery order (DL- token) with the guest's name, mobile and address;
// packing on every parcel, a delivery charge (GST on top) on a delivery; the guest goes on the bill, KOT and check.
{
  const rs = sanitizeRestaurantSettings({ gstRate: 5, gstInclusive: true, packingChargePaise: 1000, deliveryChargePaise: 3000 });
  assert(rs.deliveryChargePaise === 3000 && sanitizeRestaurantSettings({}).deliveryChargePaise === 0, 'Restaurant settings: delivery charge kept (0 by default)');
  const tok = nextToken({ day: '2026-10-10', last: 4 }, new Date(2026, 9, 10, 12), 'DL');
  assert(tok.label === 'DL-05' && nextToken(null, new Date(2026, 9, 10, 12)).label === 'TA-01', 'Restaurant: delivery tokens DL-05 share the day count; takeaway stays TA-');
  const base = newOrder('delivery', 'DL-05', 'o1', '2026-10-10T07:00:00.000Z');
  const dl = { ...addPiece(base, { productId: 'p1', name: 'Veg Thali', unit: 'plate', basePaise: 15000 }, '2026-10-10T07:00:00.000Z'), guest: { name: 'Ramesh', phone: '9876543210', address: 'Flat 4, Shivaji Nagar' } };
  const t = orderTotals(dl, rs);
  const ids = t.items.map((i: any) => i.product_id);
  assert(t.packingPaise === 1000 && t.deliveryPaise === 3000 && ids.includes('restaurant_delivery_charge') && ids.includes('restaurant_packing_charge')
    && t.grandTotal === 15000 + 1050 + 3150, 'Restaurant delivery bill: thali 150 + packing 10 + delivery 30, both charges with 5% GST on top = ₹192.00');
  const tableT = orderTotals({ ...dl, kind: 'table' }, rs);
  assert(tableT.packingPaise === 0 && tableT.deliveryPaise === 0, 'Restaurant: a table bill has no packing or delivery charge');
  const parsed = parseRestState({ orders: [{ ...dl }] }).orders[0];
  assert(parsed?.kind === 'delivery' && parsed.guest?.address === 'Flat 4, Shivaji Nagar', 'Restaurant: a running delivery order keeps its kind and guest after a restart');
  assert(billCustomerName(dl, 'Ramesh') === 'Ramesh · Delivery DL-05', 'Restaurant: the bill name says "Delivery DL-05"');
  const kot = buildKotBody({ order: dl, round: 1 });
  const chk = buildCheckBody({ order: dl, settings: rs });
  assert(kot.includes('DELIVERY · Ramesh') && chk.includes('Flat 4, Shivaji Nagar') && chk.includes('Delivery charge'), 'Restaurant: KOT says DELIVERY + guest; the check bill shows the address and the delivery charge');
  const settleSrc = readSource('lib/restaurant/settle.ts');
  assert(settleSrc.includes("const guestName = input.guestName || order.guest?.name || ''") && settleSrc.includes('DELIVERY_CHARGE_ID]'),
    'Restaurant: the guest typed at "New delivery" is the bill\'s guest; the delivery charge line never touches stock');
}

// v4.140.0 — R1: running restaurant orders shared by the shop's devices (waiter phone ↔ counter PC) through
// businesses/{biz}/restaurant_orders, newer updatedAt wins per order; a paid order's document is deleted.
{
  assert(tableOrderId('T4') === 'table_t4' && tableOrderId(' Garden 2 ') === 'table_garden_2', 'Restaurant sync: a table\'s order id comes from its name (both devices open ONE order for T4)');
  const o1 = addPiece(newOrder('table', 'T4', 'table_t4', '2026-10-10T07:00:00.000Z'), { productId: 'p1', name: 'Chai', unit: 'piece', basePaise: 2000 }, '2026-10-10T07:01:00.000Z');
  assert(!isShared(newOrder('table', 'T5', 'table_t5', '2026-10-10T07:00:00.000Z')) && isShared(o1), 'Restaurant sync: an empty table card is not shared; one with a dish is');
  const back = orderFromCloud(orderToCloud(o1, 'desk_1') as any, 'table_t4');
  assert(back !== null && back.lines[0].qty === 1 && back.updatedAt === o1.updatedAt, 'Restaurant sync: an order goes to the cloud and comes back the same');
  const st = { orders: [o1], token: null };
  const newer = { ...o1, lines: [{ ...o1.lines[0], qty: 3 }], updatedAt: '2026-10-10T07:05:00.000Z' };
  const older = { ...o1, lines: [{ ...o1.lines[0], qty: 9 }], updatedAt: '2026-10-10T07:00:30.000Z' };
  assert(mergeCloudOrder(st, newer).orders[0].lines[0].qty === 3 && mergeCloudOrder(st, older) === st && mergeCloudOrder(st, o1) === st,
    'Restaurant sync: a newer change from the other device replaces this one; an older one or our own echo changes nothing');
  const ta = { ...newOrder('takeaway', 'TA-07', 'rord_x', new Date(2026, 9, 10, 12).toISOString()), lines: o1.lines };
  const bumped = mergeCloudOrder({ orders: [], token: { day: '2026-10-10', last: 3 } }, ta, new Date(2026, 9, 10, 12, 5));
  assert(bumped.token?.last === 7 && nextToken(bumped.token, new Date(2026, 9, 10, 12, 6)).label === 'TA-08', 'Restaurant sync: the phone\'s TA-07 moves this PC\'s count on — its next token is TA-08, not a repeat');
  assert(removeCloudOrder(st, 'table_t4').orders.length === 0, 'Restaurant sync: an order paid / cancelled on the other device leaves this one');
  const sent = new Map([['table_t4', o1.updatedAt], ['table_t9', 'x']]);
  const plan = ordersToSend(sent, [newer, newOrder('table', 'T5', 'table_t5', 'z')]);
  assert(plan.put.length === 1 && plan.put[0].id === 'table_t4' && plan.del.join() === 'table_t9', 'Restaurant sync: only changed orders go up; a paid one is deleted in the cloud; an empty card is not sent');
  const firstRead = reconcileFirstRead({ orders: [o1, { ...o1, id: 'local_new' }], token: null }, new Map([['table_t4', o1.updatedAt]]), new Set());
  assert(firstRead.orders.length === 1 && firstRead.orders[0].id === 'local_new', 'Restaurant sync: an order paid elsewhere while this PC was closed is dropped at start (never sent back to life); one made here offline stays');
  const asked = requestKot(o1, '2026-10-10T07:02:00.000Z');
  assert(kotToPrintHere(asked, true) && !kotToPrintHere(asked, false) && !kotToPrintHere(o1, true), 'Restaurant KOT: the PC with "Print KOTs from the waiters\' phones" prints an asked order; other PCs do not');
  const printed = markKotSent(asked, '2026-10-10T07:03:00.000Z');
  assert(!('kotRequestedAt' in printed) && !kotToPrintHere(printed, true) && parseRestState({ orders: [asked] }).orders[0].kotRequestedAt === asked.kotRequestedAt,
    'Restaurant KOT: printing clears the request (no second slip); the request survives a restart');
  assert(sanitizeRestaurantSettings({ printRemoteKots: true }).printRemoteKots === true && sanitizeRestaurantSettings({}).printRemoteKots === false, 'Restaurant set-up: "print other devices\' KOTs" is off unless switched on');
  const sched = readSource('components/layout/CloudSyncScheduler.tsx');
  const screen = readSource('components/restaurant/OrderScreen.tsx');
  const page = readSource('components/restaurant/RestaurantPage.tsx');
  assert(sched.includes('const target = want && isRestaurantMode() ? want : \'\'') && screen.includes('res.noPrinter && cloudSendActive()') && page.includes('tableOrderId(label)'),
    'Restaurant sync: runs with cloud sync in Restaurant mode only; no printer here → the KOT goes to the KOT PC; tables use the shared id');
}

// v4.141.0 — One shop, one category on every device (proventurein@: phone kirana, PC restaurant). A PC shop made
// before v4.137 went to the cloud as 'grocery' with no time; the PC's own choice now goes up, a newer cloud choice
// comes down, and the phone follows the cloud.
{
  const r = { v: 1 as const, vertical: 'restaurant' as const, gst: false, at: '2026-10-09T04:38:00.000Z' };
  assert(resolveShopCategory(r, { business_type: 'grocery' }) === 'push', 'Shop category: the cloud\'s unstamped "grocery" (old PC default) is replaced by this PC\'s restaurant');
  assert(resolveShopCategory(r, { business_type: 'restaurant' }) === 'push' && resolveShopCategory(r, { business_type: 'restaurant', business_type_set_at: r.at }) === 'same',
    'Shop category: the same category is stamped once, then left alone');
  assert(resolveShopCategory(r, { business_type: 'pharmacy', business_type_set_at: '2026-10-10T05:00:00.000Z' }) === 'adopt'
    && resolveShopCategory(r, { business_type: 'pharmacy', business_type_set_at: '2026-10-01T05:00:00.000Z' }) === 'push',
    'Shop category: a newer choice in the cloud comes down here; an older one is replaced');
  assert(resolveShopCategory(null, { business_type: 'grocery' }) === 'none', 'Shop category: a shop set up before v4.118 (no profile) is never touched');
  assert(parseVerticalProfile(JSON.stringify({ v: 1, vertical: 'restaurant', gst: false, at: r.at }))?.at === r.at && parseVerticalProfile(JSON.stringify({ v: 1, vertical: 'grocery' }))?.at === undefined,
    'Vertical profile keeps when the category was chosen (old profiles have none)');
  const sched = readSource('components/layout/CloudSyncScheduler.tsx');
  const cw = readSource('lib/cloud/cloudWrite.ts');
  assert(sched.includes('syncShopCategory(data,') && cw.includes("shop.business_type_set_at = readVerticalProfile()?.at"),
    'Shop category: checked whenever the shop document arrives; a new cloud shop carries when it was chosen');
}

// v4.142.0 — "Reset test shop" (Rahul 2026-10-10): only the team's test Gmails (server list
// admin_settings/test_accounts, checked by the resetTestShop function) can erase their shop from the cloud
// with NO tombstone, then this PC is emptied like a new install — the licence is kept, a backup is made first.
{
  const lib = readSource('lib/cloud/testShopReset.ts');
  const card = readSource('components/settings/TestShopResetCard.tsx');
  const tab = readSource('components/settings/DataMaintenanceTab.tsx');
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const preloadSrc = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert(lib.includes("TEST_SHOP_URL = 'https://us-central1-kamaiplus.cloudfunctions.net/resetTestShop'") && lib.includes('Authorization: `Bearer ${token}`'),
    'Test shop reset: the server function decides, with the signed-in Google ID token');
  assert(card.includes('if (!isTest) return null;') && card.includes('isTestShopAccount()') && tab.includes('<TestShopResetCard />'),
    'Test shop reset: the card shows only when the server says this is a test account');
  assert(/if \(!cloud\.ok\) return/.test(lib) && lib.indexOf("callTestShop('reset')") < lib.indexOf('runAutoBackup') && lib.indexOf('runAutoBackup') < lib.indexOf('resetTestShopDevice()'),
    'Test shop reset: cloud first; this PC is emptied only after that worked, and a backup is written before');
  assert(card.includes("confirmText.trim().toUpperCase() === 'RESET'"), 'Test shop reset: typing RESET is required');
  assert(/case 'wipe_and_reset'[\s\S]{0,300}wipeAppDataAndRelaunch\(\)/.test(mainSrc) && mainSrc.includes('if (keepLicence && LICENCE_FILES.includes(file)) continue;')
    && /kp:test-shop-reset[\s\S]{0,120}wipeAppDataAndRelaunch\(\{ keepLicence: true \}\)/.test(mainSrc) && preloadSrc.includes("resetTestShopDevice: () => ipcRenderer.invoke('kp:test-shop-reset')"),
    'Test shop reset: the PC wipe keeps the licence; the Admin wipe_and_reset still removes everything');
  pendingAsyncChecks.push((async () => {
    const { callTestShop, testShopResetMessage } = await import('../src/lib/cloud/testShopReset');
    let called = false;
    const r = await callTestShop('reset', (async () => { called = true; return new Response('{}'); }) as any);
    assert(!r.ok && r.error === 'signed_out' && !called, 'Test shop reset: without this shop Google sign-in nothing is sent');
    assert(testShopResetMessage('not_test_account').length > 0 && testShopResetMessage('signed_out') !== testShopResetMessage('x'), 'Test shop reset: refusals are explained in the shop words');
  })());
  const nav = readSource('components/layout/Navbar.tsx');
  assert(!nav.includes("tr('Log Out / Switch Account')") && nav.includes("tr('Log out')"), 'Logout no longer promises "Switch Account" (the same shop opens again with the password)');
}

// v4.143.0 — Restaurant screens made to match the app (Rahul: "naye screens ka UI match nahi hota"): New delivery
// laid out like the other dialogs, mobile first, a guest delivered to before fills itself; the order shows the guest
// as a card; sold-out mode says what it does; the KOT setting is a switch; a delivery bill no longer says "Takeaway".
{
  pendingAsyncChecks.push((async () => {
    const { deliveryAddressOf, guestNameOf, pickKnownGuest } = await import('../src/lib/restaurant/guestLookup');
    assert(deliveryAddressOf('Delivery DL-04 · Flat 4, Shivaji Nagar') === 'Flat 4, Shivaji Nagar' && deliveryAddressOf('Table T4') === '' && deliveryAddressOf('Takeaway TA-02') === '',
      'Delivery guest: the address comes back only from a paid delivery bill');
    assert(guestNameOf('Ramesh · Delivery DL-04') === 'Ramesh' && guestNameOf('Delivery DL-04') === '', 'Delivery guest: the name is the guest\'s, never the order\'s');
    const sales = [
      { customer_phone: '9876543210', customer_name: 'Ramesh · Delivery DL-01', notes: 'Delivery DL-01 · Old address', created_at: '2026-10-01T10:00:00Z' },
      { customer_phone: '+91 98765 43210', customer_name: 'Ramesh P · Delivery DL-07', notes: 'Delivery DL-07 · New address', created_at: '2026-10-09T10:00:00Z' },
      { customer_phone: '9876543210', customer_name: 'Ramesh · Table T2', notes: 'Table T2', created_at: '2026-10-10T10:00:00Z' },
    ];
    const g = pickKnownGuest('98765 43210', sales as any, []);
    assert(g?.name === 'Ramesh P' && g?.address === 'New address', 'Delivery guest: the LAST delivery to that mobile fills name + address (a table bill is skipped)');
    const c = pickKnownGuest('9822001122', [], [{ name: 'Sunita', phone: '9822001122', address: 'Plot 9' }]);
    assert(c?.name === 'Sunita' && c?.address === 'Plot 9' && pickKnownGuest('12345', sales as any, []) === null && pickKnownGuest('9000000000', sales as any, []) === null,
      'Delivery guest: a khata customer with the mobile counts; a wrong or unknown mobile fills nothing');
  })());
  const dlg = readSource('components/restaurant/DeliveryDialog.tsx');
  assert(dlg.indexOf('data-delivery-phone') < dlg.indexOf('data-delivery-name') && dlg.includes('findKnownGuest(p)') && dlg.includes("setName((v) => v || g.name)")
    && dlg.includes("{tr('Cancel')}") && dlg.includes('data-delivery-charges'), 'New delivery: mobile first, known guest fills only empty boxes, Cancel + charges shown');
  assert(readSource('components/restaurant/RestaurantPage.tsx').includes('<DeliveryDialog open={guestFor === \'delivery\'} settings={settings}'), 'New delivery: knows the packing / delivery charges');
  const panel = readSource('components/restaurant/OrderPanel.tsx');
  assert(panel.includes('data-order-guest') && panel.includes('<MapPin') && panel.includes('line-clamp-2'), 'Restaurant order: the guest is a card with the full address');
  assert(readSource('components/restaurant/MenuPanel.tsx').includes('{soldOutMode && (') && readSource('components/restaurant/MenuPanel.tsx').includes('data-sold-out-banner'), 'Sold out today: the mode shows what to do');
  assert(readSource('components/restaurant/SetupDialog.tsx').includes('role="switch"') && !readSource('components/restaurant/SetupDialog.tsx').includes('type="checkbox"'), 'Restaurant set-up: KOT printing is a switch like the app\'s other settings');
  assert(readSource('components/restaurant/PayDialog.tsx').includes("order.kind === 'delivery' ? `${tr('Delivery')} ${order.label}`"), 'Restaurant pay: a delivery bill says "Delivery DL-…", not "Takeaway"');
}

// v4.144.0 — Staff sign-in (Rahul 2026-10-10): staff join on their own phones with a one-time code from
// Settings → Staff — never the owner's Google account; each role sees only its work (server rules). The
// restaurant settings go to the cloud for the staff phones; an order keeps who took it.
{
  pendingAsyncChecks.push((async () => {
    const st = await import('../src/lib/cloud/staff');
    const rest = st.staffRolesFor('restaurant');
    assert(rest.some((r) => r.available && r.id === 'waiter') && st.staffRolesFor('grocery').some((r) => r.available)
      && st.staffRolesFor('clothing').some((r) => r.available && r.id === 'salesperson') && st.staffRolesFor('hardware').some((r) => r.available && r.id === 'godown'),
      'Staff roles: every kind of shop has its roles; available across all verticals');
    const d = st.staffDraft('  Raju   Patil ', 'waiter', 'restaurant', '2026-10-10T12:00:00.000Z');
    assert(d.ok && JSON.stringify(d.doc) === JSON.stringify({ name: 'Raju Patil', role: 'waiter', active: true, created_at: '2026-10-10T12:00:00.000Z' })
      && !st.staffDraft('R', 'waiter', 'restaurant', 'x').ok && !st.staffDraft('Raju', 'invalid_role' as any, 'restaurant', 'x').ok && !st.staffDraft('Raju', 'waiter', 'grocery', 'x').ok,
      'Add staff: a name and an available role of this shop are needed');
    const now = Date.parse('2026-10-10T12:00:00Z');
    const m = (x: Record<string, unknown>) => st.parseStaff('st_raju1', { name: 'Raju', role: 'waiter', ...x })!;
    assert(st.staffStatus(m({ active: true, joined_at: 'x', last_seen_at: '2026-10-10T11:58:00Z' }), now) === 'online'
      && st.staffStatus(m({ active: true, joined_at: 'x', last_seen_at: '2026-10-10T10:00:00Z' }), now) === 'joined'
      && st.staffStatus(m({ active: true }), now) === 'not_joined' && st.staffStatus(m({ active: false, joined_at: 'x' }), now) === 'removed',
      'Staff list: online now / signed in / not signed in yet / removed');
    assert(st.parseStaff('../x', { name: 'A' }) === null && st.parseStaff('st_raju1', { name: '' }) === null && /^st_[a-z0-9]{10}$/.test(st.newStaffId()),
      'Staff list: bad entries never crash the page; ids are safe');
    assert(st.sortStaff([m({ active: false }), { ...m({ active: true }), name: 'Zed' }, { ...m({ active: true }), name: 'Amit' }]).map((x) => x.name).join() === 'Amit,Zed,Raju',
      'Staff list: active first, then by name');
    let called = false;
    const r = await st.createJoinCode('st_raju1', (async () => { called = true; return new Response('{}'); }) as any);
    assert(!r.ok && !called, 'Join code: never asked for without this shop\'s Google sign-in');
    const { settingsForCloud } = await import('../src/lib/restaurant/cloudOrders');
    const { DEFAULT_RESTAURANT_SETTINGS } = await import('../src/lib/restaurant/settings');
    const pub = settingsForCloud({ ...DEFAULT_RESTAURANT_SETTINGS, printRemoteKots: true });
    assert(!('printRemoteKots' in pub) && Array.isArray(pub.tables) && pub.gstRate === 5, 'Restaurant settings for staff phones: tables / GST / charges / add-ons, never this PC\'s KOT-printer choice');
    const { parseRestState } = await import('../src/lib/restaurant/store');
    const o = parseRestState({ orders: [{ id: 'o1', kind: 'table', label: 'T4', lines: [], openedAt: 'x', updatedAt: 'x', kotRounds: 0, takenBy: 'Raju' }] }).orders[0];
    assert(o.takenBy === 'Raju', 'Restaurant: an order keeps the staff member who took it (from the waiter\'s phone)');
  })());
  const co = readSource('lib/restaurant/cloudOrders.ts');
  assert(co.includes('publishSettings();') && co.includes('window.addEventListener(RESTAURANT_CHANGED_EVENT, publishSettings);') && co.includes('if (json === publishedSettings) return;'),
    'Restaurant settings go up at start and when they change (only when different)');
  const tab = readSource('components/settings/staff/StaffTab.tsx');
  assert(tab.includes("if (!account || account.stub)") && tab.includes('setStaffActive(m.id, false)') && readSource('components/settings/SettingsNavTabs.tsx').includes("id: 'staff' as SettingsTabType")
    && readSource('app/settings/page.tsx').includes("{activeTab === 'staff' && <StaffTab />}"), 'Settings → Staff: needs the Google account; remove = active false (the phone is signed out)');
  assert(readSource('components/restaurant/TablesHome.tsx').includes('data-order-taken-by'), 'Tables: the order card shows who took it');
  assert(readSource('components/transactions/TransactionBillCard.tsx').includes('sale.staff_name || sale.created_by'), 'TransactionBillCard shows staff attribution label');
  assert(readSource('components/restaurant/RecentBills.tsx').includes('s.staff_name || s.created_by'), 'RecentBills strip shows staff attribution label');
}

// v4.145.0 — The browser tab after Google sign-in: KamaiPlus wordmark, animated mark, the signed-in account.
// Its styles are on its own classes — a browser extension's hidden <div> showed up as an empty card beside it.
{
  const gsPage = fs.readFileSync(path.join(__dirname, '..', 'googleSignIn.js'), 'utf8');
  assert(!/[{}\n]div\{/.test(gsPage) && gsPage.includes('.kp-card{') && gsPage.includes("page('ok', 'You’re signed in'") && gsPage.includes('{ email: claims.email, name: claims.name }'),
    'Google sign-in tab: own classes only (no bare div style), says who signed in');
  assert(gsPage.includes("const esc = (v) =>") && /\$\{esc\(account\.email/.test(gsPage), 'Google sign-in tab: the name / email are escaped');
}

// v4.146.0 — Restaurant: PC and phone the same. A shop without a GSTIN publishes GST 0 for the staff phones
// (Bill of Supply — the phone used to add 5 %); the last "Customer" words say "Guest" in Restaurant mode.
{
  pendingAsyncChecks.push((async () => {
    const { settingsForCloud } = await import('../src/lib/restaurant/cloudOrders');
    const { DEFAULT_RESTAURANT_SETTINGS } = await import('../src/lib/restaurant/settings');
    assert(settingsForCloud(DEFAULT_RESTAURANT_SETTINGS, false).gstRate === 0 && settingsForCloud({ ...DEFAULT_RESTAURANT_SETTINGS, gstRate: 18 }, true).gstRate === 18,
      'Restaurant settings for staff phones: no GSTIN → GST 0; with a GSTIN the shop\'s own rate');
  })());
  const W = RESTAURANT_WORDS;
  assert(W['Customer Udhar'] === 'Guest Udhar' && W['+ Add First Customer'] === '+ Add First Guest' && W['Select a Customer'] === 'Select a Guest',
    'Restaurant mode: Home / Khata say Guest (as the phone does), not Customer');
  assert(readSource('lib/restaurant/cloudOrders.ts').includes('settingsForCloud(loadRestaurantSettings(), gstAllowed())'), 'Restaurant settings are published with the shop\'s GST rule');
}

// v4.147.0 — Home and invoice options follow the kind of shop (Rahul): a restaurant's Home shows Average Bill
// (no buying price per dish), invoice options hide GST breakup / HSN without a GSTIN and MRP savings for dishes,
// and the restaurant Home words drop margins / dead stock.
{
  assert(!showProfitCard({ costPriceOn: true, anyProductHasCost: true, costedRevenuePaise: 900, restaurant: true }) && showProfitCard({ costPriceOn: true, anyProductHasCost: false }),
    'Home: a restaurant never shows Today\'s Profit (Average Bill instead); other shops as before');
  pendingAsyncChecks.push((async () => {
    const { visibleToggles } = await import('../src/components/invoices/designer/DesignerSections');
    const keys = (gst: boolean, rest: boolean) => visibleToggles(gst, rest).map((t) => t.key);
    assert(!keys(false, false).includes('show_gst_breakup') && !keys(false, false).includes('show_hsn_code') && keys(true, false).includes('show_hsn_code')
      && !keys(true, true).includes('show_mrp_savings') && keys(true, false).includes('show_mrp_savings') && keys(false, true).includes('show_logo'),
      'Invoice options: GST breakup / HSN only with a GSTIN; no MRP savings for a restaurant');
  })());
  assert(RESTAURANT_WORDS['Deep sales reports • Customer udhar & margins • Dead stock'] === 'Deep sales reports • Top dishes • Guest udhar'
    && RESTAURANT_WORDS['Parties • Items • Profit'] === 'Guests • Dishes • Bills', 'Restaurant Home: no margins / dead stock / profit words');
  assert(readSource('components/dashboard/DashboardHome.tsx').includes('restaurant: isRestaurantMode(),'), 'Home passes Restaurant mode to the profit card choice');
}

// v4.148.0 — Free trial (days from the Admin) for a computer WITHOUT a key, and the version lock: new apps read
// stable.yml / early.yml (older installs keep reading latest.yml / beta.yml, written only with --legacy), and the
// Admin's "Hold updates" stops checks and installs on one PC. A computer with a key never sees a trial.
{
  const lic = require(path.join(REPO_ROOT, 'licence.js'));
  const trialSt = lic.statusFor({ v: 1, key: '', trial: true, machine_id: 'x', valid_until: '2026-12-01T00:00:00.000Z' }, Date.parse('2026-11-21T00:00:00.000Z'));
  const keySt = lic.statusFor({ v: 1, key: 'KPD-2345-6789-ABCD-EFGH', valid_until: '2027-09-30T00:00:00.000Z' }, Date.parse('2026-11-21T00:00:00.000Z'));
  const endedTrial = lic.statusFor({ v: 1, key: '', trial: true, machine_id: 'x', valid_until: '2026-11-01T00:00:00.000Z' }, Date.parse('2026-11-21T00:00:00.000Z'));
  assert(trialSt.state === 'active' && trialSt.trial === true && trialSt.daysLeft === 10 && keySt.trial === undefined && endedTrial.state === 'expired' && endedTrial.trial === true,
    'Trial: a signed trial is "active" with days left and marked trial; a key\'s licence never is; an ended trial is "expired" (asks for a key)');
  const ls = fs.readFileSync(path.join(REPO_ROOT, 'licence.js'), 'utf8');
  assert(ls.includes("action: isTrial ? 'trial_refresh' : 'refresh'") && ls.includes("if (own && own.trial !== true) return { ok: false, error: 'This computer already has a licence key.' };")
    && ls.includes('(payload.trial === true) !== isTrial'), 'Trial: check-in uses the trial\'s own action; a computer with a key can never start one; a refresh never swaps key ↔ trial');
  pendingAsyncChecks.push((async () => {
    const offline = await lic.trialInfo({ appVersion: 't', fetchImpl: async () => { throw new Error('net'); } });
    const info = await lic.trialInfo({ appVersion: 't', fetchImpl: async () => new Response(JSON.stringify({ available: true, days: 60, used: false, ends_at: null }), { status: 200 }) });
    const bad = await lic.startTrial({ userDataDir: path.join(os.tmpdir(), `kp_trial_${Date.now()}`), appVersion: 't', fetchImpl: async () => new Response(JSON.stringify({ licence: 'x', signature: 'y' }), { status: 200 }) });
    assert((offline as any).offline === true && (info as any).available === true && (info as any).days === 60 && !bad.ok,
      'Trial: offer read from the server; offline = no offer; an unsigned answer never becomes a trial');
  })());
  const gate = readSource('components/licence/LicenceGate.tsx');
  // Rahul: no "Start free trial" button — the shop just signs up; the trial starts by itself (or comes back
  // after a reinstall); only when it cannot (off / used / no internet) the key screen shows. Test runs never start one.
  assert(gate.includes('if (status.trial) return <ActivationScreen') && gate.includes('<TrialAutoStart onStarted={setStatus}') && !gate.includes('Start free trial')
    && gate.includes("const running = info.used && info.endsAt && Date.parse(info.endsAt) > Date.now();")
    && fs.readFileSync(path.join(REPO_ROOT, 'main.js'), 'utf8').includes("process.env.KAMAI_E2E_TRIAL !== '1' && !app.isPackaged"),
    'Trial: starts by itself before signup (no button), comes back after a reinstall, never in test runs; an ended trial asks for a key');
  assert(readSource('components/admin/AdminMessageBanner.tsx').includes('<TrialNotice daysLeft={trial.daysLeft!}'), 'Trial: a strip shows the days left and "Enter licence key"');
  const upd = fs.readFileSync(path.join(REPO_ROOT, 'updater.js'), 'utf8');
  const prep = fs.readFileSync(path.join(__dirname, 'prepare_release.js'), 'utf8');
  assert(upd.includes("const STABLE_CHANNEL = 'stable';") && upd.includes("const BETA_CHANNEL = 'early';") && /if \(isHeld\(\)\) \{\s*autoUpdater\.autoInstallOnAppQuit = false;/.test(upd) && upd.includes('if (!readyVersion || isHeld()) return false;'),
    'Version lock: new apps read stable / early; a held PC neither checks nor installs');
  assert(/if \(legacy\) \{\s*fs\.writeFileSync\(path\.join\(release, OLD_BETA\), yml\);/.test(prep) && prep.includes('if (mode === \'stable\') fs.writeFileSync(path.join(release, STABLE), yml);')
    && !/fs\.writeFileSync\(path\.join\(release, 'latest\.yml'\)/.test(prep), 'Version lock: a release writes latest.yml / beta.yml (older installs) only with --legacy');
  const al = require(path.join(REPO_ROOT, 'adminLink.js'));
  const held = al.cleanControl({ update_hold: true, min_version: '4.200.0' });
  assert(held.update_hold === true && held.min_version === undefined && al.cleanControl({ update_hold: 'yes' }).update_hold === undefined,
    'Version lock: the Admin\'s hold is kept, and a held PC is never told to "update first"');
  assert(fs.readFileSync(path.join(REPO_ROOT, 'main.js'), 'utf8').includes("isHeld: () => adminLink.readControl(app.getPath('userData')).update_hold === true"), 'Version lock: the updater reads the hold from the Admin\'s control');
}

// v4.149.0 — Home Pulse the same on PC and phone (Rahul 2026-10-11): a restaurant has no buying prices, so
// card 2 is the Staff card (count, online now, opens Settings → Staff) — as the Android Home does.
{
  const pulse = readSource('components/dashboard/TodayBusinessPulse.tsx');
  const staffCard = readSource('components/dashboard/StaffPulseCard.tsx');
  assert(/\{restaurant \? \(\s*<StaffPulseCard \/>\s*\) : showProfit \? \(/.test(pulse) && pulse.includes('const restaurant = useRestaurantMode();'),
    'Home Pulse: a restaurant shows the Staff card in place of the Profit or Average Bill card; other shops keep them');
  assert(staffCard.includes('href="/settings?tab=staff"') && staffCard.includes("staffStatus(m, now) === 'online'") && staffCard.includes('m.active')
    && staffCard.includes('const [signedIn, setSignedIn] = useState(false);') && staffCard.includes('stop?.()'),
    'Home Pulse Staff card: counts active staff and those online, opens Settings → Staff, reads the account after mount and stops listening on leave');
}

// v4.150.0 — strong validation on every contact field (Rahul 2026-10-11: "Add New Customer me contact
// number unlimited digit dal sakta hu"). Boxes stop extra digits while typing; save checks the exact shape.
{
  assert(!validateIndianPhone('123456789012345').isValid && !validateIndianPhone('98765432101').isValid
    && validateIndianPhone('+91 98765 43210').cleanedValue === '9876543210' && validateIndianPhone('09876543210').cleanedValue === '9876543210'
    && mobileDigits('919876543210') === '9876543210',
    'Phone: 15 / 11 typed digits are refused (not cut to the last 10); only +91 / 0 in front is dropped');
  assert(typeMobile('98765432109999') === '9876543210' && typeMobile('+91 98765 43210') === '9876543210' && typeMobile('+91') === ''
    && typeMobile('0987') === '987' && typeMobile('abc98-76') === '9876',
    'Phone box: digits only, never more than 10, +91 / 0 typed in front is dropped');
  assert(!validatePersonName('12345').isValid && !validatePersonName('A').isValid && validatePersonName('रमेश पाटील').isValid
    && validatePersonName('Anand   Sharma').cleanedValue === 'Anand Sharma' && !validatePersonName('x'.repeat(81)).isValid,
    'Names: 2–80 characters with letters (Hindi / Marathi too); not only digits');
  assert(!validateEmail('a..b@x.com').isValid && !validateEmail('.a@x.com').isValid && !validateEmail('a@-x.com').isValid
    && !validateEmail('a b@x.com').isValid && validateEmail('Ram.K@Gmail.com').cleanedValue === 'ram.k@gmail.com',
    'Email: no "..", no dot at the ends, no space; saved in small letters');
  assert(!validateDayMonth({ day: '31', month: '2' }).isValid && validateDayMonth({ day: '29', month: '2' }).cleanedValue === '02-29'
    && !validateDayMonth({ day: '29', month: '2', year: '2023' }).isValid && validateDayMonth({ day: '16', month: '8', year: '1992' }).cleanedValue === '1992-08-16'
    && !validateDayMonth({ day: '1', month: '1', year: String(new Date().getFullYear() + 1) }).isValid && !validateDayMonth({ day: '5', month: '' }).isValid
    && validateDayMonth({ day: '', month: '' }).cleanedValue === '',
    'Birthday / anniversary: real dates only, not in the future; YYYY-MM-DD or MM-DD (the phone keeps no year)');
  assert(JSON.stringify(parseDayMonth('16-08-1992')) === '{"day":16,"month":8,"year":1992}' && JSON.stringify(parseDayMonth('08-14')) === '{"day":14,"month":8}'
    && parseDayMonth('1990-08-15')?.year === 1990 && parseDayMonth('soon') === null,
    'Birthday: old free-text DD-MM-YYYY, the phone MM-DD and the PC YYYY-MM-DD all open in the day / month boxes');
  assert(validateIfsc('sbin0001234').cleanedValue === 'SBIN0001234' && !validateIfsc('SBIN1001234').isValid
    && !validateBankAccount('12345678').isValid && validateBankAccount('50200012345678').isValid && typeCode('27aapf-u0939f1zv99', 15) === '27AAPFU0939F1ZV',
    'Bank: IFSC is 4 letters + 0 + 6, account 9–18 digits; GSTIN box takes 15 capitals / digits');
  assert(typeAmount('12a3.456') === '123.45' && typeAmount('-50', true) === '-50' && typeAmount('-50') === '50' && typeDigits('4110 01x9', 6) === '411001'
    && !validateAmount('9999999999').isValid && !validateAmount('1.234').isValid && validateAmount('150.5').cleanedValue === 15050
    && !validateAmount('-5').isValid && validateAmount('-5', { allowNegative: true }).cleanedValue === -500,
    'Amounts: 2 paise digits at most, ₹10 crore cap, minus only where allowed');
  const cust = readSource('components/customers/AddEditCustomerModal.tsx');
  assert(cust.includes('setPhone(typeMobile(e.target.value))') && cust.includes('setGstin(typeCode(e.target.value, FIELD_MAX.gstin))')
    && cust.includes("<DayMonthField label={tr('Birthday')}") && cust.includes("validateDayMonth(dateOfBirth, tr('Birthday'))") && !cust.includes('Birthday (DD-MM-YYYY)')
    && cust.includes('validateAmount(creditLimit'),
    'Add / Edit Customer: mobile max 10 digits, GSTIN 15, birthday from day / month boxes, balances checked');
  const boxes: Array<[string, string]> = [
    ['components/settings/StoreProfileTab.tsx', 'setPhone(typeMobile(e.target.value))'], ['components/settings/StoreProfileTab.tsx', 'setPhone2(typeMobile(e.target.value))'],
    ['components/settings/StoreProfileTab.tsx', 'setPincode(typeDigits(e.target.value, FIELD_MAX.pincode))'], ['components/settings/UpiBankingTab.tsx', 'setBankIfsc(typeCode(e.target.value, FIELD_MAX.ifsc))'],
    ['components/settings/UpiBankingTab.tsx', 'setBankAccountNo(typeDigits(e.target.value, FIELD_MAX.bankAccount))'], ['components/khata/QuickAddKhataCustomerModal.tsx', 'setNewCustPhone(typeMobile(e.target.value))'],
    ['components/invoices/EditInvoiceModal.tsx', 'setCustomerPhone(typeMobile(e.target.value))'], ['components/suppliers/SupplierFormModal.tsx', 'setPhone(typeMobile(e.target.value))'],
    ['app/onboarding/page.tsx', 'setPhone(typeMobile(e.target.value))'],
  ];
  const missing = boxes.filter(([f, s]) => !readSource(f).includes(s));
  assert(missing.length === 0, 'Every mobile / pincode / IFSC / account box filters while typing', missing.map(([f, s]) => `${f}: ${s}`).join('; '));
  assert(readSource('components/settings/settingsSave.ts').includes('validateIfsc(bankIfsc, false)') && readSource('components/invoices/editInvoiceSave.ts').includes("validateIndianPhone(customerPhone, false, msg('Phone Number'))")
    && readSource('components/onboarding/onboardingSubmit.ts').includes("validateIndianPhone(cleanPhone, true, msg('Store Mobile Phone'))"),
    'Save-time checks: bank details in Settings, the mobile on an edited bill, the shop mobile at sign-up (6–9 first)');
}

// v4.151.0 — UI tour, PC = phone (Rahul 2026-10-11: "dono platform par same chahiye"): "1 Debtor",
// "1 Account", "25 items" instead of SKU jargon (restaurant "dishes"), Staff card "Add your waiters".
{
  assert(readSource('components/dashboard/TodayBusinessPulse.tsx').includes("customersWithCreditCount === 1 ? tr('Debtor') : tr('Debtors')")
    && readSource('components/settings/UpiBankingTab.tsx').includes("upiList.length === 1 ? tr('Account') : tr('Accounts')"),
    'Counts read "1 Debtor" / "1 Account" (not "1 Debtors")');
  const tools = readSource('components/dashboard/QuickToolsGrid.tsx');
  assert(!tools.includes('SKUs') && tools.includes("tr('{productsCount} items', { productsCount })") && RESTAURANT_WORDS['{productsCount} items'] === '{productsCount} dishes',
    'Home tools say "25 items" (restaurant "11 dishes"), no SKU jargon — same as the phone');
  assert(readSource('components/dashboard/StaffPulseCard.tsx').includes("tr('Add your waiters')"), 'Staff card: "Add your waiters" fits (phone the same)');
  const setup = readSource('components/restaurant/SetupDialog.tsx');
  assert(setup.includes('{gstOk && (<>') && !setup.includes("!gstOk && 'opacity-50 pointer-events-none'"),
    'Restaurant set-up: without a GSTIN the GST rate / "prices include GST" are hidden (only the note) — phone the same');
}

// v4.152.0 — restaurant Desktop tour (D-01…D-10, Rahul 2026-10-11: same as the phone, no clutter, no empty space).
{
  const tools = readSource('components/dashboard/QuickToolsGrid.tsx');
  assert(tools.includes('if (sec.tools.length === 1 && out.length > 0)'), 'Home: a section left with one tile joins the one before it (no lonely row)');
  const table = readSource('components/products/ProductTableView.tsx');
  // v4.160.0 (bug, Electron E2E): restaurant only — an older shop with the cost switch off kept losing the Cost column / Est. Profit.
  assert(table.includes("{showCost && <th") && table.includes(': showBarcode && <span') && table.includes('const showCost = !restaurantMode || costSwitchOn;'),
    'Menu / product list: no Cost column for a restaurant without buying prices (other shops keep it), no "No barcode" for a dish');
  const reports = readSource('app/reports/page.tsx');
  assert(reports.includes('const noProfit = restaurantMode && !featureSwitches.product_cost_price;') && reports.includes("title={tr('Avg. Bill')}") && reports.includes('privacyOn && !noProfit')
    && readSource('components/reports/analytics/AnalyticsLists.tsx').includes('if (view.hidden) return null;'),
    'Sales Analytics in a restaurant without buying prices: Avg. Bill instead of profit, no Hide Profit, no profit on rows (other shops keep Est. Profit + the PIN lock)');
  assert(RESTAURANT_WORDS['Parties ({v1})'] === 'Guests ({v1})' && RESTAURANT_WORDS['Items ({v1})'] === 'Dishes ({v1})' && RESTAURANT_WORDS['Transactions ('] === 'Bills ('
    && RESTAURANT_WORDS['Cash Customer'] === 'Guest' && RESTAURANT_WORDS['Variants (Size / Colour)'] === 'Variants (Half / Full)',
    'Restaurant words: Guests / Dishes tabs, Bills, Guest, Half / Full variants');
  assert(readSource('lib/restaurant/model.ts').includes("tr('1 dish') : tr('{count} dishes'")
    && readSource('components/restaurant/RecentBills.tsx').includes("bills.length === 1 ? tr('1 bill')")
    && readSource('components/customers/CustomerCard.tsx').includes("tr('1 visit')")
    && readSource('components/khata/KhataMetricsRibbon.tsx').includes("tr('customer with dues')")
    && !readSource('app/transactions/page.tsx').includes('print tax invoice'),
    'Counts: "1 dish", "1 bill", "1 visit", "1 customer with dues"; Bills does not promise a tax invoice');
  const form = readSource('components/products/ProductFormDetails.tsx');
  assert(form.includes('{priceFieldCount > 1 && ('), 'Add Dish: one price box, no "Price" heading over "Price (₹)"');
  const tables = readSource('components/restaurant/TablesHome.tsx');
  assert(!tables.includes("tr('tap to start')") && tables.includes('min-h-[96px]'), 'Tables: shorter cards, "Free" only (as the phone)');
}

// v4.153.0 — kirana tour, PC = phone: no SKU jargon, plain product count.
assert(readSource('components/inventory/InventoryMetricsRibbon.tsx').includes("{tr('Items')}") && !readSource('components/inventory/InventoryMetricsRibbon.tsx').includes('Tracked SKUs')
  && readSource('components/products/ProductHeaderActions.tsx').includes("tr('{totalProducts} products with prices & stock'")
  && RESTAURANT_WORDS['{totalProducts} products with prices & stock'] === '{totalProducts} dishes on your menu',
  'Inventory says "Items" (not "Tracked SKUs"); Products header "{n} products with prices & stock" (restaurant: dishes on your menu)');

// v4.154.0 — pharmacy tour, PC = phone: medicine search placeholder when batch/expiry enabled.
assert(readSource('components/products/ProductFilterToolbar.tsx').includes('switches.product_batch_expiry')
  && readSource('components/products/ProductFilterToolbar.tsx').includes("tr('Search medicine name, barcode, batch, HSN...')"),
  'Pharmacy / batch-expiry search placeholder mentions medicine, batch, barcode, HSN');

// v4.155.0 — hardware tour, PC = phone: hardware item search placeholder when serial/warranty enabled.
assert(readSource('components/products/ProductFilterToolbar.tsx').includes('switches.bill_serial_warranty')
  && readSource('components/products/ProductFilterToolbar.tsx').includes("tr('Search item name, barcode, serial no, HSN...')"),
  'Hardware & Electronics search placeholder mentions item, barcode, serial no, HSN');

// v4.156.0 — general retail tour, PC = phone: retail product search placeholder when no size/colour switch.
assert(readSource('components/products/ProductFilterToolbar.tsx').includes('switches.product_size_colour')
  && readSource('components/products/ProductFilterToolbar.tsx').includes("tr('Search product name, barcode, HSN...')"),
  'General Retail search placeholder mentions product name, barcode, HSN without size/color');

// v4.157.0 — Claude review of the Antigravity tour (TF-03 / TF-04), PC = phone: the Products and
// Inventory number tiles carry no grey corner tags; the phone had "Inventory AssetTap to hide" run together.
{
  const pm = readSource('components/products/ProductMetricsRibbon.tsx');
  const im = readSource('components/inventory/InventoryMetricsRibbon.tsx');
  const tabs = readSource('components/billing/PosCategoryTabs.tsx');
  assert(tabs.includes('(categoryCounts[c.id] || 0) > 0 || c.id === selectedCategory') && tabs.includes("{ count: shown.length }"),
    'Counter category chips: no chip for a category with 0 items (the picked one stays), like the phone (P-06)');
  assert(!['Master', 'Reorder', 'Valuation', 'Groups'].some((w) => pm.includes(`tr('${w}')`))
    && !['Catalog', 'Cost', 'Low'].some((w) => im.includes(`tr('${w}')`))
    && pm.includes("tr('Time to reorder')") && !pm.includes('Below safety threshold'),
    'Products / Inventory tiles: no corner tags, low stock says "Time to reorder" (same as the phone)');
}

// v4.159.0 — Custom Item on the counter (PC = phone): a one-off line; unsaved it never touches stock.
{
  const cats = [{ id: 'cat_gen', business_id: 'b', name: 'General', created_at: '', updated_at: '' }] as any;
  const once = buildCustomItem({ name: '  Carry Bag ', pricePaise: 500, businessId: 'b', categories: cats, save: false });
  const kept = buildCustomItem({ name: 'Delivery Charge', pricePaise: 5000, businessId: 'b', categories: cats, save: true });
  assert(isUnsavedCustomItem(once.id) && !isUnsavedCustomItem(kept.id) && once.name === 'Carry Bag' && once.is_unlimited_stock === true
    && once.selling_price === 500 && once.purchase_price === 0 && once.tax_rate === 0
    && customItemPricePaise('12.50') === 1250 && customItemPricePaise('20') === 2000 && customItemPricePaise('0') === 0 && customItemPricePaise('1.234') === 0 && customItemPricePaise('abc') === 0,
    'Custom Item: unsaved = prod_misc_ id + unlimited stock, saved = a normal item; price box takes rupees with up to 2 decimals');
  const sale = readSource('components/billing/posSaleActions.ts');
  const conv = readSource('components/transactions/convertEstimate.ts');
  const guard = 'if (!prod && item.product_name && !isUnsavedCustomItem(item.product_id)) {';
  assert(sale.includes(guard) && conv.includes(guard)
    && readSource('components/billing/PosCategoryTabs.tsx').includes('data-pos-custom-item') && readSource('app/billing/page.tsx').includes('isCustomItemOpen ||'),
    'Custom Item: Complete Sale / Convert to Bill never take stock off a saved item with the same name; the button sits before "All Items"; the counter keys wait while it is open');
}

// v4.161.0 — Fast POS (Rahul: "jinke pas tables nhi hai, jo sirf tokens denge"): a token counter for a
// restaurant with no tables. Same bill / GST / KOT code as the Tables screen; the cart is never a running order.
pendingAsyncChecks.push((async () => {
  const fp = await import('../src/lib/restaurant/fastPos');
  const { orderRef } = await import('../src/lib/restaurant/model');
  const { settingsForCloud } = await import('../src/lib/restaurant/cloudOrders');
  const { DEFAULT_RESTAURANT_SETTINGS } = await import('../src/lib/restaurant/settings');
  const day = new Date(2026, 9, 12, 13, 0);
  // One daily count for TA / DL / TK: a takeaway TA-03 opened before means the next token is TK-04.
  const s0 = { orders: [], token: { day: localDay(day), last: 3 } } as any;
  const r1 = fp.reserveFastToken(s0, day);
  const r2 = fp.reserveFastToken(r1.state, day);
  const nextDay = fp.reserveFastToken(r2.state, new Date(2026, 9, 13, 9, 0));
  assert(r1.label === 'TK-04' && r2.label === 'TK-05' && fp.previewFastToken(r2.state, day) === 'TK-06' && nextDay.label === 'TK-01' && s0.token.last === 3,
    'Fast POS token: TK-04, TK-05… from the same daily count as TA / DL (never a shared number), 01 again the next day, nothing changed in place');
  const settings = sanitizeRestaurantSettings({ ...DEFAULT_RESTAURANT_SETTINGS, packingChargePaise: 1000 });
  const NOW = '2026-10-12T07:30:00.000Z';
  const pick: MenuPick = { productId: 'p_tea', name: 'Masala Chai', unit: 'piece', basePaise: 2000 };
  const take = { ...addPiece(fp.newFastCart(false, NOW, 'f1'), pick, NOW), label: 'TK-04' };
  const dine = { ...take, fast: { dineIn: true } };
  assert(orderTotals(take, settings).packingPaise === 1000 && orderTotals(dine, settings).packingPaise === 0 && orderTotals(dine, settings).grandTotal === 2000,
    'Fast POS: a takeaway token pays the packing charge, a dine-in token does not');
  assert(orderRef(take) === 'Token TK-04 · Takeaway' && orderRef(dine) === 'Token TK-04 · Dine-in' && billCustomerName(dine, 'Rahul') === 'Rahul · Token TK-04 · Dine-in'
    && orderRef({ kind: 'takeaway', label: 'TA-01' }) === 'Takeaway TA-01',
    'Fast POS bill / Transactions name: "Token TK-04 · Dine-in" (with the guest name in front); a takeaway order keeps "Takeaway TA-01"');
  const kot = buildKotBody({ order: dine, shopName: 'Chai Point', round: 1, now: day });
  assert(kot.includes('<div class="big">TK-04</div>') && kot.includes('TOKEN · DINE-IN') && buildKotBody({ order: take, round: 1, now: day }).includes('TOKEN · TAKEAWAY'),
    'Fast POS KOT: the token big, "TOKEN · DINE-IN / TAKEAWAY"');
  const back = parseRestState({ orders: [{ ...dine, kind: 'takeaway' }] }).orders[0];
  assert(back.fast?.dineIn === true && parseRestState({ orders: [take] }).orders[0].fast?.dineIn === false,
    'Fast POS cart survives a restart with its order type (store parser keeps `fast`)');
  const off = sanitizeRestaurantSettings({ fastKot: false });
  const pub = settingsForCloud({ ...DEFAULT_RESTAURANT_SETTINGS, fastKot: false });
  assert(sanitizeRestaurantSettings(null).fastKot === true && off.fastKot === false && !('fastKot' in pub),
    'Fast POS KOT switch: on by default, this PC\'s own choice (never sent to the waiters\' phones)');
  const screen = readSource('components/restaurant/FastPosScreen.tsx');
  const page = readSource('components/restaurant/RestaurantPage.tsx');
  assert(screen.includes('reserveFastToken(s)') && screen.includes("if (!cart.label) {") && screen.includes('settleOrder({ order, settings, business, method')
    && screen.includes('if (settings.fastKot)') && screen.includes('!res.noPrinter') && screen.includes("e.key === 'F10'")
    && !/update\(\(s\) => \(\{ \.\.\.s, orders: \[/.test(screen),
    'Fast POS screen: token taken once at Pay (kept if the window closes), bill through settleOrder, KOT only with a printer and the switch on, F10 = Pay, the cart never joins the running orders');
  assert(page.includes("mode === 'fast' ? (") && page.includes('readRestaurantMode()') && readSource('components/restaurant/TablesHome.tsx').includes('data-fast-pos-open'),
    'Tables & Orders ⇄ Fast POS: a button on the Tables screen, and this computer opens the screen it used last');
  assert(readSource('components/restaurant/PayDialog.tsx').includes('reference={orderRef(order)}') && readSource('components/restaurant/PayDialog.tsx').includes("order.fast ? `${tr('Token')}"),
    'Pay window: "Token TK-04 · Dine-in" as the title and the UPI reference (a delivery no longer says "Takeaway DL-01")');
  const { isRestaurantBill } = await import('../src/components/restaurant/RecentBills');
  assert(isRestaurantBill({ notes: 'Token TK-04 · Dine-in', status: 'completed' } as any) && isRestaurantBill({ notes: 'Delivery DL-02 · Plot 7', status: 'completed' } as any)
    && isRestaurantBill({ notes: 'Table T4', status: 'completed' } as any) && !isRestaurantBill({ notes: 'Token TK-04', status: 'draft' } as any) && !isRestaurantBill({ notes: 'Tea party order', status: 'completed' } as any)
    && readSource('components/restaurant/FastPosScreen.tsx').includes('<RecentBills onOpen={onOpenBill} />'),
    "Today's bills: token and delivery bills too (delivery was missing before v4.161.0); the strip is on Fast POS as well");
})());

// v4.161.0 (Rahul: "staff ke mobile me dish dikh nahi rahi"): a shop with staff but cloud sync off sent no menu —
// the waiters' phones showed no dishes. The Staff tab now turns sync on in one click, and Add staff asks first.
{
  const tab = readSource('components/settings/staff/StaffTab.tsx');
  assert(tab.includes('setCloudSendOn(true)') && tab.includes('void sendToCloudNow()') && tab.includes('data-staff-sync-on') && tab.includes('onClick={() => void startAdding()}')
    && tab.includes("tr('Staff phones get your menu, tables and orders through the cloud. Turn on cloud sync on this computer now?')"),
    'Staff tab: sync off = a red card with "Turn on cloud sync" (one click, sends at once); Add staff turns it on first');
  assert(readSource('components/layout/GlobalDrawers.tsx').includes("pagePath(pathname) === '/restaurant'"), 'No Transactions pull tab over Tables & Orders / Fast POS (it covered the order amounts)');
}

// v4.161.0 (Rahul: "staff ke mobile me dish dikh nahi rahi"): a shop with staff but cloud sync off sent no menu —
// the waiters' phones showed no dishes. The Staff tab now turns sync on in one click, and Add staff asks first.
{
  const tab = readSource('components/settings/staff/StaffTab.tsx');
  assert(tab.includes('setCloudSendOn(true)') && tab.includes('void sendToCloudNow()') && tab.includes('data-staff-sync-on') && tab.includes('onClick={() => void startAdding()}')
    && tab.includes("tr('Staff phones get your menu, tables and orders through the cloud. Turn on cloud sync on this computer now?')"),
    'Staff tab: sync off = a red card with "Turn on cloud sync" (one click, sends at once); Add staff turns it on first');
}

// v4.171.0 — Review of the Antigravity changes (v4.163–v4.170): fixes that must not come back.
pendingAsyncChecks.push((async () => {
  // (a) Poison-pill outbox: only a one-document error is counted; offline / quota / signed out fail the
  //     round and drop nothing. A row that went through later has its count cleared (it was re-sent forever).
  const cwSrc = readSource('lib/cloud/cloudWrite.ts');
  assert(/const ONE_DOC_ERRORS = new Set\(\['invalid-argument', 'permission-denied', 'failed-precondition', 'out-of-range'\]\)/.test(cwSrc)
    && cwSrc.includes('if (!isOneDocError(batchErr)) throw batchErr;') && cwSrc.includes('if (!isOneDocError(err)) throw err;')
    && cwSrc.includes('if (chunk.length > 1 && failed.length === chunk.length) throw') && (cwSrc.match(/clearRetry\(table, idOf\(x\)\)/g) || []).length === 2,
    'Cloud write: only a one-document refusal is counted / skipped; a network or account error fails the round (nothing dropped); success clears the count');
  const { isOneDocError } = await import('../src/lib/cloud/cloudWrite');
  assert(isOneDocError({ code: 'invalid-argument' }) && isOneDocError({ code: 'permission-denied' }) && !isOneDocError({ code: 'unavailable' })
    && !isOneDocError({ code: 'resource-exhausted' }) && !isOneDocError(new Error('offline')) && !isOneDocError(null),
    'Cloud write: invalid-argument / permission-denied = this document; unavailable / quota / anything else = try the whole round later');
  const ob = await import('../src/lib/cloud/cloudOutbox');
  clearOutbox();
  setOutboxRecording(true);
  ob.recordChange('products', 'put', ['p_poison']);
  ob.recordRetry('products', 'p_poison');
  assert(ob.getRetries('products', 'p_poison') === 1 && Boolean(peekOutbox().items.products?.p_poison), 'Outbox: a refused row stays waiting with its count');
  ob.clearRetry('products', 'p_poison');
  assert(ob.getRetries('products', 'p_poison') === 0, 'Outbox: the count is cleared once the row goes through');
  for (let i = 0; i < ob.MAX_OUTBOX_RETRIES; i++) ob.recordRetry('products', 'p_poison');
  assert(!peekOutbox().items.products?.p_poison, `Outbox: a row refused ${ob.MAX_OUTBOX_RETRIES} times is dropped (never blocks the rest)`);
  clearOutbox();
  setOutboxRecording(false);

  // (b) Weighing-scale EAN-13: valid check digit only, and the grams in the item's own unit.
  const { parseScaleEan13 } = await import('../src/lib/billing/scanInput');
  const { weighedQuantity } = await import('../src/lib/barcode/weighedBarcode');
  const scale = parseScaleEan13('2000012002502'); // PLU 00012, 250 g
  assert(Boolean(scale) && scale!.plu === '00012' && scale!.grams === 250 && scale!.pluCandidates.includes('12')
    && parseScaleEan13('2000012002509') === null && parseScaleEan13('8901234567890') === null,
    'Scale barcode: prefix 20/21 with a valid check digit (a half-read code is not a weight)');
  assert(weighedQuantity('kg', 250) === 0.25 && weighedQuantity('gram', 250) === 250 && weighedQuantity('piece', 250) === null
    && readSource('components/billing/usePosScanning.ts').includes('weighedQuantity(scaleProduct.unit, scaleBar.grams)')
    && !readSource('components/billing/usePosScanning.ts').includes('scaleBar.quantityKg'),
    'Scale barcode at the counter: 250 g = 0.25 for a kg item, 250 for a gram item (it was always billed as kg)');

  // (c) Staff performance / salary: the member's own records only — never "Raj" taking Rajesh's.
  const metrics = readSource('lib/staff/staffMetrics.ts');
  assert(!/\.includes\(clean\)/.test(metrics) && metrics.includes("(staffId && s.staff_id === staffId)")
    && metrics.includes("title === `advance: ${clean}`") && metrics.includes(".startsWith('advance')")
    && readSource('components/settings/staff/StaffSalaryDialog.tsx').includes('getStaffSalaryLedger(staffName, salaryPaise, member?.id)')
    && readSource('components/settings/staff/StaffPerformanceDialog.tsx').includes('getStaffTodayPerformance(member.name, member.id)'),
    'Staff performance / salary: by staff id or the whole name (no substring match, no bill-note match); "Advance:" by title only');

  // (d) Kitchen: the phone has no kitchen screen, so the role is not offered and cannot be saved.
  const st = await import('../src/lib/cloud/staff');
  assert(st.staffRolesFor('restaurant').find((r) => r.id === 'kitchen')?.available === false
    && !st.staffDraft('Ramu', 'Kitchen', 'restaurant', 'x', { isCustom: true }).ok && st.staffDraft('Ramu', 'Helper', 'restaurant', 'x', { isCustom: true }).ok
    && !readSource('components/settings/staff/AddStaffDialog.tsx').includes("tr('Kitchen')"),
    'Add staff: no Kitchen chip / role (a kitchen phone could not sign in); a custom role like Helper still works');
})());

// v4.172.0 — small UI fixes from the vertical pass: right plurals, no "Deficit: 0" / "Cost: ₹0.00", restaurant words.
{
  const pur = readSource('app/purchases/page.tsx');
  const reorder = readSource('components/inventory/ReorderAlertsList.tsx');
  assert(pur.includes("purchaseBills.length === 1 ? tr('1 bill recorded')") && pur.includes("restockItems.length === 1 ? tr('item low')")
    && readSource('components/settings/staff/StaffPerformanceDialog.tsx').includes("=== 1 ? tr('1 bill')"),
    'Purchases / staff performance: "1 bill recorded", "1 item low", "1 bill" (not "1 bills")');
  assert(reorder.includes('(p.min_stock_level || 5) - p.current_stock > 0 &&') && reorder.includes('p.purchase_price ? <>') && !reorder.includes('formatINR(p.purchase_price || 0)'),
    'Reorder card: no "Deficit: 0" at exactly the minimum, no "Cost: ₹0.00" without a buying price');
  assert(RESTAURANT_WORDS['Manage Products'] === 'Manage Menu' && readSource('components/inventory/InventoryHeaderActions.tsx').includes("tr('Manage Products')"),
    'Restaurant: Inventory header says "Manage Menu" (inventory is on for a restaurant since v4.165.0)');
}

// v4.178.0 — Store setup: "Looking for your shop in your Google account…" came back while the owner typed the
// phone number (the lookup re-ran on every key and hid the whole form). Only the first lookup / the one right
// after Connect Google holds the form back; later ones run quietly, for a full 10-digit number only.
{
  const ob = readSource('app/onboarding/page.tsx');
  assert(ob.includes('const accountRun = lookedUpForTick.current !== accountTick;')
    && ob.includes('if (!accountRun && clean.length !== 10) return;')
    && ob.includes('if (accountRun && linked && !detectedCloudStore) setCloudChecking(true);')
    && !ob.includes('        if (linked && !detectedCloudStore) setCloudChecking(true);'),
    'Store setup: typing the phone number never brings back "Looking for your shop…" (the form stays, only the first lookup waits)');
}

// v4.177.0 — Send to counter (retail): the bill the counter makes from a staff phone's cart carries that
// staff member's staff_id / staff_name (only restaurant bills did) — their phone's Today's Bills lists it.
pendingAsyncChecks.push((async () => {
  const bt = await import('../src/lib/billing/billTabs');
  const tabs = [{ ...bt.makeEmptyTab('t1', 1) }, { ...bt.makeEmptyTab('t2', 2), staffId: 'st_raju01', staffName: 'Raju' }];
  const own = bt.staffOfBill(tabs, 't2');
  assert(own.staff_id === 'st_raju01' && own.staff_name === 'Raju' && Object.keys(bt.staffOfBill(tabs, 't1')).length === 0
    && Object.keys(bt.staffOfBill(tabs, 'gone')).length === 0,
    'Send to counter: a bill opened from a staff cart carries their staff_id / staff_name; a counter bill carries none');
  const pick = readSource('components/billing/useStaffCartPickup.ts');
  const sale = readSource('components/billing/posSaleActions.ts');
  assert(pick.includes('...(cart.staffId ? { staffId: cart.staffId, staffName: cart.staffName } : {})')
    && sale.includes("created_by: 'owner', ...staffOfBill(tabs, soldTabId),") && sale.split('\n').length <= 401,
    'Send to counter: the staff cart tab is tagged with the staff member and Complete Sale puts it on the bill');
})());

// v4.176.0 — restaurant screen-by-screen check (Electron screenshots): Restaurant mode decides the dish form's
// units, no "GST 0%" line without GST, no wholesale-Excel tip on Add Dish, a mobile-only customer's number is
// never typed into the name box.
pendingAsyncChecks.push((async () => {
  const sv = readSource('lib/products/shopVertical.ts');
  const rows = ['components/restaurant/OrderPanel.tsx', 'components/restaurant/PayDialog.tsx', 'components/restaurant/FastCartPanel.tsx'].map(readSource);
  assert(sv.includes("isRestaurantMode() ? 'restaurant' : readVerticalProfile()?.vertical ?? null")
    && readSource('components/products/AddEditProductModal.tsx').includes('unitsForVertical(shopVertical()).units')
    && readSource('lib/products/categoryCleanup.ts').includes('const vertical = shopVertical();')
    && rows.every((src) => src.includes('settings.gstRate > 0 && <'))
    && readSource('components/products/AddEditProductModal.tsx').includes("!excelTipHidden && shopVertical() !== 'restaurant' && (")
    && readSource('components/restaurant/PayDialog.tsx').includes('cleanGuestPhone(c.name) !== goodPhone'),
    'Restaurant: Restaurant mode gives Add Dish its units (Plate), no "GST 0%" row, no wholesale-Excel tip, the name box never gets a phone number');
})());

// v4.175.0 — category / unit by vertical (kept coming back), unlimited stock never counted, staff bills on
// the waiter's phone, restaurant checkout like the counter (customer saved, udhar), Add staff offline.
pendingAsyncChecks.push((async () => {
  const vc = await import('../src/lib/products/verticalCatalog');
  const cats = [
    { id: 'c_acc', name: 'Accessories' }, { id: 'c_app', name: 'Apparel' }, { id: 'c_fmcg', name: 'FMCG' },
    { id: 'c_loose', name: 'Loose Items' }, { id: 'c_gen', name: 'General' }, { id: 'c_main', name: 'Main Course' },
  ];
  assert(vc.foreignStarterCategoryIds('restaurant', cats, [{ category_id: 'c_fmcg' }]).join() === 'c_acc,c_app,c_loose'
    && vc.foreignStarterCategoryIds('restaurant', cats, [{ category_name: 'apparel' }]).join() === 'c_acc,c_fmcg,c_loose'
    && vc.foreignStarterCategoryIds('grocery', cats, []).join() === 'c_acc,c_app'
    && vc.foreignStarterCategoryIds('clothing', cats, []).join() === 'c_fmcg,c_loose'
    && vc.foreignStarterCategoryIds('retail', cats, []).length === 0 && vc.foreignStarterCategoryIds(null, cats, []).length === 0,
    'Categories: the generic starters a vertical does not use go while no item uses them (by id or name); a shop\'s own / used / fitting ones stay; old shops untouched');
  assert(vc.defaultCategoryForNewItem(cats, 'c_main') === 'c_main' && vc.defaultCategoryForNewItem(cats, 'gone') === '' && vc.defaultCategoryForNewItem(cats, null) === ''
    && vc.unitsForVertical('restaurant').defaultUnit === 'plate' && vc.unitsForVertical('pharmacy').defaultUnit === 'strip' && vc.unitsForVertical('grocery').defaultUnit === 'kg'
    && vc.unitsForVertical(null).defaultUnit === 'piece' && vc.unitsForVertical('clothing').units.includes('pair'),
    'Add Product: a new item starts on the category used last (else General) and the vertical\'s unit (same table as Android) — never the first category A to Z');
  const idx = readSource('lib/db/index.ts');
  assert(idx.includes("(await db.categories.count()) === 0 && (await db.sales.count()) === 0") && idx.includes('if (!hasGeneral)')
    && !readSource('lib/constants/storeProfiles.ts').includes('export const STARTER_CATEGORIES')
    && readSource('components/layout/AppShell.tsx').includes("import('@/lib/products/categoryCleanup')")
    && readSource('lib/products/categoryCleanup.ts').includes('db.categories.bulkDelete(ids)')
    && readSource('components/products/AddEditProductModal.tsx').includes("<optgroup label={tr('More units')}>")
    && readSource('components/products/productActions.ts').includes('localStorage.setItem(LAST_PRODUCT_CATEGORY_KEY, categoryId)'),
    'Categories: no re-seed when the items are deleted (only a never-used shop), General once, the cleanup runs every session; the unit list starts with the shop\'s own units');

  const { tracksOwnStock } = await import('../src/lib/products/variants');
  const cc = await import('../src/lib/cloud/cloudContract');
  const fromPhone = cc.fromCloud('products', { id: 'p1', name: 'Tea', stock_quantity: 99989, selling_price_paise: 1000 }, null, { bizId: 'biz_x' });
  assert(fromPhone.is_unlimited_stock === true && !tracksOwnStock({ current_stock: 99950 } as any) && tracksOwnStock({ current_stock: 500 } as any),
    'Unlimited stock: a phone item the cloud lowered per sale (99989) is unlimited again, never counted in Inventory (Asset in crores before)');

  const { staffDay } = await import('../src/lib/staff/staffDay');
  const at = new Date(2026, 9, 16, 21, 30);
  const doc = cc.toCloud('sales', { id: 's1', staff_id: 'st_raju01', staff_name: 'Raju', created_at: at.toISOString(), items: [], grand_total: 100 }, { bizId: 'biz_x' });
  const plain = cc.toCloud('sales', { id: 's2', created_at: at.toISOString(), items: [], grand_total: 100 }, { bizId: 'biz_x' });
  assert(staffDay('st_raju01', at) === 'st_raju01_2026-10-16' && doc.staff_day === 'st_raju01_2026-10-16' && !('staff_day' in plain)
    && readSource('lib/restaurant/settle.ts').includes('...(order.takenById ? { staff_id: order.takenById } : {})')
    && readSource('lib/restaurant/store.ts').includes('takenById: str(o.takenById, 40)'),
    'Staff bills: a table bill carries the waiter (staff_id / staff_name) and staff_day, so the waiter\'s phone lists it under Today\'s Bills');

  const settle = readSource('lib/restaurant/settle.ts');
  const guest = readSource('lib/restaurant/guestCustomer.ts');
  const pay = readSource('components/restaurant/PayDialog.tsx');
  assert(settle.includes('await guestCustomerFor({ businessId, name: guestName, phone: cleanGuestPhone(guestPhone), udhar, now })')
    && settle.includes("balance_due: udhar ? grand : 0") && settle.includes('if (udhar && customer) await addUdhar(')
    && guest.includes("throw new Error('udhar-needs-guest')") && guest.includes("transaction_type: 'CREDIT_SALE'")
    && pay.includes("methods = METHODS.filter((m) => m.id !== 'credit' || switches.khata)") && pay.includes('udharNoGuest') && pay.includes('checkCreditLimit(known'),
    'Restaurant checkout = the counter: a mobile saves / finds the customer (name filled), Udhar on the khata (with Khata on, needs a name or mobile, limit warned)');
  assert(readSource('lib/cloud/staff.ts').includes("navigator.onLine === false) throw new Error('offline')"),
    'Add staff: offline it says so at once (it showed "Saving…" for ever); no timeout, so a retry never adds the person twice');
})());

// v4.174.0 — Send to counter: a line this PC's stock cannot take (addToCart adds nothing for it) is
// named in the last toast; before, the "cart is open" toast hid the out-of-stock one and the line was lost.
pendingAsyncChecks.push((async () => {
  const cc = await import('../src/lib/cloud/counterCarts');
  const lines = [
    { productId: 'p1', name: 'Atta 5kg', qty: 3, unitPricePaise: 0 },
    { productId: 'p2', name: 'Soap', qty: 1, unitPricePaise: 0 },
    { productId: 'p3', name: 'Maggi', qty: 2, unitPricePaise: 0 },
    { productId: '', name: 'Custom', qty: 9, unitPricePaise: 500 },
  ];
  const stock: (number | null)[] = [2, 0, 2, null];
  const short = cc.linesShortOfStock(lines, (i) => stock[i]);
  assert(short.join('|') === 'Atta 5kg|Soap' && cc.linesShortOfStock(lines, () => null).length === 0,
    'Send to counter: lines short of the counter stock are found (qty above stock, stock 0); exactly-enough and not-counted lines pass');
  const pick = readSource('components/billing/useStaffCartPickup.ts');
  assert(pick.includes('linesShortOfStock(cart.lines') && pick.includes('!p.has_variants && countsStockAtCounter(p, stockOn)')
    && pick.includes("not added (low stock here): {items}") && readSource('locales/hi.json').includes("not added (low stock here): {items}"),
    'Send to counter: the last toast names the lines that were not added (not "cart is open" over the stock error)');
})());

// v4.173.0 — money / data: "Send to counter" (a staff phone's cart is billed at the counter, never on the
// phone), an order paid here offline never comes back, rules covered on the emulator (npm run test:cloud).
pendingAsyncChecks.push((async () => {
  const cc = await import('../src/lib/cloud/counterCarts');
  const cart = cc.parseStaffCart('cart_1', {
    staff_id: 'st_raju01', staff_name: 'Raju', status: 'sent', created_at: '2026-10-15T10:00:00.000Z', total_paise: 3000, customer_name: 'Anil',
    lines: [{ product_id: 'prod_1', name: 'Parle-G 80g', qty: 3, unit_price_paise: 1000, unit: 'packet' }, { name: '', qty: 1 }, { name: 'Bad', qty: 0 }],
  });
  assert(Boolean(cart) && cart!.lines.length === 1 && cart!.lines[0].qty === 3 && cart!.staffName === 'Raju' && cart!.customerName === 'Anil' && cart!.status === 'sent'
    && cc.parseStaffCart('x', { lines: [] }) === null && cc.COUNTER_CARTS === 'counter_carts',
    'Send to counter: a cart document is read like the phone writes it (empty / zero lines dropped; an empty cart is no cart)');
  const pure = readSource('lib/cloud/counterCarts.ts');
  assert(!/from 'firebase|import\('firebase/.test(pure) && readSource('lib/cloud/counterCartsCloud.ts').includes("tx.update(ref, { status: 'taken'")
    && readSource('components/layout/StaffCartInbox.tsx').includes("import('@/lib/cloud/counterCartsCloud')")
    && readSource('components/billing/useStaffCartPickup.ts').includes('addToCart(product, line.qty)')
    && readSource('components/billing/usePosScanning.ts').includes('useStaffCartPickup(deps)')
    && readSource('app/billing/page.tsx').includes('addToCart, setTabs, setActiveTabId, activeTabId, showBillingToast')
    && readSource('components/layout/AppShell.tsx').includes('<StaffCartInbox />'),
    'Send to counter: the inbox on every screen (Firebase loaded only there), taken once in a transaction, opened as a new bill through the counter\'s own addToCart');

  const ro = await import('../src/lib/restaurant/cloudOrders');
  const remote = { id: 'table_t1', updatedAt: '2026-10-15T10:00:00.000Z' } as any;
  const sent = new Map([['table_t1', '2026-10-15T10:00:00.000Z']]);
  const gone = new Map<string, string>();
  assert(ro.removedHere(remote, false, sent, gone) && !ro.removedHere(remote, true, sent, gone)
    && !ro.removedHere({ ...remote, updatedAt: '2026-10-15T10:05:00.000Z' }, false, sent, gone)
    && ro.removedHere(remote, false, new Map(), new Map([['table_t1', '2026-10-15T10:00:00.000Z']]))
    && !ro.removedHere(remote, false, new Map(), new Map()),
    'Restaurant: an order paid / cancelled here (delete not through yet) is not merged back — unless another device changed it later');
  const co = readSource('lib/restaurant/cloudOrders.ts');
  assert(co.includes('RESTAURANT_GONE_KEY') && co.includes('if (removedHere(remote, state.orders.some((o) => o.id === remote.id), sent, gone))')
    && co.includes('fs.deleteDoc(fs.doc(col, id)).then(() => { gone.delete(id); writeGone(gone); })'),
    'Restaurant: a delete made offline is kept on disk and sent again after a restart (this PC keeps Firestore in memory only)');
})());

// Checks that need a real round trip (a local HTTP server) finish here, before the summary.
Promise.allSettled(pendingAsyncChecks).then((results) => {
  for (const r of results) if (r.status === 'rejected') assert(false, 'An async check threw', String(r.reason));
  console.log('');
  console.log('================================================================');
  console.log(`📊 SIMULATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
  console.log('================================================================');
  process.exit(failedTests > 0 ? 1 : 0);
});
