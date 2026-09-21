import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Email and OTP are required' }, { status: 400 });
    }

    const adminDb = await getAdminFirestore();
    const otpDocRef = adminDb.collection('email_otps').doc(email.toLowerCase());
    const otpDoc = await otpDocRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ success: false, error: 'Invalid or expired OTP' }, { status: 400 });
    }

    const data = otpDoc.data();
    if (!data || data.otp !== otp) {
      return NextResponse.json({ success: false, error: 'Incorrect OTP' }, { status: 400 });
    }

    if (Date.now() > data.expiresAt) {
      await otpDocRef.delete();
      return NextResponse.json({ success: false, error: 'OTP has expired' }, { status: 400 });
    }

    // OTP is valid. Delete it so it can't be reused.
    await otpDocRef.delete();

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
