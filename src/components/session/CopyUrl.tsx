import React, { useState } from "react";
import { motion } from "motion/react";

interface CopyUrlProps {
  url: string;
  displayText?: string;
  className?: string;
}

const CopyUrl: React.FC<CopyUrlProps> = ({ 
  url, 
  displayText, 
  className = "text-zinc-200 text-xs font-mono rounded bg-zinc-600 p-1 px-2 cursor-pointer", 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      
      // Reset the copied state after animation completes
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <motion.code
      className={className}
      onClick={handleCopy}
      animate={copied ? { 
        backgroundColor: ["#52525c", "#e4e4e7", "#52525c"],
        transition: { duration: 0.2, repeat: 1 } 
      } : {}}
      whileHover={{ opacity: 0.8 }}
      whileTap={{ scale: 0.98 }}
    >
      {displayText || url}
    </motion.code>
  );
};

export default CopyUrl;

