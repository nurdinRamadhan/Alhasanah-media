package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.ui.auth.AuthenticationState
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus // Sesuai dokumentasi v3
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class AuthRepositoryImpl(private val supabaseClient: SupabaseClient) : AuthRepository {

    override fun getAuthState(): Flow<AuthenticationState> = supabaseClient.auth.sessionStatus.map { status ->
        when (status) {
            is SessionStatus.Authenticated -> AuthenticationState.Authenticated(status.session.user?.id ?: "")
            else -> AuthenticationState.NotAuthenticated
        }
    }

    override fun getCurrentUser(): Flow<UserInfo?> = supabaseClient.auth.sessionStatus.map {
        (it as? SessionStatus.Authenticated)?.session?.user
    }

    override suspend fun signIn(email: String, password: String) {
        supabaseClient.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    override suspend fun signOut() {
        supabaseClient.auth.signOut()
    }
}