import { useRef, useEffect, useCallback, useState } from 'react';
import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, UserPen } from 'lucide-react';

interface DescricaoEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onDecisaoClick?: (cursorPosition: number) => void;
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
  
  if (acaoLower.startsWith('@tag:')) {
    const valor = acao.replace(/^@tag:/i, '');
    return {
      icon: Tag,
      label: `Adicionar Tag #1001 - ${valor.toUpperCase()}`,
      colorClass: 'text-blue-700 dark:text-blue-400',
      bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
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
const ACTION_REGEX = /@(nome|tag|etapa|transferir|fonte|notificar|produto|finalizar)(:[^\s@<>.,;!?]+)?/gi;

// Converter texto com ações para HTML com chips
function textToHtml(text: string): string {
  if (!text) return '';
  
  // Escapar HTML primeiro
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Substituir ações por chips
  html = html.replace(ACTION_REGEX, (match) => {
    const config = parseAcao(match);
    return `<span contenteditable="false" data-action="${match}" class="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded border text-xs font-medium align-middle ${config.bgClass} ${config.colorClass} select-none cursor-default"><span class="chip-label">${config.label}</span><button type="button" class="chip-remove ml-1 hover:opacity-70 text-current" data-remove="${match}">×</button></span>`;
  });
  
  // Converter quebras de linha
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Converter HTML de volta para texto
function htmlToText(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Substituir chips de volta para ações
  temp.querySelectorAll('[data-action]').forEach(chip => {
    const action = chip.getAttribute('data-action') || '';
    const textNode = document.createTextNode(action);
    chip.replaceWith(textNode);
  });
  
  // Converter <br> para quebras de linha
  temp.querySelectorAll('br').forEach(br => {
    br.replaceWith('\n');
  });
  
  // Converter divs para quebras de linha (Chrome behavior)
  temp.querySelectorAll('div').forEach(div => {
    if (div.textContent) {
      div.before('\n');
      div.replaceWith(...Array.from(div.childNodes));
    }
  });
  
  return temp.textContent || '';
}

export function DescricaoEditor({ value, onChange, placeholder, onDecisaoClick }: DescricaoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef(value);
  const isRenderingChipsRef = useRef(false);
  const lastCursorPositionRef = useRef<number>(0);

  // Obter e guardar posição do cursor atual
  const getCurrentCursorPosition = useCallback((): number => {
    if (!editorRef.current) return lastValueRef.current.length;
    
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    }
    return lastCursorPositionRef.current;
  }, []);

  // Renderizar chips no HTML
  const renderChips = useCallback(() => {
    if (!editorRef.current || isRenderingChipsRef.current) return;
    
    isRenderingChipsRef.current = true;
    
    // Salvar posição do cursor
    const selection = window.getSelection();
    let cursorOffset = 0;
    let hadSelection = false;
    
    if (selection?.rangeCount && editorRef.current.contains(selection.anchorNode)) {
      hadSelection = true;
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorOffset = preCaretRange.toString().length;
    }
    
    // Converter para HTML com chips
    const html = textToHtml(lastValueRef.current);
    editorRef.current.innerHTML = html;
    
    // Restaurar cursor se estava focado
    if (hadSelection && isFocused) {
      try {
        const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
        let currentOffset = 0;
        let node;
        
        while ((node = walker.nextNode())) {
          const nodeLength = node.textContent?.length || 0;
          if (currentOffset + nodeLength >= cursorOffset) {
            const range = document.createRange();
            range.setStart(node, Math.min(cursorOffset - currentOffset, nodeLength));
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
            break;
          }
          currentOffset += nodeLength;
        }
      } catch (e) {
        // Cursor no final como fallback
        editorRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    
    isRenderingChipsRef.current = false;
  }, [isFocused]);

  // Renderizar chips imediatamente (usado ao inserir via modal)
  const forceRenderChips = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    renderChips();
  }, [renderChips]);

  // Debounce para renderizar chips (digitação normal)
  const scheduleChipRender = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      renderChips();
    }, 400);
  }, [renderChips]);

  // Inicializar e atualizar quando value muda externamente
  useEffect(() => {
    if (lastValueRef.current !== value) {
      lastValueRef.current = value;
      // Sempre renderizar imediatamente quando valor muda externamente (ex: via modal)
      renderChips();
    }
  }, [value, renderChips]);

  // Renderizar inicial
  useEffect(() => {
    renderChips();
  }, []);

  // Handler de input - NÃO re-renderiza imediatamente
  const handleInput = useCallback(() => {
    if (!editorRef.current || isRenderingChipsRef.current) return;
    
    const text = htmlToText(editorRef.current.innerHTML);
    lastValueRef.current = text;
    onChange(text);
    
    // Agendar renderização de chips com debounce
    scheduleChipRender();
  }, [onChange, scheduleChipRender]);

  // Handler de foco
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handler de blur - renderiza chips imediatamente
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    renderChips();
  }, [renderChips]);

  // Handler para remover chips
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('chip-remove') || target.closest('.chip-remove')) {
      e.preventDefault();
      e.stopPropagation();
      
      const button = target.classList.contains('chip-remove') ? target : target.closest('.chip-remove');
      const actionToRemove = button?.getAttribute('data-remove');
      
      if (actionToRemove) {
        const newText = lastValueRef.current.replace(actionToRemove, '').replace(/\s{2,}/g, ' ').trim();
        lastValueRef.current = newText;
        onChange(newText);
        renderChips();
      }
    }
  }, [onChange, renderChips]);

  // Handler para tecla @
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@' && onDecisaoClick) {
      e.preventDefault();
      // Guardar posição ANTES de abrir o modal
      const cursorPos = getCurrentCursorPosition();
      lastCursorPositionRef.current = cursorPos;
      onDecisaoClick(cursorPos);
    }
  }, [onDecisaoClick, getCurrentCursorPosition]);

  // Atualizar posição do cursor a cada seleção
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current || !isFocused) return;
    lastCursorPositionRef.current = getCurrentCursorPosition();
  }, [getCurrentCursorPosition, isFocused]);

  // Listener para mudanças de seleção
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isEmpty = !value || value.trim() === '';

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`min-h-[120px] w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary overflow-auto ${isEmpty ? 'before:content-[attr(data-placeholder)] before:text-muted-foreground before:pointer-events-none' : ''}`}
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />
    </div>
  );
}

// Inserir ação na posição do cursor com callback para renderização imediata
export function inserirAcaoNoEditor(
  currentValue: string,
  action: string,
  onChange: (value: string) => void,
  savedCursorPosition?: number,
  onAfterInsert?: () => void
) {
  // Usar posição salva ou final do texto
  const insertPosition = savedCursorPosition ?? currentValue.length;
  
  const before = currentValue.substring(0, insertPosition);
  const after = currentValue.substring(insertPosition);
  const needsSpaceBefore = before.length > 0 && before[before.length - 1] !== ' ' && before[before.length - 1] !== '\n';
  const needsSpaceAfter = after.length > 0 && after[0] !== ' ' && after[0] !== '\n';
  
  const newValue = before + (needsSpaceBefore ? ' ' : '') + action + (needsSpaceAfter ? ' ' : '') + after;
  onChange(newValue);
  
  // Renderizar chips imediatamente após a inserção
  setTimeout(() => onAfterInsert?.(), 10);
}
