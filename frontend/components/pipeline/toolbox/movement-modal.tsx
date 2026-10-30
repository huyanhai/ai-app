"use client";
import { useEffect, useState } from "react";
import ToolboxModal from "./toolbox-modal";
import { MOVEMENTS } from "./data";

const MovementModal = ({
  open,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <ToolboxModal
      open={open}
      title="运镜"
      width={1120}
      onClose={onClose}
      onConfirm={() => selected && onConfirm(selected)}
      confirmDisabled={!selected}
    >
      <div className="grid max-h-[62vh] grid-cols-5 gap-5 overflow-y-auto px-6 pt-4 pb-2">
        {MOVEMENTS.map((movement) => (
          <button
            key={movement.name}
            aria-pressed={selected === movement.name}
            onClick={() => setSelected(movement.name)}
            className="flex flex-col text-left cursor-pointer"
          >
            <div
              className={`overflow-hidden rounded-xl border-2 transition-colors ${
                selected === movement.name
                  ? "border-white"
                  : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={movement.image}
                alt={movement.name}
                className="aspect-square w-full object-cover"
              />
            </div>
            <div
              className={`py-2 text-center text-sm transition-colors ${
                selected === movement.name ? "text-white" : "text-white/60"
              }`}
            >
              {movement.name}
            </div>
          </button>
        ))}
      </div>
    </ToolboxModal>
  );
};

export default MovementModal;
