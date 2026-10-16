import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Sur Vercel, l'edge réécrit ces en-têtes : la valeur fournie par le client ne peut pas être usurpée.
    if (process.env.VERCEL) {
      const vercelIp = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'] || '')
        .split(',')[0]
        .trim();
      if (vercelIp) return vercelIp;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
