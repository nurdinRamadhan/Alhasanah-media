package com.alhasanah.alhasanahmedia.ui.santri

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.alhasanah.alhasanahmedia.data.model.PelanggaranSantri
import com.alhasanah.alhasanahmedia.util.CyberDark
import com.alhasanah.alhasanahmedia.util.FuturisticTeal
import com.alhasanah.alhasanahmedia.util.GlassWhite
import com.alhasanah.alhasanahmedia.util.IslamicEmerald
import com.alhasanah.alhasanahmedia.util.WarningAmber
import com.alhasanah.alhasanahmedia.util.WarningCrimson

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PelanggaranScreen(
    navController: NavController,
    viewModel: SantriActivityViewModel,
    santriNis: String
) {
    val pelanggaranList by viewModel.pelanggaranState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val totalPoin = pelanggaranList.sumOf { it.poin ?: 0 }
    val isDark = isSystemInDarkTheme()

    LaunchedEffect(key1 = santriNis) {
        viewModel.loadAllData(santriNis)
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Text(
                        "CATATAN KEDISIPLINAN", 
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.primary)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            // Background Pattern
            GeometricBackgroundPattern()

            if (isLoading && pelanggaranList.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        DisciplineSummaryHeader(totalPoin, isDark)
                    }

                    item {
                        Text(
                            "RIWAYAT PELANGGARAN",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MaterialTheme.colorScheme.primary,
                                letterSpacing = 2.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                        )
                    }

                    if (pelanggaranList.isEmpty()) {
                        item {
                            EmptyStateMessage()
                        }
                    } else {
                        items(pelanggaranList) { pelanggaran ->
                            PelanggaranNeonCard(pelanggaran = pelanggaran, isDark = isDark)
                        }
                    }
                    
                    item { Spacer(modifier = Modifier.height(32.dp)) }
                }
            }
        }
    }
}

@Composable
fun GeometricBackgroundPattern() {
    val color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val step = 80.dp.toPx()
        for (i in 0..15) {
            for (j in 0..25) {
                drawCircle(
                    color = color,
                    radius = 1.dp.toPx(),
                    center = Offset(i * step, j * step)
                )
            }
        }
    }
}

@Composable
fun DisciplineSummaryHeader(totalPoin: Int, isDark: Boolean) {
    val statusColor = when {
        totalPoin >= 50 -> WarningCrimson
        totalPoin >= 20 -> WarningAmber
        else -> MaterialTheme.colorScheme.primary
    }
    
    val containerColor = if (isDark) Color.White.copy(alpha = 0.05f) else Color.White
    val borderColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(containerColor)
            .border(1.dp, borderColor, RoundedCornerShape(24.dp))
            .padding(20.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Glow Circle for Points
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .blur(15.dp)
                        .background(statusColor.copy(alpha = 0.2f), CircleShape)
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = totalPoin.toString(),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontWeight = FontWeight.Black,
                            color = statusColor
                        )
                    )
                    Text(
                        text = "POIN",
                        style = MaterialTheme.typography.labelSmall.copy(color = statusColor.copy(alpha = 0.7f))
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(24.dp))
            
            Column {
                Text(
                    "SKOR KEDISIPLINAN",
                    style = MaterialTheme.typography.titleSmall.copy(
                        color = MaterialTheme.colorScheme.onSurface, 
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    when {
                        totalPoin >= 50 -> "Sangat Perlu Perhatian"
                        totalPoin >= 20 -> "Perlu Bimbingan"
                        else -> "Sangat Baik"
                    },
                    style = MaterialTheme.typography.bodyMedium.copy(color = statusColor)
                )
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = (totalPoin / 100f).coerceIn(0f, 1f),
                    modifier = Modifier.fillMaxWidth().height(4.dp).clip(CircleShape),
                    color = statusColor,
                    trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                )
            }
        }
    }
}

@Composable
fun PelanggaranNeonCard(pelanggaran: PelanggaranSantri, isDark: Boolean) {
    val severityColor = when {
        (pelanggaran.poin ?: 0) >= 20 -> WarningCrimson
        (pelanggaran.poin ?: 0) >= 10 -> WarningAmber
        else -> MaterialTheme.colorScheme.primary
    }
    
    val containerColor = if (isDark) Color.White.copy(alpha = 0.05f) else Color.White
    val borderColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isDark) 0.dp else 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Severity Indicator
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(severityColor.copy(alpha = 0.1f), CircleShape)
                    .border(1.dp, severityColor.copy(alpha = 0.3f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = severityColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = (pelanggaran.jenis_pelanggaran ?: "Pelanggaran").uppercase(),
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        letterSpacing = 0.5.sp
                    )
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Hukuman: ${pelanggaran.hukuman ?: "-"}",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                )
                if (!pelanggaran.catatan.isNullOrEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Info, 
                            contentDescription = null, 
                            modifier = Modifier.size(10.dp),
                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = pelanggaran.catatan,
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                            )
                        )
                    }
                }
                Text(
                    text = pelanggaran.tanggal ?: "-",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
                    )
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "+${pelanggaran.poin ?: 0}",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Black,
                        color = severityColor
                    )
                )
                Text(
                    text = "POIN",
                    style = MaterialTheme.typography.labelSmall.copy(color = severityColor.copy(alpha = 0.7f))
                )
            }
        }
    }
}

@Composable
fun EmptyStateMessage() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "TIDAK ADA RIWAYAT PELANGGARAN",
                style = MaterialTheme.typography.labelMedium.copy(
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
            )
            Text(
                "Alhamdulillah, santri menjaga kedisiplinan dengan baik.",
                style = MaterialTheme.typography.bodySmall.copy(
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                ),
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
