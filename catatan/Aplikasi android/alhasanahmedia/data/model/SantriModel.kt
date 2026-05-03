package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SantriModel(
    @SerialName("nis")
    val id: String,

    @SerialName("nama")
    val namaLengkap: String,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("kelas")
    val kelas: String? = null,

    @SerialName("jurusan")
    val jurusan: String? = null,

    @SerialName("pembimbing")
    val pembimbing: String? = null,

    @SerialName("foto_url")
    val fotoUrl: String? = null,

    @SerialName("status_spp")
    val statusSpp: String? = null,

    @SerialName("nik")
    val nik: String? = null,

    @SerialName("tempat_lahir")
    val tempatLahir: String? = null,

    @SerialName("tanggal_lahir")
    val tanggalLahir: String? = null, // Format: YYYY-MM-DD

    @SerialName("ayah")
    val namaAyah: String? = null,

    @SerialName("ibu")
    val namaIbu: String? = null,

    @SerialName("no_kontak_wali")
    val noKontakWali: String? = null,

    @SerialName("alamat_lengkap")
    val alamatLengkap: String? = null,

    @SerialName("anak_ke")
    val anakKe: String? = null,

    @SerialName("wali_id")
    val waliId: String? = null,

    @SerialName("jenis_kelamin")
    val jenisKelamin: String? = null, // Laki-laki or Perempuan

    @SerialName("hafalan_kitab")
    val hafalanKitab: String? = null,

    @SerialName("total_hafalan")
    val totalHafalan: String? = null
)
