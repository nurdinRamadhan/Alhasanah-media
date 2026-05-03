package com.alhasanah.alhasanahmedia.ui.home

import androidx.compose.runtime.Composable
import androidx.navigation.NavController

@Composable
fun HomeScreen(
    isLoggedIn: Boolean,
    openDrawer: () -> Unit,
    navController: NavController
) {
    // Scaffold has been moved to HomeContent, we pass all necessary parameters down
    HomeContent(
        isLoggedIn = isLoggedIn,
        openDrawer = openDrawer,
        onNotificationClick = { /* TODO */ },
        navController = navController // Pass NavController to HomeContent
    )
}
