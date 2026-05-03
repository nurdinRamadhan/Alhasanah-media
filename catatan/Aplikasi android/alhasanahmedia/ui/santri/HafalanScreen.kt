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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.* 
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.alhasanah.alhasanahmedia.data.model.HafalanTahfidz
import com.alhasanah.alhasanahmedia.util.CyberDark
import com.alhasanah.alhasanahmedia.util.FuturisticTeal
import com.alhasanah.alhasanahmedia.util.GlassWhite
import com.alhasanah.alhasanahmedia.util.GoldGlow
import com.alhasanah.alhasanahmedia.util.IslamicEmerald
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HafalanScreen(
    navController: NavController,
    viewModel: SantriActivityViewModel,
    santriNis: String
) {
    val hafalanList by viewModel.hafalanState.collectAsState()
    val santri by viewModel.santriState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
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
                        "PROGRES TAHFIDZ", 
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
            HafalanBackground(isDark)

            if (isLoading && hafalanList.isEmpty()) {
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
                        HafalanProgressGauge(santri?.totalHafalan ?: "0 Juz")
                    }

                    item {
                        HafalanSummaryOrb(hafalanList.firstOrNull(), isDark)
                    }

                    item {
                        Text(
                            "RIWAYAT SETORAN",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MaterialTheme.colorScheme.primary,
                                letterSpacing = 2.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                        )
                    }

                    items(hafalanList) { hafalan ->
                        HafalanCyberCard(hafalan = hafalan, isDark = isDark)
                    }
                    
                    item { Spacer(modifier = Modifier.height(32.dp)) }
                }
            }
        }
    }
}

@Composable
fun HafalanProgressGauge(totalHafalan: String) {
    val juzValue = totalHafalan.filter { it.isDigit() }.toFloatOrNull() ?: 0f
    val progress = (juzValue / 30f).coerceIn(0f, 1f)
    
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(2000, easing = FastOutSlowInEasing), label = "progress"
    )

    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(180.dp)) {
            // Background Arc
            drawArc(
                color = onSurfaceColor.copy(alpha = 0.1f),
                startAngle = 140f,
                sweepAngle = 260f,
                useCenter = false,
                style = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
            )
            
            // Progress Arc
            drawArc(
                brush = Brush.horizontalGradient(listOf(primaryColor, secondaryColor)),
                startAngle = 140f,
                sweepAngle = 260f * animatedProgress,
                useCenter = false,
                style = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
            )

            // Ticks
            val radius = size.minDimension / 2
            for (i in 0..30) {
                val angle = 140f + (260f * (i / 30f))
                val angleRad = angle * (PI / 180f)
                val start = Offset(
                    (radius - 20.dp.toPx()) * cos(angleRad).toFloat() + center.x,
                    (radius - 20.dp.toPx()) * sin(angleRad).toFloat() + center.y
                )
                val end = Offset(
                    (radius - 30.dp.toPx()) * cos(angleRad).toFloat() + center.x,
                    (radius - 30.dp.toPx()) * sin(angleRad).toFloat() + center.y
                )
                drawLine(
                    color = if (i / 30f <= animatedProgress) secondaryColor else onSurfaceColor.copy(alpha = 0.1f),
                    start = start,
                    end = end,
                    strokeWidth = 2.dp.toPx()
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = totalHafalan,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Black,
                    color = onSurfaceColor
                )
            )
            Text(
                text = "TOTAL HAFALAN",
                style = MaterialTheme.typography.labelSmall.copy(
                    letterSpacing = 2.sp,
                    color = primaryColor
                )
            )
        }
    }
}

@Composable
fun HafalanBackground(isDark: Boolean) {
    val color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val step = 100.dp.toPx()
        for (i in 0..10) {
            drawLine(
                color = color,
                start = Offset(i * step, 0f),
                end = Offset(i * step, size.height),
                strokeWidth = 1.dp.toPx()
            )
            drawLine(
                color = color,
                start = Offset(0f, i * step),
                end = Offset(size.width, i * step),
                strokeWidth = 1.dp.toPx()
            )
        }
    }
}

@Composable
fun HafalanSummaryOrb(lastHafalan: HafalanTahfidz?, isDark: Boolean) {
    val accentColor = when (lastHafalan?.predikat) {
        "Mumtaz" -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.primary
    }
    
    val containerColor = if (isDark) Color.White.copy(alpha = 0.05f) else Color.White
    val borderColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(containerColor)
            .border(
                1.dp, 
                borderColor, 
                RoundedCornerShape(24.dp)
            )
            .padding(20.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center) {
                // Pulse Animation Background
                val infiniteTransition = rememberInfiniteTransition(label = "pulse")
                val scale by infiniteTransition.animateFloat(
                    initialValue = 1f,
                    targetValue = 1.15f,
                    animationSpec = infiniteRepeatable(tween(2000), RepeatMode.Reverse), label = "scale"
                )
                
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .blur(15.dp)
                        .background(accentColor.copy(alpha = 0.2f * scale), CircleShape)
                )
                
                Icon(
                    Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(40.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(24.dp))
            
            Column {
                Text(
                    "CAPAIAN TERAKHIR",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        letterSpacing = 1.sp
                    )
                )
                Text(
                    lastHafalan?.surat ?: "Belum Ada Data",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
                Text(
                    "Ayat ${lastHafalan?.ayat_awal ?: 0} - ${lastHafalan?.ayat_akhir ?: 0}",
                    style = MaterialTheme.typography.bodyMedium.copy(color = accentColor, fontWeight = FontWeight.Bold)
                )
            }
        }
    }
}

@Composable
fun HafalanCyberCard(hafalan: HafalanTahfidz, isDark: Boolean) {
    val accentColor = when (hafalan.predikat) {
        "Mumtaz" -> MaterialTheme.colorScheme.secondary
        "Jayyid" -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
    }
    
    val containerColor = if (isDark) Color.White.copy(alpha = 0.05f) else Color.White
    val borderColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(
            containerColor = containerColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isDark) 0.dp else 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = (hafalan.surat ?: "Tanpa Nama").uppercase(),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface,
                            letterSpacing = 0.5.sp
                        )
                    )
                    Text(
                        text = "Setoran: ${hafalan.tanggal ?: "-"}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    )
                }
                
                Surface(
                    color = accentColor.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(4.dp),
                    modifier = Modifier.border(1.dp, accentColor.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                ) {
                    Text(
                        text = hafalan.predikat?.uppercase() ?: "-",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = accentColor, 
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Segmented Progress Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val segments = 15
                repeat(segments) { index ->
                    val isActive = index < (segments * 0.75f) 
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(6.dp)
                            .clip(CircleShape)
                            .background(
                                if (isActive) accentColor else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                            )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Juz ${hafalan.juz ?: "-"}",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = accentColor,
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = "${(hafalan.ayat_akhir ?: 0) - (hafalan.ayat_awal ?: 0) + 1} Ayat Tercatat",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                )
            }
        }
    }
}
