'use client';
import { Flame, Clock3, Leaf } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatPrice } from '@/lib/format-price';

export default function MenuItem({ item }) {
  const hasDiscount = Number(item.discount) > 0;
  const price = Number(item.price) || 0;
  const finalPrice = hasDiscount ? price * (1 - Number(item.discount) / 100) : price;
  return <article className="menu-item">
    {item.image && <img src={item.image} alt={item.name} className="menu-item-image" loading="lazy" />}
    <div className="menu-item-content"><div className="menu-item-heading"><h3>{item.name}</h3><div className="menu-item-price">{hasDiscount && <del>{formatPrice(price)}</del>}{formatPrice(finalPrice)}</div></div>
      {(hasDiscount || item.tags?.length > 0) && <div className="mt-2 flex flex-wrap gap-1">{hasDiscount && <Badge variant="discount" size="sm">-{item.discount}%</Badge>}{item.tags?.map((tag, index) => <Badge key={tag.label + index} variant={tag.variant || 'default'} size="sm">{tag.label}</Badge>)}</div>}
      {item.description && <p className="menu-item-description">{item.description}</p>}{item.longDescription && <p className="menu-item-description">{item.longDescription}</p>}
      {(item.calories || item.prepTime || item.isVegetarian || item.isSpicy) && <div className="menu-item-details">
        {item.calories && <span className="flex items-center gap-1"><Flame size={13} aria-hidden="true" />{item.calories} cal</span>}
        {item.prepTime && <span className="flex items-center gap-1"><Clock3 size={13} aria-hidden="true" />{item.prepTime} min</span>}
        {item.isVegetarian && <span className="flex items-center gap-1"><Leaf size={13} aria-hidden="true" />Vegetariano</span>}{item.isSpicy && <span>Picante</span>}
      </div>}
    </div>
  </article>;
}
