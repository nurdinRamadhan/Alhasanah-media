package com.alhasanah.alhasanahmedia.di

import com.alhasanah.alhasanahmedia.data.repository.*
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val appModule = module {
    // Repositories
    single { PublicRepository(get()) }
    single { ThemeRepository(androidContext()) }
    single<AuthRepository> { AuthRepositoryImpl(get()) }
    single<WaliSantriRepository> { WaliSantriRepositoryImpl(get()) }
    single<KeuanganRepository> { KeuanganRepositoryImpl(get()) }
    single<SantriActivityRepository> { SantriActivityRepositoryImpl(get()) }
    single<BeritaRepository> { BeritaRepositoryImpl(get()) }
    single<NotificationRepository> { NotificationRepositoryImpl(get()) }
    single { com.alhasanah.alhasanahmedia.util.PrayerManager(androidContext()) }
}
