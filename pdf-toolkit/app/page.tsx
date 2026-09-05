import {
  ArrowUpRight,
  FileImage,
  FileOutput,
  Files,
  FileText,
  FolderClock,
  Home as HomeIcon,
  ImageDown,
  Layers,
  Menu,
  RotateCw,
  ScanLine,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Stamp,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple files into one polished document.",
    href: "/tools/merge-pdf",
    icon: Files,
    tone: "coral",
    tag: "Popular",
  },
  {
    title: "Split PDF",
    description: "Extract the pages you need from any PDF.",
    href: "/tools/split-pdf",
    icon: Scissors,
    tone: "blue",
  },
  {
    title: "Reorder & Rotate",
    description: "Arrange pages and fix their orientation in seconds.",
    href: "/tools/reorder-rotate-pages",
    icon: RotateCw,
    tone: "yellow",
  },
  {
    title: "Add Page Numbers",
    description: "Stamp clear, consistent numbers onto every page.",
    href: "/tools/add-page-numbers",
    icon: FileText,
    tone: "green",
  },
  {
    title: "Add Watermark",
    description: "Protect or brand your document with a custom mark.",
    href: "/tools/add-watermark",
    icon: Stamp,
    tone: "pink",
  },
  {
    title: "JPG to PDF",
    description: "Turn a batch of images into a single PDF file.",
    href: "/tools/jpg-to-pdf",
    icon: FileImage,
    tone: "purple",
  },
  {
    title: "Compress Image",
    description: "Shrink image files while keeping them looking sharp.",
    href: "/tools/compress-image",
    icon: ImageDown,
    tone: "orange",
  },
  {
    title: "More tools",
    description: "New PDF utilities are on their way.",
    href: "/tools",
    icon: WandSparkles,
    tone: "teal",
    tag: "Soon",
  },
];

const toneClasses: Record<string, string> = {
  coral: "tool-icon--coral",
  blue: "tool-icon--blue",
  yellow: "tool-icon--yellow",
  green: "tool-icon--green",
  pink: "tool-icon--pink",
  purple: "tool-icon--purple",
  orange: "tool-icon--orange",
  teal: "tool-icon--teal",
};

export default function Home() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PDF Toolkit home">
          <span className="brand-mark"><Layers size={18} strokeWidth={2.5} /></span>
          <span>PDF<span className="brand-accent">Toolkit</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link className="nav-link nav-link--active" href="/">Home</Link>
          <Link className="nav-link" href="/tools">All tools</Link>
        </nav>
        <button className="icon-button menu-button" type="button" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      <main className="content-wrap">
        <section className="hero-section" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={15} /> Simple tools, seriously useful</p>
            <h1 id="page-title">Make PDFs <span>less painful.</span></h1>
            <p className="hero-description">Everything you need to tidy up, transform, and share your documents. Right in your browser.</p>
            <div className="privacy-note"><ShieldCheck size={17} /><span>Your files stay on your device.</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-sheet art-sheet--back"><span>PDF</span></div>
            <div className="art-sheet art-sheet--front"><FileOutput size={27} /><span>READY<br />TO GO</span><i /></div>
            <div className="art-spark art-spark--one">*</div>
            <div className="art-spark art-spark--two">+</div>
          </div>
        </section>

        <section className="tools-section" aria-labelledby="tools-heading">
          <div className="section-heading">
            <div><p className="section-kicker">Your toolkit</p><h2 id="tools-heading">What do you need to do?</h2></div>
            <Link className="see-all" href="/tools">See all tools <ArrowUpRight size={17} /></Link>
          </div>
          <div className="tool-grid">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return <Link className="tool-card" href={tool.href} key={tool.title}>
                <div className={`tool-icon ${toneClasses[tool.tone]}`}><Icon size={22} strokeWidth={2} /></div>
                <div className="tool-card-copy"><div className="tool-title-row"><h3>{tool.title}</h3>{tool.tag && <span className="tool-tag">{tool.tag}</span>}</div><p>{tool.description}</p></div>
                <ArrowUpRight className="card-arrow" size={18} />
              </Link>;
            })}
          </div>
        </section>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link className="mobile-nav-item mobile-nav-item--active" href="/"><HomeIcon size={19} /><span>Home</span></Link>
        <Link className="mobile-nav-item" href="/tools"><Layers size={19} /><span>Tools</span></Link>
        <Link className="mobile-nav-item" href="/tools/scan-document"><ScanLine size={19} /><span>Scan</span></Link>
        <Link className="mobile-nav-item" href="/recent"><FolderClock size={19} /><span>Recent</span></Link>
        <Link className="mobile-nav-item" href="/settings"><Settings size={19} /><span>Settings</span></Link>
      </nav>
    </div>
  );
}
