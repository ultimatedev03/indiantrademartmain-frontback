import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, CheckCircle2, Mail, ArrowLeft, ShieldCheck, User } from 'lucide-react';
import Logo from '@/shared/components/Logo';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { StateDropdown, CityDropdown } from '@/shared/components/LocationSelectors';

const OTP_TIMER_SECONDS = 600; // 10 minutes

const StepIndicator = ({ step }) => {
  const steps = [
    { num: 1, title: 'Basic Details', icon: User },
    { num: 2, title: 'Verification', icon: ShieldCheck }
  ];

  return (
    <div className="flex justify-between mb-8 relative max-w-[200px] mx-auto">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2" />
      {steps.map((s) => (
        <div key={s.num} className="flex flex-col items-center bg-gray-50 px-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
            step >= s.num ? 'border-[#00A699] bg-[#00A699] text-white' : 'border-gray-300 text-gray-400 bg-white'
          }`}>
            <s.icon className="h-4 w-4" />
          </div>
          <span className={`text-xs mt-1 font-medium ${step >= s.num ? 'text-[#00A699]' : 'text-gray-400'}`}>
            {s.title}
          </span>
        </div>
      ))}
    </div>
  );
};

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Details, 2: OTP, 3: Success
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(OTP_TIMER_SECONDS);
  const [otp, setOtp] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    state_id: '',
    city_id: '',
    state_name: '',
    city_name: '',
    password: '',
    confirm_password: ''
  });

  // Timer countdown
  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStateChange = (id, item) => {
    setFormData(prev => ({
      ...prev,
      state_id: id,
      state_name: item.name,
      city_id: '',
      city_name: ''
    }));
  };

  const handleCityChange = (id, item) => {
    setFormData(prev => ({
      ...prev,
      city_id: id,
      city_name: item.name
    }));
  };

  const validateStep1 = () => {
    if (formData.password !== formData.confirm_password) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return false;
    }
    if (formData.password.length < 8) {
      toast({ title: "Password too weak", description: "Min 8 chars required", variant: "destructive" });
      return false;
    }
    if (!formData.email.includes('@')) {
      toast({ title: "Invalid Email Address", variant: "destructive" });
      return false;
    }
    if (formData.phone.length !== 10 || isNaN(formData.phone)) {
      toast({ title: "Invalid Phone Number", description: "Must be 10 digits", variant: "destructive" });
      return false;
    }
    if (!formData.full_name || !formData.state_id || !formData.city_id) {
      toast({ title: "Missing Fields", description: "Please fill all required fields", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: 'BUYER'
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({ title: "Account Exists", description: "This email is already registered.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      setStep(2);
      setTimer(OTP_TIMER_SECONDS);
      setOtp('');
      toast({ title: "OTP Sent", description: `Verification code sent to ${formData.email}` });

    } catch (error) {
      console.error("Signup error:", error);
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ✅ OTP input handler: digits only + allow up to 8
  const handleOtpChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 8); // ✅ allow 8
    setOtp(cleaned);
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();

    const cleaned = (otp || '').replace(/\D/g, '');

    // ✅ accept 6–8 (or 4–8). Here we use 6–8 since you want OTP style
    if (cleaned.length < 6 || cleaned.length > 8) {
      toast({
        title: "Invalid OTP",
        description: "Email me jo code aaya hai wahi daalo (6–8 digits).",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // 1) Verify OTP (signup flow)
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: cleaned,
        type: 'signup'
      });

      if (verifyError) throw verifyError;

      const sessionUser = data?.session?.user || data?.user;
      if (!sessionUser?.id) {
        throw new Error("Verification failed. No user session created.");
      }

      const userId = sessionUser.id;

      // 2) Create Buyer Profile
      const { error: buyerError } = await supabase
        .from('buyers')
        .insert([{
          user_id: userId,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          company_name: formData.company_name,
          state_id: formData.state_id,
          city_id: formData.city_id,
          state: formData.state_name, // Legacy fallback
          city: formData.city_name,   // Legacy fallback
        }]);

      if (buyerError) throw buyerError;

      setStep(3);

      setTimeout(() => {
        navigate('/buyer/login');
      }, 3000);

    } catch (error) {
      console.error("Verification error:", error);
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });
      if (error) throw error;
      setTimer(OTP_TIMER_SECONDS);
      setOtp('');
      toast({ title: "OTP Resent", description: "Check your email inbox." });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
          {step === 1 && "Create Buyer Account"}
          {step === 2 && "Verify Email"}
          {step === 3 && "Registration Complete"}
        </h2>

        {step < 3 && <StepIndicator step={step} />}
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">

          {/* STEP 1: Basic Details */}
          {step === 1 && (
            <form className="space-y-6" onSubmit={handleStep1Submit}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input id="full_name" name="full_name" required className="mt-1" placeholder="John Doe" value={formData.full_name} onChange={handleChange} />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" name="email" type="email" required className="mt-1" placeholder="john@example.com" value={formData.email} onChange={handleChange} />
                </div>

                <div>
                  <Label htmlFor="phone">Mobile Number *</Label>
                  <Input id="phone" name="phone" type="tel" required className="mt-1" placeholder="10 digit number" maxLength={10} value={formData.phone} onChange={handleChange} />
                </div>

                <div>
                  <Label htmlFor="company_name">Company (Optional)</Label>
                  <Input id="company_name" name="company_name" className="mt-1" placeholder="Your Company" value={formData.company_name} onChange={handleChange} />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="address">Address (Optional)</Label>
                  <Input id="address" name="address" className="mt-1" placeholder="Street, Sector, Area" value={formData.address} onChange={handleChange} />
                </div>

                {/* LOCATION */}
                <div>
                  <Label className="block mb-1">State *</Label>
                  <StateDropdown value={formData.state_id} onChange={handleStateChange} />
                </div>

                <div>
                  <Label className="block mb-1">City *</Label>
                  <CityDropdown stateId={formData.state_id} value={formData.city_id} onChange={handleCityChange} />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input id="password" name="password" type="password" required className="mt-1" placeholder="Min 8 chars" value={formData.password} onChange={handleChange} />
                </div>

                <div>
                  <Label htmlFor="confirm_password">Confirm Password *</Label>
                  <Input id="confirm_password" name="confirm_password" type="password" required className="mt-1" placeholder="Re-enter password" value={formData.confirm_password} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 bg-[#00A699] hover:bg-[#008c81]"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign Up & Verify"} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-teal-50 p-3 rounded-full">
                  <Mail className="w-8 h-8 text-teal-600" />
                </div>
                <div className="text-center space-y-1">
                  <Label className="text-lg">One-Time Password</Label>
                  <p className="text-sm text-gray-500">
                    Enter the OTP sent to <strong>{formData.email}</strong>
                  </p>
                </div>

                <Input
                  value={otp}
                  onChange={handleOtpChange}
                  className="text-center text-2xl tracking-widest w-56 h-12 font-mono"
                  maxLength={8}               // ✅ 8 digits allowed
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="--------"
                />

                <div className="text-sm text-gray-500 flex flex-col items-center gap-1">
                  <span>Expires in: <span className="font-medium text-red-500">{formatTime(timer)}</span></span>
                  {timer === 0 && (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-teal-600 underline hover:text-teal-800"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-[#00A699] hover:bg-[#008c81]"
                  disabled={loading || otp.replace(/\D/g, '').length < 6} // ✅ not fixed to 6 only
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Create Account"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in zoom-in duration-300">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Success!</h3>
              <p className="text-center text-gray-500 max-w-xs">
                Your buyer account has been created successfully. Redirecting to login...
              </p>
              <Button onClick={() => navigate('/buyer/login')} className="mt-4 bg-[#00A699]">
                Go to Login Now
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Already have an account?
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/buyer/login"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Sign in instead
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Register;
