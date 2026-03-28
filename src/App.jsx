import { useState, useEffect, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const SYSTEM = `You are the Boxing Muscle AI Coach — a direct, no-BS boxing and fitness coach built by Petros at Boxing Muscle. Short, sharp, results-focused. No fluff, no filler.

Job:
1. Onboard: collect goal, experience level, days/week available — one question at a time.
2. After collecting all three, tell the user their plan is ready but you need their details first. Say something like: "Plan's built. Drop your details and I'll unlock it plus send you a free Boxing Nutrition Guide." Do NOT reveal the plan yet.
3. Once the system tells you the details have been captured, deliver the full custom weekly training plan with specific sessions. End it with exactly: [CTA]
4. After the plan is delivered, answer follow-up questions briefly and honestly — then always end with [CTA] to push them toward 1-on-1 coaching with Petros. Make it clear the free plan is just the starting point.
5. If they ask for another plan, adjustments, or a new program: tell them this is a one-time free plan. For a fully personalised evolving program, they need to work directly with Petros. End with [CTA].

Rules:
- Never open with filler like "great question", "absolutely", "of course".
- Use line breaks for readability. Bullets/numbers only for exercise lists.
- Every response after the plan is delivered must end with [CTA].
- Tone: tough love. Straight talk. No coddling.`;

const INIT_PROMPT = "Introduce yourself in 2 sentences max. Then ask what their goal is — give 3 options: lose fat and get lean, build a fighter's body, or learn boxing from scratch.";

const QR = {
  goal: ["Lose fat and get lean", "Build a fighter's body", "Learn boxing from scratch"],
  exp:  ["Beginner", "Intermediate", "Advanced"],
  days: ["3 days/week", "4 days/week", "5 days/week", "6 days/week"],
  free: ["Fix my jab", "Improve footwork", "I trained today", "What should I eat?"],
};

const COUNTRY_CODES = [
  { label: "US (+1)",      value: "+1" },
  { label: "UK (+44)",     value: "+44" },
  { label: "Cyprus (+357)",value: "+357" },
  { label: "Greece (+30)", value: "+30" },
  { label: "Canada (+1)",  value: "+1-CA" },
  { label: "Australia (+61)", value: "+61" },
  { label: "Germany (+49)",value: "+49" },
  { label: "France (+33)", value: "+33" },
  { label: "Italy (+39)",  value: "+39" },
  { label: "Spain (+34)",  value: "+34" },
  { label: "UAE (+971)",   value: "+971" },
  { label: "South Africa (+27)", value: "+27" },
  { label: "Netherlands (+31)", value: "+31" },
  { label: "Sweden (+46)", value: "+46" },
  { label: "Norway (+47)", value: "+47" },
  { label: "Denmark (+45)", value: "+45" },
  { label: "Ireland (+353)", value: "+353" },
  { label: "Portugal (+351)", value: "+351" },
  { label: "Switzerland (+41)", value: "+41" },
  { label: "Belgium (+32)", value: "+32" },
];

// Strip the "-CA" suffix for actual dialing
function dialCode(val) { return val.replace(/-[A-Z]+$/, ""); }

// ── API ───────────────────────────────────────────────────────────────────────
async function chat(messages, maxTokens = 1000) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: SYSTEM, messages, max_tokens: maxTokens }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Something went wrong. Try again.";
}

async function submitLead(payload) {
  const res = await fetch(`${API_URL}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <Av coach />
      <div style={{ ...S.bubble, ...S.coach, display: "flex", gap: 5, alignItems: "center", padding: "14px 16px" }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8001D", display: "inline-block", animation: `bop 1.2s infinite ${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function Av({ coach }) {
  return <div style={coach ? S.avCoach : S.avUser}>{coach ? "BM" : "YOU"}</div>;
}

function renderMd(text) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
  return { __html: html };
}

function Msg({ role, text }) {
  const isCoach = role === "assistant";
  const hasCTA  = isCoach && text.includes("[CTA]");
  const body    = hasCTA ? text.split("[CTA]")[0].trim() : text;
  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isCoach ? "row" : "row-reverse", maxWidth: "90%", alignSelf: isCoach ? "flex-start" : "flex-end", animation: "up .3s ease forwards", opacity: 0 }}>
      <Av coach={isCoach} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ ...S.label, color: isCoach ? "#8B0010" : "#555" }}>{isCoach ? "Boxing Muscle Coach" : "You"}</div>
        <div style={{ ...S.bubble, ...(isCoach ? S.coach : S.user) }} dangerouslySetInnerHTML={isCoach ? renderMd(body) : undefined}>{isCoach ? undefined : body}</div>
        {hasCTA && (
          <div style={S.ctaCard}>
            <p style={{ fontSize: 13, color: "#ccc", marginBottom: 10 }}>Want the full program — supplement protocols, advanced training blocks, and 1:1 coaching with Petros?</p>
            <a href="https://boxingmuscle.com" target="_blank" rel="noreferrer" style={S.ctaBtn}>GET THE FULL PROGRAM</a>
          </div>
        )}
      </div>
    </div>
  );
}

function Gate({ onSubmit }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [country, setCountry] = useState("+1");
  const [phone,   setPhone]   = useState("");
  const [err,     setErr]     = useState("");
  const [busy,    setBusy]    = useState(false);

  function fullPhone() { return dialCode(country) + phone.replace(/\D/g, ""); }

  async function submit() {
    if (!name.trim())                                  { setErr("Name is required."); return; }
    if (!email.includes("@") || !email.includes(".")) { setErr("Enter a valid email address."); return; }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 6) { setErr("Enter a valid phone number."); return; }

    setBusy(true); setErr("");
    try {
      const res  = await fetch(`${API_URL}/api/lead-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: fullPhone() }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); return; }
      onSubmit(name.trim(), email.trim(), fullPhone());
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ animation: "up .4s ease forwards", opacity: 0 }}>
      <div style={S.gateCard}>
        <div style={S.gateBadge}>PLAN READY</div>
        <div style={S.gateTitle}>Your custom plan is built.</div>
        <div style={S.gateSub}>Drop your details to unlock it — plus a free Boxing Nutrition Guide.</div>
        <input style={S.gateInput} placeholder="First name *" value={name}
          onChange={e => { setName(e.target.value); setErr(""); }}
          onFocus={e => e.target.style.borderColor = "#E8001D"}
          onBlur={e => e.target.style.borderColor = "#2A2A2A"} />
        <input style={S.gateInput} type="email" placeholder="Email address *" value={email}
          onChange={e => { setEmail(e.target.value); setErr(""); }}
          onFocus={e => e.target.style.borderColor = "#E8001D"}
          onBlur={e => e.target.style.borderColor = "#2A2A2A"} />
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...S.gateInput, width: 160, flexShrink: 0, cursor: "pointer" }}
            value={country} onChange={e => setCountry(e.target.value)}>
            {COUNTRY_CODES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input style={{ ...S.gateInput, flex: 1 }} placeholder="Phone number *" value={phone} type="tel"
            onChange={e => { setPhone(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            onFocus={e => e.target.style.borderColor = "#E8001D"}
            onBlur={e => e.target.style.borderColor = "#2A2A2A"} />
        </div>
        {err && <div style={{ fontSize: 12, color: "#E8001D", fontFamily: "'DM Mono',monospace" }}>{err}</div>}
        <button style={{ ...S.gateBtn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
          {busy ? "UNLOCKING..." : "UNLOCK MY PLAN"}
        </button>
        <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace" }}>No spam. One free plan per person.</div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [history,  setHistory]  = useState([]);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState(0);
  const [qrSet,    setQrSet]    = useState(null);
  const [progress, setProgress] = useState(0);
  const [showGate, setShowGate] = useState(false);
  const [userData, setUserData] = useState({ goal: "", experience: "", days: "" });
  const bottom    = useRef(null);
  const gateShown = useRef(false);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, showGate]);

  // Boot
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const reply = await chat([{ role: "user", content: INIT_PROMPT }], 200);
        const clean = reply.replace("[CTA]", "").trim();
        setHistory([{ role: "assistant", content: clean }]);
        setMessages([{ role: "assistant", text: reply }]);
        setQrSet("goal"); setStep(1); setProgress(10);
      } catch {
        const fb = "Boxing Muscle AI Coach. What's your goal?";
        setHistory([{ role: "assistant", content: fb }]);
        setMessages([{ role: "assistant", text: fb }]);
        setQrSet("goal"); setStep(1);
      }
      setLoading(false);
    })();
  }, []);

  async function send(text) {
    if (loading || !text.trim()) return;
    const t = text.trim();
    setInput(""); setQrSet(null);

    const newUserData = { ...userData };
    if (step === 1) newUserData.goal = t;
    if (step === 2) newUserData.experience = t;
    if (step === 3) newUserData.days = t;
    setUserData(newUserData);

    const newHistory = [...history, { role: "user", content: t }];
    setHistory(newHistory);
    setMessages(prev => [...prev, { role: "user", text: t }]);

    let nextStep = step;
    if (step === 1) { nextStep = 2; setProgress(33); }
    else if (step === 2) { nextStep = 3; setProgress(66); }
    else if (step === 3) { nextStep = 4; setProgress(90); }
    setStep(nextStep);

    setLoading(true);
    try {
      const reply = await chat(newHistory);
      const clean = reply.replace("[CTA]", "").trim();
      setHistory(prev => [...prev, { role: "assistant", content: clean }]);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);

      if (nextStep === 2) setQrSet("exp");
      else if (nextStep === 3) setQrSet("days");
      else if (nextStep === 4 && !gateShown.current) {
        gateShown.current = true;
        setTimeout(() => setShowGate(true), 600);
      } else setQrSet("free");
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setLoading(false);
  }

  async function handleGate(name, email, phone) {
    await submitLead({ name, email, phone, ...userData });
    setShowGate(false);
    setProgress(100);

    const unlockMsg = `The user's details have been captured and verified. Their name is ${name}. Now deliver their full custom weekly training plan based on their goal, experience, and availability. Make it specific and actionable.`;
    const newHistory = [...history, { role: "user", content: unlockMsg }];
    setHistory(newHistory);

    setLoading(true);
    try {
      const reply = await chat(newHistory);
      const clean = reply.replace("[CTA]", "").trim();
      setHistory(prev => [...prev, { role: "assistant", content: clean }]);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setQrSet("free");
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; font-family: 'DM Sans', sans-serif; }
        @keyframes up  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bop { 0%,60%,100% { transform:translateY(0); opacity:.4; } 30% { transform:translateY(-5px); opacity:1; } }
        @keyframes dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        textarea:focus, input:focus, select:focus { outline: none; }
        textarea::placeholder, input::placeholder { color: #666; }
        select { appearance: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 2px; }
      `}</style>

      <div style={S.app}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={S.logoIcon}>BM</div>
            <div>
              <div style={S.logoText}>Boxing Muscle</div>
              <div style={S.logoSub}>AI Coach - Free Access</div>
            </div>
          </div>
          <div style={S.badge}>
            <div style={S.dot} />ONLINE
          </div>
        </div>

        {/* Progress */}
        <div style={{ height: 2, background: "#2A2A2A", flexShrink: 0 }}>
          <div style={{ height: "100%", background: "#E8001D", width: `${progress}%`, transition: "width .6s ease" }} />
        </div>

        {/* Messages */}
        <div style={S.messages}>
          {messages.map((m, i) => <Msg key={i} role={m.role} text={m.text} />)}
          {loading && <TypingDots />}
          {showGate && !loading && <Gate onSubmit={handleGate} />}
          <div ref={bottom} />
        </div>

        {/* Quick replies */}
        {qrSet && !loading && !showGate && (
          <div style={S.qrs}>
            {QR[qrSet].map(o => (
              <button key={o} style={S.qrBtn}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#E8001D"; e.currentTarget.style.color = "#E8001D"; e.currentTarget.style.background = "rgba(232,0,29,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2A2A"; e.currentTarget.style.color = "#F0F0F0"; e.currentTarget.style.background = "transparent"; }}
                onClick={() => send(o)}>{o}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={S.inputArea}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={showGate ? "Enter your details above to unlock your plan..." : "Type your question..."}
            disabled={showGate}
            rows={1}
            style={{ ...S.textarea, opacity: showGate ? 0.4 : 1 }}
            onFocus={e => e.target.style.borderColor = "#E8001D"}
            onBlur={e => e.target.style.borderColor = "#2A2A2A"}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading || showGate}
            style={{ ...S.sendBtn, background: (!input.trim() || loading || showGate) ? "#1A1A1A" : "#E8001D" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white" style={{ opacity: (!input.trim() || loading || showGate) ? 0.3 : 1 }}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

      </div>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app:      { display: "flex", flexDirection: "column", height: "100vh", maxWidth: 780, margin: "0 auto", borderLeft: "1px solid #2A2A2A", borderRight: "1px solid #2A2A2A", background: "#0A0A0A" },
  header:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #2A2A2A", background: "#111", flexShrink: 0 },
  logoIcon: { width: 38, height: 38, background: "#E8001D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: "white", flexShrink: 0 },
  logoText: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.08em", color: "#F0F0F0", lineHeight: 1 },
  logoSub:  { fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#E8001D", letterSpacing: "0.15em", textTransform: "uppercase", lineHeight: 1, marginTop: 3 },
  badge:    { display: "flex", alignItems: "center", gap: 7, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#666", letterSpacing: "0.05em" },
  dot:      { width: 7, height: 7, background: "#22c55e", borderRadius: "50%", animation: "dot 2s infinite" },
  messages: { flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 },
  avCoach:  { width: 32, height: 32, flexShrink: 0, background: "#E8001D", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 },
  avUser:   { width: 32, height: 32, flexShrink: 0, background: "#1A1A1A", color: "#666", border: "1px solid #2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 11 },
  label:    { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" },
  bubble:   { padding: "12px 16px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", borderRadius: 2 },
  coach:    { background: "#111", borderLeft: "2px solid #E8001D", color: "#F0F0F0" },
  user:     { background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#F0F0F0" },
  ctaCard:  { marginTop: 10, padding: "14px 16px", background: "rgba(232,0,29,0.07)", border: "1px solid rgba(232,0,29,0.3)", borderRadius: 2 },
  ctaBtn:   { display: "inline-block", padding: "8px 18px", background: "#E8001D", color: "white", textDecoration: "none", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: "0.1em" },
  qrs:      { display: "flex", flexWrap: "wrap", gap: 8, padding: "0 24px 16px", flexShrink: 0 },
  qrBtn:    { padding: "7px 14px", background: "transparent", border: "1px solid #2A2A2A", color: "#F0F0F0", fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.05em", cursor: "pointer", transition: "all .15s", borderRadius: 1 },
  inputArea:{ display: "flex", padding: "16px 24px 20px", borderTop: "1px solid #2A2A2A", background: "#111", flexShrink: 0 },
  textarea: { flex: 1, background: "#0A0A0A", border: "1px solid #2A2A2A", borderRight: "none", color: "#F0F0F0", fontFamily: "'DM Sans',sans-serif", fontSize: 14, padding: "12px 16px", resize: "none", lineHeight: 1.5, minHeight: 48, maxHeight: 140, transition: "border-color .15s" },
  sendBtn:  { width: 56, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s", flexShrink: 0 },
  gateCard: { background: "#111", border: "1px solid #2A2A2A", borderLeft: "2px solid #E8001D", padding: 24, borderRadius: 2, display: "flex", flexDirection: "column", gap: 12 },
  gateBadge:{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.15em", color: "#E8001D", textTransform: "uppercase" },
  gateTitle:{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: "0.05em", color: "#F0F0F0", lineHeight: 1 },
  gateSub:  { fontSize: 13, color: "#999", lineHeight: 1.6 },
  gateInput:{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F0F0F0", fontFamily: "'DM Sans',sans-serif", fontSize: 14, padding: "11px 14px", borderRadius: 1, transition: "border-color .15s" },
  gateBtn:  { padding: "12px 20px", background: "#E8001D", color: "white", border: "none", fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, letterSpacing: "0.1em", cursor: "pointer" },
};
