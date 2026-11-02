'use client';
import MenuItem from './MenuItem';

export default function MenuSection({ section }) {
  return <section className="menu-section" id={section.id}>
    <div className="menu-section-header"><h2>{section.icon && <span className="mr-2" aria-hidden="true">{section.icon}</span>}{section.name}</h2>{section.description && <p>{section.description}</p>}</div>
    <div>{section.items?.length ? section.items.map(item => <MenuItem key={item.id} item={item} />) : <p className="py-8 text-sm" style={{ color: 'var(--menu-muted, #617168)' }}>No hay platos disponibles en esta sección.</p>}</div>
  </section>;
}
