package com.alhasanah.alhasanahmedia

import android.app.Application
import com.alhasanah.alhasanahmedia.data.remote.midtrans.MidtransConfig
import com.alhasanah.alhasanahmedia.di.appModule
import com.alhasanah.alhasanahmedia.di.supabaseModule
import com.alhasanah.alhasanahmedia.di.viewModelModule
import com.google.firebase.FirebaseApp
import com.midtrans.sdk.uikit.external.UiKitApi
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class AlhasanahMediaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // 0. Inisialisasi Firebase
        FirebaseApp.initializeApp(this)

        // 1. Inisialisasi Koin
        startKoin {
            androidContext(this@AlhasanahMediaApplication)
            modules(appModule, viewModelModule, supabaseModule)
        }

        // 2. Inisialisasi Midtrans SDK setelah Koin
        initMidtransSdk()
    }

    private fun initMidtransSdk() {
        UiKitApi.Builder()
            .withContext(this)
            .withMerchantUrl(MidtransConfig.PAYMENT_BASE_URL)
            .withMerchantClientKey(MidtransConfig.CLIENT_KEY)
            .enableLog(true)
            .build()
    }
}
