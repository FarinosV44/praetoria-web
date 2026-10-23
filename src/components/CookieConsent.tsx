'use client';

// Aviso de cookies. Solo existe si hay un ID de Google Analytics (NEXT_PUBLIC_GA_ID).
// Analytics no se carga hasta que el visitante pulsa «Aceptar». La elección se guarda en el navegador.
import Link from 'next/link';
import { useEffect, useState } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = 'praetoria-consent';
const OPEN_EVENT = 'praetoria:cookie-settings';

type Choice = 'granted' | 'denied';

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function saveChoice(v: Choice) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* navegador sin almacenamiento: la elección dura lo que la visita */
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __gaLoaded?: boolean;
  }
}

function loadGA(id: string) {
  if (window.__gaLoaded) return;
  window.__gaLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
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
    saveChoice(v);
    setOpen(false);
    if (v === 'granted') loadGA(GA_ID);
  };

  return (
    <div className="consent-root" lang="es">
      <div className="consent" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
        <p>
          Usamos cookies analíticas de Google Analytics para saber cuántas personas visitan la web. Solo se activan si las
          aceptas. <Link href="/politica-de-cookies/">Más información</Link>
        </p>
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
