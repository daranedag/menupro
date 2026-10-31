CREATE OR REPLACE FUNCTION public.menupro_has_access(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.menupro_subscriptions s WHERE s.business_id=p_business_id AND (
  s.courtesy_until>now() OR (s.status='trial' AND s.trial_ends_at>now()) OR
  (s.status IN ('active','past_due','cancelled') AND s.current_period_end>now()) OR
  (s.status IN ('active','past_due') AND NOT s.cancel_at_period_end AND s.provider_subscription_id IS NOT NULL AND
    coalesce(s.grace_until,s.current_period_end+interval '7 days')>now())));
$$;
CREATE FUNCTION public.menupro_abandon_checkout(p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 SELECT business_id INTO v_id FROM public.menupro_checkout_requests WHERE id=p_request_id FOR UPDATE;
 PERFORM public.menupro_require_owner(v_id);
 UPDATE public.menupro_checkout_requests SET status='cancelled' WHERE id=p_request_id AND status IN ('pending','ready');
 IF NOT FOUND THEN RAISE EXCEPTION 'La contratación ya no está pendiente.' USING ERRCODE='P0001'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_abandon_checkout(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_abandon_checkout(uuid) TO authenticated;

CREATE FUNCTION public.menupro_payment_context(p_secret text,p_request_id uuid,p_payment_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_r public.menupro_checkout_requests;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO v_r FROM public.menupro_checkout_requests WHERE id=p_request_id;
 IF v_r.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('purpose',v_r.purpose,'provider_id',v_r.provider_id,
  'credited',EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_payment_id=p_payment_id AND period_end IS NOT NULL));
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_payment_context(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menupro_payment_context(text,uuid,text) TO anon,authenticated;

-- Restrict transfer/payment confirmation to platform administrators and audit the
-- source. A bank receipt is a distinct operation from a free courtesy.
CREATE FUNCTION public.menupro_admin_prepaid(p_business_id uuid,p_plan_id text,p_cycle text,p_reference text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_q jsonb; v_id uuid; v_start timestamptz; v_end timestamptz; v_s public.menupro_subscriptions; v_p public.menupro_plans; v_net integer;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 IF length(trim(p_reference))<4 OR length(trim(p_reference))>200 OR length(trim(p_reason))<5 OR p_cycle NOT IN ('monthly','annual') THEN RAISE EXCEPTION 'Registra el comprobante y motivo del pago.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id FOR UPDATE;
 SELECT * INTO v_p FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_s.business_id IS NULL OR v_p.id IS NULL OR (v_s.provider_subscription_id IS NOT NULL AND NOT v_s.cancel_at_period_end) THEN
  RAISE EXCEPTION 'Confirma primero la cancelación de cualquier renovación automática.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.menupro_payment_events WHERE provider_payment_id='bank:'||trim(p_reference)) THEN
  RAISE EXCEPTION 'Ese comprobante ya está registrado.' USING ERRCODE='P0001'; END IF;
 v_net:=CASE WHEN p_cycle='annual' THEN v_p.annual_net ELSE v_p.monthly_net END;
 v_start:=greatest(now(),v_s.trial_ends_at,v_s.current_period_end);
 v_end:=v_start+CASE WHEN p_cycle='annual' THEN interval '1 year' ELSE interval '1 month' END;
 INSERT INTO public.menupro_checkout_requests(business_id,plan_id,cycle,purpose,net_amount,gross_amount,regular_gross,starts_at,status,created_by)
 VALUES(p_business_id,p_plan_id,p_cycle,'prepaid',v_net,v_net+round(v_net*.19),v_net+round(v_net*.19),v_start,'paid',auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.menupro_payment_events(provider_payment_id,request_id,business_id,status,amount,currency,period_start,period_end,approved_at,provider_modified_at)
 VALUES('bank:'||trim(p_reference),v_id,p_business_id,'approved',v_net+round(v_net*.19),'CLP',v_start,v_end,now(),now());
 UPDATE public.menupro_subscriptions SET plan_id=p_plan_id,status='active',billing_cycle=p_cycle,current_period_start=v_start,current_period_end=v_end,
  grace_until=NULL,cancel_at_period_end=true,pending_plan_id=NULL,pending_restaurant_id=NULL,retention_notice_at=NULL,updated_at=now() WHERE business_id=p_business_id;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(p_business_id,auth.uid(),'bank_payment_confirmed',jsonb_build_object('reference',p_reference,'reason',p_reason,'period_end',v_end));
 RETURN jsonb_build_object('ends_at',v_end,'gross_amount',v_net+round(v_net*.19));
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_admin_prepaid(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_prepaid(uuid,text,text,text,text) TO authenticated;

-- Explicit authorization for reorder RPCs, including direct calls after expiry.
CREATE OR REPLACE FUNCTION public.menupro_reorder_sections(p_menu_id uuid,p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.menupro_menus WHERE id=p_menu_id AND public.menupro_can_edit_restaurant(restaurant_id))
  OR cardinality(p_ids)<>(SELECT count(*) FROM public.menupro_menu_sections WHERE menu_id=p_menu_id)
  OR cardinality(p_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_ids) AS id)
  OR cardinality(p_ids)<>(SELECT count(*) FROM public.menupro_menu_sections WHERE menu_id=p_menu_id AND id=ANY(p_ids)) THEN
  RAISE EXCEPTION 'No tienes permiso para ordenar esta carta.' USING ERRCODE='42501'; END IF;
 UPDATE public.menupro_menu_sections s SET order_index=v.position-1 FROM unnest(p_ids) WITH ORDINALITY AS v(id,position) WHERE s.id=v.id AND s.menu_id=p_menu_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.menupro_reorder_items(p_section_id uuid,p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.menupro_menu_sections s JOIN public.menupro_menus m ON m.id=s.menu_id WHERE s.id=p_section_id AND public.menupro_can_edit_restaurant(m.restaurant_id))
  OR cardinality(p_ids)<>(SELECT count(*) FROM public.menupro_menu_items WHERE section_id=p_section_id)
  OR cardinality(p_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_ids) AS id)
  OR cardinality(p_ids)<>(SELECT count(*) FROM public.menupro_menu_items WHERE section_id=p_section_id AND id=ANY(p_ids)) THEN
  RAISE EXCEPTION 'No tienes permiso para ordenar esta carta.' USING ERRCODE='42501'; END IF;
 UPDATE public.menupro_menu_items i SET order_index=v.position-1 FROM unnest(p_ids) WITH ORDINALITY AS v(id,position) WHERE i.id=v.id AND i.section_id=p_section_id;
END;
$$;
