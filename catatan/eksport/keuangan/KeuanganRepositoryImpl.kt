package com.alhasanah.alhasanahmedia.data.repository

import com.alhasanah.alhasanahmedia.data.model.TagihanWithDetail
import com.alhasanah.alhasanahmedia.data.model.TransaksiDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class KeuanganRepositoryImpl(private val supabaseClient: SupabaseClient) : KeuanganRepository {

    override fun getTagihanByNis(nis: String): Flow<List<TagihanWithDetail>> = flow {
        val result = supabaseClient.from("tagihan_santri")
            .select(Columns.raw("*, ref_jenis_pembayaran(nama_pembayaran, tipe)")) {
                filter {
                    eq("santri_nis", nis)
                    neq("status", "lunas")
                }
                order("tanggal_jatuh_tempo", Order.ASCENDING)
            }
            .decodeList<TagihanWithDetail>()

        emit(result)
    }

    override suspend fun createTransaksiKeuangan(transaksi: TransaksiDto) {
        supabaseClient.from("transaksi_keuangan").insert(transaksi)
    }
}
