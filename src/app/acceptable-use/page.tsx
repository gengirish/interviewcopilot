import Link from "next/link";
import { Mic, Shield, BookOpen, Users, Scale } from "lucide-react";

export default function AcceptableUsePage() {
  return (
    <main className="min-h-screen bg-neural-bg">
      <nav className="border-b border-neural-border bg-neural-bg/80 backdrop-blur-md px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mic className="w-6 h-6 text-neural-cyan" />
            <span className="font-bold text-lg text-white">InfinityHire Copilot</span>
          </Link>
          <Link href="/session" className="text-sm text-neural-muted hover:text-white transition-colors">
            Back to app
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-neural-cyan" />
          <h1 className="text-3xl font-bold text-white">Acceptable Use Policy</h1>
        </div>
        <p className="text-neural-muted text-lg mb-10 leading-relaxed">
          InfinityHire Copilot is an AI-powered interview preparation and practice tool.
          We believe in building technology responsibly. This policy outlines how
          our product is designed to be used.
        </p>

        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-neural-cyan" />
              <h2 className="text-xl font-bold text-white">Designed for preparation and practice</h2>
            </div>
            <div className="pl-7 space-y-3 text-neural-muted leading-relaxed">
              <p>
                InfinityHire Copilot helps candidates prepare for technical interviews
                by providing practice questions, AI-generated sample answers, structured
                debriefs, and personalised improvement plans.
              </p>
              <p>
                Like flashcards, mock interviews with friends, or coaching sessions,
                our tool is a <strong className="text-white">preparation aid</strong> — not a
                substitute for genuine knowledge and experience.
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-neural-cyan" />
              <h2 className="text-xl font-bold text-white">User responsibilities</h2>
            </div>
            <ul className="pl-7 space-y-2 text-neural-muted leading-relaxed list-disc list-inside">
              <li>Use InfinityHire Copilot to <strong className="text-white">practice and improve</strong> your interview skills.</li>
              <li>Be honest about your qualifications, experience, and skills in interviews.</li>
              <li>Do not misrepresent AI-generated answers as your own original thought during live assessments where prohibited by the hiring company.</li>
              <li>Respect the interview process and the time of interviewers.</li>
              <li>Comply with any employer or institution policies regarding the use of AI tools.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-neural-cyan" />
              <h2 className="text-xl font-bold text-white">Our commitment</h2>
            </div>
            <ul className="pl-7 space-y-2 text-neural-muted leading-relaxed list-disc list-inside">
              <li>We design our product to help users <strong className="text-white">genuinely improve</strong> — through debriefs, progress tracking, and coaching — not just provide answers.</li>
              <li>We do not store or share any audio recordings. Voice transcription happens entirely in your browser using the Web Speech API.</li>
              <li>We do not access or interact with your video call platforms (Zoom, Meet, Teams).</li>
              <li>Session data is stored securely and only accessible to your account.</li>
              <li>We continuously improve our AI to provide more accurate, role-relevant, and constructive responses.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-neural-purple" />
              <h2 className="text-xl font-bold text-white">Prohibited uses</h2>
            </div>
            <ul className="pl-7 space-y-2 text-neural-muted leading-relaxed list-disc list-inside">
              <li>Using the tool to impersonate another person or fabricate credentials.</li>
              <li>Circumventing rate limits, quota enforcement, or other technical safeguards.</li>
              <li>Attempting to extract or reverse-engineer the AI models or prompts.</li>
              <li>Any use that violates applicable laws or regulations.</li>
            </ul>
          </section>

          <div className="border-t border-neural-border pt-8 mt-8">
            <p className="text-neural-muted text-sm">
              Questions about this policy? Contact us at{" "}
              <a href="mailto:hello@infinityhire.ai" className="text-neural-cyan hover:underline">
                hello@infinityhire.ai
              </a>
            </p>
            <p className="text-neural-muted text-xs mt-2">
              Last updated: April 2026
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
