import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT optionnel : si un token est présent et valide, req.user est renseigné.
 * Si pas de token ou token invalide, la requête continue sans req.user (invité).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      return null; // invité
    }
    return user;
  }
}
