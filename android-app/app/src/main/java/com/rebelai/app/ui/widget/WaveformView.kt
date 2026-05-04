package com.rebelai.app.ui.widget

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import kotlin.math.sin

class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyle: Int = 0,
) : View(context, attrs, defStyle) {

    private var amplitude = 10f
    private var targetAmplitude = 10f
    private var phase = 0f
    private var isActive = false

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = 3f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private val gradientColors = intArrayOf(
        Color.parseColor("#338A2BE2"),
        Color.parseColor("#CC00CED1"),
        Color.parseColor("#338A2BE2"),
    )

    private val runnable = object : Runnable {
        override fun run() {
            amplitude += (targetAmplitude - amplitude) * 0.12f
            phase += if (isActive) 0.08f else 0.025f
            invalidate()
            postDelayed(this, 16)
        }
    }

    init {
        post(runnable)
    }

    fun updateAmplitude(rms: Float) {
        isActive = rms > 0
        targetAmplitude = if (isActive) (5f + rms * 2f).coerceIn(5f, 60f) else 5f
    }

    fun setActive(active: Boolean) {
        isActive = active
        targetAmplitude = if (active) 30f else 5f
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0) return

        val shader = LinearGradient(0f, 0f, width.toFloat(), 0f, gradientColors, null, Shader.TileMode.CLAMP)
        paint.shader = shader

        val path = Path()
        var first = true
        for (x in 0..width step 2) {
            val ratio = x.toFloat() / width
            val y = height / 2f + sin(x * 0.02 + phase) * amplitude * sin(x * 0.01 + phase * 0.5)
            if (first) { path.moveTo(x.toFloat(), y); first = false }
            else path.lineTo(x.toFloat(), y)
        }
        canvas.drawPath(path, paint)

        // Second wave (softer)
        paint.alpha = 80
        val path2 = Path()
        first = true
        for (x in 0..width step 2) {
            val y = height / 2f + sin(x * 0.015 + phase * 1.3 + 1) * amplitude * 0.5f
            if (first) { path2.moveTo(x.toFloat(), y); first = false }
            else path2.lineTo(x.toFloat(), y)
        }
        canvas.drawPath(path2, paint)
        paint.alpha = 255
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        removeCallbacks(runnable)
    }
}
