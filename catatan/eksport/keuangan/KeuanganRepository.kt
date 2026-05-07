package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.TagihanWithDetail
import com.alhasanah.alhasanahmedia.data.model.TransaksiDto
import kotlinx.coroutines.flow.Flow

interface KeuanganRepository {

    fun getTagihanByNis(nis: String): Flow<List<TagihanWithDetail>>

    suspend fun createTransaksiKeuangan(transaksi: TransaksiDto)
}
