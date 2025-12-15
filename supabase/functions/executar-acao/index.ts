import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Acao {
  tipo: 'etapa' | 'tag' | 'transferir' | 'notificar' | 'finalizar' | 'nome' | 'negociacao' | 'agenda';
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
    case 'negociacao':
      return `💼 Nova negociação criada: ${valor || 'Lead'}`;
    case 'agenda':
      if (valor === 'consultar') {
        return `📅 Agenda consultada para verificar disponibilidade`;
      } else if (valor?.startsWith('criar:')) {
        return `📅 Evento criado na agenda: ${valor.replace('criar:', '')}`;
      }
      return `📅 Ação de agenda executada`;
    default:
      return `⚙️ Ação executada: ${tipo}`;
  }
}

// Função para mapear nome de etapa para UUID
// Suporta formato: "nome-estagio" ou "nome-funil/nome-estagio"
async function mapearEtapaPorNome(
  supabase: any,
  contaId: string,
  nomeEtapa: string
): Promise<string | null> {
  // Verificar se tem formato funil/etapa
  const partes = nomeEtapa.split('/');
  let nomeFunil: string | null = null;
  let nomeEtapaReal: string;
  
  if (partes.length === 2) {
    // Formato: funil/etapa
    nomeFunil = partes[0].toLowerCase().replace(/[.,;!?]+$/, '').replace(/-/g, ' ').trim();
    nomeEtapaReal = partes[1].toLowerCase().replace(/[.,;!?]+$/, '').replace(/-/g, ' ').trim();
    console.log(`Formato funil/etapa detectado: funil="${nomeFunil}", etapa="${nomeEtapaReal}"`);
  } else {
    // Formato antigo: apenas etapa
    nomeEtapaReal = nomeEtapa.toLowerCase().replace(/[.,;!?]+$/, '').replace(/-/g, ' ').trim();
    console.log(`Formato simples: etapa="${nomeEtapaReal}"`);
  }
  
  console.log(`Buscando etapa para conta ${contaId}`);

  // Buscar todos os funis da conta (com nome para filtrar se necessário)
  const { data: funis, error: funisError } = await supabase
    .from('funis')
    .select('id, nome')
    .eq('conta_id', contaId);

  if (funisError || !funis?.length) {
    console.log('Nenhum funil encontrado para a conta');
    return null;
  }

  console.log(`Funis encontrados: ${funis.map((f: any) => f.nome).join(', ')}`);

  // Se especificou funil, filtrar apenas IDs desse funil
  let funilIds = funis.map((f: any) => f.id);
  
  if (nomeFunil) {
    const funilEncontrado = funis.find((f: any) => {
      const nomeNormalizado = f.nome.toLowerCase().replace(/-/g, ' ').trim();
      return nomeNormalizado === nomeFunil || 
             nomeNormalizado.includes(nomeFunil) ||
             nomeFunil.includes(nomeNormalizado);
    });
    
    if (funilEncontrado) {
      funilIds = [funilEncontrado.id];
      console.log(`Funil filtrado: ${funilEncontrado.nome} (${funilEncontrado.id})`);
    } else {
      console.log(`Funil "${nomeFunil}" não encontrado, buscando em todos os funis`);
    }
  }

  // Buscar estágios dos funis filtrados
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
  const estagioExato = estagios.find((e: any) => {
    const nomeNormalizado = e.nome.toLowerCase().replace(/-/g, ' ').trim();
    return nomeNormalizado === nomeEtapaReal;
  });

  if (estagioExato) {
    console.log(`Etapa encontrada: ${estagioExato.nome} (${estagioExato.id})`);
    return estagioExato.id;
  }

  // Procurar correspondência parcial
  const estagioParcial = estagios.find((e: any) => {
    const nomeNormalizado = e.nome.toLowerCase().replace(/-/g, ' ').trim();
    return nomeNormalizado.includes(nomeEtapaReal) ||
           nomeEtapaReal.includes(nomeNormalizado);
  });

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
    let resultado: { sucesso: boolean; mensagem: string; dados?: any } = { sucesso: false, mensagem: '' };

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
            
            // Disparar resposta automática do novo agente
            console.log('Disparando resposta do novo agente:', agenteId);
            
            // Buscar última mensagem do lead para contexto
            const { data: ultimaMensagemLead } = await supabase
              .from('mensagens')
              .select('conteudo')
              .eq('conversa_id', conversa_id)
              .eq('direcao', 'entrada')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            // Chamar ai-responder para gerar resposta do novo agente
            const aiResponderUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-responder`;
            try {
              const aiResponse = await fetch(aiResponderUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  conversa_id,
                  mensagem: ultimaMensagemLead?.conteudo || 'Olá',
                  conta_id,
                }),
              });
              
              const aiResult = await aiResponse.json();
              console.log('Resposta do novo agente gerada:', aiResult);
              
              if (aiResult.resposta && aiResult.should_respond) {
                // Buscar conexão e contato para enviar via WhatsApp
                const { data: conversaData } = await supabase
                  .from('conversas')
                  .select('conexao_id, contato_id')
                  .eq('id', conversa_id)
                  .single();
                
                const { data: contato } = await supabase
                  .from('contatos')
                  .select('telefone')
                  .eq('id', conversaData?.contato_id)
                  .single();
                
                const { data: conexao } = await supabase
                  .from('conexoes_whatsapp')
                  .select('instance_name, token')
                  .eq('id', conversaData?.conexao_id)
                  .single();
                
                if (conexao && contato) {
                  // Salvar mensagem no banco
                  await supabase
                    .from('mensagens')
                    .insert({
                      conversa_id,
                      conteudo: aiResult.resposta,
                      direcao: 'saida',
                      tipo: 'texto',
                      enviada_por_ia: true,
                    });
                  
                  // Atualizar última mensagem da conversa
                  await supabase
                    .from('conversas')
                    .update({ 
                      ultima_mensagem: aiResult.resposta.substring(0, 100),
                      ultima_mensagem_at: new Date().toISOString(),
                    })
                    .eq('id', conversa_id);
                  
                  // Enviar via Evolution API
                  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://api.evolution.mendsolutions.com.br';
                  await fetch(`${evolutionUrl}/message/sendText/${conexao.instance_name}`, {
                    method: 'POST',
                    headers: {
                      'apikey': conexao.token,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      number: contato.telefone.replace(/\D/g, ''),
                      text: aiResult.resposta,
                    }),
                  });
                  
                  console.log('Resposta do novo agente enviada via WhatsApp');
                }
              }
            } catch (aiError) {
              console.error('Erro ao gerar resposta do novo agente:', aiError);
            }
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

      case 'negociacao': {
        // Criar nova negociação no CRM
        // Formato: "funil/estagio" ou "funil/estagio:valor"
        const valorCompleto = acaoObj.valor || '';
        const [estagioRef, valorStr] = valorCompleto.split(':').length > 1 && !valorCompleto.includes('/') 
          ? [valorCompleto, undefined]
          : valorCompleto.includes(':') 
            ? [valorCompleto.substring(0, valorCompleto.lastIndexOf(':')), valorCompleto.substring(valorCompleto.lastIndexOf(':') + 1)]
            : [valorCompleto, undefined];
        
        const valorNumerico = valorStr ? parseFloat(valorStr) : 0;
        
        console.log(`Criando negociação: estagioRef="${estagioRef}", valor=${valorNumerico}`);
        
        // Buscar configuração da conta para verificar se permite múltiplas negociações
        const { data: contaConfig } = await supabase
          .from('contas')
          .select('permitir_multiplas_negociacoes')
          .eq('id', conta_id)
          .maybeSingle();
        
        const permitirMultiplas = contaConfig?.permitir_multiplas_negociacoes ?? true;
        
        console.log(`Permitir múltiplas negociações: ${permitirMultiplas}`);
        
        // Se não permite múltiplas, verificar qualquer negociação aberta (em qualquer estágio)
        if (!permitirMultiplas) {
          const { data: negociacaoAberta } = await supabase
            .from('negociacoes')
            .select('id, titulo')
            .eq('contato_id', contato_id)
            .eq('status', 'aberto')
            .maybeSingle();
          
          if (negociacaoAberta) {
            console.log(`Bloqueando criação: lead já possui negociação "${negociacaoAberta.titulo}"`);
            resultado = { 
              sucesso: false, 
              mensagem: `Este lead já possui uma negociação aberta: "${negociacaoAberta.titulo}"` 
            };
            break;
          }
        }
        
        // Mapear estágio
        const estagioId = await mapearEtapaPorNome(supabase, conta_id, estagioRef);
        
        if (!estagioId) {
          resultado = { sucesso: false, mensagem: `Estágio "${estagioRef}" não encontrado no CRM` };
          break;
        }
        
        // Buscar dados do contato
        const { data: contato } = await supabase
          .from('contatos')
          .select('nome, telefone, email')
          .eq('id', contato_id)
          .single();
        
        // Verificar se já existe negociação aberta para este contato no mesmo estágio
        const { data: negociacaoExistente } = await supabase
          .from('negociacoes')
          .select('id')
          .eq('contato_id', contato_id)
          .eq('estagio_id', estagioId)
          .eq('status', 'aberto')
          .maybeSingle();
        
        if (negociacaoExistente) {
          resultado = { sucesso: true, mensagem: 'Já existe uma negociação aberta para este contato neste estágio' };
          break;
        }
        
        // Criar negociação
        const { error } = await supabase
          .from('negociacoes')
          .insert({
            conta_id,
            contato_id,
            estagio_id: estagioId,
            titulo: `Negociação - ${contato?.nome || 'Lead'}`,
            valor: valorNumerico,
            status: 'aberto',
            probabilidade: 50,
          });

        if (error) throw error;
        resultado = { sucesso: true, mensagem: `Nova negociação criada: ${contato?.nome || 'Lead'}` };
        break;
      }

      case 'agenda': {
        // Ações do Google Calendar
        const subacao = acaoObj.valor || '';
        console.log('Executando ação de agenda:', subacao);
        
        // Buscar calendário ativo da conta com configurações padrão
        const { data: calendario } = await supabase
          .from('calendarios_google')
          .select('id, nome')
          .eq('conta_id', conta_id)
          .eq('ativo', true)
          .limit(1)
          .single();
        
        if (!calendario) {
          resultado = { sucesso: false, mensagem: 'Nenhum calendário Google conectado. Configure em Integrações.' };
          break;
        }
        
        if (subacao === 'consultar' || subacao.startsWith('consultar:')) {
          // Consultar disponibilidade
          const dataInicio = new Date().toISOString();
          const dataFim = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          const calendarResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-actions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operacao: 'consultar',
              calendario_id: calendario.id,
              dados: { data_inicio: dataInicio, data_fim: dataFim },
            }),
          });
          
          const calendarResult = await calendarResponse.json();
          
          if (calendarResult.error) {
            resultado = { sucesso: false, mensagem: calendarResult.error };
          } else {
            resultado = { 
              sucesso: true, 
              mensagem: `Disponibilidade consultada: ${calendarResult.total || 0} eventos encontrados`,
            };
          }
        } else if (subacao.startsWith('criar:')) {
          // Criar evento
          // Formatos suportados:
          // 1. criar:calendario:duracao:meet|titulo|data_inicio (do modal)
          // 2. criar:titulo|data_inicio (formato simples da IA)
          // 3. criar:calendario:duracao:meet (sem detalhes - usar defaults)
          const dadosEvento = subacao.replace('criar:', '');
          const partes = dadosEvento.split('|');
          
          let titulo: string = '';
          let dataInicio: string = '';
          let duracaoMinutos = 60; // default 1 hora
          let gerarMeet = true; // default gerar meet
          
          const primeiroElemento = partes[0];
          const configParts = primeiroElemento.split(':');
          
          console.log('Parsing criar evento:', { dadosEvento, partes, configParts });
          
          // Detectar o formato baseado na estrutura
          if (configParts.length >= 3 && (configParts[2] === 'meet' || configParts[2] === 'no-meet')) {
            // Novo formato do modal: calendario:duracao:meet|titulo|data_inicio
            duracaoMinutos = parseInt(configParts[1]) || 60;
            gerarMeet = configParts[2] === 'meet';
            titulo = partes[1] || '';
            dataInicio = partes[2] || '';
            console.log('Formato modal detectado:', { duracaoMinutos, gerarMeet, titulo, dataInicio });
          } else if (configParts.length === 2 && !isNaN(parseInt(configParts[1]))) {
            // Formato parcial: calendario:duracao|titulo|data_inicio
            duracaoMinutos = parseInt(configParts[1]) || 60;
            titulo = partes[1] || '';
            dataInicio = partes[2] || '';
            console.log('Formato parcial detectado:', { duracaoMinutos, titulo, dataInicio });
          } else {
            // Formato simples da IA: titulo|data_inicio ou apenas titulo
            titulo = partes[0] || '';
            dataInicio = partes[1] || '';
            console.log('Formato simples detectado:', { titulo, dataInicio });
          }
          
          // Buscar nome do contato para incluir no evento
          const { data: contatoData } = await supabase
            .from('contatos')
            .select('nome, telefone')
            .eq('id', contato_id)
            .single();
          
          // Se não tem data de início, usar próximo horário comercial disponível
          if (!dataInicio) {
            const agora = new Date();
            agora.setHours(agora.getHours() + 1, 0, 0, 0);
            dataInicio = agora.toISOString();
          }
          
          const tituloFinal = titulo || `Reunião com ${contatoData?.nome || 'Lead'}`;
          
          console.log('Criando evento com:', { 
            titulo: tituloFinal, 
            dataInicio, 
            duracaoMinutos, 
            gerarMeet 
          });
          
          const calendarResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-actions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operacao: 'criar',
              calendario_id: calendario.id,
              dados: {
                titulo: tituloFinal,
                descricao: `Agendamento realizado via WhatsApp\nContato: ${contatoData?.nome || 'Lead'}\nTelefone: ${contatoData?.telefone || 'N/A'}`,
                data_inicio: dataInicio,
                duracao_minutos: duracaoMinutos,
                gerar_meet: gerarMeet,
              },
            }),
          });
          
          const calendarResult = await calendarResponse.json();
          console.log('Resultado do Google Calendar:', calendarResult);
          
          if (calendarResult.error) {
            resultado = { sucesso: false, mensagem: calendarResult.error };
          } else {
            // Calcular data_fim baseado na duração
            const dataInicioDate = new Date(dataInicio);
            const dataFimDate = new Date(dataInicioDate.getTime() + duracaoMinutos * 60 * 1000);
            
            // Criar agendamento interno no CRM
            const { error: agendamentoError } = await supabase
              .from('agendamentos')
              .insert({
                conta_id,
                contato_id,
                titulo: tituloFinal,
                descricao: `Agendamento via WhatsApp${calendarResult.meet_link ? '\nLink Meet: ' + calendarResult.meet_link : ''}`,
                data_inicio: dataInicio,
                data_fim: dataFimDate.toISOString(),
                google_event_id: calendarResult.id || null,
                google_meet_link: calendarResult.meet_link || null,
                concluido: false,
              });
            
            if (agendamentoError) {
              console.error('Erro ao criar agendamento interno:', agendamentoError);
            } else {
              console.log('Agendamento interno criado com sucesso');
            }
            
            let mensagemSucesso = `Evento criado: ${tituloFinal} (${duracaoMinutos}min)`;
            if (calendarResult.meet_link) {
              mensagemSucesso += ` | Link Meet: ${calendarResult.meet_link}`;
            }
            resultado = { 
              sucesso: true, 
              mensagem: mensagemSucesso,
              dados: {
                evento_id: calendarResult.id,
                meet_link: calendarResult.meet_link,
                titulo: tituloFinal,
                data_inicio: dataInicio,
                duracao: duracaoMinutos,
              }
            };
          }
        } else {
          resultado = { sucesso: false, mensagem: 'Subação de agenda não reconhecida' };
        }
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
