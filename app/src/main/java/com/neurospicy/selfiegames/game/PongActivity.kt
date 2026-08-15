package com.neurospicy.selfiegames.game

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.neurospicy.selfiegames.databinding.ActivityPongBinding

class PongActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPongBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPongBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }
}
