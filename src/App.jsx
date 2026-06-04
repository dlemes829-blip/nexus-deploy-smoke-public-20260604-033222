import React from "react";
import { Activity, ArrowRight, CheckCircle2, Command, Database, Layers3, PlayCircle, Rocket, ShieldCheck, Sparkles, Terminal, Users } from "lucide-react";
import { product, metrics, features } from "./data/demoData.js";
import { agentImprovements } from "./data/agentImprovements.js";
import { saveActivity, supabaseReady } from "./lib/supabaseClient.js";



const deliverySteps = [
  "Brief interpretado com foco em produto real",
  "Arquitetura, telas e dados preparados",
  "Supabase conectado como banco padrao",
  "Smoke tests e preview prontos para revisar",
];

const terminalLines = [
  "nexus plan --mode=saas",
  "workspace criado com React, Vite e Supabase",
  "componentes premium, metricas e jornadas geradas",
  "smoke tests: aprovado",
];

export default function App() {
  const [saved, setSaved] = React.useState(false);

  async function handlePrimaryAction() {
    await saveActivity("primary_action", { project: product.name });
    setSaved(true);
  }

  return (
    <main className="shell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <div className="brand">
          <span className="brandMark"><Sparkles size={20} /></span>
          <div>
            <strong>{product.name}</strong>
            <small>{product.domain}</small>
          </div>
        </div>
        <nav>
          <a href="#workspace">Workspace</a>
          <a href="#modules">Modulos</a>
          <a href="#agent">Agent</a>
        </nav>
        <span className={supabaseReady ? "dbStatus connected" : "dbStatus"}>{supabaseReady ? "Supabase conectado" : "Modo demo Supabase"}</span>
      </header>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Agent Nexus build 2026</p>
          <h1>{product.domain} com experiencia de SaaS premium.</h1>
          <p className="lead">{product.promise}</p>
          <div className="actions">
            <button onClick={handlePrimaryAction}><Rocket size={18} /> Iniciar operacao</button>
            <a href="#workspace">Ver entrega <ArrowRight size={16} /></a>
          </div>
          {saved ? <p className="saved">Atividade registrada na camada Supabase/demo.</p> : null}
        </div>

        <aside className="commandCenter">
          <div className="orbit">
            <span />
            <span />
            <span />
            <div className="core"><Command size={34} /></div>
          </div>
          <h2>Cockpit operacional</h2>
          <p>Preview, dados, schema, validacao e proximas melhorias em um unico workspace.</p>
          <div className="healthGrid">
            <div><strong>5x</strong><span>ciclos de teste</span></div>
            <div><strong>SQL</strong><span>Supabase pronto</span></div>
          </div>
        </aside>
      </section>

      <section className="metrics">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.trend}</span>
            <strong>{metric.value}</strong>
            <p>{metric.label}</p>
          </article>
        ))}
      </section>

      

      <section id="workspace" className="workspace">
        <div className="sectionTitle">
          <Layers3 />
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>Entrega pronta para evoluir</h2>
          </div>
        </div>
        <div className="workspaceGrid">
          <article className="glassPanel">
            <Database />
            <h3>Banco padrao</h3>
            <p>Schema SQL, env e cliente Supabase ja fazem parte da entrega.</p>
          </article>
          <article className="glassPanel">
            <Terminal />
            <h3>Terminal de validacao</h3>
            <div className="terminal">
              {terminalLines.map((line) => <code key={line}>$ {line}</code>)}
            </div>
          </article>
          <article className="glassPanel">
            <PlayCircle />
            <h3>Preview vivo</h3>
            <p>Interface gerada com estados, acoes, metricas e estrutura editavel.</p>
          </article>
        </div>
      </section>

      <section id="modules" className="modules">
        <div className="sectionTitle">
          <ShieldCheck />
          <div>
            <p className="eyebrow">Modulos</p>
            <h2>Funcionalidades geradas</h2>
          </div>
        </div>
        <div className="featureGrid">
          {features.map((feature) => (
            <article key={feature.title}>
              <CheckCircle2 />
              <h3>{feature.title}</h3>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="agent" className="agentPanel">
        <div>
          <p className="eyebrow">Agent Nexus</p>
          <h2>Plano, execucao e melhoria continua.</h2>
          <p>O projeto nasce com registro do que foi feito e uma pasta de melhorias para continuar evoluindo sem perder contexto.</p>
        </div>
        <div className="delivery">
          {deliverySteps.map((step) => (
            <div key={step}><Activity size={16} /><span>{step}</span></div>
          ))}
          {agentImprovements.map((item) => (
            <div key={item.date}><Users size={16} /><span>{item.title}: {item.detail}</span></div>
          ))}
        </div>
      </section>
    </main>
  );
}
