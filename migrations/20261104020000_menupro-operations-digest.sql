CREATE TABLE public.menupro_operational_digests (
 report_date date PRIMARY KEY,
 payload jsonb NOT NULL,
 claim_token uuid,
 claim_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 accepted_at timestamptz,
 email_provider_id text
);
ALTER TABLE public.menupro_operational_digests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menupro_operational_digests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menupro_operational_digests TO authenticated;
CREATE POLICY menupro_digest_admin_read ON public.menupro_operational_digests
 FOR SELECT TO authenticated USING(public.menupro_is_admin());

ALTER TABLE public.menupro_operational_alerts
 ADD COLUMN digest_date date REFERENCES public.menupro_operational_digests(report_date),
 ADD COLUMN details_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.menupro_set_operational_incident(p_code text,p_summary text,p_active boolean,p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 SELECT id INTO v_id FROM public.menupro_operational_incidents WHERE code=p_code AND resolved_at IS NULL FOR UPDATE;
 IF p_active THEN
  IF v_id IS NULL THEN
   INSERT INTO public.menupro_operational_incidents(code,summary,details) VALUES(p_code,p_summary,p_details) RETURNING id INTO v_id;
   INSERT INTO public.menupro_operational_alerts(incident_id,transition,subject,message,details_snapshot)
    VALUES(v_id,'opened','MenuPro · '||p_summary,p_summary||'. Revisa Alertas operativas en el panel de administración.',p_details);
  ELSE
   UPDATE public.menupro_operational_incidents SET last_seen_at=now(),details=p_details WHERE id=v_id;
  END IF;
 ELSIF v_id IS NOT NULL THEN
  UPDATE public.menupro_operational_incidents SET resolved_at=now(),last_seen_at=now() WHERE id=v_id;
  INSERT INTO public.menupro_operational_alerts(incident_id,transition,subject,message,details_snapshot)
   VALUES(v_id,'resolved','MenuPro · Recuperado: '||p_summary,'La condición que originó la alerta ya no está presente: '||p_summary||'.',p_details);
 END IF;
END; $$;

CREATE FUNCTION public.menupro_claim_operations_digest(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 v_local timestamp:=now() AT TIME ZONE 'America/Santiago';
 v_day date:=v_local::date;
 v_cutoff timestamptz:=(v_day+time '17:00') AT TIME ZONE 'America/Santiago';
 v_digest public.menupro_operational_digests;
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 IF v_local::time < time '17:00' THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('menupro-operational-alerts'));
 IF EXISTS(SELECT 1 FROM public.menupro_operational_digests WHERE report_date<v_day AND claim_until>now()) THEN
  RETURN NULL;
 END IF;
 INSERT INTO public.menupro_operational_digests(report_date,payload)
 SELECT v_day,jsonb_build_object(
  'change_count',(SELECT count(*) FROM public.menupro_operational_alerts WHERE accepted_at IS NULL AND created_at<=v_cutoff),
  'changes',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM (
    SELECT subject,transition,created_at FROM public.menupro_operational_alerts
    WHERE accepted_at IS NULL AND created_at<=v_cutoff ORDER BY created_at DESC,id DESC LIMIT 100
  ) a),'[]'),
  'open',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.opened_at) FROM (
    SELECT summary,opened_at FROM public.menupro_operational_incidents
    WHERE opened_at<=v_cutoff AND (resolved_at IS NULL OR resolved_at>v_cutoff)
  ) i),'[]'))
 ON CONFLICT DO NOTHING;
 IF FOUND THEN
  UPDATE public.menupro_operational_alerts SET digest_date=v_day
   WHERE accepted_at IS NULL AND created_at<=v_cutoff;
 END IF;
 UPDATE public.menupro_operational_digests SET claim_token=gen_random_uuid(),
  claim_until=now()+interval '10 minutes',attempts=attempts+1
 WHERE report_date=v_day AND accepted_at IS NULL AND (claim_until IS NULL OR claim_until<=now())
 RETURNING * INTO v_digest;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(v_digest);
END; $$;

CREATE FUNCTION public.menupro_complete_operations_digest(p_secret text,p_day date,p_token uuid,p_email_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.menupro_require_worker(p_secret);
 PERFORM pg_advisory_xact_lock(hashtext('menupro-operational-alerts'));
 UPDATE public.menupro_operational_digests SET accepted_at=CASE WHEN p_email_id IS NOT NULL THEN now() END,
  email_provider_id=p_email_id,claim_token=NULL,claim_until=CASE WHEN p_email_id IS NULL THEN now()+interval '5 minutes' END
 WHERE report_date=p_day AND claim_token=p_token;
 IF NOT FOUND THEN RAISE EXCEPTION 'El resumen ya no está reservado.'; END IF;
 IF p_email_id IS NOT NULL THEN
  UPDATE public.menupro_operational_alerts SET accepted_at=now(),email_provider_id=p_email_id
   WHERE digest_date=p_day AND accepted_at IS NULL;
 END IF;
END; $$;

REVOKE ALL ON FUNCTION public.menupro_claim_operations_digest(text),
 public.menupro_complete_operations_digest(text,date,uuid,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.menupro_claim_operations_digest(text),
 public.menupro_complete_operations_digest(text,date,uuid,text) TO anon;
