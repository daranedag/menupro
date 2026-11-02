-- The hourly worker also watches the independent probe. This detects a disabled
-- GitHub schedule (including inactivity suspension on public repositories).
ALTER TABLE public.menupro_operation_heartbeat ADD COLUMN last_external_probe_at timestamptz;
CREATE FUNCTION public.menupro_record_external_probe(p_secret text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_operation_heartbeat SET last_external_probe_at=now() WHERE id;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_record_external_probe(text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_record_external_probe(text) TO anon;

ALTER FUNCTION public.menupro_check_operations(text) RENAME TO menupro_check_operations_base;
REVOKE ALL ON FUNCTION public.menupro_check_operations_base(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.menupro_check_operations(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb; h public.menupro_operation_heartbeat; v_codes jsonb;
BEGIN
 v_result:=public.menupro_check_operations_base(p_secret);
 SELECT * INTO h FROM public.menupro_operation_heartbeat WHERE id;
 PERFORM public.menupro_set_operational_incident('external_monitor_stale','La vigilancia externa dejó de comprobar MenuPro',coalesce(h.last_external_probe_at,h.enabled_at)<now()-interval '150 minutes',jsonb_build_object('last_probe_at',h.last_external_probe_at));
 SELECT coalesce(jsonb_agg(code ORDER BY code),'[]') INTO v_codes FROM public.menupro_operational_incidents WHERE resolved_at IS NULL;
 RETURN v_result||jsonb_build_object('healthy',jsonb_array_length(v_codes)=0,'codes',v_codes);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_check_operations(text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_check_operations(text) TO anon;

-- Associate an early provider event before the sender's acknowledgement. The
-- signature is checked in Next.js; tags identify only MenuPro's queued notices.
CREATE FUNCTION public.menupro_record_email_event_v2(p_secret text,p_event_id text,p_email_id text,p_type text,p_occurred_at timestamptz,p_document_tag uuid DEFAULT NULL,p_notification_tag uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_provider_id=p_email_id WHERE id=p_notification_tag AND email_provider_id IS NULL AND delivery_token IS NOT NULL;
 PERFORM public.menupro_record_email_event(p_secret,p_event_id,p_email_id,p_type,p_occurred_at,p_document_tag);
 DELETE FROM public.menupro_fiscal_delivery_payloads p USING public.menupro_fiscal_documents d
 WHERE p.payment_id=d.payment_id AND d.email_provider_id=p_email_id AND d.email_accepted_at IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_record_email_event_v2(text,text,text,text,timestamptz,uuid,uuid) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_record_email_event_v2(text,text,text,text,timestamptz,uuid,uuid) TO anon;

CREATE OR REPLACE FUNCTION public.menupro_ack_notification(p_secret text,p_notification_id uuid,p_token uuid,p_sent boolean,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_sent_at=CASE WHEN p_sent THEN now() ELSE email_sent_at END,
 email_provider_id=CASE WHEN p_sent THEN coalesce(email_provider_id,p_email_id) ELSE email_provider_id END,
 email_event_status=CASE WHEN p_sent AND coalesce(email_event_status,'') NOT IN ('delivered','bounced','complained') THEN 'accepted' ELSE email_event_status END,
 delivery_attempts=delivery_attempts+1,delivery_token=NULL,delivery_lease_until=NULL
 WHERE id=p_notification_id AND delivery_token=p_token AND p_token IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'El aviso ya no está reservado.'; END IF;
END; $$;
