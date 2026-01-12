
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { otpService } from '@/services/otpService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const Verify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(120); // 2 minutes in seconds

  useEffect(() => {
    const getEmail = async () => {
      if (location.state?.email) {
        setEmail(location.state.email);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);
        else {
          toast({
            title: "Session Expired",
            description: "Please login again to verify.",
            variant: "destructive"
          });
          navigate('/vendor/login');
        }
      }
    };
    getEmail();
  }, [location, navigate]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    // ✅ 6-digit OTP check (custom OTP)
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit code.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Verify custom OTP
      await otpService.verifyOtp(email, otp);
      
      // OTP verified successfully, user should have been created during registration
      // Just update vendor profile verification status if needed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await vendorApi.updateVendorVerification(user.id, true);
      }

      toast({
        title: "Verified Successfully",
        description: "Welcome to your dashboard!",
        className: "bg-green-50"
      });
      navigate('/vendor/dashboard');
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired OTP code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setLoading(true);
      await otpService.resendOtp(email);
      setTimer(120); // Reset to 2 minutes
      setOtp('');    // Clear old OTP
      toast({ title: "OTP Resent", description: "A new 6-digit code has been sent to your email." });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#003D82]">Verify Account</CardTitle>
          <CardDescription>
            Enter the OTP sent to <span className="font-semibold text-gray-900">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 8-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="text-center text-2xl tracking-[0.5em] h-14"
                maxLength={8}
                inputMode="numeric"
                autoComplete="one-time-code"
              />

              <div className="flex justify-between text-sm text-gray-500">
                <span>Time remaining: {formatTime(timer)}</span>
                {timer === 0 ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-[#003D82] hover:underline font-medium"
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span className="text-gray-300 cursor-not-allowed">Resend OTP</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">💡 If you don't see the email, check your spam or junk folder</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg bg-[#003D82]"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : null}
              Verify Account
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/vendor/login')}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Back to Login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Verify;
