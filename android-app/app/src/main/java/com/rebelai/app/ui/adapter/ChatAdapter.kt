package com.rebelai.app.ui.adapter

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.BitmapFactory
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.rebelai.app.data.models.ChatMessage
import com.rebelai.app.data.models.MessageRole
import com.rebelai.app.databinding.ItemMsgAiBinding
import com.rebelai.app.databinding.ItemMsgUserBinding
import com.rebelai.app.databinding.ItemMsgThinkingBinding
import io.noties.markwon.Markwon
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin
import io.noties.markwon.ext.tables.TablePlugin
import io.noties.markwon.html.HtmlPlugin
import java.text.SimpleDateFormat
import java.util.*

class ChatAdapter(
    private val onCopy: (ChatMessage) -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val TYPE_USER     = 0
        const val TYPE_AI       = 1
        const val TYPE_THINKING = 2
    }

    private val messages = mutableListOf<ChatMessage>()
    private var showThinking = false
    private lateinit var markwon: Markwon

    fun initMarkwon(context: Context) {
        markwon = Markwon.builder(context)
            .usePlugin(StrikethroughPlugin.create())
            .usePlugin(TablePlugin.create(context))
            .usePlugin(HtmlPlugin.create())
            .build()
    }

    fun setData(data: List<ChatMessage>) {
        messages.clear()
        messages.addAll(data)
        notifyDataSetChanged()
    }

    fun addMessage(msg: ChatMessage) {
        messages.add(msg)
        notifyItemInserted(messages.size - 1)
    }

    fun clear() {
        messages.clear()
        showThinking = false
        notifyDataSetChanged()
    }

    fun setThinking(thinking: Boolean) {
        val wasThinking = showThinking
        showThinking = thinking
        if (!wasThinking && thinking) notifyItemInserted(messages.size)
        else if (wasThinking && !thinking) notifyItemRemoved(messages.size)
    }

    override fun getItemCount() = messages.size + if (showThinking) 1 else 0

    override fun getItemViewType(position: Int): Int {
        if (showThinking && position == messages.size) return TYPE_THINKING
        return if (messages[position].role == MessageRole.USER) TYPE_USER else TYPE_AI
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        if (!::markwon.isInitialized) initMarkwon(parent.context)
        return when (viewType) {
            TYPE_USER     -> UserVH(ItemMsgUserBinding.inflate(inflater, parent, false))
            TYPE_THINKING -> ThinkingVH(ItemMsgThinkingBinding.inflate(inflater, parent, false))
            else          -> AiVH(ItemMsgAiBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        if (holder is ThinkingVH) return
        val msg = messages[position]
        val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(msg.timestamp))
        when (holder) {
            is UserVH -> holder.bind(msg, timeStr)
            is AiVH   -> holder.bind(msg, timeStr, markwon, onCopy)
        }
    }

    inner class UserVH(val b: ItemMsgUserBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(msg: ChatMessage, time: String) {
            b.tvTime.text = time
            if (msg.content.isNotBlank()) {
                b.tvMessage.text = msg.content
                b.tvMessage.visibility = View.VISIBLE
            } else {
                b.tvMessage.visibility = View.GONE
            }
            msg.imageBase64?.let { b64 ->
                try {
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    b.ivImage.setImageBitmap(bmp)
                    b.ivImage.visibility = View.VISIBLE
                } catch (e: Exception) { b.ivImage.visibility = View.GONE }
            } ?: run { b.ivImage.visibility = View.GONE }
        }
    }

    inner class AiVH(val b: ItemMsgAiBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(msg: ChatMessage, time: String, markwon: Markwon, onCopy: (ChatMessage) -> Unit) {
            b.tvTime.text = time
            markwon.setMarkdown(b.tvMessage, msg.content)
            b.btnCopy.setOnClickListener { onCopy(msg) }
            b.btnThumbUp.setOnClickListener {
                b.btnThumbUp.animate().scaleX(1.3f).scaleY(1.3f).setDuration(150)
                    .withEndAction { b.btnThumbUp.animate().scaleX(1f).scaleY(1f).setDuration(150).start() }.start()
            }
            if (msg.responseTimeMs > 0) {
                b.tvResponseTime.text = "${msg.responseTimeMs}ms"
                b.tvResponseTime.visibility = View.VISIBLE
            } else {
                b.tvResponseTime.visibility = View.GONE
            }
        }
    }

    inner class ThinkingVH(val b: ItemMsgThinkingBinding) : RecyclerView.ViewHolder(b.root)
}
