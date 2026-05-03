package com.alhasanah.alhasanahmedia.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.alhasanah.alhasanahmedia.MainActivity
import com.alhasanah.alhasanahmedia.R
import com.alhasanah.alhasanahmedia.data.model.FCMTokenDto
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject

class MyFirebaseMessagingService : FirebaseMessagingService() {

    private val auth: Auth by inject()
    private val postgrest: Postgrest by inject()
    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed token: $token")
        sendTokenToBackend(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        val targetUserId = remoteMessage.data["user_id"]
        val currentUserId = auth.currentUserOrNull()?.id

        // VALIDASI: Hanya tampilkan jika user_id cocok atau jika ini broadcast tanpa user_id spesifik
        if (targetUserId == null || targetUserId == currentUserId) {
            remoteMessage.notification?.let {
                showNotification(it.title ?: "Alhasanah Media", it.body ?: "", remoteMessage.data)
            } ?: run {
                // If only data payload
                val title = remoteMessage.data["title"] ?: "Alhasanah Media"
                val body = remoteMessage.data["body"] ?: ""
                showNotification(title, body, remoteMessage.data)
            }
        } else {
            Log.d(TAG, "Notification ignored: Target user $targetUserId does not match current user $currentUserId")
        }
    }

    private fun sendTokenToBackend(token: String) {
        val currentUser = auth.currentUserOrNull()
        if (currentUser != null) {
            scope.launch {
                try {
                    val fcmTokenDto = FCMTokenDto(
                        userId = currentUser.id,
                        fcmToken = token
                    )
                    postgrest["user_devices"].upsert(listOf(fcmTokenDto))
                    Log.d(TAG, "Token sent to backend successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Error sending token to backend", e)
                }
            }
        } else {
            Log.d(TAG, "No user logged in, token not sent")
        }
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val channelId = "alhasanah_notif_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Alhasanah Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi Penting Alhasanah"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val type = data["type"]
        val id = data["id"] // ID related to the notification (e.g., tagihan ID or violation ID)
        val nis = data["nis"] // Santri NIS if applicable

        // Build Intent for deep linking or simple open
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            // Put data for navigation in MainActivity/Compose
            putExtra("notif_type", type)
            putExtra("notif_id", id)
            putExtra("notif_nis", nis)
        }

        val notificationId = System.currentTimeMillis().toInt()

        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.logo)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    override fun onDestroy() {
        super.onDestroy()
        job.cancel()
    }

    companion object {
        private const val TAG = "MyFCMService"
    }
}
