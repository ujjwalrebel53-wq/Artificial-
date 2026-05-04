package com.rebelai.app.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AnimationUtils
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import com.rebelai.app.R
import com.rebelai.app.data.prefs.UserPrefs
import com.rebelai.app.databinding.ActivitySplashBinding

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT

        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        startAnimations()
        navigateAfterDelay()
    }

    private fun startAnimations() {
        binding.logoContainer.alpha = 0f
        binding.logoContainer.scaleX = 0.8f
        binding.logoContainer.scaleY = 0.8f
        binding.logoContainer.animate()
            .alpha(1f).scaleX(1f).scaleY(1f)
            .setDuration(800).setStartDelay(200)
            .start()

        binding.tagline.alpha = 0f
        binding.tagline.translationY = 20f
        binding.tagline.animate()
            .alpha(1f).translationY(0f)
            .setDuration(600).setStartDelay(800)
            .start()

        binding.loadingBar.animate()
            .alpha(1f)
            .setDuration(400).setStartDelay(1000)
            .start()
    }

    private fun navigateAfterDelay() {
        Handler(Looper.getMainLooper()).postDelayed({
            val prefs = UserPrefs.get(this)
            val intent = if (prefs.isLoggedIn) {
                Intent(this, MainActivity::class.java)
            } else {
                Intent(this, AuthActivity::class.java)
            }
            startActivity(intent)
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }, 2200)
    }
}
