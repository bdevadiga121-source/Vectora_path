import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  formatAuthError,
  signInAsAdminWithEmail,
  signInAsAdminWithGoogle,
} from '../api/client';
import type { AuthSession } from '../types';

interface AdminLoginViewProps {
  onAdminAuthenticated: (session: AuthSession) => void;
  onBackToStudentLogin: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onAdminAuthenticated,
  onBackToStudentLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your administrator email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await signInAsAdminWithEmail(email, password, passcode || undefined);
      onAdminAuthenticated(res.user);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await signInAsAdminWithGoogle(passcode || undefined);
      onAdminAuthenticated(res.user);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 bg-[radial-gradient(circle_at_top_right,rgba(106,90,205,0.22),transparent_45%),#1A1A1F]">
      <div className="w-full max-w-md rounded-[28px] bg-[#2D2B55] border border-[#6A5ACD]/55 border-t-[#A678B9]/60 p-7 sm:p-9 shadow-[0_32px_80px_rgba(8,6,18,0.72)] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1A1A1F] border border-[#F4A62A]/60 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#F4A62A]" />
            </div>
            <div>
              <div className="text-sm font-display font-bold text-[#F0D9B5]">Vectora Admin</div>
              <div className="text-[11px] font-mono text-[#F4A62A]">Protected Console Portal</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToStudentLogin}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D6C7DF] hover:text-[#F0D9B5] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Student Login</span>
          </button>
        </div>

        <div className="border-t border-[#6A5ACD]/35 pt-5">
          <h1 className="text-2xl font-display font-bold text-[#F0D9B5]">
            Administrator Sign In
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#D6C7DF]">
            Restricted to server-provisioned administrator accounts. Public registration cannot create administrator accounts.
          </p>
        </div>

        <form onSubmit={handleEmailAdminLogin} className="space-y-3.5">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
              Administrator Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@vectora.edu"
              className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-4 py-3 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] pl-4 pr-11 py-3 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A678B9] hover:text-[#F0D9B5] p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="admin-passcode" className="flex items-center gap-1.5 text-xs font-semibold text-[#D6C7DF] mb-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#F4A62A]" />
              <span>Access Code (if accepting an invite or configured)</span>
            </label>
            <input
              id="admin-passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Optional unless required by security policy"
              className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-4 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/55 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/50 bg-red-950/65 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#F4A62A] px-6 py-3.5 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors shadow-[0_10px_28px_rgba(244,166,42,0.25)]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>{loading ? 'Verifying Administrator...' : 'Sign In to Admin Console'}</span>
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#6A5ACD]/35" />
          <span className="text-xs text-[#D6C7DF]">or</span>
          <div className="h-px flex-1 bg-[#6A5ACD]/35" />
        </div>

        <button
          type="button"
          onClick={handleGoogleAdminLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#6A5ACD]/60 bg-[#1A1A1F] px-4 py-3 text-sm font-medium text-[#F0D9B5] hover:border-[#A678B9] disabled:opacity-60 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.8z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
            />
          </svg>
          <span>Verify Admin with Google</span>
        </button>
      </div>
    </div>
  );
};
