/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

const TYPED_TEXT = "Knowledge Builder";

interface HeaderProps {
  isDark?: boolean;
}

export default function Header({ isDark }: HeaderProps) {
  return (
    <header className={cn(
      "py-8 flex flex-col md:flex-row items-center justify-between border-b-4 mb-8 px-4 transition-colors duration-300",
      isDark ? "border-[#FFEFB3]" : "border-[#013E37]"
    )}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col text-center md:text-left"
      >
        <h1 className={cn(
          "text-3xl font-extrabold uppercase tracking-tighter transition-colors",
          isDark ? "text-[#FFEFB3]" : "text-[#013E37]"
        )}>
          Structured AI{" "}
          <span className="text-teal-400">
            {TYPED_TEXT.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.07, duration: 0.1 }}
              >
                {char}
              </motion.span>
            ))}
          </span>
        </h1>
        <p className="text-teal-400 text-xs font-black uppercase tracking-[0.3em]">
          Synthesizing Intelligence into Fixed Modules
        </p>
      </motion.div>
    </header>
  );
}