package com.alhasanah.alhasanahmedia.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.with
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun ThemeToggleButton(
    isDark: Boolean, 
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current
) {
    IconButton(onClick = onToggle, modifier = modifier) {
        AnimatedContent(
            targetState = isDark,
            transitionSpec = {
                if (targetState) { // Dark mode is active
                    slideInVertically { height -> height } + fadeIn() with
                            slideOutVertically { height -> -height } + fadeOut()
                } else { // Light mode is active
                    slideInVertically { height -> -height } + fadeIn() with
                            slideOutVertically { height -> height } + fadeOut()
                }.using(SizeTransform(clip = false))
            }
        ) { isDarkTheme ->
            if (isDarkTheme) {
                Icon(
                    Icons.Filled.LightMode, 
                    contentDescription = "Switch to Light Mode",
                    tint = tint
                )
            } else {
                Icon(
                    Icons.Filled.DarkMode, 
                    contentDescription = "Switch to Dark Mode",
                    tint = tint
                )
            }
        }
    }
}
