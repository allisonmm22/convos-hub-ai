import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Play, Database, ArrowRight, Loader2, Download, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

export default function MigracaoExterna() {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [migrating, setMigrating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const getSchemaSQL = async () => {
    const { data, error } = await supabase.functions.invoke('external-schema');
    if (error) throw error;
    return data;
  };

  const copyToClipboard = async () => {
    try {
      const schema = await getSchemaSQL();
      await navigator.clipboard.writeText(schema);
      setCopied(true);
      toast.success("SQL copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 3000);
    } catch (error: any) {
      toast.error("Erro ao copiar: " + error.message);
    }
  };

  const downloadSQL = async () => {
    try {
      const schema = await getSchemaSQL();
      const blob = new Blob([schema], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schema-supabase-externo.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("SQL baixado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao baixar: " + error.message);
    }
  };

  const [sqlToShow, setSqlToShow] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setSqlToShow(null);
    setErrorType(null);
    try {
      const { data, error } = await supabase.functions.invoke('setup-external-database');
      
      if (error) throw error;
      
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || `Conexão OK! Tabelas encontradas.`
        });
        toast.success("Conexão com banco externo verificada!");
      } else {
        // Identificar tipo de erro e mostrar SQL apropriado
        setErrorType(data.errorType || 'unknown');
        setSqlToShow(data.sql || null);
        
        let message = data.error || "Erro na conexão";
        if (data.errorType === 'permission') {
          message = "⚠️ ERRO DE PERMISSÃO: As tabelas existem, mas faltam GRANTs. Execute o SQL abaixo.";
        } else if (data.errorType === 'not_found') {
          message = "❌ Tabelas não encontradas. Execute o SQL de criação primeiro.";
        } else if (data.errorType === 'schema_cache') {
          message = "🔄 Cache do PostgREST desatualizado. Reinicie o container 'rest' no Portainer.";
        }
        
        setTestResult({
          success: false,
          message: message
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message
      });
      toast.error("Erro ao testar conexão: " + error.message);
    } finally {
      setTesting(false);
    }
  };

  const copySqlToClipboard = async (sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("SQL copiado para a área de transferência!");
    } catch (error: any) {
      toast.error("Erro ao copiar: " + error.message);
    }
  };

  const runMigration = async () => {
    setMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-to-external', {
        body: {}
      });
      
      if (error) throw error;
      
      setMigrationResult(data);
      if (data.success) {
        toast.success(`Migração concluída! ${data.summary?.totalRecords || 0} registros migrados.`);
        setStep(3);
      } else {
        toast.error("Migração concluída com erros. Verifique os detalhes.");
      }
    } catch (error: any) {
      toast.error("Erro na migração: " + error.message);
      setMigrationResult({ success: false, error: error.message });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Migração para Supabase Externo</h1>
          <p className="text-muted-foreground">
            Siga os passos abaixo para migrar todos os dados para seu Supabase externo
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <ArrowRight className={`w-6 h-6 mx-2 ${step > s ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Copy SQL */}
        <Card className={step === 1 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Passo 1: Criar Tabelas no Supabase Externo
            </CardTitle>
            <CardDescription>
              Baixe ou copie o SQL e execute no SQL Editor do seu Supabase externo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={downloadSQL}
                variant="default"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar SQL
              </Button>
              <Button 
                onClick={copyToClipboard}
                variant="secondary"
                className="flex-1"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copiado!' : 'Copiar SQL'}
              </Button>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-600 mb-2">⚠️ Instruções:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Acesse o dashboard do seu Supabase externo em <strong>supabase.cognityx.com.br</strong></li>
                <li>Vá em <strong>SQL Editor</strong></li>
                <li>Cole o SQL baixado/copiado</li>
                <li>Clique em <strong>Run</strong></li>
                <li>Aguarde a mensagem "Schema criado com sucesso!"</li>
              </ol>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Testar conexão com banco externo:</h4>
              <Button 
                onClick={testConnection}
                variant="outline"
                disabled={testing}
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>
              
              {testResult && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                    : errorType === 'permission'
                    ? 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {testResult.message}
                </div>
              )}

              {/* Mostrar SQL quando houver erro */}
              {sqlToShow && !testResult?.success && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">
                      {errorType === 'permission' ? '📋 SQL de Permissões (GRANTs):' : '📋 SQL para executar:'}
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copySqlToClipboard(sqlToShow)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                    {sqlToShow}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Cole este SQL no SQL Editor do seu Supabase externo e execute. 
                    Depois reinicie o PostgREST no Portainer.
                  </p>
                </div>
              )}
            </div>

            <Button 
              onClick={() => setStep(2)} 
              className="w-full"
              disabled={step !== 1}
            >
              Já executei o SQL, próximo passo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Run Migration */}
        <Card className={step === 2 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Passo 2: Migrar Dados
            </CardTitle>
            <CardDescription>
              Migrar todos os dados do Lovable Cloud para seu Supabase externo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm">
                Este processo irá copiar <strong>todos os dados</strong> (planos, contas, usuários, 
                contatos, conversas, mensagens, etc.) para o seu banco de dados externo.
              </p>
            </div>

            <Button 
              onClick={runMigration}
              className="w-full"
              disabled={step !== 2 || migrating}
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrando dados...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Migração
                </>
              )}
            </Button>

            {migrationResult && (
              <div className={`p-4 rounded-lg ${
                migrationResult.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <h4 className="font-semibold mb-2">
                  {migrationResult.success ? '✅ Migração concluída!' : '❌ Erro na migração'}
                </h4>
                {migrationResult.summary && (
                  <div className="text-sm space-y-1">
                    <p>Tabelas com sucesso: {migrationResult.summary.tablesSuccess}</p>
                    <p>Tabelas com erro: {migrationResult.summary.tablesError}</p>
                    <p>Total de registros: {migrationResult.summary.totalRecords}</p>
                  </div>
                )}
                {migrationResult.error && (
                  <p className="text-sm text-red-600">{migrationResult.error}</p>
                )}
                {migrationResult.results && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Ver detalhes por tabela
                    </summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {migrationResult.results.map((r: any, i: number) => (
                        <div key={i} className={`p-2 rounded ${r.success ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                          <strong>{r.table}:</strong> {r.success ? `${r.count} registros` : r.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Complete */}
        <Card className={step === 3 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              Passo 3: Concluído!
            </CardTitle>
            <CardDescription>
              Seus dados foram migrados com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 3 ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
                <Check className="w-16 h-16 mx-auto text-green-600 mb-4" />
                <h3 className="text-xl font-bold text-green-600 mb-2">
                  Migração Concluída com Sucesso!
                </h3>
                <p className="text-muted-foreground">
                  Todos os dados foram migrados para seu Supabase externo.
                  As Edge Functions continuarão usando o banco externo automaticamente.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Complete os passos anteriores para finalizar a migração.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
