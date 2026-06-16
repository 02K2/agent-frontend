import { User, Bot, Loader2, AlertCircle } from 'lucide-react';
import { FinalAnswer } from './FinalAnswer';
import { AgentProcessPanel } from './AgentProcessPanel';
import type { ChatMessage } from '../hooks/useChatStream';

interface Props {
  message: ChatMessage;
  onAddToMap?: (url: string, name: string) => void;
  mapLoadingUrl?: string | null;
  mapAddedUrls?: string[];
  mapOpen?: boolean;
  onOpenMap?: () => void;
}

export function MessageBubble({
  message,
  onAddToMap,
  mapLoadingUrl,
  mapAddedUrls,
  mapOpen,
  onOpenMap,
}: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%] flex items-start gap-2.5">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-teal-500 to-emerald-600 text-white px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words shadow-sm">
            {message.text}
          </div>
          <div className="size-8 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center flex-shrink-0">
            <User className="size-4 text-teal-700" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-slide-up">
      <div className="max-w-[90%] flex items-start gap-2.5">
        <div className="size-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Bot className="size-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-sm bg-white border border-stone-200 px-4 py-3 text-stone-800 shadow-sm">
            {message.status === 'error' ? (
              <div className="flex items-start gap-2 text-rose-700 text-sm">
                <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">执行出错</div>
                  <div className="text-rose-600 text-[13px] mt-0.5">
                    {message.errorMessage || '未知错误'}
                  </div>
                </div>
              </div>
            ) : message.finalContent ? (
              <FinalAnswer
                content={message.finalContent}
                onAddToMap={onAddToMap}
                mapLoadingUrl={mapLoadingUrl}
                mapAddedUrls={mapAddedUrls}
                mapOpen={mapOpen}
                onOpenMap={onOpenMap}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="size-4 animate-spin text-teal-600" />
                正在处理…
              </div>
            )}
          </div>

          {/* 思考过程面板：折叠式 */}
          {(message.status === 'streaming' || message.progresses.length > 0) && (
            <AgentProcessPanel message={message} />
          )}
        </div>
      </div>
    </div>
  );
}
