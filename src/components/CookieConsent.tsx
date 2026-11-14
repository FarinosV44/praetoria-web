'use client';

// Aviso de cookies. Solo existe si hay un ID de Google Analytics (ver GA_ID en src/lib/consentimiento.ts).
// Analytics no se carga hasta que el visitante pulsa «Aceptar» (exigencia de la LSSI y de la AEPD: nada antes de decidir).
// Al cargarse usa el modo de consentimiento v2 de Google: analítica concedida, publicidad siempre denegada.
// La elección se guarda en el navegador y se puede cambiar desde «Configurar cookies», en el pie.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GA_ID, guardarConsentimiento as saveChoice, leerConsentimiento as readChoice, type Eleccion as Choice } from '@/lib/consentimiento';
import { borrarAtribucion } from '@/lib/atribucion';

const OPEN_EVENT = 'praetoria:cookie-settings';

function loadGA(id: string) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  if (window.__gaLoaded) {
    // Ya cargado en esta visita (se rechazó y se vuelve a aceptar): basta con reactivar la analítica
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  window.__gaLoaded = true;
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', id, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
}

/** Retira el permiso en la misma visita, sin esperar a recargar */
function revokeGA() {
  if (window.__gaLoaded && typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    const choice = readChoice();
    if (choice === 'granted') loadGA(GA_ID);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado inicial que solo se conoce en el navegador
    else if (!choice) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!GA_ID || !open) return null;

  const decide = (v: Choice) => {
    // Primero Analytics: al guardar la elección se mide la página actual, y gtag ya tiene que existir
    if (v === 'granted' && GA_ID) loadGA(GA_ID);
    else {
      revokeGA();
      borrarAtribucion();
    }
    saveChoice(v);
    setOpen(false);
  };

  return (
    <div className="consent-root" lang="es">
      <div className="consent" role="dialog" aria-live="polite" aria-label="Aviso de cookies" aria-describedby="consent-texto">
        <div className="consent__inner">
          <div className="consent__body">
            <p className="consent__title">Tu privacidad, primero</p>
            <p id="consent-texto">
              Con tu permiso usamos cookies analíticas de Google Analytics para mejorar la web: páginas vistas, procedencia de la
              visita, hasta dónde se lee y qué enlaces, formularios y calculadoras se usan. Nunca lo que escribes ni datos
              para publicidad. <Link href="/politica-de-cookies/">Más información</Link>
            </p>
          </div>
          <div className="consent__actions">
            <button type="button" className="btn btn--ghost" onClick={() => decide('denied')}>
              Rechazar
            </button>
            <button type="button" className="btn" onClick={() => decide('granted')}>
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Enlace «Configurar cookies» del pie: solo aparece si hay Analytics configurado. */
export function CookieSettingsButton() {
  if (!GA_ID) return null;
  return (
    <li>
      <button type="button" className="linklike" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
        Configurar cookies
      </button>
    </li>
  );
}
