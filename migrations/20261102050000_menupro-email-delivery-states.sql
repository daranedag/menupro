ALTER TABLE public.menupro_fiscal_documents DROP CONSTRAINT menupro_fiscal_documents_delivery_state_check;
ALTER TABLE public.menupro_fiscal_documents ADD CONSTRAINT menupro_fiscal_documents_delivery_state_check
 CHECK(delivery_state IN ('not_sent','queued','sending','failed','unknown','accepted','delivered','bounced','complained','delayed'));

CREATE OR REPLACE FUNCTION public.menupro_record_email_event(p_secret text,p_event_id text,p_email_id text,p_type text,p_occurred_at timestamptz,p_document_tag uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 IF length(p_event_id)>200 OR length(p_email_id)>200 OR p_type NOT IN ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.suppressed','email.delivery_delayed') OR p_occurred_at IS NULL OR p_occurred_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Evento de correo inválido.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.menupro_fiscal_documents WHERE email_provider_id=p_email_id OR email_tag_id=p_document_tag)
 AND NOT EXISTS(SELECT 1 FROM public.menupro_notifications WHERE email_provider_id=p_email_id) THEN RETURN; END IF;
 INSERT INTO public.menupro_email_delivery_events(event_id,email_id,event_type,occurred_at) VALUES(p_event_id,p_email_id,p_type,p_occurred_at) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.menupro_fiscal_documents SET email_provider_id=coalesce(email_provider_id,p_email_id),email_accepted_at=coalesce(email_accepted_at,p_occurred_at),
  delivery_state=CASE WHEN p_type='email.complained' THEN 'complained' WHEN p_type IN ('email.bounced','email.failed','email.suppressed') AND delivery_state<>'complained' THEN 'bounced'
   WHEN p_type='email.delivered' AND delivery_state NOT IN ('bounced','complained') THEN 'delivered'
   WHEN p_type='email.delivery_delayed' AND delivery_state NOT IN ('delivered','bounced','complained') THEN 'delayed'
   WHEN p_type='email.sent' AND delivery_state NOT IN ('delayed','delivered','bounced','complained') THEN 'accepted' ELSE delivery_state END,
  email_delivered_at=CASE WHEN p_type='email.delivered' THEN coalesce(email_delivered_at,p_occurred_at) ELSE email_delivered_at END,updated_at=now()
 WHERE email_provider_id=p_email_id OR email_tag_id=p_document_tag;
 UPDATE public.menupro_notifications SET email_event_status=CASE WHEN p_type='email.complained' THEN 'complained' WHEN p_type IN ('email.bounced','email.failed','email.suppressed') AND email_event_status IS DISTINCT FROM 'complained' THEN 'bounced'
   WHEN p_type='email.delivered' AND coalesce(email_event_status,'') NOT IN ('bounced','complained') THEN 'delivered'
   WHEN p_type='email.delivery_delayed' AND coalesce(email_event_status,'') NOT IN ('delivered','bounced','complained') THEN 'delayed' ELSE email_event_status END,
 email_event_at=greatest(coalesce(email_event_at,p_occurred_at),p_occurred_at) WHERE email_provider_id=p_email_id;
END; $$;
CREATE OR REPLACE FUNCTION public.menupro_ack_notification(p_secret text,p_notification_id uuid,p_token uuid,p_sent boolean,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_sent_at=CASE WHEN p_sent THEN now() ELSE email_sent_at END,
 email_provider_id=CASE WHEN p_sent THEN coalesce(email_provider_id,p_email_id) ELSE email_provider_id END,
 email_event_status=CASE WHEN p_sent AND coalesce(email_event_status,'') NOT IN ('delayed','delivered','bounced','complained') THEN 'accepted' ELSE email_event_status END,
 delivery_attempts=delivery_attempts+1,delivery_token=NULL,delivery_lease_until=NULL WHERE id=p_notification_id AND delivery_token=p_token AND p_token IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'El aviso ya no está reservado.'; END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.menupro_check_operations(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb; h public.menupro_operation_heartbeat; v_codes jsonb; v_count integer;
BEGIN
 v_result:=public.menupro_check_operations_base(p_secret);
 SELECT * INTO h FROM public.menupro_operation_heartbeat WHERE id;
 PERFORM public.menupro_set_operational_incident('external_monitor_stale','La vigilancia externa dejó de comprobar MenuPro',coalesce(h.last_external_probe_at,h.enabled_at)<now()-interval '150 minutes',jsonb_build_object('last_probe_at',h.last_external_probe_at));
 SELECT (SELECT count(*) FROM public.menupro_fiscal_documents WHERE delivery_state='delayed')+(SELECT count(*) FROM public.menupro_notifications WHERE email_event_status='delayed') INTO v_count;
 PERFORM public.menupro_set_operational_incident('email_delayed','Resend informó correos con entrega demorada',v_count>0,jsonb_build_object('count',v_count));
 SELECT coalesce(jsonb_agg(code ORDER BY code),'[]') INTO v_codes FROM public.menupro_operational_incidents WHERE resolved_at IS NULL;
 RETURN v_result||jsonb_build_object('healthy',jsonb_array_length(v_codes)=0,'codes',v_codes);
END; $$;
