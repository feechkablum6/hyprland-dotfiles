#!/bin/bash
set -e

# Configuration
CONFIG_DIR="$HOME/.config"
BIN_DIR="$HOME/.local/bin"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to backup and link
link_config() {
    local src="$1"
    local dest="$2"

    echo -e "${BLUE}Processing $src -> $dest${NC}"

    # Check if source exists
    if [ ! -e "$src" ]; then
        echo -e "${YELLOW}Warning: Source $src does not exist. Skipping.${NC}"
        return
    fi

    # Create parent directory if it doesn't exist
    mkdir -p "$(dirname "$dest")"

    # Backup if destination exists
    if [ -e "$dest" ] || [ -L "$dest" ]; then
        if [ -L "$dest" ]; then
            echo "  Removing existing symlink $dest"
            rm "$dest"
        else
            backup_name="${dest}.bak.$(date +%Y%m%d%H%M%S)"
            echo "  Backing up existing config to $backup_name"
            mv "$dest" "$backup_name"
        fi
    fi

    # Create symlink
    ln -s "$src" "$dest"
    echo -e "${GREEN}  Linked $src to $dest${NC}"
}

# Ensure directories exist
mkdir -p "$CONFIG_DIR"
mkdir -p "$BIN_DIR"

echo -e "${BLUE}Starting installation...${NC}"

# List of directories to link to ~/.config/
CONFIGS=("ags" "gtk-3.0" "gtk-4.0" "hypr" "kitty" "rofi" "swaync" "waybar")

for config in "${CONFIGS[@]}"; do
    link_config "$REPO_DIR/$config" "$CONFIG_DIR/$config"
done

# specialized linking for dolphinrc
link_config "$REPO_DIR/dolphinrc" "$CONFIG_DIR/dolphinrc"

# Link scripts in bin/ to ~/.local/bin/
echo -e "${BLUE}Linking scripts...${NC}"
if [ -d "$REPO_DIR/bin" ]; then
    for script in "$REPO_DIR/bin"/*; do
        if [ -f "$script" ]; then
            script_name=$(basename "$script")
            link_config "$script" "$BIN_DIR/$script_name"
            chmod +x "$script"
        fi
    done
else
    echo -e "${YELLOW}Warning: bin directory not found.${NC}"
fi

echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "${YELLOW}To apply changes:${NC}"
echo "1. Reload Hyprland configuration:"
echo "   hyprctl reload"
echo ""
echo "2. Restart AGS/Waybar:"
echo "   The reload command might handle this, but if not:"
echo "   killall ags waybar"
echo "   $HOME/.local/bin/start-ags &"
echo "   (If the bar doesn't appear, check ~/.cache/ags/ags-run.log)"
echo ""
echo "3. For full effect (environment variables, etc.), log out and log back in."
