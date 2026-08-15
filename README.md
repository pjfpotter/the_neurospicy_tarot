# Selfie Sprite Games

An Android app that takes a selfie and uses it as a game sprite. First mini-game:
**Head Pong** — a classic Pong clone where the ball is your own face, bouncing
between two paddles.

## How it works

1. **Main screen** (`ui.MainActivity`) — take a selfie or jump into a game once
   you have one.
2. **Selfie capture** (`capture.SelfieCaptureActivity`) — uses CameraX with the
   front camera, a circular framing guide, and a retake/confirm flow. The photo
   is rotated/mirrored correctly, center-cropped to a square, downscaled, and
   stashed in `capture.SpriteRepository` (in-memory, since it's only needed for
   the current session and is too large to pass through an `Intent`).
3. **Head Pong** (`game.PongActivity` / `game.PongView`) — a `SurfaceView` with
   its own render thread. Your selfie is circle-cropped once and drawn as the
   ball. Drag anywhere to move your paddle; a simple CPU AI controls the other
   side. First to 5 points wins; tap to play again.

## Project layout

```
app/src/main/java/com/neurospicy/selfiegames/
  ui/MainActivity.kt
  capture/SelfieCaptureActivity.kt
  capture/SpriteRepository.kt
  capture/BitmapUtils.kt
  game/PongActivity.kt
  game/PongView.kt
app/src/main/res/            # layouts, colors, strings, launcher icon
```

## Building

This needs the Android SDK (compileSdk/targetSdk 34, minSdk 24), which isn't
available in the sandbox this was authored in — network access to
`dl.google.com` (the Google Maven repo that serves the Android Gradle Plugin
and AndroidX artifacts) is blocked there, so a build couldn't be verified in
this environment. To build locally:

```bash
# with Android Studio installed, or with `sdkmanager` on PATH:
./gradlew assembleDebug
```

Or open the project root in Android Studio (Koala+ recommended) and hit Run —
it will prompt to install any missing SDK components automatically.

## Adding more mini-games

`SpriteRepository.selfieSprite` holds the processed selfie bitmap; any new
game activity can read from it the same way `PongView` does
(`BitmapUtils.toCircle(...)` for a circular sprite, or use the square bitmap
directly). A natural next step is a menu of games in `MainActivity` instead of
a single "Play" button.
