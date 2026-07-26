import React, { useState } from "react";
import { Briefcase, Building, Key, Mail, Shield, Sparkles, User, UserPlus, Check, X, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
// @ts-ignore
import talentsyncLogo from "../assets/images/talentsync_logo_1784467747926.jpg";

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: { id: number; email: string; name: string; company: string; role?: string; status?: string }) => void;
  onEnterCareersPortal: () => void;
}

export default function AuthScreen({ onAuthSuccess, onEnterCareersPortal }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA login challenge states
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Real-time password complexity metrics
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&_#^]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isLogin && !isPasswordValid) {
      setError("Please satisfy all password complexity rules before registering.");
      setLoading(false);
      return;
    }

    const url = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const body = isLogin ? { email, password } : { email, password, name, company };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Check if 2FA verification is requested
      if (data.require2FA) {
        setShow2FA(true);
        setTempToken(data.tempToken);
        setTwoFactorCode("");
      } else {
        onAuthSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError("Please enter a valid 6-digit authentication code.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ tempToken, code: twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "2FA verification failed");
      }
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Incorrect verification code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // Automatically register or log in a sandbox user
      const sandboxEmail = "recruiter.demo@enterprise.ai";
      const sandboxPassword = "SandboxDemoPassword123!";
      
      let res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ email: sandboxEmail, password: sandboxPassword }),
      });

      if (!res.ok) {
        // If not exists, sign up first
        res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: JSON.stringify({
            email: sandboxEmail,
            password: sandboxPassword,
            name: "Alexander Mercer",
            company: "Apex Technologies"
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sandbox login failed");
      }

      if (data.require2FA) {
        setShow2FA(true);
        setTempToken(data.tempToken);
        setTwoFactorCode("");
      } else {
        onAuthSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError("Failed to launch Sandbox Demo. Please try manually signing up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen-container" className="min-h-screen w-full flex items-center justify-center bg-[#070709] text-white px-4 py-12 relative overflow-hidden">
      {/* Aurora Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-tr from-indigo-600/10 to-purple-600/5 blur-[120px] animate-blob-1" />
        <div className="absolute bottom-[10%] right-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-blue-600/10 to-cyan-600/5 blur-[110px] animate-blob-2" />
        <div className="noise-overlay" />
        <div className="absolute inset-0 linear-grid opacity-[0.25]" />
      </div>

      <motion.div 
         initial={{ opacity: 0, y: 30 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.75, ease: "easeOut" }}
         className="w-full max-w-md glass-panel rounded-3xl p-8 sm:p-10 z-10 relative"
      >
        {/* Platform Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-1 bg-white/5 border border-white/10 rounded-2xl mb-4 overflow-hidden w-20 h-20 shadow-lg shadow-indigo-500/10">
            <img
              src={talentsyncLogo}
              alt="TalentSync Logo"
              className="w-full h-full object-cover rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans text-gradient-apple">TalentSync AI</h1>
          <p className="text-neutral-400 text-xs mt-2 font-mono">Enterprise Resume Screening & AI Hiring Copilot</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 2FA Form Section */}
        {show2FA ? (
          <form onSubmit={handleVerify2FA} className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center">
              <Shield className="h-8 w-8 text-indigo-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-sm font-semibold text-white">Two-Factor Verification Required</h2>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Enter the 6-digit authentication code sent to your registered email account to verify your identity.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-wider font-mono">Verification Code</label>
              <input
                id="two-factor-code-input"
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center text-xl font-mono tracking-widest px-4 py-3 bg-white/5 border border-white/10 rounded-xl placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition duration-300"
              />
            </div>

            <button
              id="two-factor-verify-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-xs font-semibold rounded-xl text-white shadow-lg shadow-indigo-600/20 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verify Identity</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <div className="text-center">
              <button
                id="two-factor-back-btn"
                type="button"
                onClick={() => {
                  setShow2FA(false);
                  setError("");
                }}
                className="text-xs font-medium text-neutral-400 hover:text-white transition-colors duration-300"
              >
                Back to Sign In
              </button>
            </div>

            {/* Sandbox Notice */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 leading-relaxed font-mono">
              <strong className="font-bold">Sandbox Notice:</strong> For testing ease, your single-use login code was printed to the developer terminal logs and queued as a notification.
            </div>
          </form>
        ) : (
          /* Main Authentication Signup/Login Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-wider font-mono">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition duration-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-wider font-mono">Company Name</label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                    <input
                      id="reg-company"
                      type="text"
                      required
                      placeholder="Stripe, Inc."
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition duration-300"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-wider font-mono">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="recruiter@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 mb-2 uppercase tracking-wider font-mono">Password</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition duration-300"
                />
              </div>
            </div>

            {/* Password Complexity Checklist - Only displayed in Registration mode */}
            {!isLogin && password && (
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2 text-[11px] text-neutral-400">
                <p className="font-semibold text-neutral-300">Password Requirements Checklist:</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />}
                    <span className={hasMinLength ? "text-emerald-400" : "text-neutral-500"}>8+ Characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasUpper ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />}
                    <span className={hasUpper ? "text-emerald-400" : "text-neutral-500"}>1 Uppercase</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasLower ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />}
                    <span className={hasLower ? "text-emerald-400" : "text-neutral-500"}>1 Lowercase</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />}
                    <span className={hasNumber ? "text-emerald-400" : "text-neutral-500"}>1 Number</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasSpecial ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />}
                    <span className={hasSpecial ? "text-emerald-400" : "text-neutral-500"}>1 Symbol</span>
                  </div>
                </div>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading || (!isLogin && !isPasswordValid)}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-xs font-semibold rounded-xl text-white shadow-lg shadow-indigo-600/20 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <>Sign In</>
              ) : (
                <>Create Recruiter Account</>
              )}
            </button>
          </form>
        )}

        {!show2FA && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-y-1/2 left-0 right-0 border-t border-white/5" />
              <span className="relative bg-[#070709] px-3 text-neutral-500 text-[10px] uppercase tracking-wider font-mono">or</span>
            </div>

            {/* Demo Fast-Track button */}
            <button
              id="sandbox-onboarding-btn"
              onClick={handleSandboxLogin}
              disabled={loading}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold rounded-xl text-neutral-200 shadow-xs transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
              <span>Onboard via Trial Sandbox Dashboard</span>
            </button>

            <div className="text-center mt-6">
              <button
                id="auth-toggle-mode-btn"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-xs text-neutral-400 hover:text-white transition duration-300"
              >
                {isLogin ? (
                  <span className="inline-flex items-center gap-1">New to TalentSync? <b className="font-semibold text-indigo-400 hover:text-indigo-300 transition duration-300 inline-flex items-center gap-1">Register Here <UserPlus className="h-3.5 w-3.5" /></b></span>
                ) : (
                  <span className="inline-flex items-center gap-1">Already registered? <b className="font-semibold text-indigo-400 hover:text-indigo-300 transition duration-300 inline-flex items-center gap-1">Log In <Briefcase className="h-3.5 w-3.5" /></b></span>
                )}
              </button>
            </div>

            {/* Candidate Public Career Portal Option */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-3">
              <p className="text-[11px] text-neutral-400">Looking for your next career move?</p>
              <button
                id="portal-candidate-access-btn"
                type="button"
                onClick={onEnterCareersPortal}
                className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-bold rounded-xl text-indigo-400 transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="h-4 w-4" />
                <span>Browse Jobs & Apply via AI</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
