
package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BeritaModel(
    val id: Long,
    @SerialName("created_at")
    val createdAt: String,
    val judul: String,
    val slug: String,
    val ringkasan: String? = null,
    val konten: String? = null,
    val kategori: String? = null,
    val status: String? = null,
    @SerialName("thumbnail_url")
    val thumbnailUrl: String? = null,
    @SerialName("penulis_id")
    val penulisId: String? = null,
    @SerialName("is_featured")
    val isFeatured: Boolean? = false,
    @SerialName("tanggal_publish")
    val tanggalPublish: String
)
