package com.alhasanah.alhasanahmedia.ui.santri

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.HafalanTahfidz
import com.alhasanah.alhasanahmedia.data.model.HafalanKitab
import com.alhasanah.alhasanahmedia.data.model.KesehatanSantri
import com.alhasanah.alhasanahmedia.data.model.PelanggaranSantri
import com.alhasanah.alhasanahmedia.data.model.PerizinanSantri
import com.alhasanah.alhasanahmedia.data.model.SantriModel
import com.alhasanah.alhasanahmedia.data.repository.SantriActivityRepository
import com.alhasanah.alhasanahmedia.data.repository.WaliSantriRepository
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class SantriActivityViewModel(
    private val repository: SantriActivityRepository,
    private val waliRepository: WaliSantriRepository
) : ViewModel() {

    private val _santriState = MutableStateFlow<SantriModel?>(null)
    val santriState: StateFlow<SantriModel?> = _santriState.asStateFlow()

    private val _hafalanState = MutableStateFlow<List<HafalanTahfidz>>(emptyList())
    val hafalanState: StateFlow<List<HafalanTahfidz>> = _hafalanState.asStateFlow()

    private val _pelanggaranState = MutableStateFlow<List<PelanggaranSantri>>(emptyList())
    val pelanggaranState: StateFlow<List<PelanggaranSantri>> = _pelanggaranState.asStateFlow()

    private val _perizinanState = MutableStateFlow<List<PerizinanSantri>>(emptyList())
    val perizinanState: StateFlow<List<PerizinanSantri>> = _perizinanState.asStateFlow()

    private val _kesehatanState = MutableStateFlow<List<KesehatanSantri>>(emptyList())
    val kesehatanState: StateFlow<List<KesehatanSantri>> = _kesehatanState.asStateFlow()

    private val _hafalanKitabState = MutableStateFlow<List<HafalanKitab>>(emptyList())
    val hafalanKitabState: StateFlow<List<HafalanKitab>> = _hafalanKitabState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun loadAllData(nis: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                coroutineScope {
                    launch {
                        repository.getHafalan(nis)
                            .catch { /* Handle error */ }
                            .collect { _hafalanState.value = it }
                    }
                    launch {
                        repository.getPelanggaran(nis)
                            .catch { /* Handle error */ }
                            .collect { _pelanggaranState.value = it }
                    }
                    launch {
                        repository.getPerizinan(nis)
                            .catch { /* Handle error */ }
                            .collect { _perizinanState.value = it }
                    }
                    launch {
                        repository.getKesehatan(nis)
                            .catch { /* Handle error */ }
                            .collect { _kesehatanState.value = it }
                    }
                    launch {
                        repository.getHafalanKitab(nis)
                            .catch { /* Handle error */ }
                            .collect { _hafalanKitabState.value = it }
                    }
                    launch {
                        try {
                            _santriState.value = waliRepository.getSantriByNis(nis)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            } finally {
                _isLoading.value = false
            }
        }
    }
}
