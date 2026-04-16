'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Mountain, Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, UserCheck, ShieldCheck, Zap, HardHat } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signInAsGuest } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError('Credenciales inválidas. Contacte al administrador.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const { error } = await signInAsGuest();
    if (error) {
      setError('No se pudo iniciar sesión como observador. Verifica la configuración de Supabase.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left Panel — Brand Identity ── */}
      <div className="hidden lg:flex lg:w-[46%] bg-[#F3EDE2] relative flex-col justify-between p-12 overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700" />

        {/* Subtle topo texture */}
        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <pattern id="topo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <ellipse cx="40" cy="40" rx="35" ry="22" fill="none" stroke="#92400E" strokeWidth="0.6" opacity="0.12" />
              <ellipse cx="40" cy="40" rx="22" ry="13" fill="none" stroke="#92400E" strokeWidth="0.5" opacity="0.10" />
              <ellipse cx="40" cy="40" rx="10" ry="6" fill="none" stroke="#92400E" strokeWidth="0.4" opacity="0.08" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)" />
        </svg>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-amber-700 p-2.5 rounded-lg shadow-sm">
            <Mountain className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-[0.18em] text-stone-800 uppercase">MINE OS</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="w-10 h-0.5 bg-amber-700 mb-7" />
          <h2 className="text-[2rem] font-bold text-stone-800 leading-snug mb-4">
            Plataforma de<br />Gestión Minera
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed max-w-[18rem]">
            Sistema integral para el monitoreo, control y análisis de operaciones mineras en tiempo real.
          </p>

          <div className="mt-9 space-y-4">
            {[
              { icon: ShieldCheck, label: 'Control de acceso y seguridad' },
              { icon: Zap,         label: 'Monitoreo en tiempo real' },
              { icon: HardHat,     label: 'Gestión de operaciones' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-amber-700/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <span className="text-sm text-stone-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom system info */}
        <div className="relative z-10 pt-5 border-t border-stone-300/60 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-stone-400">MINE OS v0.1.0</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-stone-400">Sistema Online</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="w-full lg:w-[54%] flex flex-col bg-[#F5F4F1]">
        {/* Top accent bar (mobile only) */}
        <div className="lg:hidden h-1 w-full bg-amber-700" />

        <div className="flex-1 flex items-center justify-center px-6 py-14 sm:px-10">
          <div className="w-full max-w-[420px]">

            {/* Mobile brand header */}
            <div className="lg:hidden flex flex-col items-center mb-10">
              <div className="bg-amber-700 p-3 rounded-xl shadow-sm mb-4">
                <Mountain className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-[0.14em] text-stone-800 uppercase">MINE OS</h1>
              <p className="text-[11px] text-stone-400 tracking-widest uppercase mt-1.5">Sistema de Gestión Minera</p>
            </div>

            {/* ── Form Card ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 overflow-hidden">

              {/* Amber top accent */}
              <div className="h-[3px] bg-amber-700" />

              <div className="px-8 pt-9 pb-8 sm:px-10 sm:pt-10 sm:pb-9">

                {/* Heading */}
                <div className="mb-9">
                  <h2 className="text-[1.6rem] font-bold text-stone-800 tracking-tight leading-tight">
                    Iniciar Sesión
                  </h2>
                  <p className="text-sm text-stone-400 mt-2 leading-relaxed">
                    Ingrese sus credenciales para acceder al sistema
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* Email */}
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="block text-sm font-semibold text-stone-600">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <Mail className="w-4 h-4 text-stone-400" />
                      </div>
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-300 focus:bg-white focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/10 transition-all"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label htmlFor="login-password" className="block text-sm font-semibold text-stone-600">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <Lock className="w-4 h-4 text-stone-400" />
                      </div>
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-12 text-sm text-stone-800 placeholder:text-stone-300 focus:bg-white focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/10 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-600">
                      <AlertCircle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-amber-700 px-6 py-3.5 text-sm font-semibold text-white tracking-wide transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <span>Ingresar al Sistema</span>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">o continúa como</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Guest button */}
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-6 py-3.5 text-sm font-medium text-stone-600 transition-all hover:bg-white hover:border-gray-300 hover:shadow-sm active:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <UserCheck className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <span>Entrar como Observador</span>
                  <span className="ml-auto rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Solo lectura
                  </span>
                </button>

              </div>
            </div>

            {/* Footer note — outside card */}
            <p className="mt-6 text-center text-[11px] leading-relaxed text-stone-400">
              Acceso restringido a personal autorizado.<br />
              Toda actividad es monitoreada y registrada.
            </p>

          </div>
        </div>

        {/* Bottom footer strip */}
        <footer className="border-t border-gray-200/60 bg-white/60 px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-700/80">MINE OS v0.1.0 — Plataforma Minera</span>
          <div className="flex items-center gap-5">
            {['Privado', 'Seguro', 'Auditable'].map((label) => (
              <span key={label} className="text-[10px] uppercase tracking-widest font-semibold text-stone-400">{label}</span>
            ))}
          </div>
        </footer>
      </div>

    </div>
  );
}
