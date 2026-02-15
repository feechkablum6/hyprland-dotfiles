# Detailed Repository Documentation

This document provides a comprehensive overview of the configuration files and scripts contained in this repository. These dotfiles are designed for an Arch Linux system running the Hyprland window manager.

## Table of Contents
- [Overview](#overview)
- [Directory Structure](#directory-structure)
  - [ags/](#ags)
  - [bin/](#bin)
  - [gtk-3.0/ & gtk-4.0/](#gtk-30--gtk-40)
  - [hypr/](#hypr)
  - [kitty/](#kitty)
  - [rofi/](#rofi)
  - [swaync/](#swaync)
  - [waybar/](#waybar)
- [Other Files](#other-files)
- [Installation](#installation)

## Overview

The repository contains configurations for a customized desktop environment featuring:
- **Window Manager**: Hyprland
- **Status Bar**: Aylur's GTK Shell (AGS) as the primary bar, with Waybar as a fallback.
- **Launcher**: Rofi
- **Notifications**: SwayNotificationCenter (SwayNC)
- **Terminal**: Kitty
- **Theme**: Adwaita-dark (GTK) / Fusion (Qt)

## Directory Structure

### `ags/`

Configuration for Aylur's GTK Shell (AGS), which provides the top status bar and widgets.

- **`shell.tsx`**: The main configuration file written in TypeScript/JSX. It defines the layout and behavior of the status bar and widgets.
  - **Bar**: Contains Launcher, Workspaces, Media Player (left), Clock (center), Network, Volume, Battery, Notifications, Power (right).
  - **MediaPopup**: A popup window for media controls (cover art, title, artist, timeline, controls).
  - **Logic**: Includes complex logic for polling media players (Mpris), handling volume, network status, and battery.
- **`config.js`**: A JavaScript configuration file. The `start-ags` script explicitly uses `shell.tsx`, so this might be an alternative or legacy config.
- **`style.css`**: CSS styles for the AGS widgets.
- **`assets/`**: Contains images like `empty-cover.png` used as a placeholder for album art.
- **`icons/`**: Contains service icons (e.g., for YouTube, Yandex Music) used in the media player widget.

### `bin/`

Helper scripts, typically installed to `~/.local/bin/`.

- **`media-menu`**: A Rofi-based script to control media players. It lists available players and offers controls for Play/Pause, Previous, Next, Seek, and Volume. It also fetches and displays album art.
- **`powermenu`**: A power management script. It launches `wlogout` if installed; otherwise, it opens a Rofi menu with options to Suspend, Reboot, Shutdown, and Logout.
- **`screenshot-area`**: A script to take screenshots.
  - Uses `slurp` to select a region and `grim` to capture it.
  - Saves screenshots to `XDG_PICTURES_DIR/Screenshots` with a timestamp.
  - Copies the screenshot to the clipboard.
  - Supports an `--edit` flag to open the screenshot in `swappy` for annotation.
- **`start-ags`**: The startup script for AGS.
  - Checks if AGS is installed and is the correct version (not Adventure Game Studio).
  - Kills any existing instances of AGS or Waybar.
  - Launches AGS with `shell.tsx`.
  - Falls back to `waybar` if AGS is missing or fails.
- **`update-service-icons`**: Downloads favicon images for services (YouTube, Yandex Music) from Google's favicon service and saves them to `~/.config/ags/icons/services/`.

### `gtk-3.0/` & `gtk-4.0/`

- **`settings.ini`**: Configuration files for GTK 3 and GTK 4, ensuring consistent theming (Adwaita-dark) across applications.

### `hypr/`

Configuration for the Hyprland window manager.

- **`hyprland.conf`**: The main configuration file.
  - **Monitor**: Auto-configures monitors.
  - **Autostart**: Launches `start-ags`, `hyprpaper`, `swaync`, authentication agent, and clipboard manager.
  - **Keybindings**:
    - `Super + Q`: Terminal (Kitty)
    - `Super + E`: File Manager (Dolphin)
    - `Super + R`: Launcher (Rofi)
    - `Super + N`: Notifications (SwayNC)
    - `Super + Esc`: Power Menu
    - `Print`: Screenshot
    - `Shift + Print`: Screenshot (Edit)
  - **Layout**: Uses the `dwindle` layout with gaps and rounded corners.
  - **Input**: Configures keyboard layout (US, RU) with `Alt+Shift` switching.
- **`hyprpaper.conf`**: Configuration for the wallpaper utility. It preloads and sets the wallpaper from `~/.local/share/wallpapers/wallpaper.png`.

### `kitty/`

- **`kitty.conf`**: Configuration for the Kitty terminal.
  - Sets font to `JetBrainsMono Nerd Font`.
  - Configures keybindings for tab/window management (compatible with Russian layout).
  - Enables clipboard integration.

### `rofi/`

Configuration for the Rofi application launcher.

- **`config.rasi`**: Main configuration file defining the font, icon theme, and display format.
- **`theme.rasi`**: Defines the visual theme (colors, borders, transparency) for Rofi.
- **`media.rasi`**: A specific theme used by the `media-menu` script, likely optimized for displaying media info and controls.

### `swaync/`

Configuration for SwayNotificationCenter.

- **`config.json`**: Defines the layout and widgets of the notification center.
  - Includes a "Do Not Disturb" toggle, Clear All button, and a grid of buttons for WiFi, Bluetooth, and Audio Mute.
  - Configures the Mpris (media) widget.
- **`style.css`**: CSS styles for the notification center to match the system theme.

### `waybar/`

Fallback status bar configuration.

- **`config.jsonc`**: Configuration file for Waybar modules.
  - **Left**: Launcher, Workspaces, Media Player.
  - **Center**: Clock.
  - **Right**: Network, PulseAudio, Battery, Tray, Notifications, Power.
- **`style.css`**: CSS styles for Waybar.

## Other Files

- **`README.md`**: Basic installation instructions.
- **`dolphinrc`**: Configuration file for the Dolphin file manager.

## Installation

1.  **Copy Configs**:
    Copy the contents of the `.config` directories to your user's config directory:
    ```bash
    cp -r ags gtk-3.0 gtk-4.0 hypr kitty rofi swaync waybar ~/.config/
    ```

2.  **Copy Scripts**:
    Copy the `bin` directory to `~/.local/`:
    ```bash
    cp -r bin ~/.local/
    ```
    Ensure the scripts are executable:
    ```bash
    chmod +x ~/.local/bin/*
    ```

3.  **Dependencies**:
    Ensure you have the required packages installed:
    - `hyprland`, `hyprpaper`
    - `aylurs-gtk-shell-git` (AGS), `libastal-meta`, `gvfs`
    - `waybar` (fallback)
    - `rofi`
    - `swaync`
    - `kitty`
    - `slurp`, `grim`, `wl-copy`, `swappy` (for screenshots)
    - `playerctl` (for media control)
    - `brightnessctl` (optional, for brightness)
    - `pamixer` (optional, for volume)
