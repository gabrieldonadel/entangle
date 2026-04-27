import AppKit
import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, NSWindowDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private var statusItem: NSStatusItem?

  public override func applicationDidFinishLaunching(_ notification: Notification) {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    setupStatusItem()

    let launchOptions = notification.userInfo
    window = UIWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 720),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    window?.delegate = self
    window?.isReleasedWhenClosed = false
    window?.collectionBehavior = [.managed, .fullScreenPrimary]
    window?.center()
    window?.orderOut(nil)

    return super.applicationDidFinishLaunching(notification)
  }

  // MARK: - Menu bar

  private func setupStatusItem() {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    if let button = item.button {
      let image = NSImage(named: "menubar")
      image?.isTemplate = true
      button.image = image
      button.target = self
      button.action = #selector(statusItemClicked(_:))
      button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }
    statusItem = item
  }

  @objc private func statusItemClicked(_ sender: NSStatusBarButton) {
    guard let event = NSApp.currentEvent else {
      toggleWindow()
      return
    }
    let isRightClick = event.type == .rightMouseUp
      || event.modifierFlags.contains(.control)

    if isRightClick {
      let menu = NSMenu()
      menu.addItem(NSMenuItem(
        title: "Quit Entangle",
        action: #selector(NSApplication.terminate(_:)),
        keyEquivalent: "q"))
      statusItem?.menu = menu
      sender.performClick(nil)
      statusItem?.menu = nil
    } else {
      toggleWindow()
    }
  }

  private func toggleWindow() {
    guard let window = window else { return }
    if window.isVisible {
      window.orderOut(nil)
    } else {
      window.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
    }
  }

  // MARK: - NSWindowDelegate

  func windowShouldClose(_ sender: NSWindow) -> Bool {
    sender.orderOut(nil)
    return false
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsLocation = "localhost:8090"
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
