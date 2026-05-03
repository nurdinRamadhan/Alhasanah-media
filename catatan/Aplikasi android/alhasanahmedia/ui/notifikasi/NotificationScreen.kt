package com.alhasanah.alhasanahmedia.ui.notifikasi

import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.alhasanah.alhasanahmedia.navigation.Screen
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.auth.Auth
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable
import android.util.Log
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class NotificationItem(
    @SerialName("id") val id: String,
    @SerialName("title") val title: String,
    @SerialName("body") val body: String,
    @SerialName("data") val data: JsonElement,
    @SerialName("status") val status: String,
    @SerialName("source_table") val source_table: String? = null,
    @SerialName("created_at") val created_at: String
)

class NotificationViewModel(
    private val postgrest: Postgrest,
    private val auth: Auth
) : ViewModel() {
    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    init {
        fetchNotifications()
    }

    fun fetchNotifications() {
        val user = auth.currentUserOrNull() ?: run {
            Log.e("NotifVM", "User not logged in")
            return
        }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val response = postgrest["notification_queue"]
                    .select {
                        filter {
                            eq("user_id", user.id)
                        }
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    }
                
                val list = response.decodeList<NotificationItem>()
                _notifications.value = list
                Log.d("NotifVM", "Berhasil mengambil ${list.size} notifikasi")
            } catch (e: Exception) {
                Log.e("NotifVM", "Gagal decode notifikasi: ${e.message}", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun deleteNotification(notificationId: String) {
        viewModelScope.launch {
            try {
                postgrest["notification_queue"].delete {
                    filter {
                        eq("id", notificationId)
                    }
                }
                // Update list lokal agar UI langsung berubah tanpa loading berat
                _notifications.value = _notifications.value.filter { it.id != notificationId }
                Log.d("NotifVM", "Notifikasi $notificationId berhasil dihapus")
            } catch (e: Exception) {
                Log.e("NotifVM", "Gagal menghapus notifikasi", e)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationScreen(
    navController: NavController,
    viewModel: NotificationViewModel = koinViewModel()
) {
    val notifications by viewModel.notifications.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.fetchNotifications()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifikasi", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            if (isLoading && notifications.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (notifications.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.NotificationsNone,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.outline
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Belum ada notifikasi", color = MaterialTheme.colorScheme.outline)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(notifications) { item ->
                        NotificationCard(
                            item = item,
                            onClick = { handleNotificationClick(item, navController) },
                            onDelete = { viewModel.deleteNotification(item.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationCard(
    item: NotificationItem, 
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val icon = when (item.source_table) {
        "tagihan_santri" -> Icons.Default.CreditCard
        "pelanggaran_santri" -> Icons.Default.Gavel
        "perizinan_santri" -> Icons.Default.Assignment
        "kesehatan_santri" -> Icons.Default.MedicalServices
        else -> Icons.Default.Notifications
    }

    val iconColor = when (item.source_table) {
        "tagihan_santri" -> Color(0xFF4CAF50)
        "pelanggaran_santri" -> Color(0xFFF44336)
        "perizinan_santri" -> Color(0xFF2196F3)
        "kesehatan_santri" -> Color(0xFFFF9800)
        else -> MaterialTheme.colorScheme.primary
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(iconColor.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconColor)
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = item.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = item.created_at.take(10),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
            
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Default.DeleteOutline,
                    contentDescription = "Hapus",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                )
            }
        }
    }
}

private fun handleNotificationClick(item: NotificationItem, navController: NavController) {
    try {
        val json = item.data.jsonObject
        val type = json["type"]?.jsonPrimitive?.content
        val nis = json["nis"]?.jsonPrimitive?.content
        
        if (type != null && nis != null) {
            when (type) {
                "tagihan" -> navController.navigate(Screen.Keuangan.createRoute(nis))
                "pelanggaran" -> navController.navigate(Screen.Pelanggaran.createRoute(nis))
                "hafalan" -> navController.navigate(Screen.Hafalan.createRoute(nis))
                "kesehatan" -> navController.navigate(Screen.Kesehatan.createRoute(nis))
                "perizinan" -> navController.navigate(Screen.Perizinan.createRoute(nis))
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}
