'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useRouter } from 'next/navigation';
import { MineIcon } from '@/components/login/MineIcon';
import { GeologyStrataPanel } from '@/components/login/GeologyStrataPanel';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  UserCheck,
  ShieldCheck,
  Zap,
  HardHat,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react';

const FEATURES = [
  { icon: ShieldCheck, label: 'Control de acceso y seguridad' },
  { icon: Zap, label: 'Monitoreo en tiempo real' },
  { icon: HardHat, label: 'Gestión de operaciones' },
] as const;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signInAsGuest } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError('Credenciales inválidas. Contacte al administrador.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const { error: guestError } = await signInAsGuest();
    if (guestError) {
      setError('No se pudo iniciar sesión como observador. Verifica la configuración de Supabase.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="login-page flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Panel izquierdo — 60% */}
      <aside className="sidebar-section shrink-0 lg:min-h-0">
        <GeologyStrataPanel />

        <header className="brand-header">
          <div className="brand-logo">
            <MineIcon size={20} />
          </div>
          <span className="brand-name">Mine OS</span>
        </header>

        <div className="info-block">
          <div className="info-accent-line" aria-hidden />
          <h1 className="info-title">
            Plataforma de
            <br />
            Gestión Minera
          </h1>
          <p className="info-desc">
            Sistema integral para el monitoreo, control y análisis de operaciones mineras en tiempo
            real.
          </p>

          <ul className="features-list">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="feature-item">
                <span className="feature-icon">
                  <Icon size={18} strokeWidth={2} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Panel derecho — login 40% */}
      <section className="login-section min-h-0 flex-1">
        <div className="login-wrapper w-full">
          <div className="login-card">
            <h2 className="login-title">Iniciar Sesión</h2>
            <p className="login-subtitle">Ingrese sus credenciales para acceder al sistema</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="login-email" className="form-label">
                  Correo electrónico
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <Mail size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="form-input"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="login-password" className="form-label">
                  Contraseña
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <Lock size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-input form-input-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="login-error">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  'Ingresar al Sistema'
                )}
              </button>
            </form>

            <p className="divider">O CONTINÚA COMO</p>

            <button
              type="button"
              className="observer-block"
              onClick={handleGuestLogin}
              disabled={loading}
            >
              <span className="observer-left">
                <UserCheck size={18} strokeWidth={2} />
                Entrar como Observador
                <span className="badge-read-only">SOLO LECTURA</span>
              </span>
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>

          <p className="legal-notice">
            Acceso restringido a personal autorizado.
            <br />
            Toda actividad es monitoreada y registrada.
          </p>
        </div>

      </section>
      </div>

      <footer className="login-global-footer shrink-0">
        <div className="login-global-footer-inner">
          <div className="login-footer-version">MINE OS V0.1.0 — Plataforma Minera</div>
          <p className="login-footer-attributes">
            <span>Privado</span>
            <span className="login-footer-dot" aria-hidden>•</span>
            <span>Seguro</span>
            <span className="login-footer-dot" aria-hidden>•</span>
            <span>Auditable</span>
          </p>
          <div className="login-footer-right">
            <span className="status-online">
              <span className="status-dot" aria-hidden />
              Sistema Online
            </span>
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label={isDark ? 'Activar modo diurno' : 'Activar modo nocturno'}
            >
              <Sun className="sun-icon" size={18} strokeWidth={2} />
              <Moon className="moon-icon" size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
