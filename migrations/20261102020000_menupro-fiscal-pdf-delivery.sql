ALTER TABLE public.menupro_fiscal_documents
 ADD COLUMN storage_key text,
 ADD COLUMN storage_url text,
 ADD COLUMN pdf_sha256 text CHECK(pdf_sha256 IS NULL OR pdf_sha256 ~ '^[a-f0-9]{64}$'),
 ADD COLUMN pdf_size integer CHECK(pdf_size IS NULL OR pdf_size BETWEEN 6 AND 2097152),
 ADD COLUMN email_tag_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 ADD COLUMN delivery_state text NOT NULL DEFAULT 'not_sent' CHECK(delivery_state IN ('not_sent','queued','sending','failed','unknown','accepted','delivered','bounced','complained')),
 ADD COLUMN email_queued_at timestamptz,
 ADD COLUMN email_first_attempt_at timestamptz,
 ADD COLUMN email_last_attempt_at timestamptz,
 ADD COLUMN email_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN email_next_attempt_at timestamptz,
 ADD COLUMN email_claim_token uuid,
 ADD COLUMN email_claim_until timestamptz,
 ADD COLUMN email_provider_id text,
 ADD COLUMN email_accepted_at timestamptz,
 ADD COLUMN email_delivered_at timestamptz;
CREATE UNIQUE INDEX menupro_fiscal_storage_key ON public.menupro_fiscal_documents(storage_key) WHERE storage_key IS NOT NULL;
CREATE UNIQUE INDEX menupro_fiscal_email_id ON public.menupro_fiscal_documents(email_provider_id) WHERE email_provider_id IS NOT NULL;

-- Only the leased sender can obtain this temporary attachment payload. It is
-- deleted after Resend accepts it; the canonical PDF remains in private storage.
CREATE TABLE public.menupro_fiscal_delivery_payloads (
 payment_id text PRIMARY KEY REFERENCES public.menupro_fiscal_documents(payment_id),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 6 AND 2097152)
);
ALTER TABLE public.menupro_fiscal_delivery_payloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_fiscal_delivery_payloads FROM PUBLIC,anon,authenticated;

-- Preserve the existing owner policies on every other application's bucket.
CREATE POLICY menupro_fiscal_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket='menupro_fiscal' AND (public.menupro_is_admin() OR EXISTS(
 SELECT 1 FROM public.menupro_fiscal_documents d WHERE d.storage_key=key AND public.menupro_business_role(d.business_id)='owner')));
CREATE POLICY menupro_fiscal_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket<>'menupro_fiscal' OR public.menupro_is_admin() OR EXISTS(
 SELECT 1 FROM public.menupro_fiscal_documents d WHERE d.storage_key=key AND public.menupro_business_role(d.business_id)='owner'));
CREATE POLICY menupro_fiscal_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket<>'menupro_fiscal' OR (public.menupro_is_admin() AND mime_type='application/pdf' AND size BETWEEN 6 AND 2097152));
CREATE POLICY menupro_fiscal_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket<>'menupro_fiscal') WITH CHECK(bucket<>'menupro_fiscal');
CREATE POLICY menupro_fiscal_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket<>'menupro_fiscal' OR (public.menupro_is_admin() AND NOT EXISTS(SELECT 1 FROM public.menupro_fiscal_documents d WHERE d.storage_key=key)));

-- Recording a folio no longer sends a separate notice without its actual PDF.
CREATE OR REPLACE FUNCTION public.menupro_admin_issue_honorarium(p_payment_id text,p_folio text,p_issued_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.payment_id IS NULL THEN RAISE EXCEPTION 'Documento no encontrado.'; END IF;
 IF d.status='issued' THEN
  IF d.folio=p_folio AND d.issued_date=p_issued_date THEN RETURN to_jsonb(d); END IF;
  RAISE EXCEPTION 'La boleta ya fue registrada. Una corrección requiere revisión administrativa.';
 END IF;
 IF d.review_required OR p_folio IS NULL OR p_folio !~ '^[0-9]{1,20}$' OR p_issued_date IS NULL OR p_issued_date>(now() AT TIME ZONE 'America/Santiago')::date OR extract(year FROM p_issued_date)<>extract(year FROM d.expected_issue_date) THEN
  RAISE EXCEPTION 'Revisa el pago, el folio y el año tributario antes de registrar la boleta.';
 END IF;
 UPDATE public.menupro_fiscal_documents SET status='issued',folio=p_folio,issued_date=p_issued_date,updated_at=now() WHERE payment_id=p_payment_id RETURNING * INTO d;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_issued',jsonb_build_object('payment_id',p_payment_id,'folio',p_folio,'issued_date',p_issued_date));
 RETURN to_jsonb(d);
END; $$;

CREATE FUNCTION public.menupro_admin_attach_honorarium(p_payment_id text,p_folio text,p_issued_date date,p_key text,p_url text,p_sha256 text,p_content text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents; v_bytes bytea;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 PERFORM public.menupro_admin_issue_honorarium(p_payment_id,p_folio,p_issued_date);
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.review_required OR d.email_queued_at IS NOT NULL THEN RAISE EXCEPTION 'El documento está en revisión o ya tiene un envío registrado; no se puede sustituir.'; END IF;
 IF p_content IS NULL OR length(p_content)>2796208 THEN RAISE EXCEPTION 'El PDF debe pesar como máximo 2 MB.'; END IF;
 v_bytes:=decode(p_content,'base64');
 IF octet_length(v_bytes) NOT BETWEEN 6 AND 2097152 OR substring(v_bytes FROM 1 FOR 5)<>convert_to('%PDF-','UTF8') OR encode(sha256(v_bytes),'hex') IS DISTINCT FROM p_sha256 THEN RAISE EXCEPTION 'El PDF no es válido.'; END IF;
 IF p_key IS NULL OR p_key NOT LIKE d.business_id::text||'/%' OR p_url IS NULL OR length(p_url)>2000 OR NOT EXISTS(
  SELECT 1 FROM storage.objects o WHERE o.bucket='menupro_fiscal' AND o.key=p_key AND o.uploaded_by=auth.uid()::text AND o.size=octet_length(v_bytes) AND o.mime_type='application/pdf') THEN RAISE EXCEPTION 'No se encontró el PDF privado de esta boleta.'; END IF;
 UPDATE public.menupro_fiscal_documents SET storage_key=p_key,storage_url=p_url,pdf_sha256=p_sha256,pdf_size=octet_length(v_bytes),updated_at=now() WHERE payment_id=p_payment_id RETURNING * INTO d;
 INSERT INTO public.menupro_fiscal_delivery_payloads(payment_id,content) VALUES(p_payment_id,v_bytes) ON CONFLICT(payment_id) DO UPDATE SET content=EXCLUDED.content;
 DELETE FROM public.menupro_notifications WHERE business_id=d.business_id AND event_key='honorarium-issued:'||p_payment_id AND email_sent_at IS NULL;
 INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_pdf_attached',jsonb_build_object('payment_id',p_payment_id,'sha256',p_sha256));
 RETURN to_jsonb(d);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_attach_honorarium(text,text,date,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_attach_honorarium(text,text,date,text,text,text,text) TO authenticated;

CREATE FUNCTION public.menupro_admin_queue_honorarium(p_payment_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 IF NOT public.menupro_is_admin() THEN RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.payment_id IS NULL OR d.status<>'issued' OR d.storage_key IS NULL OR d.review_required THEN RAISE EXCEPTION 'Registra el folio y el PDF de una boleta sin observaciones antes de enviarla.'; END IF;
 IF d.delivery_state IN ('unknown','bounced','complained') THEN RAISE EXCEPTION 'Revisa primero el envío en Resend. No se enviará un duplicado automáticamente.'; END IF;
 IF d.delivery_state IN ('not_sent','failed') THEN
  IF d.email_first_attempt_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'El plazo seguro para reintentar terminó. Revisa el envío en Resend.'; END IF;
  UPDATE public.menupro_fiscal_documents SET delivery_state='queued',email_queued_at=coalesce(email_queued_at,now()),email_next_attempt_at=now(),updated_at=now() WHERE payment_id=p_payment_id RETURNING * INTO d;
  INSERT INTO public.menupro_audit_events(business_id,actor_id,event,details) VALUES(d.business_id,auth.uid(),'honorarium_email_queued',jsonb_build_object('payment_id',p_payment_id));
 END IF;
 RETURN to_jsonb(d);
END; $$;
REVOKE ALL ON FUNCTION public.menupro_admin_queue_honorarium(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menupro_admin_queue_honorarium(text) TO authenticated;

CREATE FUNCTION public.menupro_claim_fiscal_delivery(p_secret text,p_payment_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 -- Resend's deduplication window is finite. Never blindly resend an ambiguous
 -- attempt after that window has elapsed.
 UPDATE public.menupro_fiscal_documents SET delivery_state='unknown',email_claim_token=NULL,email_claim_until=NULL
 WHERE delivery_state IN ('queued','sending','failed') AND email_first_attempt_at<now()-interval '23 hours' AND coalesce(email_claim_until,now())<=now();
 SELECT * INTO d FROM public.menupro_fiscal_documents
 WHERE (p_payment_id IS NULL OR payment_id=p_payment_id) AND NOT review_required
 AND delivery_state IN ('queued','failed','sending') AND coalesce(email_next_attempt_at,now())<=now() AND coalesce(email_claim_until,now())<=now()
 ORDER BY email_queued_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF d.payment_id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.menupro_fiscal_documents SET delivery_state='sending',email_claim_token=gen_random_uuid(),email_claim_until=now()+interval '10 minutes',email_first_attempt_at=coalesce(email_first_attempt_at,now()),email_last_attempt_at=now(),email_attempts=email_attempts+1 WHERE payment_id=d.payment_id RETURNING * INTO d;
 RETURN jsonb_build_object('payment_id',d.payment_id,'token',d.email_claim_token,'tag_id',d.email_tag_id,'email',d.billing_snapshot->>'email','name',d.billing_snapshot->>'legal_name','folio',d.folio,'issued_date',d.issued_date,'sha256',d.pdf_sha256,'content',(SELECT encode(content,'base64') FROM public.menupro_fiscal_delivery_payloads WHERE payment_id=d.payment_id));
END; $$;
REVOKE ALL ON FUNCTION public.menupro_claim_fiscal_delivery(text,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_claim_fiscal_delivery(text,text) TO anon;

CREATE FUNCTION public.menupro_complete_fiscal_delivery(p_secret text,p_payment_id text,p_token uuid,p_email_id text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d public.menupro_fiscal_documents;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 SELECT * INTO d FROM public.menupro_fiscal_documents WHERE payment_id=p_payment_id FOR UPDATE;
 IF d.email_claim_token IS DISTINCT FROM p_token OR d.email_claim_until<=now() OR p_token IS NULL THEN RAISE EXCEPTION 'El envío ya no está reservado.'; END IF;
 IF p_email_id IS NOT NULL AND (length(p_email_id) NOT BETWEEN 1 AND 200 OR p_email_id !~ '^[a-zA-Z0-9_-]+$') THEN RAISE EXCEPTION 'Respuesta de correo inválida.'; END IF;
 UPDATE public.menupro_fiscal_documents SET delivery_state=CASE WHEN delivery_state IN ('delivered','bounced','complained') THEN delivery_state WHEN p_email_id IS NOT NULL THEN 'accepted' ELSE 'failed' END,
 email_provider_id=coalesce(email_provider_id,p_email_id),email_accepted_at=CASE WHEN p_email_id IS NOT NULL THEN coalesce(email_accepted_at,now()) ELSE email_accepted_at END,
 email_claim_token=NULL,email_claim_until=NULL,email_next_attempt_at=CASE WHEN p_email_id IS NULL THEN now()+interval '5 minutes' END,updated_at=now() WHERE payment_id=p_payment_id;
 IF p_email_id IS NOT NULL THEN DELETE FROM public.menupro_fiscal_delivery_payloads WHERE payment_id=p_payment_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.menupro_complete_fiscal_delivery(text,text,uuid,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_complete_fiscal_delivery(text,text,uuid,text) TO anon;
