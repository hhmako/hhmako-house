import AppKit
import ApplicationServices
import Carbon.HIToolbox
import Foundation

enum BridgeError: Error, CustomStringConvertible {
  case accessibilityNotTrusted
  case figmaNotRunning
  case figmaMenuBarNotFound
  case missingAttribute(String)
  case missingMenuItem(String)
  case actionFailed(String, AXError)

  var description: String {
    switch self {
    case .accessibilityNotTrusted:
      return "Accessibility permission is not enabled. Allow your terminal app or launcher in System Settings -> Privacy & Security -> Accessibility."
    case .figmaNotRunning:
      return "Figma is not running. Open Figma Desktop first."
    case .figmaMenuBarNotFound:
      return "Could not find the active Figma menu bar. Bring a Figma design file window to the front and try again."
    case .missingAttribute(let name):
      return "Could not read accessibility attribute: \(name)."
    case .missingMenuItem(let name):
      return "Could not find Figma menu item: \(name). Make sure the plugin is imported as a development plugin."
    case .actionFailed(let action, let error):
      return "Accessibility action failed: \(action) (\(error.rawValue))."
    }
  }
}

func requireAccessibility() throws {
  let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
  if !AXIsProcessTrustedWithOptions(options) {
    throw BridgeError.accessibilityNotTrusted
  }
}

func children(of element: AXUIElement) throws -> [AXUIElement] {
  var value: CFTypeRef?
  let error = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value)
  guard error == .success else { return [] }
  return (value as? [AXUIElement]) ?? []
}

func attributeElement(_ element: AXUIElement, _ attribute: String) throws -> AXUIElement {
  var value: CFTypeRef?
  let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
  guard error == .success, let result = value else {
    throw BridgeError.missingAttribute(attribute)
  }
  return result as! AXUIElement
}

func title(of element: AXUIElement) -> String {
  var value: CFTypeRef?
  let error = AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &value)
  guard error == .success else { return "" }
  return (value as? String) ?? ""
}

func findChild(named name: String, in element: AXUIElement) throws -> AXUIElement {
  for child in try children(of: element) {
    if title(of: child) == name {
      return child
    }
  }
  throw BridgeError.missingMenuItem(name)
}

func press(_ element: AXUIElement, label: String) throws {
  let error = AXUIElementPerformAction(element, kAXPressAction as CFString)
  guard error == .success else {
    throw BridgeError.actionFailed(label, error)
  }
}

func waitForFigma() throws -> NSRunningApplication {
  for _ in 0..<30 {
    if let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.figma.Desktop")
      .first(where: { !$0.isTerminated }) {
      app.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
      return app
    }
    Thread.sleep(forTimeInterval: 0.2)
  }
  throw BridgeError.figmaNotRunning
}

func figmaAppElementWithPluginsMenu() throws -> (NSRunningApplication, AXUIElement, AXUIElement) {
  let candidates = NSRunningApplication.runningApplications(withBundleIdentifier: "com.figma.Desktop")
    .filter { !$0.isTerminated }

  if candidates.isEmpty {
    throw BridgeError.figmaNotRunning
  }

  for app in candidates {
    let appElement = AXUIElementCreateApplication(app.processIdentifier)
    var menuBarValue: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(appElement, kAXMenuBarAttribute as CFString, &menuBarValue)
    guard error == .success, let menuBar = menuBarValue else {
      continue
    }

    if (try? findChild(named: "Plugins", in: menuBar as! AXUIElement)) != nil {
      return (app, appElement, menuBar as! AXUIElement)
    }
  }

  throw BridgeError.figmaMenuBarNotFound
}

func firstMenu(in menuItem: AXUIElement) throws -> AXUIElement {
  for child in try children(of: menuItem) {
    var roleValue: CFTypeRef?
    AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleValue)
    if (roleValue as? String) == kAXMenuRole {
      return child
    }
  }
  throw BridgeError.missingAttribute("AXMenu")
}

func postKey(_ keyCode: CGKeyCode, flags: CGEventFlags = []) {
  let source = CGEventSource(stateID: .hidSystemState)
  let down = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true)
  let up = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
  down?.flags = flags
  up?.flags = flags
  down?.post(tap: .cghidEventTap)
  up?.post(tap: .cghidEventTap)
}

func pasteText(_ text: String) {
  let pasteboard = NSPasteboard.general
  pasteboard.clearContents()
  pasteboard.setString(text, forType: .string)
  postKey(CGKeyCode(kVK_ANSI_V), flags: .maskCommand)
}

func openPluginFromActionsSearch(_ figma: NSRunningApplication) {
  figma.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
  Thread.sleep(forTimeInterval: 0.8)

  postKey(CGKeyCode(kVK_ANSI_Slash), flags: .maskCommand)
  Thread.sleep(forTimeInterval: 0.8)
  pasteText("Codex PingFang Bridge")
  Thread.sleep(forTimeInterval: 0.5)
  postKey(CGKeyCode(kVK_Return))
}

do {
  try requireAccessibility()
  _ = try waitForFigma()
  Thread.sleep(forTimeInterval: 0.5)

  let figma = NSRunningApplication.runningApplications(withBundleIdentifier: "com.figma.Desktop")
    .first(where: { !$0.isTerminated })!

  do {
    let (_figma, _appElement, menuBar) = try figmaAppElementWithPluginsMenu()
    _figma.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
    Thread.sleep(forTimeInterval: 0.5)

    let pluginsItem = try findChild(named: "Plugins", in: menuBar)
    try press(pluginsItem, label: "Plugins")
    Thread.sleep(forTimeInterval: 0.35)

    let pluginsMenu = try firstMenu(in: pluginsItem)
    let developmentItem = try findChild(named: "Development", in: pluginsMenu)
    try press(developmentItem, label: "Development")
    Thread.sleep(forTimeInterval: 0.35)

    let developmentMenu = try firstMenu(in: developmentItem)
    let bridgeItem = try findChild(named: "Codex PingFang Bridge", in: developmentMenu)
    try press(bridgeItem, label: "Codex PingFang Bridge")
  } catch {
    openPluginFromActionsSearch(figma)
  }

  print("Opened Codex PingFang Bridge.")
} catch {
  fputs("\(error)\n", stderr)
  exit(1)
}
