package com.alhasanah.alhasanahmedia

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.repository.AuthRepository
import com.alhasanah.alhasanahmedia.data.repository.ThemeRepository
import com.alhasanah.alhasanahmedia.ui.auth.AuthenticationState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MainViewModel(
    private val themeRepository: ThemeRepository,
    private val authRepository: AuthRepository // Menambahkan AuthRepository sebagai dependensi
) : ViewModel() {

    val themeMode: StateFlow<Boolean?> = themeRepository.getThemeMode
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null // Start with null to indicate no preference
        )

    val authenticationState: StateFlow<AuthenticationState> = authRepository.getAuthState()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = AuthenticationState.NotAuthenticated
        )

    fun toggleTheme(isSystemDark: Boolean) {
        viewModelScope.launch {
            val currentVal = themeMode.value
            val newVal = if (currentVal != null) !currentVal else !isSystemDark
            themeRepository.setThemeMode(newVal)
        }
    }
}
