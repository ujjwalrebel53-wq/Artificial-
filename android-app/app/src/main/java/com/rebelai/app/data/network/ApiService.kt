package com.rebelai.app.data.network

import com.rebelai.app.data.models.AIResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface RebelApiService {
    @GET("api/gpt-5")
    suspend fun ask(
        @Query("q") question: String,
        @Query("image") image: String? = null,
    ): Response<AIResponse>
}
