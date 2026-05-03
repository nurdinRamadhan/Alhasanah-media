package com.alhasanah.alhasanahmedia.ui.santri

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.alhasanah.alhasanahmedia.navigation.Screen
import com.alhasanah.alhasanahmedia.data.model.SantriModel
import org.koin.androidx.compose.koinViewModel

@Composable
fun SantriListScreen(
    navController: NavController,
    viewModel: SantriListViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val navigationState by viewModel.navigationState.collectAsState()

    // Handle navigation automatically
    LaunchedEffect(navigationState) {
        when (val navState = navigationState) {
            is SantriNavigationState.GoToDetail -> {
                // Navigate to detail and pop this list screen from the back stack
                navController.navigate(Screen.SantriDetail.createRoute(navState.santriId)) {
                    popUpTo(Screen.SantriList.route) { inclusive = true }
                }
            }
            else -> { /* Do nothing for Idle or ShowList */ }
        }
    }

    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when (val state = uiState) {
            is SantriListUiState.Loading -> {
                CircularProgressIndicator()
            }
            is SantriListUiState.Success -> {
                // Only show the list if the navigation state says so
                if (navigationState is SantriNavigationState.ShowList) {
                    LazyColumn(contentPadding = PaddingValues(16.dp)) {
                        items(state.santriList) { santri ->
                            SantriListItem(santri = santri, onClick = {
                                navController.navigate(Screen.SantriDetail.createRoute(santri.id))
                            })
                            HorizontalDivider()
                        }
                    }
                }
            }
            is SantriListUiState.Error -> {
                Text(text = state.message, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
fun SantriListItem(santri: SantriModel, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Default.Person, contentDescription = "Santri Icon", modifier = Modifier.size(40.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = santri.namaLengkap, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
            Text(text = "NIS: ${santri.id}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = "Go to detail")
    }
}
