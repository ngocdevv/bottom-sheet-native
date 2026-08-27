import UIKit

protocol BottomSheetHostingViewDelegate: AnyObject {
  func bottomSheetHostingView(_ view: BottomSheetHostingView, didChangeIndex index: Int)
  func bottomSheetHostingView(_ view: BottomSheetHostingView, didSettle index: Int)
  func bottomSheetHostingView(
    _ view: BottomSheetHostingView,
    didChangePosition position: CGFloat,
    index: CGFloat
  )
  func bottomSheetHostingView(_ view: BottomSheetHostingView, didChangeKeyboardHeight height: CGFloat)
}

enum DetentKind {
  case points
  case percentage
  case content
}

struct RawDetentSpec {
  let value: CGFloat
  let kind: DetentKind
  let programmatic: Bool
}

private struct DetentSpec: Equatable {
  let height: CGFloat
  let programmatic: Bool
}

enum ScrollableNegotiationLevel: Int {
  case none = 0
  case initial = 1
  case handoff = 2

  init(clamping value: Int) {
    self = ScrollableNegotiationLevel(rawValue: min(max(value, 0), 2)) ?? .none
  }
}

private enum PanCoordinationMode {
  case sheet
  case scrollView
}

private final class ActiveScrollViewState {
  weak var scrollView: UIScrollView?
  var pinnedOffset: CGPoint
  let inverted: Bool
  private var observation: NSKeyValueObservation?
  private var isRestoring = false

  init(scrollView: UIScrollView, inverted: Bool) {
    self.scrollView = scrollView
    self.pinnedOffset = scrollView.contentOffset
    self.inverted = inverted
  }

  func startPinning(at offset: CGPoint) {
    stopPinning()
    pinnedOffset = offset
    guard let scrollView else { return }
    observation = scrollView.observe(\.contentOffset, options: [.new]) { [weak self] observed, _ in
      self?.restorePinnedOffset(on: observed)
    }
    restorePinnedOffset(on: scrollView)
  }

  func restorePinnedOffset() {
    guard let scrollView else { return }
    restorePinnedOffset(on: scrollView)
  }

  func stopPinning() {
    observation?.invalidate()
    observation = nil
    isRestoring = false
  }

  private func restorePinnedOffset(on scrollView: UIScrollView) {
    guard observation != nil, !isRestoring, scrollView.contentOffset != pinnedOffset else { return }
    isRestoring = true
    scrollView.setContentOffset(pinnedOffset, animated: false)
    isRestoring = false
  }
}

final class BottomSheetHostingView: UIView, UIGestureRecognizerDelegate, CAAnimationDelegate {
  weak var eventDelegate: BottomSheetHostingViewDelegate?

  var modal = false {
    didSet { updateScrim() }
  }

  var scrimColor: UIColor = UIColor.black.withAlphaComponent(0.45) {
    didSet { scrimView.backgroundColor = scrimColor }
  }

  var sheetBackgroundColor: UIColor? {
    didSet { sheetBackground.backgroundColor = sheetBackgroundColor }
  }

  var sheetCornerRadius: CGFloat = 28 {
    didSet {
      sheetBackground.layer.cornerRadius = sheetCornerRadius
      applySheetCornerMask()
    }
  }

  var extendUnderStatusBar = false {
    didSet {
      guard extendUnderStatusBar != oldValue else { return }
      refreshDetentsFromLayout()
      setNeedsLayout()
    }
  }

  var scrollableExpandNegotiation = ScrollableNegotiationLevel.handoff.rawValue
  var scrollableCollapseNegotiation = ScrollableNegotiationLevel.initial.rawValue
  var animateIn = true
  var animateContentHeight = true
  var positionEventsEnabled = false {
    didSet {
      guard positionEventsEnabled != oldValue, activeSpring != nil else { return }
      if positionEventsEnabled {
        startDisplayLink()
      } else {
        stopDisplayLink()
      }
    }
  }
  var dragEnabled = true {
    didSet {
      guard dragEnabled != oldValue else { return }
      panGesture?.isEnabled = dragEnabled
    }
  }
  var hasSurface = false
  var jsContentHeight: CGFloat = -1 {
    didSet {
      guard abs(jsContentHeight - oldValue) > 0.5 else { return }
      if shouldDeferContentHeightRefresh {
        scheduleDeferredContentHeightRefresh()
        return
      }
      cancelDeferredContentHeightRefresh()
      refreshDetentsFromLayout()
      setNeedsLayout()
    }
  }
  var dismissible = true
  /// 0 none, 1 extend content detent, 2 stick (emit only).
  var keyboardBehavior = 0 {
    didSet {
      if keyboardBehavior != oldValue {
        cancelDeferredContentHeightRefresh()
        refreshDetentsFromLayout()
        setNeedsLayout()
      }
    }
  }
  private var keyboardInset: CGFloat = 0 {
    didSet {
      let changed = abs(keyboardInset - oldValue) > 0.5
      if changed {
        eventDelegate?.bottomSheetHostingView(self, didChangeKeyboardHeight: keyboardInset)
      }
      guard keyboardBehavior == 1 else { return }
      let hadDeferredContentHeight = cancelDeferredContentHeightRefresh()
      guard changed || hadDeferredContentHeight else { return }
      refreshDetentsFromLayout()
      setNeedsLayout()
    }
  }

  let sheetContainer = UIView()
  private let scrimView = UIControl()
  private let sheetBackground = UIView()
  private var panGesture: UIPanGestureRecognizer!
  private var rawDetentSpecs: [RawDetentSpec] = []
  private var detentSpecs: [DetentSpec] = []
  private var targetIndex = 0
  private var pendingIndex: Int?
  private var hasLaidOut = false
  private var isPanning = false
  private var lastAppliedMaxDetentHeight: CGFloat = .nan
  private var activeSpring: CriticalSpring?
  private var activeSpringTargetIndex = 0
  private var activeSpringEmitsSettle = false
  private var displayLink: CADisplayLink?
  private var lastObservedSheetEditorFocus = false
  private var lastObservedSheetContainsEditor = false
  private var deferredContentHeightWorkItem: DispatchWorkItem?
  private var isContentHeightRefreshDeferred = false
  private var scrimOpacities: [CGFloat] = [1]
  private var scrimPinnedFull = false
  private var pinScrimToTarget = false
  private var panStartingIndex: Int?
  private var activeDragRange: (minTy: CGFloat, maxTy: CGFloat)?
  private var activeDragDetentSpecs: [DetentSpec]?
  private var panCoordinationMode: PanCoordinationMode = .sheet
  private var activeScrollableNegotiationLevel: ScrollableNegotiationLevel = .none
  private var activeScrollViewStates: [ActiveScrollViewState] = []
  private var didMoveSheetDuringPan = false
  private var didCancelTouchesForPan = false
  private var scrollViewOwnsLowerBoundary = false
  private weak var surfaceTouchHandler: UIGestureRecognizer?
  private static let springAnimationKey = "bottomSheetSettle"
  private static let scrimAnimationKey = "bottomSheetScrim"
  private static let flickThreshold: CGFloat = 600
  private static let springDuration: CFTimeInterval = 0.45
  private static let contentHeightRefreshDelay: TimeInterval = 0.05

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    isOpaque = false
    clipsToBounds = false

    scrimView.backgroundColor = scrimColor
    scrimView.alpha = 0
    scrimView.isHidden = true
    scrimView.addTarget(self, action: #selector(handleScrimPress), for: .touchUpInside)
    addSubview(scrimView)

    sheetContainer.backgroundColor = .clear
    sheetContainer.clipsToBounds = true
    applySheetCornerMask()
    addSubview(sheetContainer)

    sheetBackground.backgroundColor = .clear
    sheetBackground.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    sheetBackground.layer.cornerRadius = sheetCornerRadius
    sheetBackground.layer.masksToBounds = true
    sheetBackground.isUserInteractionEnabled = false
    sheetContainer.addSubview(sheetBackground)

    panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    panGesture.delegate = self
    panGesture.cancelsTouchesInView = true
    panGesture.delaysTouchesBegan = false
    panGesture.delaysTouchesEnded = false
    panGesture.isEnabled = dragEnabled
    sheetContainer.addGestureRecognizer(panGesture)

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(keyboardFrameWillChange(_:)),
      name: UIResponder.keyboardWillChangeFrameNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(keyboardWillHide),
      name: UIResponder.keyboardWillHideNotification,
      object: nil
    )
  }

  @available(*, unavailable)
  required init?(coder _: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    surfaceTouchHandler = nil
    guard window != nil else {
      cancelDeferredContentHeightRefresh()
      return
    }
    refreshDetentsFromLayout()
    setNeedsLayout()
    var current: UIView? = superview
    while let view = current {
      for recognizer in view.gestureRecognizers ?? [] {
        if NSStringFromClass(type(of: recognizer)).contains("TouchHandler") {
          surfaceTouchHandler = recognizer
          break
        }
      }
      if surfaceTouchHandler != nil { break }
      current = view.superview
    }
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    refreshDetentsFromLayout()
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }
    if hasLaidOut, window == nil { return }

    scrimView.frame = bounds
    refreshDetentsFromLayout()
    let maxHeight = sheetContainerHeight
    lastAppliedMaxDetentHeight = maxHeight
    sheetContainer.bounds = CGRect(x: 0, y: 0, width: bounds.width, height: maxHeight)
    sheetContainer.center = CGPoint(x: bounds.width / 2, y: bounds.height - maxHeight / 2)
    sheetBackground.frame = sheetContainer.bounds
    layoutSheetChildren()

    if !hasLaidOut, !detentSpecs.isEmpty {
      let indexToApply = pendingIndex ?? targetIndex
      let clampedIndex = max(0, min(detentSpecs.count - 1, indexToApply))
      hasLaidOut = true
      pendingIndex = nil
      targetIndex = clampedIndex
      if animateIn {
        let closedTy = sheetContainerHeight
        sheetContainer.transform = CGAffineTransform(translationX: 0, y: closedTy)
        emitPosition()
        snapToIndex(targetIndex, velocity: 0, emitIndexChange: false, emitSettle: true)
      } else {
        sheetContainer.transform = CGAffineTransform(translationX: 0, y: translationY(for: targetIndex))
        emitPosition()
      }
      return
    }

    if activeSpring != nil || isPanning { return }
    sheetContainer.transform = CGAffineTransform(translationX: 0, y: translationY(for: targetIndex))
    updateScrim()
  }

  private var presentedSheetFrame: CGRect {
    guard activeSpring != nil else { return sheetContainer.frame }
    let size = sheetContainer.bounds.size
    let center = sheetContainer.center
    return CGRect(
      x: center.x - size.width / 2,
      y: center.y - size.height / 2 + currentTranslationY,
      width: size.width,
      height: size.height
    )
  }

  override func point(inside point: CGPoint, with _: UIEvent?) -> Bool {
    if presentedSheetFrame.contains(point) { return true }
    return isScrimVisible && bounds.contains(point)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard self.point(inside: point, with: event) else { return nil }
    if isScrimVisible, !presentedSheetFrame.contains(point) {
      return scrimView.hitTest(convert(point, to: scrimView), with: event)
    }
    let containerPoint = convert(point, to: sheetContainer)
    guard sheetContainer.bounds.contains(containerPoint) else { return nil }
    return sheetContainer.hitTest(containerPoint, with: event)
  }

  func setDetents(_ raw: [RawDetentSpec]) {
    rawDetentSpecs = raw
    refreshDetentsFromLayout()
  }

  func setScrimOpacities(_ values: [CGFloat]) {
    scrimOpacities = values.isEmpty ? [1] : values
    updateScrim()
  }

  func setDetentIndex(_ newIndex: Int) {
    guard newIndex >= 0 else { return }
    if !hasLaidOut {
      pendingIndex = newIndex
      targetIndex = newIndex
      return
    }
    guard newIndex < detentSpecs.count, newIndex != targetIndex else { return }
    // A delayed content refresh belongs to the detent we are leaving. Letting
    // it fire during this snap would cancel and restart the new animation.
    cancelDeferredContentHeightRefresh()
    snapToIndex(newIndex, velocity: 0, emitIndexChange: false)
  }

  func mountChild(_ child: UIView, at index: Int) {
    let insertAt = min(max(index + 1, 1), sheetContainer.subviews.count)
    sheetContainer.insertSubview(child, at: insertAt)
    setNeedsLayout()
  }

  func unmountChild(_ child: UIView) {
    child.removeFromSuperview()
    setNeedsLayout()
  }

  // MARK: - Content / keyboard coalescing

  /// A page layout can land just before an editor focuses and the keyboard
  /// frame notification arrives. Hold only that FIRST height update. Deferring
  /// every update merely because `keyboardBehavior == extend` samples a 60fps
  /// page animation every three frames and makes the sheet edge step at ~20fps.
  private var shouldDeferContentHeightRefresh: Bool {
    guard keyboardBehavior == 1, hasLaidOut, !isPanning else { return false }
    guard rawDetentSpecs.indices.contains(targetIndex) else { return false }
    guard rawDetentSpecs[targetIndex].kind == .content else { return false }

    let editorFocused = containsFirstResponder(sheetContainer)
    let containsEditor = containsTextEditor(sheetContainer)
    let focusChanged = editorFocused != lastObservedSheetEditorFocus
    let editorPresenceChanged = containsEditor != lastObservedSheetContainsEditor
    lastObservedSheetEditorFocus = editorFocused
    lastObservedSheetContainsEditor = containsEditor
    let keyboardVisible = keyboardInset > 0.5
    return (focusChanged && editorFocused != keyboardVisible)
      || (editorPresenceChanged && containsEditor && !keyboardVisible)
  }

  private func containsFirstResponder(_ view: UIView) -> Bool {
    if view.isFirstResponder { return true }
    return view.subviews.contains(where: containsFirstResponder)
  }

  private func containsTextEditor(_ view: UIView) -> Bool {
    if view is UITextInput { return true }
    return view.subviews.contains(where: containsTextEditor)
  }

  private func scheduleDeferredContentHeightRefresh() {
    isContentHeightRefreshDeferred = true
    guard deferredContentHeightWorkItem == nil else { return }
    let workItem = DispatchWorkItem { [weak self] in
      self?.flushDeferredContentHeightRefresh()
    }
    deferredContentHeightWorkItem = workItem
    DispatchQueue.main.asyncAfter(
      deadline: .now() + Self.contentHeightRefreshDelay,
      execute: workItem
    )
  }

  @discardableResult
  private func cancelDeferredContentHeightRefresh() -> Bool {
    let wasDeferred = isContentHeightRefreshDeferred
    isContentHeightRefreshDeferred = false
    deferredContentHeightWorkItem?.cancel()
    deferredContentHeightWorkItem = nil
    return wasDeferred
  }

  private func flushDeferredContentHeightRefresh() {
    guard cancelDeferredContentHeightRefresh() else { return }
    refreshDetentsFromLayout()
    setNeedsLayout()
  }

  // MARK: - Geometry

  private var resolvedMaxDetentHeight: CGFloat {
    let topInset = extendUnderStatusBar ? 0 : window?.safeAreaInsets.top ?? safeAreaInsets.top
    return max(0, bounds.height - topInset)
  }

  private var sheetContainerHeight: CGFloat { resolvedMaxDetentHeight }

  private var validContentHeight: CGFloat? {
    let raw: CGFloat?
    if jsContentHeight >= 0 {
      raw = jsContentHeight
    } else {
      let measured = measuredNativeContentHeight()
      raw = measured > 0.5 ? measured : nil
    }
    guard let raw else { return nil }
    let extra = keyboardBehavior == 1 ? keyboardInset : 0
    return raw + extra
  }

  private func measuredNativeContentHeight() -> CGFloat {
    let children = sheetChildren()
    let contentChildren = hasSurface ? children.dropFirst() : children[...]
    var maxBottom: CGFloat = 0
    for child in contentChildren {
      maxBottom = max(maxBottom, child.frame.maxY)
    }
    return maxBottom
  }

  private func sheetChildren() -> [UIView] {
    sheetContainer.subviews.filter { $0 !== sheetBackground }
  }

  private func layoutSheetChildren() {
    let children = sheetChildren()
    let surface = hasSurface ? children.first : nil
    surface?.frame = sheetContainer.bounds
    for child in children where child !== surface {
      var frame = child.frame
      frame.origin.x = 0
      frame.size.width = sheetContainer.bounds.width
      child.frame = frame
    }
  }

  private func resolveDetentSpecs() -> [DetentSpec]? {
    let maxHeight = resolvedMaxDetentHeight
    let measuredContentHeight = maxHeight > 0 ? validContentHeight.map { min($0, maxHeight) } : nil
    var resolved: [DetentSpec] = []
    for (index, spec) in rawDetentSpecs.enumerated() {
      let height: CGFloat
      switch spec.kind {
      case .points:
        height = spec.value
      case .percentage:
        height = maxHeight * spec.value
      case .content:
        let lowerBound = resolved.last?.height ?? 0
        let upperBound = max(
          lowerBound,
          unresolvedContentDetentHeight(after: index, maxHeight: maxHeight)
        )
        let desired = measuredContentHeight ?? upperBound
        height = min(max(desired, lowerBound), upperBound)
      }
      let resolvedHeight = min(max(0, height), maxHeight)
      if let previous = resolved.last, resolvedHeight < previous.height {
        return nil
      }
      resolved.append(DetentSpec(height: resolvedHeight, programmatic: spec.programmatic))
    }
    return resolved
  }

  private func unresolvedContentDetentHeight(after index: Int, maxHeight: CGFloat) -> CGFloat {
    guard index + 1 < rawDetentSpecs.count else { return maxHeight }
    for spec in rawDetentSpecs[(index + 1)...] {
      switch spec.kind {
      case .points:
        return min(max(0, spec.value), maxHeight)
      case .percentage:
        return min(max(0, maxHeight * spec.value), maxHeight)
      case .content:
        continue
      }
    }
    return maxHeight
  }

  private func refreshDetentsFromLayout() {
    if hasLaidOut, window == nil { return }
    if isContentHeightRefreshDeferred {
      updateScrim()
      return
    }
    guard let resolved = resolveDetentSpecs() else {
      updateScrim()
      return
    }
    guard resolved != detentSpecs || sheetContainerHeight != lastAppliedMaxDetentHeight else {
      updateScrim()
      return
    }

    let previousMaxHeight =
      lastAppliedMaxDetentHeight.isFinite ? lastAppliedMaxDetentHeight : sheetContainerHeight
    detentSpecs = resolved
    guard bounds.width > 0, bounds.height > 0, !detentSpecs.isEmpty else { return }

    if hasLaidOut, !isPanning {
      targetIndex = max(0, min(detentSpecs.count - 1, targetIndex))
      let newMaxHeight = sheetContainerHeight
      let targetTy = translationY(for: targetIndex)
      if activeSpring != nil {
        let shouldPinScrim = scrimIsAtTargetOpacity(for: targetIndex)
        let shouldEmitSettle = activeSpringEmitsSettle
        let springVelocity = activeSpring?.velocity(at: CACurrentMediaTime()) ?? 0
        let visualTy = cancelActiveSpring()
        let visibleHeight = previousMaxHeight - visualTy
        let reanchoredTy = min(max(newMaxHeight - visibleHeight, 0), newMaxHeight)
        sheetContainer.transform = CGAffineTransform(translationX: 0, y: reanchoredTy)
        emitPosition()
        snapToIndex(
          targetIndex,
          velocity: springVelocity,
          emitIndexChange: false,
          emitSettle: shouldEmitSettle,
          preserveScrimPin: shouldPinScrim,
          preserveVelocity: true
        )
      } else {
        let currentVisibleHeight = previousMaxHeight - currentTranslationY
        let targetHeight = detent(at: targetIndex).height
        let shouldAnimate = shouldAnimateContentHeight(at: targetIndex)
        if abs(targetHeight - currentVisibleHeight) <= 0.5 || !shouldAnimate {
          sheetContainer.transform = CGAffineTransform(translationX: 0, y: targetTy)
          emitPosition()
          pinScrimToTarget = false
          scrimPinnedFull = false
        } else {
          let shouldPinScrim = scrimIsAtTargetOpacity(for: targetIndex)
          let startTy = min(max(newMaxHeight - currentVisibleHeight, 0), newMaxHeight)
          sheetContainer.transform = CGAffineTransform(translationX: 0, y: startTy)
          snapToIndex(
            targetIndex,
            velocity: 0,
            emitIndexChange: false,
            preserveScrimPin: shouldPinScrim
          )
        }
      }
    }
  }

  private func shouldAnimateContentHeight(at index: Int) -> Bool {
    guard animateContentHeight,
          !UIAccessibility.isReduceMotionEnabled,
          rawDetentSpecs.indices.contains(index) else { return false }
    return rawDetentSpecs[index].kind == .content
  }

  private func detent(at index: Int) -> DetentSpec {
    guard detentSpecs.indices.contains(index) else {
      return DetentSpec(height: 0, programmatic: false)
    }
    return detentSpecs[index]
  }

  private func translationY(for index: Int) -> CGFloat {
    sheetContainerHeight - detent(at: index).height
  }

  private var currentTranslationY: CGFloat {
    if let spring = activeSpring {
      return spring.value(at: CACurrentMediaTime())
    }
    return (sheetContainer.layer.presentation()?.value(forKeyPath: "transform.translation.y") as? CGFloat)
      ?? sheetContainer.transform.ty
  }

  private var currentSheetHeight: CGFloat {
    sheetContainerHeight - currentTranslationY
  }

  // MARK: - Snap / spring

  private func snapCandidateIndices(including index: Int? = nil, in specs: [DetentSpec]? = nil) -> [Int] {
    let source = specs ?? detentSpecs
    var indices = source.indices.filter { !source[$0].programmatic }
    if let index, source.indices.contains(index), source[index].programmatic {
      indices.append(index)
    }
    return Array(Set(indices)).sorted { source[$0].height < source[$1].height }
  }

  private func draggableRange(including index: Int?, in specs: [DetentSpec]? = nil) -> (minTy: CGFloat, maxTy: CGFloat) {
    let source = specs ?? detentSpecs
    let candidates = snapCandidateIndices(including: index, in: source)
    guard !candidates.isEmpty else { return (0, 0) }
    let translations = candidates.map { sheetContainerHeight - source[$0].height }
    return (translations.min() ?? 0, translations.max() ?? 0)
  }

  private func bestSnapIndex(for height: CGFloat, velocity: CGFloat, including index: Int?, in specs: [DetentSpec]? = nil) -> Int {
    let source = specs ?? detentSpecs
    let candidates = snapCandidateIndices(including: index, in: source)
    guard !candidates.isEmpty else { return targetIndex }

    if velocity < -Self.flickThreshold {
      return candidates.first(where: { source[$0].height > height }) ?? candidates.last ?? targetIndex
    }
    if velocity > Self.flickThreshold {
      return candidates.last(where: { source[$0].height < height }) ?? candidates.first ?? targetIndex
    }
    return candidates.min(by: {
      abs(source[$0].height - height) < abs(source[$1].height - height)
    }) ?? targetIndex
  }

  private func snapToIndex(
    _ index: Int,
    velocity: CGFloat,
    emitIndexChange: Bool = true,
    emitSettle: Bool = true,
    preserveScrimPin: Bool = false,
    preserveVelocity: Bool = false
  ) {
    guard detentSpecs.indices.contains(index) else { return }
    targetIndex = index
    if preserveScrimPin {
      pinScrimToTarget = true
    } else {
      pinScrimToTarget = false
      scrimPinnedFull = false
    }

    let currentTy = activeSpring != nil ? cancelActiveSpring() : sheetContainer.transform.ty
    let targetTy = translationY(for: index)
    let distance = targetTy - currentTy
    let v0: CGFloat
    if preserveVelocity {
      v0 = velocity
    } else {
      let velocityRatio = distance != 0 ? velocity / distance : 0
      let clampedRatio = min(max(velocityRatio, -5), 5)
      v0 = clampedRatio * distance
    }
    let omega = 8.0 / CGFloat(Self.springDuration)
    activeSpringEmitsSettle = emitSettle
    activeSpringTargetIndex = index

    let startTime = CACurrentMediaTime()
    let spring = CriticalSpring(
      from: currentTy,
      target: targetTy,
      v0: v0,
      omega: omega,
      startTime: startTime,
      duration: Self.springDuration
    )

    let animation = CAKeyframeAnimation(keyPath: "transform.translation.y")
    let sampleCount = max(Int((Self.springDuration * 120).rounded()), 1)
    let translationValues = spring.keyframeValues(count: sampleCount)
    let keyTimes = (0 ... sampleCount).map { NSNumber(value: Double($0) / Double(sampleCount)) }
    animation.values = translationValues
    animation.keyTimes = keyTimes
    animation.duration = Self.springDuration
    animation.calculationMode = .linear
    animation.beginTime = sheetContainer.layer.convertTime(startTime, from: nil)
    animation.isRemovedOnCompletion = false
    animation.fillMode = .forwards
    animation.delegate = self

    sheetContainer.transform = CGAffineTransform(translationX: 0, y: targetTy)
    sheetContainer.layer.add(animation, forKey: Self.springAnimationKey)
    animateScrim(
      translationValues: translationValues,
      keyTimes: keyTimes,
      beginTime: animation.beginTime,
      duration: animation.duration
    )
    activeSpring = spring
    startDisplayLink()

    if emitIndexChange {
      eventDelegate?.bottomSheetHostingView(self, didChangeIndex: index)
    }
  }

  func animationDidStop(_ anim: CAAnimation, finished flag: Bool) {
    guard flag else { return }
    finishSpring()
  }

  private func finishSpring() {
    guard activeSpring != nil else { return }
    let index = activeSpringTargetIndex
    let emitSettle = activeSpringEmitsSettle
    activeSpring = nil
    activeSpringEmitsSettle = false
    stopDisplayLink()
    sheetContainer.layer.removeAnimation(forKey: Self.springAnimationKey)
    scrimView.layer.removeAnimation(forKey: Self.scrimAnimationKey)
    sheetContainer.transform = CGAffineTransform(translationX: 0, y: translationY(for: index))
    emitPosition()
    pinScrimToTarget = false
    scrimPinnedFull = false
    if emitSettle {
      eventDelegate?.bottomSheetHostingView(self, didSettle: index)
    }
  }

  @discardableResult
  private func cancelActiveSpring() -> CGFloat {
    let visualTy = currentTranslationY
    let visualScrimAlpha = currentScrimAlpha
    activeSpring = nil
    activeSpringEmitsSettle = false
    stopDisplayLink()
    sheetContainer.layer.removeAnimation(forKey: Self.springAnimationKey)
    scrimView.layer.removeAnimation(forKey: Self.scrimAnimationKey)
    sheetContainer.transform = CGAffineTransform(translationX: 0, y: visualTy)
    scrimView.alpha = visualScrimAlpha
    scrimView.isHidden = visualScrimAlpha <= 0.001
    return visualTy
  }

  private func startDisplayLink() {
    stopDisplayLink()
    guard positionEventsEnabled else { return }
    let link = CADisplayLink(target: self, selector: #selector(handleDisplayLink))
    if #available(iOS 15.0, *) {
      // Position events are an opt-in observation stream, not the animation
      // driver. Sampling them at a stable 60 Hz avoids doubling bridge work on
      // ProMotion displays while Core Animation remains free to composite at
      // the display's native refresh rate.
      link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 60, preferred: 60)
    } else {
      link.preferredFramesPerSecond = 60
    }
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  private func stopDisplayLink() {
    displayLink?.invalidate()
    displayLink = nil
  }

  @objc private func handleDisplayLink() {
    guard let spring = activeSpring else { return }
    emitPosition(overrideTy: spring.value(at: CACurrentMediaTime()))
    if CACurrentMediaTime() >= spring.startTime + spring.duration {
      finishSpring()
    }
  }

  // MARK: - Pan

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    let maxHeight = sheetContainerHeight
    switch gesture.state {
    case .began:
      if activeSpring != nil { cancelActiveSpring() }
      isPanning = true
      flushDeferredContentHeightRefresh()
      scrimPinnedFull = false
      panStartingIndex = targetIndex
      activeDragDetentSpecs = detentSpecs
      activeDragRange = draggableRange(including: targetIndex, in: detentSpecs)
      sheetContainer.endEditing(true)
      didMoveSheetDuringPan = false
      didCancelTouchesForPan = false
      scrollViewOwnsLowerBoundary = false
      activeScrollableNegotiationLevel = negotiationLevel(forVerticalVelocity: gesture.velocity(in: self).y)

      let location = gesture.location(in: sheetContainer)
      activeScrollViewStates = scrollableAncestorChain(containing: location).map {
        ActiveScrollViewState(scrollView: $0.scrollView, inverted: $0.inverted)
      }

      if activeScrollViewStates.isEmpty {
        panCoordinationMode = .sheet
        cancelContentTouchesForPanIfNeeded()
      } else {
        let range = activeDragRange ?? draggableRange(including: panStartingIndex)
        let isAtLargest = sheetContainer.transform.ty <= range.minTy + 0.5
        let velocity = gesture.velocity(in: self).y
        if activeScrollableNegotiationLevel == .handoff,
           isAtLargest && (velocity < 0 || !activeScrollViewsAreAtStart()) {
          panCoordinationMode = .scrollView
        } else {
          panCoordinationMode = .sheet
          lockActiveScrollViews(pinToStart: isAtLargest)
        }
      }
      gesture.setTranslation(.zero, in: self)

    case .changed:
      let delta = gesture.translation(in: self).y
      gesture.setTranslation(.zero, in: self)
      let range = activeDragRange ?? draggableRange(including: panStartingIndex)

      if activeScrollableNegotiationLevel == .handoff,
         !activeScrollViewStates.isEmpty,
         panCoordinationMode == .scrollView {
        if scrollViewOwnsLowerBoundary {
          if delta < 0, activeScrollViewsAreAtStart(requireExactOffset: true) {
            scrollViewOwnsLowerBoundary = false
            panCoordinationMode = .sheet
            lockActiveScrollViews(pinToStart: true)
          }
          return
        }
        if delta > 0, activeScrollViewsAreAtStart() {
          panCoordinationMode = .sheet
          lockActiveScrollViews(pinToStart: true)
        }
        return
      }

      pinActiveScrollViews()
      let newTy = max(range.minTy, min(range.maxTy, sheetContainer.transform.ty + delta))
      if abs(newTy - sheetContainer.transform.ty) > .ulpOfOne {
        cancelContentTouchesForPanIfNeeded()
        didMoveSheetDuringPan = true
        sheetContainer.transform = CGAffineTransform(translationX: 0, y: newTy)
        emitPosition()
      }
      pinActiveScrollViews()

      if activeScrollableNegotiationLevel == .handoff, !activeScrollViewStates.isEmpty, delta < 0,
         newTy <= range.minTy + 0.5 {
        panCoordinationMode = .scrollView
        scrollViewOwnsLowerBoundary = false
        unlockActiveScrollViews()
      } else if activeScrollableNegotiationLevel == .handoff, !activeScrollViewStates.isEmpty, delta > 0,
                newTy >= range.maxTy - 0.5 {
        panCoordinationMode = .scrollView
        scrollViewOwnsLowerBoundary = true
        unlockActiveScrollViews()
      }

    case .ended, .cancelled:
      isPanning = false
      let coordinated = !activeScrollViewStates.isEmpty
      let sheetMoved = didMoveSheetDuringPan
      if sheetMoved, panCoordinationMode == .sheet {
        cancelActiveScrollViewPans()
      }
      unlockActiveScrollViews()
      let velocity = gesture.velocity(in: self).y
      if coordinated, !sheetMoved {
        panStartingIndex = nil
        activeDragRange = nil
        activeDragDetentSpecs = nil
        finishScrollViewCoordination()
        return
      }
      let currentHeight = maxHeight - sheetContainer.transform.ty
      let index = bestSnapIndex(
        for: currentHeight,
        velocity: velocity,
        including: panStartingIndex,
        in: activeDragDetentSpecs
      )
      panStartingIndex = nil
      activeDragRange = nil
      activeDragDetentSpecs = nil
      finishScrollViewCoordination()
      snapToIndex(index, velocity: velocity)

    default:
      break
    }
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
  ) -> Bool {
    other.view is UIScrollView
  }

  private func negotiationLevel(forVerticalVelocity velocity: CGFloat) -> ScrollableNegotiationLevel {
    if velocity < 0 {
      return ScrollableNegotiationLevel(clamping: scrollableExpandNegotiation)
    }
    return ScrollableNegotiationLevel(clamping: scrollableCollapseNegotiation)
  }

  private func scrollableAncestorChain(containing point: CGPoint) -> [(scrollView: UIScrollView, inverted: Bool)] {
    guard let hit = sheetContainer.hitTest(point, with: nil) else { return [] }
    var result: [(scrollView: UIScrollView, inverted: Bool)] = []
    var current: UIView? = hit
    while let view = current, view !== sheetContainer {
      if let scroll = view as? UIScrollView, scroll.isScrollEnabled {
        let inverted = scroll.contentInsetAdjustmentBehavior == .never && scroll.contentOffset.y < 0
          ? false
          : scroll.transform.d < 0
        result.append((scroll, inverted))
      }
      current = view.superview
    }
    return result
  }

  private func activeScrollViewsAreAtStart(requireExactOffset: Bool = false) -> Bool {
    let epsilon: CGFloat = requireExactOffset ? 0.5 : 1.5
    return activeScrollViewStates.allSatisfy { state in
      guard let scroll = state.scrollView else { return true }
      let minY = -scroll.adjustedContentInset.top
      if state.inverted {
        let maxY = scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom
        return scroll.contentOffset.y >= maxY - epsilon
      }
      return scroll.contentOffset.y <= minY + epsilon
    }
  }

  private func lockActiveScrollViews(pinToStart: Bool) {
    for state in activeScrollViewStates {
      guard let scroll = state.scrollView else { continue }
      let start = state.inverted
        ? CGPoint(
          x: scroll.contentOffset.x,
          y: scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom
        )
        : CGPoint(x: scroll.contentOffset.x, y: -scroll.adjustedContentInset.top)
      state.startPinning(at: pinToStart ? start : scroll.contentOffset)
    }
  }

  private func pinActiveScrollViews() {
    for state in activeScrollViewStates {
      state.restorePinnedOffset()
    }
  }

  private func unlockActiveScrollViews() {
    for state in activeScrollViewStates {
      state.stopPinning()
    }
  }

  private func cancelActiveScrollViewPans() {
    for state in activeScrollViewStates {
      state.scrollView?.panGestureRecognizer.isEnabled = false
      state.scrollView?.panGestureRecognizer.isEnabled = true
    }
  }

  private func finishScrollViewCoordination() {
    unlockActiveScrollViews()
    activeScrollViewStates = []
    panCoordinationMode = .sheet
    scrollViewOwnsLowerBoundary = false
  }

  private func cancelContentTouchesForPanIfNeeded() {
    guard !didCancelTouchesForPan else { return }
    didCancelTouchesForPan = true
    surfaceTouchHandler?.isEnabled = false
    surfaceTouchHandler?.isEnabled = true
  }

  // MARK: - Scrim / events

  private func applySheetCornerMask() {
    let corners: CACornerMask = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    sheetContainer.layer.maskedCorners = corners
    sheetContainer.layer.cornerRadius = sheetCornerRadius
    sheetBackground.layer.maskedCorners = corners
    sheetBackground.layer.cornerRadius = sheetCornerRadius
  }

  private var isScrimVisible: Bool {
    modal && currentScrimAlpha > 0.01 && !scrimView.isHidden
  }

  private var closedIndex: Int? {
    detentSpecs.firstIndex(where: { $0.height == 0 })
  }

  private var scrimDismissIndex: Int? {
    guard let closedIndex, !detentSpecs[closedIndex].programmatic else { return nil }
    return closedIndex
  }

  @objc private func handleScrimPress() {
    guard dismissible, let dismiss = scrimDismissIndex else { return }
    snapToIndex(dismiss, velocity: 0)
  }

  @objc private func keyboardFrameWillChange(_ note: Notification) {
    guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
    let converted = convert(frame, from: nil)
    keyboardInset = max(0, bounds.maxY - converted.minY)
  }

  @objc private func keyboardWillHide() {
    keyboardInset = 0
  }

  private func updateScrim() {
    guard modal else {
      scrimView.alpha = 0
      scrimView.isHidden = true
      return
    }
    if pinScrimToTarget || scrimPinnedFull {
      let pinned = scrimOpacity(at: targetIndex)
      scrimView.alpha = pinned
      scrimView.isHidden = pinned <= 0.001
      return
    }
    let alpha = interpolatedScrimOpacity()
    scrimView.alpha = alpha
    scrimView.isHidden = alpha <= 0.001
  }

  private var currentScrimAlpha: CGFloat {
    (scrimView.layer.presentation()?.opacity).map(CGFloat.init) ?? scrimView.alpha
  }

  private func animateScrim(
    translationValues: [CGFloat],
    keyTimes: [NSNumber],
    beginTime: CFTimeInterval,
    duration: CFTimeInterval
  ) {
    guard modal else {
      scrimView.layer.removeAnimation(forKey: Self.scrimAnimationKey)
      scrimView.alpha = 0
      scrimView.isHidden = true
      return
    }
    let opacityValues = translationValues.map { scrimOpacity(forTranslationY: $0) }
    let startAlpha = opacityValues.first ?? currentScrimAlpha
    let targetAlpha = opacityValues.last ?? scrimOpacity(at: targetIndex)
    scrimView.isHidden = startAlpha <= 0.001 && targetAlpha <= 0.001
    scrimView.alpha = targetAlpha

    let animation = CAKeyframeAnimation(keyPath: "opacity")
    animation.values = opacityValues
    animation.keyTimes = keyTimes
    animation.duration = duration
    animation.calculationMode = .linear
    animation.beginTime = beginTime
    animation.isRemovedOnCompletion = false
    animation.fillMode = .forwards
    scrimView.layer.add(animation, forKey: Self.scrimAnimationKey)
  }

  private func scrimOpacity(forTranslationY translationY: CGFloat) -> CGFloat {
    if pinScrimToTarget || scrimPinnedFull {
      return scrimOpacity(at: targetIndex)
    }
    return interpolatedScrimOpacity(forHeight: sheetContainerHeight - translationY)
  }

  private func scrimIsAtTargetOpacity(for index: Int) -> Bool {
    abs(currentScrimAlpha - scrimOpacity(at: index)) <= 0.001
  }

  private func scrimOpacity(at index: Int) -> CGFloat {
    if scrimOpacities.isEmpty { return 1 }
    let clamped = min(max(index, 0), scrimOpacities.count - 1)
    return min(1, max(0, scrimOpacities[clamped]))
  }

  private func interpolatedScrimOpacity() -> CGFloat {
    interpolatedScrimOpacity(forHeight: currentSheetHeight)
  }

  private func interpolatedScrimOpacity(forHeight height: CGFloat) -> CGFloat {
    let fraction = fractionalIndex(for: height)
    if scrimOpacities.isEmpty { return 1 }
    if scrimOpacities.count == 1 { return min(1, max(0, scrimOpacities[0])) }
    let maxIndex = CGFloat(scrimOpacities.count - 1)
    let clamped = min(max(fraction, 0), maxIndex)
    let lower = Int(floor(clamped))
    let upper = min(lower + 1, scrimOpacities.count - 1)
    let t = clamped - CGFloat(lower)
    return min(1, max(0, scrimOpacities[lower] * (1 - t) + scrimOpacities[upper] * t))
  }

  private func fractionalIndex(for height: CGFloat) -> CGFloat {
    guard detentSpecs.count > 1 else { return 0 }
    if height <= detentSpecs[0].height { return 0 }
    let last = detentSpecs.count - 1
    if height >= detentSpecs[last].height { return CGFloat(last) }
    for i in 0 ..< last {
      let a = detentSpecs[i].height
      let b = detentSpecs[i + 1].height
      if height >= a && height <= b {
        let span = b - a
        return CGFloat(i) + (span == 0 ? 0 : (height - a) / span)
      }
    }
    return CGFloat(last)
  }

  private func emitPosition(overrideTy: CGFloat? = nil) {
    let ty = overrideTy ?? currentTranslationY
    let position = sheetContainerHeight - ty
    let index = fractionalIndex(for: position)
    if positionEventsEnabled {
      eventDelegate?.bottomSheetHostingView(self, didChangePosition: position, index: index)
    }
    if activeSpring == nil {
      updateScrim()
    }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    cancelDeferredContentHeightRefresh()
    stopDisplayLink()
  }
}
