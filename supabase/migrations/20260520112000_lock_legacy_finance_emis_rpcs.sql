-- Lock legacy RPCs that are not used directly by the current admin panel.
-- Current cash-payment flow updates tagihan_santri and relies on DB triggers.
-- Current EMIS export Edge Function calls export_santri_emis(), not the legacy
-- export_emis_pesantren_santri() wrapper.

REVOKE ALL ON FUNCTION public.terima_bayar_manual(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terima_bayar_manual(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.export_emis_pesantren_santri(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_emis_pesantren_santri(text, integer) TO service_role;
