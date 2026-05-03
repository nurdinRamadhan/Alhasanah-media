package com.alhasanah.alhasanahmedia.ui.berita

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.Berita
import com.alhasanah.alhasanahmedia.data.repository.PublicRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class BeritaDetailViewModel(private val publicRepository: PublicRepository) : ViewModel() {

    private val _beritaState = MutableStateFlow<Berita?>(null)
    val beritaState: StateFlow<Berita?> = _beritaState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun getBerita(slug: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val berita = publicRepository.getBeritaBySlug(slug)
                _beritaState.value = berita
            } catch (e: Exception) {
                // Handle error
            } finally {
                _isLoading.value = false
            }
        }
    }
}
