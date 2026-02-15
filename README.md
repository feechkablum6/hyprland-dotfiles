# Hyprland Dotfiles

Конфигурационные файлы для Hyprland системы на Arch Linux.

## Структура

- `hypr/` - Конфиг Hyprland (WM)
- `ags/` - Верхняя панель (GTK приложение)
- `waybar/` - Нижняя панель
- `rofi/` - App launcher
- `kitty/` - Терминал
- `swaync/` - Уведомления
- `gtk-3.0/` / `gtk-4.0/` - GTK темы
- `bin/` - Скрипты

## Документация

Подробное описание всех файлов и директорий доступно в [DOCUMENTATION.md](DOCUMENTATION.md).

## Установка

```bash
cp -r .config/* ~/.config/
cp -r bin ~/.local/
```
