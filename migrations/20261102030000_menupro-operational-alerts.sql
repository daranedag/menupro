CREATE TABLE public.menupro_operation_heartbeat (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enabled_at timestamptz NOT NULL DEFAULT now(),
 last_started_at timestamptz,
 last_finished_at timestamptz,
 last_success_at timestamptz,
 last_ok boolean,
 summary jsonb NOT NULL DEFAULT '{}'
);
INSERT INTO public.menupro_operation_heartbeat(id) VALUES(true);
CREATE TABLE public.menupro_operational_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL,summary text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',opened_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
CREATE UNIQUE INDEX menupro_operational_open_code ON public.menupro_operational_incidents(code) WHERE resolved_at IS NULL;
CREATE TABLE public.menupro_operational_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid NOT NULL REFERENCES public.menupro_operational_incidents(id),
 transition text NOT NULL CHECK(transition IN ('opened','resolved')),subject text NOT NULL,message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,email_provider_id text,
 attempts integer NOT NULL DEFAULT 0,claim_token uuid,claim_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(incident_id,transition)
);
ALTER TABLE public.menupro_operation_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_operational_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menupro_operational_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_operation_heartbeat,public.menupro_operational_incidents,public.menupro_operational_alerts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_operation_heartbeat,public.menupro_operational_incidents,public.menupro_operational_alerts TO authenticated;
CREATE POLICY menupro_heartbeat_admin_read ON public.menupro_operation_heartbeat FOR SELECT TO authenticated USING(public.menupro_is_admin());
CREATE POLICY menupro_incidents_admin_read ON public.menupro_operational_incidents FOR SELECT TO authenticated USING(public.menupro_is_admin());
CREATE POLICY menupro_alerts_admin_read ON public.menupro_operational_alerts FOR SELECT TO authenticated USING(public.menupro_is_admin());

CREATE FUNCTION public.menupro_record_heartbeat(p_secret text,p_phase text,p_ok boolean DEFAULT NULL,p_summary jsonb DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 IF p_phase='started' THEN UPDATE public.menupro_operation_heartbeat SET last_started_at=now() WHERE id;
 ELSIF p_phase='finished' AND p_ok IS NOT NULL THEN
  UPDATE public.menupro_operation_heartbeat SET last_finished_at=now(),last_ok=p_ok,last_success_at=CASE WHEN p_ok THEN now() ELSE last_success_at END,
   summary=jsonb_build_object('email_failures',greatest(0,coalesce((p_summary->>'email_failures')::integer,0)),'payment_failures',greatest(0,coalesce((p_summary->>'payment_failures')::integer,0))) WHERE id;
 ELSE RAISE EXCEPTION 'Estado de mantenimiento inválido.'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_record_heartbeat(text,text,boolean,jsonb) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_record_heartbeat(text,text,boolean,jsonb) TO anon;

CREATE FUNCTION public.menupro_set_operational_incident(p_code text,p_summary text,p_active boolean,p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 SELECT id INTO v_id FROM public.menupro_operational_incidents WHERE code=p_code AND resolved_at IS NULL FOR UPDATE;
 IF p_active THEN
  IF v_id IS NULL THEN
   INSERT INTO public.menupro_operational_incidents(code,summary,details) VALUES(p_code,p_summary,p_details) RETURNING id INTO v_id;
   INSERT INTO public.menupro_operational_alerts(incident_id,transition,subject,message) VALUES(v_id,'opened','MenuPro · '||p_summary,p_summary||'. Revisa Alertas operativas en el panel de administración.');
  ELSE UPDATE public.menupro_operational_incidents SET last_seen_at=now(),details=p_details WHERE id=v_id; END IF;
 ELSIF v_id IS NOT NULL THEN
  UPDATE public.menupro_operational_incidents SET resolved_at=now(),last_seen_at=now() WHERE id=v_id;
  INSERT INTO public.menupro_operational_alerts(incident_id,transition,subject,message) VALUES(v_id,'resolved','MenuPro · Recuperado: '||p_summary,'La condición que originó la alerta ya no está presente: '||p_summary||'. Puedes revisar el historial en administración.');
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_set_operational_incident(text,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;

ALTER TABLE public.menupro_notifications ADD COLUMN email_provider_id text,ADD COLUMN email_event_status text,
 ADD COLUMN email_event_at timestamptz,ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0;
CREATE INDEX menupro_notification_email_id ON public.menupro_notifications(email_provider_id) WHERE email_provider_id IS NOT NULL;
CREATE FUNCTION public.menupro_ack_notification(p_secret text,p_notification_id uuid,p_token uuid,p_sent boolean,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_sent_at=CASE WHEN p_sent THEN now() ELSE email_sent_at END,
 email_provider_id=CASE WHEN p_sent THEN p_email_id ELSE email_provider_id END,
 email_event_status=CASE WHEN p_sent THEN 'accepted' ELSE email_event_status END,
 delivery_attempts=delivery_attempts+1,delivery_token=NULL,delivery_lease_until=NULL
 WHERE id=p_notification_id AND delivery_token=p_token AND p_token IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'El aviso ya no está reservado.'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_ack_notification(text,uuid,uuid,boolean,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_ack_notification(text,uuid,uuid,boolean,text) TO anon;

CREATE TABLE public.menupro_email_delivery_events (
 event_id text PRIMARY KEY,email_id text NOT NULL,event_type text NOT NULL,occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menupro_email_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_email_delivery_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_email_delivery_events TO authenticated;
CREATE POLICY menupro_email_events_admin_read ON public.menupro_email_delivery_events FOR SELECT TO authenticated USING(public.menupro_is_admin());
CREATE FUNCTION public.menupro_record_email_event(p_secret text,p_event_id text,p_email_id text,p_type text,p_occurred_at timestamptz,p_document_tag uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 IF length(p_event_id)>200 OR length(p_email_id)>200 OR p_type NOT IN ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed') OR p_occurred_at IS NULL OR p_occurred_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Evento de correo inválido.'; END IF;
 -- Ignore messages from other applications sharing this Resend account.
 IF NOT EXISTS(SELECT 1 FROM public.menupro_fiscal_documents WHERE email_provider_id=p_email_id OR email_tag_id=p_document_tag)
 AND NOT EXISTS(SELECT 1 FROM public.menupro_notifications WHERE email_provider_id=p_email_id) THEN RETURN; END IF;
 INSERT INTO public.menupro_email_delivery_events(event_id,email_id,event_type,occurred_at) VALUES(p_event_id,p_email_id,p_type,p_occurred_at) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.menupro_fiscal_documents SET email_provider_id=coalesce(email_provider_id,p_email_id),email_accepted_at=coalesce(email_accepted_at,p_occurred_at),
  delivery_state=CASE WHEN p_type='email.complained' THEN 'complained' WHEN p_type IN ('email.bounced','email.failed') AND delivery_state<>'complained' THEN 'bounced' WHEN p_type='email.delivered' AND delivery_state NOT IN ('bounced','complained') THEN 'delivered' WHEN p_type='email.sent' AND delivery_state NOT IN ('delivered','bounced','complained') THEN 'accepted' ELSE delivery_state END,
  email_delivered_at=CASE WHEN p_type='email.delivered' THEN coalesce(email_delivered_at,p_occurred_at) ELSE email_delivered_at END,updated_at=now()
 WHERE email_provider_id=p_email_id OR email_tag_id=p_document_tag;
 UPDATE public.menupro_notifications SET email_event_status=CASE WHEN p_type='email.complained' THEN 'complained' WHEN p_type IN ('email.bounced','email.failed') AND email_event_status IS DISTINCT FROM 'complained' THEN 'bounced' WHEN p_type='email.delivered' AND coalesce(email_event_status,'') NOT IN ('bounced','complained') THEN 'delivered' ELSE email_event_status END,
 email_event_at=greatest(coalesce(email_event_at,p_occurred_at),p_occurred_at) WHERE email_provider_id=p_email_id;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_record_email_event(text,text,text,text,timestamptz,uuid) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_record_email_event(text,text,text,text,timestamptz,uuid) TO anon;

CREATE FUNCTION public.menupro_check_operations(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE h public.menupro_operation_heartbeat; v_count integer; v_codes jsonb;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 PERFORM pg_advisory_xact_lock(hashtext('menupro-operational-alerts'));
 SELECT * INTO h FROM public.menupro_operation_heartbeat WHERE id;
 PERFORM public.menupro_set_operational_incident('lifecycle_stale','El mantenimiento automático dejó de responder',coalesce(h.last_finished_at,h.enabled_at)<now()-interval '150 minutes',jsonb_build_object('last_finished_at',h.last_finished_at));
 PERFORM public.menupro_set_operational_incident('lifecycle_failed','El mantenimiento automático terminó con errores',h.last_ok IS FALSE,h.summary);
 SELECT count(*) INTO v_count FROM public.menupro_reconciliation_jobs j JOIN public.menupro_checkout_requests r ON r.id=j.request_id WHERE j.failures>=3 AND r.status IN ('pending','ready','authorized','paid');
 PERFORM public.menupro_set_operational_incident('payment_recovery','Hay pagos con errores repetidos de conciliación',v_count>0,jsonb_build_object('count',v_count));
 SELECT count(*) INTO v_count FROM public.menupro_notifications n JOIN public.menupro_businesses b ON b.id=n.business_id JOIN auth.users u ON u.id=b.owner_id WHERE n.email_sent_at IS NULL AND n.created_at<now()-interval '2 hours' AND u.email_verified;
 PERFORM public.menupro_set_operational_incident('notification_backlog','Hay correos pendientes desde hace más de dos horas',v_count>0,jsonb_build_object('count',v_count));
 SELECT count(*) INTO v_count FROM public.menupro_fiscal_documents WHERE delivery_state IN ('failed','unknown','bounced','complained') OR (delivery_state IN ('queued','sending') AND email_queued_at<now()-interval '2 hours');
 PERFORM public.menupro_set_operational_incident('fiscal_delivery','Hay boletas con problemas de envío',v_count>0,jsonb_build_object('count',v_count));
 SELECT count(*) INTO v_count FROM public.menupro_notifications WHERE email_event_status IN ('bounced','complained');
 PERFORM public.menupro_set_operational_incident('email_delivery','Resend informó correos rechazados o reclamos',v_count>0,jsonb_build_object('count',v_count));
 SELECT count(*) INTO v_count FROM public.menupro_fiscal_documents WHERE (status='pending' OR storage_key IS NULL) AND created_at<now()-interval '72 hours';
 PERFORM public.menupro_set_operational_incident('fiscal_backlog','Hay boletas pendientes de emisión o PDF desde hace más de 72 horas',v_count>0,jsonb_build_object('count',v_count));
 SELECT coalesce(jsonb_agg(code ORDER BY code),'[]') INTO v_codes FROM public.menupro_operational_incidents WHERE resolved_at IS NULL;
 RETURN jsonb_build_object('healthy',jsonb_array_length(v_codes)=0,'codes',v_codes,'last_finished_at',h.last_finished_at);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_check_operations(text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_check_operations(text) TO anon;

CREATE FUNCTION public.menupro_claim_operational_alert(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.menupro_operational_alerts;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO a FROM public.menupro_operational_alerts WHERE accepted_at IS NULL AND next_attempt_at<=now() AND coalesce(claim_until,now())<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF a.id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.menupro_operational_alerts SET claim_token=gen_random_uuid(),claim_until=now()+interval '10 minutes',attempts=attempts+1 WHERE id=a.id RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $$;
CREATE FUNCTION public.menupro_complete_operational_alert(p_secret text,p_id uuid,p_token uuid,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_operational_alerts SET accepted_at=CASE WHEN p_email_id IS NOT NULL THEN now() END,email_provider_id=p_email_id,claim_token=NULL,claim_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=p_id AND claim_token=p_token AND p_token IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'La alerta ya no está reservada.'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_claim_operational_alert(text),public.menupro_complete_operational_alert(text,uuid,uuid,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_claim_operational_alert(text),public.menupro_complete_operational_alert(text,uuid,uuid,text) TO anon;
