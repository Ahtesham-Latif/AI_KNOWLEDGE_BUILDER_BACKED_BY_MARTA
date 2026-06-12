/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Copy, Download, Check, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { cn, extractYouTubeId } from "@/src/lib/utils";
import html2canvas from "html2canvas";
import YouTubePlayer from "./YouTubePlayer";
import ErrorBoundary from "./ErrorBoundary";

interface KnowledgeCardProps {
  title: string;
  icon: React.ReactNode;
  content: string | string[];
  fallback?: string;
  index: number;
  onDeepDive?: (topic: string) => void;
  isDark?: boolean;
}

export default function KnowledgeCard({ title, icon, content, fallback, index, onDeepDive, isDark }: KnowledgeCardProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    const text = Array.isArray(content) ? content.join("\n") : content;
    navigator.clipboard.writeText(`${title}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScreenshot = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: isDark ? "#013E37" : "#FFEFB3",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => {
          // Force fix any oklch/oklab colors which crash html2canvas by injecting a global style
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              color: ${isDark ? "#FFEFB3" : "#013E37"} !important;
              background-color: transparent !important;
              border-color: ${isDark ? "#FFEFB3" : "#013E37"} !important;
            }
            .bg-\\[\\#013E37\\] { background-color: #013E37 !important; }
            .bg-\\[\\#FFEFB3\\] { background-color: #FFEFB3 !important; }
            .text-teal-400 { color: #2dd4bf !important; }
            .text-teal-600 { color: #0d9488 !important; }
          `;
          // Note: The selector '*' is a bit aggressive but solves the parsing crash. 
          // Let's refine it to only target things that might have those colors.
          
          clonedDoc.head.appendChild(style);
          
          // Original logic for specific elements if needed
          const elements = clonedDoc.querySelectorAll('*');
          elements.forEach((el: any) => {
            if (el.style.color.includes('oklch') || el.style.color.includes('oklab')) el.style.color = isDark ? "#FFEFB3" : "#013E37";
            if (el.style.backgroundColor.includes('oklch') || el.style.backgroundColor.includes('oklab')) el.style.backgroundColor = isDark ? "#013E37" : "#FFEFB3";
            if (el.style.borderColor.includes('oklch') || el.style.borderColor.includes('oklab')) el.style.borderColor = isDark ? "#FFEFB3" : "#013E37";
          });
        }
      });
      
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "_")}_shot.png`;
      a.click();
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  };

  const getYoutubeContent = (rawContent: string) => {
    const rawVal = rawContent.replace("VIDEO_ID:", "");
    return (
      <ErrorBoundary fallback={
        <div className="w-full aspect-video flex flex-col items-center justify-center p-8 text-center bg-teal-950/20 border-2 border-dashed border-teal-500/30 rounded-lg">
          <div className="text-lg font-black uppercase tracking-tight mb-2 text-red-500">Player Crash</div>
          <p className="text-xs opacity-60">Something went wrong while loading the player.</p>
        </div>
      }>
        <YouTubePlayer urlOrId={rawVal} fallbackQuery={fallback} />
      </ErrorBoundary>
    );
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 * index, duration: 0.5 }}
      className={cn(
        "border-2 transition-all duration-300 flex flex-col h-full group relative overflow-hidden",
        isDark 
          ? "bg-[#013E37] border-[#FFEFB3] shadow-bento-white" 
          : "bg-[#FFEFB3] border-[#013E37] shadow-bento"
      )}
    >
      <div className={cn(
        "p-3 flex items-center justify-between border-b-2 transition-colors",
        isDark 
          ? "bg-[#FFEFB3] text-[#013E37] border-[#FFEFB3]" 
          : "bg-[#013E37] text-[#FFEFB3] border-[#013E37]"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "transition-colors",
            isDark ? "text-teal-600" : "text-teal-400"
          )}>
            {icon}
          </div>
          <h3 className="font-extrabold text-[10px] uppercase tracking-widest">{title}</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={handleCopy}
            className="p-1 transition-all rounded hover:scale-110"
            title="Copy section"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
          <button 
            onClick={handleDownloadScreenshot}
            className="p-1 transition-all rounded hover:scale-110"
            title="Download Card Screenshot"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className={cn(
        "flex-1 font-medium leading-relaxed p-5 overflow-y-auto transition-colors",
        isDark ? "text-teal-50" : "text-[#013E37]"
      )}>
        {Array.isArray(content) ? (
          <ul className="space-y-2">
            {content.map((item, i) => (
              <li key={i} className="flex items-start space-x-2 text-xs group/item">
                <span className={cn(
                  "mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0",
                  isDark ? "bg-teal-400" : "bg-[#013E37]"
                )} />
                <span className="flex-grow">{item}</span>
                {onDeepDive && (
                  <button 
                    onClick={() => onDeepDive(item)}
                    className={cn(
                      "opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5",
                      isDark ? "text-teal-200" : "text-teal-300 hover:text-[#013E37]"
                    )}
                    title={`Deep dive into "${item}"`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : typeof content === 'string' && content.startsWith("VIDEO_ID:") ? (
          getYoutubeContent(content)
        ) : (
          <div className={cn(
            "text-sm leading-relaxed",
            title.includes("Definition") 
              ? cn(
                  "font-mono text-xs italic p-3 border-l-4",
                  isDark ? "bg-[#012b26] border-teal-400" : "bg-[#FFF5D1] border-[#013E37]"
                ) 
              : ""
          )}>
            {content}
          </div>
        )}
      </div>
    </motion.div>
  );
}

