import 'server-only';
import { createNeonAuth } from '@neon/auth/next/server';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET!, sessionDataTtl: 60 },
});

// @neon/auth 0.8.2 implements these documented server endpoints but exposes
// emailOtp as unknown in its declaration. Keep the workaround at this boundary.
type OtpResult = { data?: unknown; error?: { code?: string; message?: string; status?: number } | null };
export const emailOtp = auth.emailOtp as {
  verifyEmail(input: { email: string; otp: string }): Promise<OtpResult>;
  sendVerificationOtp(input: { email: string; type: 'email-verification' | 'forget-password' }): Promise<OtpResult>;
  checkVerificationOtp(input: { email: string; otp: string; type: 'forget-password' }): Promise<OtpResult>;
  resetPassword(input: { email: string; otp: string; password: string }): Promise<OtpResult>;
};
