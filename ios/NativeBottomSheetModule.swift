import ExpoModulesCore

public class NativeBottomSheetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeBottomSheet")

    View(NativeBottomSheetView.self) {
      Events("onIndexChange", "onSettle", "onPositionChange", "onKeyboardChange")

      Prop("detents") { (view: NativeBottomSheetView, detents: [DetentRecord]) in
        view.setDetents(detents)
      }

      Prop("index") { (view: NativeBottomSheetView, index: Int) in
        view.engine.setDetentIndex(index)
      }

      Prop("animateIn") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.animateIn = value
      }

      Prop("animateContentHeight") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.animateContentHeight = value
      }

      Prop("extendUnderStatusBar") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.extendUnderStatusBar = value
      }

      Prop("modal") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.modal = value
      }

      Prop("scrollableExpandNegotiation") { (view: NativeBottomSheetView, value: Int) in
        view.engine.scrollableExpandNegotiation = value
      }

      Prop("scrollableCollapseNegotiation") { (view: NativeBottomSheetView, value: Int) in
        view.engine.scrollableCollapseNegotiation = value
      }

      Prop("scrimColor") { (view: NativeBottomSheetView, color: UIColor?) in
        view.engine.scrimColor = color ?? UIColor.black.withAlphaComponent(0.45)
      }

      Prop("scrimOpacities") { (view: NativeBottomSheetView, values: [Double]) in
        view.engine.setScrimOpacities(values.map { CGFloat($0) })
      }

      Prop("contentHeight") { (view: NativeBottomSheetView, value: Double) in
        view.engine.jsContentHeight = CGFloat(value)
      }

      Prop("hasSurface") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.hasSurface = value
      }

      Prop("sheetBackgroundColor") { (view: NativeBottomSheetView, color: UIColor?) in
        view.engine.sheetBackgroundColor = color
      }

      Prop("sheetCornerRadius") { (view: NativeBottomSheetView, value: Double) in
        view.engine.sheetCornerRadius = CGFloat(value)
      }

      Prop("dismissible") { (view: NativeBottomSheetView, value: Bool) in
        view.engine.dismissible = value
      }

      Prop("keyboardBehavior") { (view: NativeBottomSheetView, value: Int) in
        view.engine.keyboardBehavior = value
      }
    }
  }
}
