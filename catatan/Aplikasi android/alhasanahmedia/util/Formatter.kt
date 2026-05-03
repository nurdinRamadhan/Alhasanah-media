package com.alhasanah.alhasanahmedia.util

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// Utility Functions for formatting
fun formatRupiah(amount: Long?): String {
    val localeID = Locale("in", "ID")
    val numberFormat = NumberFormat.getCurrencyInstance(localeID)
    numberFormat.maximumFractionDigits = 0
    return numberFormat.format(amount ?: 0L)
}

fun formatDate(date: LocalDate?): String {
    return date?.format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.getDefault())) ?: "-"
}

fun formatStringDate(dateString: String?): String {
    return try {
        dateString ?: return "-"
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd MMMM yyyy", Locale.getDefault())
        val date = inputFormat.parse(dateString)
        outputFormat.format(date!!)
    } catch (e: Exception) {
        dateString ?: "-"
    }
}
