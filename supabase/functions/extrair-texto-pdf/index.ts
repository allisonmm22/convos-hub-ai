import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEXT_LENGTH = 4000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64, mime_type } = await req.json();

    console.log('=== EXTRAIR TEXTO PDF ===');
    console.log('MIME type:', mime_type);

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'pdf_base64 obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remover prefixo data:application/pdf;base64, se existir
    let base64Data = pdf_base64;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    // Converter base64 para Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('PDF size:', bytes.length, 'bytes');

    // Carregar o documento PDF
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdfDocument = await loadingTask.promise;
    
    console.log('Número de páginas:', pdfDocument.numPages);

    // Extrair texto de todas as páginas
    let textoCompleto = '';
    
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      textoCompleto += pageText + '\n\n';
      
      // Parar se já tiver texto suficiente
      if (textoCompleto.length > MAX_TEXT_LENGTH) {
        break;
      }
    }

    // Limpar texto (remover múltiplos espaços/quebras de linha)
    let texto = textoCompleto
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    console.log('Texto extraído:', texto.length, 'caracteres');

    // Limitar o tamanho do texto
    if (texto.length > MAX_TEXT_LENGTH) {
      texto = texto.substring(0, MAX_TEXT_LENGTH) + '... [texto truncado]';
      console.log('Texto truncado para', MAX_TEXT_LENGTH, 'caracteres');
    }

    if (!texto || texto.length < 10) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Não foi possível extrair texto do PDF (pode ser um PDF de imagem/escaneado)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extração concluída com sucesso');
    console.log('Preview:', texto.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        texto,
        paginas: pdfDocument.numPages,
        caracteres: texto.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro ao extrair texto do PDF:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ sucesso: false, erro: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
