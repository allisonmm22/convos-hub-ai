import { useRef, useCallback, useEffect, useState, useMemo, memo, useLayoutEffect } from 'react';
import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, UserPen, Handshake, X, CalendarSearch, CalendarPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DescricaoEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onAcaoClick?: (cursorPosition: number) => void;
}

interface ChipConfig {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  bgClass: string;
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Parse ação para config visual - memoizado por ação
const acaoConfigCache = new Map<string, ChipConfig>();

function parseAcao(acao: string): ChipConfig {
  const cached = acaoConfigCache.get(acao);
  if (cached) return cached;
  
  const acaoLower = acao.toLowerCase();
  let config: ChipConfig;
  
  if (acaoLower.startsWith('@nome:')) {
    const valor = acao.replace(/^@nome:/i, '');
    config = {
      icon: UserPen,
      label: `Alterar Nome: ${valor}`,
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    };
  } else if (acaoLower === '@nome') {
    config = {
      icon: UserPen,
      label: 'Capturar Nome',
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    };
  } else if (acaoLower.startsWith('@tag:')) {
    const valor = acao.replace(/^@tag:/i, '');
    config = {
      icon: Tag,
      label: `Adicionar Tag: ${valor}`,
      colorClass: 'text-blue-700 dark:text-blue-400',
      bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
    };
  } else if (acaoLower.startsWith('@negociacao:')) {
    const valor = acao.replace(/^@negociacao:/i, '');
    config = {
      icon: Handshake,
      label: `Criar Negociação: ${valor}`,
      colorClass: 'text-orange-700 dark:text-orange-400',
      bgClass: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
    };
  } else if (acaoLower.startsWith('@etapa:')) {
    const valor = acao.replace(/^@etapa:/i, '');
    config = {
      icon: Layers,
      label: `Mover para Estágio: ${valor}`,
      colorClass: 'text-purple-700 dark:text-purple-400',
      bgClass: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
    };
  } else if (acaoLower.startsWith('@transferir:humano') || acaoLower.startsWith('@transferir:usuario:')) {
    const valor = acaoLower === '@transferir:humano' 
      ? 'Atendente' 
      : acao.replace(/^@transferir:usuario:/i, '');
    config = {
      icon: UserRound,
      label: `Transferir para: ${valor}`,
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    };
  } else if (acaoLower.startsWith('@transferir:ia') || acaoLower.startsWith('@transferir:agente:')) {
    const valor = acaoLower === '@transferir:ia' 
      ? 'IA Principal' 
      : acao.replace(/^@transferir:agente:/i, '');
    config = {
      icon: Bot,
      label: `Transferir Agente: ${valor}`,
      colorClass: 'text-indigo-700 dark:text-indigo-400',
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700',
    };
  } else if (acaoLower.startsWith('@fonte:')) {
    const valor = acao.replace(/^@fonte:/i, '');
    config = {
      icon: Globe,
      label: `Atribuir Fonte: ${valor}`,
      colorClass: 'text-teal-700 dark:text-teal-400',
      bgClass: 'bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-700',
    };
  } else if (acaoLower.startsWith('@notificar:')) {
    const valor = acao.replace(/^@notificar:/i, '');
    config = {
      icon: Bell,
      label: `Notificar: ${valor.substring(0, 30)}${valor.length > 30 ? '...' : ''}`,
      colorClass: 'text-red-700 dark:text-red-400',
      bgClass: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
    };
  } else if (acaoLower.startsWith('@produto:')) {
    const valor = acao.replace(/^@produto:/i, '');
    config = {
      icon: Package,
      label: `Atribuir Produto: ${valor}`,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
    };
  } else if (acaoLower === '@finalizar') {
    config = {
      icon: StopCircle,
      label: 'Interromper Agente',
      colorClass: 'text-gray-700 dark:text-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
    };
  } else if (acaoLower.startsWith('@agenda:consultar:')) {
    const valor = acao.replace(/^@agenda:consultar:/i, '');
    config = {
      icon: CalendarSearch,
      label: `Consultar Agenda: ${valor}`,
      colorClass: 'text-sky-700 dark:text-sky-400',
      bgClass: 'bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700',
    };
  } else if (acaoLower === '@agenda:consultar') {
    config = {
      icon: CalendarSearch,
      label: 'Consultar Agenda',
      colorClass: 'text-sky-700 dark:text-sky-400',
      bgClass: 'bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700',
    };
  } else if (acaoLower.startsWith('@agenda:criar:')) {
    const partes = acao.replace(/^@agenda:criar:/i, '').split(':');
    const calendario = partes[0] || '';
    const duracao = partes[1] ? `${partes[1]}min` : '';
    const hasMeet = partes[2] === 'meet';
    
    let label = `Criar Evento: ${calendario}`;
    if (duracao) {
      label += ` (${duracao}${hasMeet ? ' + Meet' : ''})`;
    }
    
    config = {
      icon: CalendarPlus,
      label,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
    };
  } else if (acaoLower === '@agenda:criar') {
    config = {
      icon: CalendarPlus,
      label: 'Criar Evento',
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
    };
  } else {
    config = {
      icon: Tag,
      label: acao,
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted border-border',
    };
  }
  
  acaoConfigCache.set(acao, config);
  return config;
}

// Componente ActionChip memoizado
const ActionChip = memo(function ActionChip({ 
  action, 
  onRemove 
}: { 
  action: string; 
  onRemove?: () => void;
}) {
  const config = parseAcao(action);
  const Icon = config.icon;
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium whitespace-nowrap cursor-default ${config.bgClass} ${config.colorClass}`}
            style={{ verticalAlign: 'middle' }}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span>{config.label}</span>
            {onRemove && (
              <button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }}
                className="flex-shrink-0 hover:opacity-70 text-current pointer-events-auto"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-mono">{action}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Shared styles constant
const SHARED_STYLES: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  lineHeight: '1.75rem',
  padding: '1rem',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
};

export function DescricaoEditor({ value, onChange, placeholder, onAcaoClick }: DescricaoEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  
  // Estado local para edição fluida
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  
  // Sincronizar quando value externo muda (ex: inserção de ação via modal)
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);
  
  // Debounce para sincronizar com pai - só quando usuário está digitando
  const debouncedLocalValue = useDebounce(localValue, 150);
  
  useEffect(() => {
    if (debouncedLocalValue !== value) {
      onChange(debouncedLocalValue);
    }
  }, [debouncedLocalValue, onChange, value]);

  // Debounce maior para renderização de chips (evita lag durante digitação)
  const debouncedValueForChips = useDebounce(localValue, 300);
  
  // Handler de mudança otimizado - atualiza apenas estado local
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  }, []);

  // Sincronizar scroll entre textarea e overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Auto-resize otimizado com requestAnimationFrame
  useLayoutEffect(() => {
    if (!textareaRef.current) return;
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.max(160, textareaRef.current.scrollHeight) + 'px';
      }
    });
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [localValue]);

  // Handler para tecla @
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@' && onAcaoClick) {
      e.preventDefault();
      const pos = textareaRef.current?.selectionStart ?? localValue.length;
      onAcaoClick(pos);
    }
  }, [onAcaoClick, localValue.length]);

  // Remover ação por posição no texto - memoizado
  const handleRemoveAction = useCallback((startIndex: number, endIndex: number) => {
    const before = localValue.slice(0, startIndex);
    const after = localValue.slice(endIndex);
    
    const cleanBefore = before.endsWith(' ') ? before.slice(0, -1) : before;
    const cleanAfter = after.startsWith(' ') ? after.slice(1) : after;
    
    const newValue = cleanBefore + (cleanBefore.length > 0 && cleanAfter.length > 0 ? ' ' : '') + cleanAfter;
    const trimmed = newValue.trim();
    setLocalValue(trimmed);
    onChange(trimmed);
  }, [localValue, onChange]);

  // Renderizar chips memoizado - usa valor debounced
  const renderedChips = useMemo(() => {
    if (!debouncedValueForChips) return null;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Usar matchAll ao invés de exec para evitar problemas com lastIndex global
    const regex = /@(nome|tag|etapa|transferir|fonte|notificar|produto|finalizar|negociacao|agenda)(:[^\s@<>.,;!?]+)?/gi;
    const matches = Array.from(debouncedValueForChips.matchAll(regex));
    
    for (const match of matches) {
      const matchIndex = match.index!;
      
      if (matchIndex > lastIndex) {
        const textBefore = debouncedValueForChips.slice(lastIndex, matchIndex);
        parts.push(
          <span key={`text-${lastIndex}`} className="text-foreground">
            {textBefore}
          </span>
        );
      }
      
      const matchStart = matchIndex;
      const matchEnd = matchIndex + match[0].length;
      parts.push(
        <ActionChip 
          key={`action-${matchIndex}`}
          action={match[0]} 
          onRemove={() => handleRemoveAction(matchStart, matchEnd)}
        />
      );
      
      lastIndex = matchEnd;
    }
    
    if (lastIndex < debouncedValueForChips.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-foreground">
          {debouncedValueForChips.slice(lastIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? parts : null;
  }, [debouncedValueForChips, handleRemoveAction]);

  // Verificar se há ações - usa valor debounced para consistência visual
  const hasActions = useMemo(() => {
    const regex = /@(nome|tag|etapa|transferir|fonte|notificar|produto|finalizar|negociacao|agenda)(:[^\s@<>.,;!?]+)?/i;
    return regex.test(debouncedValueForChips);
  }, [debouncedValueForChips]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full"
      onClick={() => textareaRef.current?.focus()}
    >
      {/* Overlay com chips visuais */}
      {hasActions && (
        <div
          ref={overlayRef}
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{
            ...SHARED_STYLES,
            color: 'transparent',
            background: 'transparent',
          }}
          aria-hidden="true"
        >
          <div>{renderedChips}</div>
        </div>
      )}

      {/* Textarea real */}
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full min-h-[160px] rounded-xl bg-input border text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-lg transition-all duration-200 resize-none ${
          isFocused ? 'border-primary' : 'border-border'
        } ${hasActions ? 'text-transparent caret-foreground' : 'text-foreground'}`}
        style={{
          ...SHARED_STYLES,
          WebkitTextFillColor: hasActions ? 'transparent' : undefined,
          caretColor: 'hsl(var(--foreground))',
        }}
      />

      {/* Placeholder personalizado */}
      {!localValue && !isFocused && placeholder && (
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none text-muted-foreground text-sm"
          style={SHARED_STYLES}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}

// Função auxiliar para obter posição do cursor
export function getTextareaCursorPosition(textareaElement: HTMLTextAreaElement | null): number {
  return textareaElement?.selectionStart ?? 0;
}

// Inserir ação na posição do cursor
export function inserirAcaoNoEditor(
  currentValue: string,
  action: string,
  onChange: (value: string) => void,
  cursorPosition?: number
) {
  const insertPosition = cursorPosition ?? currentValue.length;
  
  const before = currentValue.substring(0, insertPosition);
  const after = currentValue.substring(insertPosition);
  const needsSpaceBefore = before.length > 0 && before[before.length - 1] !== ' ' && before[before.length - 1] !== '\n';
  const needsSpaceAfter = after.length > 0 && after[0] !== ' ' && after[0] !== '\n';
  
  const newValue = before + (needsSpaceBefore ? ' ' : '') + action + (needsSpaceAfter ? ' ' : '') + after;
  onChange(newValue);
}
