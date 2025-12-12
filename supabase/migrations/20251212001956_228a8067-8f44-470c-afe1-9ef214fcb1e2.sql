-- Criar bucket para mídia do WhatsApp
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Política para leitura pública
CREATE POLICY "Mídia WhatsApp é pública para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Política para upload autenticado
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Política para upload via service role (edge functions)
CREATE POLICY "Service role pode fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'service_role');

-- Política para service role deletar
CREATE POLICY "Service role pode deletar mídia"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'service_role');