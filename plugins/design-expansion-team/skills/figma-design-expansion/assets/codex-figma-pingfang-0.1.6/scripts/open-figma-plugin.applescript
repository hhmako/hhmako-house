delay 1

tell application "System Events"
  repeat 30 times
    if exists menu bar 1 of process "Figma" then exit repeat
    delay 0.2
  end repeat

  tell process "Figma"
    set frontmost to true
    click menu bar item "Plugins" of menu bar 1
    delay 0.4

    set pluginsMenu to menu "Plugins" of menu bar item "Plugins" of menu bar 1
    click menu item "Development" of pluginsMenu
    delay 0.4

    set developmentMenu to menu "Development" of menu item "Development" of pluginsMenu
    click menu item "Codex PingFang Bridge" of developmentMenu
  end tell
end tell
