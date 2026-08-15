package com.neurospicy.selfiegames.capture

import android.graphics.Bitmap

/**
 * Holds the most recently captured selfie sprite in memory for the current process.
 * A simple in-memory singleton is sufficient here: the sprite is only ever needed
 * within this app session, never persisted, and is too large to pass via Intent extras.
 */
object SpriteRepository {

    var selfieSprite: Bitmap? = null
        private set

    fun setSprite(bitmap: Bitmap) {
        selfieSprite?.let { old ->
            if (old !== bitmap && !old.isRecycled) {
                old.recycle()
            }
        }
        selfieSprite = bitmap
    }

    fun hasSprite(): Boolean = selfieSprite != null && selfieSprite?.isRecycled == false
}
