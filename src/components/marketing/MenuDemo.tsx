'use client';

import { useId, useState } from 'react';
import { Check, Leaf, UtensilsCrossed } from 'lucide-react';

const dishes = {
  'Para compartir': [
    { name: 'Burrata de la huerta', description: 'Tomates de temporada, pesto y pan de masa madre.', price: '$8.900', kind: 'salad' },
    { name: 'Papas de la casa', description: 'Doradas al romero, con alioli de ajo asado.', price: '$5.900', kind: 'potatoes' },
    { name: 'Croquetas de hongos', description: 'Crujientes por fuera. Cremosas por dentro.', price: '$7.500', kind: 'croquettes' },
  ],
  'De la cocina': [
    { name: 'Risotto de temporada', description: 'Arroz cremoso, hongos salteados y parmesano.', price: '$12.900', kind: 'croquettes' },
    { name: 'Ñoquis de la huerta', description: 'Hechos en casa, con tomates asados y albahaca.', price: '$11.500', kind: 'salad' },
    { name: 'Papas al horno', description: 'Con vegetales de estación y salsa de hierbas.', price: '$8.900', kind: 'potatoes' },
  ],
  'Para beber': [
    { name: 'Limonada de la casa', description: 'Limón fresco, menta y un toque de jengibre.', price: '$3.500', kind: 'lemonade' },
    { name: 'Té frío de frutos rojos', description: 'Infusión de la casa, hielo y fruta fresca.', price: '$3.900', kind: 'berry' },
    { name: 'Café de especialidad', description: 'Un buen espresso para cerrar la mesa.', price: '$2.500', kind: 'coffee' },
  ],
};
type Category = keyof typeof dishes;

export default function MenuDemo() {
  const [category, setCategory] = useState<Category>('Para compartir');
  const id = useId();
  return <div id="demo" className="menu-demo-stage">
    <div className="demo-caption"><UtensilsCrossed size={16} aria-hidden="true" /><span>Una pequeña muestra de lo que puedes crear</span></div>
    <div className="demo-menu">
      <div className="demo-restaurant"><div className="restaurant-symbol"><Leaf size={27} strokeWidth={1.4} aria-hidden="true" /></div><h2>Casa Oliva</h2><p>Cocina de estación, hecha en casa.</p><span>Un ejemplo de carta con MenuPro</span></div>
      <div className="demo-tabs" role="tablist" aria-label="Secciones del ejemplo">{(Object.keys(dishes) as Category[]).map((name, index, categories) => <button key={name} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={category === name} aria-controls={`${id}-panel`} tabIndex={category === name ? 0 : -1} onClick={() => setCategory(name)} onKeyDown={event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % categories.length;
        else if (event.key === 'ArrowLeft') next = (index + categories.length - 1) % categories.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = categories.length - 1;
        else return;
        event.preventDefault(); setCategory(categories[next]); document.getElementById(`${id}-tab-${next}`)?.focus();
      }}>{name}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${Object.keys(dishes).indexOf(category)}`} tabIndex={0} className="demo-dishes">{dishes[category].map(dish => <article key={dish.name}><div className={`dish-art dish-art-${dish.kind}`} aria-hidden="true"><span /><i /><b /></div><div><h3>{dish.name}</h3><p>{dish.description}</p><strong>{dish.price}</strong></div></article>)}</div>
      <div className="demo-menu-footer"><Leaf size={13} aria-hidden="true" />Ingredientes de temporada. Siempre.</div>
    </div>
    <div className="demo-update"><span><Check size={17} aria-hidden="true" /></span><div><strong>¿Cambió el plato del día?</strong><p>Edita tu carta. El QR sigue siendo el mismo.</p></div></div>
  </div>;
}
