import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  COMMAND_PRIORITY_EDITOR,
  $getNodeByKey,
  $createTextNode,
} from "lexical";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TNodeImage, TNodeImageData } from "../../types";
import { $createImageNode } from "../nodes";
import { CARD } from "@/constants/class-names";

class MentionOption extends MenuOption {
  url: string;

  constructor(url: string) {
    super(url);
    this.url = url;
  }
}

const ImageMentionPlugin = ({ images }: { images: TNodeImage[] }) => {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const checkForTriggerMatch = useCallback((text: string) => {
    const triggerIndex = text.lastIndexOf("@");
    if (triggerIndex === -1) return null;

    const matchingString = text.slice(triggerIndex + 1);

    return {
      leadOffset: triggerIndex,
      matchingString,
      replaceableString: text.slice(triggerIndex),
    };
  }, []);

  const options = useMemo(() => {
    return images
      .filter((img) => img.data.url.includes(query || ""))
      .map((image) => new MentionOption(image.data.url))
      .slice(0, 5);
  }, [images, query]);

  return (
    <LexicalTypeaheadMenuPlugin<
      TNodeImageData & {
        key: string;
        setRefElement: (element: HTMLElement) => void;
      }
    >
      commandPriority={COMMAND_PRIORITY_EDITOR}
      onQueryChange={setQuery}
      triggerFn={checkForTriggerMatch}
      options={options}
      onSelectOption={(option, nodeToReplace, closeMenu) => {
        const nodeKey = nodeToReplace?.getKey();
        editor.update(() => {
          const node = nodeKey ? $getNodeByKey(nodeKey) : null;
          const spaceNode = $createTextNode(" ");
          if (node?.isAttached()) {
            node.replace($createImageNode(option.url));
            // node.insertAfter(spaceNode);
          }
        });

        closeMenu();
      }}
      // 渲染菜单
      menuRenderFn={(
        anchorElementRef,
        { options, selectedIndex, setHighlightedIndex, selectOptionAndCleanUp },
      ) => {
        if (!anchorElementRef.current) {
          return null;
        }

        if (options.length === 0) {
          return createPortal(
            <div
              className={`${CARD} absolute left-0 top-0 z-50 flex flex-col hover:bg-black/90 cursor-pointer whitespace-nowrap`}
            >
              暂无资源
            </div>,
            anchorElementRef.current,
          );
        }

        return createPortal(
          <div
            className={`${CARD} absolute left-0 top-0 z-50 flex flex-col hover:bg-black/90 cursor-pointer`}
          >
            {options.map((option, index) => (
              <div
                className="w-24 h-8 flex gap-2 items-center"
                key={option.key}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOptionAndCleanUp(option)}
              >
                <img
                  src={option.url}
                  className="block w-8 h-8 rounded-md object-cover"
                />
                <span className="inline-block truncate text-xs">
                  {option.url}
                </span>
              </div>
            ))}
          </div>,
          anchorElementRef.current,
        );
      }}
    />
  );
};

export default memo(ImageMentionPlugin);
