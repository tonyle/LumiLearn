import Image from "next/image";
import QRCode from "qrcode";

export default async function Settings() {
  const ai = process.env.AI_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY);
  const ipadUrl = process.env.IPAD_APP_URL;
  const qrCode = ipadUrl
    ? await QRCode.toDataURL(ipadUrl, { width: 256, margin: 4, errorCorrectionLevel: "M" })
    : null;

  return <div className="stack">
    <header><span className="eyebrow">Home server</span><h1>Privacy & settings</h1></header>
    <div className="split">
      <section className="card">
        <h2>System status</h2>
        <p><span className="pill">● Local host online</span></p>
        <p><span className="pill" style={{ background: ai ? "#ecfdf5" : "#f1f5f9", color: ai ? "#065f46" : "#475569" }}>AI {ai ? "enabled" : "disabled"}</span></p>
        <p className="muted">For handwritten page grading, add OPENAI_API_KEY to .env and restart with npm run docker:start. Submitted papers can also be graded in Worksheet review.</p>
        <p className="muted">API keys never enter browser bundles or responses. External AI also requires explicit parental opt-in.</p>
      </section>
      <section className="card">
        <h2>iPad connection</h2>
        <p>Connect the iPad to the same non-guest Wi-Fi, then scan the QR code with Camera or open the address in Safari.</p>
        {ipadUrl && qrCode ? <>
          <p><a href={ipadUrl}>{ipadUrl}</a></p>
          <Image src={qrCode} alt={`Scan to open LumiLearn on your iPad: ${ipadUrl}`} width={256} height={256} unoptimized style={{ maxWidth: "100%", height: "auto" }} />
          <p className="muted">If the host’s Wi-Fi IP changes, restart with npm run docker:start to refresh this address and QR code.</p>
        </> : <p className="muted">Start the server with npm run docker:start to detect the host’s Wi-Fi address and generate the iPad QR code automatically.</p>}
        <p className="notice">Keep public router port forwarding off. Plain HTTP is for a trusted home LAN only.</p>
      </section>
    </div>
  </div>;
}
