import type { GaNode } from './sse-types';
import { Brain, Search, ListChecks, Play, GitFork, ShieldAlert, FileOutput } from 'lucide-react';
import type { ComponentType } from 'react';

export interface NodeMeta {
  label: string;
  short: string;
  Icon: ComponentType<{ className?: string }>;
  tone: string;
}

export const NODE_META: Record<string, NodeMeta> = {
  ga_intent_interpreter: {
    label: '意图理解 · 时空参数抽取',
    short: '意图理解',
    Icon: Brain,
    tone: 'text-violet-600',
  },
  ga_rag: {
    label: 'GeoSkill · 算子 · 数据产品召回',
    short: 'RAG 召回',
    Icon: Search,
    tone: 'text-cyan-600',
  },
  ga_planner: {
    label: '生成执行计划',
    short: '计划生成',
    Icon: ListChecks,
    tone: 'text-amber-600',
  },
  ga_executor: {
    label: '执行当前步骤',
    short: '执行',
    Icon: Play,
    tone: 'text-emerald-600',
  },
  ga_replanner: {
    label: '检查后续步骤',
    short: '重规划',
    Icon: GitFork,
    tone: 'text-sky-600',
  },
  ga_error_reflector: {
    label: '分析执行错误',
    short: '错误反思',
    Icon: ShieldAlert,
    tone: 'text-rose-600',
  },
  ga_result_aggregator: {
    label: '汇总最终结果',
    short: '结果汇总',
    Icon: FileOutput,
    tone: 'text-teal-600',
  },
};

export function metaFor(node: GaNode | undefined): NodeMeta {
  if (!node) {
    return {
      label: '处理中',
      short: '处理中',
      Icon: Brain,
      tone: 'text-stone-500',
    };
  }
  return (
    NODE_META[node] ?? {
      label: node,
      short: node,
      Icon: Brain,
      tone: 'text-stone-500',
    }
  );
}
