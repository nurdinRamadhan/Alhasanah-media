package com.alhasanah.alhasanahmedia

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.alhasanah.alhasanahmedia.navigation.AppNavHost
import com.alhasanah.alhasanahmedia.navigation.Screen
import com.alhasanah.alhasanahmedia.ui.auth.AuthViewModel
import com.alhasanah.alhasanahmedia.ui.auth.AuthenticationState
import com.alhasanah.alhasanahmedia.ui.theme.AlhasanahMediaTheme
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel

class MainActivity : ComponentActivity() {

    private val _intentFlow = MutableStateFlow<Intent?>(null)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.entries.all { it.value }
        if (granted) {
            Log.d("MainActivity", "All permissions granted")
        } else {
            Log.d("MainActivity", "Some permissions denied")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installSplashScreen()
        enableEdgeToEdge()

        askRequiredPermissions()
        
        _intentFlow.value = intent

        // Log FCM Token for debugging
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                Log.d("FCM_TOKEN", task.result)
            }
        }

        setContent {
            val mainViewModel: MainViewModel = koinViewModel()
            val themeMode by mainViewModel.themeMode.collectAsState()
            val isSystemDark = isSystemInDarkTheme()
            val useDarkTheme = themeMode ?: isSystemDark
            
            val currentIntent by _intentFlow.collectAsState()

            AlhasanahMediaTheme(darkTheme = useDarkTheme) {
                AlhasanahApp(mainViewModel, currentIntent)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        _intentFlow.value = intent
    }

    private fun askRequiredPermissions() {
        val permissions = mutableListOf<String>()
        
        // Notifikasi (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        
        // Lokasi
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlhasanahApp(mainViewModel: MainViewModel, intent: Intent?) {
    val authViewModel: AuthViewModel = koinViewModel()
    val authState by authViewModel.authenticationState.collectAsState()
    val user by authViewModel.getCurrentUser().collectAsState(initial = null)
    val activeSantriNis by authViewModel.activeSantriNis.collectAsState()
    val isLoggedIn = authState is AuthenticationState.Authenticated

    val navController = rememberNavController()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val isSystemDark = isSystemInDarkTheme()

    // Handle Notification Click Navigation
    LaunchedEffect(intent, isLoggedIn, activeSantriNis) {
        if (isLoggedIn && intent != null) {
            val type = intent.getStringExtra("notif_type")
            val nis = intent.getStringExtra("notif_nis") ?: activeSantriNis

            if (type != null && nis != null) {
                when (type) {
                    "tagihan" -> navController.navigate(Screen.Keuangan.createRoute(nis))
                    "pelanggaran" -> navController.navigate(Screen.Pelanggaran.createRoute(nis))
                    "hafalan" -> navController.navigate(Screen.Hafalan.createRoute(nis))
                    "kesehatan" -> navController.navigate(Screen.Kesehatan.createRoute(nis))
                    "perizinan" -> navController.navigate(Screen.Perizinan.createRoute(nis))
                }
                // Clear extras to avoid re-navigation on recomposition
                intent.removeExtra("notif_type")
            }
        }
    }

    if (drawerState.isOpen) {
        BackHandler { scope.launch { drawerState.close() } }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawerContent(
                isLoggedIn = isLoggedIn,
                user = user,
                activeSantriNis = activeSantriNis,
                navController = navController,
                closeDrawer = { scope.launch { drawerState.close() } },
                onLogout = { authViewModel.signOut() },
                onToggleTheme = { mainViewModel.toggleTheme(isSystemDark) }
            )
        }
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            AppNavHost(
                navController = navController,
                isLoggedIn = isLoggedIn,
                openDrawer = { scope.launch { drawerState.open() } }
            )
        }
    }
}

@Composable
fun AppDrawerContent(
    isLoggedIn: Boolean,
    user: UserInfo?,
    activeSantriNis: String?,
    navController: NavHostController,
    closeDrawer: () -> Unit,
    onLogout: () -> Unit,
    onToggleTheme: () -> Unit
) {
    val isDark = isSystemInDarkTheme()
    
    ModalDrawerSheet(
        modifier = Modifier.fillMaxWidth(0.85f),
        drawerContainerColor = MaterialTheme.colorScheme.surface,
        drawerShape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp),
        drawerTonalElevation = 0.dp
    ) {
        Column(modifier = Modifier.fillMaxHeight()) {
            DrawerHeader(user = user)
            
            // Subtle Pattern Overlay for the whole drawer
            Box(modifier = Modifier.weight(1f)) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 12.dp, vertical = 16.dp)
                ) {
                    DrawerBody(
                        isLoggedIn = isLoggedIn,
                        activeSantriNis = activeSantriNis,
                        navController = navController,
                        closeDrawer = closeDrawer,
                        onLogout = onLogout,
                        onToggleTheme = onToggleTheme
                    )
                }
            }
            
            // Footer Brand Label
            Text(
                text = "ALHASANAH MEDIA v1.0",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                    letterSpacing = 2.sp,
                    fontWeight = FontWeight.Bold
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

@Composable
fun DrawerHeader(user: UserInfo?) {
    val primaryGold = MaterialTheme.colorScheme.primary
    val secondaryGold = MaterialTheme.colorScheme.secondary
    
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(primaryGold, secondaryGold)
                )
            )
            .padding(top = 56.dp, start = 24.dp, end = 24.dp, bottom = 32.dp)
    ) {
        // Subtle Geometric Background Pattern in Header
        Canvas(modifier = Modifier.matchParentSize().alpha(0.1f)) {
            val size = 40.dp.toPx()
            for (i in 0..10) {
                for (j in 0..10) {
                    drawCircle(Color.White, radius = 1.dp.toPx(), center = Offset(i * size, j * size))
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Profile Orb with Glow
            Box(contentAlignment = Alignment.Center) {
                Surface(
                    modifier = Modifier.size(76.dp),
                    shape = CircleShape,
                    color = Color.White.copy(alpha = 0.2f),
                    border = border(2.dp, Color.White.copy(alpha = 0.5f), CircleShape)
                ) {}
                Icon(
                    painter = painterResource(id = R.drawable.ic_user_placeholder),
                    contentDescription = "User Avatar",
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape),
                    tint = Color.Unspecified
                )
            }

            Column {
                Text(
                    text = user?.email?.substringBefore('@')?.uppercase() ?: "WALI SANTRI",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        letterSpacing = 1.sp
                    )
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(6.dp).background(Color.White, CircleShape))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (user != null) "Akses Terverifikasi" else "Guest Mode",
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White.copy(alpha = 0.8f),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun DrawerBody(
    isLoggedIn: Boolean,
    activeSantriNis: String?,
    navController: NavHostController,
    closeDrawer: () -> Unit,
    onLogout: () -> Unit,
    onToggleTheme: () -> Unit
) {
    val isNavEnabled = activeSantriNis != null
    val primaryColor = MaterialTheme.colorScheme.primary

    if (isLoggedIn) {
        DrawerSectionLabel("MENU UTAMA")
        DrawerMenuItemElegant(
            icon = Icons.Outlined.Home, 
            text = "Beranda", 
            onClick = { closeDrawer(); navController.navigate(Screen.Home.route) }
        )
        DrawerMenuItemElegant(
            icon = Icons.Outlined.Groups, 
            text = "Informasi Santri", 
            onClick = { closeDrawer(); navController.navigate(Screen.SantriList.route) }
        )

        Spacer(modifier = Modifier.height(16.dp))
        DrawerSectionLabel("FITUR SANTRI")
        
        DrawerMenuItemElegant(icon = Icons.Outlined.Person, text = "Profil Santri", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.SantriDetail.createRoute(activeSantriNis!!)) 
        }
        DrawerMenuItemElegant(icon = Icons.Outlined.MenuBook, text = "Progres Hafalan", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.Hafalan.createRoute(activeSantriNis!!)) 
        }
        DrawerMenuItemElegant(icon = Icons.Outlined.LibraryBooks, text = "Hafalan Kitab", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.HafalanKitab.createRoute(activeSantriNis!!)) 
        }
        DrawerMenuItemElegant(icon = Icons.Outlined.ReportProblem, text = "Catatan Kedisiplinan", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.Pelanggaran.createRoute(activeSantriNis!!)) 
        }
        DrawerMenuItemElegant(icon = Icons.Outlined.MedicalServices, text = "Rekam Medis", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.Kesehatan.createRoute(activeSantriNis!!)) 
        }
        DrawerMenuItemElegant(icon = Icons.Outlined.Assignment, text = "Izin Santri", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.Perizinan.createRoute(activeSantriNis!!)) 
        }

        Spacer(modifier = Modifier.height(16.dp))
        DrawerSectionLabel("KEUANGAN")
        DrawerMenuItemElegant(icon = Icons.Outlined.CreditCard, text = "Tagihan & SPP", isEnabled = isNavEnabled) { 
            closeDrawer(); navController.navigate(Screen.Keuangan.createRoute(activeSantriNis!!)) 
        }

    } else {
        DrawerMenuItemElegant(icon = Icons.Outlined.Login, text = "Masuk ke Akun", onClick = { closeDrawer(); navController.navigate(Screen.Login.route) })
    }
    
    Spacer(modifier = Modifier.height(24.dp))
    HorizontalDivider(modifier = Modifier.padding(horizontal = 12.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
    Spacer(modifier = Modifier.height(16.dp))

    DrawerMenuItemElegant(icon = Icons.Outlined.Brightness4, text = "Ganti Tema", onClick = onToggleTheme)
    
    if (isLoggedIn) {
        DrawerMenuItemElegant(
            icon = Icons.Outlined.Logout, 
            text = "Keluar", 
            textColor = MaterialTheme.colorScheme.error,
            iconColor = MaterialTheme.colorScheme.error,
            onClick = onLogout
        )
    }
}

@Composable
fun DrawerSectionLabel(text: String) {
    Text(
        text = text,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
        style = MaterialTheme.typography.labelSmall.copy(
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.5.sp
        )
    )
}

@Composable
fun DrawerMenuItemElegant(
    icon: ImageVector, 
    text: String, 
    isEnabled: Boolean = true, 
    textColor: Color = MaterialTheme.colorScheme.onSurface,
    iconColor: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit
) {
    val contentAlpha = if (isEnabled) 1.0f else 0.4f

    NavigationDrawerItem(
        icon = { 
            Icon(
                imageVector = icon, 
                contentDescription = text, 
                tint = iconColor.copy(alpha = contentAlpha),
                modifier = Modifier.size(22.dp)
            ) 
        },
        label = { 
            Text(
                text = text, 
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = textColor.copy(alpha = contentAlpha)
                )
            ) 
        },
        selected = false,
        onClick = { if (isEnabled) onClick() },
        colors = NavigationDrawerItemDefaults.colors(
            unselectedContainerColor = Color.Transparent,
            selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
        ),
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
    )
}

private fun border(width: androidx.compose.ui.unit.Dp, color: Color, shape: androidx.compose.ui.graphics.Shape) = 
    androidx.compose.foundation.BorderStroke(width, color)


@Preview(showBackground = true)
@Composable
fun DefaultPreview() {
    AlhasanahMediaTheme(darkTheme = false) {
        // This preview won't show the dynamic items correctly without a proper ViewModel.
    }
}
