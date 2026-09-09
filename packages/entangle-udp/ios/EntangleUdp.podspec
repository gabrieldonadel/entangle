require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'EntangleUdp'
  s.version        = package['version']
  s.summary        = 'Datagram socket for Entangle pointer frames'
  s.description    = 'Sends pointer frames over UDP, off the reliable stream that would hold them behind a retransmit.'
  s.author         = ''
  s.homepage       = 'https://github.com/gabrieldonadel/entangle'
  # Must not be above the app's deployment target. CocoaPods does not fail on a
  # pod that requires a newer platform than the target — `use_expo_modules!`
  # skips it with a yellow warning, and the app ships with the module missing.
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
