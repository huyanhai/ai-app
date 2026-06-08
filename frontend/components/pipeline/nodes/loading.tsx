const Loading = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/70 backdrop-blur-lg z-10 overflow-hidden">
      {/* Colorful Fluid Background */}
      <div className="absolute inset-0 opacity-60">
        <div
          className="absolute top-0 left-0 w-[120%] h-[120%] bg-red-500 rounded-full mix-blend-screen filter blur-[60px] animate-pulse -translate-x-1/4 -translate-y-1/4"
          style={{ animationDuration: "3s" }}
        />
        <div
          className="absolute top-0 right-0 w-[120%] h-[120%] bg-blue-500 rounded-full mix-blend-screen filter blur-[60px] animate-pulse translate-x-1/4 -translate-y-1/4"
          style={{ animationDuration: "4s", animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-[150%] h-[150%] bg-purple-500 rounded-full mix-blend-screen filter blur-[60px] animate-pulse -translate-x-1/2 translate-y-1/4"
          style={{ animationDuration: "5s", animationDelay: "2s" }}
        />
      </div>
    </div>
  );
};

export default Loading;
