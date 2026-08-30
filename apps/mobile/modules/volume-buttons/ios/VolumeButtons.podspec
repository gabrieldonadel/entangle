require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'VolumeButtons'
  s.version        = package['version']
  s.summary        = 'Hardware volume button events'
  s.description    = 'Reports iPhone volume button presses as a direction so they can drive the connected Mac.'
  s.author         = ''
  s.homepage       = 'https://github.com/entangle'
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
