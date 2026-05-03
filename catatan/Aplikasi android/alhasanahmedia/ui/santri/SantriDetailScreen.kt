package com.alhasanah.alhasanahmedia.ui.santri

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.alhasanah.alhasanahmedia.R
import com.alhasanah.alhasanahmedia.data.model.SantriModel
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SantriDetailScreen(
    santriNis: String,
    navController: NavController,
    viewModel: SantriDetailViewModel = koinViewModel { parametersOf(santriNis) }
) {
    val uiState by viewModel.uiState.collectAsState()
    val isDark = isSystemInDarkTheme()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Text(
                        "DATA SANTRI", 
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(
                            Icons.Default.ArrowBack, 
                            contentDescription = "Kembali", 
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            GeometricBackground()

            when (val state = uiState) {
                is SantriDetailUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                is SantriDetailUiState.Success -> {
                    SantriDetailContent(santri = state.santri, isDark = isDark)
                }
                is SantriDetailUiState.Error -> {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }
}

@Composable
fun GeometricBackground() {
    val color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val size = 100.dp.toPx()
        for (i in 0..10) {
            for (j in 0..20) {
                drawCircle(
                    color = color,
                    radius = 2.dp.toPx(),
                    center = Offset(i * size, j * size)
                )
            }
        }
    }
}

@Composable
fun SantriDetailContent(santri: SantriModel, isDark: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        ProfileOrb(santri)
        
        Spacer(modifier = Modifier.height(24.dp))

        // Info Sections
        GlassCard(title = "IDENTITAS DIGITAL", icon = Icons.Default.Person, isDark = isDark) {
            InfoRow(label = "NIS", value = santri.id, isDark = isDark)
            InfoRow(label = "NIK", value = santri.nik, isDark = isDark)
            InfoRow(label = "NAMA LENGKAP", value = santri.namaLengkap.uppercase(), isDark = isDark)
            InfoRow(label = "TEMPAT LAHIR", value = santri.tempatLahir, isDark = isDark)
            InfoRow(label = "TANGGAL LAHIR", value = santri.tanggalLahir, isDark = isDark)
            InfoRow(label = "JENIS KELAMIN", value = santri.jenisKelamin, isDark = isDark)
        }

        Spacer(modifier = Modifier.height(16.dp))

        GlassCard(title = "AKADEMIK & ASRAMA", icon = Icons.Default.School, isDark = isDark) {
            InfoRow(label = "KELAS", value = "${santri.kelas} - ${santri.jurusan}", isDark = isDark)
            InfoRow(label = "PEMBIMBING", value = santri.pembimbing, isDark = isDark)
        }

        Spacer(modifier = Modifier.height(16.dp))

        GlassCard(title = "HUBUNGAN WALI", icon = Icons.Default.Home, isDark = isDark) {
            InfoRow(label = "AYAH", value = santri.namaAyah, isDark = isDark)
            InfoRow(label = "IBU", value = santri.namaIbu, isDark = isDark)
            InfoRow(label = "KONTAK WALI", value = santri.noKontakWali, isDark = isDark)
            InfoRow(label = "ALAMAT", value = santri.alamatLengkap, isDark = isDark)
        }
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
fun ProfileOrb(santri: SantriModel) {
    val infiniteTransition = rememberInfiniteTransition(label = "orb")
    val glowSize by infiniteTransition.animateFloat(
        initialValue = 110f,
        targetValue = 125f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "glow"
    )

    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary

    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(glowSize.dp)
                .blur(20.dp)
                .background(primaryColor.copy(alpha = 0.2f), CircleShape)
        )
        
        Canvas(modifier = Modifier.size(115.dp)) {
            drawArc(
                brush = Brush.sweepGradient(listOf(primaryColor, secondaryColor, primaryColor)),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = 3.dp.toPx())
            )
        }

        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(santri.fotoUrl)
                .crossfade(true)
                .build(),
            placeholder = painterResource(id = R.drawable.ic_user_placeholder),
            contentDescription = "Foto Profil",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .border(2.dp, primaryColor.copy(alpha = 0.5f), CircleShape)
        )
    }
}

@Composable
fun GlassCard(title: String, icon: ImageVector, isDark: Boolean, content: @Composable ColumnScope.() -> Unit) {
    val borderColor = if (isDark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)
    val containerColor = if (isDark) Color.White.copy(alpha = 0.05f) else Color.White

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isDark) 0.dp else 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            content()
        }
    }
}

@Composable
fun InfoRow(label: String, value: String?, isDark: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        )
        
        Text(
            text = value ?: "-",
            style = MaterialTheme.typography.bodyMedium.copy(
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
        )
    }
}
