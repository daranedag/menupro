export function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

export function menuPath(restaurantSlug, menuSlug) {
  return `/menu/${encodeURIComponent(restaurantSlug)}/${encodeURIComponent(menuSlug)}`;
}

export function toDish(row) {
  return { ...row, price: Number(row.price), discount: Number(row.discount ?? 0), image: row.image_url, imageAssetId: row.image_asset_id,
    longDescription: row.long_description, prepTime: row.prep_time, isVegetarian: row.is_vegetarian,
    isSpicy: row.is_spicy, isActive: row.available, isVisible: row.visible, orderIndex: row.order_index };
}

export function toSection(row) {
  return { ...row, isActive: row.active, isVisible: row.visible, orderIndex: row.order_index,
    items: (row.items ?? []).map(toDish).sort((a, b) => a.orderIndex - b.orderIndex) };
}

export function toMenu(row) {
  return { ...row, restaurantId: row.restaurant_id, isPublished: row.is_published, isActive: row.active,
    isVisible: row.visible, showCallToAction: row.show_call_to_action, ctaTitle: row.cta_title,
    ctaDescription: row.cta_description, phoneNumber: row.phone_number, deliveryUrl: row.delivery_url,
    sections: (row.sections ?? []).map(toSection).sort((a, b) => a.orderIndex - b.orderIndex) };
}
