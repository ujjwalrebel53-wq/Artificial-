package com.rebelai.app.data.db

import android.content.Context
import androidx.room.*
import com.rebelai.app.data.models.ChatMessage
import com.rebelai.app.data.models.Conversation
import com.rebelai.app.data.models.MessageRole
import com.rebelai.app.data.models.MessageType

class Converters {
    @TypeConverter fun roleToString(role: MessageRole): String = role.name
    @TypeConverter fun stringToRole(s: String): MessageRole = MessageRole.valueOf(s)
    @TypeConverter fun typeToString(type: MessageType): String = type.name
    @TypeConverter fun stringToType(s: String): MessageType = MessageType.valueOf(s)
}

@Dao
interface ConversationDao {
    @Query("SELECT * FROM conversations ORDER BY isPinned DESC, updatedAt DESC")
    suspend fun getAll(): List<Conversation>

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun getById(id: Long): Conversation?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(conv: Conversation): Long

    @Update
    suspend fun update(conv: Conversation)

    @Delete
    suspend fun delete(conv: Conversation)

    @Query("DELETE FROM conversations")
    suspend fun deleteAll()
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE conversationId = :convId ORDER BY timestamp ASC")
    suspend fun getByConversation(convId: Long): List<ChatMessage>

    @Query("SELECT * FROM messages WHERE conversationId = :convId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastMessage(convId: Long): ChatMessage?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(msg: ChatMessage): Long

    @Delete
    suspend fun delete(msg: ChatMessage)

    @Query("DELETE FROM messages WHERE conversationId = :convId")
    suspend fun deleteByConversation(convId: Long)

    @Query("DELETE FROM messages")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM messages WHERE conversationId = :convId")
    suspend fun countByConversation(convId: Long): Int
}

@Database(
    entities = [ChatMessage::class, Conversation::class],
    version = 1,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "rebel_ai.db")
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
