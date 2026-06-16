import { Sparkles, MapPin, Brain, MessageSquare } from 'lucide-react';

interface Props {
  onPick: (text: string) => void;
}

const SAMPLES = [
  { text: '帮我分析下湖北大学4公里范围内有哪些公园', icon: MapPin },
  { text: '武汉市近一年新增了多少个地铁站？', icon: Sparkles },
  { text: '解释一下你处理空间问题的流程', icon: Brain },
];

export function EmptyState({ onPick }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 animate-fade-in">
      <div className="size-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30 mb-6">
        <MessageSquare className="size-8 text-white" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">luojia fox</h1>
      <p className="mt-3 text-stone-600 max-w-md">
        在下方输入地理 / 空间分析问题，智能体会展示思考阶段、工具调用、最终答案以及生成的结果文件。
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
        {SAMPLES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.text}
              onClick={() => onPick(s.text)}
              className="group flex items-center gap-2 rounded-full border border-stone-200 bg-white hover:border-teal-300 hover:bg-teal-50/60 px-4 py-2 text-sm text-stone-700 hover:text-stone-900 transition shadow-sm"
            >
              <Icon className="size-4 text-teal-600 group-hover:text-teal-700" />
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
