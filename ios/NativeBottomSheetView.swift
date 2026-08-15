import ExpoModulesCore
import UIKit

final class NativeBottomSheetView: ExpoView, BottomSheetHostingViewDelegate {
  let engine = BottomSheetHostingView()
  let onIndexChange = EventDispatcher()
  let onSettle = EventDispatcher()
  let onPositionChange = EventDispatcher()
  let onKeyboardChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
    engine.isOpaque = false
    engine.backgroundColor = .clear
    engine.eventDelegate = self
    addSubview(engine)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    engine.frame = bounds
  }

  override func mountChildComponentView(_ childComponentView: UIView, index: Int) {
    engine.mountChild(childComponentView, at: index)
  }

  override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {
    engine.unmountChild(childComponentView)
  }

  func setDetents(_ records: [DetentRecord]) {
    engine.setDetents(records.map { $0.asSpec() })
  }

  func bottomSheetHostingView(_ view: BottomSheetHostingView, didChangeIndex index: Int) {
    onIndexChange(["index": index])
  }

  func bottomSheetHostingView(_ view: BottomSheetHostingView, didSettle index: Int) {
    onSettle(["index": index])
  }

  func bottomSheetHostingView(
    _ view: BottomSheetHostingView,
    didChangePosition position: CGFloat,
    index: CGFloat
  ) {
    onPositionChange(["position": position, "index": index])
  }

  func bottomSheetHostingView(_ view: BottomSheetHostingView, didChangeKeyboardHeight height: CGFloat) {
    onKeyboardChange(["height": height])
  }
}

struct DetentRecord: Record {
  @Field var value: Double = 0
  @Field var kind: String = "points"
  @Field var programmatic: Bool = false

  func asSpec() -> RawDetentSpec {
    let detentKind: DetentKind
    switch kind {
    case "content":
      detentKind = .content
    case "percentage":
      detentKind = .percentage
    default:
      detentKind = .points
    }
    return RawDetentSpec(value: CGFloat(value), kind: detentKind, programmatic: programmatic)
  }
}
