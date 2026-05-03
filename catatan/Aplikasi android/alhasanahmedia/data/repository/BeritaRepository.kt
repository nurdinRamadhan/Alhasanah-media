package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.BeritaModel
import kotlinx.coroutines.flow.Flow

interface BeritaRepository {
    fun getLatestBerita(): Flow<List<BeritaModel>>
    fun getBeritaBySlug(slug: String): Flow<BeritaModel?> // New function
}
