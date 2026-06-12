/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState } from "react";
import { 
  Baby, 
  BookOpen, 
  Clock, 
  Wrench, 
  Layers, 
  Lightbulb, 
  Target,
  FileDown,
  Link,
  Youtube
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import KnowledgeCard from "./KnowledgeCard";
import { KnowledgeResponse } from "@/src/types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface KnowledgeDisplayProps {
  data: KnowledgeResponse;
  onDeepDive?: (topic: string) => void;
  isDark?: boolean;
}

export default function KnowledgeDisplay({ data, onDeepDive, isDark }: KnowledgeDisplayProps) {
  const displayRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!displayRef.current) return;
    
    try {
      const bgColor = isDark ? "#013E37" : "#FFEFB3";
      // Find all buttons inside the capture area and temporarily hide them or just tell html2canvas to skip them
      const canvas = await html2canvas(displayRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: bgColor,
        allowTaint: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        ignoreElements: (element) => {
          // Ignore the "Export Full Report" button if it's somehow inside (though it shouldn't be based on JSX)
          // and ignore the little screenshot/copy buttons on cards for the full report to keep it clean
          return !!(element.tagName === 'BUTTON' || element.getAttribute('title')?.includes('Screenshot') || element.getAttribute('title')?.includes('Copy'));
        },
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('capture-report');
          if (el) {
            el.style.padding = "40px";
            // Ensure no oklch/oklab leaks in cloned doc which crash html2canvas
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              #capture-report * {
                color: ${isDark ? "#FFEFB3" : "#013E37"} !important;
                border-color: ${isDark ? "#FFEFB3" : "#013E37"} !important;
              }
              .bg-\\[\\#013E37\\] { background-color: #013E37 !important; }
              .bg-\\[\\#FFEFB3\\] { background-color: #FFEFB3 !important; }
            `;
            clonedDoc.head.appendChild(style);

            const allElements = el.querySelectorAll('*');
              allElements.forEach((e: any) => {
                if (e.style.color.includes('oklch') || e.style.color.includes('oklab')) e.style.color = isDark ? '#FFEFB3' : '#013E37';
                if (e.style.backgroundColor.includes('oklch') || e.style.backgroundColor.includes('oklab')) e.style.backgroundColor = isDark ? '#013E37' : '#FFEFB3';
                if (e.style.borderColor.includes('oklch') || e.style.borderColor.includes('oklab')) e.style.borderColor = isDark ? '#FFEFB3' : '#013E37';
              });
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.width / imgProps.height;
      
      let width = pdfWidth - 40;
      let height = width / ratio;
      
      if (height > pdfHeight - 40) {
        height = pdfHeight - 40;
        width = height * ratio;
      }
      
      pdf.setFillColor(bgColor);
      pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
      
      pdf.addImage(imgData, "PNG", (pdfWidth - width) / 2, 20, width, height);
      pdf.save(`${data.title.toLowerCase().replace(/\s+/g, "_")}_full_report.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportServerPDF = async () => {
    setIsExporting(true);
    let success = false;
    
    try {
      console.log("Attempting server-side high-fidelity PDF generation via fetch API...");
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data,
          isDark
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/pdf")) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `${data.title.toLowerCase().replace(/\s+/g, "_")}_full_report.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          success = true;
          console.log("Server-side high-fidelity PDF generated and downloaded successfully via fetch API!");
        } else {
          console.warn("Server response was not application/pdf, invoking client-side fallback...");
        }
      } else {
        console.warn(`Server PDF export endpoint returned error status ${response.status}. Invoking client-side fallback...`);
      }
    } catch (err) {
      console.error("Server-side PDF export via fetch failed with exception. Invoking client-side fallback:", err);
    }

    if (!success) {
      try {
        console.log("Running local client-side fallback HTML-to-PDF rendering...");
        await downloadPDF();
        console.log("Client-side fallback PDF generated successfully!");
      } catch (fallbackErr) {
        console.error("Both server-side and client-side PDF generation failed:", fallbackErr);
        alert("We encountered an issue downloading the PDF. Please try again or take a screenshot.");
      }
    }

    setIsExporting(false);
  };

  const sections = [
    {
      title: "🧒 Layman Term",
      icon: <Baby className="w-4 h-4 translate-y-[-2px]" />,
      content: data.layman,
    },
    {
      title: "📡 Definition",
      icon: <BookOpen className="w-4 h-4 translate-y-[-1px]" />,
      content: data.definition,
    },
    {
      title: "⏱️ When to Use",
      icon: <Clock className="w-4 h-4" />,
      content: data.when_to_use,
    },
    {
      title: "🛠️ How to Make",
      icon: <Wrench className="w-4 h-4" />,
      content: data.how_to_make,
    },
    {
      title: "🧩 Types",
      icon: <Layers className="w-4 h-4" />,
      content: data.types,
    },
    {
      title: "💡 Points to Ponder",
      icon: <Lightbulb className="w-4 h-4" />,
      content: data.points_to_ponder,
    },
    {
      title: "🎯 Conclusion",
      icon: <Target className="w-4 h-4" />,
      content: data.conclusion,
    },
    {
      title: "🔗 Recommended Sources",
      icon: <Link className="w-4 h-4" />,
      content: data.sources || [],
    },
    {
      title: "📺 Best Video Guide",
      icon: <Youtube className="w-4 h-4" />,
      content: data.youtube_id ? "VIDEO_ID:" + data.youtube_id : "",
      fallback: data.youtube_fallback,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">
      <div id="capture-report" ref={displayRef} className={cn("p-6 transition-colors duration-300", isDark ? "bg-[#013E37]" : "bg-[#FFEFB3]")}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10 space-y-2"
        >
          <span className={cn(
            "font-black text-[10px] uppercase tracking-[0.4em] block",
            isDark ? "text-teal-200" : "text-teal-400"
          )}>
            STRUCTURED_KNOWLEDGE_DASHBOARD
          </span>
          <h2 className={cn(
            "text-2xl md:text-4xl font-black uppercase tracking-tighter leading-tight break-words transition-colors",
            isDark ? "text-[#FFEFB3]" : "text-[#013E37]"
          )}>
            {data.title}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sections.map((section, idx) => {
            let span = "lg:col-span-1";
            if (idx === 0) span = "lg:col-span-2";
            if (idx === 3) span = "lg:col-span-1 lg:row-span-2";
            if (idx === 5) span = "lg:col-span-2";
            if (idx === 6 || idx === 7) span = "lg:col-span-2";
            if (idx === 8) span = "lg:col-span-4"; // Video spans everything at the bottom

            return (
              <div key={idx} className={span}>
                <KnowledgeCard {...section} index={idx} onDeepDive={onDeepDive} isDark={isDark} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center pt-8">
         <button
          onClick={exportServerPDF}
          disabled={isExporting}
          className={cn(
            "flex items-center space-x-3 px-8 py-4 font-black text-xs uppercase tracking-[0.2em] transition-all border-b-6 shadow-xl relative overflow-hidden",
            isExporting 
              ? "opacity-60 cursor-not-allowed select-none"
              : "",
            isDark 
              ? "bg-[#FFEFB3] text-[#013E37] border-teal-200 active:border-b-0 active:translate-y-1 hover:bg-white" 
              : "bg-[#013E37] text-[#FFEFB3] border-[#011a17] active:border-b-0 active:translate-y-1 hover:bg-teal-800"
          )}
        >
          {isExporting ? (
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block"></span>
              <span>SYNTHESIZING_PDF...</span>
            </div>
          ) : (
            <>
              <FileDown className="w-5 h-5 animate-pulse" />
              <span>Export High-Fidelity PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
