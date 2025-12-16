import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gerar mensagem de sistema para rastreamento
function gerarMensagemSistema(
  paraIA: boolean, 
  paraUsuarioNome: string | null,
  paraAgenteNome: string | null,
  deUsuarioNome: string | null
): string {
  if (paraIA && paraAgenteNome) {
    return `🤖 Conversa transferida para agente "${paraAgenteNome}"${deUsuarioNome ? ` por ${deUsuarioNome}` : ''}`;
  } else if (paraIA) {
    return `🤖 Conversa transferida para agente IA${deUsuarioNome ? ` por ${deUsuarioNome}` : ''}`;
  } else if (paraUsuarioNome) {
    return `👤 Conversa transferida para ${paraUsuarioNome}${deUsuarioNome ? ` por ${deUsuarioNome}` : ''}`;
  } else {
    return `↔️ Transferência realizada${deUsuarioNome ? ` por ${deUsuarioNome}` : ''}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      conversa_id, 
      de_usuario_id,
      para_usuario_id, 
      para_agente_ia_id,
      para_ia,
      conta_id,
      para_estagio_id 
    } = await req.json();

    console.log('=== TRANSFERIR ATENDIMENTO ===');
    console.log('Conversa ID:', conversa_id);
    console.log('De Usuario ID:', de_usuario_id);
    console.log('Para Usuario ID:', para_usuario_id);
    console.log('Para Agente IA ID:', para_agente_ia_id);
    console.log('Para IA:', para_ia);
    console.log('Para Estagio ID:', para_estagio_id);

    // Buscar nomes para mensagem de sistema
    let deUsuarioNome: string | null = null;
    let paraUsuarioNome: string | null = null;
    let paraAgenteNome: string | null = null;

    if (de_usuario_id) {
      const { data: deUsuario } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', de_usuario_id)
        .single();
      deUsuarioNome = deUsuario?.nome || null;
    }

    if (para_usuario_id) {
      const { data: paraUsuario } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', para_usuario_id)
        .single();
      paraUsuarioNome = paraUsuario?.nome || null;
    }

    if (para_agente_ia_id) {
      const { data: paraAgente } = await supabase
        .from('agent_ia')
        .select('nome')
        .eq('id', para_agente_ia_id)
        .single();
      paraAgenteNome = paraAgente?.nome || null;
    }

    // 1. Registrar transferência
    await supabase
      .from('transferencias_atendimento')
      .insert({
        conversa_id,
        de_usuario_id,
        para_usuario_id,
        para_agente_ia: para_ia || !!para_agente_ia_id,
        motivo: para_agente_ia_id 
          ? `Transferência manual para agente IA: ${paraAgenteNome}`
          : para_ia 
            ? 'Transferência manual para agente IA'
            : `Transferência manual para ${paraUsuarioNome || 'atendente'}`,
      });

    // 2. Atualizar conversa
    const updateData: any = {
      atendente_id: para_usuario_id,
      agente_ia_ativo: para_ia || !!para_agente_ia_id,
    };

    if (para_agente_ia_id) {
      updateData.agente_ia_id = para_agente_ia_id;
    }

    await supabase
      .from('conversas')
      .update(updateData)
      .eq('id', conversa_id);

    // 3. Registrar mensagem de sistema de transferência
    const mensagemSistema = gerarMensagemSistema(para_ia || !!para_agente_ia_id, paraUsuarioNome, paraAgenteNome, deUsuarioNome);
    
    await supabase
      .from('mensagens')
      .insert({
        conversa_id,
        conteudo: mensagemSistema,
        direcao: 'saida',
        tipo: 'sistema',
        enviada_por_ia: false,
        metadata: { 
          interno: true, 
          acao_tipo: 'transferir',
          de_usuario_id,
          para_usuario_id,
          para_agente_ia_id,
        }
      });

    console.log('Mensagem de sistema registrada:', mensagemSistema);

    // 4. Se para_estagio_id foi fornecido, mover/criar negociação
    if (para_estagio_id) {
      console.log('Movendo lead para estágio:', para_estagio_id);

      // Buscar contato_id da conversa
      const { data: conversaData } = await supabase
        .from('conversas')
        .select('contato_id')
        .eq('id', conversa_id)
        .single();

      if (conversaData?.contato_id) {
        // Buscar nome do estágio para a mensagem de sistema
        const { data: estagioData } = await supabase
          .from('estagios')
          .select('nome, funil_id, funis(nome)')
          .eq('id', para_estagio_id)
          .single();

        const estagioNome = estagioData?.nome || 'Novo estágio';
        const funilNome = (estagioData?.funis as any)?.nome || 'Funil';

        // Verificar se existe negociação aberta para o contato
        const { data: negociacaoExistente } = await supabase
          .from('negociacoes')
          .select('id, estagio_id, estagios(nome)')
          .eq('contato_id', conversaData.contato_id)
          .eq('status', 'aberto')
          .limit(1)
          .single();

        if (negociacaoExistente) {
          // Atualizar negociação existente
          const estagioAnteriorNome = (negociacaoExistente.estagios as any)?.nome || 'Sem estágio';

          await supabase
            .from('negociacoes')
            .update({ 
              estagio_id: para_estagio_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', negociacaoExistente.id);

          // Registrar no histórico
          await supabase
            .from('negociacao_historico')
            .insert({
              negociacao_id: negociacaoExistente.id,
              estagio_anterior_id: negociacaoExistente.estagio_id,
              estagio_novo_id: para_estagio_id,
              usuario_id: de_usuario_id,
              tipo: 'mudanca_estagio',
              descricao: `Lead movido de "${estagioAnteriorNome}" para "${estagioNome}" durante transferência`,
            });

          // Mensagem de sistema sobre movimentação
          await supabase
            .from('mensagens')
            .insert({
              conversa_id,
              conteudo: `📊 ${deUsuarioNome || 'Sistema'} moveu negociação de "${estagioAnteriorNome}" para "${estagioNome}"`,
              direcao: 'saida',
              tipo: 'sistema',
              enviada_por_ia: false,
              metadata: { 
                interno: true, 
                acao_tipo: 'mover_estagio',
                estagio_anterior: estagioAnteriorNome,
                estagio_novo: estagioNome,
              }
            });

          console.log(`Negociação ${negociacaoExistente.id} movida para estágio ${estagioNome}`);
        } else {
          // Criar nova negociação
          const { data: contato } = await supabase
            .from('contatos')
            .select('nome')
            .eq('id', conversaData.contato_id)
            .single();

          const { data: novaNegociacao } = await supabase
            .from('negociacoes')
            .insert({
              conta_id,
              contato_id: conversaData.contato_id,
              estagio_id: para_estagio_id,
              titulo: contato?.nome || 'Nova Negociação',
              status: 'aberto',
              probabilidade: 50,
              valor: 0,
            })
            .select('id')
            .single();

          if (novaNegociacao) {
            // Registrar no histórico
            await supabase
              .from('negociacao_historico')
              .insert({
                negociacao_id: novaNegociacao.id,
                estagio_novo_id: para_estagio_id,
                usuario_id: de_usuario_id,
                tipo: 'criacao',
                descricao: `Negociação criada no estágio "${estagioNome}" durante transferência`,
              });

            // Mensagem de sistema sobre criação
            await supabase
              .from('mensagens')
              .insert({
                conversa_id,
                conteudo: `📊 ${deUsuarioNome || 'Sistema'} criou negociação no funil "${funilNome}" - estágio "${estagioNome}"`,
                direcao: 'saida',
                tipo: 'sistema',
                enviada_por_ia: false,
                metadata: { 
                  interno: true, 
                  acao_tipo: 'criar_negociacao',
                  funil: funilNome,
                  estagio: estagioNome,
                }
              });

            console.log(`Nova negociação criada: ${novaNegociacao.id}`);
          }
        }
      }
    }

    // 5. Se transferiu para agente IA, disparar resposta automática
    if (para_ia || para_agente_ia_id) {
      console.log('Disparando resposta automática do agente IA...');

      // Buscar última mensagem do lead
      const { data: ultimaMensagemLead } = await supabase
        .from('mensagens')
        .select('conteudo')
        .eq('conversa_id', conversa_id)
        .eq('direcao', 'entrada')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      try {
        // Chamar ai-responder
        const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-responder`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversa_id,
            mensagem: ultimaMensagemLead?.conteudo || 'Olá',
            conta_id,
          }),
        });

        const aiResult = await aiResponse.json();
        console.log('Resposta do agente IA:', aiResult);

        if (aiResult.resposta && aiResult.should_respond) {
          // Buscar dados para envio via WhatsApp
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
            const evolutionUrl = 'https://evolution.cognityx.com.br';
            const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${conexao.instance_name}`, {
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

            console.log('Resposta enviada via WhatsApp:', sendResponse.ok);
          }
        }
      } catch (aiError) {
        console.error('Erro ao gerar resposta do agente IA:', aiError);
      }
    }

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        mensagem: para_ia || para_agente_ia_id 
          ? 'Transferido para Agente IA' 
          : 'Atendimento transferido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao transferir atendimento:', errorMessage);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
