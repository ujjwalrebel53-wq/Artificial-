package com.rebelai.app.ui

import android.Manifest
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.permissionx.guolindev.PermissionX
import com.rebelai.app.R
import com.rebelai.app.data.db.AppDatabase
import com.rebelai.app.data.models.*
import com.rebelai.app.data.network.NetworkModule
import com.rebelai.app.data.prefs.UserPrefs
import com.rebelai.app.databinding.ActivityMainBinding
import com.rebelai.app.ui.adapter.ChatAdapter
import com.rebelai.app.ui.adapter.ConversationAdapter
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.*
import android.util.Base64

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val prefs by lazy { UserPrefs.get(this) }
    private val db by lazy { AppDatabase.get(this) }

    private val chatAdapter = ChatAdapter { msg -> onMessageAction(msg) }
    private val convAdapter = ConversationAdapter { conv -> onConversationSelected(conv) }

    private var currentConvId = -1L
    private var selectedImageBase64: String? = null
    private var isGenerating = false

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { handleImageUri(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        setupRecyclerViews()
        loadConversations()
        requestMicPermission()
    }

    private fun setupUI() {
        val user = prefs.currentUser
        binding.tvUserName.text = user?.name ?: "User"
        binding.tvUserAvatar.text = user?.name?.firstOrNull()?.uppercaseChar()?.toString() ?: "U"
        binding.tvModelName.text = "Rebel GPT-5"

        // Sidebar
        binding.btnToggleSidebar.setOnClickListener { toggleSidebar() }
        binding.sidebarOverlay.setOnClickListener { closeSidebar() }
        binding.btnNewChat.setOnClickListener { newConversation() }
        binding.btnVoiceAssistant.setOnClickListener { openVoiceAssistant() }
        binding.btnUserProfile.setOnClickListener { showProfileSheet() }

        // Chat input
        binding.etChatInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val hasText = !s.isNullOrBlank()
                binding.btnSend.isEnabled = hasText || selectedImageBase64 != null
                binding.btnSend.alpha = if (binding.btnSend.isEnabled) 1f else 0.5f
                binding.tvCharCount.text = "${s?.length ?: 0}/4000"
            }
        })
        binding.etChatInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) { sendMessage(); true } else false
        }
        binding.btnSend.setOnClickListener { sendMessage() }
        binding.btnAttach.setOnClickListener { pickImage() }
        binding.btnVoiceInput.setOnClickListener { requestMicAndListen() }
        binding.btnRemoveImage.setOnClickListener { clearImage() }

        // Suggestion cards
        binding.suggestionCode.setOnClickListener { fillSuggestion("Write a Python function to check if a string is a palindrome") }
        binding.suggestionFact.setOnClickListener { fillSuggestion("Tell me a fascinating fact about artificial intelligence") }
        binding.suggestionCode2.setOnClickListener { fillSuggestion("How do I center a div in CSS? Show me 3 ways.") }
        binding.suggestionMotivate.setOnClickListener { fillSuggestion("Give me a powerful motivational quote for today") }
    }

    private fun setupRecyclerViews() {
        // Chat messages
        binding.rvMessages.apply {
            adapter = chatAdapter
            layoutManager = LinearLayoutManager(this@MainActivity).apply { stackFromEnd = true }
            itemAnimator = null
        }

        // Conversations sidebar
        binding.rvConversations.apply {
            adapter = convAdapter
            layoutManager = LinearLayoutManager(this@MainActivity)
        }
    }

    private fun loadConversations() {
        lifecycleScope.launch {
            val convs = withContext(Dispatchers.IO) { db.conversationDao().getAll() }
            convAdapter.setData(convs)
            if (convs.isNotEmpty()) {
                val savedId = prefs.activeConvId
                val conv = convs.find { it.id == savedId } ?: convs.first()
                selectConversation(conv)
            } else {
                newConversation()
            }
        }
    }

    private fun newConversation() {
        lifecycleScope.launch {
            val conv = Conversation(title = "New conversation")
            val id = withContext(Dispatchers.IO) { db.conversationDao().insert(conv) }
            currentConvId = id
            prefs.activeConvId = id
            chatAdapter.clear()
            binding.rvMessages.visibility = View.GONE
            binding.welcomeScreen.visibility = View.VISIBLE
            loadConversations()
            closeSidebar()
        }
    }

    private fun onConversationSelected(conv: Conversation) = selectConversation(conv)

    private fun selectConversation(conv: Conversation) {
        currentConvId = conv.id
        prefs.activeConvId = conv.id
        closeSidebar()
        lifecycleScope.launch {
            val messages = withContext(Dispatchers.IO) { db.messageDao().getByConversation(conv.id) }
            chatAdapter.setData(messages)
            if (messages.isEmpty()) {
                binding.welcomeScreen.visibility = View.VISIBLE
                binding.rvMessages.visibility = View.GONE
            } else {
                binding.welcomeScreen.visibility = View.GONE
                binding.rvMessages.visibility = View.VISIBLE
                binding.rvMessages.post { binding.rvMessages.scrollToPosition(messages.size - 1) }
            }
        }
    }

    private fun sendMessage() {
        if (isGenerating) return
        val text = binding.etChatInput.text.toString().trim()
        if (text.isEmpty() && selectedImageBase64 == null) return

        binding.etChatInput.setText("")
        binding.welcomeScreen.visibility = View.GONE
        binding.rvMessages.visibility = View.VISIBLE
        isGenerating = true
        binding.btnSend.isEnabled = false

        val imageData = selectedImageBase64
        clearImage()

        lifecycleScope.launch {
            // Add user message to DB and UI
            val userMsg = ChatMessage(
                conversationId = currentConvId,
                role = MessageRole.USER,
                content = text,
                imageBase64 = imageData,
                type = if (imageData != null) MessageType.IMAGE else MessageType.TEXT,
            )
            withContext(Dispatchers.IO) { db.messageDao().insert(userMsg) }
            chatAdapter.addMessage(userMsg)
            scrollToBottom()

            // Add thinking indicator
            chatAdapter.setThinking(true)
            scrollToBottom()

            val t0 = System.currentTimeMillis()
            try {
                val response = withContext(Dispatchers.IO) {
                    NetworkModule.rebelApi.ask(text, imageData)
                }
                val ms = System.currentTimeMillis() - t0

                chatAdapter.setThinking(false)
                if (response.isSuccessful && response.body()?.status == true) {
                    val aiReply = response.body()?.results ?: "No response"
                    val aiMsg = ChatMessage(
                        conversationId = currentConvId,
                        role = MessageRole.ASSISTANT,
                        content = aiReply,
                        responseTimeMs = ms,
                    )
                    withContext(Dispatchers.IO) { db.messageDao().insert(aiMsg) }
                    chatAdapter.addMessage(aiMsg)

                    // Update conversation title
                    if (text.isNotBlank()) {
                        val title = text.take(40) + if (text.length > 40) "…" else ""
                        val conv = withContext(Dispatchers.IO) { db.conversationDao().getById(currentConvId) }
                        conv?.let {
                            val count = withContext(Dispatchers.IO) { db.messageDao().countByConversation(currentConvId) }
                            if (count <= 2) {
                                withContext(Dispatchers.IO) {
                                    db.conversationDao().update(it.copy(title = title, updatedAt = System.currentTimeMillis(), messageCount = count))
                                }
                            }
                        }
                        loadConversations()
                    }
                } else {
                    val errMsg = ChatMessage(
                        conversationId = currentConvId,
                        role = MessageRole.ASSISTANT,
                        content = "Sorry, I encountered an error. Please try again.",
                        isError = true,
                    )
                    chatAdapter.addMessage(errMsg)
                }
            } catch (e: Exception) {
                chatAdapter.setThinking(false)
                val errMsg = ChatMessage(
                    conversationId = currentConvId,
                    role = MessageRole.ASSISTANT,
                    content = "Connection error: ${e.message ?: "Unknown error"}. Please check your internet connection.",
                    isError = true,
                )
                chatAdapter.addMessage(errMsg)
            } finally {
                isGenerating = false
                binding.btnSend.isEnabled = true
                scrollToBottom()
            }
        }
    }

    private fun scrollToBottom() {
        val count = chatAdapter.itemCount
        if (count > 0) binding.rvMessages.smoothScrollToPosition(count - 1)
    }

    private fun pickImage() {
        pickImageLauncher.launch("image/*")
    }

    private fun handleImageUri(uri: Uri) {
        try {
            val inputStream = contentResolver.openInputStream(uri) ?: return
            val bytes = inputStream.readBytes()
            selectedImageBase64 = Base64.encodeToString(bytes, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            binding.imagePreviewBar.visibility = View.VISIBLE
            binding.ivImagePreview.setImageBitmap(bitmap)
            binding.btnSend.isEnabled = true
            binding.btnSend.alpha = 1f
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to load image", Toast.LENGTH_SHORT).show()
        }
    }

    private fun clearImage() {
        selectedImageBase64 = null
        binding.imagePreviewBar.visibility = View.GONE
        binding.ivImagePreview.setImageDrawable(null)
    }

    private fun fillSuggestion(text: String) {
        binding.etChatInput.setText(text)
        binding.etChatInput.setSelection(text.length)
        binding.etChatInput.requestFocus()
    }

    private fun requestMicPermission() {
        PermissionX.init(this)
            .permissions(Manifest.permission.RECORD_AUDIO)
            .onExplainRequestReason { scope, _ -> scope.showRequestReasonDialog(listOf(Manifest.permission.RECORD_AUDIO), getString(R.string.mic_permission_msg), "OK", "Cancel") }
            .request { allGranted, _, _ -> if (!allGranted) { } }
    }

    private fun requestMicAndListen() {
        PermissionX.init(this)
            .permissions(Manifest.permission.RECORD_AUDIO)
            .request { allGranted, _, _ ->
                if (allGranted) startVoiceInputInline()
                else Toast.makeText(this, getString(R.string.error_mic), Toast.LENGTH_SHORT).show()
            }
    }

    private fun startVoiceInputInline() {
        val recognizer = android.speech.SpeechRecognizer.createSpeechRecognizer(this)
        val intent = android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        binding.btnVoiceInput.setImageResource(android.R.drawable.ic_btn_speak_now)
        recognizer.setRecognitionListener(object : android.speech.RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) { binding.btnVoiceInput.setImageResource(R.drawable.ic_mic); recognizer.destroy() }
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                if (text.isNotBlank()) {
                    binding.etChatInput.setText(text)
                    binding.etChatInput.setSelection(text.length)
                }
                binding.btnVoiceInput.setImageResource(R.drawable.ic_mic)
                recognizer.destroy()
            }
            override fun onPartialResults(partial: Bundle?) {
                val text = partial?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                if (text.isNotBlank()) binding.etChatInput.setText(text)
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        recognizer.startListening(intent)
    }

    private fun openVoiceAssistant() {
        val intent = Intent(this, VoiceActivity::class.java)
        startActivity(intent)
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    private fun showProfileSheet() {
        val sheet = BottomSheetDialog(this, R.style.BottomSheetTheme)
        val view = layoutInflater.inflate(R.layout.sheet_profile, null)
        val user = prefs.currentUser
        view.findViewById<android.widget.TextView>(R.id.tvSheetName)?.text = user?.name ?: "User"
        view.findViewById<android.widget.TextView>(R.id.tvSheetEmail)?.text = user?.email ?: ""
        view.findViewById<android.widget.TextView>(R.id.tvSheetRole)?.text = user?.role ?: "User"
        view.findViewById<android.widget.Button>(R.id.btnSheetLogout)?.setOnClickListener {
            sheet.dismiss()
            prefs.clear()
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
        }
        view.findViewById<android.widget.Button>(R.id.btnSheetVoice)?.setOnClickListener {
            sheet.dismiss()
            openVoiceAssistant()
        }
        sheet.setContentView(view)
        sheet.show()
    }

    private fun onMessageAction(msg: ChatMessage) {
        // Copy text to clipboard
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Rebel AI", msg.content))
        Toast.makeText(this, "Copied to clipboard", Toast.LENGTH_SHORT).show()
    }

    private fun toggleSidebar() {
        if (binding.sidebar.translationX == 0f) closeSidebar() else openSidebar()
    }

    private fun openSidebar() {
        binding.sidebar.animate().translationX(0f).setDuration(300).start()
        binding.sidebarOverlay.visibility = View.VISIBLE
        binding.sidebarOverlay.animate().alpha(1f).setDuration(300).start()
    }

    private fun closeSidebar() {
        binding.sidebar.animate().translationX(-binding.sidebar.width.toFloat()).setDuration(300).start()
        binding.sidebarOverlay.animate().alpha(0f).setDuration(300).withEndAction {
            binding.sidebarOverlay.visibility = View.GONE
        }.start()
    }

    override fun onStart() {
        super.onStart()
        // Sidebar starts off-screen on mobile
        binding.sidebar.post {
            binding.sidebar.translationX = -binding.sidebar.width.toFloat()
            binding.sidebarOverlay.alpha = 0f
            binding.sidebarOverlay.visibility = View.GONE
        }
    }

    override fun onBackPressed() {
        if (binding.sidebar.translationX == 0f) { closeSidebar(); return }
        super.onBackPressed()
    }
}
