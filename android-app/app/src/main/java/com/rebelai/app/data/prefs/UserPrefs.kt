package com.rebelai.app.data.prefs

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.rebelai.app.data.models.AppSettings
import com.rebelai.app.data.models.User

class UserPrefs(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("rebel_ai_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    var currentUser: User?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try { gson.fromJson(json, User::class.java) } catch (e: Exception) { null }
        }
        set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_USER)
                else putString(KEY_USER, gson.toJson(value))
                apply()
            }
        }

    var settings: AppSettings
        get() {
            val json = prefs.getString(KEY_SETTINGS, null) ?: return AppSettings()
            return try { gson.fromJson(json, AppSettings::class.java) } catch (e: Exception) { AppSettings() }
        }
        set(value) { prefs.edit().putString(KEY_SETTINGS, gson.toJson(value)).apply() }

    var isLoggedIn: Boolean
        get() = currentUser != null
        set(_) {}

    var activeConvId: Long
        get() = prefs.getLong(KEY_CONV_ID, -1L)
        set(value) { prefs.edit().putLong(KEY_CONV_ID, value).apply() }

    var elevenKeyIndex: Int
        get() = prefs.getInt(KEY_ELEVEN_IDX, 0)
        set(value) { prefs.edit().putInt(KEY_ELEVEN_IDX, value).apply() }

    fun clear() { prefs.edit().clear().apply() }

    companion object {
        private const val KEY_USER = "current_user"
        private const val KEY_SETTINGS = "app_settings"
        private const val KEY_CONV_ID = "active_conv_id"
        private const val KEY_ELEVEN_IDX = "eleven_key_idx"

        @Volatile private var INSTANCE: UserPrefs? = null
        fun get(context: Context): UserPrefs = INSTANCE ?: synchronized(this) {
            UserPrefs(context.applicationContext).also { INSTANCE = it }
        }
    }
}
