import { Documento, Secao, SUPORTE } from "@/components/legal/Documento";
import { cnpjFormatado } from "@/lib/empresa";
import { MARCA } from "@/lib/marca";

// POLÍTICA DE PRIVACIDADE DA BALLAD GIFT (EUA, inglês).
//
// ── ADAPTADA, NÃO TRADUZIDA ──────────────────────────────────────
//
// A portuguesa fala com a LGPD. Esta fala com o consumidor americano: os
// direitos vêm das leis estaduais (Califórnia e as que seguiram o mesmo
// modelo), e a idade mínima que importa lá é a do COPPA (13 anos).
//
// A regra do `privacidade.tsx` vale igual: cada item descreve o que o sistema
// da Ballad faz de verdade. Os fornecedores são os que o deploy da Ballad usa
// (Stripe no lugar de Woovi e Perfect Pay, dados nos EUA). Se alguma
// integração mudar, ESTE ARQUIVO MUDA JUNTO.
//
// O ditado por voz é a Web Speech API do navegador (`use-dictation.ts`): o
// áudio nunca chega na gente, só o texto. Por isso o texto diz exatamente
// isso, e não "transcrevemos o seu áudio".

export const META_PRIVACIDADE_EN = {
  title: `Privacy Policy · ${MARCA.nome}`,
  description: `How ${MARCA.nome} collects, uses and protects your data: what we collect, how long we keep it, who we share it with, and how to ask us to delete it.`,
};

const linkSuporte = (
  <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
    {SUPORTE}
  </a>
);

export function PrivacidadeEn() {
  return (
    <Documento titulo="Privacy Policy" atualizado="September 29, 2026">
      <p>
        This policy explains what data {MARCA.nome} collects, why we collect it, who we share it
        with, and what you can ask us to do with it at any time. It applies to{" "}
        <strong>{MARCA.dominio}</strong> and to the emails we send.
      </p>

      <Secao n={1} titulo="Who we are">
        <p>
          {MARCA.nome} is operated by a company registered in Brazil (CNPJ {cnpjFormatado()}, São
          Caetano do Sul, SP, Brazil), which is responsible for your data. For any privacy question
          or request, email {linkSuporte}. We reply within 30 days, and usually much sooner.
        </p>
      </Secao>

      <Secao n={2} titulo="What we collect">
        <p>
          <strong>What you tell us in the quiz.</strong> Who the song is for, their name or
          nickname, the occasion, the music style, the type of voice, and the story you tell.
        </p>
        <p>
          <strong>Voice dictation, if you use it.</strong> If you choose to speak instead of typing,
          your browser's own speech recognition turns your voice into text. We only receive the
          text, never the audio.
        </p>
        <p>
          <strong>Your email address.</strong> We need it to deliver your song and let you get back
          to your gift.
        </p>
        <p>
          <strong>Photos.</strong> Only if you upload them to your gift page, after purchase.
        </p>
        <p>
          <strong>Payment information.</strong> Stripe processes your payment and tells us whether
          it went through, the amount, and basic details like your name and email.{" "}
          <strong>We never see or store your full card number.</strong> That stays with Stripe.
        </p>
        <p>
          <strong>Technical and ad data.</strong> Things like your device and browser type, your IP
          address, the pages you visit on our site, the site that sent you to us, and the tracking
          parameters in the link you clicked (such as UTM tags and ad click IDs like Google's
          gclid or TikTok's ttclid). This tells us which ads work.
        </p>
        <p>
          <strong>What we DON'T ask for:</strong> your Social Security number, home address, date of
          birth or any ID document.
        </p>
      </Secao>

      <Secao n={3} titulo="How we use it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To write the lyrics and create the song. That's the product.</li>
          <li>To deliver it: the email with your links, the gift page and the MP3 file.</li>
          <li>
            To send transactional emails about your order, like your lyrics and your finished song.
          </li>
          <li>
            To remind you about something you left halfway, like lyrics you didn't buy. Every one of
            these emails has an unsubscribe link.
          </li>
          <li>To help you when you contact us.</li>
          <li>To prevent fraud and keep the service secure.</li>
          <li>To measure which ads lead to purchases, so we don't spend on what doesn't work.</li>
          <li>To meet our legal, tax and accounting obligations.</li>
        </ul>
        <p>
          <strong>We don't sell your personal information</strong>, and we don't send you other
          companies' ads.
        </p>
      </Secao>

      <Secao n={4} titulo="Who we share it with">
        <p>Only with the service providers we need to run the service, and only what they need:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Anthropic (Claude)</strong>, which writes the lyrics from your story.
          </li>
          <li>
            <strong>An AI music generation provider</strong>, which records the song from the
            lyrics.
          </li>
          <li>
            <strong>Supabase</strong>, our database and file storage.
          </li>
          <li>
            <strong>Vercel</strong>, which hosts the site.
          </li>
          <li>
            <strong>Stripe</strong>, which processes payments.
          </li>
          <li>
            <strong>Resend</strong>, which sends our emails.
          </li>
          <li>
            <strong>Google Ads</strong>, for ad measurement. We send the ad click ID and the
            purchase amount, never your story or your lyrics.
          </li>
          <li>
            <strong>TikTok</strong>, for ad measurement. When you came from a TikTok ad, we send the
            ad click ID, the purchase amount and a scrambled (hashed) version of your email, never
            your story or your lyrics.
          </li>
        </ul>
        <p>
          We may also share information if the law requires it, or to protect our rights and the
          safety of our users.
        </p>
      </Secao>

      <Secao n={5} titulo="Where your data is stored">
        <p>
          Your data is stored with our providers in the <strong>United States</strong>. Because the
          company that runs {MARCA.nome} is based in Brazil, our team may access it from there to
          deliver the service and help you.
        </p>
      </Secao>

      <Secao n={6} titulo="Your story and your song">
        <p>
          The story you write is used to create the lyrics, and it's kept with your order in case
          you want changes and so we can help you if you contact us.{" "}
          <strong>It's never published, sold or used as an example</strong> without your written
          permission.
        </p>
        <p>
          Your gift page lives at a unique, unlisted address and{" "}
          <strong>isn't indexed by search engines</strong>. Anyone who has the link can see the
          page, so only send it to people you want to see it.
        </p>
      </Secao>

      <Secao n={7} titulo="Cookies and ad measurement">
        <p>
          We use your browser's local storage to remember where you stopped in the quiz and which
          version of the site you saw. We use Google Ads and TikTok tags to measure where visits and purchases
          come from.
        </p>
        <p>
          <strong>On the pages that hold your personal content</strong> (your gift page and your
          editor), <strong>we don't load any third-party scripts</strong>.
        </p>
        <p>
          You can block or delete cookies in your browser settings. Some state laws treat ad
          measurement like this as "sharing" for advertising. If you'd like to opt out, email us and
          we'll honor your request.
        </p>
      </Secao>

      <Secao n={8} titulo="How long we keep it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>If you bought:</strong> your song, your gift page and your order details are
            kept until you ask us to delete them. That's what keeps your link working.
          </li>
          <li>
            <strong>If you didn't buy:</strong> your lyrics and quiz answers are kept for up to 12
            months, then deleted.
          </li>
          <li>
            <strong>Payment records:</strong> up to 5 years, for tax and accounting reasons.
          </li>
        </ul>
      </Secao>

      <Secao n={9} titulo="Your choices">
        <p>You can ask us at any time to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>tell you what data we have about you, and give you a copy;</li>
          <li>correct anything that's wrong or incomplete;</li>
          <li>delete your data;</li>
          <li>stop sending you reminder emails.</li>
        </ul>
        <p>
          To stop reminder emails, use the unsubscribe link at the bottom of any of them. For
          anything else, email {linkSuporte} from the address you used to buy, so we can confirm
          it's you.
        </p>
        <p>
          One honest heads-up:{" "}
          <strong>deleting everything deletes your song and your gift page</strong>. If you ask us
          to delete your data, any link you've shared stops working. We'll check with you before we
          do it.
        </p>
      </Secao>

      <Secao n={10} titulo="US state privacy rights">
        <p>
          If you live in California or another state with a consumer privacy law (such as Virginia,
          Colorado or Connecticut), you have the right to:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>know what personal information we collect, use and share;</li>
          <li>get a copy of it;</li>
          <li>have it deleted;</li>
          <li>have it corrected;</li>
          <li>opt out of the sale or sharing of your personal information;</li>
          <li>not be treated differently for using any of these rights.</li>
        </ul>
        <p>
          <strong>We do not sell personal information</strong>, and we haven't in the past 12
          months. To use any of these rights, email {linkSuporte}. You can also have an authorized
          agent make the request for you. If we can't do what you asked, we'll explain why, and you
          can reply to ask us to reconsider.
        </p>
      </Secao>

      <Secao n={11} titulo="Security">
        <p>
          Your data is encrypted in transit and kept with providers that control who can access it.
          Your gift page and editor are protected by unique, unguessable links, not by passwords
          someone could guess. Still, no system is perfect: if something happens that could affect
          you, we'll let you know.
        </p>
      </Secao>

      <Secao n={12} titulo="Children">
        <p>
          {MARCA.nome} is not directed to children under 13, and we don't knowingly collect personal
          information from them. If we find out we have, we'll delete it. If you believe a child has
          given us their information, email {linkSuporte}.
        </p>
      </Secao>

      <Secao n={13} titulo="Changes to this policy">
        <p>
          If this policy changes, the date at the top changes too. If it's an important change,
          we'll email the people who bought from us.
        </p>
      </Secao>
    </Documento>
  );
}
