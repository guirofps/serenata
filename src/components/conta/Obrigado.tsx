import { type Locale } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { z } from "zod";
import { conversaoCompra } from "@/lib/google-ads";
import { MOEDA } from "@/lib/i18n";
import { buscarPresenteDaCompra, type PresenteDaCompra } from "@/lib/pos-compra";
import { sessaoJaPagou } from "@/lib/coautoria";
import { marcarSessaoGasta, getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { ConviteOutraMusica } from "@/components/conta/ConviteOutraMusica";
import { linkSuporte, TEXTO_SUPORTE } from "@/lib/suporte-whatsapp";
import { Check, Mail, Inbox, Pencil, Loader2 } from "lucide-react";

// Página de PÓS-COMPRA — o destino do redirect do checkout (Cakto/Perfect Pay).
//
// Ela existe por um motivo bem prático: o e-mail com o link (montar o presente)
// pode cair em Promoções/Spam num domínio novo. Se a pessoa não souber disso,
// paga e acha que não recebeu nada. Aqui a gente AVISA, na hora, com a compra
// fresca na cabeça.
//
// Sem gateway acoplado: é uma página informativa. Se o checkout mandar `?email=`
// no redirect, personaliza; se não mandar, funciona igual.


const COPY = {
  pt: {
    confirmado: "pagamento confirmado",
    tudoCerto: "Deu tudo certo. Sua música é sua.",
    faltaUmPasso: "Falta um passo, e ele é aqui embaixo mesmo.",
    enviamos: "Enviamos para", seuEmail: "o seu e-mail",
    oLinkPraMontar: "o link pra montar o presente. Ele chega em instantes.",
    preparando: "Preparando o seu presente…",
    proximoPasso: "o próximo passo",
    monteOPresente: (n?: string | null) => `Monte o presente${n ? ` de ${n}` : ""}`,
    escolhaGravacao: "Escolha a gravação, ponha as fotos de vocês e uma frase sua. Leva dois minutos.",
    montarBotao: "Montar o presente",
    aindaSaindo: "A gravação ainda está saindo do forno. Pode ir montando: ela aparece sozinha quando ficar pronta.",
    tambemMandamos: "Também mandamos esse link para",
    praNaoPerder: ", pra você não perder. Se não achar, olhe em Promoções e no Spam.",
    naoAchou: "Não achou o e-mail em 1 minuto?",
    ondeOlhar: 'Olhe na aba Promoções e no Spam. Se estiver lá, marque como "não é spam" e mova pra Caixa de entrada. Assim os próximos chegam direto.',
    passos: [
      "Abra o e-mail da Serenata (confira o spam também).",
      "Clique no link e monte o presente: uma foto e uma frase sua.",
      "Copie o link pronto e mande pra quem você ama.",
    ],
    semPressa: "Sem pressa: o link acima também está no seu e-mail e não expira. ",
    podeFechar: "Pode fechar esta página, o e-mail chega sozinho. ",
    qualquerCoisa: "Qualquer coisa, é só responder o e-mail ou falar com a gente em",
  },
  es: {
    confirmado: "pago confirmado",
    tudoCerto: "Todo salió bien. La canción ya es tuya.",
    faltaUmPasso: "Falta un paso, y está aquí abajo mismo.",
    enviamos: "Enviamos a", seuEmail: "tu correo",
    oLinkPraMontar: "el link para armar el regalo. Llega en un momento.",
    preparando: "Preparando tu regalo…",
    proximoPasso: "el siguiente paso",
    monteOPresente: (n?: string | null) => `Arma el regalo${n ? ` de ${n}` : ""}`,
    escolhaGravacao: "Elige la grabación, pon las fotos de ustedes y una frase tuya. Toma dos minutos.",
    montarBotao: "Armar el regalo",
    aindaSaindo: "La grabación todavía se está terminando. Puedes ir armando: aparece sola cuando esté lista.",
    tambemMandamos: "También mandamos ese link a",
    praNaoPerder: ", para que no lo pierdas. Si no lo encuentras, revisa Promociones y Spam.",
    naoAchou: "¿No encuentras el correo en 1 minuto?",
    ondeOlhar: 'Revisa la pestaña Promociones y la carpeta de Spam. Si está ahí, márcalo como "no es spam" y muévelo a tu Bandeja de entrada. Así los siguientes llegan directo.',
    passos: [
      "Abre el correo de Serenata (revisa también el spam).",
      "Haz clic en el link y arma el regalo: una foto y una frase tuya.",
      "Copia el link listo y mándaselo a quien tú quieres.",
    ],
    semPressa: "Sin prisa: el link de arriba también está en tu correo y no expira. ",
    podeFechar: "Puedes cerrar esta página, el correo llega solo. ",
    qualquerCoisa: "Cualquier cosa, responde el correo o escríbenos a",
  },
} as const;

export function Obrigado({ locale = "pt", email, code }: { locale?: Locale; email?: string; code?: string }) {
  const C = COPY[locale] ?? COPY.pt;
  // O WHATSAPP DO SUPORTE, aqui e não antes.
  //
  // 248 dos 294 compradores nunca entraram na conta (medido em 18/08): quem
  // não acha o e-mail não tem canal nenhum, e essa pessoa hoje simplesmente
  // some. Esta é a primeira tela depois do pagamento, então é o primeiro
  // lugar legítimo pro número aparecer.
  const tz = TEXTO_SUPORTE[locale === "es" ? "es" : "pt"];
  const [presente, setPresente] = useState<PresenteDaCompra | null>(null);
  const [procurando, setProcurando] = useState(true);

  // Conversão do Google Ads: é aqui que o algoritmo aprende quem comprou.
  useEffect(() => {
    // O valor e a moeda saem do idioma da venda, não de um número cravado.
    conversaoCompra({
      valor: (MOEDA[locale] ?? MOEDA.pt).valor,
      moeda: locale === "es" ? "USD" : "BRL",
      transactionId: code,
    });
    // Esta sessão já virou venda. Quem voltar ao /criar por qualquer caminho
    // ganha uma sessão nova lá, senão a segunda música sobrescreve a primeira.
    // Marcado DEPOIS da conversão de propósito: o evento de venda tem que
    // sair na sessão que gerou a venda.
    marcarSessaoGasta();
  }, [code]);

  // Busca o presente pra dar o botão AQUI em vez de mandar a pessoa caçar
  // e-mail. Faz polling porque o redirect chega antes do webhook: a pessoa
  // volta do gateway em milissegundos e o pedido leva alguns segundos.
  //
  // ── DOIS CAMINHOS, PORQUE UM DELES NÃO É NOSSO ───────────────────
  //
  // O caminho original dependia do `code` que a Perfect Pay devolve no
  // redirect. Quando ele não vem, `procurando` nasce falso, nenhum polling
  // acontece, e a tela mostra só "enviamos pro seu e-mail" — foi exatamente
  // essa tela que o sócio fotografou, sem botão nenhum.
  //
  // Isso custou caro: 33 compradores em 10 dias foram procurar login em vez
  // de montar o presente, e sete abriram ticket dizendo que não acharam a
  // música.
  //
  // O segundo caminho não depende de ninguém: a pessoa acabou de sair do
  // NOSSO funil, então o navegador dela ainda tem a sessão, e `sessaoJaPagou`
  // devolve os tokens a partir dela. Os dois rodam juntos e o primeiro que
  // achar ganha.
  useEffect(() => {
    let vivo = true;
    let tentativas = 0;
    setProcurando(true);

    async function procurar() {
      if (!vivo) return;
      try {
        if (code) {
          const p = await buscarPresenteDaCompra({ data: { code } });
          if (!vivo) return;
          if (p) {
            setPresente(p);
            setProcurando(false);
            trackEvent("obrigado_presente_achado", { via: "code" });
            return;
          }
        }
        const s = await sessaoJaPagou({ data: { sessionId: getOrCreateSessionId() } });
        if (!vivo) return;
        if (s.pago && s.tokenEdicao) {
          setPresente({
            tokenEdicao: s.tokenEdicao,
            token: s.token ?? "",
            titulo: null,
            nome: null,
            gerando: false,
          });
          setProcurando(false);
          trackEvent("obrigado_presente_achado", { via: "sessao" });
          return;
        }
      } catch (err) {
        console.error("[obrigado] busca falhou:", err);
      }
      tentativas += 1;
      // ~90s. Passou disso, o e-mail assume (e ele já foi enviado).
      if (tentativas >= 30) {
        setProcurando(false);
        trackEvent("obrigado_presente_nao_achado", { tinhaCode: Boolean(code) });
        return;
      }
      setTimeout(procurar, 3000);
    }

    procurar();
    return () => {
      vivo = false;
    };
  }, [code]);

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 py-12 text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <main className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo tamanho="md" />
        </div>

        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            {C.confirmado}
          </p>
          <h1
            className="mt-3 text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.2 }}
          >
            {C.tudoCerto}
          </h1>
          <p
            className="mx-auto mt-4 max-w-sm text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            {presente ? (
              <>{C.faltaUmPasso}</>
            ) : (
              <>
                {C.enviamos}{" "}
                {email ? <><strong className="text-[var(--tinta)]">{email}</strong></> : C.seuEmail}{" "}
                {C.oLinkPraMontar}
              </>
            )}
          </p>
        </div>

        {/* O CAMINHO CURTO: o botão que leva direto ao editor, sem passar por
            e-mail nenhum. É o momento de maior intenção que existe, e até
            03/08 a gente o gastava mandando a pessoa procurar na caixa de
            entrada — com 3 de 6 compradores nunca montando o presente. */}
        {procurando && (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/50 bg-[var(--papel-fundo)] px-5 py-6 text-[var(--tinta-suave)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span style={{ fontSize: "var(--t-sm)" }}>{C.preparando}</span>
          </div>
        )}

        {presente && (
          <div className="mt-8 rounded-[var(--raio-lg)] border-2 border-[var(--acento)]/30 bg-[var(--acento)]/5 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--acento)]">
              {C.proximoPasso}
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: FONTES.display, fontSize: "var(--t-xl)", lineHeight: 1.25 }}
            >
              {C.monteOPresente(presente.nome)}
            </p>
            <p
              className="mx-auto mt-2 max-w-xs text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
            >
              {C.escolhaGravacao}
            </p>
            <a
              href={`/editar/${presente.tokenEdicao}`}
              className="cta mt-5 inline-flex items-center gap-2 rounded-full px-8 py-4 font-medium"
              style={{ fontSize: "var(--t-base)" }}
            >
              <Pencil className="h-4 w-4" /> {C.montarBotao}
            </a>
            {presente.gerando && (
              <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                {C.aindaSaindo}
              </p>
            )}
          </div>
        )}

        {/* Com o botão na tela, o caça-ao-e-mail vira ruído: os três passos
            começavam com "abra o e-mail", que passa a contradizer o caminho
            curto. Vira uma linha de rodapé. */}
        {presente ? (
          <p
            className="mt-6 text-center text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
          >
            {C.tambemMandamos}{" "}
            {email ? <><strong className="text-[var(--tinta)]">{email}</strong></> : C.seuEmail}
            {C.praNaoPerder}
          </p>
        ) : (
        <>
        {/* O AVISO que justifica a página: olhar o spam. Em destaque, porque é
            o ponto onde a pessoa mais se perde num remetente novo. */}
        <div className="mt-8 rounded-[var(--raio-lg)] border border-[var(--acento)]/25 bg-[var(--acento)]/5 p-5">
          <div className="flex gap-3">
            <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acento)]" />
            <div>
              <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
                {C.naoAchou}
              </p>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
              >
                {C.ondeOlhar}
              </p>
            </div>
          </div>
        </div>

        {/* Os 3 passos, pra não deixar dúvida do que fazer com o e-mail. */}
        <ol className="mt-8 space-y-4">
          {[
            { icon: Mail, txt: C.passos[0] },
            { icon: Pencil, txt: C.passos[1] },
            { icon: Check, txt: C.passos[2] },
          ].map((p, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--tinta-fraca)] text-[var(--acento)]">
                <p.icon className="h-4 w-4" />
              </span>
              <span style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>{p.txt}</span>
            </li>
          ))}
        </ol>
        </>
        )}

        {/* SOLICITAR A MÚSICA PELO WHATSAPP.
            Não é "precisa de ajuda?", é o pedido que a pessoa realmente tem.
            Medido em 18/08: 248 dos 294 compradores nunca entraram na conta,
            e quem digitou o e-mail errado não tem canal nenhum. Ela some, e a
            gente só descobre pelo ticket.

            A mensagem já vai escrita com nome, título e código da música. O
            atendente recebe "oi" e gasta três mensagens perguntando quem é;
            assim ele já procura e responde. É esse trabalho que o botão
            existe pra poupar. */}
        {(() => {
          const zap = linkSuporte({
            locale: locale === "es" ? "es" : "pt",
            motivo: "receber",
            nome: presente?.nome ?? null,
            titulo: presente?.titulo ?? null,
            token: presente?.tokenEdicao?.slice(0, 8) ?? null,
          });
          if (!zap) return null;
          return (
            <div className="mx-auto mt-10 max-w-md rounded-[var(--raio-lg)] border border-[#25D366]/40 bg-[#25D366]/[0.06] p-5 text-center">
              <p className="font-medium" style={{ fontSize: "var(--t-base)" }}>
                {tz.receberTitulo}
              </p>
              <p
                className="mx-auto mt-1.5 max-w-sm text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}
              >
                {tz.receberSub}
              </p>
              <a
                href={zap}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("suporte_zap_click", { origem: "obrigado" })}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-medium text-white transition-opacity hover:opacity-90"
                style={{ fontSize: "var(--t-sm)", background: "#25D366" }}
              >
                {tz.receberBotao}
              </a>
            </div>
          );
        })()}

        {/* DISCRETO, e de propósito.
            A ação desta tela é UMA: montar o presente. O comprador ainda nem
            viu o dele pronto, então um cartão vendendo a segunda música
            competiria com a primeira e faria ele sair sem montar nada. O
            cartão inteiro fica no editor, que é depois. Aqui é só uma porta
            visível pra quem já sabe que quer outra, que é o caso de quem
            comprou pensando em duas pessoas. */}
        <div className="mt-10 text-center">
          <ConviteOutraMusica
            locale={locale === "es" ? "es" : "pt"}
            origem="obrigado"
            variante="discreto"
          />
        </div>

        <p
          className="mt-8 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
        >
          {presente
            ? C.semPressa
            : C.podeFechar}
          {C.qualquerCoisa}{" "}
          <a href="mailto:contato@serenatagift.com" className="text-[var(--acento)] underline underline-offset-2">
            contato@serenatagift.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
