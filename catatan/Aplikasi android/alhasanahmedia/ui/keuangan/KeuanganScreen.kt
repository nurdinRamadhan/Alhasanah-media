package com.alhasanah.alhasanahmedia.ui.keuangan

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alhasanah.alhasanahmedia.data.model.TagihanStatus
import com.alhasanah.alhasanahmedia.data.model.TagihanWithDetail
import com.alhasanah.alhasanahmedia.util.CyberDark
import com.alhasanah.alhasanahmedia.util.GlassWhite
import com.alhasanah.alhasanahmedia.util.formatDate
import com.alhasanah.alhasanahmedia.util.formatRupiah
import com.midtrans.sdk.uikit.api.model.TransactionResult
import com.midtrans.sdk.uikit.external.UiKitApi
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

// Finance Futuristic Palette - Removed as they are now in ColorPalette.kt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeuanganScreen(
    santriNis: String,
    viewModel: KeuanganViewModel = koinViewModel { parametersOf(santriNis) }
) {
    val tagihanState by viewModel.tagihanState.collectAsState()
    val santriInfoState by viewModel.santriInfoState.collectAsState()
    val context = LocalContext.current
    var showDetailSheet by remember { mutableStateOf<TagihanWithDetail?>(null) }
    var showSuccessDialog by remember { mutableStateOf(false) }

    val midtransLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        // Selalu refresh data untuk sinkronisasi dengan database terbaru
        viewModel.refreshData()

        if (result.resultCode == Activity.RESULT_OK) {
            val transactionResult = result.data?.getParcelableExtra<TransactionResult>("KEY_TRANSACTION_RESULT")
            when (transactionResult?.status) {
                "success" -> {
                    showSuccessDialog = true
                }
                "pending" -> {
                    Toast.makeText(context, "Pembayaran sedang diproses.", Toast.LENGTH_SHORT).show()
                }
                "failed" -> {
                    val errorMessage = transactionResult.message ?: "Pembayaran gagal."
                    Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        launch {
            viewModel.launchMidtrans.collect { snapToken ->
                UiKitApi.getDefaultInstance().startPaymentUiFlow(
                    context as Activity,
                    midtransLauncher,
                    snapToken
                )
            }
        }
        launch {
            viewModel.paymentSuccessEvent.collect {
                showSuccessDialog = true
            }
        }
    }

    if (showSuccessDialog) {
        SuccessPaymentDialog { showSuccessDialog = false }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Text(
                        "MANAJEMEN KEUANGAN", 
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    ) 
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            FinanceBackgroundPattern()
            
            Column(modifier = Modifier.fillMaxSize()) {
                when (val state = santriInfoState) {
                    is SantriInfoState.Success -> HolographicSantriCard(state.santriInfo)
                    is SantriInfoState.Loading -> LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.primary)
                    is SantriInfoState.Error -> Text(state.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    "TAGIHAN AKTIF",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.primary,
                        letterSpacing = 2.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )

                when (val state = tagihanState) {
                    is TagihanUiState.Success -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(state.tagihan) { tagihan ->
                                GlassTagihanItem(tagihan = tagihan) {
                                    showDetailSheet = tagihan
                                }
                            }
                            item { Spacer(modifier = Modifier.height(32.dp)) }
                        }
                    }
                    is TagihanUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }
                    is TagihanUiState.Error -> Text(state.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
                }
            }
        }
    }

    if (showDetailSheet != null) {
        ModalBottomSheet(
            onDismissRequest = { showDetailSheet = null },
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            TagihanDetailSheet(tagihan = showDetailSheet!!) {
                viewModel.bayarTagihan(it)
            }
        }
    }
}

@Composable
fun FinanceBackgroundPattern() {
    val color = MaterialTheme.colorScheme.outline.copy(alpha = 0.05f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val step = 80.dp.toPx()
        for (i in 0..15) {
            drawLine(color, Offset(i * step, 0f), Offset(i * step, size.height), 0.5.dp.toPx())
            drawLine(color, Offset(0f, i * step), Offset(size.width, i * step), 0.5.dp.toPx())
        }
    }
}

@Composable
fun HolographicSantriCard(santriInfo: SantriInfo) {
    val infiniteTransition = rememberInfiniteTransition(label = "holo")
    val xOffset by infiniteTransition.animateFloat(
        initialValue = -100f,
        targetValue = 600f,
        animationSpec = infiniteRepeatable(tween(3000, easing = LinearEasing), RepeatMode.Restart), label = "shimmer"
    )

    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .height(180.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(primaryColor, secondaryColor, primaryColor)
                )
            )
            .drawBehind {
                drawRect(
                    brush = Brush.linearGradient(
                        colors = listOf(Color.Transparent, Color.White.copy(alpha = 0.2f), Color.Transparent),
                        start = Offset(xOffset, 0f),
                        end = Offset(xOffset + 150f, size.height)
                    )
                )
            }
            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(20.dp))
            .padding(20.dp)
    ) {
        Column {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("DIGITAL SANTRI ID", color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Black), letterSpacing = 2.sp)
                Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color.White.copy(alpha = 0.5f))
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(santriInfo.nama.uppercase(), color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
            Text("NIS: ${santriInfo.nis}", color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp))
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(8.dp).background(Color.White, CircleShape))
                Spacer(modifier = Modifier.width(8.dp))
                Text("STATUS: AKTIF", color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
            }
        }
    }
}

@Composable
fun GlassTagihanItem(tagihan: TagihanWithDetail, onClick: () -> Unit) {
    val isLunas = tagihan.status == TagihanStatus.LUNAS
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            // Icon Background
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)
                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isLunas) Icons.Default.CheckCircle else Icons.Default.Payments,
                    contentDescription = null,
                    tint = if (isLunas) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = (tagihan.refJenisPembayaran?.namaPembayaran ?: tagihan.deskripsiTagihan).uppercase(),
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        letterSpacing = 0.5.sp)
                )
                Text(
                    text = "Tempo: ${formatDate(tagihan.tanggalJatuhTempo)}",
                    style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatRupiah(tagihan.sisaTagihan),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Black,
                        color = if (isLunas) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                    )
                )
                if (isLunas) {
                    Text("TERVERIFIKASI", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp, fontWeight = FontWeight.Bold))
                } else {
                    Text("BELUM LUNAS", color = MaterialTheme.colorScheme.error.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp, fontWeight = FontWeight.Bold))
                }
            }
        }
    }
}

@Composable
fun TagihanDetailSheet(tagihan: TagihanWithDetail, onBayarClick: (TagihanWithDetail) -> Unit) {
    val isLunas = tagihan.status == TagihanStatus.LUNAS
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp)
    ) {
        Text(
            "RINCIAN PEMBAYARAN", 
            style = MaterialTheme.typography.labelMedium.copy(
                letterSpacing = 2.sp, 
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        )
        Spacer(modifier = Modifier.height(24.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                .padding(20.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DetailRowItem("Deskripsi", tagihan.deskripsiTagihan)
                DetailRowItem("Total Tagihan", formatRupiah(tagihan.nominalTagihan))
                DetailRowItem("Sisa Tagihan", formatRupiah(tagihan.sisaTagihan), isTotal = true)
                DetailRowItem("Order ID", tagihan.midtransOrderId ?: "-")
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { onBayarClick(tagihan) },
            enabled = !isLunas,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            if (isLunas) {
                Icon(Icons.Default.CheckCircle, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("TAGIHAN TELAH LUNAS", fontWeight = FontWeight.Bold)
            } else {
                Text("PROSES PEMBAYARAN", fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun DetailRowItem(label: String, value: String, isTotal: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Text(
            value, 
            color = if (isTotal) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (isTotal) FontWeight.Black else FontWeight.Bold,
            style = if (isTotal) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
fun SuccessPaymentDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pembayaran Berhasil") },
        text = { Text("Terima kasih, pembayaran Anda telah diproses oleh sistem Alhasanah Media.") },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("MENGERTI", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
        },
        icon = {
            Icon(Icons.Default.CheckCircle, contentDescription = "Success", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
        },
        containerColor = MaterialTheme.colorScheme.surface,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        textContentColor = MaterialTheme.colorScheme.onSurfaceVariant
    )
}
