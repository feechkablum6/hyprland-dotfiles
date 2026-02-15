import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Service from 'resource:///com/github/Aylur/ags/service.js';
import Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';

const hyprland = await Service.import('hyprland');
const mpris = await Service.import('mpris');
const audio = await Service.import('audio');
const network = await Service.import('network');
const battery = await Service.import('battery');
const systemtray = await Service.import('systemtray');

const exec = (cmd) => Utils.execAsync(['bash', '-lc', cmd]).catch(() => '');

const activePlayer = () => {
  const players = mpris.players || [];
  return players.find(p => p.play_back_status === 'Playing') || players[0] || null;
};

let hideMediaId = 0;
const openMedia = () => {
  if (hideMediaId) {
    GLib.source_remove(hideMediaId);
    hideMediaId = 0;
  }
  App.openWindow('media');
};

const closeMediaLater = () => {
  if (hideMediaId)
    GLib.source_remove(hideMediaId);
  hideMediaId = Utils.timeout(220, () => {
    App.closeWindow('media');
    hideMediaId = 0;
  });
};

const Pill = (child, className = '') => Widget.Box({
  className: `pill ${className}`.trim(),
  child,
});

const Launcher = () => Widget.Button({
  className: 'pill launcher',
  label: '',
  onClicked: () => exec('rofi -show drun -show-icons'),
});

const WorkspaceDots = () => {
  const dispatch = (ws) => hyprland.messageAsync(`dispatch workspace ${ws}`).catch(() => '');

  const mk = (id) => Widget.Button({
    className: 'ws-dot',
    label: '○',
    onClicked: () => dispatch(id),
    attribute: id,
    setup: self => self.hook(hyprland.active.workspace, () => {
      const active = hyprland.active.workspace.id;
      self.label = (active === id) ? '●' : '○';
      self.toggleClassName('active', active === id);
    }),
  });

  return Pill(Widget.EventBox({
    onScrollUp: () => dispatch('+1'),
    onScrollDown: () => dispatch('-1'),
    child: Widget.Box({
      className: 'workspaces',
      spacing: 4,
      children: [1, 2, 3, 4, 5].map(mk),
    }),
  }), 'workspaces-pill');
};

const MediaPill = () => {
  const icon = Widget.Label({
    className: 'media-icon',
    label: '󰎆',
  });

  const text = Widget.Label({
    className: 'media-text',
    truncate: 'end',
    maxWidthChars: 28,
    xalign: 0,
    label: '',
  });

  const box = Widget.Box({
    spacing: 8,
    children: [icon, text],
  });

  const w = Widget.EventBox({
    onHover: () => openMedia(),
    onHoverLost: () => closeMediaLater(),
    onPrimaryClick: () => {
      const p = activePlayer();
      if (p) p.playPause();
      return true;
    },
    onScrollUp: () => {
      const p = activePlayer();
      if (p) p.next();
      return true;
    },
    onScrollDown: () => {
      const p = activePlayer();
      if (p) p.previous();
      return true;
    },
    child: box,
    setup: self => self.hook(mpris, () => {
      const p = activePlayer();
      self.visible = !!p;
      if (!p) return;

      icon.label = '󰎆';
      if (p.name === 'spotify') icon.label = '󰓇';
      if (p.name === 'firefox') icon.label = '󰈹';
      if (p.name === 'chromium') icon.label = '󰊯';

      const artist = (p.track_artists || []).join(', ');
      const title = p.track_title || '';
      text.label = [artist, title].filter(Boolean).join(' - ');
    }),
  });

  return Pill(w, 'media');
};

const Clock = () => {
  const label = Widget.Label({
    className: 'clock',
    label: '',
    setup: self => self.poll(1000, () => {
      const d = new Date();
      const fmt = d.toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
      self.label = fmt.replace(',', '');
    }),
  });
  return Pill(label, 'clock-pill');
};

const Network = () => {
  const icon = Widget.Icon({
    icon: network.wifi.bind('icon_name'),
    size: 16,
  });
  const label = Widget.Label({
    className: 'net',
    label: network.wifi.bind('strength').as(s => (typeof s === 'number') ? `${s}%` : ''),
  });

  const stack = Widget.Stack({
    children: {
      wifi: Widget.Box({ spacing: 8, children: [icon, label] }),
      wired: Widget.Icon({ icon: network.wired.bind('icon_name'), size: 16 }),
    },
    shown: network.bind('primary').as(p => p || 'wifi'),
  });

  return Pill(Widget.Button({
    child: stack,
    tooltipText: 'Network',
    onClicked: () => exec('nm-connection-editor || true'),
  }), 'net-pill');
};

const Volume = () => {
  const icon = Widget.Icon({
    size: 16,
    setup: self => self.hook(audio.speaker, () => {
      const vol = Math.floor((audio.speaker?.volume || 0) * 100);
      const muted = !!audio.speaker?.is_muted;
      let name = 'audio-volume-muted-symbolic';
      if (!muted) {
        if (vol >= 67) name = 'audio-volume-high-symbolic';
        else if (vol >= 34) name = 'audio-volume-medium-symbolic';
        else if (vol >= 1) name = 'audio-volume-low-symbolic';
        else name = 'audio-volume-muted-symbolic';
      }
      self.icon = name;
    }),
  });

  const label = Widget.Label({
    className: 'vol',
    label: audio.speaker.bind('volume').as(v => `${Math.floor((v || 0) * 100)}%`),
  });

  return Pill(Widget.Button({
    child: Widget.Box({ spacing: 8, children: [icon, label] }),
    tooltipText: 'Volume',
    onClicked: () => { audio.speaker.is_muted = !audio.speaker.is_muted; },
    onScrollUp: () => { audio.speaker.volume = Math.min(1, audio.speaker.volume + 0.02); return true; },
    onScrollDown: () => { audio.speaker.volume = Math.max(0, audio.speaker.volume - 0.02); return true; },
  }), 'vol-pill');
};

const Battery = () => {
  const icon = Widget.Icon({
    size: 16,
    icon: battery.bind('icon_name'),
  });
  const label = Widget.Label({
    className: 'bat',
    label: battery.bind('percent').as(p => (typeof p === 'number') ? `${p}%` : ''),
  });
  return Pill(Widget.Box({ spacing: 8, children: [icon, label] }), 'bat-pill');
};

const Tray = () => {
  const SysTrayItem = item => Widget.Button({
    className: 'tray-item',
    child: Widget.Icon({ size: 16 }).bind('icon', item, 'icon'),
    tooltipMarkup: item.bind('tooltip_markup'),
    onPrimaryClick: (_, event) => item.activate(event),
    onSecondaryClick: (_, event) => item.openMenu(event),
  });

  return Pill(Widget.Box({
    className: 'tray',
    spacing: 8,
    children: systemtray.bind('items').as(items => items.map(SysTrayItem)),
  }), 'tray-pill');
};

const Notifs = () => Pill(Widget.Button({
  label: '󰂚',
  tooltipText: 'Notifications',
  onClicked: () => exec('swaync-client -t'),
  onSecondaryClick: () => exec('swaync-client -d'),
}), 'notifs-pill');

const Power = () => Pill(Widget.Button({
  label: '󰐥',
  tooltipText: 'Power',
  onClicked: () => exec('$HOME/.local/bin/powermenu'),
}), 'power-pill');

const Bar = (monitor = 0) => Widget.Window({
  name: `bar-${monitor}`,
  className: 'bar-window',
  monitor,
  anchor: ['top', 'left', 'right'],
  exclusivity: 'exclusive',
  layer: 'top',
  margins: [10, 12, 0, 12],
  child: Widget.CenterBox({
    className: 'bar',
    startWidget: Widget.Box({
      spacing: 8,
      children: [Launcher(), WorkspaceDots(), MediaPill()],
    }),
    centerWidget: Clock(),
    endWidget: Widget.Box({
      spacing: 8,
      children: [Network(), Volume(), Battery(), Tray(), Notifs(), Power()],
    }),
  }),
});

const MediaPopup = (monitor = 0) => {
  const cover = Widget.Box({
    className: 'media-cover',
  });

  const title = Widget.Label({
    className: 'media-title',
    xalign: 0,
    truncate: 'end',
    maxWidthChars: 36,
    label: '',
  });

  const artist = Widget.Label({
    className: 'media-artist',
    xalign: 0,
    truncate: 'end',
    maxWidthChars: 36,
    label: '',
  });

  const timeNow = Widget.Label({ className: 'media-time', label: '0:00' });
  const timeEnd = Widget.Label({ className: 'media-time', label: '0:00' });

  const fmt = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const posSlider = Widget.Slider({
    className: 'media-slider',
    hexpand: true,
    drawValue: false,
    min: 0,
    max: 1,
    value: 0,
    onChange: ({ value }) => {
      const p = activePlayer();
      if (!p) return;
      exec(`playerctl -p ${p.name} position ${Math.floor(value)}`);
    },
  });

  const volSlider = Widget.Slider({
    className: 'media-vol',
    hexpand: true,
    drawValue: false,
    min: 0,
    max: 1,
    value: 0,
    onChange: ({ value }) => {
      const p = activePlayer();
      if (p && typeof p.volume === 'number' && p.volume >= 0) {
        exec(`playerctl -p ${p.name} volume ${value.toFixed(2)}`);
      } else {
        audio.speaker.volume = value;
      }
    },
  });

  const btn = (label, fn) => Widget.Button({ className: 'media-btn', label, onClicked: fn });

  const controls = Widget.Box({
    className: 'media-controls',
    spacing: 10,
    children: [
      btn('󰒭', () => { const p = activePlayer(); if (p) p.previous(); }),
      btn('󰐊', () => { const p = activePlayer(); if (p) p.playPause(); }),
      btn('󰒮', () => { const p = activePlayer(); if (p) p.next(); }),
      btn('󰥺', () => { const p = activePlayer(); if (p) exec(`playerctl -p ${p.name} position 10-`); }),
      btn('󰥹', () => { const p = activePlayer(); if (p) exec(`playerctl -p ${p.name} position 10+`); }),
    ],
  });

  let pollId = 0;
  const stopPoll = () => {
    if (pollId) {
      GLib.source_remove(pollId);
      pollId = 0;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollId = Utils.interval(1000, () => {
      const p = activePlayer();
      if (!p) return;

      const lenSec = (p.length > 0) ? (p.length / 1000000) : 0;
      posSlider.max = Math.max(1, lenSec);
      timeEnd.label = fmt(lenSec);

      exec(`playerctl -p ${p.name} position`).then(out => {
        const posSec = parseFloat(String(out).trim());
        if (Number.isFinite(posSec)) {
          posSlider.value = Math.min(posSlider.max, Math.max(0, posSec));
          timeNow.label = fmt(posSec);
        }
      });

      if (typeof p.volume === 'number' && p.volume >= 0) {
        volSlider.value = Math.min(1, Math.max(0, p.volume));
      } else {
        volSlider.value = Math.min(1, Math.max(0, audio.speaker.volume));
      }
    });
  };

  const content = Widget.EventBox({
    className: 'media-popup',
    onHover: () => openMedia(),
    onHoverLost: () => closeMediaLater(),
    child: Widget.Box({
      spacing: 14,
      children: [
        cover,
        Widget.Box({
          vertical: true,
          hexpand: true,
          spacing: 10,
          children: [
            Widget.Box({ vertical: true, spacing: 4, children: [title, artist] }),
            controls,
            Widget.Box({ spacing: 10, children: [timeNow, posSlider, timeEnd] }),
            Widget.Box({ spacing: 10, children: [Widget.Label({ label: '󰕾' }), volSlider] }),
          ],
        }),
      ],
    }),
    setup: self => self.hook(mpris, () => {
      const p = activePlayer();
      self.visible = !!p;
      if (!p) return;

      title.label = p.track_title || '';
      artist.label = (p.track_artists || []).join(', ');

      const art = p.cover_path || '';
      if (art)
        cover.css = `background-image: url("${art}");`;
      else
        cover.css = 'background-image: none;';
    }),
  });

  return Widget.Window({
    name: 'media',
    className: 'media-window',
    monitor,
    layer: 'overlay',
    anchor: ['top'],
    margins: [62, 0, 0, 0],
    visible: false,
    setup: self => {
      self.connect('notify::visible', () => {
        if (self.visible) startPoll();
        else stopPoll();
      });
    },
    child: content,
  });
};

App.config({
  style: './style.css',
  windows: [
    Bar(0),
    MediaPopup(0),
  ],
});
