/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

interface InputSectionProps {
  onGenerate: (topic: string, audience: string) => void;
  isLoading: boolean;
  isDark?: boolean;
}

const AUDIENCES = [
  { label: "Student", help: "Learn" },
  { label: "Dev", help: "Build" },
  { label: "Engineer", help: "Solve" },
  { label: "Business person", help: "Profit" },
  { label: "Kid", help: "Play" },
  { label: "Teacher", help: "Teach" },
  { label: "Donkey", help: "Bray" }
];

export default function InputSection({ onGenerate, isLoading, isDark }: InputSectionProps) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("Student");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onGenerate(topic, audience);
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 mb-16 relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "border-2 p-4 transition-all duration-300",
          isDark 
            ? "bg-[#013E37] border-[#FFEFB3] shadow-bento-white" 
            : "bg-[#FFEFB3] border-[#013E37] shadow-bento"
        )}
      >
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow flex flex-col gap-1">
            <label htmlFor="topic" className={cn(
              "text-[10px] uppercase font-extrabold tracking-widest ml-1",
              isDark ? "text-teal-200" : "text-teal-600"
            )}>
              Topic Input
            </label>
            <div className={cn(
              "relative flex items-center border px-3 py-2 h-10 transition-colors",
              isDark ? "bg-teal-800/50 border-teal-500" : "bg-[#F5F2E9] border-teal-200"
            )}>
              <Search className={cn("h-4 w-4 mr-3", isDark ? "text-teal-300" : "text-teal-600")} />
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., JWT Authentication"
                className={cn(
                  "block w-full bg-transparent text-sm font-bold outline-none",
                  isDark ? "text-white placeholder:text-teal-600" : "text-[#013E37] placeholder:text-teal-600"
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 md:w-1/3 relative group">
            <label htmlFor="audience" className={cn(
              "text-[10px] uppercase font-extrabold tracking-widest ml-1",
              isDark ? "text-teal-200" : "text-teal-600"
            )}>
              Target Audience
            </label>
            <div className="relative">
              <select
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={cn(
                  "block w-full border px-3 py-2 text-sm font-bold outline-none h-10 appearance-none cursor-pointer transition-colors",
                  isDark ? "bg-teal-800/50 border-teal-500 text-white" : "bg-[#FFF5D1] border-teal-200 text-[#013E37]"
                )}
              >
                {AUDIENCES.map(a => <option key={a.label} value={a.label} className={isDark ? "bg-[#013E37]" : "bg-white"}>{a.label}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-tighter",
                  isDark ? "text-teal-400" : "text-teal-400"
                )}>
                  {AUDIENCES.find(a => a.label === audience)?.help}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className={cn(
              "md:self-end px-8 py-3 font-black text-sm uppercase tracking-tighter transition-all h-10 flex items-center justify-center border-2",
              isLoading 
                ? (isDark ? "bg-teal-900 text-teal-800 border-teal-800" : "bg-teal-50 text-teal-200 border-teal-100")
                : (isDark 
                    ? "bg-[#FFEFB3] text-[#013E37] border-[#FFEFB3] hover:bg-white active:translate-y-1" 
                    : "bg-[#013E37] text-[#FFEFB3] border-[#013E37] hover:bg-teal-800 active:translate-y-1"
                  )
            )}
          >
            {isLoading ? "Synthesizing..." : "Generate"}
          </button>
        </form>
      </motion.div>
    </section>
  );
}

