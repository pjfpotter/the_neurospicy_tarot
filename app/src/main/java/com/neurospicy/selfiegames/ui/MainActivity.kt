package com.neurospicy.selfiegames.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.neurospicy.selfiegames.capture.SelfieCaptureActivity
import com.neurospicy.selfiegames.capture.SpriteRepository
import com.neurospicy.selfiegames.databinding.ActivityMainBinding
import com.neurospicy.selfiegames.game.PongActivity

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val captureSelfie = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) refreshSpriteState()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.takeSelfieButton.setOnClickListener {
            captureSelfie.launch(Intent(this, SelfieCaptureActivity::class.java))
        }
        binding.playButton.setOnClickListener {
            startActivity(Intent(this, PongActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        refreshSpriteState()
    }

    private fun refreshSpriteState() {
        val hasSprite = SpriteRepository.hasSprite()
        binding.playButton.isEnabled = hasSprite
        if (hasSprite) {
            binding.previewImage.setImageBitmap(SpriteRepository.selfieSprite)
        }
    }
}
