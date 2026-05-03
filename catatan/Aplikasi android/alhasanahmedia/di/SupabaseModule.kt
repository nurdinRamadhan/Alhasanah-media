@file:OptIn(SupabaseInternal::class)
package com.alhasanah.alhasanahmedia.di

import com.alhasanah.alhasanahmedia.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import org.koin.dsl.module
import io.github.jan.supabase.annotations.SupabaseInternal

val supabaseModule = module {
    single<SupabaseClient> {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY
        ) {

            httpEngine = CIO.create()

            httpConfig {
                install(HttpTimeout) {
                    requestTimeoutMillis = 30000
                }
            }

            // Install plugin Supabase
            install(Auth)
            install(Postgrest)
            install(Storage)
            install(Realtime)
        }
    }

    // Deklarasi eksplisit agar Koin tahu cara menyediakan plugin
    single<Auth> { get<SupabaseClient>().auth }
    single<Postgrest> { get<SupabaseClient>().postgrest }
    single<Storage> { get<SupabaseClient>().storage }
    single<Realtime> { get<SupabaseClient>().realtime }
}
