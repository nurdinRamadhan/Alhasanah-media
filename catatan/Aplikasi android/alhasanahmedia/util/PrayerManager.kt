package com.alhasanah.alhasanahmedia.util

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.Location
import com.batoulapps.adhan2.CalculationMethod
import com.batoulapps.adhan2.Coordinates
import com.batoulapps.adhan2.Madhab
import com.batoulapps.adhan2.Prayer
import com.batoulapps.adhan2.PrayerTimes
import com.batoulapps.adhan2.data.DateComponents
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.tasks.await
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import java.util.Locale

data class PrayerTimeInfo(
    val name: String,
    val time: String,
    val countdown: String,
    val locationName: String
)

class PrayerManager(private val context: Context) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getNextPrayer(): PrayerTimeInfo {
        return try {
            val location: Location? = fusedLocationClient.lastLocation.await()
            val lat: Double = location?.latitude ?: -7.3333
            val lon: Double = location?.longitude ?: 108.2167

            val locationName = if (location != null) {
                getCityName(location.latitude, location.longitude)
            } else {
                "Tasikmalaya, Indonesia"
            }

            val coordinates = Coordinates(lat, lon)
            val timeZone = TimeZone.of("Asia/Jakarta")
            
            // ✅ Gunakan Instant dari kotlinx.datetime (sesuai adhan2 v0.0.5 & Supabase)
            val nowInstant = Instant.fromEpochMilliseconds(System.currentTimeMillis())

            val localDate = nowInstant.toLocalDateTime(timeZone).date
            val dateComponents = DateComponents(localDate.year, localDate.monthNumber, localDate.dayOfMonth)

            val params = CalculationMethod.KARACHI.parameters.copy(madhab = Madhab.SHAFI)
            val prayerTimes = PrayerTimes(coordinates, dateComponents, params)

            val nextPrayer = prayerTimes.nextPrayer(nowInstant)
            var nextPrayerTime: Instant? = if (nextPrayer != Prayer.NONE) {
                prayerTimes.timeForPrayer(nextPrayer)
            } else {
                null
            }

            if (nextPrayer == Prayer.NONE || nextPrayerTime == null) {
                val tomorrowDate = localDate.plus(1, DateTimeUnit.DAY)
                val tomorrowComponents = DateComponents(tomorrowDate.year, tomorrowDate.monthNumber, tomorrowDate.dayOfMonth)
                
                val tomorrowPrayerTimes = PrayerTimes(coordinates, tomorrowComponents, params)
                nextPrayerTime = tomorrowPrayerTimes.fajr
                
                val diff = ((nextPrayerTime?.epochSeconds ?: 0L) - nowInstant.epochSeconds).coerceAtLeast(0L)
                return PrayerTimeInfo(
                    name = "Subuh",
                    time = formatTime(nextPrayerTime, timeZone),
                    countdown = formatCountdown(diff),
                    locationName = locationName
                )
            }

            val diff = (nextPrayerTime.epochSeconds - nowInstant.epochSeconds).coerceAtLeast(0L)

            PrayerTimeInfo(
                name = formatPrayerName(nextPrayer),
                time = formatTime(nextPrayerTime, timeZone),
                countdown = formatCountdown(diff),
                locationName = locationName
            )

        } catch (e: Exception) {
            PrayerTimeInfo("Subuh", "04:35", "00:00:00", "Tasikmalaya, Indonesia")
        }
    }

    private fun getCityName(lat: Double, lon: Double): String {
        return try {
            val geocoder = Geocoder(context, Locale.getDefault())
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(lat, lon, 1)
            if (!addresses.isNullOrEmpty()) {
                val address = addresses[0]
                val city = address.subAdminArea ?: address.locality ?: "Tasikmalaya"
                val country = address.countryName ?: "Indonesia"
                "$city, $country"
            } else {
                "Tasikmalaya, Indonesia"
            }
        } catch (e: Exception) {
            "Tasikmalaya, Indonesia"
        }
    }

    private fun formatPrayerName(prayer: Prayer): String {
        return when (prayer) {
            Prayer.FAJR    -> "Subuh"
            Prayer.SUNRISE -> "Terbit"
            Prayer.DHUHR   -> "Dzuhur"
            Prayer.ASR     -> "Ashar"
            Prayer.MAGHRIB -> "Maghrib"
            Prayer.ISHA    -> "Isya"
            else           -> prayer.name
        }
    }

    private fun formatTime(instant: Instant?, timeZone: TimeZone): String {
        if (instant == null) return "--:--"
        val localDateTime = instant.toLocalDateTime(timeZone)
        return String.format("%02d:%02d", localDateTime.hour, localDateTime.minute)
    }

    private fun formatCountdown(totalSeconds: Long): String {
        val hours   = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return String.format("%02d:%02d:%02d", hours, minutes, seconds)
    }
}
