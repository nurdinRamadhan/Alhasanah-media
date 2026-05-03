
package com.alhasanah.alhasanahmedia.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.BeritaModel
import com.alhasanah.alhasanahmedia.data.repository.BeritaRepository
import com.alhasanah.alhasanahmedia.util.PrayerManager
import com.alhasanah.alhasanahmedia.util.PrayerTimeInfo
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class HomeViewModel(
    private val beritaRepository: BeritaRepository,
    private val prayerManager: PrayerManager
) : ViewModel() {

    private val _beritaState = MutableStateFlow<List<BeritaModel>>(emptyList())
    val beritaState: StateFlow<List<BeritaModel>> = _beritaState.asStateFlow()

    private val _isLoadingBerita = MutableStateFlow(false)
    val isLoadingBerita: StateFlow<Boolean> = _isLoadingBerita.asStateFlow()

    private val _prayerState = MutableStateFlow<PrayerTimeInfo?>(null)
    val prayerState: StateFlow<PrayerTimeInfo?> = _prayerState.asStateFlow()

    init {
        loadLatestBerita()
        startPrayerUpdates()
    }

    private fun startPrayerUpdates() {
        viewModelScope.launch {
            while (isActive) {
                _prayerState.value = prayerManager.getNextPrayer()
                delay(1000) // Update every second for countdown
            }
        }
    }

    private fun loadLatestBerita() {
        viewModelScope.launch {
            _isLoadingBerita.value = true
            beritaRepository.getLatestBerita()
                .catch { 
                    // Handle error, e.g., log it or show a message
                    _isLoadingBerita.value = false 
                }
                .collect { beritaList ->
                    _beritaState.value = beritaList
                    _isLoadingBerita.value = false
                }
        }
    }
}
