Pod::Spec.new do |s|
  s.name           = 'NativeBottomSheet'
  s.version        = '0.1.0'
  s.summary        = 'Native Swift and Kotlin bottom sheet for React Native'
  s.description    = 'Detents, critical-spring snap, scrim, and scrollable negotiation.'
  s.author         = 'ngocdevv'
  s.homepage       = 'https://github.com/ngocdevv/native-bottom-sheet'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
