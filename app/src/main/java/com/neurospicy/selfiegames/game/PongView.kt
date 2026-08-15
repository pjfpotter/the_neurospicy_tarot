package com.neurospicy.selfiegames.game

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.core.content.ContextCompat
import com.neurospicy.selfiegames.R
import com.neurospicy.selfiegames.capture.BitmapUtils
import com.neurospicy.selfiegames.capture.SpriteRepository
import kotlin.math.abs
import kotlin.random.Random

/**
 * A self-contained Pong implementation rendered on a dedicated game thread.
 * The ball is the player's own selfie, cropped into a circular "head" sprite.
 */
class PongView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : SurfaceView(context, attrs), SurfaceHolder.Callback {

    private var gameThread: GameThread? = null

    // Playfield state, all in pixels, initialized once the surface has a size.
    private var fieldWidth = 0f
    private var fieldHeight = 0f

    private var paddleWidth = 0f
    private var paddleHeight = 0f
    private var playerPaddleY = 0f
    private var cpuPaddleY = 0f
    private var playerTargetY = 0f

    private var ballX = 0f
    private var ballY = 0f
    private var ballVX = 0f
    private var ballVY = 0f
    private var ballRadius = 0f

    private var playerScore = 0
    private var cpuScore = 0
    private var gameOver = false

    private var headSprite: Bitmap? = null

    private val paddlePaint = Paint().apply {
        color = ContextCompat.getColor(context, R.color.paddle_color)
        isAntiAlias = true
    }
    private val linePaint = Paint().apply {
        color = ContextCompat.getColor(context, R.color.court_line)
        strokeWidth = 4f
        isAntiAlias = true
    }
    private val scorePaint = Paint().apply {
        color = Color.WHITE
        textSize = 72f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
        alpha = 200
    }
    private val messagePaint = Paint().apply {
        color = Color.WHITE
        textSize = 56f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }
    private val backgroundPaint = Paint().apply {
        color = ContextCompat.getColor(context, R.color.bg_dark)
    }

    init {
        holder.addCallback(this)
        isFocusable = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        loadSprite()
        gameThread = GameThread(holder).also { it.start() }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        setupField(width.toFloat(), height.toFloat())
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        gameThread?.stopLoop()
        gameThread = null
    }

    private fun loadSprite() {
        val sprite = SpriteRepository.selfieSprite
        headSprite = if (sprite != null) BitmapUtils.toCircle(sprite) else null
    }

    private fun setupField(width: Float, height: Float) {
        fieldWidth = width
        fieldHeight = height
        paddleWidth = width * 0.03f
        paddleHeight = height * 0.16f
        ballRadius = width * 0.07f

        playerPaddleY = height / 2f - paddleHeight / 2f
        cpuPaddleY = height / 2f - paddleHeight / 2f
        playerTargetY = playerPaddleY

        resetBall(towardsPlayer = Random.nextBoolean())
    }

    private fun resetBall(towardsPlayer: Boolean) {
        ballX = fieldWidth / 2f
        ballY = fieldHeight / 2f
        val speed = fieldWidth * 0.012f
        ballVX = speed * (if (towardsPlayer) -1f else 1f)
        ballVY = speed * (if (Random.nextBoolean()) 1f else -1f) * (0.5f + Random.nextFloat())
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                if (gameOver) {
                    restartGame()
                } else {
                    playerTargetY = (event.y - paddleHeight / 2f)
                        .coerceIn(0f, fieldHeight - paddleHeight)
                }
            }
        }
        return true
    }

    private fun restartGame() {
        playerScore = 0
        cpuScore = 0
        gameOver = false
        setupField(fieldWidth, fieldHeight)
    }

    private fun update() {
        if (fieldWidth == 0f || gameOver) return

        // Smoothly ease the player paddle toward the touch target.
        playerPaddleY += (playerTargetY - playerPaddleY) * 0.35f

        // Simple CPU AI: track the ball with limited speed and slight lag.
        val cpuCenter = cpuPaddleY + paddleHeight / 2f
        val cpuMaxSpeed = fieldHeight * 0.018f
        val delta = (ballY - cpuCenter).coerceIn(-cpuMaxSpeed, cpuMaxSpeed)
        cpuPaddleY = (cpuPaddleY + delta).coerceIn(0f, fieldHeight - paddleHeight)

        ballX += ballVX
        ballY += ballVY

        // Bounce off top/bottom walls.
        if (ballY - ballRadius < 0f) {
            ballY = ballRadius
            ballVY = abs(ballVY)
        } else if (ballY + ballRadius > fieldHeight) {
            ballY = fieldHeight - ballRadius
            ballVY = -abs(ballVY)
        }

        val playerPaddleX = paddleWidth
        val cpuPaddleX = fieldWidth - paddleWidth * 2f

        // Player paddle collision (left side).
        if (ballVX < 0 &&
            ballX - ballRadius < playerPaddleX + paddleWidth &&
            ballX - ballRadius > playerPaddleX - paddleWidth &&
            ballY + ballRadius > playerPaddleY &&
            ballY - ballRadius < playerPaddleY + paddleHeight
        ) {
            ballX = playerPaddleX + paddleWidth + ballRadius
            bounceOffPaddle(playerPaddleY, toRight = true)
        }

        // CPU paddle collision (right side).
        if (ballVX > 0 &&
            ballX + ballRadius > cpuPaddleX &&
            ballX + ballRadius < cpuPaddleX + paddleWidth * 2f &&
            ballY + ballRadius > cpuPaddleY &&
            ballY - ballRadius < cpuPaddleY + paddleHeight
        ) {
            ballX = cpuPaddleX - ballRadius
            bounceOffPaddle(cpuPaddleY, toRight = false)
        }

        // Scoring.
        if (ballX + ballRadius < 0f) {
            cpuScore++
            checkGameOver()
            if (!gameOver) resetBall(towardsPlayer = false)
        } else if (ballX - ballRadius > fieldWidth) {
            playerScore++
            checkGameOver()
            if (!gameOver) resetBall(towardsPlayer = true)
        }
    }

    private fun bounceOffPaddle(paddleY: Float, toRight: Boolean) {
        val relativeIntersect = ((ballY - paddleY) / paddleHeight) - 0.5f
        val speed = kotlin.math.hypot(ballVX.toDouble(), ballVY.toDouble()).toFloat() * 1.05f
        ballVY = relativeIntersect * speed
        val horizontalMagnitude = kotlin.math.sqrt((speed * speed - ballVY * ballVY).coerceAtLeast(0f))
        ballVX = if (toRight) horizontalMagnitude else -horizontalMagnitude
        if (ballVX == 0f) ballVX = (if (toRight) 1f else -1f) * speed
    }

    private fun checkGameOver() {
        if (playerScore >= WINNING_SCORE || cpuScore >= WINNING_SCORE) {
            gameOver = true
        }
    }

    private fun render(canvas: Canvas) {
        canvas.drawRect(0f, 0f, fieldWidth, fieldHeight, backgroundPaint)

        // Center dashed line.
        var y = 0f
        while (y < fieldHeight) {
            canvas.drawLine(fieldWidth / 2f, y, fieldWidth / 2f, y + 24f, linePaint)
            y += 44f
        }

        canvas.drawRect(paddleWidth, playerPaddleY, paddleWidth * 2f, playerPaddleY + paddleHeight, paddlePaint)
        canvas.drawRect(
            fieldWidth - paddleWidth * 2f, cpuPaddleY,
            fieldWidth - paddleWidth, cpuPaddleY + paddleHeight, paddlePaint
        )

        drawBall(canvas)

        canvas.drawText(playerScore.toString(), fieldWidth / 2f - 80f, 110f, scorePaint)
        canvas.drawText(cpuScore.toString(), fieldWidth / 2f + 80f, 110f, scorePaint)

        if (gameOver) {
            val message = if (playerScore > cpuScore) {
                context.getString(R.string.winner_you)
            } else {
                context.getString(R.string.winner_cpu)
            }
            canvas.drawText(message, fieldWidth / 2f, fieldHeight / 2f, messagePaint)
            canvas.drawText(
                context.getString(R.string.btn_play_again),
                fieldWidth / 2f, fieldHeight / 2f + 70f, messagePaint
            )
        }
    }

    private fun drawBall(canvas: Canvas) {
        val sprite = headSprite
        if (sprite != null) {
            val dst = Rect(
                (ballX - ballRadius).toInt(), (ballY - ballRadius).toInt(),
                (ballX + ballRadius).toInt(), (ballY + ballRadius).toInt()
            )
            canvas.drawBitmap(sprite, null, dst, null)
        } else {
            canvas.drawCircle(ballX, ballY, ballRadius, paddlePaint)
        }
    }

    private inner class GameThread(private val surfaceHolder: SurfaceHolder) : Thread() {
        @Volatile private var running = true

        fun stopLoop() {
            running = false
            try { join() } catch (_: InterruptedException) { }
        }

        override fun run() {
            var lastTime = System.nanoTime()
            val frameTimeNanos = 1_000_000_000L / 60L
            while (running) {
                val now = System.nanoTime()
                if (now - lastTime >= frameTimeNanos) {
                    lastTime = now
                    update()
                    val canvas = surfaceHolder.lockCanvas() ?: continue
                    try {
                        render(canvas)
                    } finally {
                        surfaceHolder.unlockCanvasAndPost(canvas)
                    }
                } else {
                    sleep(1)
                }
            }
        }
    }

    companion object {
        private const val WINNING_SCORE = 5
    }
}
