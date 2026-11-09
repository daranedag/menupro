import test from 'node:test';
import assert from 'node:assert/strict';
import { menuPath, slugify, toMenu, getDishStatus, dishStatusFields, getVisibleMenu } from '../src/lib/menu.mjs';

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

test('public menus include unavailable dishes and exclude hidden dishes and sections without changing the editor data', () => {
  const menu = toMenu({ sections: [
    { id: 'visible', active: true, visible: true, items: [
      { id: 'available', available: true, visible: true, price: '3500', order_index: 0 },
      { id: 'unavailable', available: false, visible: true, price: '0', order_index: 1 },
      { id: 'hidden', available: true, visible: false, order_index: 2 },
      { id: 'legacy-hidden', available: false, visible: false, order_index: 3 },
    ] },
    { id: 'paused', active: false, visible: true },
    { id: 'hidden', active: true, visible: false },
  ] });
  const publicMenu = getVisibleMenu(menu);
  assert.deepEqual(publicMenu.sections.map(section => section.id), ['visible']);
  assert.deepEqual(publicMenu.sections[0].items.map(item => item.id), ['available', 'unavailable']);
  assert.equal(publicMenu.sections[0].items[1].isActive, false);
  assert.equal(publicMenu.sections[0].items[1].price, 0);
  assert.equal(menu.sections.length, 3);
  assert.equal(menu.sections[0].items.length, 4);
});

test('dish status transitions restore both visibility and availability, including previously hidden dishes', () => {
  for (const from of ['available', 'unavailable', 'hidden']) {
    for (const to of ['available', 'unavailable', 'hidden']) {
      const dish = { ...dishStatusFields(from), ...dishStatusFields(to) };
      assert.equal(getDishStatus(dish), to);
      const items = getVisibleMenu({ sections: [{ items: [dish] }] }).sections[0].items;
      assert.equal(items.length, to === 'hidden' ? 0 : 1);
    }
  }
  assert.equal(getDishStatus({ isActive: false, isVisible: false }), 'hidden');
  assert.equal(getDishStatus({}), 'available');
});
