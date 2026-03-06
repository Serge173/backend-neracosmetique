import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentsService {
  getMethods() {
    return [
      { id: 'mtn_momo', name: 'Mobile Money MTN' },
      { id: 'orange_money', name: 'Orange Money' },
      { id: 'moov', name: 'Moov Money' },
      { id: 'card', name: 'Carte bancaire' },
      { id: 'cash_on_delivery', name: 'Paiement à la livraison' },
    ];
  }
}
