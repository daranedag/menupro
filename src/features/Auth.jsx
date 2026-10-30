'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/api/client';
import { useNavigate } from '@/lib/navigation';

import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';

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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950 opacity-95" />
      <div className="absolute -left-32 -top-24 h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.15),transparent_30%)]" />

      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.15fr_1fr] gap-8 items-stretch">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-10 shadow-2xl backdrop-blur-xl flex flex-col gap-10">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <img src="/favicon.png" alt="Logo de MenuPro" className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-200">MenuPro</p>
              <h1 className="text-2xl font-semibold text-white leading-tight">Tu carta digital, siempre actualizada</h1>
              <p className="text-sm text-slate-200/80">Crea, edita y comparte el menú de tu restaurante en minutos. Sin reimprimir, sin depender de terceros.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[{
              title: 'QR siempre actualizado',
              desc: 'Actualiza platos y precios en tiempo real con códigos QR listos para compartir.',
            }, {
              title: 'Clientes felices',
              desc: 'Ofrece a tus clientes una experiencia moderna y sin contacto.',
            }, {
              title: 'Seguridad reforzada',
              desc: 'Sesiones protegidas y controles de acceso para tu equipo.',
            }, {
              title: 'Personaliza con tu marca',
              desc: 'Adapta el diseño del menú digital a la identidad de tu restaurante.',
            }].map((item) => (
              <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-white font-semibold text-base">{item.title}</h3>
                <p className="text-sm text-slate-200/70 mt-2">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-emerald-50" />
          <div className="relative p-10">
            <div className="text-left mb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" /> Acceso MenuPro
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                {isLogin ? 'Bienvenido de nuevo' : 'Crea tu acceso'}
              </h2>
              <p className="text-slate-600 mt-2">
                {isLogin ? 'Continúa con Google o ingresa con tu correo' : 'Crea tu cuenta con Google o con tu correo'}
              </p>
            </div>

            <Link href="/" className="mb-4 inline-block text-sm text-indigo-700">← Volver a MenuPro</Link>
            {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
            {confirmation === 'code' && <form className="mb-6 space-y-3" onSubmit={async event => {
              event.preventDefault(); setError(''); setIsLoading(true);
              try {
                await api.post('/api/auth/verify', { email: formData.email, otp });
                setConfirmation(null); setIsLogin(true); setNotice('Correo verificado. Inicia sesión para continuar.');
              } catch (error) { setError(error.message); }
              finally { setIsLoading(false); }
            }}>
              <label htmlFor="verification-code" className="block text-sm text-slate-700">Código de verificación</label>
              <input id="verification-code" value={otp} onChange={event => setOtp(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className="w-full rounded-lg border p-3" />
              <Button type="submit" disabled={isBusy}>Verificar correo</Button>
            </form>}
            {error && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button type="button" onClick={handleGoogle} disabled={isBusy} aria-busy={isGoogleLoading} className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
                <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.98 5.98 0 0 1 12 5.96Z" />
              </svg>
              {isGoogleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
            </button>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-200" /><span>o continúa con tu correo</span><span className="h-px flex-1 bg-slate-200" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={formData.email}
                onChange={handleChange}
                required
                icon="📧"
                forceLight
              />

              <Input
                label="Contraseña"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                icon="🔒"
                helperText={!isLogin ? "Mínimo 6 caracteres" : ""}
                forceLight
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
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>

            {isLogin && (
              <p className="mt-4 text-center text-xs text-slate-500">Acceso seguro a tu panel de cartas digitales.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
