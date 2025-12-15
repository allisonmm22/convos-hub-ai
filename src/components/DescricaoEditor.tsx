import { useRef, useCallback } from 'react';
import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, UserPen, Handshake } from 'lucide-react';

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

// Regex para encontrar ações no texto (exclui pontuação final)
const ACTION_REGEX = /@(nome|tag|etapa|transferir|fonte|notificar|produto|finalizar|negociacao)(:[^\s@<>.,;!?]+)?/gi;

// Componente ActionChip para renderização visual
function ActionChip({ action, onRemove }: { action: string; onRemove?: () => void }) {
  const config = parseAcao(action);
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded border text-xs font-medium ${config.bgClass} ${config.colorClass}`}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {onRemove && (
        <button 
          type="button" 
          onClick={onRemove}
          className="ml-1 hover:opacity-70 text-current"
        >
          ×
        </button>
      )}
    </span>
  );
}

// Componente de Preview de Chips (renderiza texto com chips visuais)
function ChipsPreview({ text, onRemoveAction }: { text: string; onRemoveAction: (action: string, index: number) => void }) {
  if (!text) return null;
  
  const parts: { type: 'text' | 'action'; content: string; index: number }[] = [];
  let lastIndex = 0;
  let actionIndex = 0;
  
  // Resetar regex
  ACTION_REGEX.lastIndex = 0;
  
  let match;
  while ((match = ACTION_REGEX.exec(text)) !== null) {
    // Adicionar texto antes da ação
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index), index: -1 });
    }
    // Adicionar ação
    parts.push({ type: 'action', content: match[0], index: actionIndex++ });
    lastIndex = match.index + match[0].length;
  }
  
  // Adicionar texto restante
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex), index: -1 });
  }
  
  if (parts.length === 0) return null;
  
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-sm leading-7">
      <div className="text-xs text-muted-foreground mb-2 font-medium">Preview das ações:</div>
      <div className="whitespace-pre-wrap">
        {parts.map((part, i) => (
          part.type === 'action' ? (
            <ActionChip 
              key={i} 
              action={part.content} 
              onRemove={() => onRemoveAction(part.content, part.index)}
            />
          ) : (
            <span key={i}>{part.content}</span>
          )
        ))}
      </div>
    </div>
  );
}

export function DescricaoEditor({ value, onChange, placeholder, onAcaoClick }: DescricaoEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handler para tecla @
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@' && onAcaoClick) {
      e.preventDefault();
      const pos = textareaRef.current?.selectionStart ?? value.length;
      onAcaoClick(pos);
    }
  }, [onAcaoClick, value.length]);

  // Obter posição do cursor (chamado pelo botão externo)
  const getCursorPosition = useCallback(() => {
    return textareaRef.current?.selectionStart ?? value.length;
  }, [value.length]);

  // Remover ação específica do texto
  const handleRemoveAction = useCallback((action: string, actionIndex: number) => {
    // Encontrar a n-ésima ocorrência da ação
    ACTION_REGEX.lastIndex = 0;
    let currentIndex = 0;
    let match;
    
    while ((match = ACTION_REGEX.exec(value)) !== null) {
      if (match[0] === action && currentIndex === actionIndex) {
        // Remover esta ocorrência
        const before = value.slice(0, match.index);
        const after = value.slice(match.index + match[0].length);
        // Limpar espaços extras
        const newValue = (before.trimEnd() + ' ' + after.trimStart()).trim();
        onChange(newValue);
        return;
      }
      currentIndex++;
    }
  }, [value, onChange]);

  // Verificar se há ações no texto
  ACTION_REGEX.lastIndex = 0;
  const hasActions = ACTION_REGEX.test(value);

  return (
    <div className="space-y-3">
      {/* Textarea de edição */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[160px] px-4 py-4 rounded-xl bg-input border border-border text-foreground text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-lg transition-all duration-200 resize-y"
        style={{ fontFamily: 'inherit' }}
      />

      {/* Preview com chips visuais */}
      {hasActions && (
        <ChipsPreview text={value} onRemoveAction={handleRemoveAction} />
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
