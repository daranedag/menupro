import { z } from 'zod';

const shortText = z.string().trim().max(255);
const url = z.union([z.literal(''), z.string().url().refine(value => /^https?:\/\//.test(value), 'Usa una dirección HTTP o HTTPS.')]);
function defined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

export const credentials = z.object({ email: z.string().trim().email(), password: z.string().min(8).max(128), name: shortText.optional() }).strict();
export const restaurantSchema = z.object({ name: shortText.min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
  phone: shortText.optional(), address: shortText.optional(), city: shortText.optional(),
  unit: shortText.optional(), no_physical_location: z.boolean().optional(),
  theme: z.object({ mode: z.enum(['light', 'dark']), colorPreset: shortText, fontPreset: shortText,
    colors: z.object({ primary: z.string().regex(/^#[a-fA-F0-9]{6}$/), secondary: z.string().regex(/^#[a-fA-F0-9]{6}$/), accent: z.string().regex(/^#[a-fA-F0-9]{6}$/) }),
    font: z.object({ name: shortText, fontFamily: shortText }) }).optional(),
});
export const menuSchema = z.object({ restaurant_id: z.string().uuid(), name: shortText.min(1), description: z.string().max(2000).default(''),
  icon: z.string().max(20).default('🍽️'), showCallToAction: z.boolean().default(true), ctaTitle: shortText.optional(),
  ctaDescription: z.string().max(2000).optional(), phoneNumber: shortText.optional(), deliveryUrl: url.optional(),
  isActive: z.boolean().optional(), isVisible: z.boolean().optional(),
});
export const sectionSchema = z.object({ name: shortText.min(1), description: z.string().max(2000).default(''), icon: z.string().max(20).optional(),
  order_index: z.number().int().min(0).default(0), isActive: z.boolean().optional(), isVisible: z.boolean().optional() });
export const dishSchema = z.object({ name: shortText.min(1), description: z.string().max(2000).default(''), longDescription: z.string().max(5000).optional(),
  price: z.number().min(0).max(99999999), discount: z.number().min(0).max(100).default(0), image: url.optional(),
  calories: z.number().int().min(0).nullable().optional(), prepTime: z.number().int().min(0).nullable().optional(),
  isVegetarian: z.boolean().default(false), isSpicy: z.boolean().default(false), isActive: z.boolean().optional(), isVisible: z.boolean().optional(),
  order_index: z.number().int().min(0).default(0), tags: z.array(z.object({ label: shortText, variant: shortText })).max(20).default([]),
});

export function menuWrite(data: z.infer<typeof menuSchema>) {
  return defined({ restaurant_id: data.restaurant_id, name: data.name, description: data.description, icon: data.icon,
    show_call_to_action: data.showCallToAction, cta_title: data.ctaTitle, cta_description: data.ctaDescription,
    phone_number: data.phoneNumber, delivery_url: data.deliveryUrl, active: data.isActive, visible: data.isVisible });
}
export function sectionWrite(data: z.infer<typeof sectionSchema>) {
  return defined({ name: data.name, description: data.description, icon: data.icon, order_index: data.order_index, active: data.isActive, visible: data.isVisible });
}
export function dishWrite(data: z.infer<typeof dishSchema>) {
  return defined({ name: data.name, description: data.description, long_description: data.longDescription, price: data.price,
    discount: data.discount, image_url: data.image, calories: data.calories, prep_time: data.prepTime,
    is_vegetarian: data.isVegetarian, is_spicy: data.isSpicy, available: data.isActive, visible: data.isVisible,
    order_index: data.order_index, tags: data.tags });
}
