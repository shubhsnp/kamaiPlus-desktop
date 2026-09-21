import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
// @ts-ignore - Ignore type errors if not found
import { getFirestoreDb } from '@/lib/firebase/config';
import { doc, setDoc } from 'firebase/firestore';

// Secure OTP generator
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Wait, getFirestoreDb is a client function? Let me check its implementation.
    // If it's a client function, we should use firebase-admin here.
    // Let me use firebase-admin since we are in API route.
    const { getAdminFirestore } = await import('@/lib/firebase/admin');
    const adminDb = await getAdminFirestore();

    // Save OTP to Firestore
    await adminDb.collection('email_otps').doc(email.toLowerCase()).set({
      otp,
      expiresAt,
      createdAt: new Date().toISOString()
    });

    // Send email using Nodemailer
    const isMock = !process.env.SMTP_USER || !process.env.SMTP_PASS;

    if (isMock) {
      console.log(`\n\n=== MOCK EMAIL SENT ===`);
      console.log(`To: ${email}`);
      console.log(`OTP: ${otp}`);
      console.log(`=======================\n\n`);
      return NextResponse.json({ 
        success: true, 
        message: 'OTP sent (Mock Mode)',
        mockOtp: otp // <--- Added this so frontend can show it in dev mode!
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"KamaiPlus Auth" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your KamaiPlus Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-w-md; margin: 0 auto; text-align: center;">
          <h2>KamaiPlus Login Verification</h2>
          <p>Please use the following OTP to continue:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #4F46E5;">${otp}</h1>
          <p style="color: #666; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      mockOtp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
