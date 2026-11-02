'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/api/client';
import { useNavigate } from '@/lib/navigation';

import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import ThemeToggle from '@/components/marketing/ThemeToggle';
import Brand from '@/components/Brand';
import { QrCode, Mail, LockKeyhole } from 'lucide-react';

const googleErrors = {
  google_cancelled: 'Cancelaste el acceso con Google. Puedes intentarlo nuevamente o entrar con tu correo.',
  google_session_expired: 'El acceso con Google expiró. Vuelve a pulsar “Continuar con Google”.',
  google_failed: 'No se pudo completar el acceso con Google. Inténtalo nuevamente.',
};

function Auth() {
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('register') !== 'true');
  const [confirmation, setConfirmation] = useState(null);
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState(searchParams.get('verified') ? 'Correo verificado. Ya puedes iniciar sesión.' : '');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState(() => {
    const code = searchParams.get('error');
    return Object.hasOwn(googleErrors, code) ? googleErrors[code] : '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isBusy = isLoading || isGoogleLoading;
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // A browser Back from Google may restore this page with its pending state.
    const resetGoogleLoading = () => setIsGoogleLoading(false);
    window.addEventListener('pageshow', resetGoogleLoading);
    return () => window.removeEventListener('pageshow', resetGoogleLoading);
  }, []);

  const handleGoogle = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const { data } = await api.post('/api/auth/google');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el acceso con Google.');
      setIsGoogleLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setIsLoading(true);

    try {
      const loggedUser = isLogin
        ? await login(formData.email, formData.password)
        : await register({
            email: formData.email,
            password: formData.password,
          });
      if (loggedUser?.requiresEmailConfirmation) {
        setConfirmation(loggedUser.verifyEmailMethod || 'link');
        setNotice('Revisa tu correo para verificar la cuenta.');
        return;
      }
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-background min-h-screen relative flex flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <div className="flex w-full max-w-6xl items-center justify-between gap-4">
        <Brand />
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.15fr_1fr] gap-8 items-stretch">
        <div className="auth-story flex flex-col gap-10">
          <div><span className="inline-block rounded-full border border-white/30 px-3 py-1.5 text-xs text-white/90">Tu carta, siempre al día</span><h1 className="mt-8">Todo empieza<br />con un buen menú.</h1><p>Deja tus platos listos para compartir. Cambia precios, suma nuevas recetas y dale a tu carta la identidad de tu local.</p></div>
          <div className="auth-story-note"><QrCode size={36} strokeWidth={1.4} aria-hidden="true" /><div><strong>Una carta que cambia contigo.</strong><p>Actualiza tu menú. Conserva tu QR.</p></div></div>
        </div>

        <div className="auth-form-card bg-surface overflow-hidden border border-line relative">
          <div className="relative p-6 sm:p-10">
            <div className="text-left mb-6">
              <h2 className="text-3xl font-bold text-ink mt-2">
                {isLogin ? 'Bienvenido de nuevo' : 'Crea tu acceso'}
              </h2>
              <p className="text-muted mt-2">
                {isLogin ? 'Continúa con Google o ingresa con tu correo' : 'Crea tu cuenta con Google o con tu correo'}
              </p>
            </div>

            <Link href="/" className="mb-4 inline-block text-sm text-brand">← Volver a MenuPro</Link>
            {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
            {confirmation === 'code' && <form className="mb-6 space-y-3" onSubmit={async event => {
              event.preventDefault(); setError(''); setIsLoading(true);
              try {
                await api.post('/api/auth/verify', { email: formData.email, otp });
                setConfirmation(null); setIsLogin(true); setNotice('Correo verificado. Inicia sesión para continuar.');
              } catch (error) { setError(error.message); }
              finally { setIsLoading(false); }
            }}>
              <label htmlFor="verification-code" className="block text-sm text-ink">Código de verificación</label>
              <input id="verification-code" value={otp} onChange={event => setOtp(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className="w-full rounded-lg border p-3" />
              <Button type="submit" disabled={isBusy}>Verificar correo</Button>
            </form>}
            {error && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button type="button" onClick={handleGoogle} disabled={isBusy} aria-busy={isGoogleLoading} className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
                <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.98 5.98 0 0 1 12 5.96Z" />
              </svg>
              {isGoogleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">Utilizamos las apps de InsForge e InstaCloud para gestionar los inicios de sesión.</p>
            <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-canvas" /><span>o continúa con tu correo</span><span className="h-px flex-1 bg-canvas" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={formData.email}
                onChange={handleChange}
                required
                icon={<Mail size={17} aria-hidden="true" />}
                autoComplete="email"
              />

              <Input
                label="Contraseña"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                icon={<LockKeyhole size={17} aria-hidden="true" />}
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={isLogin ? undefined : 8}
                helperText={!isLogin ? "Mínimo 8 caracteres" : ""}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isBusy}
              >
                {isLoading ? 'Procesando...' : (isLogin ? 'Entrar' : 'Crear cuenta')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-brand hover:text-brand text-sm font-medium"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>

            {isLogin && (
              <p className="mt-4 text-center text-sm"><Link href="/app/recover" className="text-brand underline">Olvidé mi contraseña</Link></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
