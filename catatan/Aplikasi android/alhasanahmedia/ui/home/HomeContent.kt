package com.alhasanah.alhasanahmedia.ui.home

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.alhasanah.alhasanahmedia.MainViewModel
import com.alhasanah.alhasanahmedia.R
import com.alhasanah.alhasanahmedia.navigation.Screen
import com.alhasanah.alhasanahmedia.ui.components.ThemeToggleButton
import com.alhasanah.alhasanahmedia.util.CyberDark
import com.alhasanah.alhasanahmedia.util.GlassWhite
import com.alhasanah.alhasanahmedia.util.GlassDark
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import androidx.navigation.compose.rememberNavController
import com.alhasanah.alhasanahmedia.ui.theme.AlhasanahMediaTheme
import org.koin.androidx.compose.koinViewModel

// Theme Palette (Consistent with other screens)
// Removed duplicate color definitions as they are now in ColorPalette.kt

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.alhasanah.alhasanahmedia.util.PrayerTimeInfo

@Composable
fun HomeContent(
    modifier: Modifier = Modifier,
    isLoggedIn: Boolean,
    openDrawer: () -> Unit,
    onNotificationClick: () -> Unit,
    navController: NavController
) {
    val homeViewModel: HomeViewModel = koinViewModel()
    val beritaList by homeViewModel.beritaState.collectAsState()
    val isLoadingBerita by homeViewModel.isLoadingBerita.collectAsState()
    val prayerState by homeViewModel.prayerState.collectAsState()

    val mainViewModel: MainViewModel = koinViewModel()
    val context = LocalContext.current

    Box(modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Shared Background Pattern
        HomeGeometricPattern()

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                HomeHeader(
                    mainViewModel = mainViewModel, 
                    openDrawer = openDrawer, 
                    prayerInfo = prayerState,
                    isLoggedIn = isLoggedIn,
                    onNotificationClick = { navController.navigate(Screen.Notifications.route) }
                )
            }
            item {
                BeritaSection(
                    beritaList = beritaList,
                    isLoading = isLoadingBerita,
                    onBeritaClick = { slug ->
                        navController.navigate(Screen.BeritaDetail.createRoute(slug))
                    }
                )
            }

            item {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    FeatureSection(
                        title = "FITUR & ALAT DIGITAL",
                        features = listOf(
                            FeatureItem("Al-Quran", Icons.Default.Book),
                            FeatureItem("Jadwal Sholat", Icons.Default.Schedule),
                            FeatureItem("Hisab", Icons.Default.Calculate),
                            FeatureItem("Kiblat", Icons.Default.Explore)
                        )
                    )
                    FeatureSection(
                        title = "SISTEM INFORMASI SANTRI",
                        features = listOf(
                            FeatureItem("Tahfidz", Icons.Default.Groups),
                            FeatureItem("Kitab", Icons.Default.MenuBook),
                            FeatureItem("Kegiatan", Icons.Default.Info)
                        )
                    )
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
fun HomeGeometricPattern() {
    val color = MaterialTheme.colorScheme.outline.copy(alpha = 0.05f)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val step = 120.dp.toPx()
        for (i in 0..10) {
            drawLine(color, Offset(i * step, 0f), Offset(i * step, size.height), 1.dp.toPx())
            drawLine(color, Offset(0f, i * step), Offset(size.width, i * step), 1.dp.toPx())
        }
    }
}

@Composable
private fun HomeHeader(
    mainViewModel: MainViewModel, 
    openDrawer: () -> Unit,
    prayerInfo: PrayerTimeInfo?,
    isLoggedIn: Boolean,
    onNotificationClick: () -> Unit
) {
    val themeMode by mainViewModel.themeMode.collectAsState()
    val isSystemDark = isSystemInDarkTheme()
    val useDarkTheme = themeMode ?: isSystemDark
    
    val primaryColor = MaterialTheme.colorScheme.primary
    
    val headerBrush = Brush.verticalGradient(
        colors = if (useDarkTheme) {
            listOf(primaryColor, MaterialTheme.colorScheme.background)
        } else {
            listOf(primaryColor, primaryColor.copy(alpha = 0.8f))
        }
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(headerBrush)
            .padding(top = 24.dp, bottom = 40.dp, start = 16.dp, end = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp), 
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = openDrawer) {
                Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Color.White)
            }
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (isLoggedIn) {
                    IconButton(onClick = onNotificationClick) {
                        Icon(
                            imageVector = Icons.Default.Notifications, 
                            contentDescription = "Notifikasi", 
                            tint = Color.White
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                }
                ThemeToggleButton(
                    isDark = useDarkTheme, 
                    onToggle = { mainViewModel.toggleTheme(isSystemDark) },
                    tint = Color.White
                )
            }
        }

        // Animated Glow for Logo
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .blur(20.dp)
                    .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.2f), CircleShape)
            )
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "Logo",
                modifier = Modifier.size(72.dp)
            )
        }
        
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "AL-HASANAH MEDIA",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp
            )
        )
        Text(
            text = "Pondok Pesantren Al-Hasanah".uppercase(),
            color = Color.White.copy(alpha = 0.8f),
            style = MaterialTheme.typography.labelSmall.copy(
                letterSpacing = 1.sp,
                fontWeight = FontWeight.Bold
            )
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 4.dp)
        ) {
            Icon(
                Icons.Default.LocationOn, 
                contentDescription = null, 
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = prayerInfo?.locationName ?: "Mendeteksi Lokasi...",
                color = Color.White.copy(alpha = 0.7f),
                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium)
            )
        }
        Spacer(modifier = Modifier.height(32.dp))
        NextPrayerTimeCard(prayerInfo)
    }
}

@Composable
private fun NextPrayerTimeCard(prayerInfo: PrayerTimeInfo?) {
    val nextPrayerName = prayerInfo?.name ?: "Subuh"
    val nextPrayerTime = prayerInfo?.time ?: "04:35"
    val countdown = prayerInfo?.countdown ?: "00:00:00"

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.12f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
            .padding(horizontal = 24.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "WAKTU SHOLAT BERIKUTNYA",
                style = MaterialTheme.typography.labelSmall.copy(
                    letterSpacing = 1.sp,
                    color = Color.White.copy(alpha = 0.6f)
                )
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "$nextPrayerName $nextPrayerTime",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                )
            }
            Text(
                text = "Countdown: $countdown",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = Color.White.copy(alpha = 0.8f),
                    fontWeight = FontWeight.Bold
                ),
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun FeatureSection(title: String, features: List<FeatureItem>) {
    DashboardCard(title = title) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.Top
        ) {
            features.forEach {
                FeatureIcon(it.name, it.icon)
            }
        }
    }
}

@Composable
private fun DashboardCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title, 
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.primary
                )
            )
            Spacer(modifier = Modifier.height(16.dp))
            content()
        }
    }
}

@Composable
private fun FeatureIcon(name: String, icon: ImageVector) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp).clickable { /*TODO*/ }
    ) {
        Box(contentAlignment = Alignment.Center) {
            // Orb Background
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                modifier = Modifier.size(56.dp)
            ) {
                Icon(
                    imageVector = icon, 
                    contentDescription = name, 
                    modifier = Modifier.padding(14.dp), 
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = name, 
            fontSize = 10.sp, 
            textAlign = TextAlign.Center, 
            lineHeight = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}


data class FeatureItem(val name: String, val icon: ImageVector)

@Preview(showBackground = true)
@Composable
fun HomeContentAuthenticatedPreview() {
    AlhasanahMediaTheme {
        // HomeContent(isLoggedIn = true, openDrawer = {}, onNotificationClick = {}, navController = rememberNavController()) // Example usage
    }
}
