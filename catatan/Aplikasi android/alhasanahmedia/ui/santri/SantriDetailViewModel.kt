package com.alhasanah.alhasanahmedia.ui.santri

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.SantriModel
import com.alhasanah.alhasanahmedia.data.repository.WaliSantriRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface SantriDetailUiState {
    object Loading : SantriDetailUiState
    data class Success(val santri: SantriModel) : SantriDetailUiState
    data class Error(val message: String) : SantriDetailUiState
}

class SantriDetailViewModel(
    private val nis: String,
    private val waliSantriRepository: WaliSantriRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SantriDetailUiState>(SantriDetailUiState.Loading)
    val uiState: StateFlow<SantriDetailUiState> = _uiState

    init {
        getSantriDetails()
    }

    private fun getSantriDetails() {
        viewModelScope.launch {
            _uiState.value = SantriDetailUiState.Loading
            try {
                val santri = waliSantriRepository.getSantriByNis(nis)
                _uiState.value = SantriDetailUiState.Success(santri)
            } catch (e: Exception) {
                _uiState.value = SantriDetailUiState.Error(e.localizedMessage ?: "Gagal memuat detail santri.")
            }
        }
    }
}
