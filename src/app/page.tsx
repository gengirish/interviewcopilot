"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Brain, FileText, Shield, Zap, CheckCircle, ArrowRight, Star } from "lucide-react";
import { getCurrentUser } from "@/lib/api";

function Navbar({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neural-border bg-neural-bg/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-6 h-6 text-neural-cyan" />
          <span className="font-bold text-lg text-white">InterviewCopilot</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-neural-cyan/30 text-neural-cyan font-mono">AI</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-neural-muted">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#roles" className="hover:text-white transition-colors">Roles</a>
        </div>
        <div className="flex items-center gap-3">
          {!isLoggedIn && (
            <Link href="/login" className="text-sm text-neural-muted hover:text-white transition-colors">
              Login
            </Link>
          )}
          {isLoggedIn && (
            <Link href="/dashboard" className="text-sm text-neural-muted hover:text-white transition-colors">
              Dashboard
            </Link>
          )}
          <Link href="/session"
            className="px-4 py-2 rounded-lg text-sm font-bold bg-neural-cyan text-black hover:bg-cyan-300 transition-colors">
            {isLoggedIn ? "Continue Session" : "Start Free Session"}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neural-purple/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-neural-cyan/10 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay:"2s"}} />
      </div>
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neural-cyan/30 bg-neural-cyan/5 text-neural-cyan text-sm font-mono mb-8">
          <Mic className="w-4 h-4 animate-pulse" />
          Real-time AI answers during live interviews
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
          Ace every interview with{" "}
          <span className="gradient-text">AI by your side.</span>
        </h1>
        <p className="text-xl text-neural-muted max-w-3xl mx-auto mb-10 leading-relaxed">
          Upload your resume. Start your session. Get instant AI-powered answers to every interview question in real-time.
          Built specifically for <strong className="text-white">AI, ML, Data Science, and software engineering</strong> roles.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/session"
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-black bg-neural-cyan hover:bg-cyan-300 transition-all glow-cyan text-lg">
            {isLoggedIn ? "Continue Interview Session" : "Start Free Session"} <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 text-neural-muted text-sm">
            <CheckCircle className="w-4 h-4 text-neural-green" />
            No install required — works in your browser
          </div>
        </div>
        {/* Social proof */}
        <div className="flex items-center justify-center gap-6 text-sm text-neural-muted">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
            <span className="ml-1">4.9/5</span>
          </div>
          <span>·</span>
          <span>Built for IntelliForge AI learners</span>
          <span>·</span>
          <span>🇮🇳 India-first pricing</span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n:"01", icon: FileText, title:"Upload resume", desc:"Paste your resume or upload PDF. AI uses it for personalised, context-aware answers." },
    { n:"02", icon: Mic, title:"Start your interview", desc:"Join your Zoom/Meet/Teams call. Open InterviewCopilot in a separate browser tab." },
    { n:"03", icon: Brain, title:"Get instant answers", desc:"Speak questions aloud. AI transcribes in real-time and generates tailored answers in seconds." },
  ];
  return (
    <section className="py-20 px-4 bg-neural-surface/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">How it works</h2>
          <p className="text-neural-muted text-lg">Three steps. Zero setup. Works on any platform.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neural-cyan/10 border border-neural-cyan/20 mb-4">
                  <Icon className="w-7 h-7 text-neural-cyan" />
                  <span className="absolute -top-2 -right-2 text-xs font-bold bg-neural-purple text-white w-5 h-5 rounded-full flex items-center justify-center">{s.n}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-neural-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Mic, title:"Live transcription", desc:"Browser-native speech recognition. No third-party app needed. Works with any microphone." },
  { icon: Brain, title:"Resume-aware answers", desc:"Every answer references your actual experience, projects, and skills. Not generic — yours." },
  { icon: Zap, title:"<3s response time", desc:"AI answers appear in under 3 seconds. Fast enough for natural conversation flow." },
  { icon: Shield, title:"Role-specific modes", desc:"ML Engineer, Data Scientist, AI Architect, Backend, Product Manager — optimised prompts per role." },
  { icon: FileText, title:"Answer history", desc:"Full session log. Review every Q&A after the interview. Export as PDF." },
  { icon: CheckCircle, title:"STAR method format", desc:"Behavioural questions auto-formatted as Situation → Task → Action → Result." },
];

function Features() {
  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">Built for tech interviews</h2>
          <p className="text-neural-muted text-lg">Not a generic AI chatbot. A purpose-built interview assistant.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card-hover p-6 rounded-xl border border-neural-border bg-neural-surface">
                <div className="w-10 h-10 rounded-lg bg-neural-cyan/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-neural-cyan" />
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-neural-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    { emoji:"🤖", role:"ML / AI Engineer", companies:"Google DeepMind, OpenAI, Anthropic, HuggingFace" },
    { emoji:"📊", role:"Data Scientist", companies:"Flipkart, Swiggy, Zomato, PhonePe, CRED" },
    { emoji:"🏗️", role:"AI Solutions Architect", companies:"AWS, Azure, GCP, TCS, Infosys" },
    { emoji:"💻", role:"Backend Engineer", companies:"Zepto, Meesho, Razorpay, Groww" },
    { emoji:"📱", role:"Full-Stack Engineer", companies:"Atlassian, Freshworks, Zoho" },
    { emoji:"🎯", role:"Product Manager", companies:"Amazon, Microsoft, Uber, Ola" },
  ];
  return (
    <section id="roles" className="py-20 px-4 bg-neural-surface/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">
            Optimised for <span className="gradient-text">every tech role</span>
          </h2>
          <p className="text-neural-muted text-lg">Role-specific answer modes trained on real interview questions.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.role} className="card-hover p-4 rounded-xl border border-neural-border bg-neural-surface">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{r.emoji}</span>
                <h3 className="text-white font-semibold text-sm">{r.role}</h3>
              </div>
              <p className="text-neural-muted text-xs">{r.companies}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name:"Free", price:"₹0", period:"forever", highlight:false,
      features:["3 sessions/month","5 minutes per session","Basic answer mode","Text answers only"],
      cta:"Start Free", href:"/session",
    },
    {
      name:"Pro", price:"₹499", period:"/month", highlight:true,
      features:["Unlimited sessions","Unlimited duration","All 6 role modes","Resume-aware answers","STAR format","Session history & export","Priority AI (Claude Sonnet)"],
      cta:"Upgrade to Pro", href:"/dashboard",
    },
    {
      name:"IntelliForge", price:"₹299", period:"/month", highlight:false,
      features:["Everything in Pro","For IntelliForge students","Use code: INTELLIFORGE","Exclusive AI interview prep course","Community mock interviews"],
      cta:"Get Student Plan", href:"/dashboard",
    },
  ];
  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">
            13× cheaper than <span className="gradient-text">Parakeet AI</span>
          </h2>
          <p className="text-neural-muted text-lg">Parakeet charges ₹6,730/mo. We charge ₹499. Same AI power.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((t) => (
            <div key={t.name} className={`relative card-hover rounded-2xl border p-8 flex flex-col ${t.highlight ? "border-neural-cyan bg-neural-surface glow-cyan" : "border-neural-border bg-neural-surface/50"}`}>
              {t.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-neural-cyan text-black text-xs font-bold">MOST POPULAR</div>}
              <h3 className="text-xl font-bold text-white mb-1">{t.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{t.price}</span>
                <span className="text-neural-muted text-sm">{t.period}</span>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neural-muted">
                    <CheckCircle className="w-4 h-4 text-neural-cyan flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={t.href} className={`w-full py-3 rounded-xl font-bold text-center transition-all ${t.highlight ? "bg-neural-cyan text-black hover:bg-cyan-300" : "border border-neural-border text-white hover:border-neural-cyan/50"}`}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neural-border py-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-neural-cyan" />
          <span className="font-bold text-white">InterviewCopilot</span>
        </div>
        <p className="text-sm text-neural-muted text-center">
          Built by <a href="https://www.intelliforge.tech" target="_blank" rel="noopener noreferrer" className="text-neural-cyan hover:underline">IntelliForge AI</a>
          {" "}· <a href="https://www.intelliforge.tech" target="_blank" rel="noopener noreferrer" className="text-neural-purple hover:underline">#BuildwithAiGiri</a>
          {" "}MVP #10
        </p>
        <div className="flex gap-4 text-sm text-neural-muted">
          <Link href="/session" className="hover:text-white">Free Session</Link>
          <a href="mailto:girish@intelliforge.tech" className="hover:text-white">Support</a>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setIsLoggedIn(Boolean(user)))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <main className="min-h-screen bg-neural-bg">
      <Navbar isLoggedIn={isLoggedIn} />
      <Hero isLoggedIn={isLoggedIn} />
      <HowItWorks />
      <Features />
      <Roles />
      <Pricing />
      <Footer />
    </main>
  );
}
