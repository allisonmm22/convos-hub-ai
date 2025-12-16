import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEXT_LENGTH = 4000;

// Função simples para extrair texto de PDF usando regex patterns
// PDFs têm texto entre parênteses em streams de texto
function extractTextFromPdfBuffer(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const pdfContent = decoder.decode(bytes);
  
  const textParts: string[] = [];
  
  // Padrão 1: Texto entre parênteses em operadores Tj e TJ
  const tjPattern = /\(([^)]*)\)\s*Tj/g;
  let match;
  while ((match = tjPattern.exec(pdfContent)) !== null) {
    if (match[1]) {
      textParts.push(decodeEscapedText(match[1]));
    }
  }
  
  // Padrão 2: Arrays TJ
  const tjArrayPattern = /\[((?:[^[\]]*|\[[^\]]*\])*)\]\s*TJ/gi;
  while ((match = tjArrayPattern.exec(pdfContent)) !== null) {
    const arrayContent = match[1];
    const stringPattern = /\(([^)]*)\)/g;
    let stringMatch;
    while ((stringMatch = stringPattern.exec(arrayContent)) !== null) {
      if (stringMatch[1]) {
        textParts.push(decodeEscapedText(stringMatch[1]));
      }
    }
  }
  
  // Padrão 3: Streams de texto entre BT e ET
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
  while ((match = btEtPattern.exec(pdfContent)) !== null) {
    const btContent = match[1];
    // Extrair texto de dentro do bloco BT/ET
    const innerTjPattern = /\(([^)]*)\)\s*Tj/g;
    let innerMatch;
    while ((innerMatch = innerTjPattern.exec(btContent)) !== null) {
      if (innerMatch[1] && !textParts.includes(decodeEscapedText(innerMatch[1]))) {
        textParts.push(decodeEscapedText(innerMatch[1]));
      }
    }
  }
  
  return textParts.join(' ').trim();
}

function decodeEscapedText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

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

    // Extrair texto do PDF
    let texto = extractTextFromPdfBuffer(bytes);

    console.log('Texto extraído (bruto):', texto.length, 'caracteres');

    // Limpar texto (remover múltiplos espaços/quebras de linha)
    texto = texto
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    console.log('Texto limpo:', texto.length, 'caracteres');

    // Limitar o tamanho do texto
    if (texto.length > MAX_TEXT_LENGTH) {
      texto = texto.substring(0, MAX_TEXT_LENGTH) + '... [texto truncado]';
      console.log('Texto truncado para', MAX_TEXT_LENGTH, 'caracteres');
    }

    if (!texto || texto.length < 10) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Não foi possível extrair texto do PDF (pode ser um PDF de imagem/escaneado ou protegido)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extração concluída com sucesso');
    console.log('Preview:', texto.substring(0, 200) + '...');

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        texto,
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
