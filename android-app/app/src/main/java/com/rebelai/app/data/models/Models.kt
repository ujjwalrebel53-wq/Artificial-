package com.rebelai.app.data.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

// ── Chat Models ──────────────────────────────────────────────

enum class MessageRole { USER, ASSISTANT, SYSTEM }
enum class MessageType { TEXT, IMAGE, VOICE, CODE }

@Entity(tableName = "messages")
data class ChatMessage(
    @PrimaryKey val id: Long = System.currentTimeMillis(),
    val conversationId: Long,
    val role: MessageRole,
    val content: String,
    val type: MessageType = MessageType.TEXT,
    val imageBase64: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val responseTimeMs: Long = 0L,
    val isError: Boolean = false,
)

@Entity(tableName = "conversations")
data class Conversation(
    @PrimaryKey val id: Long = System.currentTimeMillis(),
    val title: String = "New conversation",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val messageCount: Int = 0,
    val isPinned: Boolean = false,
)

// ── User Models ──────────────────────────────────────────────

data class User(
    val id: Long = 0,
    val name: String,
    val email: String,
    val password: String = "",
    val role: String = "User",
    val status: String = "active",
    val joined: String = "",
    val messages: Int = 0,
    val device: String = "Mobile",
    val lastLogin: String = "",
    val loginCount: Int = 1,
)

// ── API Models ───────────────────────────────────────────────

data class AIResponse(
    val status: Boolean = false,
    val results: String = "",
    val error: String? = null,
)

data class OtpRequest(val email: String)
data class OtpVerifyRequest(val email: String, val otp: String)
data class RegisterRequest(val name: String, val email: String, val password: String, val device: String)
data class LoginRequest(val username: String, val password: String)
data class ApiResponse<T>(val ok: Boolean, val data: T? = null, val error: String? = null)

// ── Voice Models ─────────────────────────────────────────────

data class VoiceMessage(
    val role: String, // "user" | "ai" | "sys"
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
)

enum class VoiceState { IDLE, LISTENING, THINKING, SPEAKING, ERROR }

// ── Settings ─────────────────────────────────────────────────

data class AppSettings(
    val userId: Long = 0,
    val userName: String = "",
    val userEmail: String = "",
    val userPassword: String = "",
    val isDarkMode: Boolean = true,
    val voiceId: String = "el_callum",
    val language: String = "en-US",
    val systemPrompt: String = "You are Rebel GPT, an advanced AI assistant created by Rebel bhaiya.",
    val chatFontSize: Float = 14f,
    val enableHaptics: Boolean = true,
    val enableWakeWord: Boolean = true,
    val wakeWord: String = "hey rebel",
)
