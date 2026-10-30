import { redirect } from 'next/navigation';
export default function RegisterPage() { redirect('/app/login?register=true'); }
