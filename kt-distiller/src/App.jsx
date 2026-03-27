import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, AlignLeft, File, X,
  Stethoscope, Landmark, Heart, Users, FlaskConical,
  Linkedin, Facebook, Image, MessageSquare, Video, Mail, Globe,
  Check, ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  Sparkles, Loader2, PenLine, BookOpen, ShieldCheck,
  AlertCircle, AlertTriangle, CheckCircle, CornerDownRight,
  FileCheck, Copy, Download, BookmarkCheck, RotateCcw,
  Shield, User, Layout, Calendar
} from "lucide-react";

// ─── API Configuration ────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const ANTHROPIC_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MB = 20;

const STEPS = ["Source","Audience","Distil","Format","Build","Audit","Export"];

const AUDIENCES = [
  { id: "clinicians",     icon: Stethoscope, title: "Clinicians & Healthcare Providers",         description: "Physicians, OTs/PTs, and rehab specialists focused on clinical outcomes." },
  { id: "policy",         icon: Landmark,    title: "Policy Makers & Administrators",             description: "Health system leaders and government officials focused on systems and legislation." },
  { id: "patients",       icon: Heart,       title: "Individuals with Disabilities & Caregivers", description: "Patients and family members focused on lived experience and self-advocacy." },
  { id: "cab",            icon: Users,       title: "Community Advisory Boards (CABs)",           description: "Strategic partners ensuring research aligns with lived experience and local priorities." },
  { id: "researchers",    icon: FlaskConical,title: "Academic Researchers",                       description: "Scientists and trainees focused on methodology and data gaps." },
  { id: "general_public", icon: Globe,       title: "General Public",                             description: "Non-specialized individuals interested in health, wellness, and disability news." },
];

const AUDIENCE_TITLE = Object.fromEntries(AUDIENCES.map(a => [a.id, a.title]));

const MODALITIES = [
  { id:"linkedin",  icon:Linkedin,      title:"LinkedIn Post",        category:"Social",  tone:"Professional · Academic",  tags:["~300 words","Hashtags","Engagement hook"], description:"Structured post with evidence hook, key finding, and academic hashtags." },
  { id:"facebook",  icon:Facebook,      title:"Facebook Post",        category:"Social",  tone:"Community · Conversational",tags:["~200 words","Group-friendly","Conversational"],description:"Warm, accessible post designed for community group sharing." },
  { id:"instagram", icon:Image,         title:"Instagram Carousel",   category:"Social",  tone:"Visual · Slide-based",     tags:["5-7 slides","Slide captions","Visual-first"],description:"Breaks Key Takeaways into individual slides." },
  { id:"threads_x", icon:MessageSquare, title:"Threads / X Thread",   category:"Social",  tone:"Concise · Punchy",         tags:["5-7 posts","280 chars each","Thread format"],description:"A numbered thread format for fast consumption." },
  { id:"tiktok",    icon:Video,         title:"TikTok / Reels Script",category:"Video",   tone:"Hook-driven · Visual",     tags:["60 sec script","On-screen text","Hook + 3 pts"],description:"60-second script with hook, 3 points, and on-screen captions.",featured:true },
  { id:"email",     icon:Mail,          title:"Email / ListServ",     category:"Direct",  tone:"Direct · Action-oriented", tags:["Subject line","~200 words","CTA included"],description:"Ready-to-send email with subject line and clear call to action." },
  { id:"webpage",   icon:Globe,         title:"Web Page Summary",     category:"Digital", tone:"Accessible · Structured",  tags:["H1/H2 headers","WCAG-friendly","Scannable"],description:"H1/H2 header structure for screen-reader accessibility." },
  { id:"fact_sheet",icon:FileText,      title:"1-Page Fact Sheet",    category:"Print",   tone:"High-density · Clinical",  tags:["Print-ready","Bulleted","Clinic-friendly"],description:"Print-ready one-pager for clinic or community distribution." },
];
const MODALITY_MAP = Object.fromEntries(MODALITIES.map(m => [m.id, m]));
const CATEGORY_ORDER = ["Social","Video","Direct","Digital","Print"];

// ─── Persona & prompt logic ───────────────────────────────────────────────────

const PERSONAS = {
  "Clinicians & Healthcare Providers":         { tone:"Professional and technical. Write as a peer communicating to a fellow clinician.", focus:"Evidence strength, clinical utility, and direct applicability to practice. Prioritise effect sizes, confidence intervals, and NNT/NNH where relevant.", plsStyle:"A structured professional summary (not lay language). Include study design, primary outcome, and effect size in the first paragraph.", sowhatAngle:"How does this change or reinforce current clinical practice? Is there a practice gap this addresses?", takeawayVerbs:"Implement, Screen, Monitor, Refer, Prioritise", glossaryDepth:"Define only terms a non-specialist clinician might not know. Skip basic clinical terminology.", languageLevel:"Professional/technical. Active voice. No filler." },
  "Policy Makers & Administrators":            { tone:"Formal and strategic. Write as a policy brief author addressing a senior government official.", focus:"Systems-level impact, cost implications, equity considerations, and scalability of findings.", plsStyle:"Executive summary style. Lead with the bottom line, then the evidence.", sowhatAngle:"What policy lever does this activate? What would it cost to act — or not act — on this evidence?", takeawayVerbs:"Allocate, Mandate, Evaluate, Integrate, Commission", glossaryDepth:"Define all clinical and research jargon.", languageLevel:"Formal but accessible. Active voice. Avoid academic hedging." },
  "Individuals with Disabilities & Caregivers":{ tone:"Warm, plain, and empowering. Write as a trusted advocate speaking directly to a person affected by this research.", focus:"Daily life impact, self-advocacy, and what this means for the person's rights, choices, and care.", plsStyle:"Plain language at an 8th-grade reading level. No jargon. Use short sentences and common words.", sowhatAngle:"How does this research directly affect my daily life, my options, or my ability to advocate for myself?", takeawayVerbs:"Ask, Advocate, Share, Request, Know", glossaryDepth:"Define every technical term. Assume no medical or research background. Use analogies.", languageLevel:"Plain language, Grade 8 target. People-First language. Active voice only." },
  "Community Advisory Boards (CABs)":         { tone:"Collaborative, transparent, and equity-focused. Write as a research partner speaking to community stewards.", focus:"Community alignment, equity, co-design opportunities, and whether the research reflects lived experience.", plsStyle:"Plain language at an 8th-grade reading level. Acknowledge what the research did and did not do to centre community voice.", sowhatAngle:"Does this research align with what our community has been asking for? What gaps remain?", takeawayVerbs:"Champion, Align, Question, Co-design, Amplify", glossaryDepth:"Define all research and clinical terms. Use language that respects community expertise.", languageLevel:"Plain, respectful, and transparent. Active voice. Disability-affirming language." },
  "Academic Researchers":                      { tone:"Analytical and technical. Write as a methods-focused peer reviewer.", focus:"Methodological rigour, effect sizes, confidence intervals, bias risks, generalisability limits, and future research directions.", plsStyle:"Structured abstract-style summary covering: background, design, primary outcome, key results (with statistics), and limitations.", sowhatAngle:"What does this study add to the existing evidence base? What methodological gaps does it expose?", takeawayVerbs:"Replicate, Investigate, Control for, Synthesise, Challenge", glossaryDepth:"Only define terms outside the standard research methods canon.", languageLevel:"Technical and precise. Active voice. Statistical reporting in APA/AMA style." },
  "General Public":                            { tone:"Engaging, informative, and relatable. Write in a journalistic style — like a health columnist in a major newspaper speaking to a curious, non-specialist reader.", focus:"The big picture. Explain why this research matters to society as a whole. Lead with the human angle, spotlight interesting or surprising facts, and answer: 'Why would a neighbour or friend find this interesting?'", plsStyle:"Journalistic plain language at a 9th–10th grade reading level. Open with a compelling hook — a striking stat, a relatable scenario, or a surprising finding. Use short paragraphs and everyday vocabulary. No medical jargon or academic phrasing.", sowhatAngle:"Why does this research matter to ordinary people going about their daily lives? What broader health trend or social issue does it illuminate?", takeawayVerbs:"Learn, Understand, Consider, Discover, Share", glossaryDepth:"Define every technical or medical term using simple analogies. Assume zero specialist background.", languageLevel:"Plain language, Grade 9–10 target. Conversational but credible. Active voice. No jargon." },
};

function buildDistilPrompt(audienceTitle, source) {
  const p = PERSONAS[audienceTitle] || PERSONAS["Individuals with Disabilities & Caregivers"];
  return `You are an expert Knowledge Translation (KT) scientist. Distil the source text into a structured KT brief for: "${audienceTitle}".

PERSONA: Tone: ${p.tone} | Focus: ${p.focus} | Language: ${p.languageLevel}
CONSTRAINTS: Active voice always. CDHW disability-inclusive language. No filler. No hedging unless scientifically required.
CRUCIAL REQUIREMENT: You must include any counter-intuitive or surprising findings from the distillation (e.g., factors that were expected to be positive but showed negative correlations) to ensure the audience understands the full complexity of the evidence.

SOURCE TEXT:
${source}

Output ONLY these six labelled sections. No preamble.

PLAIN LANGUAGE SUMMARY:
${p.plsStyle} Write 150-200 words. You MUST explicitly surface any counter-intuitive or surprising findings (e.g., factors expected to be positive that showed negative correlations) — do not omit or soften these.

THE SO WHAT?:
Exactly 2 sentences. ${p.sowhatAngle} Start with a strong active verb.

KEY TAKEAWAYS:
Exactly 5 bullet points starting with action verbs (${p.takeawayVerbs}). Format: - [Verb] ... At least one bullet MUST address a counter-intuitive or surprising finding from the evidence.

EVIDENCE BOUNDARIES:
3-5 sentences covering: who was excluded, key methodological limitations, what this study cannot conclude.

GLOSSARY:
3-5 terms from the source. ${p.glossaryDepth} Format: Term - definition

CITATION:
Extract the full bibliographic citation for this study in APA 7th edition format. Include authors, year, title, journal, volume, issue, page numbers, and DOI if present. If any element cannot be found in the source text, write [not found] for that element only.`;
}

function parseDistil(raw) {
  // Normalise: strip markdown bold/italic markers
  const normalised = raw.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1").replace(/_{1,2}([^_]+)_{1,2}/g, "$1");

  const PATTERNS = [
    { key: "pls",        re: /PLAIN\s+LANGUAGE\s+SUMMARY\s*:?/i },
    { key: "sowhat",     re: /THE\s+.{0,5}SO\s+WHAT.{0,5}\s*:?/i },
    { key: "takeaways",  re: /KEY\s+TAKEAWAYS\s*:?/i },
    { key: "boundaries", re: /EVIDENCE\s+BOUNDARIES\s*:?/i },
    { key: "glossary",   re: /GLOSSARY\s*:?/i },
    { key: "citation",   re: /CITATION\s*:?/i },
  ];

  const positions = PATTERNS.map(({ key, re }) => {
    const m = normalised.match(re);
    if (!m) return null;
    return { key, start: m.index, headingLen: m[0].length };
  }).filter(Boolean).sort((a, b) => a.start - b.start);

  const result = {};
  positions.forEach(({ key, start, headingLen }, i) => {
    const from = start + headingLen;
    const to = positions[i + 1] ? positions[i + 1].start : normalised.length;
    result[key] = normalised.slice(from, to).trim();
  });
  return result;
}

const MODALITY_PROMPTS = {
  linkedin:  { copyPrompt:(a,b,c)=>`Write a LinkedIn post for "${a}" based on this KT brief. Rules: Professional evidence-forward tone. Hook opening (stat or question). 3 paragraphs: finding, implication, CTA. 4-6 academic hashtags. 250-300 words. No emojis except optional one at end. End with a "Source:" line using the citation provided.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the post.`, visualPrompt:(a)=>`Suggest 2 specific visual assets for a LinkedIn post for "${a}".\nVISUAL 1:\n[Description]\nAlt-text: [text]\n\nVISUAL 2:\n[Description]\nAlt-text: [text]\n\nNo preamble.` },
  facebook:  { copyPrompt:(a,b,c)=>`Write a Facebook post for "${a}" from this KT brief. Rules: Warm community tone. Relatable opening. 2-3 short paragraphs. End with open discussion question. 1-3 emojis sparingly. 150-200 words. End with a "Source:" line using the citation provided.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the post.`, visualPrompt:(a)=>`Suggest 2 visual assets for a Facebook post for "${a}".\nVISUAL 1:\n[Description]\nAlt-text: [text]\n\nVISUAL 2:\n[Description]\nAlt-text: [text]\n\nNo preamble.` },
  instagram: { copyPrompt:(a,b,c)=>`Write an Instagram carousel for "${a}" from this KT brief. 6 slides. Slide 1: bold hook (8 words) + 1 sentence. Slides 2-5: one Key Takeaway each with headline + 1-2 sentences. Slide 6: CTA + 5 hashtags + "Source:" line using the citation provided. Label each SLIDE 1:, SLIDE 2:, etc.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the slide scripts.`, visualPrompt:(a)=>`Suggest 2 visual directions for an Instagram carousel for "${a}".\nVISUAL 1:\n[Hero image description]\nAlt-text: [text]\n\nVISUAL 2:\n[Slide template style]\nAlt-text: [text]\n\nNo preamble.` },
  threads_x: { copyPrompt:(a,b,c)=>`Write a 6-post Twitter/Threads thread for "${a}" from this KT brief. Post 1: hook stat/statement (max 220 chars). Posts 2-5: one idea each (max 240 chars). Post 6: CTA + 3 hashtags. Final post: "Source:" line using the citation provided (can exceed char limit). Number each: 1/, 2/, etc. 1 emoji max per post.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the thread.`, visualPrompt:(a)=>`Suggest 2 visual assets for a Threads/X thread for "${a}".\nVISUAL 1:\n[Hook card graphic]\nAlt-text: [text]\n\nVISUAL 2:\n[Data or quote card]\nAlt-text: [text]\n\nNo preamble.` },
  tiktok:    { copyPrompt:(a,b,c)=>`Write a 60-second TikTok script for "${a}" from this KT brief. Structure: HOOK (0-5s) | POINT 1 (5-20s) | POINT 2 (20-35s) | POINT 3 (35-50s) | CTA (50-60s). Each section: [SPOKEN], [ON-SCREEN TEXT], [VISUAL CUE]. Include [SOUND:] cues. Hook must stop the scroll. Plain language. After the script, add a "CITATION (for video description):" line using the citation provided.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the script.`, visualPrompt:(a)=>`Suggest 2 B-roll or visual ideas for a TikTok about this research for "${a}".\nVISUAL 1:\n[B-roll scene description]\nAlt-text: [text]\n\nVISUAL 2:\n[Second visual idea]\nAlt-text: [text]\n\nNo preamble.` },
  email:     { copyPrompt:(a,b,c)=>`Write a ListServ email for "${a}" from this KT brief. Include: SUBJECT LINE: [line]. Opening: 1 sentence why relevant. Body: 3 paragraphs (finding, implication, action). Clear CTA. Sign-off: [Your Name / Organisation]. ~200 words body. Add a "Reference:" line at the bottom using the citation provided.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the email.`, visualPrompt:(a)=>`Suggest 2 visual elements for an email for "${a}".\nVISUAL 1:\n[Header banner description]\nAlt-text: [text]\n\nVISUAL 2:\n[Inline graphic or pull-quote]\nAlt-text: [text]\n\nNo preamble.` },
  webpage:   { copyPrompt:(a,b,c)=>`Write a web page summary using H1/H2 structure for "${a}" from this KT brief. Sections: H1: page title | H2: Introduction | H2: Key Findings (3-4 bullets) | H2: What This Means for You | H2: Limitations | H2: Key Terms | H2: Reference (use the citation provided here). WCAG-friendly. ~350 words.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the structured content using H1: and H2: labels.`, visualPrompt:(a)=>`Suggest 2 visual assets for a research web page for "${a}".\nVISUAL 1:\n[Hero image description]\nAlt-text: [full descriptive alt text]\n\nVISUAL 2:\n[Data visualization suggestion]\nAlt-text: [full descriptive alt text]\n\nNo preamble.` },
  fact_sheet:{ copyPrompt:(a,b,c)=>`Write a 1-page fact sheet for "${a}" from this KT brief. Sections: TITLE: | SUBTITLE: | WHAT WE STUDIED: (2-3 sentences) | KEY FINDINGS: (4-5 bullets with bold leads) | WHAT THIS MEANS: (2-3 sentences) | LIMITATIONS: (2-3 bullets) | GLOSSARY: (3-4 inline definitions) | CITATION: (use the citation provided here exactly). No filler.\n\nBRIEF:\n${b}\n\nCITATION:\n${c}\n\nOutput ONLY the fact sheet using exact labels.`, visualPrompt:(a)=>`Suggest 2 visual/layout ideas for a clinical fact sheet for "${a}".\nVISUAL 1:\n[Header graphic suggestion]\nAlt-text: [text]\n\nVISUAL 2:\n[Layout logic suggestion]\nAlt-text: [text or N/A]\n\nNo preamble.` },
};

function parseVisuals(raw) {
  return raw.split(/VISUAL \d+:/i).filter(b => b.trim()).map(block => {
    const altMatch = block.match(/Alt-text:\s*(.+)/i);
    return { description: block.replace(/Alt-text:\s*.+/i,"").trim(), altText: altMatch ? altMatch[1].trim() : "" };
  });
}

// ─── SVG image generation via Claude ─────────────────────────────────────────
// Asks Claude to produce a self-contained SVG illustration based on the visual
// description. Returns a data: URI so it renders inline with no external requests.
async function generateSvgImage(description) {
  const prompt = `Create a clean, professional SVG illustration (800×600) for a health research communication visual.

Visual brief: ${description}

Rules:
- Output ONLY raw SVG code starting with <svg and ending with </svg>. No markdown, no explanation.
- Use a soft, editorial style: muted but warm colour palette, clean shapes, no clip-art feel.
- Include relevant iconography, simple human figures (abstract/silhouette), charts, or environmental elements as appropriate.
- Add a subtle light background (not pure white).
- The illustration should feel appropriate for a professional health or disability research publication.
- No text labels inside the SVG unless they are single short words that add meaning.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { ...ANTHROPIC_HEADERS },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "<svg" },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = "<svg " + (data.content || []).map(b => b.text || "").join("").trim();

  // Strip any accidental markdown fences
  const stripped = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();

  // If the response starts with <svg, use it directly — append </svg> if truncated
  let svg;
  const match = stripped.match(/<svg[\s\S]*<\/svg>/i);
  if (match) {
    svg = match[0];
  } else if (stripped.startsWith("<svg")) {
    svg = stripped.endsWith("</svg>") ? stripped : stripped + "\n</svg>";
  } else {
    throw new Error(`No SVG found. Response started with: ${stripped.slice(0, 120)}`);
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildAuditPrompt(source, draft) {
  return `You are a rigorous KT auditor. Audit the DRAFTED KT PRODUCT against the SOURCE TEXT.

SOURCE TEXT:
${source}

DRAFTED KT PRODUCT:
${draft}

Check for: 1. OVERCLAIMING: causation stated where only correlation shown. 2. OMISSION: critical evidence boundaries or non-significant results dropped. 3. GENERALISATION: findings applied to broader population than studied. 4. TONE: language overstating certainty. 5. ACCURACY: statistics misstated.

For each issue, output a flag in EXACTLY this format:

FLAG:
type: [red | yellow | green]
quote: [EXACT verbatim phrase from draft for string matching — do not paraphrase]
issue: [one sentence]
rule: [OVERCLAIMING | OMISSION | GENERALISATION | TONE | ACCURACY]
suggestion: [exact replacement text only, or "No change needed" for green]

End with:
SUMMARY: [1-2 sentence verdict]

Issue at least 2 non-green flags and 1 green flag. CRITICAL: quote must be character-for-character from the draft.`;
}

function parseAudit(raw) {
  const flags = [];
  raw.split(/FLAG:\s*\n/).filter(b => b.trim()).forEach(block => {
    const get = (key) => { const m = block.match(new RegExp(`^${key}:\\s*(.+)`,"im")); return m ? m[1].trim() : ""; };
    const type = get("type").toLowerCase().replace(/[^a-z]/g,"");
    if (!["red","yellow","green"].includes(type)) return;
    flags.push({ id: Math.random().toString(36).slice(2), type, quote:get("quote"), issue:get("issue"), rule:get("rule"), suggestion:get("suggestion"), accepted:false });
  });
  const sm = raw.match(/^SUMMARY:\s*(.+)/im);
  return { flags, summary: sm ? sm[1].trim() : "" };
}

function applyEdit(draft, quote, suggestion) {
  if (draft.includes(quote)) return draft.replace(quote, suggestion);
  const norm = s => s.replace(/\s+/g," ").trim();
  if (norm(draft).includes(norm(quote))) return norm(draft).replace(norm(quote), suggestion);
  const idx = draft.indexOf(quote.slice(0,40));
  if (idx !== -1) return draft.slice(0,idx) + suggestion + draft.slice(idx + quote.length);
  return draft + `\n\n[AUDITOR EDIT: ${suggestion}]`;
}

// ─── Readability helpers ──────────────────────────────────────────────────────

function countWords(t) { return t.trim() === "" ? 0 : t.trim().split(/\s+/).length; }
function countSyllables(w) { w=w.toLowerCase().replace(/[^a-z]/g,""); if(w.length<=3)return 1; w=w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,""); const m=w.match(/[aeiouy]{1,2}/g); return m?m.length:1; }
function fkGrade(text) { const sents=text.split(/[.!?]+/).filter(s=>s.trim()).length||1; const words=text.trim().split(/\s+/).filter(Boolean); if(words.length<5)return null; const syl=words.reduce((a,w)=>a+countSyllables(w),0); return Math.max(1,Math.round(0.39*(words.length/sents)+11.8*(syl/words.length)-15.59)); }

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Breadcrumb({ current }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: i < current ? "#d4d4d4" : i === current ? "#171717" : "transparent", border: i > current ? "1.5px solid #e5e5e5" : "none" }}>
              {i < current
                ? <Check size={8} color="white" strokeWidth={3} />
                : <span style={{ fontSize:8, color: i===current?"white":"#d4d4d4", fontWeight:700 }}>{i+1}</span>}
            </div>
            <span className="text-xs" style={{ color: i===current?"#171717": i<current?"#a3a3a3":"#d4d4d4" }}>{label}</span>
          </div>
          {i < STEPS.length-1 && <div className="w-3 h-px bg-neutral-200" />}
        </div>
      ))}
    </div>
  );
}

function NavFooter({ onBack, onNext, nextLabel="Next", nextDisabled=false, children }) {
  return (
    <footer className="bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-700 transition-colors">
        <ArrowLeft size={14} /> Back
      </button>
      {children}
      <button disabled={nextDisabled} onClick={onNext}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ backgroundColor: nextDisabled?"#f5f5f5":"#171717", color: nextDisabled?"#d4d4d4":"white", cursor: nextDisabled?"not-allowed":"pointer" }}>
        {nextLabel} <ArrowRight size={14} />
      </button>
    </footer>
  );
}

// ─── Step 1: Source Input ─────────────────────────────────────────────────────

function Step1({ state, setState, onNext }) {
  const { tab, pdf, text } = state;
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const readB64 = f => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

  const handleFile = useCallback(async (file) => {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Only PDF files are supported."); return; }
    if (file.size > MAX_MB*1024*1024) { setError(`File exceeds ${MAX_MB} MB.`); return; }
    const base64 = await readB64(file);
    setState(s => ({ ...s, pdf: { name:file.name, size:file.size, base64 }, text:"" }));
  }, [setState]);

  const hasInput = tab === "pdf" ? !!pdf : text.trim().length > 0;
  const fmtBytes = b => b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8" style={{ fontFamily:"Georgia,serif" }}>
      <div className="w-full max-w-xl">
        <div className="mb-10">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-2" style={{ fontFamily:"system-ui,sans-serif" }}>KT Distiller · Step 1 of 7</p>
          <h1 className="text-3xl font-normal text-neutral-800">Add your research</h1>
          <p className="mt-2 text-sm text-neutral-400" style={{ fontFamily:"system-ui,sans-serif" }}>Upload a PDF or paste your text to get started.</p>
        </div>

        <div className="flex gap-6 mb-6 border-b border-neutral-200">
          {[{id:"pdf",label:"PDF upload",icon:File},{id:"text",label:"Paste text",icon:AlignLeft}].map(({id,label,icon:Icon})=>(
            <button key={id} onClick={() => setState(s=>({...s,tab:id}))} className="flex items-center gap-2 pb-3 text-sm transition-colors"
              style={{ fontFamily:"system-ui,sans-serif", color:tab===id?"#171717":"#a3a3a3", borderBottom:tab===id?"2px solid #171717":"2px solid transparent", marginBottom:"-1px" }}>
              <Icon size={13}/>{label}
            </button>
          ))}
        </div>

        {tab === "pdf" && (
          <div>
            {!pdf ? (
              <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files?.[0])}}
                onClick={()=>fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center py-16 px-8 text-center"
                style={{ borderColor:dragOver?"#171717":"#d4d4d4", backgroundColor:dragOver?"#f5f5f5":"white" }}>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e=>handleFile(e.target.files?.[0])}/>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor:dragOver?"#e5e5e5":"#f5f5f5" }}>
                  <Upload size={20} style={{ color:dragOver?"#171717":"#a3a3a3" }}/>
                </div>
                <p className="text-sm font-medium text-neutral-700 mb-1" style={{ fontFamily:"system-ui,sans-serif" }}>{dragOver?"Release to upload":"Drop your PDF here"}</p>
                <p className="text-xs text-neutral-400" style={{ fontFamily:"system-ui,sans-serif" }}>or <span className="underline">click to browse</span> · max {MAX_MB} MB</p>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0"><FileText size={18} className="text-neutral-500"/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate" style={{ fontFamily:"system-ui,sans-serif" }}>{pdf.name}</p>
                  <p className="text-xs text-neutral-400 mt-0.5" style={{ fontFamily:"system-ui,sans-serif" }}>{fmtBytes(pdf.size)} · PDF</p>
                </div>
                <button onClick={()=>setState(s=>({...s,pdf:null}))} className="text-neutral-300 hover:text-neutral-600 transition-colors"><X size={15}/></button>
              </div>
            )}
            {pdf && <button onClick={()=>fileRef.current?.click()} className="mt-3 text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2" style={{ fontFamily:"system-ui,sans-serif" }}>Replace file</button>}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e=>handleFile(e.target.files?.[0])}/>
          </div>
        )}

        {tab === "text" && (
          <div className="relative">
            <textarea value={text} onChange={e=>setState(s=>({...s,text:e.target.value}))} rows={10}
              placeholder="Paste your abstract, full paper text, or research notes here..."
              className="w-full rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm leading-relaxed text-neutral-800 resize-none focus:outline-none placeholder-neutral-300"
              style={{ fontFamily:"system-ui,sans-serif", borderColor:text.length>0?"#d4d4d4":"#e5e5e5" }}/>
            {text.length>0 && <button onClick={()=>setState(s=>({...s,text:""}))} className="absolute top-3 right-3 text-neutral-300 hover:text-neutral-500"><X size={14}/></button>}
            <p className="mt-2 text-right text-xs text-neutral-300" style={{ fontFamily:"system-ui,sans-serif" }}>{text.length.toLocaleString()} characters</p>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-500" style={{ fontFamily:"system-ui,sans-serif" }}>{error}</p>}

        <div className="mt-8">
          <button disabled={!hasInput} onClick={onNext} className="w-full py-3.5 rounded-xl text-sm font-medium transition-all"
            style={{ fontFamily:"system-ui,sans-serif", backgroundColor:hasInput?"#171717":"#f5f5f5", color:hasInput?"white":"#d4d4d4", cursor:hasInput?"pointer":"not-allowed" }}>
            Continue →
          </button>
          {!hasInput && <p className="text-center text-xs text-neutral-300 mt-3" style={{ fontFamily:"system-ui,sans-serif" }}>{tab==="pdf"?"Upload a PDF to continue":"Paste some text to continue"}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Audience Selection ───────────────────────────────────────────────

function Step2({ state, setState, onNext, onBack }) {
  const { audienceId } = state;
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8" style={{ fontFamily:"Georgia,serif" }}>
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-2" style={{ fontFamily:"system-ui,sans-serif" }}>Step 2 of 7</p>
          <h1 className="text-3xl font-normal text-neutral-800">Who is this brief for?</h1>
          <p className="mt-2 text-sm text-neutral-400" style={{ fontFamily:"system-ui,sans-serif" }}>Select one audience. The tone and language will be tailored accordingly.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-8">
          {AUDIENCES.map(({ id, icon: Icon, title, description }) => {
            const isSel = audienceId === id;
            return (
              <button key={id} onClick={() => setState(s=>({...s,audienceId:id}))}
                className="text-left rounded-xl border p-5 transition-all relative focus:outline-none"
                style={{ backgroundColor:isSel?"#fafafa":"white", borderColor:isSel?"#171717":"#e5e5e5", boxShadow:isSel?"inset 0 0 0 1px #171717":"none" }}>
                <div className="absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor:isSel?"#171717":"transparent", border:isSel?"none":"1.5px solid #e5e5e5" }}>
                  {isSel && <Check size={11} color="white" strokeWidth={3}/>}
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor:isSel?"#171717":"#f5f5f5" }}>
                  <Icon size={17} strokeWidth={1.75} style={{ color:isSel?"white":"#737373" }}/>
                </div>
                <p className="text-sm font-medium leading-snug mb-1.5 pr-6" style={{ fontFamily:"system-ui,sans-serif", color:"#171717" }}>{title}</p>
                <p className="text-xs leading-relaxed" style={{ fontFamily:"system-ui,sans-serif", color:"#a3a3a3" }}>{description}</p>
              </button>
            );
          })}
          {AUDIENCES.length % 2 !== 0 && <div className="hidden sm:block"/>}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-700 transition-colors" style={{ fontFamily:"system-ui,sans-serif" }}>
            <ArrowLeft size={14}/> Back
          </button>
          <button disabled={!audienceId} onClick={onNext}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ fontFamily:"system-ui,sans-serif", backgroundColor:audienceId?"#171717":"#f5f5f5", color:audienceId?"white":"#d4d4d4", cursor:audienceId?"pointer":"not-allowed" }}>
            Next <ArrowRight size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Distillation Workspace ──────────────────────────────────────────

const DISTIL_SECTIONS = [
  { id:"pls",       label:"Plain Language Summary", showReadability:true,  rows:6 },
  { id:"sowhat",    label:'The "So What?"',          showReadability:false, rows:4 },
  { id:"takeaways", label:"Key Takeaways",           showReadability:false, rows:7 },
  { id:"boundaries",label:"Evidence Boundaries",    showReadability:false, rows:4 },
  { id:"glossary",  label:"Glossary",               showReadability:false, rows:6 },
  { id:"citation",  label:"Citation (APA 7th)",     showReadability:false, rows:3 },
];
const EMPTY_DRAFTS = { pls:"",sowhat:"",takeaways:"",boundaries:"",glossary:"",citation:"" };
const EMPTY_BOOLS  = { pls:false,sowhat:false,takeaways:false,boundaries:false,glossary:false,citation:false };

function Step3({ appState, setAppState, onNext, onBack }) {
  const { source, sourcePdf, audienceId, distilDrafts } = appState;
  const audienceTitle = AUDIENCE_TITLE[audienceId] || "";
  const [drafts,    setDrafts]    = useState(distilDrafts || EMPTY_DRAFTS);
  const [verified,  setVerified]  = useState(EMPTY_BOOLS);
  const [collapsed, setCollapsed] = useState(EMPTY_BOOLS);
  const [smeMode,   setSmeMode]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [rawDebug,  setRawDebug]  = useState("");
  const [elapsed,   setElapsed]   = useState(0);
  const elapsedRef = useRef(null);
  const verifiedCount = Object.values(verified).filter(Boolean).length;
  const hasDraft = Object.values(drafts).some(v => v.trim().length > 0);

  const generate = async () => {
    setLoading(true); setError(""); setRawDebug(""); setElapsed(0);

    // UI-level tick so user sees elapsed seconds
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    const stopTimer = () => clearInterval(elapsedRef.current);

    // Hard UI timeout — fires after 45s no matter what the fetch is doing
    const uiTimeout = setTimeout(() => {
      stopTimer();
      setLoading(false);
      setError("Timed out after 45s. The API appears unreachable from this environment. Make sure you are running this inside Claude.ai, not a standalone viewer.");
    }, 45000);

    try {
      // Quick connectivity test first
      let testData;
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 12000);
        const testRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: ctrl.signal,
          headers: { ...ANTHROPIC_HEADERS },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "Say OK" }] }),
        });
        testData = await testRes.json();
      } catch(connErr) {
        throw new Error(`Network blocked — cannot reach api.anthropic.com. (${connErr.message}) Run this inside Claude.ai.`);
      }
      if (testData.error) throw new Error(`Auth error: ${testData.error.message}`);

      // Real generation
      let userContent;
      let extraHeaders = {};
      if (sourcePdf?.base64) {
        userContent = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: sourcePdf.base64 } },
          { type: "text", text: buildDistilPrompt(audienceTitle, "[The source text is the PDF document above. Read it in full before responding.]") },
        ];
        extraHeaders = { "anthropic-beta": "pdfs-2024-09-25" };
      } else {
        userContent = buildDistilPrompt(audienceTitle, source);
      }

      const ctrl2 = new AbortController();
      setTimeout(() => ctrl2.abort(), 55000);
      let res;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: ctrl2.signal,
          headers: { ...ANTHROPIC_HEADERS, ...extraHeaders },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: userContent }] }),
        });
      } catch(fe) { throw new Error(`Generation fetch failed: ${fe.message}`); }

      let data;
      try { data = await res.json(); } catch(je) { throw new Error(`HTTP ${res.status} unparseable`); }
      setRawDebug(JSON.stringify(data, null, 2).slice(0, 2000));
      if (data.error) throw new Error(`API error (${data.error.type}): ${data.error.message}`);
      if (!data.content?.length) throw new Error(`Empty response. Stop reason: ${data.stop_reason}`);

      const raw = data.content.map(b => b.text || "").join("\n");
      if (!raw.trim()) throw new Error("API returned blank text");

      const parsed = parseDistil(raw);
      const parsedCount = Object.keys(parsed).length;
      if (parsedCount === 0) throw new Error("No sections parsed. Raw began: " + raw.slice(0, 400));
      if (parsedCount < DISTIL_SECTIONS.length) setError(`Note: ${parsedCount}/${DISTIL_SECTIONS.length} sections returned — continue or regenerate.`);
      setDrafts(prev => ({ ...prev, ...parsed }));

    } catch(e) {
      setError(e.message || "Generation failed.");
    }
    clearTimeout(uiTimeout);
    stopTimer();
    setLoading(false);
  };

  const handleNext = () => {
    const brief = Object.entries(drafts).map(([k,v]) => {
      const sec = DISTIL_SECTIONS.find(s=>s.id===k);
      return `${sec?.label?.toUpperCase()}:\n${v}`;
    }).join("\n\n");
    setAppState(s => ({ ...s, distilDrafts:drafts, ktBrief:brief, citation:drafts.citation||"" }));
    onNext();
  };

  return (
    <div className="bg-neutral-50 flex flex-col" style={{ fontFamily:"system-ui,sans-serif", height:"100vh", overflow:"hidden" }}>
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-0.5">Step 3 of 7</p>
          <h1 className="text-base font-semibold text-neutral-800" style={{ fontFamily:"Georgia,serif" }}>
            Distilling for: <span className="font-normal italic text-neutral-500">{audienceTitle}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={()=>setSmeMode(p=>!p)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={{ borderColor:smeMode?"#171717":"#e5e5e5", backgroundColor:smeMode?"#171717":"white", color:smeMode?"white":"#737373" }}>
            <Check size={12} strokeWidth={2.5}/> SME {smeMode?"On":"Off"}
          </button>
          <button onClick={generate} disabled={loading} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor:loading?"#f5f5f5":"#171717", color:loading?"#a3a3a3":"white", cursor:loading?"not-allowed":"pointer" }}>
            {loading?<><Loader2 size={14} className="animate-spin"/>Generating… {elapsed}s</>:<><PenLine size={14}/>{hasDraft?"Regenerate":"Generate Draft"}</>}
          </button>
        </div>
      </header>

      {smeMode && (
        <div className="bg-white border-b border-neutral-100 px-6 py-2.5 flex items-center gap-3">
          <span className="text-xs text-neutral-400">SME Audit:</span>
          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden max-w-xs">
            <div className="h-full rounded-full transition-all duration-500" style={{ width:`${(verifiedCount/DISTIL_SECTIONS.length)*100}%`, backgroundColor:"#171717" }}/>
          </div>
          <span className="text-xs text-neutral-500 font-medium">{verifiedCount}/{DISTIL_SECTIONS.length} verified</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 border-r border-neutral-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
            <BookOpen size={13} className="text-neutral-400"/>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Source</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {sourcePdf ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <FileText size={14} className="text-neutral-400 shrink-0"/>
                  <p className="text-xs text-neutral-600 font-medium truncate">{sourcePdf.name}</p>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">PDF content will be sent directly to Claude for distillation.</p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-neutral-500 whitespace-pre-wrap">{source}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && <div className="mb-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap">{error}</div>}
          {rawDebug && <details className="mb-4"><summary className="text-xs text-neutral-400 cursor-pointer">Debug: raw API response</summary><pre className="mt-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{rawDebug}</pre></details>}
          {!hasDraft && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4"><PenLine size={20} className="text-neutral-300"/></div>
              <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">Click <strong className="text-neutral-600">Generate Draft</strong> to distil the source for <em>{audienceTitle}</em>.</p>
            </div>
          )}
          {(hasDraft || loading) && (
            <div className="max-w-2xl space-y-4">
              {DISTIL_SECTIONS.map(({ id, label, showReadability, rows }) => {
                const isVerified = verified[id]; const isCollapsed = collapsed[id];
                const txt = drafts[id]; const wc = countWords(txt);
                const grade = showReadability ? fkGrade(txt) : null;
                let gradeInfo = null;
                if (grade!==null) { if(grade<=8) gradeInfo={text:"8th Grade level",color:"#16a34a"}; else if(grade<=10) gradeInfo={text:`Grade ${grade} - simplify`,color:"#d97706"}; else gradeInfo={text:`Grade ${grade} - too complex`,color:"#dc2626"}; }
                return (
                  <div key={id} className="rounded-xl border bg-white overflow-hidden" style={{ borderColor:isVerified?"#171717":"#e5e5e5" }}>
                    <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor:"#f5f5f5", backgroundColor:isVerified?"#fafafa":"white" }}>
                      <div className="flex items-center gap-3">
                        {smeMode && (
                          <button onClick={()=>setVerified(p=>({...p,[id]:!p[id]}))} className="rounded flex items-center justify-center shrink-0 border"
                            style={{ width:18,height:18, backgroundColor:isVerified?"#171717":"white", borderColor:isVerified?"#171717":"#d4d4d4" }}>
                            {isVerified && <Check size={10} color="white" strokeWidth={3}/>}
                          </button>
                        )}
                        <span className="text-xs font-semibold text-neutral-600 uppercase tracking-widest">{label}</span>
                        {smeMode && isVerified && <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">Verified</span>}
                      </div>
                      <button onClick={()=>setCollapsed(p=>({...p,[id]:!p[id]}))} className="text-neutral-300 hover:text-neutral-600 transition-colors">
                        {isCollapsed?<ChevronDown size={15}/>:<ChevronUp size={15}/>}
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="px-5 py-4">
                        {loading && !txt ? (
                          <div className="flex items-center gap-2 py-3"><Loader2 size={13} className="animate-spin text-neutral-300"/><span className="text-xs text-neutral-300">Generating...</span></div>
                        ) : (
                          <textarea value={txt} onChange={e=>setDrafts(p=>({...p,[id]:e.target.value}))} rows={rows}
                            className="w-full text-sm leading-relaxed text-neutral-700 resize-none focus:outline-none bg-transparent placeholder-neutral-300"/>
                        )}
                        {showReadability && txt.length>0 && (
                          <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
                            <span className="text-xs text-neutral-400">{wc} words
                              {wc>0 && <span style={{ color:wc>=150&&wc<=200?"#16a34a":"#d97706" }}> · {wc<150?"too short":wc>200?"too long":"target range"}</span>}
                            </span>
                            {gradeInfo && <span className="text-xs font-medium" style={{ color:gradeInfo.color }}>{gradeInfo.text}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NavFooter onBack={onBack} onNext={handleNext} nextLabel="Choose Format" nextDisabled={!hasDraft}/>
    </div>
  );
}

// ─── Step 4: Modality Selection ───────────────────────────────────────────────

function Step4({ state, setState, onNext, onBack }) {
  const { modalityId } = state;
  const grouped = CATEGORY_ORDER.map(cat => ({ category:cat, items:MODALITIES.filter(m=>m.category===cat) })).filter(g=>g.items.length>0);
  const sel = MODALITIES.find(m=>m.id===modalityId);
  return (
    <div className="bg-neutral-50 flex flex-col" style={{ fontFamily:"system-ui,sans-serif", height:"100vh", overflow:"hidden" }}>
      <header className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-neutral-400 mb-0.5">Step 4 of 7</p>
            <h1 className="text-base font-semibold text-neutral-800" style={{ fontFamily:"Georgia,serif" }}>Choose a format</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Select how you want your KT brief delivered.</p>
          </div>
          <Breadcrumb current={3}/>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {grouped.map(({category,items})=>(
            <div key={category}>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">{category}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(({id,icon:Icon,title,tone,description,tags,featured})=>{
                  const isSel = modalityId===id;
                  return (
                    <button key={id} onClick={()=>setState(s=>({...s,modalityId:id}))}
                      className="text-left rounded-xl border p-4 transition-all relative flex flex-col focus:outline-none"
                      style={{ borderColor:isSel?"#171717":"#e5e5e5", boxShadow:isSel?"inset 0 0 0 1px #171717":"none", backgroundColor:isSel?"#fafafa":"white" }}>
                      {featured&&!isSel && <span className="absolute top-3 right-3 text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ backgroundColor:"#171717",color:"white",fontSize:9 }}>Popular</span>}
                      {isSel && <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor:"#171717" }}><Check size={11} color="white" strokeWidth={3}/></div>}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor:isSel?"#171717":"#f5f5f5" }}>
                          <Icon size={15} strokeWidth={1.75} style={{ color:isSel?"white":"#737373" }}/>
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-sm font-semibold text-neutral-800 leading-tight">{title}</p>
                          <p className="text-xs text-neutral-400 mt-0.5 mb-2">{tone}</p>
                          <p className="text-xs text-neutral-500 leading-relaxed">{description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {tags.map(tag=><span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor:isSel?"#e5e5e5":"#f5f5f5", color:isSel?"#404040":"#a3a3a3", fontSize:10 }}>{tag}</span>)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="h-5 flex items-center">
            {sel ? <p className="text-xs text-neutral-400">Selected: <span className="font-medium text-neutral-700">{sel.title}</span><button onClick={()=>setState(s=>({...s,modalityId:null}))} className="ml-3 underline underline-offset-2 text-neutral-300 hover:text-neutral-500">Clear</button></p>
                 : <p className="text-xs text-neutral-300">No format selected yet</p>}
          </div>
        </div>
      </div>

      <NavFooter onBack={onBack} onNext={onNext} nextLabel="Build Product" nextDisabled={!modalityId}/>
    </div>
  );
}

// ─── Step 5: Final Build ──────────────────────────────────────────────────────

function Step5({ appState, setAppState, onNext, onBack }) {
  const { ktBrief, audienceId, modalityId, citation } = appState;
  const audienceTitle = AUDIENCE_TITLE[audienceId] || "";
  const modalityLabel = MODALITY_MAP[modalityId]?.title || "";
  const persona = MODALITY_PROMPTS[modalityId] || MODALITY_PROMPTS.tiktok;

  const [copy,        setCopy]        = useState(appState.finalCopy || "");
  const [visuals,     setVisuals]     = useState(appState.visuals   || []);
  const [imageUrls,   setImageUrls]   = useState(appState.imageUrls || []);
  const [imageStates, setImageStates] = useState([]); // per-image: 'idle'|'loading'|'error'
  const [imageErrors, setImageErrors] = useState([]); // per-image error message
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [copyDone,    setCopyDone]    = useState(false);
  const [visualsOpen, setVisualsOpen] = useState(true);

  const hasCopy = copy.trim().length > 0;

  // Reset image state whenever visuals list changes (new build)
  const updateVisuals = (v) => {
    setVisuals(v);
    setImageUrls([]);
    setImageStates(v.map(() => "idle"));
    setImageErrors(v.map(() => ""));
  };

  const generateImage = async (index) => {
    setImageStates(prev => prev.map((s, i) => i === index ? "loading" : s));
    setImageErrors(prev => prev.map((e, i) => i === index ? "" : e));
    try {
      const url = await generateSvgImage(visuals[index].description);
      setImageUrls(prev => { const next = [...prev]; next[index] = url; return next; });
      setImageStates(prev => prev.map((s, i) => i === index ? "idle" : s));
    } catch(e) {
      setImageStates(prev => prev.map((s, i) => i === index ? "error" : s));
      setImageErrors(prev => prev.map((err, i) => i === index ? (e.message || "Unknown error") : err));
    }
  };

  const generate = async () => {
    setLoading(true); setError(""); setCopy(""); setVisuals([]);
    try {
      const [r1, r2] = await Promise.all([
        fetch("https://api.anthropic.com/v1/messages",{ method:"POST", headers:{...ANTHROPIC_HEADERS},
          body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:persona.copyPrompt(audienceTitle, ktBrief, citation||"")}] }) }),
        fetch("https://api.anthropic.com/v1/messages",{ method:"POST", headers:{...ANTHROPIC_HEADERS},
          body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:500, messages:[{role:"user",content:persona.visualPrompt(audienceTitle)}] }) }),
      ]);
      const [d1,d2] = await Promise.all([r1.json(),r2.json()]);
      if(d1.error) throw new Error(d1.error.message);
      const rawCopy = (d1.content||[]).map(b=>b.text||"").join("\n");
      const rawVis  = (d2.content||[]).map(b=>b.text||"").join("\n");
      setCopy(rawCopy.trim());
      updateVisuals(parseVisuals(rawVis));
    } catch(e) { setError(e.message||"Generation failed."); }
    setLoading(false);
  };

  const handleNext = () => { setAppState(s=>({...s, finalCopy:copy, visuals, imageUrls })); onNext(); };

  const clipCopy = async () => { await navigator.clipboard.writeText(copy); setCopyDone(true); setTimeout(()=>setCopyDone(false),2000); };
  const dlMarkdown = () => {
    const blob = new Blob([copy],{type:"text/markdown"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="kt-product.md"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-neutral-50 flex flex-col" style={{ fontFamily:"system-ui,sans-serif", height:"100vh", overflow:"hidden" }}>
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-0.5">Step 5 of 7</p>
          <h1 className="text-base font-semibold text-neutral-800" style={{ fontFamily:"Georgia,serif" }}>
            {modalityLabel} <span className="font-normal text-neutral-400">&mdash; for {audienceTitle}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {hasCopy && <>
            <button onClick={clipCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
              style={{ backgroundColor:copyDone?"#f0fdf4":undefined, borderColor:copyDone?"#bbf7d0":undefined, color:copyDone?"#16a34a":undefined }}>
              {copyDone?<Check size={12} className="text-emerald-500"/>:<Copy size={12}/>} {copyDone?"Copied":"Copy"}
            </button>
            <button onClick={dlMarkdown} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors">
              <Download size={12}/> Download
            </button>
          </>}
          <button onClick={generate} disabled={loading} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor:loading?"#f5f5f5":"#171717", color:loading?"#a3a3a3":"white", cursor:loading?"not-allowed":"pointer" }}>
            {loading?<><Loader2 size={14} className="animate-spin"/>Building...</>:<><Sparkles size={14}/>{hasCopy?"Rebuild":"Build Product"}</>}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}
          {!hasCopy && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4"><Sparkles size={20} className="text-neutral-300"/></div>
              <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">Click <strong className="text-neutral-600">Build Product</strong> to generate your <em>{modalityLabel}</em>.</p>
            </div>
          )}
          {loading && !hasCopy && <div className="flex flex-col items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-neutral-300 mb-4"/><p className="text-sm text-neutral-400">Generating {modalityLabel}...</p></div>}
          {hasCopy && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{modalityLabel} Copy</span>
                  <span className="text-xs text-neutral-300">{copy.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <div className="px-5 py-5">
                  <textarea value={copy} onChange={e=>setCopy(e.target.value)} rows={Math.max(16,copy.split("\n").length+2)}
                    className="w-full text-sm leading-relaxed text-neutral-700 resize-none focus:outline-none bg-transparent"/>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-l border-neutral-200 bg-white flex flex-col overflow-hidden" style={{ width:300 }}>
          <button onClick={()=>setVisualsOpen(p=>!p)} className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2"><Image size={13} className="text-neutral-400"/><span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Visual Recommendations</span></div>
            {visualsOpen?<ChevronUp size={13} className="text-neutral-300"/>:<ChevronDown size={13} className="text-neutral-300"/>}
          </button>
          {visualsOpen && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading && visuals.length===0 && <div className="flex items-center gap-2 py-4"><Loader2 size={13} className="animate-spin text-neutral-300"/><span className="text-xs text-neutral-300">Generating suggestions...</span></div>}
              {!loading && visuals.length===0 && <p className="text-xs text-neutral-300 leading-relaxed">Visual suggestions appear after building the product.</p>}
              {visuals.length>0 && (
                <div className="space-y-5">
                  {visuals.map((v,i)=>{
                    const imgUrl = imageUrls[i];
                    const imgState = imageStates[i] || "idle";
                    const imgError = imageErrors[i] || "";
                    return (
                      <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                        {/* Generated image or placeholder */}
                        {imgUrl ? (
                          <div className="relative group">
                            <img
                              src={imgUrl}
                              alt={v.altText || `Visual ${i+1}`}
                              className="w-full object-cover"
                              style={{ aspectRatio:"4/3" }}
                            />
                            {imgState === "idle" && (
                              <a href={imgUrl} download={`visual-${i+1}.jpg`} target="_blank" rel="noreferrer"
                                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5">
                                <Download size={11}/> Save
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center bg-neutral-100" style={{ aspectRatio:"4/3" }}>
                            {imgState === "loading" ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 size={20} className="animate-spin text-neutral-400"/>
                                <span className="text-xs text-neutral-400">Creating illustration…</span>
                                <span className="text-xs text-neutral-300">~10–20 seconds</span>
                              </div>
                            ) : imgState === "error" ? (
                              <div className="flex flex-col items-center gap-2 px-4 text-center">
                                <span className="text-xs text-red-400">Generation failed</span>
                                {imgError && <span className="text-xs text-neutral-400 leading-relaxed" style={{fontSize:10}}>{imgError}</span>}
                                <button onClick={() => generateImage(i)} className="text-xs text-neutral-500 underline underline-offset-2 mt-1">Try again</button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Image size={22} className="text-neutral-300"/>
                                <span className="text-xs text-neutral-300">No image yet</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Description + alt text */}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-4 h-4 rounded bg-neutral-200 flex items-center justify-center"><span className="font-bold text-neutral-500" style={{ fontSize:9 }}>{i+1}</span></div>
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Visual {i+1}</span>
                          </div>
                          <p className="text-xs text-neutral-600 leading-relaxed mb-3">{v.description}</p>
                          {v.altText && (
                            <div className="pt-2 border-t border-neutral-200 mb-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1" style={{ fontSize:10 }}>Alt Text</p>
                              <p className="text-xs text-neutral-400 leading-relaxed italic">{v.altText}</p>
                            </div>
                          )}
                          {/* Generate / Regenerate button */}
                          {imgState !== "loading" && (
                            <button onClick={()=>generateImage(i)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all"
                              style={{ borderColor:"#171717", color:"#171717", backgroundColor:"white" }}>
                              <Sparkles size={11}/>
                              {imgUrl ? "Regenerate Illustration" : "Generate Illustration"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-neutral-300 text-center leading-relaxed pb-2">Illustrations generated by Claude · SVG format</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NavFooter onBack={onBack} onNext={handleNext} nextLabel="Run Audit" nextDisabled={!hasCopy}/>
    </div>
  );
}

// ─── Step 6: Audit Gate ───────────────────────────────────────────────────────

const FLAG_CFG = {
  red:    { label:"Red Flag",    icon:AlertCircle,   color:"#dc2626", bg:"#fef2f2", border:"#fecaca", badge:"#fee2e2", badgeText:"#dc2626" },
  yellow: { label:"Yellow Flag", icon:AlertTriangle, color:"#d97706", bg:"#fffbeb", border:"#fde68a", badge:"#fef3c7", badgeText:"#d97706" },
  green:  { label:"Green Flag",  icon:CheckCircle,   color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0", badge:"#dcfce7", badgeText:"#16a34a" },
};

function Step6({ appState, setAppState, onNext, onBack }) {
  const { source, finalCopy: initCopy } = appState;
  const [draft,      setDraftLocal] = useState(initCopy || "");
  const [flags,      setFlags]      = useState([]);
  const [summary,    setSummary]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [auditRun,   setAuditRun]   = useState(false);
  const [approved,   setApproved]   = useState(false);
  const [collapsed,  setCollapsed]  = useState({});
  const [sourceOpen, setSourceOpen] = useState(false);
  const draftRef = useRef(draft);
  const updateDraft = val => { draftRef.current=val; setDraftLocal(val); };

  const runAudit = async () => {
    const cur = draftRef.current;
    setLoading(true); setError(""); setFlags([]); setSummary(""); setAuditRun(false); setApproved(false);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{ method:"POST", headers:{...ANTHROPIC_HEADERS},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1500, messages:[{role:"user",content:buildAuditPrompt(source,cur)}] }) });
      const data = await res.json();
      if(data.error) throw new Error(data.error.message);
      const raw = (data.content||[]).map(b=>b.text||"").join("\n");
      const parsed = parseAudit(raw);
      setFlags(parsed.flags); setSummary(parsed.summary); setAuditRun(true);
    } catch(e) { setError(e.message||"Audit failed."); }
    setLoading(false);
  };

  const acceptEdit = (flagId) => {
    const flag = flags.find(f=>f.id===flagId);
    if(!flag||!flag.suggestion||flag.suggestion==="No change needed") return;
    updateDraft(applyEdit(draftRef.current, flag.quote, flag.suggestion));
    setFlags(prev=>prev.map(f=>f.id===flagId?{...f,accepted:true}:f));
    // auditRun stays true so canApprove unlocks when all reds accepted
    setApproved(false);
  };

  const handleApprove = () => {
    setApproved(true);
    setAppState(s=>({...s, finalCopy:draftRef.current, auditSummary:summary, approved:true, approvedAt:new Date().toLocaleString("en-CA",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}) }));
  };

  const activeFlags = flags.filter(f=>!f.accepted);
  const counts = { red:activeFlags.filter(f=>f.type==="red").length, yellow:activeFlags.filter(f=>f.type==="yellow").length, green:flags.filter(f=>f.type==="green").length };
  const canApprove = auditRun && counts.red===0;

  return (
    <div className="bg-neutral-50 flex flex-col" style={{ fontFamily:"system-ui,sans-serif", height:"100vh", overflow:"hidden" }}>
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-0.5">Step 6 of 7</p>
          <h1 className="text-base font-semibold text-neutral-800" style={{ fontFamily:"Georgia,serif" }}>Review & Approval Gate</h1>
          <p className="text-xs text-neutral-400 mt-0.5">SME / Project Director audit before final sign-off</p>
        </div>
        <div className="flex items-center gap-3">
          {auditRun && (
            <div className="flex items-center gap-2">
              {["red","yellow","green"].map(type=>{ const cfg=FLAG_CFG[type]; const Icon=cfg.icon; const n=type==="green"?counts.green:counts[type]; return n>0?(<span key={type} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor:cfg.badge,color:cfg.badgeText }}><Icon size={11}/>{n}</span>):null; })}
            </div>
          )}
          <button onClick={runAudit} disabled={loading} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor:loading?"#f5f5f5":"#171717", color:loading?"#a3a3a3":"white", cursor:loading?"not-allowed":"pointer" }}>
            {loading?<><Loader2 size={14} className="animate-spin"/>Auditing...</>:<><ShieldCheck size={14}/>{auditRun?"Re-run Audit":"Run Audit"}</>}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-200">
          <div className="border-b border-neutral-100 bg-white shrink-0">
            <button onClick={()=>setSourceOpen(p=>!p)} className="w-full flex items-center justify-between px-5 py-3 text-left">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Source Text (Reference)</span>
              {sourceOpen?<ChevronUp size={13} className="text-neutral-300"/>:<ChevronDown size={13} className="text-neutral-300"/>}
            </button>
            {sourceOpen && <div className="px-5 pb-4"><p className="text-xs leading-relaxed text-neutral-400 whitespace-pre-wrap">{source}</p></div>}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Draft Product</span>
              <span className="text-xs text-neutral-300">{draft.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <textarea value={draft} onChange={e=>{updateDraft(e.target.value);setApproved(false);}}
              className="w-full text-sm leading-relaxed text-neutral-700 resize-none focus:outline-none bg-white border border-neutral-200 rounded-xl p-4" rows={20}/>
            <p className="text-xs text-neutral-300 mt-2">You can edit directly. Re-run the audit after changes.</p>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden" style={{ width:340 }}>
          <div className="px-5 py-3.5 border-b border-neutral-100 bg-white flex items-center gap-2 shrink-0">
            <ShieldCheck size={13} className="text-neutral-400"/>
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Safety Report</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {error && <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</div>}
            {loading && <div className="flex flex-col items-center justify-center py-12 text-center"><Loader2 size={24} className="animate-spin text-neutral-300 mb-3"/><p className="text-xs text-neutral-400">Auditing against source text...</p></div>}
            {!loading && !auditRun && <div className="flex flex-col items-center justify-center py-12 text-center"><div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-3"><ShieldCheck size={18} className="text-neutral-300"/></div><p className="text-xs text-neutral-400 max-w-48 leading-relaxed">Click <strong className="text-neutral-600">Run Audit</strong> to check the draft against the source.</p></div>}
            {auditRun && summary && <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3"><p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Audit Summary</p><p className="text-xs text-neutral-600 leading-relaxed">{summary}</p></div>}
            {flags.map(flag=>{
              const cfg=FLAG_CFG[flag.type]; const Icon=cfg.icon; const isOpen=!collapsed[flag.id];
              return (
                <div key={flag.id} className="rounded-xl border overflow-hidden" style={{ borderColor:flag.accepted?"#e5e5e5":cfg.border, opacity:flag.accepted?0.55:1 }}>
                  <button onClick={()=>setCollapsed(p=>({...p,[flag.id]:!p[flag.id]}))} className="w-full flex items-center justify-between px-3 py-2.5 text-left" style={{ backgroundColor:flag.accepted?"#fafafa":cfg.bg }}>
                    <div className="flex items-center gap-2">
                      <Icon size={13} style={{ color:flag.accepted?"#a3a3a3":cfg.color }}/>
                      <span className="text-xs font-semibold" style={{ color:flag.accepted?"#a3a3a3":cfg.color }}>{cfg.label}</span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor:flag.accepted?"#f5f5f5":cfg.badge, color:flag.accepted?"#a3a3a3":cfg.badgeText, fontSize:10 }}>{flag.rule}</span>
                      {flag.accepted && <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">Accepted</span>}
                    </div>
                    {isOpen?<ChevronUp size={12} className="text-neutral-300"/>:<ChevronDown size={12} className="text-neutral-300"/>}
                  </button>
                  {isOpen && (
                    <div className="px-3 py-3 bg-white border-t space-y-2.5" style={{ borderColor:cfg.border }}>
                      <p className="text-xs text-neutral-600 leading-relaxed">{flag.issue}</p>
                      {flag.quote&&flag.quote!=="N/A"&&<div className="rounded-lg px-3 py-2" style={{ backgroundColor:cfg.bg }}><p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color:cfg.color, fontSize:10 }}>Flagged text</p><p className="text-xs italic text-neutral-600 leading-relaxed">"{flag.quote}"</p></div>}
                      {flag.suggestion&&flag.suggestion!=="No change needed"&&!flag.accepted&&(
                        <div>
                          <div className="flex items-center gap-1 mb-1.5"><CornerDownRight size={11} className="text-neutral-400"/><p className="text-xs font-bold uppercase tracking-widest text-neutral-400" style={{ fontSize:10 }}>Suggested edit</p></div>
                          <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">{flag.suggestion}</p>
                          <button onClick={()=>acceptEdit(flag.id)} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor:"#171717",color:"#171717",backgroundColor:"white" }}>
                            <Check size={11} strokeWidth={2.5}/> Accept Edit
                          </button>
                        </div>
                      )}
                      {flag.type==="green"&&<p className="text-xs text-neutral-400 italic">No changes needed.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-neutral-100 bg-white shrink-0">
            {counts.red>0&&<p className="text-xs text-red-500 text-center mb-3">Resolve {counts.red} red flag{counts.red>1?"s":""} before approving.</p>}
            {!auditRun&&!loading&&<p className="text-xs text-neutral-300 text-center mb-3">Run the audit first to enable sign-off.</p>}
            <button disabled={!canApprove||approved} onClick={handleApprove}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor:approved?"#16a34a":canApprove?"#171717":"#f5f5f5", color:approved||canApprove?"white":"#d4d4d4", cursor:canApprove&&!approved?"pointer":"not-allowed" }}>
              {approved?<><FileCheck size={16}/>Approved & Finalised</>:<><ShieldCheck size={16}/>Approve &amp; Finalise</>}
            </button>
          </div>
        </div>
      </div>

      <NavFooter onBack={onBack} onNext={onNext} nextLabel="Export" nextDisabled={!approved}/>
    </div>
  );
}

// ─── Step 7: Export Hub ───────────────────────────────────────────────────────

function Step7({ appState, onRestart }) {
  const { finalCopy, audienceId, modalityId, auditSummary, approvedAt, citation } = appState;
  const audienceTitle = AUDIENCE_TITLE[audienceId] || "";
  const modalityLabel = MODALITY_MAP[modalityId]?.title || "";
  const [copied,  setCopied]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [toast,   setToast]   = useState("");
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  const metaItems = [
    { icon:User,     label:"Audience",  value:audienceTitle },
    { icon:Layout,   label:"Modality",  value:modalityLabel },
    { icon:Shield,   label:"Audit",     value:auditSummary||"Verified — flags cleared" },
    { icon:Calendar, label:"Generated", value:approvedAt||new Date().toLocaleString() },
    { icon:FileText, label:"Citation",  value:citation||"Not extracted" },
  ];

  const clipCopy = async () => { await navigator.clipboard.writeText(finalCopy||""); setCopied(true); showToast("Copied to clipboard"); setTimeout(()=>setCopied(false),2500); };
  const dlMarkdown = () => {
    const md = [`# KT Product — ${modalityLabel}`,`**Audience:** ${audienceTitle}`,`**Generated:** ${approvedAt}`,`**Audit Status:** ${auditSummary||"Verified"}`,citation?`**Citation:** ${citation}`:"",`---`,finalCopy].filter(Boolean).join("\n\n");
    const blob=new Blob([md],{type:"text/markdown"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="kt-product.md"; a.click(); URL.revokeObjectURL(url);
    showToast("Markdown downloaded");
  };
  const emailPartner = () => {
    const sub = encodeURIComponent(`KT Product — ${modalityLabel} (${audienceTitle})`);
    const body = encodeURIComponent(`Hi,\n\nPlease find the approved KT product below.\n\nAudience: ${audienceTitle}\nModality: ${modalityLabel}\nGenerated: ${approvedAt}${citation?`\nCitation: ${citation}`:""}\n\n---\n\n${finalCopy}\n\n---\nGenerated via KT Distiller`);
    window.location.href=`mailto:?subject=${sub}&body=${body}`;
    showToast("Mail client opened");
  };

  return (
    <div className="bg-neutral-50 flex flex-col" style={{ fontFamily:"system-ui,sans-serif", height:"100vh", overflow:"hidden" }}>
      <header className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle size={18} className="text-emerald-600"/></div>
            <div>
              <p className="text-xs tracking-widest uppercase text-emerald-600 font-semibold mb-0.5">Ready for Launch</p>
              <h1 className="text-base font-semibold text-neutral-800" style={{ fontFamily:"Georgia,serif" }}>Export & Publication Hub</h1>
            </div>
          </div>
          <Breadcrumb current={6}/>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button onClick={clipCopy} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                style={{ backgroundColor:copied?"#f0fdf4":"white", borderColor:copied?"#bbf7d0":"#e5e5e5", color:copied?"#16a34a":"#404040" }}>
                {copied?<Check size={13} className="text-emerald-500"/>:<Copy size={13}/>}{copied?"Copied!":"Copy to Clipboard"}
              </button>
              <button onClick={dlMarkdown} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors">
                <Download size={13}/> Download Markdown
              </button>
              <button onClick={emailPartner} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors">
                <Mail size={13}/> Email to Partner
              </button>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{modalityLabel}</span>
                  <span className="text-xs text-neutral-300">·</span>
                  <span className="text-xs text-neutral-400">{audienceTitle}</span>
                </div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"/><span className="text-xs text-emerald-600 font-medium">Audit Passed</span></div>
              </div>
              <div className="px-5 py-5">
                <pre className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap font-sans">{finalCopy}</pre>
              </div>
            </div>
            <p className="text-xs text-neutral-300 mt-3 text-center">Final auditor-verified version. Content is read-only.</p>
          </div>
        </div>

        <div className="shrink-0 border-l border-neutral-200 bg-white flex flex-col overflow-hidden" style={{ width:280 }}>
          <div className="px-5 py-4 border-b border-neutral-100 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4"><Shield size={13} className="text-neutral-400"/><span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Seal of Approval</span></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-100 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-600"/><span className="text-xs font-semibold text-emerald-700">CDHW Quality Verified</span></div>
              <div className="px-4 py-3 space-y-3">
                {metaItems.map(({icon:Icon,label,value})=>(
                  <div key={label}>
                    <div className="flex items-center gap-1.5 mb-0.5"><Icon size={10} className="text-neutral-400"/><p className="text-xs font-bold uppercase tracking-widest text-neutral-400" style={{ fontSize:10 }}>{label}</p></div>
                    <p className="text-xs text-neutral-600 leading-snug pl-4">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-3 border-t border-neutral-100">
            <button onClick={()=>{setSaved(true);showToast("Saved to History (mock)");}}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all"
              style={{ borderColor:saved?"#171717":"#e5e5e5", backgroundColor:saved?"#171717":"white", color:saved?"white":"#404040" }}>
              <BookmarkCheck size={14}/>{saved?"Saved to History":"Save to History"}
            </button>
            <button onClick={onRestart}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors">
              <RotateCcw size={14}/> Start New Distillation
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 text-sm px-4 py-2.5 rounded-lg shadow-lg text-white" style={{ transform:"translateX(-50%)",backgroundColor:"#171717",zIndex:50 }}>{toast}</div>}

      <footer className="bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div/>
        <div className="flex items-center gap-2 text-xs text-neutral-400"><CheckCircle size={12} className="text-emerald-400"/> All quality gates passed</div>
      </footer>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const INIT_STATE = {
  // Step 1
  tab: "pdf", pdf: null, text: "",
  // Step 2
  audienceId: null,
  // Step 3
  distilDrafts: null, ktBrief: "", citation: "",
  // Step 4
  modalityId: null,
  // Step 5
  finalCopy: "", visuals: [], imageUrls: [],
  // Step 6
  auditSummary: "", approved: false, approvedAt: "",
};

export default function KTDistillerApp() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState(INIT_STATE);

  // Derive source — for text tab use the string; for PDF tab pass the pdf object so Step3 can send it natively
  const source = state.tab === "text" ? state.text : (state.pdf ? `[PDF: ${state.pdf?.name}]` : "");

  const goNext = () => setStep(s => Math.min(s+1, 6));
  const goBack = () => setStep(s => Math.max(s-1, 0));
  const restart = () => { setState(INIT_STATE); setStep(0); };

  const appState = { ...state, source, sourcePdf: state.tab === "pdf" ? state.pdf : null };

  if (step === 0) return <Step1 state={state} setState={setState} onNext={goNext}/>;
  if (step === 1) return <Step2 state={state} setState={setState} onNext={goNext} onBack={goBack}/>;
  if (step === 2) return <Step3 appState={appState} setAppState={setState} onNext={goNext} onBack={goBack}/>;
  if (step === 3) return <Step4 state={state} setState={setState} onNext={goNext} onBack={goBack}/>;
  if (step === 4) return <Step5 appState={appState} setAppState={setState} onNext={goNext} onBack={goBack}/>;
  if (step === 5) return <Step6 appState={appState} setAppState={setState} onNext={goNext} onBack={goBack}/>;
  if (step === 6) return <Step7 appState={appState} onRestart={restart}/>;
}
