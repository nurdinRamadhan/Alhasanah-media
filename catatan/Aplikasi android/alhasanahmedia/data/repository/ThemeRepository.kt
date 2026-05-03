package com.alhasanah.alhasanahmedia.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class ThemeRepository(private val context: Context) {

    private val themeKey = booleanPreferencesKey("dark_theme_enabled")

    val getThemeMode: Flow<Boolean?> = context.dataStore.data
        .map { preferences ->
            preferences[themeKey]
        }

    suspend fun setThemeMode(isDarkMode: Boolean) {
        context.dataStore.edit {
            it[themeKey] = isDarkMode
        }
    }
}
