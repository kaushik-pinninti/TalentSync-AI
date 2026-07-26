import React, { useState, useEffect } from "react";
import { Database, Server, Key, Shield, Sparkles, AlertTriangle, Cpu, Check, X, RefreshCw, History, Lock, Unlock, Loader2, Laptop, Moon } from "lucide-react";

interface SettingsSectionProps {
  user: { name: string; email: string; company: string; two_factor_enabled?: boolean } | null;
  theme?: string;
  onThemeChange?: (theme: "light" | "dark") => void;
}

export default function SettingsSection({ user }: SettingsSectionProps) {
  // Existing stats
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 2FA management states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [toggling2FA, setToggling2FA] = useState(false);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Password rotation states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Security logs states
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Apple Digital Product Aesthetic CSS Sandbox state
  const [accentHovered, setAccentHovered] = useState(false);

  // Live Password Metrics for rotation
  const hasMinLength = newPassword.length >= 8;
  const MathUpper = /[A-Z]/.test(newPassword);
  const MathLower = /[a-z]/.test(newPassword);
  const MathNumber = /[0-9]/.test(newPassword);
  const MathSpecial = /[@$!%*?&_#^]/.test(newPassword);
  const isNewPasswordValid = hasMinLength && MathUpper && MathLower && MathNumber && MathSpecial;

  // Fetch initial diagnostics
  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error("Health check error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch personalized security audit logs
  const fetchSecurityLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/auth/audit-logs", {
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setSecurityLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load security audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchSecurityLogs();
    
    // Check initial user session 2FA status
    if (user) {
      // Let's check 2FA on start via endpoint
      const checkSession = async () => {
        try {
          const res = await fetch("/api/auth/me", {
            headers: { "X-Requested-With": "XMLHttpRequest" }
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setTwoFactorEnabled(data.user.two_factor_enabled);
          }
        } catch (e) {
          console.error("Failed checking user info", e);
        }
      };
      checkSession();
    }
  }, [user]);

  // Handle Two-Factor Activation Toggle
  const handleToggle2FA = async () => {
    setToggling2FA(true);
    setTwoFactorSuccess(null);
    setTwoFactorError(null);
    const targetState = !twoFactorEnabled;

    try {
      const res = await fetch("/api/auth/setup-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ enable: targetState })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to alter 2FA status");
      }

      setTwoFactorEnabled(targetState);
      if (targetState) {
        setTwoFactorSecret(data.secret);
        setTwoFactorSuccess("Two-Factor Authentication is now active! Please note down your secret key.");
      } else {
        setTwoFactorSecret(null);
        setTwoFactorSuccess("Two-Factor Authentication has been successfully deactivated.");
      }
      
      // Refresh audit logs
      fetchSecurityLogs();
    } catch (err: any) {
      setTwoFactorError(err.message || "An error occurred setting up 2FA.");
    } finally {
      setToggling2FA(false);
    }
  };

  // Handle Password Rotation Submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!isNewPasswordValid) {
      setPasswordError("Please meet all password requirement checklist items before submitting.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update your credentials.");
      }

      setPasswordSuccess("Your security password has been successfully updated!");
      setCurrentPassword("");
      setNewPassword("");
      
      // Refresh audit logs
      fetchSecurityLogs();
    } catch (err: any) {
      setPasswordError(err.message || "An error occurred during password rotation.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Header Area */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-extrabold text-white tracking-tight font-sans">System Settings & Security</h2>
          <p className="text-xs text-neutral-450 mt-1">Manage recruiter profiles, two-factor authentication, password rotation, and audit logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Card & Service Diagnostics Column */}
        <div className="space-y-6 animate-fade-in">
          
          {/* Profile Card */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="flex items-center gap-2.5 text-white border-b border-white/10 pb-3.5">
              <Shield className="h-4.5 w-4.5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm tracking-tight">Recruiter Profile Details</h3>
            </div>
            
            {user ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Full Name</span>
                  <p className="text-sm text-neutral-200 mt-1 font-semibold">{user.name}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Work Email</span>
                  <p className="text-sm text-neutral-200 mt-1 font-semibold truncate" title={user.email}>{user.email}</p>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Organization / Company</span>
                  <p className="text-sm text-neutral-200 mt-1 font-semibold">{user.company}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-450 italic font-medium">No recruiter session detected.</p>
            )}
          </div>

          {/* Integration Services Diagnostics */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="flex items-center gap-2.5 text-white border-b border-white/10 pb-3.5">
              <Server className="h-4.5 w-4.5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm tracking-tight">Integration Services Diagnostics</h3>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-neutral-450 py-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-450" />
                <span>Polling secure service nodes...</span>
              </div>
            ) : health ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-neutral-500" />
                      Database Engine Connection
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {health.database === "PostgreSQL (Neon)" 
                        ? "Connected securely to live enterprise relational Neon PostgreSQL database cluster."
                        : "Operating on standalone local JSON file database storage (Trial sandbox mode)."}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border rounded-full shrink-0 font-mono ${
                    health.database === "PostgreSQL (Neon)"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-white/5 text-neutral-300 border-white/10"
                  }`}>
                    {health.database === "PostgreSQL (Neon)" ? "Neon Postgres" : "Local Trial"}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-white/5 pt-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-neutral-500" />
                      Gemini AI Engine
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {health.ai_engine === "Gemini Live"
                        ? "Connection established to Gemini cloud API endpoint. Advanced parsing, resume categorization, matching and copilot are live."
                        : "Trial simulation active. Add GEMINI_API_KEY environment variable to enable native cloud scanning."}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border rounded-full shrink-0 font-mono ${
                    health.ai_engine === "Gemini Live"
                      ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                  }`}>
                    {health.ai_engine === "Gemini Live" ? "Active (Gemini)" : "Simulation"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Fullstack application server is currently unresponsive.</span>
              </div>
            )}
          </div>
        </div>

        {/* Two-Factor Authentication Security Settings */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <Key className="h-4.5 w-4.5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm tracking-tight">Two-Factor Authentication (2FA)</h3>
            </div>
            <div className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-full font-mono ${
              twoFactorEnabled ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-neutral-400 border-white/10"
            }`}>
              {twoFactorEnabled ? "Active" : "Disabled"}
            </div>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Protect your recruiter dashboard from password breaches. With Two-Factor Authentication active, each login attempt will trigger a secondary verification challenge requiring a one-time passcode generated by your mobile authenticator client.
          </p>

          <div className="flex items-center justify-between p-4 bg-white/2 border border-white/10 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white">2FA Access Challenge</span>
              <p className="text-[11px] text-neutral-450 font-medium">Verify credentials on authentication</p>
            </div>

            <button
              id="settings-2fa-toggle-btn"
              onClick={handleToggle2FA}
              disabled={toggling2FA}
              className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition flex items-center gap-2 ${
                twoFactorEnabled 
                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20" 
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-indigo-500/15 text-white shadow-md shadow-indigo-600/10"
              }`}
            >
              {toggling2FA ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : twoFactorEnabled ? (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  Deactivate 2FA
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Activate 2FA
                </>
              )}
            </button>
          </div>

          {twoFactorSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold">
              {twoFactorSuccess}
            </div>
          )}

          {twoFactorError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold">
              {twoFactorError}
            </div>
          )}

          {twoFactorSecret && (
            <div className="p-4 bg-white/2 border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
                <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                <span>Your Secure 2FA Secret Key</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                Please add this secret code inside Google Authenticator or Microsoft Authenticator.
              </p>
              <div className="p-3.5 bg-[#09090b]/40 rounded-xl border border-white/15 text-center select-all cursor-copy">
                <code className="text-sm font-mono text-indigo-400 font-extrabold tracking-wider">{twoFactorSecret}</code>
              </div>
            </div>
          )}
        </div>

        {/* Password Rotation Policy Controls */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2.5 text-white border-b border-white/10 pb-3.5">
            <Lock className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm tracking-tight">Credential Rotation Policy</h3>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Update your account password regularly to prevent unauthorized access. Updates are validated in real-time against strict corporate complexity requirements.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider font-mono">Current Password</label>
              <input
                id="settings-curr-pass"
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white/5 hover:bg-[#09090b]/40 focus:bg-[#09090b]/60 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-500 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider font-mono">New Password</label>
              <input
                id="settings-new-pass"
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white/5 hover:bg-[#09090b]/40 focus:bg-[#09090b]/60 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-500 transition"
              />
            </div>

            {/* Dynamic Password Rotation Checklist */}
            {newPassword && (
              <div className="p-3.5 bg-[#09090b]/40 border border-white/10 rounded-xl space-y-1.5 text-xs text-neutral-400">
                <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-400">Complexity Checklist</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] mt-1.5">
                  <div className="flex items-center gap-1.5">
                    {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <span className={hasMinLength ? "text-emerald-400 font-semibold" : "text-neutral-500"}>8+ Characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {MathUpper ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <span className={MathUpper ? "text-emerald-400 font-semibold" : "text-neutral-500"}>1 Uppercase (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {MathLower ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <span className={MathLower ? "text-emerald-400 font-semibold" : "text-neutral-500"}>1 Lowercase (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {MathNumber ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <span className={MathNumber ? "text-emerald-400 font-semibold" : "text-neutral-500"}>1 Number (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {MathSpecial ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <span className={MathSpecial ? "text-emerald-400 font-semibold" : "text-neutral-500"}>1 Symbol (@$!%*?)</span>
                  </div>
                </div>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold">
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold">
                {passwordError}
              </div>
            )}

            <button
              id="settings-password-btn"
              type="submit"
              disabled={changingPassword || !isNewPasswordValid}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              {changingPassword ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin-once" />
                  Rotate Account Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* APPLE DIGITAL PRODUCT AESTHETIC CSS SANDBOX */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6 lg:col-span-2 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm tracking-tight">Apple Premium CSS Design System Sandbox</h3>
              </div>
              <p className="text-xs text-neutral-450 leading-relaxed font-medium">
                Verify and interact with the production-grade custom properties (CSS variables) system mapping out the Pro Dark layout.
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-xs text-neutral-300 font-semibold">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Pro Dark System Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {/* Tokens Specification Column */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                1. Custom Properties (CSS Tokens) Configuration
              </h4>
              <div className="space-y-3">
                <div className="p-4 bg-[#09090b]/60 border border-white/15 rounded-xl font-mono text-[11px] text-indigo-300 space-y-2 select-all leading-relaxed font-semibold">
                  <span className="text-neutral-400 font-bold block border-b border-white/5 pb-1 mb-2">CSS Architecture Tokens (Pro Dark mode active)</span>
                  <div>{`--apple-bg-canvas: `}<span className="text-emerald-400 font-bold">#070709</span><span className="text-neutral-500">; /* OLED Base */</span></div>
                  <div>{`--apple-bg-card: `}<span className="text-emerald-400 font-bold">#121215</span><span className="text-neutral-500">; /* Elevated Charcoal */</span></div>
                  <div>{`--apple-text-primary: `}<span className="text-emerald-400 font-bold">#FFFFFF</span><span className="text-neutral-500">; /* Text Headers */</span></div>
                  <div>{`--apple-text-secondary: `}<span className="text-emerald-400 font-bold">#A1A1AA</span><span className="text-neutral-500">; /* Secondary Copy */</span></div>
                  <div>{`--apple-border: `}<span className="text-emerald-400 font-bold">rgba(255,255,255,0.08)</span><span className="text-neutral-500">; /* Subdued lines */</span></div>
                  <div>{`--apple-accent: `}<span className="text-emerald-400 font-bold">#3B82F6</span><span className="text-neutral-500">; /* Interactive CTA */</span></div>
                  <div>{`--apple-accent-hover: `}<span className="text-emerald-400 font-bold">#60A5FA</span><span className="text-neutral-500">; /* Hover accessibility */</span></div>
                  <div>{`--apple-radius-bento: `}<span className="text-amber-400">18px</span>;</div>
                  <div>{`--apple-radius-pill: `}<span className="text-amber-400">980px</span>;</div>
                  <div>{`--apple-transition: `}<span className="text-neutral-300">0.4s ease</span>;</div>
                </div>

                {/* Color Balancing Rule Metrics */}
                <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Color Distribution Rule</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-bold font-mono">Compliant</span>
                  </div>
                  <div className="flex h-3.5 rounded-full overflow-hidden border border-white/5 bg-neutral-900">
                    <div className="bg-neutral-200 w-[70%] flex items-center justify-center text-[8px] font-bold text-black" title="70% Background Canvas">70% Bg</div>
                    <div className="bg-neutral-600 w-[20%] flex items-center justify-center text-[8px] font-bold text-white" title="20% Text Headers">20% Text</div>
                    <div className="bg-blue-500 w-[10%] flex items-center justify-center text-[8px] font-bold text-white" title="Under 10% Accents">&lt;10% Int</div>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed mt-1 font-medium">
                    Exactly adheres to the design specification: <strong>70% background</strong>, <strong>20% text hierarchy</strong>, and <strong>under 10% interactive accent color</strong> for clean semantic focus.
                  </p>
                </div>
              </div>
            </div>

            {/* Apple Feature Block Live Card Column */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                2. Live Rendered Custom Properties Feature Block
              </h4>

              {/* LIVE FEATURE BLOCK CARD (COMPACT BENTO RADIUS) */}
              <div 
                id="apple-feature-block-card"
                className="p-6 relative select-none bg-[#070709] border border-white/10 rounded-[18px] text-white shadow-2xl"
              >
                {/* Content inner card */}
                <div 
                  className="p-5 bg-[#121215] rounded-[18px]"
                >
                  {/* Category Tracker Tag */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 font-mono">PRO SPECS</span>
                  </div>

                  {/* Heading */}
                  <h3 className="text-lg font-bold tracking-tight mb-2 text-white font-sans">
                    MacBook Pro. Mind-blowing.
                  </h3>

                  {/* Paragraph description */}
                  <p className="text-xs leading-relaxed mb-4 font-normal text-neutral-400 font-sans">
                    A beautiful, unified layout configured with premium Apple Pro Dark aesthetics.
                  </p>

                  {/* Adaptive divider line */}
                  <hr className="my-4 border-t border-white/10" />

                  {/* Actionable button (Pill layout) */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-neutral-400">
                      Pro Dark Mode Active
                    </span>

                    <button
                      id="apple-feature-cta-btn"
                      type="button"
                      onMouseEnter={() => setAccentHovered(true)}
                      onMouseLeave={() => setAccentHovered(false)}
                      style={{
                        backgroundColor: accentHovered ? "#2997FF" : "#0066CC",
                        color: "#FFFFFF",
                        padding: "8px 16px",
                        borderRadius: "980px", // Fluid pill layout
                        fontSize: "11px",
                        fontWeight: "600",
                        letterSpacing: "-0.01em",
                        boxShadow: accentHovered ? "0 4px 12px rgba(0, 102, 204, 0.4)" : "none",
                        transition: "all 0.3s ease",
                        transform: accentHovered ? "scale(1.02)" : "scale(1)",
                        cursor: "pointer"
                      }}
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security AuditLogs */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4 lg:col-span-2 animate-fade-in">
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <History className="h-4.5 w-4.5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm tracking-tight">Security Audit Logs</h3>
            </div>
            <button
              id="refresh-logs-btn"
              onClick={fetchSecurityLogs}
              disabled={loadingLogs}
              className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <RefreshCw className={`h-3 w-3 ${loadingLogs ? "animate-spin" : ""}`} />
              Reload audit trail
            </button>
          </div>

          <p className="text-xs text-neutral-450 leading-relaxed font-medium">
            Review login challenges, 2FA setup modifications, and profile changes. These records are securely logged and stamped with origin IP coordinates.
          </p>

          <div className="max-h-60 overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5 bg-[#09090b]/40 custom-scrollbar">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8 text-xs text-neutral-400 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Syncing audit trail events...</span>
              </div>
            ) : securityLogs.length > 0 ? (
              securityLogs.map((log) => {
                const isFailure = log.action?.includes("FAIL") || log.action?.includes("BLOCKED");
                const isConfig = log.action?.includes("UPDATE") || log.action?.includes("DELETE") || log.action?.includes("ENABLE") || log.action?.includes("DISABLE");

                return (
                  <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-white/5 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full border ${
                          isFailure 
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/20" 
                            : isConfig 
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/20" 
                              : "bg-white/5 text-neutral-300 border-white/10"
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-neutral-450 font-mono">{log.ip_address}</span>
                      </div>
                      <p className="text-xs text-neutral-200 font-semibold">{log.details}</p>
                    </div>

                    <span className="text-[10px] font-mono text-neutral-450 shrink-0 text-right whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-neutral-450 font-semibold italic">
                No recent security activity logs captured in this session.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
