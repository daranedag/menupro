import test from 'node:test';
import assert from 'node:assert/strict';
import { menuPath, slugify, toMenu } from '../src/lib/menu.mjs';

test('public addresses retain the restaurant and menu slugs, including accents', () => {
  assert.equal(slugify('Café & Sazón'), 'cafe-sazon');
  assert.equal(menuPath('cafe-sazon', 'almuerzo'), '/menu/cafe-sazon/almuerzo');
});

test('the public menu data keeps zero prices and unavailable flags and sorts items', () => {
  const menu = toMenu({ id: 'menu', is_published: true, sections: [{ order_index: 0, items: [
    { id: 'second', price: '1500', available: true, order_index: 2 },
    { id: 'first', price: '0', available: false, order_index: 0 },
  ] }] });
  assert.equal(menu.isPublished, true);
  assert.equal(menu.sections[0].items[0].id, 'first');
  assert.equal(menu.sections[0].items[0].price, 0);
  assert.equal(menu.sections[0].items[0].isActive, false);
});
