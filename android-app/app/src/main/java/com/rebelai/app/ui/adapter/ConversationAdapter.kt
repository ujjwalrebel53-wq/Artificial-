package com.rebelai.app.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.rebelai.app.data.models.Conversation
import com.rebelai.app.databinding.ItemConversationBinding
import java.text.SimpleDateFormat
import java.util.*

class ConversationAdapter(
    private val onClick: (Conversation) -> Unit,
) : RecyclerView.Adapter<ConversationAdapter.VH>() {

    private val items = mutableListOf<Conversation>()
    private var selectedId = -1L

    fun setData(data: List<Conversation>) {
        items.clear()
        items.addAll(data)
        notifyDataSetChanged()
    }

    fun setSelected(id: Long) {
        selectedId = id
        notifyDataSetChanged()
    }

    override fun getItemCount() = items.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemConversationBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val conv = items[position]
        with(holder.b) {
            tvTitle.text = conv.title
            val df = SimpleDateFormat("HH:mm", Locale.getDefault())
            val now = Calendar.getInstance()
            val convCal = Calendar.getInstance().apply { timeInMillis = conv.updatedAt }
            tvTime.text = if (now.get(Calendar.DATE) == convCal.get(Calendar.DATE)) {
                df.format(Date(conv.updatedAt))
            } else {
                SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(conv.updatedAt))
            }
            root.isSelected = conv.id == selectedId
            root.setOnClickListener { selectedId = conv.id; notifyDataSetChanged(); onClick(conv) }
        }
    }

    inner class VH(val b: ItemConversationBinding) : RecyclerView.ViewHolder(b.root)
}
