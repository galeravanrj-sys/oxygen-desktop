import { CalendarDays, Clock3, Images, Sun, ArrowUpRight } from "lucide-react";
import "./WidgetsApp.css";

type Props = {
  time: Date;
  photoCount: number;
  onOpenGallery: () => void;
  onOpenCalendar: () => void;
};

export default function WidgetsApp({ time, photoCount, onOpenGallery, onOpenCalendar }: Props) {
  const clock = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const day = time.toLocaleDateString([], { weekday: "long" });
  const month = time.toLocaleDateString([], { month: "long" });
  return (
    <div className="m8-widgets-app">
      <header className="m8-widgets-heading">
        <span className="m8-widgets-eyebrow">M8M8S / PERSONAL SPACE</span>
        <h2>Clock & Widgets</h2>
        <p>Your day at a glance.</p>
      </header>
      <div className="m8-widgets-grid">
        <section className="m8-widget-card m8-widget-clock">
          <div className="m8-widget-label"><Sun size={18} /><span>Today</span><Clock3 size={17} className="m8-widget-corner" /></div>
          <strong className="m8-widget-time">{clock}</strong>
          <span className="m8-widget-subtitle">{date}</span>
          <div className="m8-widget-bottom"><span>M8M8S</span><span>Welcome home</span></div>
        </section>
        <button type="button" className="m8-widget-card m8-widget-action" onClick={onOpenGallery}>
          <div className="m8-widget-label"><Images size={19} /><span>Gallery</span><ArrowUpRight size={17} className="m8-widget-corner" /></div>
          <strong>{photoCount}</strong>
          <span className="m8-widget-subtitle">{photoCount === 1 ? "Saved photo" : "Saved photos"}</span>
        </button>
        <button type="button" className="m8-widget-card m8-widget-action" onClick={onOpenCalendar}>
          <div className="m8-widget-label"><CalendarDays size={19} /><span>Calendar</span><ArrowUpRight size={17} className="m8-widget-corner" /></div>
          <strong>{time.getDate()}</strong>
          <span className="m8-widget-subtitle">{month} · {day}</span>
        </button>
      </div>
    </div>
  );
}
