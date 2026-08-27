package dev.ngocdevv.nativebottomsheet

import kotlin.math.exp
import kotlin.math.max

/** Critically damped spring (ζ = 1). Same closed form as the iOS engine. */
internal class CriticalSpring(
  val from: Float,
  val target: Float,
  val v0: Float,
  val omega: Float,
  val durationMs: Long,
) {
  fun valueAtElapsed(elapsedSeconds: Float): Float {
    val t = max(0f, elapsedSeconds)
    val a = from - target
    val decay = exp((-omega * t).toDouble()).toFloat()
    return target + decay * (a + (v0 + omega * a) * t)
  }

  fun velocityAtElapsed(elapsedSeconds: Float): Float {
    val t = max(0f, elapsedSeconds)
    val a = from - target
    val b = v0 + omega * a
    return exp((-omega * t).toDouble()).toFloat() * (v0 - omega * b * t)
  }
}
