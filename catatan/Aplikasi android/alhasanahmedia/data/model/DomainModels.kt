package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.Serializable

@Serializable
data class HafalanTahfidz(
    val id: Long,
    val santri_nis: String? = null,
    val tanggal: String? = null,
    val surat: String? = null,
    val ayat_awal: Int? = null,
    val ayat_akhir: Int? = null,
    val status: String? = null,
    val catatan: String? = null,
    val dicatat_oleh_id: String? = null,
    val total_hafalan: Int? = null,
    val hafalan_kitab: String? = null,
    val juz: Int? = null,
    val predikat: String? = null
)

@Serializable
data class PelanggaranSantri(
    val id: Long,
    val santri_nis: String? = null,
    val tanggal: String? = null,
    val jenis_pelanggaran: String? = null,
    val poin: Int? = null,
    val hukuman: String? = null,
    val catatan: String? = null,
    val dicatat_oleh_id: String? = null
)

@Serializable
data class PerizinanSantri(
    val id: Long,
    val santri_nis: String? = null,
    val tanggal: String? = null,
    val tanggal_kembali: String? = null,
    val jenis_izin: String? = null,
    val keterangan: String? = null,
    val status: String? = null,
    val dicatat_oleh_id: String? = null
)

@Serializable
data class KesehatanSantri(
    val id: Long,
    val santri_nis: String? = null,
    val tanggal: String? = null,
    val keluhan: String? = null,
    val tindakan: String? = null,
    val catatan: String? = null,
    val dicatat_oleh_id: String? = null
)

@Serializable
data class HafalanKitab(
    val id: Long,
    val santri_nis: String,
    val tanggal: String,
    val nama_kitab: String,
    val bab_materi: String? = null,
    val bait_awal: Int? = null,
    val bait_akhir: Int? = null,
    val halaman_awal: Int? = null,
    val halaman_akhir: Int? = null,
    val predikat: String? = null,
    val status: String? = null,
    val catatan: String? = null
)
