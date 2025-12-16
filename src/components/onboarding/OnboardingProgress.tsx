import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Smartphone, 
  Key, 
  Bot,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface OnboardingProgressProps {
  conexaoStatus: boolean;
  openaiStatus: boolean;
  agenteStatus: boolean;
}

export function OnboardingProgress({ 
  conexaoStatus, 
  openaiStatus, 
  agenteStatus 
}: OnboardingProgressProps) {
  const navigate = useNavigate();
  const { startOnboarding, isOnboardingActive } = useOnboarding();

  const steps = [
    {
      id: 'conexao',
      title: 'Conectar WhatsApp',
      description: 'Configure sua conexão com WhatsApp',
      icon: Smartphone,
      completed: conexaoStatus,
      route: '/conexao'
    },
    {
      id: 'openai',
      title: 'Configurar OpenAI',
      description: 'Adicione sua chave de API',
      icon: Key,
      completed: openaiStatus,
      route: '/integracoes'
    },
    {
      id: 'agente',
      title: 'Configurar Agente IA',
      description: 'Personalize seu assistente',
      icon: Bot,
      completed: agenteStatus,
      route: '/agente-ia'
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const allCompleted = completedCount === steps.length;

  const handleStepClick = (route: string) => {
    navigate(route);
  };

  if (allCompleted) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/20">
              <Sparkles className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Tudo configurado! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                Seu CRM está pronto para uso. Comece a atender seus clientes!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Primeiros Passos</CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{steps.length} concluídos
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full mt-2">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(step.route)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left ${
                step.completed 
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                step.completed 
                  ? 'bg-emerald-500/20' 
                  : 'bg-background'
              }`}>
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <step.icon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${
                  step.completed ? 'text-emerald-600 line-through' : ''
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>

        {!isOnboardingActive && completedCount === 0 && (
          <Button 
            onClick={startOnboarding}
            className="w-full mt-4"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Iniciar Tutorial Guiado
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
