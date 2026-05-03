package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.ui.auth.AuthenticationState
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    fun getAuthState(): Flow<AuthenticationState>
    fun getCurrentUser(): Flow<UserInfo?>
    suspend fun signIn(email: String, password: String)
    suspend fun signOut()
}
