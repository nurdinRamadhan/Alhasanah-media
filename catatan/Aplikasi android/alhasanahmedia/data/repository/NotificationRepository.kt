package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.FCMTokenDto
import io.github.jan.supabase.postgrest.Postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

interface NotificationRepository {
    suspend fun updateFCMToken(userId: String, token: String)
}

class NotificationRepositoryImpl(
    private val postgrest: Postgrest
) : NotificationRepository {

    override suspend fun updateFCMToken(userId: String, token: String) {
        withContext(Dispatchers.IO) {
            try {
                val fcmTokenDto = FCMTokenDto(
                    userId = userId,
                    fcmToken = token
                )
                // Menggunakan List untuk membantu type inference di Supabase v3
                postgrest["user_devices"].upsert(listOf(fcmTokenDto))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
