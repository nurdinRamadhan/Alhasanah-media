package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.Berita
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.query.Order

class PublicRepository(private val postgrest: Postgrest) {

    /**
     * Fetches a list of published news articles, ordered by publishing date.
     */
    suspend fun getBeritaList(): List<Berita> {
        return postgrest.from("berita").select {
            filter {
                eq("status", "PUBLISHED")
            }
            order("tanggal_publish", Order.DESCENDING)
        }.decodeAs()
    }

    /**
     * Fetches a single news article by its slug. Returns null if not found.
     */
    suspend fun getBeritaBySlug(slug: String): Berita? {
        return postgrest.from("berita")
            .select {
                filter {
                    eq("slug", slug)
                }
                limit(1)
            }
            .decodeAs<List<Berita>>()
            .firstOrNull()
    }


    /**
     * Fetches public information about the institution.
     * This is an example of a query that does not require authentication.
     */
    suspend fun getInstansiInfo() {
        // Example: return postgrest.from("instansi_info").select().single().decodeAs<InstansiInfoModel>()
        // For now, we'll leave it as a placeholder.
    }
}
