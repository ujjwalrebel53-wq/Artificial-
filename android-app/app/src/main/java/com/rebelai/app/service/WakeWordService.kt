package com.rebelai.app.service

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Background service for "Hey Rebel" wake word detection.
 * Full implementation uses SpeechRecognizer in continuous mode.
 */
class WakeWordService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }
}
