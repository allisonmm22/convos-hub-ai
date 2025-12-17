import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Mail, Lock, User, ArrowRight, Loader2, Phone, CreditCard, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Plano {
  id: string;
  nome: string;
  preco_mensal: number;
  limite_usuarios: number;
  limite_agentes: number;
  limite_conexoes_whatsapp: number;
  limite_mensagens_mes: number;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlanos, setLoadingPlanos] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLogin) {
      fetchPlanos();
    }
  }, [isLogin]);

  const fetchPlanos = async () => {
    setLoadingPlanos(true);
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('id, nome, preco_mensal, limite_usuarios, limite_agentes, limite_conexoes_whatsapp, limite_mensagens_mes')
        .eq('ativo', true)
        .order('preco_mensal', { ascending: true });

      if (error) throw error;
      setPlanos(data || []);
      if (data && data.length > 0) {
        setPlanoId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    } finally {
      setLoadingPlanos(false);
    }
  };

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou senha incorretos');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success('Login realizado com sucesso!');
        navigate('/dashboard');
      } else {
        if (!nome.trim()) {
          toast.error('Por favor, insira seu nome');
          return;
        }
        if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
          toast.error('Por favor, insira um WhatsApp válido');
          return;
        }
        if (!cpf.trim() || cpf.replace(/\D/g, '').length !== 11) {
          toast.error('Por favor, insira um CPF válido');
          return;
        }
        if (!planoId) {
          toast.error('Por favor, selecione um plano');
          return;
        }

        const { error, contaId } = await signUp(email, password, nome, whatsapp.replace(/\D/g, ''), cpf.replace(/\D/g, ''), planoId);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este email já está cadastrado');
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Redirecionar para o checkout do Stripe
        if (contaId) {
          const planoSelecionado = planos.find(p => p.id === planoId);
          if (planoSelecionado && planoSelecionado.preco_mensal > 0) {
            toast.success('Conta criada! Redirecionando para pagamento...');
            
            const response = await supabase.functions.invoke('stripe-checkout', {
              body: { 
                plano_id: planoId,
                conta_id: contaId,
                success_url: `${window.location.origin}/dashboard?success=true`,
                cancel_url: `${window.location.origin}/minha-assinatura?canceled=true`,
              },
            });

            if (response.data?.url) {
              window.location.href = response.data.url;
              return;
            }
          }
        }

        toast.success('Conta criada com sucesso!');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-glow">
              <MessageSquare className="h-9 w-9 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-4">ZapCRM</h1>
          <p className="text-xl text-muted-foreground max-w-md">
            O CRM inteligente com WhatsApp integrado e Agente de IA para turbinar suas vendas.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6 text-left">
            {[
              { title: 'WhatsApp Integrado', desc: 'Atenda via Evolution API' },
              { title: 'Agente IA', desc: 'Respostas automáticas inteligentes' },
              { title: 'CRM Kanban', desc: 'Gerencie seus funis de vendas' },
              { title: 'Multi-atendentes', desc: 'Distribua conversas na equipe' },
            ].map((feature, i) => (
              <div key={i} className="p-4 rounded-xl bg-card/50 border border-border">
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <MessageSquare className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">ZapCRM</span>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isLogin
                ? 'Acesse sua conta para continuar'
                : 'Preencha seus dados para começar'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type="tel"
                      placeholder="WhatsApp (00) 00000-0000"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                      maxLength={15}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="CPF 000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      maxLength={14}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Sua senha (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Seleção de Plano */}
              {!isLogin && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Crown className="h-4 w-4 text-primary" />
                    Escolha seu plano
                  </label>
                  {loadingPlanos ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {planos.map((plano) => (
                        <label
                          key={plano.id}
                          className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                            planoId === plano.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="plano"
                              value={plano.id}
                              checked={planoId === plano.id}
                              onChange={(e) => setPlanoId(e.target.value)}
                              className="w-4 h-4 text-primary"
                            />
                            <div>
                              <p className="font-semibold text-foreground">{plano.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {plano.limite_usuarios} usuário(s) • {plano.limite_agentes} agente(s) • {plano.limite_mensagens_mes.toLocaleString('pt-BR')} msg/mês
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {plano.preco_mensal > 0 
                                ? `R$ ${plano.preco_mensal.toFixed(2).replace('.', ',')}`
                                : 'Grátis'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">/mês</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar conta e pagar'}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Fazer login'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}