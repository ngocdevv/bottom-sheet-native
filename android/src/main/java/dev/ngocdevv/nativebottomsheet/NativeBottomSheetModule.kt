package dev.ngocdevv.nativebottomsheet

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class DetentRecord : Record {
  @Field
  var value: Double = 0.0

  @Field
  var kind: String = "points"

  @Field
  var programmatic: Boolean = false

  internal fun asSpec(): RawDetentSpec {
    val detentKind = when (kind) {
      "content" -> DetentKind.CONTENT
      "percentage" -> DetentKind.PERCENTAGE
      else -> DetentKind.POINTS
    }
    return RawDetentSpec(value.toFloat(), detentKind, programmatic)
  }
}

class NativeBottomSheetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeBottomSheet")

    View(NativeBottomSheetView::class) {
      Events("onIndexChange", "onSettle", "onPositionChange", "onKeyboardChange")

      Prop("detents") { view: NativeBottomSheetView, detents: List<DetentRecord> ->
        view.host.setDetents(detents.map { it.asSpec() })
      }
      Prop("index") { view: NativeBottomSheetView, index: Int ->
        view.host.setDetentIndex(index)
      }
      Prop("animateIn") { view: NativeBottomSheetView, value: Boolean ->
        view.host.animateIn = value
      }
      Prop("animateContentHeight") { view: NativeBottomSheetView, value: Boolean ->
        view.host.animateContentHeight = value
      }
      Prop("extendUnderStatusBar") { view: NativeBottomSheetView, value: Boolean ->
        view.host.extendUnderStatusBar = value
      }
      Prop("modal") { view: NativeBottomSheetView, value: Boolean ->
        view.host.modal = value
      }
      Prop("scrollableExpandNegotiation") { view: NativeBottomSheetView, value: Int ->
        view.host.scrollableExpandNegotiation = value
      }
      Prop("scrollableCollapseNegotiation") { view: NativeBottomSheetView, value: Int ->
        view.host.scrollableCollapseNegotiation = value
      }
      Prop("scrimColor") { view: NativeBottomSheetView, color: Int? ->
        view.host.setScrimColor(color)
      }
      Prop("scrimOpacities") { view: NativeBottomSheetView, values: List<Double> ->
        view.host.setScrimOpacities(values.map { it.toFloat() })
      }
      Prop("contentHeight") { view: NativeBottomSheetView, value: Double ->
        view.host.setJsContentHeightDp(value.toFloat())
      }
      Prop("hasSurface") { view: NativeBottomSheetView, value: Boolean ->
        view.host.hasSurface = value
      }
      Prop("sheetBackgroundColor") { view: NativeBottomSheetView, color: Int? ->
        view.host.setSheetBackgroundColor(color)
      }
      Prop("sheetCornerRadius") { view: NativeBottomSheetView, value: Double ->
        view.host.setSheetCornerRadiusDp(value.toFloat())
      }
      Prop("dismissible") { view: NativeBottomSheetView, value: Boolean ->
        view.host.dismissible = value
      }
      Prop("keyboardBehavior") { view: NativeBottomSheetView, value: Int ->
        view.host.keyboardBehavior = value
      }
    }
  }
}
