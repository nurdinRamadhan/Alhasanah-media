package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.SantriModel

interface WaliSantriRepository {
    suspend fun getSantriForWali(waliId: String): List<SantriModel>
    suspend fun getSantriByNis(nis: String): SantriModel
}
