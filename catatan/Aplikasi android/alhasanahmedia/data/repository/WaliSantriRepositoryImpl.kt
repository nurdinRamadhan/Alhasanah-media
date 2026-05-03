package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.SantriModel
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from

class WaliSantriRepositoryImpl(private val postgrest: Postgrest) : WaliSantriRepository {

    override suspend fun getSantriForWali(waliId: String): List<SantriModel> {
        // Mengkueri tabel 'santri' secara langsung dan memfilter berdasarkan wali_id
        return postgrest.from("santri")
            .select {
                filter {
                    eq("wali_id", waliId)
                }
            }
            .decodeList<SantriModel>() // Dekode langsung ke List<SantriModel>
    }

    override suspend fun getSantriByNis(nis: String): SantriModel {
        // Jika select kosong/default, dia akan mengambil semua kolom (*)
        return postgrest.from("santri").select {
            // Filter harus dibungkus blok filter
            filter {
                eq("nis", nis)
            }
        }.decodeSingle()
    }

    // Menghapus helper class SantriWrapper karena tidak lagi diperlukan
}
