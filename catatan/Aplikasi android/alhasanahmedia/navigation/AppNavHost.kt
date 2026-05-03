package com.alhasanah.alhasanahmedia.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.alhasanah.alhasanahmedia.ui.auth.LoginScreen
import com.alhasanah.alhasanahmedia.ui.berita.BeritaDetailScreen
import com.alhasanah.alhasanahmedia.ui.home.HomeScreen
import com.alhasanah.alhasanahmedia.ui.notifikasi.NotificationScreen
import com.alhasanah.alhasanahmedia.ui.keuangan.KeuanganScreen
import com.alhasanah.alhasanahmedia.ui.santri.*
import com.alhasanah.alhasanahmedia.ui.splash.SplashScreen
import org.koin.androidx.compose.koinViewModel
import org.koin.core.parameter.parametersOf

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Home : Screen("home")
    object Login : Screen("login")
    object SantriList : Screen("santri_list")
    object BeritaDetail : Screen("berita_detail/{slug}") { // New Route
        fun createRoute(slug: String) = "berita_detail/$slug"
    }
    object Hafalan : Screen("hafalan/{nis}") {
        fun createRoute(nis: String) = "hafalan/$nis"
    }
    object Pelanggaran : Screen("pelanggaran/{nis}") {
        fun createRoute(nis: String) = "pelanggaran/$nis"
    }
    object Kesehatan : Screen("kesehatan/{nis}") {
        fun createRoute(nis: String) = "kesehatan/$nis"
    }
    object Perizinan : Screen("perizinan/{nis}") {
        fun createRoute(nis: String) = "perizinan/$nis"
    }
    object Keuangan : Screen("keuangan/{nis}") {
        fun createRoute(nis: String) = "keuangan/$nis"
    }
    object SantriDetail : Screen("santri_detail/{nis}") {
        fun createRoute(nis: String) = "santri_detail/$nis"
    }
    object Notifications : Screen("notifications")
    object HafalanKitab : Screen("hafalan_kitab/{nis}") {
        fun createRoute(nis: String) = "hafalan_kitab/$nis"
    }
}

@Composable
fun AppNavHost(
    navController: NavHostController,
    isLoggedIn: Boolean,
    openDrawer: () -> Unit
) {
    val santriActivityViewModel: SantriActivityViewModel = koinViewModel()

    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route,
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(navController = navController)
        }
        composable(Screen.Home.route) {
            HomeScreen(
                isLoggedIn = isLoggedIn,
                openDrawer = openDrawer,
                navController = navController
            )
        }
        composable(Screen.Notifications.route) {
            // Kita akan buat layar ini nanti
            NotificationScreen(navController = navController)
        }
        composable(Screen.Login.route) {
            LoginScreen(navController = navController)
        }
        composable(Screen.SantriList.route) {
            SantriListScreen(navController = navController)
        }
         composable(
            route = Screen.BeritaDetail.route, // New Destination
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: ""
            BeritaDetailScreen(slug = slug, onBack = { navController.popBackStack() })
        }
        composable(
            route = Screen.Keuangan.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: ""
            KeuanganScreen(santriNis = santriNis)
        }
        composable(
            route = Screen.SantriDetail.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            SantriDetailScreen(
                santriNis = santriNis,
                navController = navController,
                viewModel = koinViewModel { parametersOf(santriNis) }
            )
        }

        // New Santri Activity Screens
        composable(
            route = Screen.Hafalan.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            HafalanScreen(
                navController = navController,
                viewModel = santriActivityViewModel,
                santriNis = santriNis
            )
        }
        composable(
            route = Screen.Pelanggaran.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            PelanggaranScreen(
                navController = navController,
                viewModel = santriActivityViewModel,
                santriNis = santriNis
            )
        }
        composable(
            route = Screen.Kesehatan.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            KesehatanScreen(
                navController = navController,
                viewModel = santriActivityViewModel,
                santriNis = santriNis
            )
        }
        composable(
            route = Screen.Perizinan.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            PerizinanScreen(
                navController = navController,
                viewModel = santriActivityViewModel,
                santriNis = santriNis
            )
        }
        composable(
            route = Screen.HafalanKitab.route,
            arguments = listOf(navArgument("nis") { type = NavType.StringType })
        ) { backStackEntry ->
            val santriNis = backStackEntry.arguments?.getString("nis") ?: return@composable
            HafalanKitabScreen(
                navController = navController,
                viewModel = santriActivityViewModel,
                santriNis = santriNis
            )
        }
    }
}
