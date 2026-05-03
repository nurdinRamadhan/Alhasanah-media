package com.alhasanah.alhasanahmedia.ui.santri

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.SantriModel
import com.alhasanah.alhasanahmedia.data.repository.AuthRepository
import com.alhasanah.alhasanahmedia.data.repository.WaliSantriRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

// This state is for the UI to know what to display (loading, error, or the list)
sealed interface SantriListUiState {
    object Loading : SantriListUiState
    data class Success(val santriList: List<SantriModel>) : SantriListUiState
    data class Error(val message: String) : SantriListUiState
}

// This state is for the navigation logic
sealed interface SantriNavigationState {
    object Idle : SantriNavigationState
    data class GoToDetail(val santriId: String) : SantriNavigationState
    object ShowList : SantriNavigationState
}

class SantriListViewModel(
    private val authRepository: AuthRepository,
    private val waliSantriRepository: WaliSantriRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SantriListUiState>(SantriListUiState.Loading)
    val uiState: StateFlow<SantriListUiState> = _uiState

    private val _navigationState = MutableStateFlow<SantriNavigationState>(SantriNavigationState.Idle)
    val navigationState: StateFlow<SantriNavigationState> = _navigationState

    init {
        loadSantriAndDecideNavigation()
    }

    private fun loadSantriAndDecideNavigation() {
        viewModelScope.launch {
            _uiState.value = SantriListUiState.Loading
            val waliId = authRepository.getCurrentUser().firstOrNull()?.id
            if (waliId == null) {
                _uiState.value = SantriListUiState.Error("Wali tidak ditemukan. Silakan login kembali.")
                return@launch
            }

            try {
                val santriList = waliSantriRepository.getSantriForWali(waliId)
                _uiState.value = SantriListUiState.Success(santriList)

                // Navigation Logic
                if (santriList.size == 1) {
                    _navigationState.value = SantriNavigationState.GoToDetail(santriList.first().id)
                } else {
                    _navigationState.value = SantriNavigationState.ShowList
                }

            } catch (e: Exception) {
                _uiState.value = SantriListUiState.Error(e.localizedMessage ?: "Gagal memuat data santri.")
            }
        }
    }
}
