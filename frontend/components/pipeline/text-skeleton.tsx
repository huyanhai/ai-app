const TextSkeleton = () => {
  return (
    <div className="flex flex-col gap-2 w-full h-full justify-between">
      <div className="w-2/3 h-3 bg-white/10"></div>
      <div className="w-full h-3 bg-white/10"></div>
      <div className="w-4/5 h-3 bg-white/10"></div>
      <div className="w-2/4 h-3 bg-white/10"></div>
    </div>
  );
};

export default TextSkeleton;
