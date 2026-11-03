import { useState } from "react";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import "./SevenDSTierApp.css";

const SOURCE = "https://7dsgc.fandom.com/wiki/General_Tier_List";

export default function SevenDSTierApp() {
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const url = `${SOURCE}?oxygen_refresh=${revision}`;
  return (
    <section className="oxygen-7ds-live">
      <header className="oxygen-7ds-live-header">
        <div className="oxygen-7ds-live-heading">
          <span className="oxygen-7ds-live-eyebrow">SEVEN DEADLY SINS: GRAND CROSS</span>
          <h2>General Tier List</h2>
          <p>Live from the 7DS Grand Cross Wiki · Original character portraits and rankings</p>
        </div>
        <div className="oxygen-7ds-live-actions">
          <button type="button" onClick={() => { setLoaded(false); setRevision(v => v + 1); }}><RefreshCw size={16} /> Refresh</button>
          <a href={SOURCE} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open original</a>
        </div>
      </header>
      <div className="oxygen-7ds-live-notice">
        <ShieldAlert size={17} />
        <span>This displays the original wiki, not a copied tier list. If the frame is blank or blocked, choose <strong>Open original</strong> to see the current pictures and rankings.</span>
        <button type="button" onClick={() => setShowHelp(v => !v)}>{showHelp ? "Hide info" : "Why?"}</button>
      </div>
      {showHelp && <p className="oxygen-7ds-live-help">Some websites prevent embedding for security reasons. Oxygen Desktop cannot override the wiki's restrictions. Opening the original page always uses the wiki's current content.</p>}
      <div className="oxygen-7ds-live-frame-wrap">
        {!loaded && <div className="oxygen-7ds-live-loading">Loading the latest tier list from Fandom…</div>}
        <iframe key={revision} title="7DS Grand Cross General Tier List — live Fandom page" src={url} onLoad={() => setLoaded(true)} referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <footer className="oxygen-7ds-live-footer">Source: <a href={SOURCE} target="_blank" rel="noopener noreferrer">7dsgc.fandom.com/wiki/General_Tier_List</a> · Changes on the wiki appear when refreshed.</footer>
    </section>
  );
}
