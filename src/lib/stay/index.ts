/**
 * Stay Module – Main Barrel Export
 *
 * Exports all types, repositories, services, validation functions,
 * and dev activation flags for the KamaiPlus Stay (Hospitality) module.
 */

// Domain models & TypeScript types
export * from './types';

// Dev activation & feature flags
export * from './stayActivation';

// Repositories
export { roomTypeRepository } from './repositories/roomTypeRepository';
export { roomRepository } from './repositories/roomRepository';
export { guestRepository } from './repositories/guestRepository';
export { bookingRepository } from './repositories/bookingRepository';
export { folioRepository } from './repositories/folioRepository';

// Business logic services
export {
  calculateNights,
  hasOverlappingBooking,
  getAvailableRooms,
} from './services/availabilityService';

export {
  generateBookingReference,
  createReservation,
  confirmReservation,
  cancelReservation,
  checkIn,
  checkOut,
  type CreateReservationInput,
  type CancelReservationInput,
  type CheckInInput,
  type CheckOutInput,
} from './services/bookingService';

export {
  postRoomCharge,
  postAdditionalCharge,
  postDiscount,
  recordPayment,
  calculateFolioBalance,
  generateFinalBillSummary,
  type PostRoomChargeInput,
  type PostAdditionalChargeInput,
  type PostDiscountInput,
  type RecordPaymentInput,
} from './services/financialService';

// Validation utilities
export {
  validateDateRange,
  validateRoomType,
  validateRoom,
  validateGuest,
  validateBooking,
  validatePayment,
} from './validation';
