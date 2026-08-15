import QuartzCore

/// Critically damped (ζ = 1): reaches the target as fast as possible without overshooting.
/// Port of @swmansion/react-native-bottom-sheet `CriticalSpring`.
struct CriticalSpring {
  let from: CGFloat
  let target: CGFloat
  let v0: CGFloat
  let omega: CGFloat
  let startTime: CFTimeInterval
  let duration: CFTimeInterval

  func value(at time: CFTimeInterval) -> CGFloat {
    let t = CGFloat(max(0, time - startTime))
    let a = from - target
    let decay = exp(-omega * t)
    return target + decay * (a + (v0 + omega * a) * t)
  }

  func keyframeValues(count: Int) -> [CGFloat] {
    let n = max(count, 1)
    return (0 ... n).map { i in
      let t = duration * CFTimeInterval(i) / CFTimeInterval(n)
      return value(at: startTime + t)
    }
  }
}
