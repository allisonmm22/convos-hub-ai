import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Acao {
  tipo: 'etapa' | 'tag' | 'transferir' | 'notificar' | 'finalizar' | 'nome';
  valor?: string;
}

// Gerar mensagem de sistema para rastreamento interno
function gerarMensagemSistema(tipo: string, valor: string | undefined, resultado: string): string {
  switch (tipo) {
    case 'etapa':
      return `📊 Lead movido para etapa "${valor}"`;
    case 'tag':
      return `🏷️ Tag "${valor}" adicionada ao contato`;
    case 'transferir':
      if (valor === 'humano' || valor === 'usuario') {
        return `👤 Conversa transferida para atendente humano`;
      } else if (valor === 'ia') {
        return `🤖 Conversa retornada para agente IA principal`;
      } else if (valor?.startsWith('agente:')) {
        const agenteName = valor.replace('agente:', '').replace(/-/g, ' ').trim();
        return `🤖 Conversa transferida para agente "${agenteName}"`;
      }
      return `↔️ Transferência realizada`;
    case 'notificar':
      return `🔔 Notificação: ${valor || 'Nova ação'}`;
    case 'finalizar':
      return `🔒 Conversa encerrada pelo agente IA`;
    case 'nome':
      return `✏️ Nome do contato alterado para "${valor}"`;
    default:
      return `⚙️ Ação executada: ${tipo}`;
  }
}

// Função para mapear nome de etapa para UUID
async function mapearEtapaPorNome(
  supabase: any,
  contaId: string,
  nomeEtapa: string
): Promise<string | null> {
  // Normalizar o nome (minúsculo, sem pontuação final)
  const nomeNormalizado = nomeEtapa.toLowerCase().replace(/[.,;!?]+$/, '').trim();
  
  console.log(`Buscando etapa "${nomeNormalizado}" para conta ${contaId}`);

  // Buscar todos os funis da conta
  const { data: funis, error: funisError } = await supabase
    .from('funis')
    .select('id')
    .eq('conta_id', contaId);

  if (funisError || !funis?.length) {
    console.log('Nenhum funil encontrado para a conta');
    return null;
  }

  const funilIds = funis.map((f: any) => f.id);
  console.log(`Funis encontrados: ${funilIds.length}`);

  // Buscar todos os estágios desses funis
  const { data: estagios, error: estagiosError } = await supabase
    .from('estagios')
    .select('id, nome, funil_id')
    .in('funil_id', funilIds);

  if (estagiosError || !estagios?.length) {
    console.log('Nenhum estágio encontrado');
    return null;
  }

  console.log(`Estágios disponíveis: ${estagios.map((e: any) => e.nome).join(', ')}`);

  // Procurar correspondência exata (case-insensitive)
  const estagioExato = estagios.find((e: any) =>
    e.nome.toLowerCase().trim() === nomeNormalizado
  );

  if (estagioExato) {
    console.log(`Etapa encontrada: ${estagioExato.nome} (${estagioExato.id})`);
    return estagioExato.id;
  }

  // Procurar correspondência parcial
  const estagioParcial = estagios.find((e: any) =>
    e.nome.toLowerCase().includes(nomeNormalizado) ||
    nomeNormalizado.includes(e.nome.toLowerCase())
  );

  if (estagioParcial) {
    console.log(`Etapa encontrada (parcial): ${estagioParcial.nome} (${estagioParcial.id})`);
    return estagioParcial.id;
  }

  console.log(`Etapa "${nomeEtapa}" não encontrada`);
  return null;
}

// Verificar se é um UUID válido
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { acao, conversa_id, contato_id, conta_id } = await req.json();

    console.log('=== EXECUTAR AÇÃO ===');
    console.log('Ação:', acao);
    console.log('Conversa ID:', conversa_id);
    console.log('Contato ID:', contato_id);
    console.log('Conta ID:', conta_id);

    const acaoObj = acao as Acao;
    let resultado = { sucesso: false, mensagem: '' };

    switch (acaoObj.tipo) {
      case 'etapa': {
        // Mover contato para etapa do CRM
        let estagioId = acaoObj.valor;
        
        if (!estagioId) {
          resultado = { sucesso: false, mensagem: 'ID do estágio não fornecido' };
          break;
        }

        // Se não é um UUID válido, tentar mapear pelo nome
        if (!isValidUUID(estagioId)) {
          console.log(`Valor "${estagioId}" não é UUID, tentando mapear por nome...`);
          const estagioIdMapeado = await mapearEtapaPorNome(supabase, conta_id, estagioId);
          
          if (!estagioIdMapeado) {
            resultado = { sucesso: false, mensagem: `Etapa "${estagioId}" não encontrada no CRM` };
            break;
          }
          
          estagioId = estagioIdMapeado;
        }

        console.log(`Usando estágio ID: ${estagioId}`);

        // Verificar se já existe uma negociação para este contato
        const { data: negociacaoExistente } = await supabase
          .from('negociacoes')
          .select('id')
          .eq('contato_id', contato_id)
          .eq('status', 'aberto')
          .maybeSingle();

        if (negociacaoExistente) {
          // Atualizar negociação existente
          const { error } = await supabase
            .from('negociacoes')
            .update({ estagio_id: estagioId })
            .eq('id', negociacaoExistente.id);

          if (error) throw error;
          resultado = { sucesso: true, mensagem: 'Lead movido para nova etapa do CRM' };
        } else {
          // Criar nova negociação
          const { data: contato } = await supabase
            .from('contatos')
            .select('nome')
            .eq('id', contato_id)
            .single();

          const { error } = await supabase
            .from('negociacoes')
            .insert({
              conta_id,
              contato_id,
              estagio_id: estagioId,
              titulo: `Negociação - ${contato?.nome || 'Novo Lead'}`,
              status: 'aberto',
            });

          if (error) throw error;
          resultado = { sucesso: true, mensagem: 'Nova negociação criada no CRM' };
        }
        break;
      }

      case 'tag': {
        // Adicionar tag ao contato
        const tag = acaoObj.valor;
        
        if (!tag) {
          resultado = { sucesso: false, mensagem: 'Tag não fornecida' };
          break;
        }

        // Buscar tags atuais
        const { data: contato } = await supabase
          .from('contatos')
          .select('tags')
          .eq('id', contato_id)
          .single();

        const tagsAtuais = contato?.tags || [];
        
        if (!tagsAtuais.includes(tag)) {
          const { error } = await supabase
            .from('contatos')
            .update({ tags: [...tagsAtuais, tag] })
            .eq('id', contato_id);

          if (error) throw error;
          resultado = { sucesso: true, mensagem: `Tag "${tag}" adicionada ao contato` };
        } else {
          resultado = { sucesso: true, mensagem: 'Tag já existe no contato' };
        }
        break;
      }

      case 'transferir': {
        const para = acaoObj.valor;
        
        if (para === 'humano' || para === 'usuario') {
          // Desativar agente IA na conversa
          const { error } = await supabase
            .from('conversas')
            .update({ agente_ia_ativo: false, agente_ia_id: null })
            .eq('id', conversa_id);

          if (error) throw error;

          // Registrar transferência
          await supabase
            .from('transferencias_atendimento')
            .insert({
              conversa_id,
              para_agente_ia: false,
              motivo: 'Transferência automática por ação do agente IA',
            });

          resultado = { sucesso: true, mensagem: 'Conversa transferida para atendente humano' };
        } else if (para === 'ia') {
          // Ativar agente IA principal na conversa
          const { error } = await supabase
            .from('conversas')
            .update({ agente_ia_ativo: true, agente_ia_id: null })
            .eq('id', conversa_id);

          if (error) throw error;

          // Registrar transferência
          await supabase
            .from('transferencias_atendimento')
            .insert({
              conversa_id,
              para_agente_ia: true,
              motivo: 'Transferência automática de volta para agente IA principal',
            });

          resultado = { sucesso: true, mensagem: 'Conversa retornada para agente IA principal' };
        } else if (para?.startsWith('agente:')) {
          // Transferir para agente específico pelo nome ou ID
          const agenteRef = para.replace('agente:', '').replace(/-/g, ' ').trim();
          
          // Verificar se é UUID
          let agenteId: string | null = null;
          
          if (isValidUUID(agenteRef)) {
            agenteId = agenteRef;
          } else {
            // Buscar agente pelo nome
            const { data: agentes } = await supabase
              .from('agent_ia')
              .select('id, nome')
              .eq('conta_id', conta_id)
              .eq('ativo', true);
            
            const agenteEncontrado = agentes?.find((a: any) =>
              a.nome.toLowerCase().replace(/\s+/g, '-') === agenteRef.toLowerCase().replace(/\s+/g, '-') ||
              a.nome.toLowerCase() === agenteRef.toLowerCase()
            );
            
            if (agenteEncontrado) {
              agenteId = agenteEncontrado.id;
            }
          }

          if (agenteId) {
            const { error } = await supabase
              .from('conversas')
              .update({ agente_ia_ativo: true, agente_ia_id: agenteId })
              .eq('id', conversa_id);

            if (error) throw error;

            // Registrar transferência
            await supabase
              .from('transferencias_atendimento')
              .insert({
                conversa_id,
                para_agente_ia: true,
                motivo: `Transferência automática para outro agente IA: ${agenteRef}`,
              });

            resultado = { sucesso: true, mensagem: `Conversa transferida para agente IA: ${agenteRef}` };
          } else {
            resultado = { sucesso: false, mensagem: `Agente "${agenteRef}" não encontrado` };
          }
        }
        break;
      }

      case 'notificar': {
        // Por enquanto, apenas logar a notificação
        // Pode ser expandido para enviar email, webhook, etc.
        console.log('📢 Notificação:', acaoObj.valor || 'Nova ação do agente IA');
        resultado = { sucesso: true, mensagem: 'Notificação enviada' };
        break;
      }

      case 'finalizar': {
        // Encerrar a conversa
        const { error } = await supabase
          .from('conversas')
          .update({ 
            status: 'encerrado',
            agente_ia_ativo: false,
          })
          .eq('id', conversa_id);

        if (error) throw error;
        resultado = { sucesso: true, mensagem: 'Conversa encerrada' };
        break;
      }

      case 'nome': {
        // Alterar nome do contato
        const novoNome = acaoObj.valor?.trim();
        
        if (!novoNome) {
          resultado = { sucesso: false, mensagem: 'Nome não fornecido' };
          break;
        }

        const { error } = await supabase
          .from('contatos')
          .update({ nome: novoNome })
          .eq('id', contato_id);

        if (error) throw error;
        resultado = { sucesso: true, mensagem: `Nome do contato alterado para "${novoNome}"` };
        break;
      }

      default:
        resultado = { sucesso: false, mensagem: 'Tipo de ação não reconhecido' };
    }

    // Registrar mensagem de sistema para rastreamento interno
    if (resultado.sucesso) {
      const mensagemSistema = gerarMensagemSistema(acaoObj.tipo, acaoObj.valor, resultado.mensagem);
      
      await supabase
        .from('mensagens')
        .insert({
          conversa_id,
          conteudo: mensagemSistema,
          direcao: 'saida',
          tipo: 'sistema',
          enviada_por_ia: true,
          metadata: { 
            interno: true, 
            acao_tipo: acaoObj.tipo,
            acao_valor: acaoObj.valor || null
          }
        });
      
      console.log('Mensagem de sistema registrada:', mensagemSistema);
    }

    console.log('Resultado:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('=== ERRO AO EXECUTAR AÇÃO ===');
    console.error('Mensagem:', errorMessage);
    console.error('Stack:', errorStack);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
