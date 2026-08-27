package dev.ngocdevv.nativebottomsheet

import android.annotation.SuppressLint
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import androidx.core.view.NestedScrollingChild
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

internal enum class DetentKind {
  POINTS,
  PERCENTAGE,
  CONTENT,
}

internal data class RawDetentSpec(
  val value: Float,
  val kind: DetentKind,
  val programmatic: Boolean,
)

internal data class DetentSpec(
  val height: Float,
  val programmatic: Boolean,
)

internal class BottomSheetHostView(context: Context) : FrameLayout(context) {
  interface Listener {
    fun emitIndexChange(index: Int)
    fun emitSettle(index: Int)
    fun emitPositionChange(position: Float, index: Float)
    fun emitKeyboardChange(height: Float)
  }

  var listener: Listener? = null
  var modal: Boolean = false
    set(value) {
      field = value
      updateScrim()
    }
  var animateIn: Boolean = true
  var animateContentHeight: Boolean = true
  var positionEventsEnabled: Boolean = false
  var dragEnabled: Boolean = true
    set(value) {
      field = value
      if (!value) {
        isPanning = false
        panStartingIndex = null
        activeDragRange = null
      }
    }
  var extendUnderStatusBar: Boolean = false
  var scrollableExpandNegotiation: Int = 2
  var scrollableCollapseNegotiation: Int = 1
  var hasSurface: Boolean = false
  var dismissible: Boolean = true
  /** 0 none, 1 extend content detent, 2 stick (emit only). */
  var keyboardBehavior: Int = 0
    set(value) {
      if (field != value) {
        field = value
        cancelDeferredContentHeightRefresh()
        refreshDetentsFromLayout()
        requestLayout()
      }
    }
  var keyboardInset: Float = 0f
    private set(value) {
      val changed = abs(field - value) > 0.5f
      field = value
      if (changed) {
        listener?.emitKeyboardChange(value)
      }
      if (keyboardBehavior != 1) return
      val hadDeferredContentHeight = cancelDeferredContentHeightRefresh()
      if (!changed && !hadDeferredContentHeight) return
      refreshDetentsFromLayout()
      requestLayout()
    }
  var jsContentHeight: Float = -1f
    private set

  /** React Native reports layout in dp; the engine stores pixels. */
  fun setJsContentHeightDp(dpValue: Float) {
    val px = dp(dpValue)
    val previous = jsContentHeight
    jsContentHeight = px
    if (abs(previous - px) > 0.5f) {
      if (shouldDeferContentHeightRefresh()) {
        scheduleDeferredContentHeightRefresh()
        return
      }
      cancelDeferredContentHeightRefresh()
      refreshDetentsFromLayout()
      requestLayout()
    }
  }

  private fun dp(value: Float): Float = value * resources.displayMetrics.density

  private val scrimView = View(context).apply {
    background = ColorDrawable(Color.argb(115, 0, 0, 0))
    alpha = 0f
    visibility = GONE
    isClickable = true
    setOnClickListener { handleScrimPress() }
  }
  val sheetContainer = FrameLayout(context).apply {
    clipChildren = false
    clipToPadding = false
  }
  private val sheetBackground = View(context).apply {
    setBackgroundColor(Color.TRANSPARENT)
  }

  private var rawDetentSpecs: List<RawDetentSpec> = emptyList()
  private var detentSpecs: List<DetentSpec> = emptyList()
  private var targetIndex = 0
  private var pendingIndex: Int? = null
  private var hasLaidOut = false
  private var isPanning = false
  private var lastAppliedMaxDetentHeight = Float.NaN
  private var activeSpring: CriticalSpring? = null
  private var activeSpringAnimator: ValueAnimator? = null
  private var activeSpringTargetIndex = 0
  private var activeSpringEmitsSettle = false
  private var scrimOpacities: List<Float> = listOf(1f)
  private var scrimPinnedFull = false
  private var pinScrimToTarget = false
  private var panStartingIndex: Int? = null
  private var activeDragRange: Pair<Float, Float>? = null
  private var translationYInternal = 0f
  private var lastTouchY = 0f
  private var lastTouchTime = 0L
  private var velocityY = 0f
  private var didMoveSheetDuringPan = false
  private var nestedScrollChild: View? = null
  private var panCoordinationIsSheet = true
  private var isContentHeightRefreshDeferred = false
  private var lastObservedSheetEditorFocus = false
  private var lastObservedSheetContainsEditor = false

  private val deferredContentHeightRunnable = Runnable { flushDeferredContentHeightRefresh() }

  init {
    clipChildren = false
    clipToPadding = false
    setBackgroundColor(android.graphics.Color.TRANSPARENT)
    addView(scrimView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(
      sheetContainer,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.BOTTOM),
    )
    sheetContainer.addView(
      sheetBackground,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    val topCornerOutline =
      object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
          if (view.width <= 0 || view.height <= 0) {
            outline.setEmpty()
            return
          }
          // Extend the rect below the view so only the top corners are rounded.
          outline.setRoundRect(0, 0, view.width, view.height + view.height, sheetCornerRadius)
        }
      }
    sheetContainer.outlineProvider = topCornerOutline
    sheetContainer.clipToOutline = true
    sheetContainer.clipChildren = true
    sheetBackground.outlineProvider = topCornerOutline
    sheetBackground.clipToOutline = true
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
      keyboardInset = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom.toFloat()
      insets
    }
    ViewCompat.requestApplyInsets(this)
  }

  private var sheetCornerRadius = 28f * resources.displayMetrics.density
    set(value) {
      field = value
      sheetContainer.invalidateOutline()
      sheetBackground.invalidateOutline()
    }

  fun setSheetCornerRadiusDp(dp: Float) {
    sheetCornerRadius = dp * resources.displayMetrics.density
  }

  fun setSheetBackgroundColor(color: Int?) {
    sheetBackground.setBackgroundColor(color ?: Color.TRANSPARENT)
  }

  fun setScrimColor(color: Int?) {
    scrimView.background = ColorDrawable(color ?: Color.argb(115, 0, 0, 0))
  }

  fun setScrimOpacities(values: List<Float>) {
    scrimOpacities = if (values.isEmpty()) listOf(1f) else values
    updateScrim()
  }

  fun setDetents(raw: List<RawDetentSpec>) {
    rawDetentSpecs =
      raw.map { spec ->
        if (spec.kind == DetentKind.POINTS) spec.copy(value = dp(spec.value)) else spec
      }
    refreshDetentsFromLayout()
  }

  fun setDetentIndex(newIndex: Int) {
    if (newIndex < 0) return
    if (!hasLaidOut) {
      pendingIndex = newIndex
      targetIndex = newIndex
      return
    }
    if (newIndex >= detentSpecs.size) return
    val alreadyThere =
      newIndex == targetIndex &&
        activeSpring == null &&
        abs(translationYInternal - translationY(newIndex)) <= 1f
    if (alreadyThere) return
    // A delayed content refresh belongs to the detent we are leaving. Letting
    // it fire during this snap would cancel and restart the new animation.
    cancelDeferredContentHeightRefresh()
    snapToIndex(newIndex, 0f, emitIndexChange = false)
  }

  fun addSheetChild(child: View, index: Int) {
    val insertAt = min(max(index + 1, 1), sheetContainer.childCount)
    sheetContainer.addView(child, insertAt)
  }

  fun removeSheetChild(child: View) {
    sheetContainer.removeView(child)
  }

  val sheetChildCount: Int
    get() = max(0, sheetContainer.childCount - 1)

  fun getSheetChildAt(index: Int): View? {
    val actual = index + 1
    return if (actual in 0 until sheetContainer.childCount) sheetContainer.getChildAt(actual) else null
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    if (width <= 0 || height <= 0) return
    refreshDetentsFromLayout()
    val maxHeight = sheetContainerHeight()
    lastAppliedMaxDetentHeight = maxHeight
    val containerTop = height - maxHeight.toInt()
    sheetContainer.layout(0, containerTop, width, height)
    sheetBackground.layout(0, 0, sheetContainer.width, sheetContainer.height)
    sheetContainer.invalidateOutline()
    sheetBackground.invalidateOutline()
    layoutSheetChildren()

    if (!hasLaidOut && detentSpecs.isNotEmpty()) {
      val indexToApply = pendingIndex ?: targetIndex
      val clamped = indexToApply.coerceIn(0, detentSpecs.lastIndex)
      hasLaidOut = true
      pendingIndex = null
      targetIndex = clamped
      if (animateIn) {
        applyTranslation(maxHeight)
        emitPosition(maxHeight)
        snapToIndex(targetIndex, 0f, emitIndexChange = false, emitSettle = true)
      } else {
        applyTranslation(translationY(targetIndex))
        emitPosition()
      }
      return
    }

    if (activeSpring != null || isPanning) return
    applyTranslation(translationY(targetIndex))
    updateScrim()
  }

  private fun layoutSheetChildren() {
    val children = sheetChildren()
    val surface = if (hasSurface) children.firstOrNull() else null
    surface?.layout(0, 0, sheetContainer.width, sheetContainer.height)
    for (child in children) {
      if (child === surface) continue
      val childHeight = max(child.measuredHeight, child.height)
      if (childHeight <= 0) continue
      child.layout(0, 0, sheetContainer.width, childHeight)
    }
  }

  private fun sheetChildren(): List<View> =
    (0 until sheetContainer.childCount)
      .map { sheetContainer.getChildAt(it) }
      .filter { it !== sheetBackground }

  private fun sheetContainerHeight(): Float {
    val insets = ViewCompat.getRootWindowInsets(this)
    val topInset =
      if (extendUnderStatusBar) 0f
      else insets?.systemWindowInsetTop?.toFloat() ?: 0f
    return max(0f, height - topInset)
  }

  private fun bottomInset(): Float {
    val insets = ViewCompat.getRootWindowInsets(this) ?: return 0f
    return insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom.toFloat()
  }

  private fun validContentHeight(): Float? {
    val raw =
      if (jsContentHeight >= 0f) jsContentHeight
      else {
        val measured = measuredNativeContentHeight()
        if (measured > 0.5f) measured else return null
      }
    val extra = if (keyboardBehavior == 1) keyboardInset else 0f
    return raw + bottomInset() + extra
  }

  private fun measuredNativeContentHeight(): Float =
    sheetChildren()
      .filterIndexed { index, _ -> !(hasSurface && index == 0) }
      .maxOfOrNull { child ->
        max(child.bottom, max(child.measuredHeight, child.height)).toFloat()
      } ?: 0f

  private fun resolveDetentSpecs(): List<DetentSpec>? {
    val maxHeight = sheetContainerHeight()
    val measured = if (maxHeight > 0) validContentHeight()?.let { min(it, maxHeight) } else null
    val resolved = mutableListOf<DetentSpec>()
    rawDetentSpecs.forEachIndexed { index, spec ->
      val height = when (spec.kind) {
        DetentKind.POINTS -> spec.value
        DetentKind.PERCENTAGE -> maxHeight * spec.value
        DetentKind.CONTENT -> {
          val lowerBound = resolved.lastOrNull()?.height ?: 0f
          val upperBound = max(lowerBound, unresolvedContent(index, maxHeight))
          (measured ?: upperBound).coerceIn(lowerBound, upperBound)
        }
      }
      val resolvedHeight = min(max(0f, height), maxHeight)
      if (resolved.isNotEmpty() && resolvedHeight < resolved.last().height) return null
      resolved += DetentSpec(resolvedHeight, spec.programmatic)
    }
    return resolved
  }

  private fun unresolvedContent(index: Int, maxHeight: Float): Float {
    for (spec in rawDetentSpecs.drop(index + 1)) {
      when (spec.kind) {
        DetentKind.POINTS -> return min(max(0f, spec.value), maxHeight)
        DetentKind.PERCENTAGE -> return min(max(0f, maxHeight * spec.value), maxHeight)
        DetentKind.CONTENT -> Unit
      }
    }
    return maxHeight
  }

  /**
   * A page layout can land just before an editor focuses and the IME inset
   * arrives. Hold only that first update. Gating on `keyboardBehavior ==
   * extend` alone throttles a continuous 60fps stream to one update every
   * three frames, which is visible as a ~20fps sheet edge.
   */
  private fun shouldDeferContentHeightRefresh(): Boolean {
    if (
      keyboardBehavior != 1 ||
        !hasLaidOut ||
        isPanning ||
        rawDetentSpecs.getOrNull(targetIndex)?.kind != DetentKind.CONTENT
    ) {
      return false
    }

    val editorFocused = sheetContainer.findFocus()?.onCheckIsTextEditor() == true
    val containsEditor = containsTextEditor(sheetContainer)
    val focusChanged = editorFocused != lastObservedSheetEditorFocus
    val editorPresenceChanged = containsEditor != lastObservedSheetContainsEditor
    lastObservedSheetEditorFocus = editorFocused
    lastObservedSheetContainsEditor = containsEditor
    val keyboardVisible = keyboardInset > 0.5f
    return (focusChanged && editorFocused != keyboardVisible) ||
      (editorPresenceChanged && containsEditor && !keyboardVisible)
  }

  private fun containsTextEditor(view: View): Boolean {
    if (view.onCheckIsTextEditor()) return true
    if (view !is ViewGroup) return false
    return (0 until view.childCount).any { containsTextEditor(view.getChildAt(it)) }
  }

  private fun scheduleDeferredContentHeightRefresh() {
    if (isContentHeightRefreshDeferred) return
    isContentHeightRefreshDeferred = true
    removeCallbacks(deferredContentHeightRunnable)
    postDelayed(deferredContentHeightRunnable, CONTENT_HEIGHT_REFRESH_DELAY_MS)
  }

  private fun cancelDeferredContentHeightRefresh(): Boolean {
    val wasDeferred = isContentHeightRefreshDeferred
    isContentHeightRefreshDeferred = false
    removeCallbacks(deferredContentHeightRunnable)
    return wasDeferred
  }

  private fun flushDeferredContentHeightRefresh() {
    if (!cancelDeferredContentHeightRefresh()) return
    refreshDetentsFromLayout()
    requestLayout()
  }

  private fun refreshDetentsFromLayout() {
    if (isContentHeightRefreshDeferred) {
      updateScrim()
      return
    }
    val resolved = resolveDetentSpecs() ?: run {
      updateScrim()
      return
    }
    if (resolved == detentSpecs && sheetContainerHeight() == lastAppliedMaxDetentHeight) {
      updateScrim()
      return
    }
    val previousMax =
      if (lastAppliedMaxDetentHeight.isFinite()) lastAppliedMaxDetentHeight else sheetContainerHeight()
    detentSpecs = resolved
    if (width <= 0 || height <= 0 || detentSpecs.isEmpty()) return
    if (hasLaidOut && !isPanning) {
      targetIndex = targetIndex.coerceIn(0, detentSpecs.lastIndex)
      val newMax = sheetContainerHeight()
      val targetTy = translationY(targetIndex)
      if (activeSpring != null) {
        val shouldPinScrim = scrimIsAtTargetOpacity(targetIndex)
        val emitSettle = activeSpringEmitsSettle
        val springVelocity = activeSpring?.velocityAtElapsed(activeSpringElapsedSeconds()) ?: 0f
        val visualTy = cancelActiveSpring()
        val visible = previousMax - visualTy
        applyTranslation(min(max(newMax - visible, 0f), newMax))
        emitPosition()
        snapToIndex(
          targetIndex,
          springVelocity,
          emitIndexChange = false,
          emitSettle = emitSettle,
          pinScrim = shouldPinScrim,
          preserveVelocity = true,
        )
      } else {
        val visible = previousMax - translationYInternal
        val targetHeight = detentAt(targetIndex).height
        val shouldAnimate =
          animateContentHeight &&
            systemAnimatorsEnabled() &&
            rawDetentSpecs.getOrNull(targetIndex)?.kind == DetentKind.CONTENT
        if (abs(targetHeight - visible) <= 0.5f || !shouldAnimate) {
          applyTranslation(targetTy)
          emitPosition()
          pinScrimToTarget = false
        } else {
          val shouldPinScrim = scrimIsAtTargetOpacity(targetIndex)
          applyTranslation(min(max(newMax - visible, 0f), newMax))
          snapToIndex(
            targetIndex,
            0f,
            emitIndexChange = false,
            pinScrim = shouldPinScrim,
          )
        }
      }
    }
  }

  private fun detentAt(index: Int): DetentSpec =
    detentSpecs.getOrNull(index) ?: DetentSpec(0f, false)

  private fun translationY(index: Int): Float = sheetContainerHeight() - detentAt(index).height

  private fun applyTranslation(ty: Float) {
    translationYInternal = ty
    sheetContainer.translationY = ty
  }

  private fun snapCandidateIndices(including: Int?): List<Int> {
    val indices = detentSpecs.indices.filter { !detentSpecs[it].programmatic }.toMutableList()
    if (including != null && including in detentSpecs.indices && detentSpecs[including].programmatic) {
      indices += including
    }
    return indices.distinct().sortedBy { detentSpecs[it].height }
  }

  private fun draggableRange(including: Int?): Pair<Float, Float> {
    val candidates = snapCandidateIndices(including)
    if (candidates.isEmpty()) return 0f to 0f
    val translations = candidates.map { translationY(it) }
    return (translations.minOrNull() ?: 0f) to (translations.maxOrNull() ?: 0f)
  }

  private fun bestSnapIndex(height: Float, velocity: Float, including: Int?): Int {
    val candidates = snapCandidateIndices(including)
    if (candidates.isEmpty()) return targetIndex
    val flick = 600f
    if (velocity < -flick) {
      return candidates.firstOrNull { detentSpecs[it].height > height } ?: candidates.last()
    }
    if (velocity > flick) {
      return candidates.lastOrNull { detentSpecs[it].height < height } ?: candidates.first()
    }
    return candidates.minBy { abs(detentSpecs[it].height - height) }
  }

  private fun snapToIndex(
    index: Int,
    velocity: Float,
    emitIndexChange: Boolean = true,
    emitSettle: Boolean = true,
    pinScrim: Boolean = false,
    preserveVelocity: Boolean = false,
  ) {
    if (index !in detentSpecs.indices) return
    targetIndex = index
    if (pinScrim) {
      pinScrimToTarget = true
    } else {
      pinScrimToTarget = false
      scrimPinnedFull = false
    }
    val currentTy = if (activeSpring != null) cancelActiveSpring() else translationYInternal
    val targetTy = translationY(index)
    if (!systemAnimatorsEnabled()) {
      applyTranslation(targetTy)
      emitPosition(targetTy)
      if (emitIndexChange) listener?.emitIndexChange(index)
      if (emitSettle) listener?.emitSettle(index)
      return
    }
    val distance = targetTy - currentTy
    val initialVelocity =
      if (preserveVelocity) {
        velocity
      } else {
        val ratio = if (distance != 0f) (velocity / distance).coerceIn(-5f, 5f) else 0f
        ratio * distance
      }
    val omega = 8f / (SPRING_DURATION_MS / 1000f)
    activeSpringEmitsSettle = emitSettle
    activeSpringTargetIndex = index
    activeSpring = CriticalSpring(
      from = currentTy,
      target = targetTy,
      v0 = initialVelocity,
      omega = omega,
      durationMs = SPRING_DURATION_MS,
    )
    applyTranslation(currentTy)
    updateScrim()
    val animator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = SPRING_DURATION_MS
      interpolator = LinearInterpolator()
      addUpdateListener { runningAnimator ->
        if (activeSpringAnimator !== runningAnimator) return@addUpdateListener
        val spring = activeSpring ?: return@addUpdateListener
        val elapsed = (runningAnimator.animatedValue as Float) * SPRING_DURATION_SECONDS
        val ty = spring.valueAtElapsed(elapsed)
        applyTranslation(ty)
        emitPosition(ty)
        if (runningAnimator.animatedFraction >= 1f) finishSpring()
      }
    }
    activeSpringAnimator = animator
    if (emitIndexChange) listener?.emitIndexChange(index)
    animator.start()
  }

  private fun finishSpring() {
    if (activeSpring == null) return
    val index = activeSpringTargetIndex
    val emitSettle = activeSpringEmitsSettle
    activeSpring = null
    activeSpringEmitsSettle = false
    activeSpringAnimator?.removeAllUpdateListeners()
    activeSpringAnimator = null
    applyTranslation(translationY(index))
    emitPosition()
    pinScrimToTarget = false
    if (emitSettle) listener?.emitSettle(index)
  }

  private fun cancelActiveSpring(): Float {
    val visual = activeSpring?.valueAtElapsed(activeSpringElapsedSeconds()) ?: translationYInternal
    activeSpring = null
    activeSpringEmitsSettle = false
    activeSpringAnimator?.removeAllUpdateListeners()
    activeSpringAnimator?.cancel()
    activeSpringAnimator = null
    applyTranslation(visual)
    return visual
  }

  private fun activeSpringElapsedSeconds(): Float =
    ((activeSpringAnimator?.animatedValue as? Float) ?: 0f) * SPRING_DURATION_SECONDS

  private fun systemAnimatorsEnabled(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ValueAnimator.areAnimatorsEnabled()

  private fun visibleSheetHeight(): Float = max(0f, sheetContainerHeight() - translationYInternal)

  /** False when the sheet is fully closed so catalog touches can pass through. */
  internal fun shouldReceiveTouches(): Boolean {
    if (detentSpecs.isEmpty()) return false
    return visibleSheetHeight() > 1f
  }

  override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
    if (!shouldReceiveTouches()) return false
    val inSheet = ev.y >= sheetContainer.top + sheetContainer.translationY
    if (!inSheet && modal && scrimView.visibility == VISIBLE) {
      return scrimView.dispatchTouchEvent(ev)
    }
    return super.dispatchTouchEvent(ev)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    if (!dragEnabled || !shouldReceiveTouches()) return false
    if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
      val inSheet = ev.y >= sheetContainer.top + sheetContainer.translationY
      if (!inSheet) return false
      lastTouchY = ev.rawY
      lastTouchTime = ev.eventTime
      velocityY = 0f
      nestedScrollChild = findNestedScrollable(ev)
    }
    if (ev.actionMasked == MotionEvent.ACTION_MOVE) {
      val dy = ev.rawY - lastTouchY
      val slop = ViewConfiguration.get(context).scaledTouchSlop
      if (abs(dy) > slop) {
        val atStart = nestedScrollChild?.let { isScrollAtStart(it) } ?: true
        if (nestedScrollChild == null || (dy > 0 && atStart) || !isAtLargestDetent()) {
          beginPanIfNeeded()
          return true
        }
      }
    }
    return super.onInterceptTouchEvent(ev)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!dragEnabled || !shouldReceiveTouches()) return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        beginPanIfNeeded()
        lastTouchY = event.rawY
        lastTouchTime = event.eventTime
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        beginPanIfNeeded()
        val dy = event.rawY - lastTouchY
        val dt = (event.eventTime - lastTouchTime).coerceAtLeast(1)
        velocityY = dy / dt * 1000f
        lastTouchY = event.rawY
        lastTouchTime = event.eventTime
        val range = activeDragRange ?: draggableRange(panStartingIndex)
        if (!panCoordinationIsSheet) return true
        val newTy = (translationYInternal + dy).coerceIn(range.first, range.second)
        if (abs(newTy - translationYInternal) > 0.01f) {
          didMoveSheetDuringPan = true
          applyTranslation(newTy)
          emitPosition(newTy)
        }
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        isPanning = false
        if (!didMoveSheetDuringPan) {
          panStartingIndex = null
          activeDragRange = null
          return true
        }
        val height = sheetContainerHeight() - translationYInternal
        val index = bestSnapIndex(height, velocityY, panStartingIndex)
        panStartingIndex = null
        activeDragRange = null
        snapToIndex(index, velocityY)
        return true
      }
    }
    return super.onTouchEvent(event)
  }

  private fun beginPanIfNeeded() {
    if (isPanning) return
    if (activeSpring != null) cancelActiveSpring()
    isPanning = true
    flushDeferredContentHeightRefresh()
    panStartingIndex = targetIndex
    activeDragRange = draggableRange(targetIndex)
    didMoveSheetDuringPan = false
    panCoordinationIsSheet = true
  }

  private fun isAtLargestDetent(): Boolean {
    val range = draggableRange(targetIndex)
    return translationYInternal <= range.first + 0.5f
  }

  private fun findNestedScrollable(event: MotionEvent): View? {
    return findScrollable(sheetContainer, event.rawX, event.rawY)
  }

  private fun findScrollable(view: View, rawX: Float, rawY: Float): View? {
    if (view is NestedScrollingChild && (view.canScrollVertically(1) || view.canScrollVertically(-1))) {
      return view
    }
    if (view is ViewGroup) {
      for (i in view.childCount - 1 downTo 0) {
        val child = view.getChildAt(i)
        val loc = IntArray(2)
        child.getLocationOnScreen(loc)
        if (rawX >= loc[0] && rawX <= loc[0] + child.width && rawY >= loc[1] && rawY <= loc[1] + child.height) {
          findScrollable(child, rawX, rawY)?.let { return it }
        }
      }
    }
    return null
  }

  private fun isScrollAtStart(view: View): Boolean = !view.canScrollVertically(-1)

  private fun handleScrimPress() {
    if (!dismissible) return
    val closed = detentSpecs.indexOfFirst { it.height == 0f && !it.programmatic }
    if (closed >= 0) snapToIndex(closed, 0f)
  }

  private fun updateScrim() {
    if (!modal) {
      scrimView.alpha = 0f
      scrimView.visibility = GONE
      return
    }
    if (pinScrimToTarget || scrimPinnedFull) {
      val pinned = scrimOpacityAt(targetIndex)
      scrimView.alpha = pinned
      scrimView.visibility = if (pinned <= 0.001f) GONE else VISIBLE
      return
    }
    val alpha = interpolatedScrimOpacity()
    scrimView.alpha = alpha
    scrimView.visibility = if (alpha <= 0.001f) GONE else VISIBLE
  }

  private fun scrimIsAtTargetOpacity(index: Int): Boolean =
    abs(scrimView.alpha - scrimOpacityAt(index)) <= 0.001f

  private fun scrimOpacityAt(index: Int): Float {
    if (scrimOpacities.isEmpty()) return 1f
    return scrimOpacities[index.coerceIn(0, scrimOpacities.lastIndex)].coerceIn(0f, 1f)
  }

  private fun interpolatedScrimOpacity(): Float {
    val fraction = fractionalIndex(sheetContainerHeight() - translationYInternal)
    if (scrimOpacities.isEmpty()) return 1f
    if (scrimOpacities.size == 1) return scrimOpacities[0].coerceIn(0f, 1f)
    val maxIndex = (scrimOpacities.size - 1).toFloat()
    val clamped = fraction.coerceIn(0f, maxIndex)
    val lower = clamped.toInt()
    val upper = min(lower + 1, scrimOpacities.lastIndex)
    val t = clamped - lower
    return (scrimOpacities[lower] * (1 - t) + scrimOpacities[upper] * t).coerceIn(0f, 1f)
  }

  private fun fractionalIndex(height: Float): Float {
    if (detentSpecs.size <= 1) return 0f
    if (height <= detentSpecs.first().height) return 0f
    val last = detentSpecs.lastIndex
    if (height >= detentSpecs[last].height) return last.toFloat()
    for (i in 0 until last) {
      val a = detentSpecs[i].height
      val b = detentSpecs[i + 1].height
      if (height in a..b) {
        val span = b - a
        return i + if (span == 0f) 0f else (height - a) / span
      }
    }
    return last.toFloat()
  }

  private fun emitPosition(overrideTy: Float? = null) {
    val ty = overrideTy ?: translationYInternal
    val position = sheetContainerHeight() - ty
    if (positionEventsEnabled) {
      listener?.emitPositionChange(position, fractionalIndex(position))
    }
    updateScrim()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    cancelDeferredContentHeightRefresh()
    if (activeSpring != null) cancelActiveSpring()
  }

  private companion object {
    const val CONTENT_HEIGHT_REFRESH_DELAY_MS = 50L
    const val SPRING_DURATION_MS = 450L
    const val SPRING_DURATION_SECONDS = SPRING_DURATION_MS / 1000f
  }
}
