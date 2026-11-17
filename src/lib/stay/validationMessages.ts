/**
 * Stay Module – Friendly, Localized Validation & Error Messages
 *
 * Provides clear, human-understandable messages in Marathi and English.
 * Never displays raw technical stack traces or generic "Error 500" to front-desk staff.
 */

export interface LocalizedMessage {
  mr: string;
  en: string;
}

export const STAY_MESSAGES: Record<string, LocalizedMessage> = {
  // Category & Room
  CATEGORY_REQUIRED: {
    mr: 'कृपया खोलीचा प्रकार निवडा (उदा. Deluxe AC, Double)',
    en: 'Please select a room category (e.g. Deluxe AC, Double)',
  },
  ROOM_NUMBER_REQUIRED: {
    mr: 'कृपया खोली क्रमांक प्रविष्ट करा (उदा. 101, 204)',
    en: 'Please enter a room number (e.g. 101, 204)',
  },
  ROOM_NUMBER_EXISTS: {
    mr: 'या क्रमांकाची खोली आधीच अस्तित्वात आहे',
    en: 'A room with this number already exists',
  },
  FLOOR_REQUIRED: {
    mr: 'कृपया मजला निवडा किंवा प्रविष्ट करा (उदा. 1, 2)',
    en: 'Please select or enter the floor number (e.g. 1, 2)',
  },
  ROOM_NOT_AVAILABLE: {
    mr: 'निवडलेली खोली या तारखांसाठी आधीच बुक केलेली आहे',
    en: 'The selected room is already booked for these dates',
  },
  NO_ROOMS_AVAILABLE_IN_CATEGORY: {
    mr: 'या प्रकारात निवडलेल्या तारखांसाठी कोणतीही खोली रिकामी नाही',
    en: 'No rooms available in this category for the selected dates',
  },

  // Dates & Times
  CHECK_IN_DATE_REQUIRED: {
    mr: 'कृपया चेक-इन तारीख निवडा',
    en: 'Please select a check-in date',
  },
  CHECK_OUT_DATE_REQUIRED: {
    mr: 'कृपया चेक-आउट तारीख निवडा',
    en: 'Please select a check-out date',
  },
  CHECK_OUT_MUST_BE_AFTER_CHECK_IN: {
    mr: 'चेक-आउट तारीख ही चेक-इन तारखेनंतरची असणे आवश्यक आहे',
    en: 'Check-out date must be strictly after the check-in date',
  },
  CHECK_IN_TIME_REQUIRED: {
    mr: 'कृपया चेक-इन वेळ निवडा',
    en: 'Please select a check-in time',
  },
  CHECK_OUT_TIME_REQUIRED: {
    mr: 'कृपया चेक-आउट वेळ निवडा',
    en: 'Please select a check-out time',
  },

  // Guest
  GUEST_NAME_REQUIRED: {
    mr: 'कृपया पाहुण्याचे पूर्ण नाव प्रविष्ट करा',
    en: 'Please enter the guest full name',
  },
  GUEST_PHONE_REQUIRED: {
    mr: 'कृपया पाहुण्याचा वैध १०-अंकी मोबाईल नंबर प्रविष्ट करा',
    en: 'Please enter a valid 10-digit mobile number for the guest',
  },
  GUEST_PHONE_INVALID: {
    mr: 'मोबाईल नंबर १० अंकी असावा (उदा. 9822012345)',
    en: 'Mobile number must be a valid 10-digit number (e.g. 9822012345)',
  },

  // Rates & Money
  TARIFF_REQUIRED: {
    mr: 'कृपया दर प्रति रात्र प्रविष्ट करा (₹)',
    en: 'Please enter a valid tariff per night (₹)',
  },
  TARIFF_INVALID: {
    mr: 'दर शून्य किंवा त्याहून अधिक वैध रक्कम असावा',
    en: 'Tariff must be a valid non-negative amount',
  },
  ADVANCE_EXCEEDS_TOTAL: {
    mr: 'आगाऊ रक्कम एकूण बिलापेक्षा जास्त असू शकत नाही',
    en: 'Advance payment cannot exceed the total estimated bill',
  },
  PAYMENT_AMOUNT_REQUIRED: {
    mr: 'कृपया पेमेंट रक्कम प्रविष्ट करा',
    en: 'Please enter a valid payment amount',
  },

  // Occupancy
  ADULTS_REQUIRED: {
    mr: 'किमान १ प्रौढ व्यक्ती असणे आवश्यक आहे',
    en: 'At least 1 adult guest is required',
  },
  CAPACITY_EXCEEDED: {
    mr: 'या खोलीची क्षमता जास्तीत जास्त पाहुण्यांपेक्षा जास्त आहे',
    en: 'The number of guests exceeds the maximum capacity of this room',
  },

  // Operations
  CHECK_IN_SUCCESS: {
    mr: 'चेक-इन यशस्वीरित्या पूर्ण झाले! खोली व्यापलेली नोंदवली गेली.',
    en: 'Check-in completed successfully! Room is now marked occupied.',
  },
  CHECK_OUT_SUCCESS: {
    mr: 'चेक-आउट पूर्ण झाले आणि खोली साफसफाईसाठी पाठवली गेली.',
    en: 'Check-out completed! Room sent to housekeeping for cleaning.',
  },
  BOOKING_SUCCESS: {
    mr: 'बुकिंग यशस्वीरित्या जतन झाले!',
    en: 'Reservation saved successfully!',
  },
};

/**
 * Get localized error message based on language key ('mr' or 'en')
 */
export function getStayMessage(key: string, lang: 'mr' | 'en' = 'mr'): string {
  const item = STAY_MESSAGES[key];
  if (!item) return key;
  return item[lang] || item.en;
}
