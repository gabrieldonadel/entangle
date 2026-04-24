require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'EntangleServer'
  s.version        = package['version']
  s.summary        = 'Entangle remote mouse server module'
  s.description    = 'Bonjour-advertised WebSocket server and CGEvent bridge for the Entangle desktop app.'
  s.author         = ''
  s.homepage       = 'https://github.com/entangle'
  s.platforms      = { :osx => '11.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
