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
import { TNodeImage } from "../../types";
import { $createImageNode } from "../nodes";
import { CARD } from "@/constants/class-names";

class MentionOption extends MenuOption {
  url: string;
  title: string;

  constructor(image: TNodeImage) {
    super(image.id);
    this.url = image.data.url;
    this.title = image.data.title || "图片";
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
      .filter((image) =>
        (image.data.title || "图片").toLowerCase().includes((query || "").toLowerCase()),
      )
      .map((image) => new MentionOption(image))
      .slice(0, 5);
  }, [images, query]);

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      commandPriority={COMMAND_PRIORITY_EDITOR}
      onQueryChange={setQuery}
      triggerFn={checkForTriggerMatch}
      options={options}
      onSelectOption={(option, nodeToReplace, closeMenu) => {
        const nodeKey = nodeToReplace?.getKey();
        editor.update(() => {
          const node = nodeKey ? $getNodeByKey(nodeKey) : null;
          if (node?.isAttached()) {
            const imageNode = $createImageNode(option.url, option.title);
            const spaceNode = $createTextNode(" ");
            node.replace(imageNode);
            imageNode.insertAfter(spaceNode);
            spaceNode.select(0, 0);
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
                  {option.title}
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
