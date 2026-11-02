-- A verified delivery event can arrive before the API acknowledgement, or after
-- that API request times out. It must still prevent a second automatic send.
CREATE OR REPLACE FUNCTION public.menupro_record_email_event_v2(p_secret text,p_event_id text,p_email_id text,p_type text,p_occurred_at timestamptz,p_document_tag uuid DEFAULT NULL,p_notification_tag uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 UPDATE public.menupro_notifications SET email_provider_id=p_email_id WHERE id=p_notification_tag AND email_provider_id IS NULL AND delivery_token IS NOT NULL;
 PERFORM public.menupro_record_email_event(p_secret,p_event_id,p_email_id,p_type,p_occurred_at,p_document_tag);
 UPDATE public.menupro_notifications SET email_sent_at=coalesce(email_sent_at,p_occurred_at) WHERE email_provider_id=p_email_id;
 DELETE FROM public.menupro_fiscal_delivery_payloads p USING public.menupro_fiscal_documents d WHERE p.payment_id=d.payment_id AND d.email_provider_id=p_email_id AND d.email_accepted_at IS NOT NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.menupro_complete_fiscal_delivery(p_secret text,p_payment_id text,p_token uuid,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.email_claim_token IS DISTINCT FROM p_token OR d.email_claim_until<=now() OR p_token IS NULL THEN RAISE EXCEPTION 'El envío ya no está reservado.'; END IF;
 IF p_email_id IS NOT NULL AND (length(p_email_id) NOT BETWEEN 1 AND 200 OR p_email_id !~ '^[a-zA-Z0-9_-]+$') THEN RAISE EXCEPTION 'Respuesta de correo inválida.'; END IF;
 UPDATE public.menupro_fiscal_documents SET delivery_state=CASE WHEN delivery_state IN ('delayed','delivered','bounced','complained') THEN delivery_state WHEN email_accepted_at IS NOT NULL OR p_email_id IS NOT NULL THEN 'accepted' ELSE 'failed' END,
 email_provider_id=coalesce(email_provider_id,p_email_id),email_accepted_at=CASE WHEN p_email_id IS NOT NULL THEN coalesce(email_accepted_at,now()) ELSE email_accepted_at END,
 email_claim_token=NULL,email_claim_until=NULL,email_next_attempt_at=CASE WHEN p_email_id IS NULL AND email_accepted_at IS NULL THEN now()+interval '5 minutes' END,updated_at=now() WHERE payment_id=p_payment_id;
 IF p_email_id IS NOT NULL OR d.email_accepted_at IS NOT NULL THEN DELETE FROM public.menupro_fiscal_delivery_payloads WHERE payment_id=p_payment_id; END IF;
END; $$;

ALTER POLICY menupro_fiscal_storage_read_guard ON storage.objects TO anon,authenticated;
ALTER POLICY menupro_fiscal_storage_insert_guard ON storage.objects TO anon,authenticated;
ALTER POLICY menupro_fiscal_storage_update_guard ON storage.objects TO anon,authenticated;
ALTER POLICY menupro_fiscal_storage_delete_guard ON storage.objects TO anon,authenticated;
