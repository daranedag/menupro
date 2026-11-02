'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/api/client';
import { Input, Button } from '@/components/ui';

export default function Recover() {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = step === 'request' ? { email } : step === 'verify' ? { email, code } : { password };
      const { data } = await api.post('/api/auth/password/' + step, body);
      setMessage(data.message || 'Código verificado. Ingresa una nueva contraseña.');
      setStep(step === 'request' ? 'verify' : step === 'verify' ? 'confirm' : 'done');
      setPassword('');
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6"><section className="w-full max-w-md rounded-2xl bg-surface p-7 text-ink">
    <Link href="/app/login" className="text-sm text-brand">← Volver al inicio de sesión</Link><h1 className="mt-5 text-2xl font-bold">Recuperar mi acceso</h1>
    {message && <p role="status" className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {step !== 'done' && <form className="mt-5 space-y-4" onSubmit={submit}>
      {step === 'request' && <Input label="Correo de tu cuenta" name="recoveryEmail" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />}
      {step === 'verify' && <><p className="text-sm text-muted">Ingresa el código de seis dígitos enviado a tu correo.</p><Input label="Código de recuperación" name="recoveryCode" value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></>}
      {step === 'confirm' && <Input label="Nueva contraseña" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} helperText="Mínimo 8 caracteres" required />}
      <Button type="submit" disabled={busy} fullWidth>{busy ? 'Procesando…' : step === 'request' ? 'Solicitar código' : step === 'verify' ? 'Verificar código' : 'Guardar contraseña'}</Button>
      {step !== 'request' && <button type="button" disabled={busy} onClick={() => { setStep('request'); setError(''); setCode(''); }} className="text-sm text-brand underline">Solicitar un código nuevo</button>}
    </form>}
    {step === 'done' && <Link href="/app/login" className="mt-5 inline-block font-semibold text-brand underline">Iniciar sesión</Link>}
    <p className="mt-5 text-xs text-muted">Si te registraste con Google, también puedes volver a entrar con ese mismo acceso.</p>
  </section></main>;
}
