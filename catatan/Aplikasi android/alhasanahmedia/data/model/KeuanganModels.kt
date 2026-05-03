package com.alhasanah.alhasanahmedia.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Serializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

@Serializer(forClass = LocalDate::class)
object LocalDateSerializer : kotlinx.serialization.KSerializer<LocalDate> {
    private val formatter = DateTimeFormatter.ISO_LOCAL_DATE

    override val descriptor = kotlinx.serialization.descriptors.PrimitiveSerialDescriptor("LocalDate", kotlinx.serialization.descriptors.PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): LocalDate {
        return LocalDate.parse(decoder.decodeString(), formatter)
    }

    override fun serialize(encoder: Encoder, value: LocalDate) {
        encoder.encodeString(value.format(formatter))
    }
}

@Serializer(forClass = OffsetDateTime::class)
object OffsetDateTimeSerializer : kotlinx.serialization.KSerializer<OffsetDateTime> {
    private val formatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME

    override val descriptor = kotlinx.serialization.descriptors.PrimitiveSerialDescriptor("OffsetDateTime", kotlinx.serialization.descriptors.PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): OffsetDateTime {
        return OffsetDateTime.parse(decoder.decodeString(), formatter)
    }

    override fun serialize(encoder: Encoder, value: OffsetDateTime) {
        encoder.encodeString(value.format(formatter))
    }
}

@Serializable
enum class TagihanStatus {
    @SerialName("LUNAS")
    LUNAS,
    @SerialName("BELUM")
    BELUM,
    @SerialName("CICILAN")
    CICILAN;

    companion object {
        fun fromString(value: String?): TagihanStatus {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: BELUM
        }
    }
}

@Serializable
data class TagihanDto(
    @SerialName("id")
    val id: String,

    @SerialName("santri_nis")
    val santriNis: String,

    @SerialName("jenis_pembayaran_id")
    val jenisPembayaranId: Long? = null,

    @SerialName("deskripsi_tagihan")
    val deskripsiTagihan: String,

    @SerialName("nominal_tagihan")
    val nominalTagihan: Long? = null,

    @SerialName("sisa_tagihan")
    val sisaTagihan: Long? = null,

    @Serializable(with = LocalDateSerializer::class)
    @SerialName("tanggal_jatuh_tempo")
    val tanggalJatuhTempo: LocalDate? = null,

    @SerialName("status")
    val status: TagihanStatus = TagihanStatus.BELUM,

    @SerialName("midtrans_order_id")
    val midtransOrderId: String? = null,

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("created_at")
    val createdAt: OffsetDateTime,

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("updated_at")
    val updatedAt: OffsetDateTime? = null
)

@Serializable
data class TransaksiDto(
    @SerialName("id")
    val id: String = UUID.randomUUID().toString(),
    @SerialName("created_at")
    @Serializable(with = OffsetDateTimeSerializer::class)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
    @SerialName("wali_id")
    val waliId: String? = null,
    @SerialName("jumlah")
    val jumlah: Long? = null,
    @SerialName("tanggal_transaksi")
    @Serializable(with = OffsetDateTimeSerializer::class)
    val tanggalTransaksi: OffsetDateTime = OffsetDateTime.now(),
    @SerialName("status_transaksi")
    val statusTransaksi: String? = null,
    @SerialName("metode_pembayaran")
    val metodePembayaran: String? = null,
    @SerialName("midtrans_snap_token")
    val midtransSnapToken: String? = null,
    @SerialName("waktu_bayar_sukses")
    @Serializable(with = OffsetDateTimeSerializer::class)
    val waktuBayarSukses: OffsetDateTime? = null,
    @SerialName("status") // Midtrans internal status (pending/settlement)
    val midtransStatus: String? = null,
    @SerialName("jenis_pembayaran")
    val jenisPembayaran: String? = null,
    @SerialName("jenis_transaksi")
    val jenisTransaksi: String? = null,
    @SerialName("kategori")
    val kategori: String? = null,
    @SerialName("keterangan")
    val keterangan: String? = null,
    @SerialName("admin_pencatat_id")
    val adminPencatatId: String? = null,
    @SerialName("midtrans_order_id")
    val midtransOrderId: String? = null,
    @SerialName("santri_nis")
    val santriNis: String? = null,
    @SerialName("tagihan_id")
    val tagihanId: String? = null
)

@Serializable
data class TagihanWithDetail(
    @SerialName("id")
    val id: String,

    @SerialName("santri_nis")
    val santriNis: String,

    @SerialName("jenis_pembayaran_id")
    val jenisPembayaranId: Long? = null,

    @SerialName("deskripsi_tagihan")
    val deskripsiTagihan: String,

    @SerialName("nominal_tagihan")
    val nominalTagihan: Long? = null,

    @SerialName("sisa_tagihan")
    val sisaTagihan: Long? = null,

    @Serializable(with = LocalDateSerializer::class)
    @SerialName("tanggal_jatuh_tempo")
    val tanggalJatuhTempo: LocalDate? = null,

    @SerialName("status")
    val status: TagihanStatus = TagihanStatus.BELUM,

    @SerialName("midtrans_order_id")
    val midtransOrderId: String? = null,

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("created_at")
    val createdAt: OffsetDateTime,

    @Serializable(with = OffsetDateTimeSerializer::class)
    @SerialName("updated_at")
    val updatedAt: OffsetDateTime? = null,

    @SerialName("ref_jenis_pembayaran")
    val refJenisPembayaran: RefJenisPembayaran? = null
) {
    @Serializable
    data class RefJenisPembayaran(
        @SerialName("nama_pembayaran")
        val namaPembayaran: String,
        @SerialName("tipe")
        val tipe: String
    )
}
