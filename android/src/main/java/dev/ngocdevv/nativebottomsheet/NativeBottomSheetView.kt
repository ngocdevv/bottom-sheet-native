package dev.ngocdevv.nativebottomsheet

import android.content.Context
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class NativeBottomSheetView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext),
  BottomSheetHostView.Listener {

  override val shouldUseAndroidLayout: Boolean = true

  internal val host = BottomSheetHostView(context).also { it.listener = this }

  private val onIndexChange by EventDispatcher()
  private val onSettle by EventDispatcher()
  private val onPositionChange by EventDispatcher()
  private val onKeyboardChange by EventDispatcher()

  init {
    clipChildren = false
    clipToPadding = false
    setBackgroundColor(android.graphics.Color.TRANSPARENT)
    orientation = VERTICAL
    addView(
      host,
      LinearLayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  override fun addView(child: View?, index: Int, params: ViewGroup.LayoutParams?) {
    if (child === host) {
      super.addView(child, index, LinearLayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
      return
    }
    if (child != null) {
      val sheetIndex = if (index < 0) host.sheetChildCount else index
      host.addSheetChild(child, sheetIndex)
    }
  }

  override fun removeView(view: View?) {
    if (view === host) {
      super.removeView(view)
      return
    }
    if (view != null) host.removeSheetChild(view)
  }

  override fun removeViewAt(index: Int) {
    // RN may address either the host (0) or a redirected sheet child.
    if (index == 0 && super.getChildCount() > 0 && super.getChildAt(0) === host) {
      return
    }
    val child = host.getSheetChildAt(if (index > 0) index - 1 else index) ?: return
    host.removeSheetChild(child)
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = MeasureSpec.getSize(heightMeasureSpec)
    setMeasuredDimension(width, height)
    host.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    host.layout(0, 0, right - left, bottom - top)
  }

  override fun onTouchEvent(event: android.view.MotionEvent): Boolean {
    if (!host.shouldReceiveTouches()) return false
    return super.onTouchEvent(event)
  }

  override fun dispatchTouchEvent(ev: android.view.MotionEvent): Boolean {
    if (!host.shouldReceiveTouches()) return false
    return super.dispatchTouchEvent(ev)
  }

  override fun onInterceptTouchEvent(ev: android.view.MotionEvent): Boolean {
    if (!host.shouldReceiveTouches()) return false
    return super.onInterceptTouchEvent(ev)
  }

  override fun emitIndexChange(index: Int) {
    onIndexChange(mapOf("index" to index))
  }

  override fun emitSettle(index: Int) {
    onSettle(mapOf("index" to index))
  }

  override fun emitPositionChange(position: Float, index: Float) {
    onPositionChange(mapOf("position" to position.toDouble(), "index" to index.toDouble()))
  }

  override fun emitKeyboardChange(height: Float) {
    onKeyboardChange(mapOf("height" to height.toDouble()))
  }
}

private typealias LinearLayoutParams = android.widget.LinearLayout.LayoutParams
