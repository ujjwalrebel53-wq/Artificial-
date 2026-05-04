package com.rebelai.app.ui

import android.Manifest
import android.content.Intent
import android.graphics.drawable.AnimatedVectorDrawable
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.rebelai.app.data.network.NetworkModule
import com.rebelai.app.data.prefs.UserPrefs
import com.rebelai.app.databinding.ActivityVoiceBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

class VoiceActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVoiceBinding
    private val prefs by lazy { UserPrefs.get(this) }

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isListening = false
    private var isSpeaking = false
    private var isHindiMode = false
    private val http = OkHttpClient()

    private val elevenKeys = listOf(
        "sk_8fc19956a67359474720d2cd75e2a312ca85e748433d8f08",
        "sk_6b8aaa9e530729ae9ac3592b0a3cd6af32485b66bfe146ce",
    )
    private val elevenVoiceId = "N2lVS1w4EtoT3dr4eOWO"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        binding = ActivityVoiceBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        initTTS()
        checkMicPermission()
    }

    private fun setupUI() {
        // Header
        binding.btnClose.setOnClickListener { finishWithAnimation() }

        // Mic button
        binding.btnMic.setOnClickListener {
            if (isListening) stopListening()
            else startListeningFlow()
        }

        // Stop speaking
        binding.btnStopSpeak.setOnClickListener { stopSpeaking() }

        // Clear transcript
        binding.btnClearTranscript.setOnClickListener {
            binding.transcript.removeAllViews()
            addTranscriptMsg("sys", "Transcript cleared.")
        }

        // Quick commands
        binding.btnQuickTime.setOnClickListener { handleQuickCommand("What's the current time?") }
        binding.btnQuickFact.setOnClickListener { handleQuickCommand("Tell me a fascinating fact") }
        binding.btnQuickQuote.setOnClickListener { handleQuickCommand("Give me a powerful motivational quote") }
        binding.btnQuickHelp.setOnClickListener { handleQuickCommand("What can you do for me?") }

        // Initial state
        setState(VoiceState.IDLE)
        addTranscriptMsg("sys", "Rebel AI initialized. Tap the mic or say \"Hey Rebel\" to begin.")
    }

    private fun initTTS() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val lang = if (isHindiMode) Locale("hi", "IN") else Locale.US
                tts?.language = lang
                tts?.setSpeechRate(0.95f)
                tts?.setPitch(0.9f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) { runOnUiThread { setState(VoiceState.SPEAKING) } }
                    override fun onDone(utteranceId: String?) { runOnUiThread { isSpeaking = false; setState(VoiceState.IDLE) } }
                    override fun onError(utteranceId: String?) { runOnUiThread { isSpeaking = false; setState(VoiceState.IDLE) } }
                })
            }
        }
    }

    private fun checkMicPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 101)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101 && grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Microphone permission required for voice features", Toast.LENGTH_LONG).show()
        }
    }

    private fun startListeningFlow() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            checkMicPermission()
            return
        }
        if (isSpeaking) stopSpeaking()
        startListening()
    }

    private fun startListening() {
        isListening = true
        setState(VoiceState.LISTENING)

        val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (isHindiMode) "hi-IN" else "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) { updateWaveformAmplitude(rmsdB) }
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    isListening = false
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH -> { setState(VoiceState.IDLE); addTranscriptMsg("sys", "No speech detected. Try again.") }
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> { setState(VoiceState.IDLE) }
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> { setState(VoiceState.IDLE); Toast.makeText(this@VoiceActivity, "Mic permission required", Toast.LENGTH_SHORT).show() }
                        else -> { setState(VoiceState.IDLE) }
                    }
                }
                override fun onResults(results: Bundle?) {
                    isListening = false
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim() ?: ""
                    if (text.isNotBlank()) {
                        addTranscriptMsg("user", text)
                        queryAI(text)
                    } else {
                        setState(VoiceState.IDLE)
                        addTranscriptMsg("sys", "No speech detected. Try again.")
                    }
                }
                override fun onPartialResults(partial: Bundle?) {
                    val text = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                    if (text.isNotBlank()) binding.tvStatusText.text = text.takeLast(60)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        speechRecognizer?.startListening(recognizerIntent)
    }

    private fun stopListening() {
        isListening = false
        speechRecognizer?.stopListening()
        setState(VoiceState.IDLE)
    }

    private fun queryAI(text: String) {
        // Check Hindi/English mode switches
        when {
            text.lowercase().contains("hindi") -> {
                isHindiMode = true
                addTranscriptMsg("sys", "Switching to Hindi mode…")
                binding.tvAvatarSubtitle.text = "HINDI INTERFACE"
                tts?.language = Locale("hi", "IN")
            }
            text.lowercase().contains("english") -> {
                isHindiMode = false
                addTranscriptMsg("sys", "Switching to English mode…")
                binding.tvAvatarSubtitle.text = "NEURAL INTERFACE"
                tts?.language = Locale.US
            }
        }

        setState(VoiceState.THINKING)
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) { NetworkModule.rebelApi.ask(text) }
                if (response.isSuccessful && response.body()?.status == true) {
                    val reply = response.body()?.results ?: "No response"
                    addTranscriptMsg("ai", reply)
                    speakText(reply)
                } else {
                    setState(VoiceState.IDLE)
                    addTranscriptMsg("sys", "Error getting response. Please try again.")
                }
            } catch (e: Exception) {
                setState(VoiceState.IDLE)
                addTranscriptMsg("sys", "Connection error: ${e.message}")
            }
        }
    }

    private fun speakText(text: String) {
        isSpeaking = true
        setState(VoiceState.SPEAKING)
        val cleanText = text.replace(Regex("<[^>]+>|[*#`]"), "").take(800)

        // Try ElevenLabs premium TTS
        lifecycleScope.launch(Dispatchers.IO) {
            val keyIdx = prefs.elevenKeyIndex
            val key = elevenKeys[keyIdx % elevenKeys.size]
            try {
                val body = JSONObject().apply {
                    put("text", cleanText)
                    put("model_id", "eleven_multilingual_v2")
                    put("voice_settings", JSONObject().apply { put("stability", 0.5); put("similarity_boost", 0.75) })
                }.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("https://api.elevenlabs.io/v1/text-to-speech/$elevenVoiceId")
                    .addHeader("xi-api-key", key)
                    .post(body)
                    .build()
                val response = http.newCall(request).execute()
                if (response.isSuccessful) {
                    val bytes = response.body?.bytes()
                    if (bytes != null && bytes.isNotEmpty()) {
                        val file = File(cacheDir, "rebel_tts_${System.currentTimeMillis()}.mp3")
                        FileOutputStream(file).use { it.write(bytes) }
                        withContext(Dispatchers.Main) { playAudioFile(file) }
                        return@launch
                    }
                } else if (response.code == 429 || response.code == 401) {
                    prefs.elevenKeyIndex = (keyIdx + 1) % elevenKeys.size
                }
            } catch (_: Exception) {}

            // Fallback to Android TTS
            withContext(Dispatchers.Main) { fallbackTTS(cleanText) }
        }
    }

    private fun playAudioFile(file: File) {
        try {
            val mediaPlayer = android.media.MediaPlayer()
            mediaPlayer.setDataSource(file.absolutePath)
            mediaPlayer.prepare()
            mediaPlayer.start()
            mediaPlayer.setOnCompletionListener {
                mediaPlayer.release()
                file.delete()
                isSpeaking = false
                setState(VoiceState.IDLE)
            }
            mediaPlayer.setOnErrorListener { _, _, _ ->
                mediaPlayer.release()
                fallbackTTS(binding.tvStatusText.text.toString())
                true
            }
        } catch (e: Exception) {
            fallbackTTS(binding.tvStatusText.text.toString())
        }
    }

    private fun fallbackTTS(text: String) {
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rebel_ai_${System.currentTimeMillis()}")
    }

    private fun stopSpeaking() {
        tts?.stop()
        isSpeaking = false
        setState(VoiceState.IDLE)
    }

    private fun handleQuickCommand(cmd: String) {
        if (isListening || isSpeaking) return
        addTranscriptMsg("user", cmd)
        queryAI(cmd)
    }

    private fun setState(state: VoiceState) {
        binding.tvStatusText.text = when (state) {
            VoiceState.IDLE      -> "STANDBY"
            VoiceState.LISTENING -> "LISTENING…"
            VoiceState.THINKING  -> "THINKING…"
            VoiceState.SPEAKING  -> "SPEAKING"
            VoiceState.ERROR     -> "ERROR"
        }
        val dotColor = when (state) {
            VoiceState.IDLE      -> android.graphics.Color.parseColor("#606078")
            VoiceState.LISTENING -> android.graphics.Color.parseColor("#00CED1")
            VoiceState.THINKING  -> android.graphics.Color.parseColor("#F59E0B")
            VoiceState.SPEAKING  -> android.graphics.Color.parseColor("#10B981")
            VoiceState.ERROR     -> android.graphics.Color.parseColor("#EF4444")
        }
        binding.statusDot.setColorFilter(dotColor)
        binding.btnMic.isSelected = state == VoiceState.LISTENING
        binding.btnStopSpeak.visibility = if (state == VoiceState.SPEAKING) View.VISIBLE else View.GONE
    }

    private fun addTranscriptMsg(role: String, text: String) {
        val tv = android.widget.TextView(this).apply {
            this.text = when (role) {
                "user" -> "YOU: $text"
                "ai"   -> "AI: $text"
                else   -> "• $text"
            }
            setTextColor(when (role) {
                "user" -> android.graphics.Color.parseColor("#00CED1")
                "ai"   -> android.graphics.Color.parseColor("#F0F0F8")
                else   -> android.graphics.Color.parseColor("#606078")
            })
            textSize = 13f
            val pad = (8 * resources.displayMetrics.density).toInt()
            setPadding(0, pad / 2, 0, pad / 2)
        }
        runOnUiThread {
            binding.transcript.addView(tv)
            binding.transcriptScroll.post { binding.transcriptScroll.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun updateWaveformAmplitude(rms: Float) {
        binding.waveformView.updateAmplitude(rms)
    }

    private fun finishWithAnimation() {
        stopListening()
        stopSpeaking()
        finish()
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        tts?.shutdown()
    }

    override fun onBackPressed() { finishWithAnimation() }

    enum class VoiceState { IDLE, LISTENING, THINKING, SPEAKING, ERROR }
}
