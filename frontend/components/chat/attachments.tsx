import { FileIcon, X } from "lucide-react";
import React, { useState } from "react";
import * as motion from "motion/react-client";

export interface AttachmentFile {
  name: string;
  url: string; // Data URI containing base64
  type: string;
  file: File;
}

export interface IProps {
  attachments: AttachmentFile[];
  onRemoveAttachment: (index: number) => void;
}

const Attachments: React.FC<IProps> = ({ attachments, onRemoveAttachment }) => {
  const [hoverEnd, setHoverEnd] = useState(true);
  return (
    <div className="absolute -top-15 left-0 w-full">
      <div className="relative">
        {attachments.map((att, i) => {
          const isImage = att.type.startsWith("image/");
          return (
            <motion.div
              whileHover={{
                zIndex: attachments.length + 1,
                filter: "blur(0px)",
                scale: 1.1,
              }}
              onHoverStart={() => setHoverEnd(false)}
              onHoverEnd={() => setHoverEnd(true)}
              key={i}
              style={{
                left: `${i * 30}px`,
                zIndex: i,
                filter: hoverEnd ? "blur(0px)" : "blur(1px)",
              }}
              className={`absolute group flex items-center gap-2 rounded-xl backdrop-blur-xs bg-slate-100/50 dark:bg-slate-800/80 p-2 pr-8 text-xs border border-slate-200/80 dark:border-slate-700/50 max-w-[160px] truncate`}
            >
              {isImage ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  <FileIcon className="h-4 w-4" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {att.name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {(att.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Attachments;
