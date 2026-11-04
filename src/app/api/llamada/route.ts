import { MAX_LLAMADA, atender, recibirLlamada } from '@/lib/recepcion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => atender(req, MAX_LLAMADA, recibirLlamada);
