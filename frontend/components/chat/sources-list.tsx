import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources";
import { Globe } from "lucide-react";

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

interface SourcesListProps {
  results: SearchResult[];
}

export function SourcesList({ results }: SourcesListProps) {
  if (!results || results.length === 0) return null;

  return (
    <Sources className="my-3">
      <SourcesTrigger count={results.length}>
        <span className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <span>Used {results.length} sources</span>
        </span>
      </SourcesTrigger>
      <SourcesContent>
        {results.map((src, idx) => (
          <Source key={idx} href={src.url} target="_blank" rel="noopener noreferrer">
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate hover:text-blue-500 transition-colors">
              {src.title || src.url}
            </div>
            {src.snippet && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {src.snippet}
              </div>
            )}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
              {src.url}
            </div>
          </Source>
        ))}
      </SourcesContent>
    </Sources>
  );
}
