package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.Serializable

@Serializable
data class SnapResponse(
    val token: String? = null,
    val error_messages: List<String>? = null,
    // Menambahkan field error generik untuk menangkap pesan error dari Edge Function
    val error: String? = null 
)
