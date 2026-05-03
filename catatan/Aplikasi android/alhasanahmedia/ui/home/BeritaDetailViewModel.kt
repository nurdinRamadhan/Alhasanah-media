package com.alhasanah.alhasanahmedia.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.BeritaModel
import com.alhasanah.alhasanahmedia.data.repository.BeritaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class BeritaDetailViewModel(private val beritaRepository: BeritaRepository) : ViewModel() {

    private val _beritaState = MutableStateFlow<BeritaModel?>(null)
    val beritaState: StateFlow<BeritaModel?> = _beritaState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun loadBerita(slug: String) {
        viewModelScope.launch {
            _isLoading.value = true
            beritaRepository.getBeritaBySlug(slug)
                .catch { 
                    _isLoading.value = false
                }
                .collect { berita ->
                    _beritaState.value = berita
                    _isLoading.value = false
                }
        }
    }
}
