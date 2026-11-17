/**
 * Kamai Stay — Checkout & Payment Gate Simulation Test
 * 
 * Validates the resolution of the critical checkout payment defect:
 * 1. Room charges are automatically posted upon booking creation.
 * 2. Advance payments properly deduct from total charges.
 * 3. Final bill summary calculates positive balance due (₹3,000 - ₹1,000 = ₹2,000).
 * 4. Attempting checkout with outstanding balance WITHOUT authorized credit throws an error.
 * 5. Full settlement enables successful checkout and room turnover to cleaning.
 * 6. Authorized credit (Khaata) allows checkout while moving folio to credit_ledger.
 */

import 'fake-indexeddb/auto';
import { db } from '../src/lib/db';
import { createReservation, checkIn, checkOut } from '../src/lib/stay/services/bookingService';
import { recordPayment, generateFinalBillSummary } from '../src/lib/stay/services/financialService';
import { folioRepository } from '../src/lib/stay/repositories/folioRepository';

async function runSimulation() {
  console.log('===============================================================');
  console.log('🚀 KAMAI STAY: CHECKOUT & PAYMENT ENGINE VALIDATION SUITE');
  console.log('===============================================================\n');

  const businessId = 'biz_test_001';
  const roomId = 'room_104';
  const roomTypeId = 'type_deluxe';
  const primaryGuestId = 'guest_ramesh';

  // Seed Room & Guest
  await db.rooms.put({
    id: roomId,
    business_id: businessId,
    number: '104',
    floor: 1,
    room_type_id: roomTypeId,
    status: 'available',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  });

  await db.stay_guests.put({
    id: primaryGuestId,
    business_id: businessId,
    name: 'Ramesh Patil',
    phone: '9876543210',
    id_type: 'aadhaar',
    id_number: '123456789012',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  });

  // TEST 1: Create Reservation for 2 nights @ ₹1,500/night = ₹3,000 (300,000 paise)
  console.log('▶ Test 1: Creating booking for 2 nights @ ₹1,500/night (₹3,000 total)...');
  const checkInDate = '2026-11-20';
  const checkOutDate = '2026-11-22';
  const ratePaise = 150000; // ₹1,500.00

  const booking = await createReservation({
    businessId,
    roomTypeId,
    roomId,
    primaryGuestId,
    checkInDate,
    checkOutDate,
    adults: 2,
    agreedRatePaise: ratePaise,
    bookingReference: 'STY-2011-1001',
  });

  console.log(`  ✓ Booking created: ${booking.booking_reference}`);

  // Verify folio and auto-posted room charge
  const folio = await folioRepository.findOpenFolio(businessId, booking.id);
  if (!folio) throw new Error('Folio was not created!');

  console.log(`  ✓ Folio total charges: ₹${(folio.total_charges_paise / 100).toFixed(2)}`);
  console.log(`  ✓ Folio balance due: ₹${(folio.balance_paise / 100).toFixed(2)}`);
  if (folio.total_charges_paise !== 300000) {
    throw new Error(`Expected total charges 300000 paise (₹3,000), got ${folio.total_charges_paise}`);
  }
  if (folio.balance_paise !== 300000) {
    throw new Error(`Expected balance due 300000 paise (₹3,000), got ${folio.balance_paise}`);
  }

  // TEST 2: Record Advance Payment of ₹1,000 (100,000 paise)
  console.log('\n▶ Test 2: Guest pays ₹1,000 Advance Deposit...');
  await recordPayment({
    businessId,
    folioId: folio.id,
    bookingId: booking.id,
    amountPaise: 100000,
    paymentMethod: 'upi',
    referenceNumber: 'UPI439201928312',
    isAdvance: true,
  });

  const updatedFolio = await folioRepository.findById(folio.id);
  console.log(`  ✓ Folio total paid: ₹${((updatedFolio?.total_paid_paise || 0) / 100).toFixed(2)}`);
  console.log(`  ✓ Folio net balance due: ₹${((updatedFolio?.balance_paise || 0) / 100).toFixed(2)}`);

  if (updatedFolio?.balance_paise !== 200000) {
    throw new Error(`Expected remaining balance ₹2,000 (200000 paise), got ${updatedFolio?.balance_paise}`);
  }

  // TEST 3: Generate Final Bill Summary
  console.log('\n▶ Test 3: Generating Final Bill Summary...');
  const summary = await generateFinalBillSummary(folio.id, businessId);
  console.log(`  ✓ Grand Total: ₹${(summary.grand_total_paise / 100).toFixed(2)}`);
  console.log(`  ✓ Total Paid: ₹${(summary.total_paid_paise / 100).toFixed(2)}`);
  console.log(`  ✓ Balance Due: ₹${(summary.balance_due_paise / 100).toFixed(2)}`);

  if (summary.grand_total_paise !== 300000 || summary.total_paid_paise !== 100000 || summary.balance_due_paise !== 200000) {
    throw new Error('Bill summary numbers do not match expected ₹3,000 total, ₹1,000 paid, ₹2,000 due!');
  }

  // Check-In the Guest
  console.log('\n▶ Checking In Guest...');
  await checkIn({
    bookingId: booking.id,
    roomId,
    checkedInBy: 'Staff Deepak',
  });
  const roomOccupied = await db.rooms.get(roomId);
  console.log(`  ✓ Room ${roomId} status: ${roomOccupied?.status}`);

  // TEST 4: Attempt checkout with unpaid balance WITHOUT authorized credit (MUST FAIL)
  console.log('\n▶ Test 4: Attempting Checkout with unpaid ₹2,000 balance without credit authorization...');
  let caughtError = false;
  try {
    await checkOut({
      bookingId: booking.id,
      checkedOutBy: 'Staff Deepak',
    });
  } catch (err: any) {
    caughtError = true;
    console.log(`  ✓ Zero-Escape Gate BLOCKED checkout successfully! Error: "${err.message}"`);
  }

  if (!caughtError) {
    throw new Error('CRITICAL FLAW: checkOut allowed unpaid checkout without authorized credit!');
  }

  // TEST 5: Full Settlement & Checkout
  console.log('\n▶ Test 5: Guest pays remaining ₹2,000 via Cash & Completes Checkout...');
  await recordPayment({
    businessId,
    folioId: folio.id,
    bookingId: booking.id,
    amountPaise: 200000,
    paymentMethod: 'cash',
    notes: 'Final settlement at checkout',
  });

  await checkOut({
    bookingId: booking.id,
    checkedOutBy: 'Staff Deepak',
  });

  const finalBooking = await db.stay_bookings.get(booking.id);
  const finalRoom = await db.rooms.get(roomId);
  const finalFolio = await db.stay_folios.get(folio.id);

  console.log(`  ✓ Booking status: ${finalBooking?.status}`);
  console.log(`  ✓ Room status: ${finalRoom?.status} (Turnover to Housekeeping)`);
  console.log(`  ✓ Folio status: ${finalFolio?.status}`);

  if (finalBooking?.status !== 'checked_out' || finalRoom?.status !== 'cleaning' || finalFolio?.status !== 'closed') {
    throw new Error('Settlement checkout did not transition states properly!');
  }

  // TEST 6: Authorized Credit (Khaata Ledger) Workflow
  console.log('\n▶ Test 6: Testing Authorized Credit (Khaata) Workflow...');
  const booking2 = await createReservation({
    businessId,
    roomTypeId,
    roomId,
    primaryGuestId,
    checkInDate: '2026-11-25',
    checkOutDate: '2026-11-26',
    adults: 1,
    agreedRatePaise: 200000, // ₹2,000
    bookingReference: 'STY-2511-1002',
  });
  await checkIn({ bookingId: booking2.id, roomId });

  console.log('  Authorizing Credit checkout for Corporate Client ABC Infra...');
  await checkOut({
    bookingId: booking2.id,
    allowCredit: true,
    creditDetails: {
      debtorName: 'ABC Infra Ltd (Mr. Verma)',
      debtorPhone: '9822001122',
      dueDate: '2026-11-30',
      notes: 'Monthly corporate billing',
      authorizedBy: 'Manager Suresh',
    },
  });

  const folio2 = await folioRepository.findOpenFolio(businessId, booking2.id);
  console.log(`  ✓ Folio2 status: ${folio2?.status}`);
  console.log(`  ✓ Debtor Name: ${folio2?.debtor_name}`);
  console.log(`  ✓ Debtor Phone: ${folio2?.debtor_phone}`);
  console.log(`  ✓ Credit Authorized: ₹${((folio2?.credit_authorized_paise || 0) / 100).toFixed(2)}`);

  if (folio2?.status !== 'credit_ledger' || folio2?.credit_authorized_paise !== 200000) {
    throw new Error('Authorized credit did not record properly!');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 6 TESTS PASSED WITH 100% SUCCESS!');
  console.log('The Critical Checkout Payment Defect is completely resolved.');
  console.log('===============================================================\n');
}

runSimulation().catch((err) => {
  console.error('\n❌ SIMULATION FAILED:', err);
  process.exit(1);
});
