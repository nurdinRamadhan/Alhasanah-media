 -- 1. Aktifkan RLS pada tabel notification_queue
     ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
    
     -- 2. Kebijakan untuk Melihat (Select)
     CREATE POLICY "Users can view their own notifications"
     ON public.notification_queue
     FOR SELECT
     TO authenticated
     USING (auth.uid() = user_id);
   
    -- 3. Kebijakan untuk Menghapus (Delete)
    CREATE POLICY "Users can delete their own notifications"
    ON public.notification_queue
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
 CREATE OR REPLACE FUNCTION public.broadcast_notification_v3(
         p_title TEXT,
         p_body TEXT,
         p_target_kelas TEXT DEFAULT 'ALL',
         p_source TEXT DEFAULT 'broadcast_admin'
     ) RETURNS TABLE (inserted_count bigint) AS $$
     DECLARE
         v_count bigint;
     BEGIN
        INSERT INTO public.notification_queue (user_id, title, body, source_table, data)
        SELECT DISTINCT ON (wali_id) 
            wali_id, p_title, p_body, p_source, 
            jsonb_build_object('type', 'broadcast', 'target', p_target_kelas)
        FROM public.santri
        WHERE wali_id IS NOT NULL
        AND (p_target_kelas = 'ALL' OR kelas::text = p_target_kelas);
   
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN QUERY SELECT v_count;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
 -- Izinkan user untuk mengelola token mereka sendiri (Insert/Update)
     CREATE POLICY "Users can manage their own devices" 
     ON public.user_devices 
     FOR ALL 
     TO authenticated 
     USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

