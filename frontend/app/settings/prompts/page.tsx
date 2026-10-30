import { MessageSquareText } from "lucide-react";

// 提示词配置（待实现）
const Page = () => (
  <>
    <header className="border-b border-white/5 px-8 py-5">
      <h2 className="text-base font-medium">提示词配置</h2>
      <p className="mt-1 text-xs text-white/40">
        管理各类生成能力使用的提示词模板
      </p>
    </header>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/40">
      <MessageSquareText size={28} className="text-white/20" />
      <p className="text-sm">提示词配置开发中</p>
    </div>
  </>
);

export default Page;
