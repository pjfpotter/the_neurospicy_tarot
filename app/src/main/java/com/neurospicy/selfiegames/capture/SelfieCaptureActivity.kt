package com.neurospicy.selfiegames.capture

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.neurospicy.selfiegames.databinding.ActivitySelfieCaptureBinding

class SelfieCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySelfieCaptureBinding
    private var imageCapture: ImageCapture? = null
    private var pendingBitmap: Bitmap? = null

    private val requestCameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera() else showPermissionDenied()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySelfieCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.shutterButton.setOnClickListener { takePhoto() }
        binding.retakeButton.setOnClickListener { resetToPreview() }
        binding.useButton.setOnClickListener { useCapturedPhoto() }

        if (hasCameraPermission()) {
            startCamera()
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun hasCameraPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

    private fun showPermissionDenied() {
        binding.permissionText.text = getString(com.neurospicy.selfiegames.R.string.camera_permission_denied)
        binding.permissionText.visibility = android.view.View.VISIBLE
        binding.shutterButton.isEnabled = false
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.cameraPreview.surfaceProvider)
            }
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture)
            } catch (exc: Exception) {
                showPermissionDenied()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        capture.takePicture(
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    val bitmap = imageProxyToBitmap(image)
                    val rotationDegrees = image.imageInfo.rotationDegrees
                    image.close()

                    var processed = BitmapUtils.rotateAndMirror(bitmap, rotationDegrees, mirror = true)
                    processed = BitmapUtils.cropToSquare(processed)
                    processed = BitmapUtils.downscale(processed, TARGET_SPRITE_SIZE)

                    pendingBitmap = processed
                    showCapturedPreview(processed)
                }

                override fun onError(exception: ImageCaptureException) {
                    showPermissionDenied()
                }
            }
        )
    }

    private fun imageProxyToBitmap(image: ImageProxy): Bitmap {
        val buffer = image.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private fun showCapturedPreview(bitmap: Bitmap) {
        binding.cameraPreview.visibility = android.view.View.GONE
        binding.guideRing.visibility = android.view.View.GONE
        binding.capturedImage.visibility = android.view.View.VISIBLE
        binding.capturedImage.setImageBitmap(bitmap)

        binding.shutterButton.visibility = android.view.View.GONE
        binding.retakeButton.visibility = android.view.View.VISIBLE
        binding.useButton.visibility = android.view.View.VISIBLE
    }

    private fun resetToPreview() {
        pendingBitmap = null
        binding.capturedImage.visibility = android.view.View.GONE
        binding.cameraPreview.visibility = android.view.View.VISIBLE
        binding.guideRing.visibility = android.view.View.VISIBLE

        binding.shutterButton.visibility = android.view.View.VISIBLE
        binding.retakeButton.visibility = android.view.View.GONE
        binding.useButton.visibility = android.view.View.GONE
    }

    private fun useCapturedPhoto() {
        val bitmap = pendingBitmap ?: return
        SpriteRepository.setSprite(bitmap)
        setResult(RESULT_OK)
        finish()
    }

    companion object {
        private const val TARGET_SPRITE_SIZE = 256
    }
}
