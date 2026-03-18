import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import Logo from '@/shared/components/Logo';
import TurnstileField from '@/shared/components/TurnstileField';
import { useCaptchaGate } from '@/shared/hooks/useCaptchaGate';

const VendorLogin = () => {
  const navigate = useNavigate();
  const supaAuth = useAuth();
  const loginCaptcha = useCaptchaGate();
  const captchaWidgetRef = React.useRef(null);
  const captchaExecuteQueuedRef = React.useRef(false);
  const [loading, setLoading] = useState(false);
  const [captchaStarted, setCaptchaStarted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // If already authenticated as vendor, send to dashboard
  React.useEffect(() => {
    if (supaAuth?.userRole === 'VENDOR') {
      navigate('/vendor/dashboard', { replace: true });
    }
  }, [supaAuth?.userRole, navigate]);

  const resetLoginCaptcha = React.useCallback(() => {
    captchaExecuteQueuedRef.current = false;
    captchaWidgetRef.current = null;
    loginCaptcha.resetCaptcha();
    setCaptchaStarted(false);
  }, [loginCaptcha]);

  const handleCaptchaWidgetReady = React.useCallback(async (widgetApi) => {
    captchaWidgetRef.current = widgetApi;

    if (!widgetApi || !captchaExecuteQueuedRef.current) {
      return;
    }

    captchaExecuteQueuedRef.current = false;
    await widgetApi.execute();
  }, []);

  const performLogin = async () => {
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: String(formData.email || '').trim().toLowerCase(),
        password: formData.password,
        role: 'VENDOR',
        captcha_token: loginCaptcha.captchaToken,
        captcha_action: 'auth_login',
      });

      if (authError) {
        throw authError;
      }

      // 2. Ensure vendor profile is linked to this user_id
      let vendor = await vendorApi.getVendorProfile(authData.user.id);

      if (!vendor) {
        // Try to link by email if user_id missing in vendors table
        const { data: vendorByEmail } = await supabase
          .from('vendors')
          .select('*')
          .ilike('email', formData.email.toLowerCase())
          .maybeSingle();
        if (vendorByEmail) {
          await supabase.from('vendors').update({ user_id: authData.user.id }).eq('id', vendorByEmail.id);
          vendor = { ...vendorByEmail, user_id: authData.user.id };
        }
      }

      if (!vendor) {
        // Auth exists but no profile? Should typically go to registration or profile completion
        // For now, let's treat as onboarding needed or error
        toast({ title: "Profile Missing", description: "Vendor profile not found. Please register.", variant: "destructive" });
        return;
      }

      const isVendorExplicitlyUnverified =
        vendor?.is_verified === false || vendor?.isVerified === false;
      if (isVendorExplicitlyUnverified) {
        try {
          await vendorApi.updateVendorVerification(authData.user.id, true);
          vendor = { ...vendor, is_verified: true, isVerified: true, is_active: true, isActive: true };
        } catch {
          try {
            // Fallback for legacy rows where user_id linkage is stale.
            const normalizedEmail = String(formData.email || '').trim().toLowerCase();
            await supabase
              .from('vendors')
              .update({
                is_verified: true,
                is_active: true,
                verified_at: new Date().toISOString(),
              })
              .ilike('email', normalizedEmail);
            vendor = { ...vendor, is_verified: true, isVerified: true, is_active: true, isActive: true };
          } catch {
            // If self-heal fails, continue login without OTP redirect.
          }
        }
      }

      // 3. Stamp role metadata to help route guards
      const currentRole = authData.user?.user_metadata?.role;
      if (currentRole !== 'VENDOR') {
        await supabase.auth.updateUser({ data: { role: 'VENDOR' } }).catch(() => {});
      }

      // 4. Success
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      navigate('/vendor/dashboard', { replace: true });
      // hard redirect as fallback in case router state is stale
      window.location.href = '/vendor/dashboard';

    } catch (error) {
      resetLoginCaptcha();
      toast({ 
        title: "Login Failed", 
        description: error.message || "Invalid credentials", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartCaptcha = () => {
    if (loading) return;
    captchaExecuteQueuedRef.current = true;
    loginCaptcha.resetCaptcha();
    setCaptchaStarted(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    const captchaError = loginCaptcha.getCaptchaError();
    if (captchaError) {
      toast({
        title: 'Captcha Required',
        description: 'Start and complete the security check before signing in.',
        variant: 'destructive',
      });
      return;
    }

    await performLogin();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <Logo />
      </div>
      
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-[#003D82]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-[#003D82]">Vendor Login</CardTitle>
          <CardDescription className="text-center">
            Access your seller dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="vendor@company.com" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/auth/forgot-password?role=VENDOR" className="text-sm text-[#003D82] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#003D82] hover:bg-[#002d62]" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Sign In
            </Button>

            <div className="flex flex-col items-center space-y-3">
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col items-center space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStartCaptcha}
                    disabled={loading}
                  >
                    {loginCaptcha.captchaToken
                      ? 'Run Security Check Again'
                      : captchaStarted
                        ? 'Retry Security Check'
                        : 'Start Security Check'}
                  </Button>

                  {captchaStarted ? (
                    <TurnstileField
                      action="auth_login"
                      appearance="execute"
                      className="mx-auto w-full max-w-[320px]"
                      execution="execute"
                      onWidgetReady={handleCaptchaWidgetReady}
                      refreshExpired="never"
                      refreshTimeout="never"
                      resetKey={loginCaptcha.captchaResetKey}
                      retry="never"
                      onTokenChange={loginCaptcha.setCaptchaToken}
                    />
                  ) : (
                    <p className="text-center text-xs text-gray-500">
                      Cloudflare verification will stay idle until you start it manually.
                    </p>
                  )}

                  <p className="text-center text-xs text-gray-500">
                    {loginCaptcha.captchaToken
                      ? 'Security verification complete. You can sign in now.'
                      : 'Complete the security check before signing in.'}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 bg-gray-50 rounded-b-lg">
          <div className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/vendor/register" className="font-semibold text-[#003D82] hover:underline inline-flex items-center">
              Register Now <ArrowRight className="ml-1 w-3 h-3" />
            </Link>
          </div>
        </CardFooter>
      </Card>
      
      <p className="mt-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} IndianTradeMart. All rights reserved.
      </p>
    </div>
  );
};

export default VendorLogin;
