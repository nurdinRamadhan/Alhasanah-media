package com.alhasanah.alhasanahmedia.ui.auth

import android.util.Log // Import Android Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.repository.AuthRepository
import com.alhasanah.alhasanahmedia.data.repository.NotificationRepository
import com.alhasanah.alhasanahmedia.data.repository.WaliSantriRepository
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

// Sealed class for observing global authentication status
sealed class AuthenticationState {
    object NotAuthenticated : AuthenticationState()
    data class Authenticated(val userId: String) : AuthenticationState()
}

// Sealed class for handling the login screen's specific UI states
sealed class LoginState {
    object Idle : LoginState()
    object Loading : LoginState()
    object Success : LoginState()
    data class Error(val message: String) : LoginState()
}

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val waliSantriRepository: WaliSantriRepository,
    private val notificationRepository: NotificationRepository
) : ViewModel() {

    val authenticationState: StateFlow<AuthenticationState> = authRepository.getAuthState()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = AuthenticationState.NotAuthenticated
        )

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState.asStateFlow()

    private val _activeSantriNis = MutableStateFlow<String?>(null)
    val activeSantriNis: StateFlow<String?> = _activeSantriNis.asStateFlow()

    init {
        viewModelScope.launch {
            authenticationState.collect { state ->
                if (state is AuthenticationState.Authenticated) {
                    fetchAndSetActiveSantri(state.userId)
                    saveFcmToken(state.userId)
                } else {
                    _activeSantriNis.value = null
                }
            }
        }
    }

    private suspend fun saveFcmToken(userId: String) {
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            notificationRepository.updateFCMToken(userId, token)
            Log.d("AuthViewModel", "FCM Token saved successfully for user $userId")
        } catch (e: Exception) {
            Log.e("AuthViewModel", "Error saving FCM Token", e)
        }
    }

    private suspend fun fetchAndSetActiveSantri(waliId: String) {
        try {
            val santriList = waliSantriRepository.getSantriForWali(waliId)
            _activeSantriNis.value = santriList.firstOrNull()?.id
            Log.d("AuthViewModel", "Santri list size: ${santriList.size}")
            if (santriList.firstOrNull()?.id == null) {
                Log.w("AuthViewModel", "No active Santri NIS found for waliId: $waliId")
            }
        } catch (e: Exception) {
            _activeSantriNis.value = null
            Log.e("AuthViewModel", "Error fetching santri list for waliId $waliId: ${e.message}", e)
        }
    }

    fun getCurrentUser(): Flow<UserInfo?> {
        return authRepository.getCurrentUser()
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _loginState.value = LoginState.Loading
            try {
                authRepository.signIn(email, password)
                _loginState.value = LoginState.Success
            } catch (e: Exception) {
                _loginState.value = LoginState.Error(e.localizedMessage ?: "Terjadi kesalahan saat login")
                Log.e("AuthViewModel", "Login error: ${e.message}", e)
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            try {
                // Hapus token FCM dari backend sebelum logout
                val currentUser = authRepository.getCurrentUser().stateIn(viewModelScope).value
                if (currentUser != null) {
                    try {
                        val token = FirebaseMessaging.getInstance().token.await()
                        notificationRepository.deleteFCMToken(currentUser.id, token)
                        Log.d("AuthViewModel", "FCM Token deleted successfully for user ${currentUser.id}")
                    } catch (e: Exception) {
                        Log.e("AuthViewModel", "Failed to delete FCM token during sign out", e)
                    }
                }
                authRepository.signOut()
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Sign out error: ${e.message}", e)
            }
        }
    }

    fun resetLoginState() {
        _loginState.value = LoginState.Idle
    }
}
