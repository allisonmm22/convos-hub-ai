import { Tag, Bot, UserRound, Globe, Layers, Bell, Package, StopCircle, X } from 'lucide-react';

interface DecisaoChipProps {
  acao: string;
  onRemove: () => void;
}

interface ChipConfig {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  bgClass: string;
}

// Mapear ação para configuração visual
function parseAcao(acao: string): ChipConfig {
  const acaoLower = acao.toLowerCase();
  
  if (acaoLower.startsWith('@tag:')) {
    const valor = acao.replace(/^@tag:/i, '');
    return {
      icon: Tag,
      label: `Tag: ${valor}`,
      colorClass: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    };
  }
  
  if (acaoLower.startsWith('@etapa:')) {
    const valor = acao.replace(/^@etapa:/i, '');
    return {
      icon: Layers,
      label: `Estágio: ${valor}`,
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    };
  }
  
  if (acaoLower.startsWith('@transferir:humano') || acaoLower.startsWith('@transferir:usuario:')) {
    const valor = acaoLower === '@transferir:humano' 
      ? 'Atendente' 
      : acao.replace(/^@transferir:usuario:/i, '');
    return {
      icon: UserRound,
      label: `Transferir: ${valor}`,
      colorClass: 'text-green-600 dark:text-green-400',
      bgClass: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    };
  }
  
  if (acaoLower.startsWith('@transferir:ia') || acaoLower.startsWith('@transferir:agente:')) {
    const valor = acaoLower === '@transferir:ia' 
      ? 'IA Principal' 
      : acao.replace(/^@transferir:agente:/i, '');
    return {
      icon: Bot,
      label: `Agente: ${valor}`,
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    };
  }
  
  if (acaoLower.startsWith('@fonte:')) {
    const valor = acao.replace(/^@fonte:/i, '');
    return {
      icon: Globe,
      label: `Fonte: ${valor}`,
      colorClass: 'text-teal-600 dark:text-teal-400',
      bgClass: 'bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',
    };
  }
  
  if (acaoLower.startsWith('@notificar:')) {
    const valor = acao.replace(/^@notificar:/i, '');
    const valorTruncado = valor.length > 20 ? valor.substring(0, 20) + '...' : valor;
    return {
      icon: Bell,
      label: `Notificar: ${valorTruncado}`,
      colorClass: 'text-red-600 dark:text-red-400',
      bgClass: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    };
  }
  
  if (acaoLower.startsWith('@produto:')) {
    const valor = acao.replace(/^@produto:/i, '');
    return {
      icon: Package,
      label: `Produto: ${valor}`,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    };
  }
  
  if (acaoLower === '@finalizar') {
    return {
      icon: StopCircle,
      label: 'Interromper Agente',
      colorClass: 'text-gray-600 dark:text-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
    };
  }
  
  // Fallback para ações desconhecidas
  return {
    icon: Tag,
    label: acao,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted border-border',
  };
}

export function DecisaoChip({ acao, onRemove }: DecisaoChipProps) {
  const config = parseAcao(acao);
  const Icon = config.icon;
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${config.bgClass} ${config.colorClass} transition-all hover:shadow-sm group`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate max-w-[200px]">{config.label}</span>
      <button
        onClick={onRemove}
        className="flex items-center justify-center h-4 w-4 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
        title="Remover decisão"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// Utilitário para extrair decisões do texto
export function extrairDecisoes(texto: string): { decisoes: string[]; textoLimpo: string } {
  const regex = /@(tag|etapa|transferir|fonte|notificar|produto|finalizar)(:[^\s@]+)?/gi;
  const decisoes: string[] = [];
  let match;
  
  while ((match = regex.exec(texto)) !== null) {
    decisoes.push(match[0]);
  }
  
  const textoLimpo = texto.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
  
  return { decisoes, textoLimpo };
}

// Utilitário para combinar decisões com texto
export function combinarDecisoesComTexto(decisoes: string[], texto: string): string {
  if (decisoes.length === 0) return texto;
  return decisoes.join(' ') + (texto ? '\n\n' + texto : '');
}
