// icons.jsx — Minimal stroke icon set. 16x16 viewBox, currentColor.
// All icons same visual weight (1.5 stroke). Single source of truth.

const SVG = ({ children, size = 16, stroke = 1.5, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

const Icon = {
  Dashboard: (p) => (
    <SVG {...p}><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></SVG>
  ),
  Grid: (p) => (
    <SVG {...p}><rect x="2" y="2" width="4" height="4" rx="0.6"/><rect x="10" y="2" width="4" height="4" rx="0.6"/><rect x="2" y="10" width="4" height="4" rx="0.6"/><rect x="10" y="10" width="4" height="4" rx="0.6"/></SVG>
  ),
  Folder: (p) => (
    <SVG {...p}><path d="M2 4.2c0-.7.5-1.2 1.2-1.2h2.6c.4 0 .7.1.9.4l.8.9c.2.3.5.4.9.4H13c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H3.2A1.2 1.2 0 0 1 2 12.3V4.2Z"/></SVG>
  ),
  Image: (p) => (
    <SVG {...p}><rect x="2" y="3" width="12" height="10" rx="1.2"/><circle cx="6" cy="7" r="1.1"/><path d="M14 11l-2.5-2.5-4 4"/></SVG>
  ),
  Clock: (p) => (
    <SVG {...p}><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></SVG>
  ),
  Doc: (p) => (
    <SVG {...p}><path d="M4 2h5l3 3v9c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1Z"/><path d="M9 2v3h3"/><path d="M5.5 9h5M5.5 11.5h3.5"/></SVG>
  ),
  Tag: (p) => (
    <SVG {...p}><path d="M2 8.5V3a1 1 0 0 1 1-1h5.5L14 7.5 7.5 14 2 8.5Z"/><circle cx="5.4" cy="5.4" r="0.9" fill="currentColor"/></SVG>
  ),
  Magic: (p) => (
    <SVG {...p}><path d="M4 12 12 4M11 3l1 1M3 13l1 1M13.5 6.5l1 1M2 9l1 1M9 1.5l.5 1.5L11 3.5l-1.5.5L9 5.5 8.5 4 7 3.5 8.5 3 9 1.5Z"/></SVG>
  ),
  Settings: (p) => (
    <SVG {...p}><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.4M8 13.1v1.4M3 3l1 1M12 12l1 1M1.5 8h1.4M13.1 8h1.4M3 13l1-1M12 4l1-1"/></SVG>
  ),
  Shield: (p) => (
    <SVG {...p}><path d="M8 1.5 2.5 3.5v4c0 3.5 2.5 5.5 5.5 7 3-1.5 5.5-3.5 5.5-7v-4L8 1.5Z"/></SVG>
  ),
  Users: (p) => (
    <SVG {...p}><circle cx="6" cy="5.5" r="2.4"/><path d="M2 13c.5-2 2-3 4-3s3.5 1 4 3"/><circle cx="11.5" cy="6" r="1.8"/><path d="M10.5 13c.4-1.6 1.4-2.5 3-2.5"/></SVG>
  ),
  Server: (p) => (
    <SVG {...p}><rect x="2" y="3" width="12" height="4" rx="0.8"/><rect x="2" y="9" width="12" height="4" rx="0.8"/><circle cx="5" cy="5" r="0.5" fill="currentColor"/><circle cx="5" cy="11" r="0.5" fill="currentColor"/></SVG>
  ),
  Cube: (p) => (
    <SVG {...p}><path d="m8 2 5.5 3v6L8 14l-5.5-3V5L8 2Z"/><path d="m2.5 5 5.5 3 5.5-3M8 8v6"/></SVG>
  ),
  Stats: (p) => (
    <SVG {...p}><path d="M2 13h12M4 11V8M7 11V5M10 11V7M13 11V3"/></SVG>
  ),
  Backup: (p) => (
    <SVG {...p}><path d="M3.5 9.5a4.5 4.5 0 1 1 9-1.5"/><path d="M8 5v3l2 1.5"/><path d="M3 12 5 14l2-2"/></SVG>
  ),
  ChevronLeft:(p) => <SVG {...p}><path d="m10 3-4 5 4 5"/></SVG>,
  ChevronRight:(p) => <SVG {...p}><path d="m6 3 4 5-4 5"/></SVG>,
  ChevronDown:(p) => <SVG {...p}><path d="m3 6 5 4 5-4"/></SVG>,
  Plus: (p) => <SVG {...p}><path d="M8 3v10M3 8h10"/></SVG>,
  Trash: (p) => <SVG {...p}><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9.2c0 .5.4.8.8.8h3.4c.4 0 .8-.3.8-.8L11 4"/></SVG>,
  Edit: (p) => <SVG {...p}><path d="M11 2.5 13.5 5l-8 8L2 14l1-3.5 8-8Z"/></SVG>,
  Play: (p) => <SVG {...p}><path d="M5 3v10l8-5L5 3Z" fill="currentColor"/></SVG>,
  Pause:(p) => <SVG {...p}><rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor"/></SVG>,
  Star: (p) => <SVG {...p}><path d="m8 2 1.8 3.8 4 .6-3 2.8.8 4L8 11.4l-3.6 1.8.8-4L2.2 6.4l4-.6L8 2Z"/></SVG>,
  StarFill: (p) => <SVG {...p}><path d="m8 2 1.8 3.8 4 .6-3 2.8.8 4L8 11.4l-3.6 1.8.8-4L2.2 6.4l4-.6L8 2Z" fill="currentColor"/></SVG>,
  Check: (p) => <SVG {...p}><path d="m3 8 3.5 3.5L13 5"/></SVG>,
  CheckCircle: (p) => <SVG {...p}><circle cx="8" cy="8" r="6"/><path d="M5 8.2 7.3 10.5 11 6.5"/></SVG>,
  X: (p) => <SVG {...p}><path d="m4 4 8 8M12 4l-8 8"/></SVG>,
  Search: (p) => <SVG {...p}><circle cx="7" cy="7" r="4.5"/><path d="m13.5 13.5-3-3"/></SVG>,
  Filter: (p) => <SVG {...p}><path d="M2 3h12l-4.5 5v4l-3 1.5V8L2 3Z"/></SVG>,
  Copy: (p) => <SVG {...p}><rect x="2.5" y="2.5" width="8" height="8" rx="1"/><path d="M5.5 13.5h7c.6 0 1-.4 1-1v-7"/></SVG>,
  Drag: (p) => <SVG {...p}><circle cx="6" cy="3.5" r="1" fill="currentColor"/><circle cx="10" cy="3.5" r="1" fill="currentColor"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="6" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/></SVG>,
  Bolt: (p) => <SVG {...p}><path d="M9 1.5 3.5 9h3.5l-1 5.5L13 7H9.5l-.5-5.5Z"/></SVG>,
  Sparkle: (p) => <SVG {...p}><path d="M8 1.5 9 5.5l4 1-4 1-1 4-1-4-4-1 4-1 1-4Z"/><path d="M13 11l.5 1.5L15 13l-1.5.5L13 15l-.5-1.5L11 13l1.5-.5L13 11Z"/></SVG>,
  Wand: (p) => <SVG {...p}><path d="M3 13 12 4M11 3l1 1M2 8l1-1M5 4l-1-1M14 11l1 1"/></SVG>,
  Pipe: (p) => <SVG {...p}><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><path d="M5.5 4H10M4 5.5V10M12 5.5V10M5.5 12H10"/></SVG>,
  Globe: (p) => <SVG {...p}><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.7 2 2.5 4 2.5 6S9.7 14 8 14"/><path d="M8 2C6.3 4 5.5 6 5.5 8s.8 4 2.5 6"/></SVG>,
  Eye: (p) => <SVG {...p}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></SVG>,
  Bell: (p) => <SVG {...p}><path d="M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3L4 11Z"/><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/></SVG>,
  ArrowRight: (p) => <SVG {...p}><path d="M3 8h10M9 4l4 4-4 4"/></SVG>,
  ArrowDown: (p) => <SVG {...p}><path d="M8 3v10M4 9l4 4 4-4"/></SVG>,
  Refresh: (p) => <SVG {...p}><path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4"/><path d="M12.5 1.5V4H10M3.5 14.5V12H6"/></SVG>,
  Layers: (p) => <SVG {...p}><path d="m8 2 6 3-6 3-6-3 6-3Z"/><path d="m2 8 6 3 6-3M2 11l6 3 6-3"/></SVG>,
  Type: (p) => <SVG {...p}><path d="M3 4V3h10v1M8 3v10M6 13h4"/></SVG>,
  Robot: (p) => <SVG {...p}><rect x="2.5" y="5" width="11" height="8" rx="1.5"/><path d="M5 5V3.5M8 2.5V5M11 5V3.5"/><circle cx="6" cy="9" r="0.8" fill="currentColor"/><circle cx="10" cy="9" r="0.8" fill="currentColor"/><path d="M6.5 11.5h3"/></SVG>,
  Send: (p) => <SVG {...p}><path d="m2 8 12-5.5L8.5 14 7 9 2 8Z"/></SVG>,
  Info: (p) => <SVG {...p}><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></SVG>,
  Menu: (p) => <SVG {...p}><path d="M2 4h12M2 8h12M2 12h12"/></SVG>,
  Dots: (p) => <SVG {...p}><circle cx="4" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/></SVG>,
  Link: (p) => <SVG {...p}><path d="M7 5H4.5a3 3 0 0 0 0 6H7M9 5h2.5a3 3 0 0 1 0 6H9M6 8h4"/></SVG>,
  Lock: (p) => <SVG {...p}><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></SVG>,
  Spinner: (p) => <SVG {...p}><circle cx="8" cy="8" r="5.5" strokeOpacity="0.25"/><path d="M13.5 8A5.5 5.5 0 0 0 8 2.5"/></SVG>,
};

window.Icon = Icon;
