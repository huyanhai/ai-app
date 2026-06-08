import { CARD } from "@/constants/class-names";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
const Frame = () => {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      className="absolute top-1/2 -left-22 -translate-y-1/2 h-[80%] w-20 flex items-center justify-end"
    >
      <motion.div
        animate={{
          rotate: hover ? 2 : 6,
          translateX: hover ? -44 : -6,
        }}
        whileHover={{
          translateY: -5,
        }}
        transition={{ duration: 0.2 }}
        className={`${CARD} backdrop-blur-xs bg-black/70 cursor-pointer w-14 h-20 shrink-0 -translate-x-6 absolute flex flex-col justify-center items-center`}
      >
        <Plus size={16} />
        首帧
      </motion.div>
      <motion.div
        whileHover={{
          translateY: -5,
        }}
        className={`${CARD} backdrop-blur-xs bg-black/70 cursor-pointer w-14 h-20 -rotate-6 shrink-0 absolute flex flex-col justify-center items-center`}
      >
        <Plus size={16} />
        尾帧
      </motion.div>
    </motion.div>
  );
};

export default Frame;
