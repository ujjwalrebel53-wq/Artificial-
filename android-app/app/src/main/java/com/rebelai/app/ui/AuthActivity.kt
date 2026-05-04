package com.rebelai.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.rebelai.app.data.models.User
import com.rebelai.app.data.prefs.UserPrefs
import com.rebelai.app.databinding.ActivityAuthBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private val prefs by lazy { UserPrefs.get(this) }
    private val http = OkHttpClient()

    // Auth state
    private var pendingEmail = ""
    private var generatedOtp = ""
    private var otpAttempts = 0
    private var resendJob: kotlinx.coroutines.Job? = null

    enum class Step { LOGIN, EMAIL, OTP, CREATE }
    private var currentStep = Step.LOGIN

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        showStep(Step.LOGIN)
        setupClickListeners()
    }

    private fun showStep(step: Step) {
        currentStep = step
        binding.stepLogin.visibility  = if (step == Step.LOGIN)  View.VISIBLE else View.GONE
        binding.stepEmail.visibility  = if (step == Step.EMAIL)  View.VISIBLE else View.GONE
        binding.stepOtp.visibility    = if (step == Step.OTP)    View.VISIBLE else View.GONE
        binding.stepCreate.visibility = if (step == Step.CREATE) View.VISIBLE else View.GONE
    }

    private fun setupClickListeners() {
        // LOGIN STEP
        binding.btnLogin.setOnClickListener { doLogin() }
        binding.etLoginPassword.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) { doLogin(); true } else false
        }
        binding.btnGoRegister.setOnClickListener {
            binding.etEmail.setText("")
            binding.tvEmailError.visibility = View.GONE
            showStep(Step.EMAIL)
            binding.etEmail.requestFocus()
        }

        // EMAIL STEP
        binding.btnSendOtp.setOnClickListener { doSendOtp() }
        binding.btnBackFromEmail.setOnClickListener { showStep(Step.LOGIN) }

        // OTP STEP
        binding.btnVerifyOtp.setOnClickListener { doVerifyOtp() }
        binding.btnResendOtp.setOnClickListener { doSendOtp() }
        binding.btnBackFromOtp.setOnClickListener { showStep(Step.EMAIL) }
        setupOtpBoxes()

        // CREATE STEP
        binding.btnCreateAccount.setOnClickListener { doCreateAccount() }
        binding.etConfirmPassword.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) { doCreateAccount(); true } else false
        }
    }

    private fun doLogin() {
        val username = binding.etLoginUsername.text.toString().trim()
        val password = binding.etLoginPassword.text.toString().trim()
        binding.tvLoginError.visibility = View.GONE

        if (username.isEmpty()) { showLoginError("Please enter your username"); return }
        if (password.isEmpty()) { showLoginError("Please enter your password"); return }

        val users = prefs.settings.let {
            // Simple in-memory check + also try backend
            listOf<User>() // placeholder; real check below
        }

        // Try backend login
        setLoginLoading(true)
        lifecycleScope.launch {
            try {
                val ok = backendLogin(username, password)
                if (ok != null) {
                    prefs.currentUser = ok
                    goToMain()
                } else {
                    withContext(Dispatchers.Main) {
                        showLoginError("Invalid username or password")
                        binding.etLoginPassword.text?.clear()
                        setLoginLoading(false)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showLoginError("Connection error. Try again.")
                    setLoginLoading(false)
                }
            }
        }
    }

    private suspend fun backendLogin(username: String, password: String): User? = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("username", username)
                put("password", password)
            }.toString()
            val request = Request.Builder()
                .url("https://ujjwalrebel53-wq.github.io/Artificial-/api/users/login")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            val response = http.newCall(request).execute()
            val json = JSONObject(response.body?.string() ?: "{}")
            if (json.optBoolean("ok", false)) {
                val u = json.optJSONObject("user") ?: return@withContext null
                User(
                    id = u.optLong("id"),
                    name = u.optString("name"),
                    email = u.optString("email"),
                    role = u.optString("role", "User"),
                    device = u.optString("device", "Mobile"),
                    lastLogin = u.optString("last_login", ""),
                )
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private fun doSendOtp() {
        val email = binding.etEmail.text.toString().trim()
        binding.tvEmailError.visibility = View.GONE

        if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tvEmailError.text = "Enter a valid email address"
            binding.tvEmailError.visibility = View.VISIBLE
            return
        }

        pendingEmail = email
        generatedOtp = (100000..999999).random().toString()

        setSendOtpLoading(true)

        lifecycleScope.launch {
            delay(800) // Simulate sending
            withContext(Dispatchers.Main) {
                setSendOtpLoading(false)
                binding.tvOtpSentTo.text = "OTP sent to $email"
                clearOtpBoxes()
                otpAttempts = 0
                showStep(Step.OTP)
                startResendTimer(60)
                // Dev mode: show toast
                Toast.makeText(this@AuthActivity, "Dev OTP: $generatedOtp", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun doVerifyOtp() {
        val entered = getOtpValue()
        binding.tvOtpError.visibility = View.GONE

        if (entered.length < 6) {
            binding.tvOtpError.text = "Enter all 6 digits"
            binding.tvOtpError.visibility = View.VISIBLE
            return
        }

        otpAttempts++
        if (otpAttempts > 5) {
            binding.tvOtpError.text = "Too many attempts. Please restart."
            binding.tvOtpError.visibility = View.VISIBLE
            lifecycleScope.launch { delay(2000); withContext(Dispatchers.Main) { showStep(Step.EMAIL) } }
            return
        }

        if (entered == generatedOtp) {
            otpAttempts = 0
            binding.etNewUsername.setText("")
            binding.etNewPassword.setText("")
            binding.etConfirmPass.setText("")
            showStep(Step.CREATE)
            binding.etNewUsername.requestFocus()
        } else {
            binding.tvOtpError.text = "Incorrect OTP. Try again. (${6 - otpAttempts} attempts left)"
            binding.tvOtpError.visibility = View.VISIBLE
            clearOtpBoxes()
            shakeOtpBoxes()
        }
    }

    private fun doCreateAccount() {
        val name = binding.etNewUsername.text.toString().trim()
        val pass = binding.etNewPassword.text.toString().trim()
        val conf = binding.etConfirmPass.text.toString().trim()
        binding.tvCreateError.visibility = View.GONE

        when {
            name.length < 2 -> { binding.tvCreateError.text = "Username must be at least 2 characters"; binding.tvCreateError.visibility = View.VISIBLE; return }
            name.length > 30 -> { binding.tvCreateError.text = "Username too long (max 30 chars)"; binding.tvCreateError.visibility = View.VISIBLE; return }
            pass.length < 6 -> { binding.tvCreateError.text = "Password must be at least 6 characters"; binding.tvCreateError.visibility = View.VISIBLE; return }
            pass != conf -> { binding.tvCreateError.text = "Passwords do not match"; binding.tvCreateError.visibility = View.VISIBLE; binding.etConfirmPass.text?.clear(); return }
        }

        val user = User(
            id = System.currentTimeMillis(),
            name = name,
            email = pendingEmail,
            password = pass,
            device = if (android.os.Build.MODEL.length < 10) "Mobile" else "Tablet",
            joined = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            lastLogin = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date()),
        )

        prefs.currentUser = user

        // Sync to backend
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val body = JSONObject().apply {
                    put("name", name); put("email", pendingEmail)
                    put("password", pass); put("device", user.device)
                }.toString()
                val request = Request.Builder()
                    .url("https://ujjwalrebel53-wq.github.io/Artificial-/api/users/register")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                http.newCall(request).execute()
            } catch (_: Exception) {}
        }

        Toast.makeText(this, "Account created! Welcome, $name!", Toast.LENGTH_SHORT).show()
        goToMain()
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    private fun showLoginError(msg: String) {
        binding.tvLoginError.text = msg
        binding.tvLoginError.visibility = View.VISIBLE
    }

    private fun setLoginLoading(loading: Boolean) {
        binding.btnLogin.isEnabled = !loading
        binding.btnLogin.text = if (loading) "Logging in…" else "Login"
    }

    private fun setSendOtpLoading(loading: Boolean) {
        binding.btnSendOtp.isEnabled = !loading
        binding.btnSendOtp.text = if (loading) "Sending…" else "Send OTP"
    }

    private fun setupOtpBoxes() {
        val boxes = listOf(
            binding.otp1, binding.otp2, binding.otp3,
            binding.otp4, binding.otp5, binding.otp6
        )
        boxes.forEachIndexed { i, box ->
            box.addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
                override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: android.text.Editable?) {
                    if (s?.length == 1 && i < boxes.size - 1) boxes[i+1].requestFocus()
                    else if (s?.isNotEmpty() == true && i == boxes.size - 1) binding.btnVerifyOtp.performClick()
                }
            })
            box.setOnKeyListener { _, keyCode, event ->
                if (keyCode == android.view.KeyEvent.KEYCODE_DEL && event.action == android.view.KeyEvent.ACTION_DOWN && box.text?.isEmpty() == true && i > 0) {
                    boxes[i-1].requestFocus(); boxes[i-1].text?.clear(); true
                } else false
            }
        }
    }

    private fun getOtpValue(): String {
        return listOf(
            binding.otp1, binding.otp2, binding.otp3,
            binding.otp4, binding.otp5, binding.otp6
        ).joinToString("") { it.text.toString() }
    }

    private fun clearOtpBoxes() {
        listOf(binding.otp1, binding.otp2, binding.otp3, binding.otp4, binding.otp5, binding.otp6).forEach { it.text?.clear() }
        binding.otp1.requestFocus()
    }

    private fun shakeOtpBoxes() {
        val anim = android.view.animation.AnimationUtils.loadAnimation(this, android.R.anim.cycle_interpolator)
        binding.otpContainer.startAnimation(anim)
    }

    private fun startResendTimer(seconds: Int) {
        resendJob?.cancel()
        binding.btnResendOtp.isEnabled = false
        var remaining = seconds
        resendJob = lifecycleScope.launch {
            while (remaining > 0) {
                withContext(Dispatchers.Main) { binding.tvResendTimer.text = " ($remaining s)" }
                delay(1000)
                remaining--
            }
            withContext(Dispatchers.Main) {
                binding.tvResendTimer.text = ""
                binding.btnResendOtp.isEnabled = true
            }
        }
    }
}
