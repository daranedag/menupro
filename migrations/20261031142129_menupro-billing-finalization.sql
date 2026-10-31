-- Keep the original implementation private and verify the amount actually
-- received before committing a manual payment and its audit trail.
ALTER FUNCTION public.menupro_admin_prepaid(uuid,text,text,text,text) RENAME TO menupro_admin_prepaid_internal;
REVOKE ALL ON FUNCTION public.menupro_admin_prepaid_internal(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_admin_prepaid(p_business_id uuid,p_plan_id text,p_cycle text,p_reference text,p_reason text,p_gross_amount integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 v_result:=public.menupro_admin_prepaid_internal(p_business_id,p_plan_id,p_cycle,p_reference,p_reason);
 IF p_gross_amount IS NULL OR p_gross_amount<>(v_result->>'gross_amount')::integer THEN
  RAISE EXCEPTION 'El importe recibido no coincide con el plan y descuento aplicables. Revisa el comprobante antes de activar el período.' USING ERRCODE='P0001'; END IF;
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.menupro_admin_prepaid(uuid,text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_prepaid(uuid,text,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.menupro_quote(p_business_id uuid,p_plan_id text,p_cycle text,p_purpose text DEFAULT 'subscription') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_s public.menupro_subscriptions; v_plan public.menupro_plans; v_old public.menupro_plans; v_net integer; v_regular integer; v_welcome boolean; v_start timestamptz; v_factor numeric:=1; v_fraction numeric;
BEGIN
 PERFORM public.menupro_require_owner(p_business_id);
 SELECT * INTO v_s FROM public.menupro_subscriptions WHERE business_id=p_business_id;
 SELECT * INTO v_plan FROM public.menupro_plans WHERE id=p_plan_id;
 IF v_plan.id IS NULL OR p_cycle NOT IN ('monthly','annual') OR p_purpose NOT IN ('subscription','upgrade','prepaid') THEN RAISE EXCEPTION 'Plan inválido.' USING ERRCODE='P0001'; END IF;
 v_regular:=CASE WHEN p_cycle='monthly' THEN v_plan.monthly_net ELSE v_plan.annual_net END;
 v_welcome:=v_s.trial_started_at IS NOT NULL AND v_s.first_menu_saved_at IS NOT NULL AND v_s.welcome_redeemed_at IS NULL AND now()<=v_s.trial_ends_at+interval '7 days';
 v_net:=CASE WHEN v_welcome AND p_cycle='monthly' THEN round(v_regular*.8) WHEN v_welcome THEN round(v_regular*.9) ELSE v_regular END;
 v_start:=greatest(now(),coalesce(v_s.trial_ends_at,now()),coalesce(v_s.current_period_end,now()));
 IF p_purpose='upgrade' THEN
  SELECT * INTO v_old FROM public.menupro_plans WHERE id=v_s.plan_id;
  IF v_s.current_period_end<=now() OR v_s.current_period_end IS NULL OR v_plan.max_restaurants<=v_old.max_restaurants OR v_s.billing_cycle<>p_cycle THEN RAISE EXCEPTION 'La mejora no está disponible para este período.' USING ERRCODE='P0001'; END IF;
  IF v_s.welcome_redeemed_at IS NOT NULL AND v_s.welcome_cycle=p_cycle AND v_s.welcome_payments_used>=1 AND v_s.welcome_payments_used<=(CASE WHEN p_cycle='monthly' THEN 3 ELSE 1 END) THEN
   v_factor:=CASE WHEN p_cycle='monthly' THEN .8 ELSE .9 END;
  END IF;
  v_fraction:=least(1,greatest(0,extract(epoch FROM v_s.current_period_end-now())/nullif(extract(epoch FROM v_s.current_period_end-v_s.current_period_start),0)));
  v_net:=greatest(1,round((v_regular-(CASE WHEN p_cycle='monthly' THEN v_old.monthly_net ELSE v_old.annual_net END))*v_factor*v_fraction));
  v_welcome:=false; v_start:=now();
 END IF;
 RETURN jsonb_build_object('plan_id',p_plan_id,'cycle',p_cycle,'purpose',p_purpose,'net_amount',v_net,'tax_amount',round(v_net*.19),
  'gross_amount',v_net+round(v_net*.19),'regular_gross',v_regular+round(v_regular*.19),'welcome',v_welcome,'starts_at',v_start,
  'discount_payments',CASE WHEN v_welcome AND p_cycle='monthly' THEN 3 WHEN v_welcome THEN 1 ELSE 0 END);
END;
$$;
