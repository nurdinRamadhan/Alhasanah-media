package com.alhasanah.alhasanahmedia.di

import com.alhasanah.alhasanahmedia.MainViewModel
import com.alhasanah.alhasanahmedia.ui.auth.AuthViewModel
import com.alhasanah.alhasanahmedia.ui.berita.BeritaDetailViewModel
import com.alhasanah.alhasanahmedia.ui.home.HomeViewModel
import com.alhasanah.alhasanahmedia.ui.notifikasi.NotificationViewModel
import com.alhasanah.alhasanahmedia.ui.keuangan.KeuanganViewModel
import com.alhasanah.alhasanahmedia.ui.santri.SantriActivityViewModel
import com.alhasanah.alhasanahmedia.ui.santri.SantriDetailViewModel
import com.alhasanah.alhasanahmedia.ui.santri.SantriListViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.androidx.viewmodel.dsl.viewModelOf
import org.koin.dsl.module

val viewModelModule = module {
    viewModelOf(::AuthViewModel)
    // Memperbarui MainViewModel dengan dependensi baru
    viewModelOf(::MainViewModel)
    viewModelOf(::BeritaDetailViewModel)
    viewModel { (santriNis: String) -> KeuanganViewModel(santriNis, get(), get(), get()) }
    viewModel { (santriNis: String) -> SantriDetailViewModel(santriNis, get()) }
    viewModelOf(::SantriActivityViewModel)
    viewModelOf(::HomeViewModel)
    viewModelOf(::SantriListViewModel)
    viewModelOf(::NotificationViewModel)
}
