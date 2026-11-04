'use client';
import { authClient } from '@/lib/auth-client';

export function Salir() {
  return (
    <button className="btn btn-secundario" style={{ minHeight: 38 }} onClick={async () => { await authClient.signOut(); window.location.href = '/entrar/'; }}>
      Salir
    </button>
  );
}
