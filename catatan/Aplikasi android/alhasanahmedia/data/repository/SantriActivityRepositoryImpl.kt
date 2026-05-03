package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.HafalanTahfidz
import com.alhasanah.alhasanahmedia.data.model.HafalanKitab
import com.alhasanah.alhasanahmedia.data.model.KesehatanSantri
import com.alhasanah.alhasanahmedia.data.model.PelanggaranSantri
import com.alhasanah.alhasanahmedia.data.model.PerizinanSantri
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class SantriActivityRepositoryImpl(private val postgrest: Postgrest) : SantriActivityRepository {
    override fun getHafalan(nis: String): Flow<List<HafalanTahfidz>> = flow {
        val result = postgrest.from("hafalan_tahfidz").select {
            filter {
                eq("santri_nis", nis)
            }
        }.decodeAs<List<HafalanTahfidz>>()
        emit(result)
    }

    override fun getPelanggaran(nis: String): Flow<List<PelanggaranSantri>> = flow {
        val result = postgrest.from("pelanggaran_santri").select {
            filter {
                eq("santri_nis", nis)
            }
        }.decodeAs<List<PelanggaranSantri>>()
        emit(result)
    }

    override fun getPerizinan(nis: String): Flow<List<PerizinanSantri>> = flow {
        val result = postgrest.from("perizinan_santri").select {
            filter {
                eq("santri_nis", nis)
            }
        }.decodeAs<List<PerizinanSantri>>()
        emit(result)
    }

    override fun getKesehatan(nis: String): Flow<List<KesehatanSantri>> = flow {
        val result = postgrest.from("kesehatan_santri").select {
            filter {
                eq("santri_nis", nis)
            }
        }.decodeAs<List<KesehatanSantri>>()
        emit(result)
    }

    override fun getHafalanKitab(nis: String): Flow<List<HafalanKitab>> = flow {
        val result = postgrest.from("hafalan_kitab").select {
            filter {
                eq("santri_nis", nis)
            }
            order("tanggal", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        }.decodeAs<List<HafalanKitab>>()
        emit(result)
    }
}
