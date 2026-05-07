package com.alhasanah.alhasanahmedia.ui.keuangan

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.temporal.ChronoUnit
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.alhasanah.alhasanahmedia.data.model.TagihanStatus
import com.alhasanah.alhasanahmedia.data.model.TagihanWithDetail
import com.alhasanah.alhasanahmedia.util.formatDate
import com.alhasanah.alhasanahmedia.util.formatRupiah
import com.midtrans.sdk.uikit.api.model.TransactionResult
import com.midtrans.sdk.uikit.external.UiKitApi
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf
import java.text.SimpleDateFormat
import java.util.*

// ─────────────────────────────────────────────────────────────────────────────
// Filter State
// ─────────────────────────────────────────────────────────────────────────────

enum class TagihanFilter(val label: String) {
    SEMUA("Semua"),
    BELUM_LUNAS("Belum Lunas"),
    LUNAS("Lunas")
}

// ─────────────────────────────────────────────────────────────────────────────
// KeuanganScreen — Root
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeuanganScreen(
    santriNis: String,
    viewModel: KeuanganViewModel = koinViewModel { parametersOf(santriNis) }
) {
    val tagihanState     by viewModel.tagihanState.collectAsState()
    val santriInfoState  by viewModel.santriInfoState.collectAsState()
    val context          = LocalContext.current
    var showDetailSheet  by remember { mutableStateOf<TagihanWithDetail?>(null) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    var activeFilter     by remember { mutableStateOf(TagihanFilter.SEMUA) }

    val midtransLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        viewModel.refreshData()
        if (result.resultCode == Activity.RESULT_OK) {
            val tx = result.data?.getParcelableExtra<TransactionResult>("KEY_TRANSACTION_RESULT")
            when (tx?.status) {
                "success" -> showSuccessDialog = true
                "pending" -> Toast.makeText(context, "Pembayaran sedang diproses.", Toast.LENGTH_SHORT).show()
                "failed"  -> Toast.makeText(context, tx.message ?: "Pembayaran gagal.", Toast.LENGTH_LONG).show()
            }
        }
    }

    LaunchedEffect(Unit) {
        launch {
            viewModel.launchMidtrans.collect { snapToken ->
                UiKitApi.getDefaultInstance().startPaymentUiFlow(
                    context as Activity, midtransLauncher, snapToken
                )
            }
        }
        launch {
            viewModel.paymentSuccessEvent.collect { showSuccessDialog = true }
        }
    }

    // ── Success Dialog ──────────────────────────────────────────────────────
    if (showSuccessDialog) {
        SuccessPaymentDialog { showSuccessDialog = false }
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {

        // Subtle diagonal finance grid
        FinanceDiagonalPattern()

        LazyColumn(
            modifier             = Modifier.fillMaxSize(),
            contentPadding       = PaddingValues(bottom = 48.dp),
            verticalArrangement  = Arrangement.spacedBy(0.dp)
        ) {

            // ── 1. Finance Header (TopBar + Summary Card) ─────────────────
            item {
                FinanceHeader(
                    santriInfoState = santriInfoState,
                    tagihanState    = tagihanState
                )
            }

            // ── 2. Filter Chips ───────────────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(20.dp))
                FilterChipRow(
                    activeFilter = activeFilter,
                    onFilterChange = { activeFilter = it }
                )
                Spacer(modifier = Modifier.height(4.dp))
            }

            // ── 3. Section Label ──────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(16.dp)
                                .background(
                                    brush = Brush.verticalGradient(
                                        listOf(
                                            MaterialTheme.colorScheme.primary,
                                            MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
                                        )
                                    ),
                                    shape = RoundedCornerShape(2.dp)
                                )
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text  = "DAFTAR TAGIHAN",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight    = FontWeight.Black,
                                letterSpacing = 1.5.sp,
                                color         = MaterialTheme.colorScheme.onBackground
                            )
                        )
                    }

                    // Count badge
                    if (tagihanState is TagihanUiState.Success) {
                        val count = (tagihanState as TagihanUiState.Success)
                            .tagihan.count { it.matchesFilter(activeFilter) }
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text     = "$count item",
                                style    = MaterialTheme.typography.labelSmall.copy(
                                    color      = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold
                                ),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // ── 4. Tagihan List ───────────────────────────────────────────
            when (val state = tagihanState) {
                is TagihanUiState.Loading -> {
                    item {
                        Box(
                            modifier            = Modifier.fillMaxWidth().height(200.dp),
                            contentAlignment    = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                is TagihanUiState.Error -> {
                    item {
                        FinanceErrorState(message = state.message)
                    }
                }
                is TagihanUiState.Success -> {
                    val filtered = state.tagihan.filter { it.matchesFilter(activeFilter) }
                    if (filtered.isEmpty()) {
                        item { FinanceEmptyState(filter = activeFilter) }
                    } else {
                        items(filtered, key = { it.midtransOrderId ?: it.deskripsiTagihan }) { tagihan ->
                            AnimatedVisibility(
                                visible    = true,
                                enter      = fadeIn() + slideInVertically { it / 3 }
                            ) {
                                TagihanCard(
                                    tagihan  = tagihan,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                                    onClick  = { showDetailSheet = tagihan }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Detail Bottom Sheet ─────────────────────────────────────────────────
    showDetailSheet?.let { tagihan ->
        ModalBottomSheet(
            onDismissRequest = { showDetailSheet = null },
            containerColor   = MaterialTheme.colorScheme.surface,
            tonalElevation   = 8.dp
        ) {
            TagihanDetailSheet(
                tagihan     = tagihan,
                onBayarClick = {
                    showDetailSheet = null
                    viewModel.bayarTagihan(it)
                }
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Helper
// ─────────────────────────────────────────────────────────────────────────────

private fun TagihanWithDetail.matchesFilter(filter: TagihanFilter): Boolean = when (filter) {
    TagihanFilter.SEMUA       -> true
    TagihanFilter.LUNAS       -> status == TagihanStatus.LUNAS
    TagihanFilter.BELUM_LUNAS -> status != TagihanStatus.LUNAS
}

// ─────────────────────────────────────────────────────────────────────────────
// Urgency helper — returns true if due date is within 7 days
// ─────────────────────────────────────────────────────────────────────────────

private fun isUrgent(dueDate: java.time.LocalDate?): Boolean {
    if (dueDate == null) return false
    val now  = java.time.LocalDate.now()
    val diff = ChronoUnit.DAYS.between(now, dueDate)
    return diff in 0..7
}

private fun isOverdue(dueDate: java.time.LocalDate?): Boolean {
    if (dueDate == null) return false
    return dueDate.isBefore(java.time.LocalDate.now())
}

// ─────────────────────────────────────────────────────────────────────────────
// Background — Diagonal Finance Grid (bukan kotak biasa)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun FinanceDiagonalPattern() {
    val lineColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.04f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val step = 56.dp.toPx()
        // Diagonal lines NW→SE
        var x = -size.height
        while (x < size.width + size.height) {
            drawLine(
                color       = lineColor,
                start       = Offset(x, 0f),
                end         = Offset(x + size.height, size.height),
                strokeWidth = 0.5.dp.toPx()
            )
            x += step
        }
        // Horizontal fine lines — very subtle
        var y = 0f
        while (y < size.height) {
            drawLine(
                color       = lineColor.copy(alpha = 0.025f),
                start       = Offset(0f, y),
                end         = Offset(size.width, y),
                strokeWidth = 0.3.dp.toPx()
            )
            y += step * 2
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Finance Header — TopBar + Santri Summary Financial Card
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceHeader(
    santriInfoState: SantriInfoState,
    tagihanState: TagihanUiState
) {
    val isDark    = isSystemInDarkTheme()
    val primary   = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary

    val headerBrush = if (isDark) {
        Brush.verticalGradient(
            0.0f to primary.copy(alpha = 0.92f),
            0.7f to primary.copy(alpha = 0.65f),
            1.0f to MaterialTheme.colorScheme.background
        )
    } else {
        Brush.verticalGradient(
            0.0f to primary,
            0.75f to primary.copy(alpha = 0.88f),
            1.0f to primary.copy(alpha = 0.70f)
        )
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(headerBrush)
    ) {
        // Radial glow top-right
        Canvas(modifier = Modifier.fillMaxWidth().height(280.dp)) {
            drawCircle(
                brush  = Brush.radialGradient(
                    colors = listOf(Color.White.copy(alpha = 0.08f), Color.Transparent),
                    center = Offset(size.width * 0.85f, size.height * 0.2f),
                    radius = size.width * 0.45f
                ),
                radius = size.width * 0.45f,
                center = Offset(size.width * 0.85f, size.height * 0.2f)
            )
        }

        Column(modifier = Modifier.fillMaxWidth()) {

            // ── TopBar Row ──────────────────────────────────────────────────
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text  = "KEUANGAN SANTRI",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight    = FontWeight.Black,
                                letterSpacing = 2.sp,
                                color         = Color.White
                            )
                        )
                        Text(
                            text  = "Informasi Tagihan & Pembayaran",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color  = Color.White.copy(alpha = 0.65f),
                                fontWeight = FontWeight.Normal
                            )
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent
                )
            )

            // ── Financial Summary Card ──────────────────────────────────────
            when (val infoState = santriInfoState) {
                is SantriInfoState.Loading -> {
                    Box(
                        modifier         = Modifier
                            .fillMaxWidth()
                            .height(210.dp)
                            .padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                    }
                }
                is SantriInfoState.Error -> {
                    Text(
                        text     = infoState.message,
                        color    = Color.White.copy(alpha = 0.7f),
                        style    = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(16.dp)
                    )
                }
                is SantriInfoState.Success -> {
                    FinancialSummaryCard(
                        santriInfo   = infoState.santriInfo,
                        tagihanState = tagihanState
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Summary Card — Replaces HolographicSantriCard
// Shows: Nama, NIS, Total Tagihan, Total Terbayar, Sisa, Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun FinancialSummaryCard(
    santriInfo: SantriInfo,
    tagihanState: TagihanUiState
) {
    // Shimmer animation
    val shimmerTrans = rememberInfiniteTransition(label = "shimmer")
    val shimmerX by shimmerTrans.animateFloat(
        initialValue  = -400f,
        targetValue   = 800f,
        animationSpec = infiniteRepeatable(
            animation  = tween(2400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerX"
    )

    // Compute financial aggregates from tagihan
    val (totalTagihan, totalTerbayar, sisaTotal) = remember(tagihanState) {
        if (tagihanState is TagihanUiState.Success) {
            val total    = tagihanState.tagihan.sumOf { it.nominalTagihan ?: 0L }
            val sisa     = tagihanState.tagihan
                .filter { it.status != TagihanStatus.LUNAS }
                .sumOf { it.sisaTagihan ?: 0L }
            val terbayar = total - sisa
            Triple(total, terbayar, sisa)
        } else Triple(0L, 0L, 0L)
    }

    val progressFraction = if (totalTagihan > 0) {
        (totalTerbayar.toFloat() / totalTagihan.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val animatedProgress by animateFloatAsState(
        targetValue   = progressFraction,
        animationSpec = tween(1000, easing = FastOutSlowInEasing),
        label         = "progressAnim"
    )

    val primary   = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White.copy(alpha = 0.11f))
            .drawBehind {
                // Shimmer sweep
                drawRect(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.White.copy(alpha = 0.10f),
                            Color.Transparent
                        ),
                        start = Offset(shimmerX, 0f),
                        end   = Offset(shimmerX + 200f, size.height)
                    )
                )
            }
            .border(
                width = 1.dp,
                brush = Brush.linearGradient(
                    colors = listOf(
                        Color.White.copy(alpha = 0.40f),
                        Color.White.copy(alpha = 0.05f),
                        Color.White.copy(alpha = 0.25f)
                    )
                ),
                shape = RoundedCornerShape(20.dp)
            )
            .padding(20.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {

            // ── Row 1: Identity ─────────────────────────────────────────────
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.Top
            ) {
                Column {
                    Text(
                        text  = "DIGITAL SANTRI ID",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color         = Color.White.copy(alpha = 0.60f),
                            fontWeight    = FontWeight.Black,
                            letterSpacing = 1.8.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text     = santriInfo.nama.uppercase(),
                        style    = MaterialTheme.typography.titleLarge.copy(
                            fontWeight    = FontWeight.Black,
                            color         = Color.White,
                            letterSpacing = 0.5.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector  = Icons.Outlined.Badge,
                            contentDescription = null,
                            tint         = Color.White.copy(alpha = 0.55f),
                            modifier     = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text  = "NIS: ${santriInfo.nis}",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color      = Color.White.copy(alpha = 0.70f),
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        )
                    }
                }

                // Status chip
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color.White.copy(alpha = 0.15f)
                ) {
                    Row(
                        modifier          = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(secondary, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text  = "AKTIF",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color      = Color.White,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            Box(modifier = Modifier.fillMaxWidth().height(0.5.dp).background(Color.White.copy(alpha = 0.18f)))
            Spacer(modifier = Modifier.height(20.dp))

            // ── Row 2: 3-Column Financial Summary ──────────────────────────
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                FinanceSummaryMetric(
                    label  = "TOTAL TAGIHAN",
                    value  = if (totalTagihan > 0) formatRupiah(totalTagihan) else "—",
                    icon   = Icons.Outlined.Receipt,
                    accent = Color.White.copy(alpha = 0.80f)
                )
                // Vertical divider
                Box(modifier = Modifier.width(0.5.dp).height(52.dp).background(Color.White.copy(alpha = 0.18f)))
                FinanceSummaryMetric(
                    label  = "TERBAYAR",
                    value  = if (totalTerbayar > 0) formatRupiah(totalTerbayar) else "—",
                    icon   = Icons.Outlined.CheckCircle,
                    accent = secondary
                )
                Box(modifier = Modifier.width(0.5.dp).height(52.dp).background(Color.White.copy(alpha = 0.18f)))
                FinanceSummaryMetric(
                    label  = "SISA TAGIHAN",
                    value  = if (sisaTotal > 0) formatRupiah(sisaTotal) else "Lunas ✓",
                    icon   = Icons.Outlined.PendingActions,
                    accent = if (sisaTotal > 0) Color(0xFFFF8A80) else secondary
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ── Row 3: Payment Progress Bar ─────────────────────────────────
            Column {
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text  = "Progres Pembayaran",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color  = Color.White.copy(alpha = 0.60f),
                            fontWeight = FontWeight.Normal
                        )
                    )
                    Text(
                        text  = "${(progressFraction * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color      = Color.White,
                            fontWeight = FontWeight.Black
                        )
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                // Track
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.18f))
                ) {
                    // Fill
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(animatedProgress)
                            .fillMaxHeight()
                            .clip(CircleShape)
                            .background(
                                brush = Brush.horizontalGradient(
                                    colors = listOf(secondary, primary.copy(green = 0.9f))
                                )
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun FinanceSummaryMetric(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            imageVector  = icon,
            contentDescription = null,
            tint         = accent,
            modifier     = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text      = value,
            style     = MaterialTheme.typography.labelMedium.copy(
                fontWeight    = FontWeight.Black,
                color         = Color.White,
                letterSpacing = 0.sp
            ),
            textAlign = TextAlign.Center,
            maxLines  = 1,
            overflow  = TextOverflow.Ellipsis
        )
        Text(
            text      = label,
            style     = MaterialTheme.typography.labelSmall.copy(
                color         = Color.White.copy(alpha = 0.55f),
                fontWeight    = FontWeight.Normal,
                letterSpacing = 0.5.sp,
                fontSize      = 8.sp
            ),
            textAlign = TextAlign.Center
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Chip Row
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun FilterChipRow(
    activeFilter: TagihanFilter,
    onFilterChange: (TagihanFilter) -> Unit
) {
    LazyRow(
        contentPadding       = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(TagihanFilter.values()) { filter ->
            val isActive = filter == activeFilter
            val primary  = MaterialTheme.colorScheme.primary

            Surface(
                shape  = CircleShape,
                color  = if (isActive) primary else MaterialTheme.colorScheme.surface,
                border = if (!isActive) BorderStroke(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                ) else null,
                shadowElevation = if (isActive) 4.dp else 0.dp,
                modifier        = Modifier.clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication        = null
                ) { onFilterChange(filter) }
            ) {
                Row(
                    modifier          = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isActive) {
                        Icon(
                            imageVector  = Icons.Default.Check,
                            contentDescription = null,
                            tint         = MaterialTheme.colorScheme.onPrimary,
                            modifier     = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                    }
                    Text(
                        text  = filter.label,
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            color      = if (isActive) MaterialTheme.colorScheme.onPrimary
                                         else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TagihanCard — Premium with Urgency Indicator & Press Animation
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun TagihanCard(
    tagihan: TagihanWithDetail,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val isLunas   = tagihan.status == TagihanStatus.LUNAS
    val overdue   = !isLunas && isOverdue(tagihan.tanggalJatuhTempo)
    val urgent    = !isLunas && !overdue && isUrgent(tagihan.tanggalJatuhTempo)
    val terbayar  = (tagihan.nominalTagihan ?: 0L) - (tagihan.sisaTagihan ?: 0L)

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val pressScale by animateFloatAsState(
        targetValue   = if (isPressed) 0.975f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh),
        label         = "cardScale"
    )

    val primary = MaterialTheme.colorScheme.primary
    val error   = MaterialTheme.colorScheme.error

    // Left accent color
    val accentColor = when {
        isLunas  -> primary
        overdue  -> error
        urgent   -> Color(0xFFF9A825)     // amber warning
        else     -> MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
    }

    Card(
        modifier  = modifier
            .fillMaxWidth()
            .scale(pressScale)
            .clickable(
                interactionSource = interactionSource,
                indication        = null,
                onClick           = onClick
            ),
        colors    = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        shape     = RoundedCornerShape(16.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {

            // Left urgency accent bar
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(
                        brush = Brush.verticalGradient(
                            listOf(accentColor, accentColor.copy(alpha = 0.35f))
                        ),
                        shape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp)
                    )
            )

            Column(modifier = Modifier.weight(1f).padding(16.dp)) {

                // ── Top row: Icon + Name + Status Chip ─────────────────────
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier          = Modifier.weight(1f)
                    ) {
                        // Icon orb
                        Box(
                            modifier         = Modifier
                                .size(42.dp)
                                .background(
                                    brush = Brush.radialGradient(
                                        listOf(accentColor.copy(alpha = 0.18f), Color.Transparent)
                                    ),
                                    shape = CircleShape
                                )
                                .border(
                                    width = 0.5.dp,
                                    color = accentColor.copy(alpha = 0.30f),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector  = when {
                                    isLunas -> Icons.Default.CheckCircle
                                    overdue -> Icons.Default.Warning
                                    else    -> Icons.Outlined.Receipt
                                },
                                contentDescription = null,
                                tint         = accentColor,
                                modifier     = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text     = (tagihan.refJenisPembayaran?.namaPembayaran
                                    ?: tagihan.deskripsiTagihan).uppercase(),
                                style    = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight    = FontWeight.ExtraBold,
                                    letterSpacing = 0.3.sp,
                                    color         = MaterialTheme.colorScheme.onSurface
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text  = tagihan.deskripsiTagihan,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Normal
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Status badge
                    StatusBadge(isLunas = isLunas, overdue = overdue, urgent = urgent)
                }

                Spacer(modifier = Modifier.height(14.dp))
                Divider(
                    color     = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                    thickness = 0.5.dp
                )
                Spacer(modifier = Modifier.height(12.dp))

                // ── Bottom row: Financial details ───────────────────────────
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.Bottom
                ) {
                    // Left: Jatuh tempo
                    Column {
                        Text(
                            text  = "Jatuh Tempo",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color      = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize   = 9.sp,
                                fontWeight = FontWeight.Normal
                            )
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (overdue) {
                                Icon(
                                    Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint     = error,
                                    modifier = Modifier.size(10.dp)
                                )
                                Spacer(modifier = Modifier.width(3.dp))
                            }
                            Text(
                                text  = formatDate(tagihan.tanggalJatuhTempo),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color      = if (overdue) error
                                                 else if (urgent) Color(0xFFF9A825)
                                                 else MaterialTheme.colorScheme.onSurface
                                )
                            )
                        }
                        if (overdue) {
                            Text(
                                text  = "Melewati Batas",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color    = error,
                                    fontSize = 8.sp
                                )
                            )
                        } else if (urgent) {
                            Text(
                                text  = "Segera Bayar",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color    = Color(0xFFF9A825),
                                    fontSize = 8.sp
                                )
                            )
                        }
                    }

                    // Right: Nominal & sisa
                    Column(horizontalAlignment = Alignment.End) {
                        if (!isLunas && terbayar > 0) {
                            Text(
                                text  = "Dibayar: ${formatRupiah(terbayar)}",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize   = 9.sp,
                                    fontWeight = FontWeight.Normal
                                )
                            )
                        }
                        Text(
                            text  = formatRupiah(if (isLunas) tagihan.nominalTagihan else tagihan.sisaTagihan),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Black,
                                color      = if (isLunas) primary
                                             else if (overdue) error
                                             else MaterialTheme.colorScheme.onSurface
                            )
                        )
                        Text(
                            text  = if (isLunas) "Total Tagihan" else "Sisa Tagihan",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color    = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 9.sp
                            )
                        )
                    }
                }

                // ── Mini progress bar (only for partial payment) ─────────────
                if (!isLunas && terbayar > 0 && (tagihan.nominalTagihan ?: 0L) > 0) {
                    Spacer(modifier = Modifier.height(12.dp))
                    val progress = (terbayar.toFloat() / (tagihan.nominalTagihan?.toFloat() ?: 1f)).coerceIn(0f, 1f)
                    val animProgress by animateFloatAsState(
                        targetValue   = progress,
                        animationSpec = tween(800, easing = FastOutSlowInEasing),
                        label         = "itemProgress"
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(animProgress)
                                .fillMaxHeight()
                                .clip(CircleShape)
                                .background(accentColor)
                        )
                    }
                }

                // ── Tap hint ───────────────────────────────────────────────
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    Text(
                        text  = if (isLunas) "Lihat Rincian" else "Bayar Sekarang",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color      = if (isLunas) MaterialTheme.colorScheme.onSurfaceVariant
                                         else primary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize   = 10.sp
                        )
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Icon(
                        imageVector  = Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint         = if (isLunas) MaterialTheme.colorScheme.onSurfaceVariant
                                       else primary,
                        modifier     = Modifier.size(14.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(isLunas: Boolean, overdue: Boolean, urgent: Boolean) {
    val (label, bgColor, textColor) = when {
        isLunas -> Triple("LUNAS",       MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), MaterialTheme.colorScheme.primary)
        overdue -> Triple("TERLAMBAT",   MaterialTheme.colorScheme.error.copy(alpha = 0.12f),   MaterialTheme.colorScheme.error)
        urgent  -> Triple("SEGERA",      Color(0xFFF9A825).copy(alpha = 0.15f),                 Color(0xFFF9A825))
        else    -> Triple("BELUM LUNAS", MaterialTheme.colorScheme.surfaceVariant,              MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = bgColor
    ) {
        Text(
            text     = label,
            style    = MaterialTheme.typography.labelSmall.copy(
                color         = textColor,
                fontWeight    = FontWeight.Black,
                letterSpacing = 0.5.sp,
                fontSize      = 8.sp
            ),
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TagihanDetailSheet — Complete Financial Detail
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun TagihanDetailSheet(
    tagihan: TagihanWithDetail,
    onBayarClick: (TagihanWithDetail) -> Unit
) {
    val isLunas  = tagihan.status == TagihanStatus.LUNAS
    val terbayar = (tagihan.nominalTagihan ?: 0L) - (tagihan.sisaTagihan ?: 0L)
    val progress = if ((tagihan.nominalTagihan ?: 0L) > 0)
        (terbayar.toFloat() / (tagihan.nominalTagihan?.toFloat() ?: 1f)).coerceIn(0f, 1f)
    else 0f
    val animProgress by animateFloatAsState(
        targetValue   = progress,
        animationSpec = tween(1000, easing = FastOutSlowInEasing),
        label         = "sheetProgress"
    )
    val overdue = !isLunas && isOverdue(tagihan.tanggalJatuhTempo)
    val primary = MaterialTheme.colorScheme.primary
    val error   = MaterialTheme.colorScheme.error

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp)
    ) {

        // ── Sheet Handle (already provided by ModalBottomSheet) ─────────────
        // ── Header ──────────────────────────────────────────────────────────
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment     = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .height(18.dp)
                            .background(
                                brush = Brush.verticalGradient(
                                    listOf(primary, primary.copy(alpha = 0.25f))
                                ),
                                shape = RoundedCornerShape(2.dp)
                            )
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text  = "RINCIAN TAGIHAN",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight    = FontWeight.Black,
                            letterSpacing = 1.5.sp,
                            color         = MaterialTheme.colorScheme.onSurface
                        )
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text  = tagihan.refJenisPembayaran?.namaPembayaran ?: tagihan.deskripsiTagihan,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color      = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Normal
                    ),
                    modifier = Modifier.padding(start = 13.dp)
                )
            }
            StatusBadge(isLunas = isLunas, overdue = overdue, urgent = false)
        }

        Spacer(modifier = Modifier.height(20.dp))

        // ── Amount Breakdown Card ────────────────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.50f))
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f),
                    RoundedCornerShape(16.dp)
                )
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {

                // Total tagihan
                SheetDetailRow(
                    label = "Total Tagihan",
                    value = formatRupiah(tagihan.nominalTagihan),
                    icon  = Icons.Outlined.Receipt
                )

                if (terbayar > 0) {
                    SheetDetailRow(
                        label     = "Sudah Dibayar",
                        value     = formatRupiah(terbayar),
                        icon      = Icons.Outlined.CheckCircle,
                        valueColor = primary
                    )
                }

                Divider(
                    color     = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.40f),
                    thickness = 0.5.dp
                )

                // Sisa / Lunas — most prominent
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    Text(
                        text  = if (isLunas) "Status Pembayaran" else "Sisa yang Harus Dibayar",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color      = MaterialTheme.colorScheme.onSurface
                        )
                    )
                    Text(
                        text  = if (isLunas) "✓ LUNAS" else formatRupiah(tagihan.sisaTagihan),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            color      = if (isLunas) primary
                                         else if (overdue) error
                                         else MaterialTheme.colorScheme.onSurface
                        )
                    )
                }

                // Progress bar
                if ((tagihan.nominalTagihan ?: 0L) > 0) {
                    Column {
                        Row(
                            modifier              = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text  = "Progres Pembayaran",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            )
                            Text(
                                text  = "${(progress * 100).toInt()}%",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color      = primary,
                                    fontWeight = FontWeight.Black
                                )
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(animProgress)
                                    .fillMaxHeight()
                                    .clip(CircleShape)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(
                                                MaterialTheme.colorScheme.secondary,
                                                primary
                                            )
                                        )
                                    )
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // ── Info Detail Card ─────────────────────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.30f),
                    RoundedCornerShape(16.dp)
                )
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text  = "INFORMASI TAGIHAN",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color         = MaterialTheme.colorScheme.primary,
                        fontWeight    = FontWeight.Black,
                        letterSpacing = 1.2.sp
                    )
                )
                Divider(
                    color     = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
                    thickness = 0.5.dp
                )
                SheetDetailRow(
                    label = "Deskripsi",
                    value = tagihan.deskripsiTagihan,
                    icon  = Icons.Outlined.Description
                )
                SheetDetailRow(
                    label = "Jatuh Tempo",
                    value = formatDate(tagihan.tanggalJatuhTempo),
                    icon  = Icons.Outlined.CalendarToday,
                    valueColor = if (overdue) error else MaterialTheme.colorScheme.onSurface
                )
                if (!tagihan.midtransOrderId.isNullOrBlank()) {
                    SheetDetailRow(
                        label = "Order ID",
                        value = tagihan.midtransOrderId,
                        icon  = Icons.Outlined.Tag
                    )
                }
                if (overdue) {
                    Divider(
                        color     = error.copy(alpha = 0.25f),
                        thickness = 0.5.dp
                    )
                    Row(
                        modifier          = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(error.copy(alpha = 0.08f))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint     = error,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text  = "Tagihan ini telah melewati tanggal jatuh tempo. Segera lakukan pembayaran untuk menghindari denda.",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color      = error,
                                fontWeight = FontWeight.Medium,
                                lineHeight = 16.sp
                            )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // ── CTA Button ───────────────────────────────────────────────────────
        if (isLunas) {
            // Lunas — read-only confirmation state
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(primary.copy(alpha = 0.12f), primary.copy(alpha = 0.06f))
                        )
                    )
                    .border(1.dp, primary.copy(alpha = 0.30f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint     = primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text  = "TAGIHAN INI TELAH DILUNASI",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color         = primary,
                            fontWeight    = FontWeight.Black,
                            letterSpacing = 0.5.sp
                        )
                    )
                }
            }
        } else {
            // Belum Lunas — payment button with gradient
            val interactionSource = remember { MutableInteractionSource() }
            val isPressed by interactionSource.collectIsPressedAsState()
            val pressScale by animateFloatAsState(
                targetValue   = if (isPressed) 0.97f else 1f,
                animationSpec = spring(stiffness = Spring.StiffnessHigh),
                label         = "btnScale"
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .scale(pressScale)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                primary,
                                primary.copy(green = (primary.green + 0.08f).coerceAtMost(1f))
                            )
                        )
                    )
                    .clickable(
                        interactionSource = interactionSource,
                        indication        = null
                    ) { onBayarClick(tagihan) },
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Payment,
                        contentDescription = null,
                        tint     = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text  = "PROSES PEMBAYARAN",
                        style = MaterialTheme.typography.labelLarge.copy(
                            color         = MaterialTheme.colorScheme.onPrimary,
                            fontWeight    = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text      = "Pembayaran diproses melalui Midtrans dengan enkripsi SSL.",
                style     = MaterialTheme.typography.labelSmall.copy(
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Normal,
                    fontSize   = 10.sp
                ),
                textAlign = TextAlign.Center,
                modifier  = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun SheetDetailRow(
    label: String,
    value: String,
    icon: ImageVector,
    valueColor: Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier              = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment     = Alignment.Top
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier          = Modifier.weight(0.45f)
        ) {
            Icon(
                imageVector  = icon,
                contentDescription = null,
                tint         = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier     = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text  = label,
                style = MaterialTheme.typography.bodySmall.copy(
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Normal
                )
            )
        }
        Text(
            text      = value,
            style     = MaterialTheme.typography.bodySmall.copy(
                color      = valueColor,
                fontWeight = FontWeight.Bold
            ),
            textAlign = TextAlign.End,
            modifier  = Modifier.weight(0.55f)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty & Error States
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun FinanceEmptyState(filter: TagihanFilter) {
    Column(
        modifier              = Modifier
            .fillMaxWidth()
            .padding(48.dp),
        horizontalAlignment   = Alignment.CenterHorizontally,
        verticalArrangement   = Arrangement.Center
    ) {
        Icon(
            imageVector  = if (filter == TagihanFilter.LUNAS) Icons.Default.CheckCircle
                           else Icons.Outlined.Receipt,
            contentDescription = null,
            tint         = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f),
            modifier     = Modifier.size(52.dp)
        )
        Spacer(modifier = Modifier.height(14.dp))
        Text(
            text      = if (filter == TagihanFilter.LUNAS)
                "Belum ada tagihan yang dilunasi"
            else
                "Semua tagihan telah terbayar",
            style     = MaterialTheme.typography.bodyMedium.copy(
                color      = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.SemiBold
            ),
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text      = "Tidak ada data untuk kategori \"${filter.label}\".",
            style     = MaterialTheme.typography.bodySmall.copy(
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
            ),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun FinanceErrorState(message: String) {
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.error.copy(alpha = 0.08f))
            .border(
                1.dp,
                MaterialTheme.colorScheme.error.copy(alpha = 0.25f),
                RoundedCornerShape(12.dp)
            )
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Default.ErrorOutline,
            contentDescription = null,
            tint     = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text  = message,
            style = MaterialTheme.typography.bodySmall.copy(
                color = MaterialTheme.colorScheme.error
            )
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SuccessPaymentDialog — Premium Animated
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun SuccessPaymentDialog(onDismiss: () -> Unit) {
    val primary = MaterialTheme.colorScheme.primary

    // Entry animation
    val scale by animateFloatAsState(
        targetValue   = 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness    = Spring.StiffnessMedium
        ),
        label = "dialogScale"
    )

    // Pulse ring animation
    val pulseTrans = rememberInfiniteTransition(label = "successPulse")
    val pulseAlpha by pulseTrans.animateFloat(
        initialValue  = 0.5f,
        targetValue   = 0f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label         = "pulseAlpha"
    )
    val pulseRadius by pulseTrans.animateFloat(
        initialValue  = 0.5f,
        targetValue   = 1.0f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label         = "pulseRadius"
    )

    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .scale(scale)
                .clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surface)
                .border(
                    1.dp,
                    primary.copy(alpha = 0.20f),
                    RoundedCornerShape(24.dp)
                )
        ) {
            Column(
                modifier            = Modifier.padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {

                // ── Animated Success Icon ────────────────────────────────────
                Box(
                    modifier         = Modifier.size(90.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Animated pulse ring
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        drawCircle(
                            color  = primary.copy(alpha = pulseAlpha),
                            radius = (size.minDimension / 2f) * pulseRadius,
                            style  = Stroke(width = 2.dp.toPx())
                        )
                    }
                    // Static glow
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(
                                brush = Brush.radialGradient(
                                    listOf(primary.copy(alpha = 0.15f), Color.Transparent)
                                ),
                                shape = CircleShape
                            )
                    )
                    // Icon container
                    Box(
                        modifier         = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(primary.copy(alpha = 0.15f), primary.copy(alpha = 0.07f))
                                )
                            )
                            .border(1.dp, primary.copy(alpha = 0.25f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = "Sukses",
                            tint     = primary,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text      = "Pembayaran Berhasil!",
                    style     = MaterialTheme.typography.titleLarge.copy(
                        fontWeight    = FontWeight.Black,
                        color         = MaterialTheme.colorScheme.onSurface,
                        letterSpacing = 0.5.sp
                    ),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text      = "Terima kasih. Pembayaran Anda telah berhasil diproses dan tercatat dalam sistem Al-Hasanah Media. Bukti pembayaran akan dikirimkan melalui notifikasi.",
                    style     = MaterialTheme.typography.bodySmall.copy(
                        color      = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 18.sp,
                        fontWeight = FontWeight.Normal
                    ),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Divider
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(0.5.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f))
                )

                Spacer(modifier = Modifier.height(16.dp))

                // CTA
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(primary, primary.copy(green = (primary.green + 0.07f).coerceAtMost(1f)))
                            )
                        )
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text  = "MENGERTI",
                        style = MaterialTheme.typography.labelLarge.copy(
                            color         = MaterialTheme.colorScheme.onPrimary,
                            fontWeight    = FontWeight.Black,
                            letterSpacing = 1.5.sp
                        )
                    )
                }
            }
        }
    }
}
