package com.neurospicy.selfiegames.capture

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader

object BitmapUtils {

    /** Rotates the bitmap by [degrees] and mirrors horizontally when [mirror] is set (front camera). */
    fun rotateAndMirror(source: Bitmap, degrees: Int, mirror: Boolean): Bitmap {
        val matrix = Matrix()
        if (mirror) matrix.postScale(-1f, 1f)
        matrix.postRotate(degrees.toFloat())
        val rotated = Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
        if (rotated !== source) source.recycle()
        return rotated
    }

    /** Center-crops the bitmap to a square. */
    fun cropToSquare(source: Bitmap): Bitmap {
        val size = minOf(source.width, source.height)
        val x = (source.width - size) / 2
        val y = (source.height - size) / 2
        val cropped = Bitmap.createBitmap(source, x, y, size, size)
        if (cropped !== source) source.recycle()
        return cropped
    }

    /** Downscales a square bitmap to [targetSize]x[targetSize] pixels. */
    fun downscale(source: Bitmap, targetSize: Int): Bitmap {
        if (source.width <= targetSize) return source
        val scaled = Bitmap.createScaledBitmap(source, targetSize, targetSize, true)
        if (scaled !== source) source.recycle()
        return scaled
    }

    /** Produces a circular-cropped copy of a square bitmap, used to render the sprite as a "head". */
    fun toCircle(source: Bitmap): Bitmap {
        val size = minOf(source.width, source.height)
        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        }
        val radius = size / 2f
        canvas.drawCircle(radius, radius, radius, paint)
        return output
    }
}
