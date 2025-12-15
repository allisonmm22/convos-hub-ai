import { useRef, useCallback, useEffect, useState } from 'react';
import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, UserPen, Handshake, X } from 'lucide-react';

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

// Parse ação para config visual
function parseAcao(acao: string): ChipConfig {
  const acaoLower = acao.toLowerCase();
  
  if (acaoLower.startsWith('@nome:')) {
    const valor = acao.replace(/^@nome:/i, '');
    return {
      icon: UserPen,
      label: `Alterar Nome: ${valor}`,
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    };
  }
  
  if (acaoLower === '@nome') {
    return {
      icon: UserPen,
      label: 'Capturar Nome',
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    };
  }
  
  if (acaoLower.startsWith('@tag:')) {
    const valor = acao.replace(/^@tag:/i, '');
    return {
      icon: Tag,
      label: `Adicionar Tag: ${valor}`,
      colorClass: 'text-blue-700 dark:text-blue-400',
      bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
    };
  }
  
  if (acaoLower.startsWith('@negociacao:')) {
    const valor = acao.replace(/^@negociacao:/i, '');
    return {
      icon: Handshake,
      label: `Criar Negociação: ${valor}`,
      colorClass: 'text-orange-700 dark:text-orange-400',
      bgClass: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
    };
  }
  
  if (acaoLower.startsWith('@etapa:')) {
    const valor = acao.replace(/^@etapa:/i, '');
    return {
      icon: Layers,
      label: `Mover para Estágio: ${valor}`,
      colorClass: 'text-purple-700 dark:text-purple-400',
      bgClass: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
    };
  }
  
  if (acaoLower.startsWith('@transferir:humano') || acaoLower.startsWith('@transferir:usuario:')) {
    const valor = acaoLower === '@transferir:humano' 
      ? 'Atendente' 
      : acao.replace(/^@transferir:usuario:/i, '');
    return {
      icon: UserRound,
      label: `Transferir para: ${valor}`,
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    };
  }
  
  if (acaoLower.startsWith('@transferir:ia') || acaoLower.startsWith('@transferir:agente:')) {
    const valor = acaoLower === '@transferir:ia' 
      ? 'IA Principal' 
      : acao.replace(/^@transferir:agente:/i, '');
    return {
      icon: Bot,
      label: `Transferir Agente: ${valor}`,
      colorClass: 'text-indigo-700 dark:text-indigo-400',
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700',
    };
  }
  
  if (acaoLower.startsWith('@fonte:')) {
    const valor = acao.replace(/^@fonte:/i, '');
    return {
      icon: Globe,
      label: `Atribuir Fonte: ${valor}`,
      colorClass: 'text-teal-700 dark:text-teal-400',
      bgClass: 'bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-700',
    };
  }
  
  if (acaoLower.startsWith('@notificar:')) {
    const valor = acao.replace(/^@notificar:/i, '');
    return {
      icon: Bell,
      label: `Notificar: ${valor.substring(0, 30)}${valor.length > 30 ? '...' : ''}`,
      colorClass: 'text-red-700 dark:text-red-400',
      bgClass: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
    };
  }
  
  if (acaoLower.startsWith('@produto:')) {
    const valor = acao.replace(/^@produto:/i, '');
    return {
      icon: Package,
      label: `Atribuir Produto: ${valor}`,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
    };
  }
  
  if (acaoLower === '@finalizar') {
    return {
      icon: StopCircle,
      label: 'Interromper Agente',
      colorClass: 'text-gray-700 dark:text-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
    };
  }
  
  return {
    icon: Tag,
    label: acao,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted border-border',
  };
}

// Regex para encontrar ações no texto
const ACTION_REGEX = /@(nome|tag|etapa|transferir|fonte|notificar|produto|finalizar|negociacao)(:[^\s@<>.,;!?]+)?/gi;

// Componente ActionChip inline
function ActionChip({ action, onRemove }: { action: string; onRemove?: () => void }) {
  const config = parseAcao(action);
  const Icon = config.icon;
  
  return (
    <span 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${config.bgClass} ${config.colorClass}`}
      style={{ verticalAlign: 'middle' }}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate max-w-[150px]">{config.label}</span>
      {onRemove && (
        <button 
          type="button" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 hover:opacity-70 text-current"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// Renderizar texto com chips inline
function renderTextWithChips(
  text: string, 
  onRemoveAction: (startIndex: number, endIndex: number) => void
): React.ReactNode[] {
  if (!text) return [];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Resetar regex
  ACTION_REGEX.lastIndex = 0;
  
  let match;
  while ((match = ACTION_REGEX.exec(text)) !== null) {
    // Texto antes da ação
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
    }
    
    // Ação como chip
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    parts.push(
      <ActionChip 
        key={`action-${match.index}`}
        action={match[0]} 
        onRemove={() => onRemoveAction(matchStart, matchEnd)}
      />
    );
    
    lastIndex = matchEnd;
  }
  
  // Texto restante
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  
  return parts;
}

export function DescricaoEditor({ value, onChange, placeholder, onAcaoClick }: DescricaoEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sincronizar scroll entre textarea e overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Auto-resize do textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(160, textareaRef.current.scrollHeight) + 'px';
    }
  }, [value]);

  // Handler para tecla @
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@' && onAcaoClick) {
      e.preventDefault();
      const pos = textareaRef.current?.selectionStart ?? value.length;
      onAcaoClick(pos);
    }
  }, [onAcaoClick, value.length]);

  // Remover ação por posição no texto
  const handleRemoveAction = useCallback((startIndex: number, endIndex: number) => {
    const before = value.slice(0, startIndex);
    const after = value.slice(endIndex);
    
    // Limpar espaço extra antes se existir
    const cleanBefore = before.endsWith(' ') ? before.slice(0, -1) : before;
    // Limpar espaço extra depois se existir
    const cleanAfter = after.startsWith(' ') ? after.slice(1) : after;
    
    const newValue = cleanBefore + (cleanBefore.length > 0 && cleanAfter.length > 0 ? ' ' : '') + cleanAfter;
    onChange(newValue.trim());
  }, [value, onChange]);

  // Verificar se há ações no texto
  ACTION_REGEX.lastIndex = 0;
  const hasActions = ACTION_REGEX.test(value);

  // Estilos compartilhados entre textarea e overlay
  const sharedStyles: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    lineHeight: '1.75rem',
    padding: '1rem',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full"
    >
      {/* Overlay com chips visuais - fica por cima, mas não captura eventos */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 rounded-xl pointer-events-none overflow-hidden ${
          hasActions ? 'block' : 'hidden'
        }`}
        style={{
          ...sharedStyles,
          color: 'transparent',
          background: 'transparent',
        }}
        aria-hidden="true"
      >
        <div className="pointer-events-auto">
          {renderTextWithChips(value, handleRemoveAction)}
        </div>
      </div>

      {/* Textarea real - transparente quando há ações, visível quando não há */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full min-h-[160px] rounded-xl bg-input border text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-lg transition-all duration-200 resize-none ${
          isFocused ? 'border-primary' : 'border-border'
        } ${hasActions ? 'text-transparent caret-foreground' : 'text-foreground'}`}
        style={{
          ...sharedStyles,
          WebkitTextFillColor: hasActions ? 'transparent' : undefined,
          caretColor: 'hsl(var(--foreground))',
        }}
      />

      {/* Placeholder personalizado quando não há foco e está vazio */}
      {!value && !isFocused && placeholder && (
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none text-muted-foreground text-sm"
          style={sharedStyles}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}

// Função auxiliar para obter posição do cursor de um textarea específico
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
