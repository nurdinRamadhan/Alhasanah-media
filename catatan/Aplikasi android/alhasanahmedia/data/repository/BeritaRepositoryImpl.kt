package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.BeritaModel
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class BeritaRepositoryImpl(private val postgrest: Postgrest) : BeritaRepository {

    override fun getLatestBerita(): Flow<List<BeritaModel>> = flow {
        val result = postgrest.from("berita").select {
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(10)
        }.decodeAs<List<BeritaModel>>()
        emit(result)
    }

    override fun getBeritaBySlug(slug: String): Flow<BeritaModel?> = flow {
        val result = postgrest.from("berita").select {
            // Pindahkan kriteria pencarian ke dalam blok filter
            filter {
                eq("slug", slug)
            }
            // Limit juga bisa diatur di sini atau di luar
            limit(1)
        }.decodeSingleOrNull<BeritaModel>() // Tips: Gunakan decodeSingleOrNull jika hanya 1 data

        emit(result)
    }
}
