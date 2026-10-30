'use client';
import { useRouter } from 'next/navigation';

export function useNavigate() {
  const router = useRouter();
  return (destination, options = {}) => {
    if (typeof destination === 'number') { router.back(); return; }
    if (options.replace) router.replace(destination); else router.push(destination);
  };
}
