package com.alhasanah.alhasanahmedia.ui.keuangan

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alhasanah.alhasanahmedia.data.model.SnapResponse
import com.alhasanah.alhasanahmedia.data.model.TagihanDto
import com.alhasanah.alhasanahmedia.data.model.TagihanStatus
import com.alhasanah.alhasanahmedia.data.model.TagihanWithDetail
import com.alhasanah.alhasanahmedia.data.repository.AuthRepository
import com.alhasanah.alhasanahmedia.data.repository.KeuanganRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.user.UserInfo
import io.github.jan.supabase.postgrest.from
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

sealed interface TagihanUiState {
    data object Loading : TagihanUiState
    data class Success(val tagihan: List<TagihanWithDetail>) : TagihanUiState
    data class Error(val message: String) : TagihanUiState
}

sealed interface SantriInfoState {
    data object Loading : SantriInfoState

    @Serializable
    data class SantriProfileDto(
        val nis: String,
        val nama: String,
        val kelas: String,
        @SerialName("no_kontak_wali")
        val noKontakWali: String? = null
    )

    data class Success(val santriInfo: SantriInfo) : SantriInfoState
    data class Error(val message: String) : SantriInfoState
}

data class SantriInfo(
    val nis: String,
    val nama: String,
    val kelas: String,
    val noKontakWali: String? = null
)

class KeuanganViewModel(
    private val santriNis: String,
    private val keuanganRepository: KeuanganRepository,
    private val authRepository: AuthRepository,
    private val supabaseClient: SupabaseClient
) : ViewModel() {

    companion object {
        private const val EDGE_FUNCTION_URL = "https://sldobkbolvrahlnowrga.supabase.co/functions/v1/midtrans-snap"
        private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZG9ia2JvbHZyYWhsbm93cmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODkxMDIsImV4cCI6MjA4MDc2NTEwMn0.nOuh8CC8GC9pq-uSIfqAddYb1KIhNgmy0lzgfGUW8nw"
    }

    private val _tagihanState = MutableStateFlow<TagihanUiState>(TagihanUiState.Loading)
    val tagihanState: StateFlow<TagihanUiState> = _tagihanState.asStateFlow()

    private val _santriInfoState = MutableStateFlow<SantriInfoState>(SantriInfoState.Loading)
    val santriInfoState: StateFlow<SantriInfoState> = _santriInfoState.asStateFlow()

    private val _launchMidtrans = MutableSharedFlow<String>()
    val launchMidtrans: SharedFlow<String> = _launchMidtrans.asSharedFlow()

    private val _paymentSuccessEvent = MutableSharedFlow<Unit>()
    val paymentSuccessEvent: SharedFlow<Unit> = _paymentSuccessEvent.asSharedFlow()

    private val client = HttpClient(CIO) { 
        install(ContentNegotiation) {
            json(Json { 
                ignoreUnknownKeys = true 
                isLenient = true
            })
        }
    }
    private var jobMonitoring: Job? = null

    init {
        refreshData()
    }

    fun refreshData() {
        viewModelScope.launch {
            _tagihanState.value = TagihanUiState.Loading
            
            if (santriNis.isBlank()) {
                _tagihanState.value = TagihanUiState.Error("NIS tidak ditemukan untuk user ini.")
                _santriInfoState.value = SantriInfoState.Error("NIS tidak ditemukan.")
                return@launch
            }

            getSantriInfo(santriNis)
            loadTagihan(santriNis)
        }
    }
    
    private fun getSantriInfo(nis: String) {
        viewModelScope.launch {
            _santriInfoState.value = SantriInfoState.Loading
            try {
                val profile = supabaseClient.from("santri")
                    .select {
                        filter {
                            eq("nis", nis)
                        }
                    }
                    .decodeSingleOrNull<SantriInfoState.SantriProfileDto>()

                if (profile != null) {
                    _santriInfoState.value = SantriInfoState.Success(
                        SantriInfo(
                            nis = profile.nis, 
                            nama = profile.nama, 
                            kelas = profile.kelas,
                            noKontakWali = profile.noKontakWali
                        )
                    )
                } else {
                    _santriInfoState.value = SantriInfoState.Error("Profil santri tidak ditemukan di database.")
                }
            } catch (e: Exception) {
                _santriInfoState.value = SantriInfoState.Error("Gagal mengambil data santri: ${e.message}")
            }
        }
    }
    
    private fun loadTagihan(nis: String) {
        viewModelScope.launch {
            keuanganRepository.getTagihanByNis(nis)
                .catch { e -> _tagihanState.value = TagihanUiState.Error(e.message ?: "Gagal memuat tagihan") }
                .collect { tagihanList -> _tagihanState.value = TagihanUiState.Success(tagihanList) }
        }
    }
    
    fun bayarTagihan(tagihan: TagihanWithDetail) {
         viewModelScope.launch {
            _tagihanState.value = TagihanUiState.Loading
            try {
                // --- 1. LOGIKA ANTI-NULL NAME & PHONE ---
                val santriInfo = (santriInfoState.value as? SantriInfoState.Success)?.santriInfo
                val safeName = if (santriInfo?.nama.isNullOrBlank()) "Wali Santri" else santriInfo!!.nama
                val safePhone = if (santriInfo?.noKontakWali.isNullOrBlank()) "081234567890" else santriInfo!!.noKontakWali!!

                val userEmail = authRepository.getCurrentUser().firstOrNull()?.email ?: "pembayaran@santri.com"

                // --- 2. LOGIKA ORDER ID ---
                // Cukup kirim tagihan.id, karena Edge Function midtrans-snap 
                // akan menambahkan timestamp (_123456) secara otomatis.
                val uniqueOrderId = tagihan.id

                // --- 3. SUSUN BODY REQUEST ---
                val requestPayload = MidtransRequestPayload(
                    order_id = uniqueOrderId,
                    gross_amount = tagihan.sisaTagihan?.toInt() ?: 0,
                    customer_details = CustomerDetails(
                        first_name = safeName,
                        email = userEmail,
                        phone = safePhone
                    ),
                    custom_field1 = tagihan.id
                )

                Log.d("KeuanganViewModel", "Kirim Tagihan ID ke Midtrans: ${tagihan.id}")
                Log.d("KeuanganViewModel", "Order ID: $uniqueOrderId")

                // --- 4. KIRIM KE EDGE FUNCTION ---
                val response: SnapResponse = client.post(EDGE_FUNCTION_URL) {
                    contentType(ContentType.Application.Json)
                    header("Authorization", "Bearer $SUPABASE_ANON_KEY")
                    setBody(requestPayload)
                }.body()

                if (!response.token.isNullOrBlank()) {
                    _launchMidtrans.emit(response.token)
                    mulaiPantauStatus(tagihan.id)
                } else {
                    val errorMessage = response.error_messages?.joinToString() ?: response.error ?: "Gagal mendapatkan token pembayaran."
                    _tagihanState.value = TagihanUiState.Error(errorMessage)
                }

            } catch (e: Exception) {
                Log.e("KeuanganViewModel", "Error Bayar: ${e.message}", e)
                _tagihanState.value = TagihanUiState.Error("Gagal menghubungi server: ${e.message}")
            }
        }
    }

    fun mulaiPantauStatus(tagihanId: String) { 
        jobMonitoring?.cancel()
        jobMonitoring = viewModelScope.launch {
            var isLunas = false
            while (isActive && !isLunas) {
                try {
                    val result = supabaseClient.from("tagihan_santri")
                        .select {
                           filter {
                                eq("id", tagihanId)
                            }
                        }
                        .decodeSingle<TagihanDto>()
                    
                    if (result.status == TagihanStatus.LUNAS) {
                        isLunas = true
                        Log.d("PAYMENT_MONITOR", "Status LUNAS terdeteksi dari Database!")
                        _paymentSuccessEvent.emit(Unit)
                        refreshData()
                        hentikanPantauan()
                    } else {
                        Log.d("PAYMENT_MONITOR", "Status saat ini: ${result.status}. Masih menunggu pembayaran...")
                    }
                } catch (e: Exception) {
                    Log.e("PAYMENT_MONITOR", "Gagal cek status: ${e.message}")
                    hentikanPantauan()
                }
                delay(5000)
            }
        }
    }

    fun hentikanPantauan() { jobMonitoring?.cancel() }

    override fun onCleared() {
        super.onCleared()
        client.close()
        hentikanPantauan()
    }
}

@Serializable
data class MidtransRequestPayload(
    val order_id: String,
    val gross_amount: Int,
    val customer_details: CustomerDetails,
    val custom_field1: String? = null
)

@Serializable
data class CustomerDetails(
    val first_name: String,
    val email: String,
    val phone: String
)
