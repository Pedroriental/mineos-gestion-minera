'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { MineosLogo } from '@/components/brand/MineosLogo';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  UserCheck,
} from 'lucide-react';

export function MobileLoginPage() {
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
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError('Credenciales inválidas.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const { error: guestError } = await signInAsGuest();
    if (guestError) {
      setError('No se pudo acceder como observador.');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="mobile-login">
      <div className="mobile-login__ambient" aria-hidden />
      <div className="mobile-login__strata" aria-hidden>
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="h-full w-full">
          <path className="mobile-login__strata-1" d="M0,48 L400,32 L400,72 L0,88 Z" />
          <path className="mobile-login__strata-2" d="M0,72 L400,58 L400,96 L0,110 Z" />
          <path className="mobile-login__strata-3" d="M0,96 L400,88 L400,120 L0,120 Z" />
        </svg>
      </div>

      <div className="mobile-login__shell">
        <header className="mobile-login__topbar">
          <div className="mobile-login__logo-wrap">
            <MineosLogo variant="logotipo" className="mobile-login__logo" alt="MineOS" />
          </div>
        </header>

        <main className="mobile-login__main">
          <div className="mobile-login__intro">
            <h1 className="mobile-login__title">Bienvenido</h1>
            <p className="mobile-login__subtitle">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mobile-login__form">
            <div className="mobile-login__field">
              <label htmlFor="m-email" className="mobile-login__label">
                Email
              </label>
              <div className="mobile-login__input-wrap">
                <Mail className="mobile-login__input-icon" strokeWidth={2} />
                <input
                  id="m-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="mobile-login__input"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="mobile-login__field">
              <label htmlFor="m-password" className="mobile-login__label">
                Contraseña
              </label>
              <div className="mobile-login__input-wrap">
                <Lock className="mobile-login__input-icon" strokeWidth={2} />
                <input
                  id="m-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mobile-login__input mobile-login__input--password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="mobile-login__input-action"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mobile-login__options">
              <span className="mobile-login__options-spacer" aria-hidden />
              <button type="button" className="mobile-login__link">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error ? (
              <div role="alert" className="mobile-login__error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mobile-login__submit"
            >
              <span className="mobile-login__submit-shine" aria-hidden />
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Ingresar al sistema'
              )}
            </button>

            <div className="mobile-login__divider" role="presentation">
              <span className="mobile-login__divider-line" />
              <span className="mobile-login__divider-text">O</span>
              <span className="mobile-login__divider-line" />
            </div>

            <div className="mobile-login__alt-row">
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loading}
                className="mobile-login__alt"
              >
                <UserCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>Observador</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
