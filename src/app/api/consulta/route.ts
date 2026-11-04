import { MAX_CONSULTA, atender, recibirConsulta } from '@/lib/recepcion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => atender(req, MAX_CONSULTA, recibirConsulta);
