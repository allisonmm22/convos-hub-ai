import { useRef, useEffect, useCallback } from 'react';
import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, X } from 'lucide-react';

interface DescricaoEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onDecisaoClick?: () => void;
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

// Regex para encontrar ações no texto
const ACTION_REGEX = /@(tag|etapa|transferir|fonte|notificar|produto|finalizar)(:[^\s@<>]+)?/gi;

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
    return `<span contenteditable="false" data-action="${match}" class="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded border text-xs font-medium align-middle ${config.bgClass} ${config.colorClass} select-none"><span class="chip-label">${config.label}</span><button type="button" class="chip-remove ml-1 hover:opacity-70" data-remove="${match}">×</button></span>`;
  });
  
  // Converter quebras de linha
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Converter HTML de volta para texto
function htmlToText(html: string): string {
  // Criar elemento temporário
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
  
  // Obter texto
  return temp.textContent || '';
}

export function DescricaoEditor({ value, onChange, placeholder, onDecisaoClick }: DescricaoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  // Atualizar conteúdo quando value mudar externamente
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const html = textToHtml(value);
      if (editorRef.current.innerHTML !== html) {
        // Salvar posição do cursor
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        
        editorRef.current.innerHTML = html;
        
        // Tentar restaurar cursor (aproximado)
        if (range && editorRef.current.contains(range.startContainer)) {
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }
  }, [value]);

  // Handler de input
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    
    isUpdatingRef.current = true;
    const text = htmlToText(editorRef.current.innerHTML);
    onChange(text);
    
    // Re-renderizar chips após um pequeno delay
    setTimeout(() => {
      if (editorRef.current) {
        const selection = window.getSelection();
        let cursorOffset = 0;
        
        // Tentar salvar posição do cursor
        if (selection?.rangeCount) {
          const range = selection.getRangeAt(0);
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(editorRef.current);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          cursorOffset = preCaretRange.toString().length;
        }
        
        const html = textToHtml(text);
        editorRef.current.innerHTML = html;
        
        // Restaurar cursor
        if (cursorOffset > 0) {
          try {
            const textNodes: Node[] = [];
            const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              textNodes.push(node);
            }
            
            let currentOffset = 0;
            for (const textNode of textNodes) {
              const nodeLength = textNode.textContent?.length || 0;
              if (currentOffset + nodeLength >= cursorOffset) {
                const range = document.createRange();
                range.setStart(textNode, Math.min(cursorOffset - currentOffset, nodeLength));
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);
                break;
              }
              currentOffset += nodeLength;
            }
          } catch (e) {
            // Ignorar erros de restauração de cursor
          }
        }
      }
      isUpdatingRef.current = false;
    }, 0);
  }, [onChange]);

  // Handler para remover chips
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('chip-remove') || target.closest('.chip-remove')) {
      e.preventDefault();
      e.stopPropagation();
      
      const button = target.classList.contains('chip-remove') ? target : target.closest('.chip-remove');
      const actionToRemove = button?.getAttribute('data-remove');
      
      if (actionToRemove && editorRef.current) {
        // Remover a primeira ocorrência da ação
        const newText = value.replace(actionToRemove, '').replace(/\s{2,}/g, ' ').trim();
        onChange(newText);
      }
    }
  }, [value, onChange]);

  // Handler para tecla @
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '@' && onDecisaoClick) {
      e.preventDefault();
      onDecisaoClick();
    }
  }, [onDecisaoClick]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="min-h-[120px] w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary overflow-auto empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />
    </div>
  );
}

// Inserir ação na posição do cursor
export function inserirAcaoNoEditor(
  editorRef: HTMLDivElement | null,
  currentValue: string,
  action: string,
  onChange: (value: string) => void
) {
  if (!editorRef) {
    onChange(currentValue + ' ' + action);
    return;
  }

  const selection = window.getSelection();
  let insertPosition = currentValue.length;
  
  if (selection?.rangeCount && editorRef.contains(selection.anchorNode)) {
    // Calcular posição no texto
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    insertPosition = preCaretRange.toString().length;
  }
  
  const newValue = 
    currentValue.substring(0, insertPosition) + 
    (insertPosition > 0 && currentValue[insertPosition - 1] !== ' ' ? ' ' : '') +
    action + 
    ' ' +
    currentValue.substring(insertPosition);
  
  onChange(newValue.replace(/\s{2,}/g, ' '));
}
