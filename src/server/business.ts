import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createInsForge } from './insforge';
import { check, HttpError, respond } from './http';
import { handleBillingApi, paymentReadiness } from './billing';
import { deliverInvitation } from './email';
import { uploadFiscalPdf, sendFiscalPdf, downloadFiscalPdf } from './fiscal';
import { commercialSettings } from './commercial';
import { adminOperations, checkOperations } from './operations';

export type BusinessClient = Awaited<ReturnType<typeof createInsForge>>;
type Restaurant = { id: string; business_id: string; name: string; slug: string; archived_at: string | null; [key: string]: unknown };
export type BusinessContext = {
  business_id: string; business_role: 'owner' | 'manager' | 'editor'; is_admin: boolean;
  businesses: Array<{ id: string; name: string; role: string }>; restaurants: Restaurant[];
  invitations: Array<{ id: string; business_name: string; role: string }>;
  subscription: { has_access: boolean; effective_status: string; max_restaurants: number; plan_name: string;
    plan_id: string; trial_started_at: string | null; trial_ends_at: string | null; welcome_eligible: boolean; [key: string]: unknown };
};
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(255);

export async function readJson(request: Request) {
  const raw = await request.text();
  if (raw.length > 65536) throw new HttpError('La solicitud es demasiado grande.', 413);
  try { return JSON.parse(raw); } catch { throw new HttpError('Datos JSON inválidos.'); }
}

export async function businessSession(client: BusinessClient): Promise<BusinessContext> {
  const selected = (await cookies()).get('menupro_business')?.value;
  const { data, error } = await client.database.rpc('menupro_panel_session', { p_business_id: selected && uuid.safeParse(selected).success ? selected : null });
  check(error);
  return data as BusinessContext;
}

export async function selectBusiness(id: string) {
  const jar = await cookies();
  jar.set('menupro_business', id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 2592000 });
  jar.delete('menupro_restaurant');
}

async function rpc(client: BusinessClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.database.rpc(name, args); check(error); return data;
}

export async function handleBusinessApi(request: Request, path: string[], client: BusinessClient, user: { id: string; email?: string }) {
  if (!['business', 'billing', 'admin'].includes(path[0])) return null;
  const context = await businessSession(client);
  const method = request.method;
  const route = path.join('/');
  if (context.is_admin && path[0] !== 'admin') throw new HttpError('Esta cuenta usa el panel de administración.', 403);
  if (route === 'business' && method === 'GET') return respond(context);
  if (route === 'business/select' && method === 'POST') {
    const { id } = z.object({ id: uuid }).strict().parse(await readJson(request));
    if (!context.businesses.some(b => b.id === id)) throw new HttpError('Negocio no encontrado.', 404);
    await selectBusiness(id); return respond(null);
  }
  if (route === 'business/team' && method === 'GET') return respond(await rpc(client, 'menupro_team', { p_business_id: context.business_id }));
  if (route === 'business/invitations' && method === 'POST') {
    const input = z.object({ email: z.string().trim().email().max(254), role: z.enum(['manager', 'editor']) }).strict().parse(await readJson(request));
    const id = await rpc(client, 'menupro_invite', { p_business_id: context.business_id, p_email: input.email, p_role: input.role });
    const url = new URL('/app/dashboard/business', process.env.APP_URL || request.url);
    url.searchParams.set('invitation', id);
    // The invitation is email-bound and can also be accepted from the recipient's
    // account if email delivery is disabled or temporarily unavailable.
    const delivery = await deliverInvitation({ id, to: input.email, url: url.href, kind: 'team',
      businessName: context.businesses.find(b => b.id === context.business_id)?.name || 'tu negocio' });
    return respond({ id, url: url.href, ...delivery }, 201);
  }
  if (route === 'business/invitations/accept' && method === 'POST') {
    const { id } = z.object({ id: uuid }).strict().parse(await readJson(request));
    const businessId = await rpc(client, 'menupro_accept_invitation', { p_invitation_id: id });
    await selectBusiness(businessId); return respond({ businessId });
  }
  if (route === 'business/invitations/revoke' && method === 'POST') {
    const { id } = z.object({ id: uuid }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_revoke_invitation', { p_business_id: context.business_id, p_invitation_id: id }));
  }
  if (route === 'business/members' && method === 'POST') {
    const input = z.object({ userId: uuid, action: z.enum(['role', 'remove', 'transfer']), role: z.enum(['manager', 'editor']).default('editor') }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_manage_member', { p_business_id: context.business_id, p_user_id: input.userId, p_action: input.action, p_role: input.role }));
  }
  if (route === 'business/name' && method === 'PUT') {
    const { name } = z.object({ name: text }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_rename_business', { p_business_id: context.business_id, p_name: name }));
  }
  if (route === 'business/restaurant/archive' && method === 'POST') {
    const input = z.object({ restaurantId: uuid, archive: z.boolean() }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_archive_restaurant', { p_restaurant_id: input.restaurantId, p_archive: input.archive }));
  }
  if (route === 'business/trial' && method === 'POST') {
    const input = z.object({ restaurantId: uuid, name: text, phone: text, address: z.string().trim().max(255), city: z.string().trim().max(255),
      unit: z.string().trim().max(255).default(''), noPhysicalLocation: z.boolean().default(false), acceptTerms: z.literal(true) }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_start_trial', { p_business_id: context.business_id, p_restaurant_id: input.restaurantId,
      p_name: input.name, p_phone: input.phone, p_address: input.noPhysicalLocation ? '' : input.address, p_city: input.city, p_unit: input.noPhysicalLocation ? '' : input.unit,
      p_no_physical_location: input.noPhysicalLocation, p_accept_terms: true }));
  }
  if (route === 'business/notifications' && method === 'GET') {
    const { data, error } = await client.database.from('menupro_notifications').select('id,subject,message,created_at,read_at')
      .eq('business_id', context.business_id).order('created_at', { ascending: false }).limit(50);
    check(error); return respond(data);
  }
  if (route === 'business/notifications/read' && method === 'POST') {
    const { id } = z.object({ id: uuid }).strict().parse(await readJson(request));
    return respond(await rpc(client, 'menupro_read_notification', { p_notification_id: id }));
  }
  if (route === 'business/export' && method === 'GET') {
    const restaurants = [];
    for (const restaurant of context.restaurants) {
      const menus = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.database.from('menupro_menus')
          .select('*,sections:menupro_menu_sections(*,items:menupro_menu_items(*))').eq('restaurant_id', restaurant.id).range(offset, offset + 99);
        check(error); menus.push(...(data ?? [])); if (!data || data.length < 100) break;
      }
      restaurants.push({ ...restaurant, menus });
    }
    return Response.json({ exportedAt: new Date().toISOString(), business: context.businesses.find(b => b.id === context.business_id), restaurants },
      { headers: { 'Content-Disposition': 'attachment; filename="menupro-datos.json"', 'Cache-Control': 'no-store' } });
  }
  if (route === 'business/export-pdf' && method === 'POST') {
    const { menuId } = z.object({ menuId: uuid }).strict().parse(await readJson(request));
    const { data, error } = await client.database.from('menupro_menus').select('restaurant_id').eq('id', menuId).maybeSingle(); check(error);
    const restaurant = context.restaurants.find(r => r.id === data?.restaurant_id);
    if (!context.subscription.has_access || !restaurant || restaurant.archived_at || restaurant.entitled === false) throw new HttpError('Activa tu suscripción para exportar PDF.', 403);
    return respond({ allowed: true });
  }
  if (path[0] === 'billing') return handleBillingApi(request, path, client, user, context);
  if (path[0] === 'admin') {
    if (!context.is_admin) throw new HttpError('No tienes permiso para administrar MenuPro.', 403);
    if (route === 'admin/commercial' && method === 'GET') return respond(await commercialSettings());
    if (route === 'admin/commercial' && method === 'POST') {
      const input = z.object({ grupo_enabled: z.boolean(), annual_enabled: z.boolean() }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_set_commercial', { p_grupo_enabled: input.grupo_enabled, p_annual_enabled: input.annual_enabled }));
    }
    if (route === 'admin/operations' && method === 'GET') {
      const offset = z.coerce.number().int().min(0).max(1000000).parse(new URL(request.url).searchParams.get('offset') ?? 0);
      return respond(await adminOperations(client, offset));
    }
    if (route === 'admin/operations/check' && method === 'POST') return respond(await checkOperations());
    if (route === 'admin/records' && method === 'GET') {
      const params = new URL(request.url).searchParams;
      const kind = z.enum(['businesses', 'logs', 'transfers', 'claims']).parse(params.get('kind'));
      const offset = z.coerce.number().int().min(0).max(1000000).parse(params.get('offset') ?? 0);
      const from = z.string().date().nullable().parse(params.get('from') || null);
      const to = z.string().date().nullable().parse(params.get('to') || null);
      if (from && to && from > to) throw new HttpError('La fecha inicial debe ser anterior o igual a la final.');
      const actor = z.string().trim().max(255).parse(params.get('actor') ?? '');
      const event = z.string().trim().max(100).parse(params.get('event') ?? '');
      const status = z.enum(['all', 'review', 'granted', 'denied']).parse(params.get('status') ?? 'all');
      const rows = await rpc(client, 'menupro_admin_records', { p_kind: kind, p_offset: offset,
        p_from: from, p_to: to, p_actor: actor, p_event: event, p_status: status });
      return respond({ rows: rows.slice(0, 50), hasMore: rows.length > 50 });
    }
    if (route === 'admin/business-details' && method === 'GET') {
      const id = uuid.parse(new URL(request.url).searchParams.get('id'));
      const details = await rpc(client, 'menupro_admin_business_details', { p_business_id: id });
      if (!details) throw new HttpError('Negocio no encontrado.', 404);
      return respond(details);
    }
    if (route === 'admin/business-choices' && method === 'GET') {
      return respond(await rpc(client, 'menupro_admin_business_choices', {}));
    }
    if (route === 'admin/first-month-offer' && method === 'POST') {
      const input = z.object({ businessId: uuid, percent: z.number().int().min(1).max(95),
        reason: z.string().trim().min(5).max(1000) }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_first_month_offer', { p_business_id: input.businessId,
        p_percent: input.percent, p_reason: input.reason }));
    }
    if (route === 'admin/fiscal/upload' && method === 'POST') return uploadFiscalPdf(request, client);
    if (route === 'admin/fiscal/send' && method === 'POST') {
      const input = z.object({ paymentId: z.string().min(1).max(250) }).strict().parse(await readJson(request));
      return sendFiscalPdf(client, input.paymentId);
    }
    if (route === 'admin/fiscal/file' && method === 'GET') return downloadFiscalPdf(client, z.string().min(1).max(250).parse(new URL(request.url).searchParams.get('paymentId')));
    if (route === 'admin/fiscal' && method === 'GET') {
      const params = new URL(request.url).searchParams;
      const status = z.enum(['pending', 'issued', 'all']).parse(params.get('status') ?? 'pending');
      const offset = z.coerce.number().int().min(0).max(100000).parse(params.get('offset') ?? 0);
      let documentQuery = client.database.from('menupro_fiscal_documents').select('*', { count: 'exact' });
      if (status === 'pending') documentQuery = documentQuery.or('status.eq.pending,email_accepted_at.is.null,delivery_state.in.(failed,unknown,bounced,complained,delayed)');
      if (status === 'issued') documentQuery = documentQuery.eq('status', 'issued');
      const [documents, jobs] = await Promise.all([
        documentQuery.order('created_at', { ascending: true }).range(offset, offset + 49),
        client.database.from('menupro_reconciliation_jobs').select('request_id,last_checked_at,last_success_at,failures,next_attempt_at').order('failures', { ascending: false }).limit(100),
      ]);
      check(documents.error); check(jobs.error);
      return respond({ documents: documents.data, total: documents.count, jobs: jobs.data });
    }
    if (route === 'admin/fiscal/issue' && method === 'POST') {
      const input = z.object({ paymentId: z.string().min(1).max(250), folio: z.string().regex(/^[0-9]{1,20}$/),
        issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_issue_honorarium', { p_payment_id: input.paymentId, p_folio: input.folio, p_issued_date: input.issuedDate }));
    }
    if (route === 'admin/overview' && method === 'GET') return respond({ ...(await rpc(client, 'menupro_admin_overview', {})), payments: paymentReadiness(), availability: await commercialSettings() });
    if (route === 'admin/review' && method === 'POST') {
      const input = z.object({ claimId: uuid, approve: z.boolean(), reason: z.string().trim().min(5).max(1000) }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_review', { p_claim_id: input.claimId, p_approve: input.approve, p_reason: input.reason }));
    }
    if (route === 'admin/courtesy' && method === 'POST') {
      const input = z.object({ businessId: uuid, planId: z.enum(['local', 'grupo']), days: z.number().int().min(1).max(366), reason: z.string().trim().min(5).max(1000) }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_courtesy', { p_business_id: input.businessId, p_plan_id: input.planId, p_days: input.days, p_reason: input.reason }));
    }
    if (route === 'admin/prepare' && method === 'POST') {
      const input = z.object({ name: text, email: z.string().trim().email().max(254) }).strict().parse(await readJson(request));
      const prepared = await rpc(client, 'menupro_admin_prepare', { p_name: input.name, p_email: input.email });
      const url = new URL('/app/dashboard/business', process.env.APP_URL || request.url);
      url.searchParams.set('invitation', prepared.invitationId);
      const delivery = await deliverInvitation({ id: prepared.invitationId, to: input.email, url: url.href,
        businessName: input.name, kind: 'demo' });
      return respond({ ...prepared, url: url.href, ...delivery }, 201);
    }
    if (route === 'admin/prepaid' && method === 'POST') {
      const input = z.object({ businessId: uuid, planId: z.enum(['local', 'grupo']), cycle: z.enum(['monthly', 'annual']),
        reference: z.string().trim().min(4).max(200), reason: z.string().trim().min(5).max(1000), grossAmount: z.number().int().positive() }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_prepaid', { p_business_id: input.businessId, p_plan_id: input.planId,
        p_cycle: input.cycle, p_reference: input.reference, p_reason: input.reason, p_gross_amount: input.grossAmount }));
    }
    if (route === 'admin/claim' && method === 'POST') {
      const { claimId } = z.object({ claimId: uuid }).strict().parse(await readJson(request));
      return respond(await rpc(client, 'menupro_admin_claim_details', { p_claim_id: claimId }));
    }
  }
  throw new HttpError('Ruta no encontrada.', 404);
}
