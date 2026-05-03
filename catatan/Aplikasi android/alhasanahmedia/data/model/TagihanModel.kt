package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Serializable
data class TagihanSantri(
    @SerialName("id")
    val id: String = UUID.randomUUID().toString(),

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @SerialName("santri_nis")
    val santriNis: String? = null,

    @SerialName("jenis_pembayaran_id")
    val jenisPembayaranId: Long? = null,

    @SerialName("deskripsi_tagihan")
    val deskripsiTagihan: String? = null,

    @SerialName("nominal_tagihan")
    val nominalTagihan: Long? = null,

    @SerialName("sisa_tagihan")
    val sisaTagihan: Long? = null,

    @Serializable(with = LocalDateSerializer::class)
    @SerialName("tanggal_jatuh_tempo")
    val tanggalJatuhTempo: LocalDate? = null,

    @SerialName("status")
    val status: String? = null,

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("updated_at")
    val updatedAt: OffsetDateTime? = null
)
