require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'EntangleUdp'
  s.version        = package['version']
  s.summary        = 'Datagram socket for Entangle pointer frames'
  s.description    = 'Sends pointer frames over UDP, off the reliable stream that would hold them behind a retransmit.'
  s.author         = ''
  s.homepage       = 'https://github.com/gabrieldonadel/entangle'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
