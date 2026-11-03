import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe2, LockKeyhole, RefreshCw } from "lucide-react";
import "./SevenDSTierApp.css";

const SOURCE = "https://7dsgc.fandom.com/wiki/General_Tier_List";

export default function SevenDSTierApp() {
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([SOURCE]);
  const [index, setIndex] = useState(0);
  const current = history[index];
  const navigate = (next: number) => {
    if (next < 0 || next >= history.length) return;
    setIndex(next);
    setLoading(true);
    setRevision(v => v + 1);
  };
  const refresh = () => { setLoading(true); setRevision(v => v + 1); };
  const home = () => {
    if (current === SOURCE) { refresh(); return; }
    setHistory(h => [...h.slice(0, index + 1), SOURCE]);
    setIndex(i => i + 1);
    setLoading(true);
  };
  return (
    <div className="oxygen-7ds-browser">
      <div className="oxygen-7ds-browser-tabs">
        <div className="oxygen-7ds-browser-tab"><Globe2 size={15} /> 7DS Grand Cross — General Tier List</div>
      </div>
      <div className="oxygen-7ds-browser-toolbar">
        <button title="Back" aria-label="Back" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft size={17}/></button>
        <button title="Forward" aria-label="Forward" disabled={index === history.length - 1} onClick={() => navigate(index + 1)}><ArrowRight size={17}/></button>
        <button title="Reload" aria-label="Reload" onClick={refresh}><RefreshCw size={16}/></button>
        <button title="Go to tier list" aria-label="Go to tier list" onClick={home}><Globe2 size={17}/></button>
        <div className="oxygen-7ds-browser-address"><LockKeyhole size={14}/><span>{current.replace(/^https:\/\//, "")}</span></div>
        <button title="Open in Chrome or default browser" aria-label="Open in browser" onClick={() => window.open(current, "_blank", "noopener,noreferrer")}><ExternalLink size={17}/></button>
      </div>
      <div className="oxygen-7ds-browser-content">
        {loading && <div className="oxygen-7ds-browser-loading">Loading 7DS Grand Cross tier list…</div>}
        <iframe key={`${index}-${revision}`} title="7DS Grand Cross General Tier List" src={`${current}${current.includes("?") ? "&" : "?"}oxygen_refresh=${revision}`} onLoad={() => setLoading(false)} referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    </div>
  );
}
