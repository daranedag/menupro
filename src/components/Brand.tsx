import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';

export default function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} className="dashboard-brand rounded-lg" aria-label="MenuPro, inicio"><span className="brand-mark"><UtensilsCrossed size={21} strokeWidth={1.7} aria-hidden="true" /></span><span className="brand-name">MenuPro</span></Link>;
}
