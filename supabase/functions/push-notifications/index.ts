import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import admin from "npm:firebase-admin@12.0.0";

type QueueItem = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  source_table: string | null;
  event_type: string | null;
  priority: string | null;
  status: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getFirebaseApp = () => {
  const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (!serviceAccountRaw) return null;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountRaw)),
    });
  }

  return admin.app();
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      return json({
        message: "FIREBASE_SERVICE_ACCOUNT_KEY is not configured. Notification queue will remain pending.",
        configured: false,
      });
    }

    const payload = await req.json().catch(() => ({}));
    const recordId = payload?.record?.id || payload?.id;
    const limit = Number.isInteger(Number(payload?.limit)) ? Math.min(Number(payload.limit), 100) : 25;

    let itemsToProcess: QueueItem[] = [];

    if (recordId) {
      const { data, error } = await supabase
        .from("notification_queue")
        .update({ status: "sending" })
        .eq("id", recordId)
        .in("status", ["pending", "sending"])
        .select("id,user_id,title,body,data,source_table,event_type,priority,status")
        .maybeSingle();
      if (error) throw error;
      if (data) itemsToProcess = [data as QueueItem];
    } else {
      const { data, error } = await supabase
        .from("notification_queue")
        .update({ status: "sending" })
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(limit)
        .select("id,user_id,title,body,data,source_table,event_type,priority,status");
      if (error) throw error;
      itemsToProcess = (data || []) as QueueItem[];
    }

    if (itemsToProcess.length === 0) return json({ message: "No pending notifications" });

    const results = [];

    for (const item of itemsToProcess) {
      const { data: devices, error: deviceError } = await supabase
        .from("user_devices")
        .select("fcm_token")
        .eq("user_id", item.user_id)
        .eq("is_active", true);

      if (deviceError) throw deviceError;

      const tokens = (devices || [])
        .map((device: { fcm_token?: string | null }) => device.fcm_token)
        .filter((token): token is string => Boolean(token));

      if (tokens.length === 0) {
        await supabase
          .from("notification_queue")
          .update({ status: "failed", error_message: "No registered FCM tokens" })
          .eq("id", item.id);
        results.push({ id: item.id, status: "failed", reason: "no_tokens" });
        continue;
      }

      try {
        const response = await admin.messaging().sendEachForMulticast({
          notification: {
            title: item.title,
            body: item.body,
          },
          data: {
            ...Object.fromEntries(Object.entries(item.data || {}).map(([key, value]) => [key, String(value)])),
            notification_id: String(item.id),
            user_id: String(item.user_id),
            source: String(item.source_table || "wallet"),
            event_type: String(item.event_type || "generic"),
            priority: String(item.priority || "normal"),
          },
          tokens,
        });

        const failed = response.responses
          .map((result, index) => ({ result, token: tokens[index] }))
          .filter(({ result }) => !result.success);

        await supabase
          .from("notification_queue")
          .update({
            status: response.successCount > 0 ? "sent" : "failed",
            sent_at: response.successCount > 0 ? new Date().toISOString() : null,
            error_message: failed.length > 0 ? `${failed.length} token(s) failed` : null,
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: response.successCount > 0 ? "sent" : "failed",
          success_count: response.successCount,
          failure_count: response.failureCount,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "FCM send failed";
        await supabase
          .from("notification_queue")
          .update({ status: "failed", error_message: message })
          .eq("id", item.id);
        results.push({ id: item.id, status: "failed", error: message });
      }
    }

    return json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push notification worker failed.";
    return json({ error: message }, 500);
  }
});
