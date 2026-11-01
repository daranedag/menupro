CREATE OR REPLACE FUNCTION public.menupro_worker_outbox(p_secret text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 RETURN jsonb_build_object('notifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'subject',n.subject,'message',n.message,'email',u.email))
  FROM (SELECT * FROM public.menupro_notifications WHERE email_sent_at IS NULL ORDER BY created_at LIMIT 20) n
  JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id WHERE u.email_verified),'[]'),
  'subscriptions',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT s.business_id,s.provider_subscription_id,s.pending_plan_id,s.welcome_cycle,s.welcome_payments_used,s.welcome_redeemed_at,
   s.billing_cycle,s.current_period_end,s.cancel_at_period_end,p.monthly_net,p.annual_net,r.tax_mode,r.billing_snapshot,r.welcome AS checkout_welcome FROM public.menupro_subscriptions s
   LEFT JOIN public.menupro_checkout_requests r ON r.provider_id=s.provider_subscription_id
   JOIN public.menupro_plans p ON p.id=coalesce(s.pending_plan_id,s.plan_id) WHERE s.provider_subscription_id IS NOT NULL AND NOT s.cancel_at_period_end) t),'[]'));
END;
$$;
CREATE OR REPLACE FUNCTION public.menupro_admin_issue_honorarium(p_payment_id text,p_folio text,p_issued_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.payment_id IS NULL THEN RAISE EXCEPTION 'Documento no encontrado.' USING ERRCODE='P0001'; END IF;
 IF d.status='issued' THEN
  IF d.folio=p_folio AND d.issued_date=p_issued_date THEN RETURN to_jsonb(d); END IF;
  RAISE EXCEPTION 'La boleta ya fue registrada. Una corrección requiere revisión administrativa.' USING ERRCODE='P0001'; END IF;
 IF d.review_required OR p_folio IS NULL OR p_folio !~ '^[0-9]{1,20}$' OR p_issued_date IS NULL OR p_issued_date>(now() AT TIME ZONE 'America/Santiago')::date OR extract(year FROM p_issued_date)<>extract(year FROM d.expected_issue_date) THEN
  RAISE EXCEPTION 'Revisa el pago, el folio y el año tributario antes de registrar la boleta.' USING ERRCODE='P0001'; END IF;
 UPDATE public.menupro_fiscal_documents SET status='issued',folio=p_folio,issued_date=p_issued_date,updated_at=now() WHERE payment_id=p_payment_id RETURNING * INTO d;
 INSERT INTO public.menupro_notifications(business_id,event_key,subject,message,recipient_email)
 VALUES(d.business_id,'honorarium-issued:'||d.payment_id,'Boleta de honorarios registrada','Registramos la boleta de honorarios N.º '||d.folio||' por tu pago de MenuPro. Puedes consultar el folio y los importes en Suscripción. La emisión y entrega del documento se realizan manualmente.',d.billing_snapshot->>'email');
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_issued',jsonb_build_object('payment_id',p_payment_id,'folio',p_folio,'issued_date',p_issued_date));
 RETURN to_jsonb(d);
END; $$;
